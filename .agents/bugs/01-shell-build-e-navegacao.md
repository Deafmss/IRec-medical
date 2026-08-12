# 1. Shell, build e navegação

**17 defeitos** — 2 crítico · 6 alto · 6 médio · 3 baixo

Arquivos tocados por este módulo:

- `android/ + ios/`
- `package.json`
- `src/ (global)`
- `src/App.jsx`
- `src/components/ (7 arquivos)`
- `src/main.jsx`
- `tests/app.spec.js`
- `vite.config.js`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0001 · CRÍTICO · `CONFIRMADO`

**Sessão restaurada do localStorage nunca é sobreposta pela verdade do servidor**

**Onde:** `src/App.jsx:496`

**O defeito:** Em checkSession(), o cache local `irec_active_user` chama resolveAuth() primeiro, o que marca `resolved = true`. Todas as chamadas seguintes de resolveAuth (inclusive a que traz o usuário real do Supabase, e a que traz null) fazem early-return na guarda `if (resolved) return`.

**Como falha:** Um médico tem a sessão revogada no Supabase (senha trocada, conta desativada, token expirado). Ele reabre o app: o cache local o restaura como autenticado, e o resultado real do servidor é descartado. Ele continua vendo a interface clínica completa. Do mesmo modo, se o admin mudar o papel ou o status de verificação dele no banco, isso nunca chega ao app enquanto o cache existir.

**Código atual:**

```jsx
const resolveAuth = (userProfile) => { if (resolved) return; resolved = true; ... }
// cache local roda primeiro:
const cached = localStorage.getItem('irec_active_user');
if (cached) { ... resolveAuth(parsed); }
// e depois esta chamada vira no-op:
const user = await getCurrentUser();
if (user) { ... resolveAuth(user); } else { resolveAuth(null); }
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0036 · CRÍTICO · `CONFIRMADO`

**8 chaves da API Gemini e a chave do Supabase são embutidas no bundle publicado**

**Onde:** `vite.config.js:5`

**O defeito:** vite.config.js não tem nenhuma camada de proxy/servidor: só registra o plugin React. Todas as chaves são lidas como import.meta.env.VITE_* (geminiService.js:3-22, supabaseClient.js:3-4) e o Vite as substitui literalmente no bundle. Verifiquei o artefato já buildado em dist/: 8 chaves Gemini aparecem em texto claro no JS servido ao navegador. Qualquer visitante abre o DevTools e copia as chaves; o .env ainda documenta a senha do PostgreSQL do Supabase em comentário na linha 1.

**Como falha:** Qualquer pessoa acessa o app publicado, abre dist/assets/index-*.js no DevTools, busca por "AQ.Ab8RN6" e extrai as 8 chaves Gemini. Passa a consumir a cota paga do projeto (ou a esgota para os pacientes, gerando 429 em toda a triagem por IA) sem qualquer autenticação.

**Código atual:**

```jsx
export default defineConfig({ plugins: [react()], })   // grep no bundle: dist/assets/index-DpAjXvMY.js contém 8 ocorrências de "AQ.Ab8RN6..." (AQ.Ab8RN6IJd0, AQ.Ab8RN6IzKJ, AQ.Ab8RN6J2ie, AQ.Ab8RN6Jutv, AQ.Ab8RN6Kyu3, ...)
```

**Correção sugerida:** Mover as chamadas ao Gemini para uma função de servidor/edge que guarde as chaves fora do bundle, revogar as 8 chaves expostas e remover a senha do PostgreSQL do .env versionado.

<details><summary>Verificação feita contra o código</summary>

vite.config.js tem apenas `plugins: [react()]` — nenhum proxy, nenhuma camada de servidor. Executei grep no artefato buildado e o dist/assets/index-DpAjXvMY.js contém 8 chaves distintas em texto claro (AQ.Ab8RN6IJd0..., AQ.Ab8RN6IzKJ..., AQ.Ab8RN6J2ie..., AQ.Ab8RN6Jutv..., AQ.Ab8RN6Kyu3..., AQ.Ab8RN6L1rO..., AQ.Ab8RN6L7qu..., AQ.Ab8RN6LBk...). Confirmei também que a primeira linha do .env é o comentário `# Senha do Banco de Dados PostgreSQL (Supabase): <senha em texto claro>`. Qualquer visitante do app publicado extrai as chaves pelo DevTools. Observação: a chave anon do Supabase é projetada para ser pública (protegida por RLS) — o problema real e inegociável são as 8 chaves Gemini.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0037 · ALTO · `CONFIRMADO`

