// @ts-check
import { supabase, isSupabaseConfigured } from '../supabaseClient';

/**
 * Armazenamento e leitura de mídia clínica.
 *
 * Dois problemas resolvidos aqui.
 *
 * 1. **URL pública gravada no prontuário.** `addWoundEntry` gravava em
 *    `photo_url` o resultado de `getPublicUrl()`, que gera
 *    `/storage/v1/object/public/<bucket>/<arquivo>`. Esse endpoint responde
 *    `400 · {"error":"Bucket not found"}` porque os buckets não estão marcados
 *    como públicos no ambiente atual — verificado em produção. Resultado:
 *    **nenhuma foto de evolução de ferida era exibível**, e o registro guardava
 *    uma URL permanentemente quebrada.
 *
 *    Agora se grava o **caminho** dentro do bucket e a URL é assinada na hora
 *    da leitura. Caminho é o dado durável; URL assinada é efêmera por natureza.
 *
 * 2. **Arquivos na raiz do bucket.** O nome era `${Date.now()}_wound.jpg`, sem
 *    pasta por paciente. Isso impede escrever policy de RLS por `auth.uid()`
 *    sobre o caminho — o que bloqueia a correção da exposição do storage.
 *    Uploads novos vão para `<patient_id>/<arquivo>`.
 *
 * A leitura aceita os três formatos que existem hoje no banco, para os
 * registros antigos voltarem a funcionar sem migração de dados:
 *   - caminho puro (`<uuid>/169...-ab12.webp`) — o formato novo
 *   - URL pública legada (`.../object/public/wounds/169..._wound.webp`)
 *   - data URL base64 (modo de contingência offline)
 */

/** Validade da URL assinada. Curta de propósito: é dado clínico sensível. */
export const SIGNED_URL_TTL_SECONDS = 900;

/**
 * Extensão segura do arquivo. `file.name.split('.').pop()` devolvia o nome
 * inteiro quando não havia ponto (foto vinda da câmera costuma não ter), e
 * aceitava `../` no caminho.
 */
export const safeExtension = (file) => {
  const nome = String(file?.name || '');
  const ponto = nome.lastIndexOf('.');
  const bruta = ponto > 0 ? nome.slice(ponto + 1) : '';
  const limpa = bruta.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  if (limpa) return limpa;

  // Sem extensão utilizável, deduz do mime type.
  const mime = String(file?.type || '');
  if (mime.startsWith('image/')) return mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'jpg';
  if (mime.startsWith('video/')) return mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'mp4';
  if (mime === 'application/pdf') return 'pdf';
  return 'bin';
};

/**
 * Caminho de upload, sempre dentro da pasta do paciente.
 *
 * @param {string} patientId
 * @param {File} file
 * @param {string} [prefix] rótulo curto para facilitar leitura no painel
 */
export const buildMediaPath = (patientId, file, prefix = 'media') => {
  const pasta = String(patientId || 'sem-paciente').replace(/[^a-zA-Z0-9-]/g, '');
  const unico = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return `${pasta}/${prefix}-${unico}.${safeExtension(file)}`;
};

/** Já é algo que o navegador consegue exibir direto? */
const isDirectlyUsable = (value) =>
  typeof value === 'string' && (value.startsWith('data:') || value.startsWith('blob:'));

/**
 * Reduz qualquer um dos formatos aceitos ao caminho dentro do bucket.
 * Devolve `null` quando o valor não é um caminho (data URL, vazio, URL externa).
 */
export const toStoragePath = (value, bucket) => {
  if (!value || typeof value !== 'string') return null;
  if (isDirectlyUsable(value)) return null;

  // URL legada gravada por getPublicUrl(): .../object/public/<bucket>/<caminho>
  const marcador = `/object/public/${bucket}/`;
  const idx = value.indexOf(marcador);
  if (idx !== -1) {
    return decodeURIComponent(value.slice(idx + marcador.length).split('?')[0]);
  }

  // URL assinada já emitida antes: .../object/sign/<bucket>/<caminho>?token=...
  const marcadorSign = `/object/sign/${bucket}/`;
  const idxSign = value.indexOf(marcadorSign);
  if (idxSign !== -1) {
    return decodeURIComponent(value.slice(idxSign + marcadorSign.length).split('?')[0]);
  }

  // Qualquer outra URL absoluta não é nossa — não há caminho a extrair.
  if (/^https?:\/\//i.test(value)) return null;

  return value.replace(/^\/+/, '');
};

/**
 * Assina uma lista de valores de uma vez.
 *
 * Em lote porque um prontuário abre com várias fotos e uma chamada por imagem
 * seria N+1. `createSignedUrls` (plural) faz isso numa requisição.
 *
 * @param {string} bucket
 * @param {string[]} values caminhos, URLs legadas ou data URLs
 * @returns {Promise<Map<string,string>>} valor original -> URL exibível
 */
export const resolveMediaUrls = async (bucket, values) => {
  const mapa = new Map();
  const unicos = [...new Set((values || []).filter(Boolean))];
  if (unicos.length === 0) return mapa;

  /** @type {Map<string,string[]>} caminho -> valores originais que o produziram */
  const porCaminho = new Map();

  unicos.forEach((valor) => {
    if (isDirectlyUsable(valor)) {
      mapa.set(valor, valor);
      return;
    }
    const caminho = toStoragePath(valor, bucket);
    if (!caminho) {
      // URL externa ou formato desconhecido: devolve como está e deixa a
      // interface tratar a imagem quebrada.
      mapa.set(valor, valor);
      return;
    }
    const lista = porCaminho.get(caminho) || [];
    lista.push(valor);
    porCaminho.set(caminho, lista);
  });

  const caminhos = [...porCaminho.keys()];
  if (caminhos.length === 0 || !isSupabaseConfigured || !supabase) {
    caminhos.forEach((c) => porCaminho.get(c).forEach((v) => mapa.set(v, v)));
    return mapa;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(caminhos, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.warn(`[iRec] Não foi possível assinar URLs do bucket "${bucket}":`, error);
    caminhos.forEach((c) => porCaminho.get(c).forEach((v) => mapa.set(v, v)));
    return mapa;
  }

  data.forEach((item) => {
    const originais = porCaminho.get(item.path) || [];
    originais.forEach((v) => mapa.set(v, item.signedUrl || v));
  });

  // Caminho que a API não devolveu: mantém o valor original.
  caminhos.forEach((c) => {
    porCaminho.get(c).forEach((v) => {
      if (!mapa.has(v)) mapa.set(v, v);
    });
  });

  return mapa;
};

/** Conveniência para um único valor. */
export const resolveMediaUrl = async (bucket, value) => {
  if (!value) return value;
  const mapa = await resolveMediaUrls(bucket, [value]);
  return mapa.get(value) || value;
};

/**
 * Sobe o arquivo e devolve o **caminho** — nunca uma URL.
 *
 * @returns {Promise<string>} caminho dentro do bucket
 * @throws quando o upload falha
 */
export const uploadClinicalMedia = async (bucket, patientId, file, prefix = 'media') => {
  const path = buildMediaPath(patientId, file, prefix);
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return path;
};
