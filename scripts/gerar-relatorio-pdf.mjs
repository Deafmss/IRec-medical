import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from '@playwright/test';

const DIR = dirname(fileURLToPath(import.meta.url));

// Uso:  node scripts/gerar-relatorio-pdf.mjs [nome-base] ["Título do PDF"]
// Lê docs/<nome-base>.fonte.html e grava docs/<nome-base>.pdf
const base = process.argv[2] || 'iRec-Analise-de-Mercado';
const titulo = process.argv[3] || 'iRec — Análise de Mercado';

const fonte = readFileSync(join(DIR, '..', 'docs', `${base}.fonte.html`), 'utf8');

const cssImpressao = `
<style>
  /* ---- Tema claro travado: PDF em fundo escuro desperdiça tinta e reduz legibilidade ---- */
  :root{
    --ground:#ffffff!important; --card:#ffffff!important;
    --ink:#15191d!important; --ink-2:#3f4a55!important; --ink-3:#68737e!important;
    --rule:#c9d2da!important; --rule-2:#e2e8ed!important;
    --accent:#1b466d!important; --accent-soft:#eef3f8!important;
    --tem:#1d5c42!important; --tem-bg:#e8f2ec!important;
    --nao:#8b2b34!important; --nao-bg:#f9ebed!important;
    --parc:#75540b!important; --parc-bg:#f8f2e0!important;
  }

  @page { size: A4 portrait; margin: 14mm 12mm 16mm 12mm; }

  html, body { background:#fff!important; font-size:10.2pt; }
  .wrap { max-width:none!important; padding:0!important; }

  /* Capa: título ocupa a primeira página sem forçar quebra desperdiçada */
  header.top { padding:0 0 14pt!important; border-bottom:1.5pt solid var(--accent); margin-bottom:18pt; }
  h1 { font-size:24pt!important; margin-bottom:10pt!important; }
  .lede { font-size:11.5pt!important; max-width:none!important; }
  .eyebrow { font-size:8pt!important; }

  h2 { font-size:15pt!important; margin:20pt 0 3pt!important; break-after:avoid; page-break-after:avoid; }
  h2 + .sub { font-size:9pt!important; margin-bottom:10pt!important; }
  h3 { font-size:11.5pt!important; break-after:avoid; page-break-after:avoid; }
  p { max-width:none!important; }

  /* ---- Matriz: sem scroll horizontal no papel ---- */
  .matrix-wrap { overflow:visible!important; break-inside:auto; }
  table { min-width:0!important; width:100%!important; font-size:7.4pt!important; table-layout:fixed; }
  th, td { padding:3.5pt 4pt!important; word-wrap:break-word; }
  /* nowrap no cabeçalho fazia "Tissue Analytics" invadir a coluna vizinha */
  thead th { position:static!important; font-size:6.6pt!important; white-space:normal!important; }
  thead th span { display:block; line-height:1.3; }
  thead { display:table-header-group; }  /* repete o cabeçalho a cada página */
  tbody tr { break-inside:avoid; page-break-inside:avoid; }
  td:first-child { min-width:0!important; width:22%; font-size:7.6pt!important; }
  .mk { font-size:6.6pt!important; padding:1pt 3.5pt!important; }

  /* ---- Blocos que não devem partir no meio ---- */
  .panel, .player, .blocker, .note { break-inside:avoid; page-break-inside:avoid; }
  .panel { padding:12pt 14pt!important; }
  .panel li { margin-bottom:7pt!important; font-size:9.4pt!important; }
  .cols { gap:12pt!important; grid-template-columns:1fr 1fr!important; }
  .players { gap:9pt!important; grid-template-columns:1fr 1fr 1fr!important; }
  .player { padding:10pt 12pt!important; }
  .player h3 { font-size:10.5pt!important; }
  .player p { font-size:8.4pt!important; }
  .player .num { font-size:7.6pt!important; }
  .blocker { padding:13pt 15pt!important; margin-top:16pt!important; }
  .note { margin-top:20pt!important; font-size:8.8pt!important; }

  footer { margin-top:22pt!important; font-size:8pt!important; break-inside:avoid; }
  footer a { color:var(--accent)!important; text-decoration:none; }
  a { color:var(--accent)!important; }
</style>`;

const documento = `<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${fonte.replace(/<title>[\s\S]*?<\/title>/, `<title>${titulo}</title>`).match(/<style>[\s\S]*?<\/style>/)[0]}
${cssImpressao}
</head>
<body>
${fonte.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<style>[\s\S]*?<\/style>/, '')}
</body>
</html>`;

const caminhoHtml = join(DIR, '..', 'docs', `.print-tmp-${base}.html`);
writeFileSync(caminhoHtml, documento);

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.emulateMedia({ media: 'print', colorScheme: 'light' });
await pagina.goto(pathToFileURL(caminhoHtml).href, { waitUntil: 'load' });

const saida = join(DIR, '..', 'docs', `${base}.pdf`);
await pagina.pdf({
  path: saida,
  format: 'A4',
  printBackground: true,
  margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-family:Georgia,serif;font-size:7pt;color:#68737e;width:100%;padding:0 12mm;">${titulo} · agosto de 2026</div>`,
  footerTemplate: '<div style="font-family:Georgia,serif;font-size:7pt;color:#68737e;width:100%;padding:0 12mm;text-align:right;">página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
});

await navegador.close();
console.log('PDF gerado em:', saida);