**Aplicativos nativos empacotam um build 18 dias mais velho que o da web**

**Onde:** `android/ + ios/:1`

**O defeito:** Os bundles copiados para android/app/src/main/assets/public/assets/ e ios/App/App/public/assets/ são de 23/07 (index-C-tyDXa5.js, 1.176.226 bytes), enquanto o build web em dist/ é de 09/08 (index-DpAjXvMY.js, 1.360.941 bytes). O `npx cap sync` não foi refeito.

**Como falha:** Quem instala o app iRec pelo Android ou iOS roda uma versão com quase 185 KB de código a menos — sem as correções e telas dos últimos 18 dias. Bugs já corrigidos na web continuam ativos no celular, e a diferença é invisível para quem testa só no navegador.

**Código atual:**

```jsx
dist/assets/index-DpAjXvMY.js        1.360.941  09/08
android/.../assets/index-C-tyDXa5.js  1.176.226  23/07
ios/.../assets/index-C-tyDXa5.js      1.176.226  23/07
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0038 · ALTO · `CONFIRMADO`

**Timeout de 1,8 s prende o usuário na tela de login mesmo com sessão válida**

**Onde:** `src/App.jsx:450`

**O defeito:** O setTimeout de segurança marca `resolved = true` e desliga o loading, mas não define currentUser. Quando o getCurrentUser() finalmente responde com um usuário válido, resolveAuth faz early-return e o usuário nunca é logado.

**Como falha:** Paciente em rede 3G lenta abre o app. O Supabase demora 2,5 s para responder. Aos 1,8 s o app decide 'entrar em modo offline' e mostra a tela de Login. Quando a sessão real chega, ela é ignorada — o paciente precisa digitar e-mail e senha de novo, mesmo tendo sessão válida.

**Código atual:**

```jsx
const timeoutId = setTimeout(() => {
  if (!resolved) {
    console.warn("Timeout de inicialização do Supabase atingido...");
    setLoadingAuth(false);
    resolved = true;   // <- bloqueia o resolveAuth(user) que viria depois
  }
}, 1800);
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0039 · ALTO · `CONFIRMADO`

**Botão 'LIGAR POR VÍDEO AGORA' do modo acessível não inicia chamada nenhuma**

**Onde:** `src/App.jsx:799`

**O defeito:** O callback `onStartVideoCall` passado para AccessibleTelemedicineView depende de `window.initiateTelemedicineCall`, que não é definido em nenhum lugar do projeto (grep em src/ retorna apenas estas duas linhas de uso). Pior: na linha 1603 o componente `<Telemedicine>` — único capaz de registrar sinalização/WebRTC — é explicitamente NÃO renderizado quando `uiMode === 'accessible' && role === 'patient'`. Logo o guard sempre falha e cai no alert.

**Como falha:** Paciente idoso no modo acessível aperta o botão verde gigante 'LIGAR POR VÍDEO AGORA' (AccessibleSubViews.jsx:84-110). Aparece apenas um alert 'Iniciando videochamada com o profissional...' e nada acontece: nenhuma chamada é criada, nenhum profissional é notificado, a tela permanece igual. O recurso de teleconsulta é inoperante justamente para o público que mais depende dele.

**Código atual:**

```jsx
                if (typeof window !== 'undefined' && window.initiateTelemedicineCall) {
                  window.initiateTelemedicineCall(targetId);
                } else {
                  alert("Iniciando videochamada com o profissional...");
```

**Correção sugerida:** Renderizar <Telemedicine> também no modo acessível (ou expor um callback real via prop/context) e substituir o alert por um erro explícito enquanto a integração não existir.

<details><summary>Verificação feita contra o código</summary>

Grep em src/ retorna APENAS as linhas 799 e 800 para `initiateTelemedicineCall` — a função nunca é definida em lugar algum, então o guard `window.initiateTelemedicineCall` é sempre falso e o fluxo cai no `alert("Iniciando videochamada com o profissional...")`. Confirmei também App.jsx:1603, onde `<Telemedicine>` (único componente com sinalização/WebRTC) é explicitamente NÃO renderizado quando `uiMode === 'accessible' && currentUser?.role === 'patient'`, logo nem por efeito colateral o handler poderia ser registrado. O botão existe e é alcançável: AccessibleSubViews.jsx:84-110 chama `onStartVideoCall()` diretamente no onClick do botão verde gigante, e a rota `case 'telemedicine'` (App.jsx:792-806) renderiza AccessibleTelemedicineView exatamente nesse modo. Pior: o alert AFIRMA ao usuário que a chamada está iniciando, ou seja, dá feedback falso de sucesso.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0040 · ALTO · `CONFIRMADO`

