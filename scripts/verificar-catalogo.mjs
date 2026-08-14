#!/usr/bin/env node
/**
 * Verificação mecânica do catálogo de defeitos — iRec
 *
 * Confere, por padrão de texto no código, os itens de `.agents/bugs/` cujo
 * critério de "Feito quando" é objetivo. Não substitui julgamento humano nos
 * itens de lógica clínica, mas cobre a fatia em que um agente erra por não ter
 * feito o grep — foi o que aconteceu na auditoria de 12/08/2026, quando itens
 * já corrigidos foram declarados pendentes e vice-versa.
 *
 * Roda em segundos, custa zero e não pula item.
 *
 *   npm run verificar
 *
 * Saída: PASSOU / FALHOU por item, e código de saída 1 se houver qualquer FALHOU.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = process.cwd();
const IGNORAR = /[\\/](node_modules|dist|android|ios|\.git|graphify-out)[\\/]/;

/** Lê recursivamente os arquivos de código do projeto, uma única vez. */
const coletar = (dir, acc = []) => {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (IGNORAR.test(caminho + '/')) continue;
    const st = statSync(caminho);
    if (st.isDirectory()) coletar(caminho, acc);
    else if (/\.(jsx?|mjs|ts|tsx|css|json|ya?ml|html)$/.test(nome)) acc.push(caminho);
  }
  return acc;
};

const ARQUIVOS = coletar(join(RAIZ, 'src'))
  .concat(existsSync(join(RAIZ, 'supabase')) ? coletar(join(RAIZ, 'supabase')) : [])
  .concat(existsSync(join(RAIZ, 'tests')) ? coletar(join(RAIZ, 'tests')) : [])
  .concat(['package.json', 'vite.config.js', 'index.html', 'eslint.config.js']
    .map(f => join(RAIZ, f)).filter(existsSync));

