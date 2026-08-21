/**
 * Selo de integridade de documento clínico.
 *
 * O QUE ISTO É: um resumo criptográfico (SHA-256) do conteúdo do documento,
 * gravado junto com ele. Serve para detectar alteração posterior — se o
 * conteúdo mudar, o resumo não confere mais.
 *
 * O QUE ISTO NÃO É: assinatura digital. Não há chave privada, nem certificado,
 * nem PKCS#7/CAdES, nem cadeia de confiança. Um resumo não prova autoria e não
 * tem valor jurídico. Documento médico com validade legal exige certificado
 * ICP-Brasil de verdade (A1, A3 ou nuvem), via provedor credenciado.
 *
 * ---
 *
 * O QUE HAVIA ANTES
 *
 * O código gravava no documento, e exibia ao paciente sob o selo
 * "ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)":
 *
 *   hash:      SHA-256 do JSON truncado em 32 hex — resumo, não assinatura
 *   serial:    `BR-<CRM>-<6 últimos dígitos de Date.now()>-CFM` — inventado
 *   authority: "AC ITI Federal v5" / "AC Soluti Multipla v5" — inventado
 *
 * E o PIN do certificado era aceito com qualquer string não vazia.
 *
 * Nada disso existia. Era um documento médico com selo de validade jurídica
 * falso — exposição direta perante CFM e ITI, além de não ter o valor legal
 * que o paciente acreditava ter.
 *
 * Este módulo mantém a parte que era real (o resumo de integridade) e remove a
 * parte inventada. Quando houver integração com provedor credenciado, a
 * assinatura de verdade entra ao lado disto, não em vez disto.
 */

/** Tamanho do resumo exibido. 128 bits são suficientes para detectar alteração. */
const DIGEST_HEX_LENGTH = 32;

/**
 * Resumo SHA-256 do conteúdo do documento.
 *
 * @returns {Promise<string|null>} hex maiúsculo, ou null se o ambiente não
 *   oferecer WebCrypto. Devolver null é melhor que devolver um valor aleatório:
 *   a versão anterior caía em `crypto.randomUUID()` no catch, produzindo um
 *   "hash" que não tinha relação nenhuma com o conteúdo e nunca conferiria.
 */
export const computeDocumentDigest = async (type, patientId, contentObj) => {
  try {
    const rawText = JSON.stringify({ type, patientId, content: contentObj });
    const data = new TextEncoder().encode(rawText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, DIGEST_HEX_LENGTH)
      .toUpperCase();
  } catch (err) {
    console.warn('[iRec] Não foi possível calcular o resumo de integridade:', err);
    return null;
  }
};

/**
 * Registro de integridade a gravar no documento.
 *
 * Campos deliberadamente ausentes: `serial` e `authority`. Não existe
 * certificado, então não há número de série nem autoridade certificadora a
 * declarar. `signatureMethod` diz o que de fato foi feito.
 *
 * @param {object} params
 * @param {string} params.digest resumo de computeDocumentDigest
 * @param {object} params.professional quem emitiu
 * @returns {object|null}
 */
export const buildIntegrityRecord = ({ digest, professional }) => {
  if (!digest) return null;

  return {
    // Método declarado com precisão: é resumo, não assinatura.
    signatureMethod: 'SHA-256 (selo de integridade interno do iRec)',
    // Falso de forma explícita, para nenhuma tela inferir validade jurídica a
    // partir da simples presença do registro.
    isIcpBrasilSigned: false,
    hash: `SHA256:${digest}`,
    sealedAt: new Date().toISOString(),
    issuedBy: {
      name: professional?.name || null,
      registry: String(professional?.crm || '').trim() || null
    }
  };
};

/** Aviso obrigatório em documento sem assinatura ICP-Brasil. */
export const LEGAL_NOTICE_NO_ICP =
  'Este documento possui selo interno de integridade (resumo SHA-256), mas NÃO possui '
  + 'assinatura digital ICP-Brasil. Não tem validade para dispensação de medicamento '
  + 'controlado, perícia ou apresentação ao INSS. Para esses fins, solicite ao profissional '
  + 'a versão assinada com certificado digital.';

/**
 * Confere um documento contra o resumo gravado nele.
 * Existe para o selo ser verificável, não decorativo.
 *
 * @returns {Promise<boolean|null>} null quando não há resumo a conferir
 */
export const verifyDocumentIntegrity = async (type, patientId, contentObj, storedHash) => {
  if (!storedHash) return null;
  const digest = await computeDocumentDigest(type, patientId, contentObj);
  if (!digest) return null;
  return `SHA256:${digest}` === storedHash;
};