**window.initiateTelemedicineCall nunca é definida: videochamada do Modo Fácil não funciona**

**Onde:** `src/App.jsx:799`

**O defeito:** O Modo Fácil chama uma função global que nenhum arquivo do projeto atribui a window. A guarda cai sempre no else, exibindo um alert. Além disso, no Modo Fácil o componente Telemedicine nem é montado (linha 1603), então não existe nada que pudesse registrar a função.

**Como falha:** Paciente idoso no Modo Fácil aperta 'LIGAR POR VÍDEO AGORA'. Aparece apenas o alerta 'Iniciando videochamada com o profissional...' e nada acontece. Nenhuma chamada é criada.

**Código atual:**

```jsx
if (typeof window !== 'undefined' && window.initiateTelemedicineCall) {
  window.initiateTelemedicineCall(targetId);
} else {
  alert("Iniciando videochamada com o profissional...");
}
// grep em src/: initiateTelemedicineCall só aparece nestas 2 linhas
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0041 · ALTO · `CONFIRMAR-SCHEMA`

**Médico/enfermeiro que abre a aba Histórico vê sempre prontuário vazio (props erradas passadas ao componente)**

**Onde:** `src/App.jsx:838`

**O defeito:** Em `renderContent()`, App.jsx:739 calcula `targetEntries = isClinician ? selectedPatientEntriesForDoctor : entries` e `targetProfile` justamente para clínicos, e outros casos usam `entries={targetEntries}` (ex.: linha 881). O caso 'history' passa `entries` e `clinicalProfile` crus. Esses dois estados só são populados quando `currentUser.role === 'patient'` (App.jsx:553-559 e :692-701).

**Como falha:** Um médico seleciona o paciente João e clica em 'Histórico'. Como `entries` é [] e `clinicalProfile` é null para usuários com papel doctor/nurse, a tela mostra 'Nenhum Registro de Avaliação no Prontuário' mesmo com o paciente tendo dezenas de avaliações. O cabeçalho de impressão também sai com 'Paciente', 'Não informada', 'Não informado'. Além disso nenhum log de auditoria é gerado (o efeito exige clinicalProfile), justamente no caso em que a auditoria LGPD é obrigatória.

**Código atual:**

```jsx
      case 'history':
        return <ClinicalHistory entries={entries} clinicalProfile={clinicalProfile} />;
```

**Correção sugerida:** Trocar por `<ClinicalHistory entries={targetEntries} clinicalProfile={targetProfile} setActiveTab={setActiveTab} />`.

<details><summary>Verificação feita contra o código</summary>

A linha 838 é literalmente `return <ClinicalHistory entries={entries} clinicalProfile={clinicalProfile} />;`, ignorando `targetEntries`/`targetProfile` calculados logo acima (linhas 737-739) e usados corretamente em outros casos (ex.: 'protocols', linhas 880-881). Confirmei que `entries` e `clinicalProfile` só são populados quando `currentUser.role === 'patient'` — tanto no load inicial (551-563) quanto no refresh periódico (692-705); para clínico o polling só alimenta `selectedPatientEntriesForDoctor` (709-714). O caso é alcançável por usuário real de duas formas: (a) a sidebar de enfermeiro cai no ramo `else` (o ternário é admin → doctor → else, e grep confirma que não existe ramo `role === 'nurse'`), então o enfermeiro vê e clica no botão 'Histórico & Prontuário' (linhas 1329-1338); (b) a `mobile-bottom-nav` (linha 1617) é renderizada sem qualquer filtro de papel e traz o item 'Histórico' (1638-1646), alcançável por médico no celular. Nesses casos ClinicalHistory recebe entries=[] e clinicalProfile=null, o efeito de auditoria (ClinicalHistory.jsx:128) não dispara por exigir clinicalProfile truthy, e o cabeçalho de impressão usa os fallbacks genéricos — exatamente o cenário descrito.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0042 · ALTO · `CONFIRMADO`

**case 'admin-partners' duplicado no switch: a página AdminPartners é inalcançável**

**Onde:** `src/App.jsx:872`

**O defeito:** O rótulo 'admin-partners' já existe na linha 852, agrupado com os demais casos que renderizam AdminDashboard. O segundo case, na linha 872, nunca é alcançado. Confirmado pelo ESLint (regra no-duplicate-case).

**Como falha:** O admin clica em 'Parcerias' na barra lateral. Em vez da tela dedicada AdminPartners.jsx (273 linhas com o formulário de cadastro de parceiro), ele recebe a aba de parceiros genérica do AdminDashboard. O arquivo AdminPartners.jsx é código morto.

**Código atual:**

```jsx
case 'admin-partners':   // linha 852, junto com admin-metrics, admin-users, etc.
  return <AdminDashboard ... />;