const CONTEUDO = new Map();
for (const f of ARQUIVOS) {
  try { CONTEUDO.set(relative(RAIZ, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')); } catch { /* ignora */ }
}

/** Busca um padrão nos arquivos que casam com o escopo. Devolve [{arquivo, linha, texto}] */
const buscar = (padrao, escopo = /^src\//) => {
  const achados = [];
  for (const [arquivo, texto] of CONTEUDO) {
    if (!escopo.test(arquivo)) continue;
    const linhas = texto.split('\n');
    for (let i = 0; i < linhas.length; i++) {
      if (padrao.test(linhas[i])) {
        achados.push({ arquivo, linha: i + 1, texto: linhas[i].trim().slice(0, 110) });
      }
    }
  }
  return achados;
};

/** Verdadeiro se algum arquivo do escopo importa o componente. */
const temImport = (nomeComponente) => {
  for (const [arquivo, texto] of CONTEUDO) {
    if (!/^src\//.test(arquivo)) continue;
    if (arquivo.endsWith(`/${nomeComponente}.jsx`)) continue; // o próprio arquivo
    if (new RegExp(`from\\s+['"][^'"]*${nomeComponente}['"]`).test(texto)) return true;
  }
  return false;
};

// ===========================================================================
// CHECAGENS
// Cada uma: id do catálogo, descrição, e uma função que devolve
//   { ok: boolean, detalhe: string }
// ===========================================================================

const CHECAGENS = [

  // --- Módulo 0 / 4: modelo e chaves do Gemini -----------------------------
  {
    id: 'A-1', desc: 'Nenhuma referência a gemini-1.5 no código-fonte',
    fn: () => {
      const h = buscar(/gemini-1\.5/, /^(src|supabase)\//);
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },
  {
    id: 'A-2', desc: 'Seleção dinâmica de modelo presente no front e na Edge Function',
    fn: () => {
      const front = buscar(/v1beta\/models\?key=/, /^src\/services\/geminiService\.js$/).length > 0;
      const edge = buscar(/v1beta\/models\?key=/, /^supabase\//).length > 0;
      return { ok: front && edge, detalhe: `front: ${front ? 'sim' : 'NÃO'} · edge function: ${edge ? 'sim' : 'NÃO'}` };
    },
  },
  {
    id: 'A-2b', desc: 'Nenhum alias -latest em uso (proibido em app clínico)',
    fn: () => {
      const h = buscar(/gemini-[a-z]*-latest/, /^(src|supabase)\//);
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },
  {
    id: 'IREC-0171', desc: 'Erro 404 não remove chaves do rodízio (só 401/403 removem)',
    fn: () => {
      const t = CONTEUDO.get('src/services/geminiService.js') || '';
      const bloco404 = /status === 404[\s\S]{0,320}/.exec(t);
      const removeNo404 = bloco404 ? /GEMINI_KEYS\.splice/.test(bloco404[0]) : true;
      return { ok: !removeNo404, detalhe: removeNo404 ? 'splice de chaves encontrado no ramo do 404' : 'ok' };
    },
  },
  {
    id: 'IREC-0031/0036', desc: 'Chaves do Gemini fora do bundle do cliente',
    fn: () => {
      const h = buscar(/VITE_GEMINI_API_KEY/, /^src\//);
      return { ok: h.length === 0, detalhe: h.length ? `${h.length} referências, ex.: ${h[0].arquivo}:${h[0].linha}` : 'ok' };
    },
  },

  // --- Dado clínico fabricado (proibido por .agents/AGENTS.md) -------------
  {
    id: 'FAB-1', desc: 'Nenhuma foto de banco de imagens (Unsplash) em tela clínica',
    fn: () => {
      const h = buscar(/unsplash\.com/i, /^src\//);
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },
  {
    id: 'FAB-2', desc: 'Nenhum Math.random() em componente clínico',
    fn: () => {
      const alvo = /^src\/components\/(ClinicalTriage|ClinicalHistory|WoundEvolutionComparator|VitalsTelemetry|ReportPDFGenerator|PrescriptionGeneratorModal|Dashboard)\.jsx$/;
      // Geração de id/key com Math.random não é dado clínico — só valor exibido conta.
      const ehIdOuKey = /(id|key|docId|uuid)\s*[:=]|toString\(36\)|Date\.now\(\)\s*\+/;
      const h = buscar(/Math\.random\(/, alvo).filter(x => !ehIdOuKey.test(x.texto));
      return { ok: h.length === 0, detalhe: h.length ? `${h.length} ocorrências, ex.: ${h[0].arquivo}:${h[0].linha}` : 'ok' };
    },
  },
  {
    id: 'FAB-3', desc: 'Registro profissional falso 123456-SP removido',
    fn: () => {
      const h = buscar(/123456-SP/, /^src\//);
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },
  {
    id: 'FAB-4', desc: 'Médico responsável hardcoded removido do prontuário',
    fn: () => {
      const h = buscar(/CRM-SP\s*148|Carlos Eduardo Santos/, /^src\//);
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },
  {
    id: 'FAB-5', desc: 'Nenhuma lista de estabelecimentos de saúde hardcoded injetada como resultado real',
    fn: () => {
      // Só conta objeto com nome + telefone de unidade de saúde no código, não placeholder de formulário.
      const h = buscar(/(hospital|upa|clinica|posto).*(phone|telefone)\s*:\s*['"]\s*\(?\d/i, /^src\//);
      return { ok: h.length === 0, detalhe: h.length ? `${h.length} ocorrências, ex.: ${h[0].arquivo}:${h[0].linha}` : 'ok' };
    },
  },

  // --- Contrato de dados: campos que não existem no retorno do serviço -----
  {
    id: 'CTR-1', desc: 'Nenhuma leitura de entry.tissue_type / pain_level / notes (campos inexistentes)',
    fn: () => {
      const h = buscar(/entry\.(tissue_type|pain_level|notes)\b/, /^src\//);
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },
  {
    id: 'CTR-2', desc: 'Nenhuma leitura de entry.area / woundArea / size (o campo real é aiAreaCm2)',
    fn: () => {
      // Falha só quando a área é lida SEM aiAreaCm2 como campo primário.
      const h = buscar(/\.(woundArea|area)|\.size\s*\|\|/, /^src\/components\/(ReportPDFGenerator|WoundEvolutionComparator|Dashboard)\.jsx$/)
        .filter(x => !/aiAreaCm2/.test(x.texto));
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },
  {
    id: 'CTR-3', desc: 'Presença/ausência coerente do campo last_seen (contador de online)',
    fn: () => {
      const camel = buscar(/lastSeen\b/, /^src\//).length;
      const snake = buscar(/last_seen\b/, /^src\//).length;
      return { ok: !(camel > 0 && snake > 0), detalhe: `camelCase: ${camel} · snake_case: ${snake} — misturar os dois é o defeito` };
    },
  },

  // --- Vocabulário de status dos agendamentos (Fase 1 do plano) -----------
  {
    id: 'STS-1', desc: 'Vocabulário de status de consulta unificado (sem misturar pt-BR e inglês)',
    fn: () => {
      const pt = buscar(/['"]Agendado['"]|['"]presential['"]/, /^src\//);
      const en = buscar(/['"]confirmed['"]/, /^src\//);
      const ok = !(pt.length > 0 && en.length > 0);
      return { ok, detalhe: ok ? 'ok' : `pt-BR: ${pt.length} (ex. ${pt[0]?.arquivo}:${pt[0]?.linha}) · inglês: ${en.length}` };
    },
  },

  // --- Datas em UTC tratadas como local ------------------------------------
  {
    id: 'TZ-1', desc: 'Nenhum toISOString().split() usado como "hoje" local',
    fn: () => {
      const h = buscar(/new Date\(\)\.toISOString\(\)\.split\(/, /^src\//);
      return { ok: h.length === 0, detalhe: h.length ? `${h.length} ocorrências, ex.: ${h[0].arquivo}:${h[0].linha}` : 'ok' };
    },
  },

  // --- Código inalcançável / morto -----------------------------------------
  {
    id: 'IREC-0204', desc: 'Nenhum componente órfão (implementado e nunca importado)',
    fn: () => {
      const candidatos = ['IRecConceptDesign', 'DoctorPatientsListView', 'TelemedicinePage', 'TelemedicineContactsList', 'TelemedicineClinicalCopilot', 'VitalsTelemetry', 'WoundEvolutionComparator'];
      const orfaos = candidatos.filter(c => {
        const existe = [...CONTEUDO.keys()].some(k => k.endsWith(`/${c}.jsx`));
        return existe && !temImport(c);
      });
      return { ok: orfaos.length === 0, detalhe: orfaos.length ? `órfãos: ${orfaos.join(', ')}` : 'ok' };
    },
  },
  {
    id: 'IREC-0039/0040', desc: 'window.initiateTelemedicineCall é registrada em algum lugar',
    fn: () => {
      const usa = buscar(/window\.initiateTelemedicineCall\s*\(/, /^src\//).length > 0;
      const registra = buscar(/window\.initiateTelemedicineCall\s*=/, /^src\//).length > 0;
      return { ok: !usa || registra, detalhe: `usada: ${usa ? 'sim' : 'não'} · registrada: ${registra ? 'sim' : 'NÃO'}` };
    },
  },

  // --- Abas declaradas válidas que não existem no switch -------------------
  {
    id: 'IREC-0202', desc: 'isValidTabForRole não aceita aba sem case no switch do App.jsx',
    fn: () => {
      const t = CONTEUDO.get('src/App.jsx') || '';
      const fn = /const isValidTabForRole[\s\S]*?\n  };/.exec(t);
      if (!fn) return { ok: true, detalhe: 'função não encontrada (item pode não se aplicar)' };
      // Extrair apenas os literais dentro dos arrays de abas — não comparações de papel.
      const declaradas = [];
      for (const arr of fn[0].matchAll(/\[([^\]]+)\]\.includes\(tab\)/g)) {
        for (const lit of arr[1].matchAll(/'([a-z0-9_-]+)'/gi)) declaradas.push(lit[1]);
      }
      const cases = new Set([...t.matchAll(/case\s+'([a-z0-9_-]+)'/gi)].map(m => m[1]));
      const fantasmas = [...new Set(declaradas.filter(d => !cases.has(d)))];
      return { ok: fantasmas.length === 0, detalhe: fantasmas.length ? `abas sem case: ${fantasmas.join(', ')}` : 'ok' };
    },
  },

  // --- Segredos e dependências --------------------------------------------
  {
    id: 'IREC-0424', desc: 'Driver Node do PostgreSQL (pg) fora das dependências',
    fn: () => {
      const t = CONTEUDO.get('package.json') || '';
      return { ok: !/"pg"\s*:/.test(t), detalhe: /"pg"\s*:/.test(t) ? 'ainda declarado' : 'ok' };
    },
  },
  {
    id: 'IREC-0389', desc: 'Sentry não inicializa com DSN placeholder',
    fn: () => {
      const t = CONTEUDO.get('src/main.jsx') || '';
      return { ok: !/placeholder@sentry\.io/.test(t), detalhe: /placeholder@sentry\.io/.test(t) ? 'DSN placeholder ainda presente' : 'ok' };
    },
  },

  // --- Suíte de testes ------------------------------------------------------
  {
    id: 'IREC-0423', desc: 'Suíte de testes executável (dependência, config e script)',
    fn: () => {
      const pkg = CONTEUDO.get('package.json') || '';
      const dep = /"@playwright\/test"/.test(pkg);
      const script = /"test"\s*:/.test(pkg);
      const cfg = ['playwright.config.js', 'playwright.config.mjs', 'playwright.config.ts'].some(f => existsSync(join(RAIZ, f)));
      return { ok: dep && script && cfg, detalhe: `dependência: ${dep ? 'sim' : 'NÃO'} · script test: ${script ? 'sim' : 'NÃO'} · config: ${cfg ? 'sim' : 'NÃO'}` };
    },
  },
  {
    id: 'IREC-0423b', desc: 'Nenhum teste envolto em if (isVisible()) — passaria vazio',
    fn: () => {
      const h = buscar(/if\s*\(\s*await\s+\w+\.isVisible\(\)\s*\)/, /^tests\//);
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },

  // --- Falhas silenciadas ---------------------------------------------------
  {
    id: 'SIL-1', desc: 'Nenhum catch vazio em src/',
    fn: () => {
      const h = buscar(/catch\s*\([^)]*\)\s*\{\s*\}/, /^src\//);
      return { ok: h.length === 0, detalhe: h.length ? `${h.length} ocorrências, ex.: ${h[0].arquivo}:${h[0].linha}` : 'ok' };
    },
  },

  // --- Comportamento: o padrão sumiu, mas o que ficou funciona? ------------
  // Estas checagens existem porque em 12/08/2026 o IREC-0031 "passou" apenas
  // esvaziando o array de chaves: o padrão VITE_ sumiu do código e a IA morreu.
  {
    id: 'BEH-1', desc: 'Nenhuma função depende de uma coleção inicializada vazia e nunca preenchida',
    fn: () => {
      const problemas = [];
      for (const [arquivo, texto] of CONTEUDO) {
        if (!/^src\//.test(arquivo)) continue;
        for (const m of texto.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*\[\s*\]\s*;/g)) {
          const nome = m[1];
          // Recebe itens em algum ponto? (push/concat/unshift, ou reatribuição para algo que não seja outro array vazio)
          const recebeItens = new RegExp(nome + '\\s*\\.\\s*(push|concat|unshift)\\b').test(texto);
          const reatribuido = new RegExp(nome + '\\s*=\\s*(?!\\[\\s*\\])').test(texto);
          if (recebeItens || reatribuido) continue;
          // É lida por alguma lógica de execução? (mais de uma vez = não é só a declaração)
          const usos = (texto.match(new RegExp(nome + '\\s*[.[]', 'g')) || []).length;
          if (usos > 1) problemas.push(`${arquivo}: ${nome} inicializado vazio, nunca preenchido, e lido ${usos}x`);
        }
      }
      return { ok: problemas.length === 0, detalhe: problemas.join(' · ') };
    },
  },
  {
    id: 'BEH-2', desc: 'Nenhuma flag global de window é lida sem nunca ser definida',
    fn: () => {
      const lidas = new Set(), escritas = new Set();
      for (const [arquivo, texto] of CONTEUDO) {
        if (!/^(src|index\.html)/.test(arquivo)) continue;
        for (const m of texto.matchAll(/window\.(__[A-Z0-9_]+__)\s*=/g)) escritas.add(m[1]);
        for (const m of texto.matchAll(/window\.(__[A-Z0-9_]+__)(?!\s*=)/g)) lidas.add(m[1]);
      }
      const fantasmas = [...lidas].filter(f => !escritas.has(f));
      return { ok: fantasmas.length === 0, detalhe: fantasmas.length ? `lidas e nunca definidas: ${fantasmas.join(', ')}` : 'ok' };
    },
  },
  {
    id: 'BEH-3', desc: 'Serviço de IA: nenhum caminho antigo convivendo com o proxy da Edge Function',
    fn: () => {
      const t = CONTEUDO.get('src/services/geminiService.js') || '';
      const usaProxy = /functions\.invoke\(\s*['"]gemini-analysis['"]/.test(t);
      if (!usaProxy) return { ok: true, detalhe: 'ainda não migrado para Edge Function — fora do escopo desta checagem' };
      const diretas = (t.match(/await\s+fetchGeminiWithRotation\(/g) || []).length;
      return {
        ok: diretas === 0,
        detalhe: diretas ? `${diretas} chamadas ainda usam fetchGeminiWithRotation enquanto o proxy existe` : 'ok',
      };
    },
  },
  {
    id: 'DEP-1', desc: 'Toda dependência declarada está instalada em node_modules',
    fn: () => {
      let pkg;
      try { pkg = JSON.parse(CONTEUDO.get('package.json') || '{}'); } catch { return { ok: true, detalhe: 'package.json ilegível' }; }
      const todas = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const faltando = Object.keys(todas).filter(d => !existsSync(join(RAIZ, 'node_modules', ...d.split('/'))));
      return { ok: faltando.length === 0, detalhe: faltando.length ? `rode npm install — faltam: ${faltando.join(', ')}` : 'ok' };
    },
  },

  // --- Segurança de links --------------------------------------------------
  {
    id: 'SEC-1', desc: 'Nenhum target="_blank" sem rel noopener',
    fn: () => {
      // O rel costuma estar em outra linha do mesmo elemento: analisar o bloco, não a linha.
      const faltando = [];
      for (const [arquivo, texto] of CONTEUDO) {
        if (!/^src\//.test(arquivo)) continue;
        for (const m of texto.matchAll(/<a[\s\S]{0,400}?>/g)) {
          if (/target=["']_blank["']/.test(m[0]) && !/rel=/.test(m[0])) {
            const linha = texto.slice(0, m.index).split(/\r?\n/).length;
            faltando.push(`${arquivo}:${linha}`);
          }
        }
      }
      return { ok: faltando.length === 0, detalhe: faltando.join(', ') };
    },
  },
  {
    id: 'SEC-2', desc: 'Nenhum dado de paciente em console.log',
    fn: () => {
      const h = buscar(/console\.(log|warn|error)\([^)]*\b(patientName|patient\.name|cpf|clinicalProfile\.name)\b/, /^src\//);
      return { ok: h.length === 0, detalhe: h.map(x => `${x.arquivo}:${x.linha}`).join(', ') };
    },
  },
];

// ===========================================================================
// EXECUÇÃO
// ===========================================================================

const larguraId = Math.max(...CHECAGENS.map(c => c.id.length));
let falhas = 0;
const linhas = [];

for (const c of CHECAGENS) {
  let r;
  try { r = c.fn(); } catch (e) { r = { ok: false, detalhe: `erro na checagem: ${e.message}` }; }
  if (!r.ok) falhas++;
  linhas.push({ ...c, ...r });
}

console.log(`\nVerificação mecânica do catálogo — ${CHECAGENS.length} checagens\n`);
for (const l of linhas) {
  const marca = l.ok ? 'PASSOU' : 'FALHOU';
  console.log(`  [${marca}] ${l.id.padEnd(larguraId)}  ${l.desc}`);
  if (!l.ok && l.detalhe) console.log(`${' '.repeat(larguraId + 12)}↳ ${l.detalhe}`);
}

console.log(`\n${CHECAGENS.length - falhas} passaram · ${falhas} falharam\n`);

if (falhas > 0) {
  console.log('Os itens que falharam continuam abertos no catálogo (.agents/bugs/).');
  console.log('Esta verificação cobre só os critérios objetivos — lógica clínica exige leitura.\n');
  process.exit(1);
}
process.exit(0);