...
case 'admin-partners':   // linha 872 - INALCANÇÁVEL
  return <AdminPartners setActiveTab={setActiveTab} />;
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0201 · MÉDIO · `CONFIRMADO`

**52 violações das regras de Hooks apontadas pelo ESLint em 15 arquivos**

**Onde:** `src/ (global):1`

**O defeito:** Rodando `npx eslint .` restrito a src/: 21 ocorrências de react-hooks/set-state-in-effect (setState síncrono no corpo do efeito, causando renders em cascata), 15 de react-hooks/purity (Date.now()/Math.random() chamados durante o render) e 16 de react-hooks/exhaustive-deps (dependências faltando).

**Como falha:** As violações de purity em AIChatAssistant.jsx (9 ocorrências) e ReportPDFGenerator.jsx significam que ids de mensagem e o código de autenticidade do laudo mudam a cada render. As de exhaustive-deps em Telemedicine.jsx e DoctorDashboard.jsx são a causa direta dos closures obsoletos já relatados.

**Código atual:**

```jsx
react-hooks/set-state-in-effect  21  (App.jsx:103,123,144,178; Telemedicine.jsx:260,273,403,615; DoctorDashboard.jsx:175,193,269; ...)
react-hooks/purity               15  (AIChatAssistant.jsx:441..854; ReportPDFGenerator.jsx:9; BookingModal.jsx:29; ...)
react-hooks/exhaustive-deps      16  (Telemedicine.jsx:303,335,392,509,601; DoctorDashboard.jsx:176,204,276; ...)
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0202 · MÉDIO · `CONFIRMADO`

**Aba restaurada do localStorage sem validar o papel do usuário**

**Onde:** `src/App.jsx:467`

**O defeito:** resolveAuth restaura `irec_active_tab` antes de checar o papel. A chave só é removida no logout explícito; se o navegador fechar sem logout, ela sobrevive para o próximo usuário do dispositivo.

**Como falha:** Num tablet compartilhado da unidade, um médico usa o app e fecha o navegador na aba 'doctor-dashboard'. Depois um paciente faz login: o app o leva direto para a aba do painel médico em vez do dashboard do paciente.

**Código atual:**

```jsx
const savedTab = localStorage.getItem('irec_active_tab');
if (savedTab) {
  setActiveTab(savedTab);   // nenhuma validação de papel
} else { /* só aqui o papel é considerado */ }
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0203 · MÉDIO · `CONFIRMADO`

**AdminDashboard renderizado sem nenhuma prop no case default deixa a tela em branco**

**Onde:** `src/App.jsx:909`

**O defeito:** No ramo default, `<AdminDashboard />` é montado sem activeTab, setActiveTab nem onVerificationProcessed. Dentro do componente, a cadeia de ternários termina em `: null` (linha 1182), então nenhum conteúdo é renderizado.

**Como falha:** O admin abre o app com um hash de aba desconhecido na URL (ou um valor antigo em irec_active_tab). Ele vê o cabeçalho e o seletor de período, e abaixo disso nada — a tela do painel fica vazia, sem erro nem explicação.

**Código atual:**

```jsx
default:
  if (isAdmin) {
    return <AdminDashboard />;   // sem activeTab: todos os ternários caem em null
  }
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0204 · MÉDIO · `CONFIRMADO`

**Sete componentes nunca são importados: funcionalidades inteiras são inalcançáveis**

**Onde:** `src/components/ (7 arquivos):1`

**O defeito:** Varredura de imports em todo o src/: IRecConceptDesign.jsx (274 linhas), VitalsTelemetry.jsx (277), WoundEvolutionComparator.jsx (379), doctor/DoctorPatientsListView.jsx (198), telemedicine/TelemedicineClinicalCopilot.jsx (151), telemedicine/TelemedicineContactsList.jsx (170) e telemedicine/TelemedicinePage.jsx (25) não são referenciados por nenhum arquivo.

**Como falha:** Duas funcionalidades clínicas anunciadas — 'Sinais Vitais / Telemetria' e 'Comparador de Evolução da Lesão' — estão implementadas mas não têm nenhum caminho de navegação: nenhum usuário consegue chegar até elas. São também ~1.470 linhas mantidas sem uso, e a única razão de lucide-react ser uma dependência do projeto.

**Código atual:**

```jsx
grep -rl "from '.*IRecConceptDesign'" src/  => 0 resultados
grep -rl "from '.*VitalsTelemetry'" src/     => 0 resultados
grep -rl "from '.*WoundEvolutionComparator'" src/ => 0 resultados
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0389 · MÉDIO · `CONFIRMADO`

**Sentry inicializado em produção com DSN placeholder: erros com dados do paciente vão para destino desconhecido**

**Onde:** `src/main.jsx:10`

**O defeito:** A condição `import.meta.env.PROD || VITE_SENTRY_DSN` garante que o Sentry sempre inicializa no build de produção; quando VITE_SENTRY_DSN não está definida (não existe no .env do projeto), o DSN usado é o literal "https://placeholder@sentry.io/123456". Confirmei que essa string está no bundle publicado (dist/assets/index-DpAjXvMY.js). O Sentry passa a enviar eventos, breadcrumbs de console e tracing (tracesSampleRate 0.2) para o projeto 123456 do sentry.io, que não pertence ao iRec. O @sentry/react é dependência declarada em package.json:16.

**Como falha:** App é publicado sem VITE_SENTRY_DSN. Um paciente usa a triagem, ocorre uma exceção, e o Sentry envia o evento com breadcrumbs (que incluem os console.log com nome de paciente do auditLogger) e URLs para um projeto de terceiros no sentry.io. Ao mesmo tempo, a equipe do iRec nunca recebe nenhum erro, acreditando que o monitoramento está ativo.

**Código atual:**

```jsx
dsn: import.meta.env.VITE_SENTRY_DSN || "https://placeholder@sentry.io/123456",   // confirmado literal no bundle dist/assets/index-DpAjXvMY.js
```

**Correção sugerida:** Inicializar o Sentry apenas quando `import.meta.env.VITE_SENTRY_DSN` estiver definido, removendo o DSN placeholder.

<details><summary>Verificação feita contra o código</summary>

main.jsx:8-16 confirma a condição `if (import.meta.env.PROD || import.meta.env.VITE_SENTRY_DSN)` e o literal `dsn: import.meta.env.VITE_SENTRY_DSN || "https://placeholder@sentry.io/123456"`, com tracesSampleRate 0.2. Confirmei por grep que a string 'placeholder@sentry.io/123456' está presente 1 vez no bundle publicado dist/assets/index-DpAjXvMY.js, ou seja, o build atual foi feito sem VITE_SENTRY_DSN. Rebaixo de alto para médio: o efeito garantido é o monitoramento silenciosamente inoperante (a equipe nunca recebe erro nenhum); a exfiltração para um projeto de terceiro é improvável, porque a chave pública 'placeholder' não corresponde a um projeto válido e o ingest responde 401/403.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0423 · MÉDIO · `CONFIRMADO`

**A suíte de testes não é executável e, se fosse, passaria sem verificar nada**

**Onde:** `tests/app.spec.js:1`

**O defeito:** O arquivo importa @playwright/test, mas o pacote não está em package.json nem em node_modules, não existe playwright.config.js e não há script `test`. Além disso, cada teste envolve as asserções em `if (await elemento.isVisible())` — quando o elemento não existe, o bloco inteiro é pulado e o teste passa.

**Como falha:** Não há como rodar `npm test`. E mesmo com o Playwright instalado, os quatro testes passariam num app completamente quebrado, porque a ausência dos elementos faz o corpo do teste ser ignorado em vez de falhar.

**Código atual:**

```jsx
const triageButton = page.locator('text=Nova Avaliação');
if (await triageButton.isVisible()) {
  await triageButton.click();
  await expect(...).toBeVisible();
}   // sem else: elemento ausente => teste verde
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0424 · BAIXO · `CONFIRMADO`

**Driver Node do PostgreSQL (pg) declarado como dependência de um app de navegador**

**Onde:** `package.json:19`

**O defeito:** "pg": "^8.22.0" está em dependencies, mas grep em src/ não encontra nenhum import de 'pg' — é um driver que só funciona em Node (depende de net/tls/dns). Se qualquer arquivo passar a importá-lo, o build do Vite para o navegador quebra na resolução dos módulos nativos. A presença dele combina com o comentário da primeira linha do .env, que registra a senha do banco PostgreSQL do Supabase em texto claro, indicando a intenção de acesso direto ao banco a partir do cliente.

**Como falha:** Desenvolvedor vê `pg` já instalado e escreve, em um serviço do front, `import { Client } from 'pg'` para consultar o banco direto. O build do Vite falha com erro de módulo não resolvido (net/tls) e, se ele contornar com polyfills, a senha do banco vai para o bundle público.

**Código atual:**

```jsx
"dependencies": {
    ...
    "pg": "^8.22.0",
    "react": "^19.2.6",
```

**Correção sugerida:** Remover `pg` das dependencies (`npm uninstall pg`) e apagar do .env o comentário com a senha do banco.

<details><summary>Verificação feita contra o código</summary>

Confirmei `"pg": "^8.22.0"` em dependencies (package.json:19) e grep em todo o src não encontra nenhum `from 'pg'` nem `require('pg')`. É um driver exclusivo de Node (depende de net/tls/dns) declarado como dependência de runtime de um app 100% de navegador — hoje é apenas peso morto e um convite ao erro. Confirmei também o contexto que o auditor cita: a primeira linha do .env é um comentário com a senha do PostgreSQL do Supabase em texto claro, o que sugere intenção de acesso direto ao banco pelo cliente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0425 · BAIXO · `CONFIRMADO`

**ClinicalHistory não recebe setActiveTab: o botão da tela vazia nunca aparece**

**Onde:** `src/App.jsx:838`

**O defeito:** ClinicalHistory declara a prop setActiveTab e renderiza o CTA da tela vazia dentro de `{setActiveTab && (...)}`. O App nunca passa essa prop, então a guarda é sempre falsa. Mesmo se fosse passada, o destino 'triage' não existe no switch (o correto é 'upload').

**Como falha:** Paciente novo, sem nenhum registro, abre a aba Histórico. Vê o texto 'Realize a sua primeira avaliação' mas nenhum botão para fazê-la — precisa descobrir sozinho onde fica a triagem.

**Código atual:**

```jsx
// App.jsx:838
case 'history': return <ClinicalHistory entries={entries} clinicalProfile={clinicalProfile} />;
// ClinicalHistory.jsx:256
{setActiveTab && (<button onClick={() => setActiveTab('triage')}>...</button>)}
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0588 · BAIXO · `CONFIRMADO`

**Sentry ativo sem sourcemap configurado no Vite: stack traces inutilizáveis**

**Onde:** `vite.config.js:5`

**O defeito:** main.jsx inicializa o Sentry em produção, mas vite.config.js não define build.sourcemap nem usa @sentry/vite-plugin (ausente do package.json). O bundle de produção é um único arquivo minificado de 1,36MB (dist/assets/index-DpAjXvMY.js), portanto todo erro capturado chega ao Sentry apontando para nomes de variáveis de uma letra e uma linha única.

**Como falha:** Um paciente sofre um crash na triagem em produção. O evento chega ao Sentry com stack trace apontando para index-DpAjXvMY.js:1:842119 e funções `t`/`e`, sem qualquer forma de mapear para o arquivo e a linha do código-fonte. O time não consegue reproduzir nem corrigir o defeito.

**Código atual:**

```jsx
export default defineConfig({
  plugins: [react()],
})   /* sem build: { sourcemap: true }, sem sentryVitePlugin */
```

**Correção sugerida:** Adicionar `build: { sourcemap: true }` no vite.config.js e o @sentry/vite-plugin para enviar os sourcemaps sem publicá-los junto ao bundle.

<details><summary>Verificação feita contra o código</summary>

vite.config.js tem apenas 7 linhas: `defineConfig({ plugins: [react()] })`, sem bloco build, sem sourcemap e sem sentryVitePlugin — confirmei também que @sentry/vite-plugin não aparece no package.json. main.jsx:8-16 inicializa o Sentry sempre que import.meta.env.PROD, e o dist tem um único chunk minificado (index-DpAjXvMY.js). Portanto qualquer evento capturado chega com stack trace irrecuperável. Ressalva que reduz a gravidade prática: pelo item 50229, o DSN placeholder provavelmente já impede que qualquer evento chegue.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "App.jsx|main.jsx|app.spec.js|vite.config.js"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
