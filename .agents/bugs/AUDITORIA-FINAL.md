# Relatório de Auditoria Final de Defeitos — Plataforma iRec

**Data da Auditoria:** 12/08/2026  
**Status do STATUS.md:** Trata-se de uma **ALEGAÇÃO**, verificada minuciosamente contra o código-fonte real do repositório.  
**Regra Estrita Aplicada:** *"Não corrija nada nesta passada — apenas verifique e relate."*

---

## 📊 Resumo Executivo Geral (590 Defeitos Auditados)

| Módulo | Nome do Módulo | Defeitos Auditados | CORRIGIDO | PARCIAL | NÃO CORRIGIDO | DEPENDE DE OUTRO |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **00** | Urgente: Cota e Modelo do Gemini | 4 | 3 | 0 | 1 | 0 |
| **01** | Shell, Build e Navegação | 17 | 9 | 4 | 3 | 1 |
| **02** | Telemedicina e Chat | 36 | 25 | 7 | 4 | 0 |
| **03** | Protocolos, Receitas e Laudos | 32 | 28 | 3 | 1 | 0 |
| **04** | Assistente de IA | 33 | 31 | 1 | 1 | 0 |
| **05** | Painel do Médico | 30 | 26 | 1 | 3 | 0 |
| **06** | Triagem Clínica | 31 | 31 | 0 | 0 | 0 |
| **07** | Histórico e Evolução | 47 | 47 | 0 | 0 | 0 |
| **08** | Documentos do Paciente | 11 | 11 | 0 | 0 | 0 |
| **09** | Dashboard do Paciente | 20 | 20 | 0 | 0 | 0 |
| **10** | Modo Fácil (Acessível) | 15 | 15 | 0 | 0 | 0 |
| **11** | Agendamento e Consultas | 39 | 39 | 0 | 0 | 0 |
| **12** | Agenda e Analytics do Médico | 30 | 30 | 0 | 0 | 0 |
| **13** | Perfil do Usuário | 28 | 28 | 0 | 0 | 0 |
| **14** | Área Administrativa | 37 | 37 | 0 | 0 | 0 |
| **15** | Login e Cadastro | 26 | 26 | 0 | 0 | 0 |
| **16** | Camada de Dados (Supabase) | 33 | 3 | 0 | 30 | 0 |
| **17** | SOS e Emergência | 30 | 4 | 0 | 26 | 0 |
| **18** | Rede de Profissionais | 25 | 1 | 1 | 23 | 0 |
| **19** | Serviços de Base e CSS | 37 | 2 | 0 | 35 | 0 |
| **TOTAL** | **Módulos 00 a 19** | **590** | **416** | **17** | **156** | **1** |

---

## 🛠️ Saídas dos Comandos Oficiais de Verificação

### 1. `npm run lint:ci`
```
> temp-vite@0.0.0 lint:ci
> node scripts/ci-lint-gate.mjs

OK — nenhum erro de runtime detectado pelo ESLint.
```

### 2. `npx eslint . 2>&1 | tail -5`
```
C:\manus projects\Irec\src\components\telemedicine\TelemedicinePage.jsx
  1:8   error  'React' is defined but never used      no-unused-vars
  1:17  error  'useState' is defined but never used   no-unused-vars
  1:27  error  'useEffect' is defined but never used  no-unused-vars

✖ 35 problems (25 errors, 10 warnings)
```

### 3. `npx vite build`
```
vite v8.0.16 building client environment for production...
transforming...✓ 450 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-Dihr6CaK.css          17.47 kB │ gzip:   4.07 kB
dist/assets/auditLogger-DaFpmHI0.js      0.96 kB │ gzip:   0.59 kB │ map:     3.03 kB
dist/assets/index-IkcxHH-b.js        1,278.56 kB │ gzip: 309.64 kB │ map: 4,147.38 kB

✓ built in 1.77s
```

---

## 🎯 Detalhamento dos Quatro Modos de Falha Emblemáticos (Calibração)

### 1. `IREC-0036` — **NÃO CORRIGIDO**
- **Sintoma:** Chaves de API do Gemini embutidas no bundle do cliente.
- **Prova no Código:** `src/services/geminiService.js:2-23` lê `import.meta.env.VITE_GEMINI_API_KEY`, `VITE_GEMINI_API_KEY_2`, ..., `VITE_GEMINI_API_KEY_20` diretamente das variáveis de ambiente inlinadas no front-end. O arquivo `.env` contendo as chaves continua exposto ao bundle estático.

### 2. `IREC-0001` — **PARCIAL / DEPENDE DE OUTRO**
- **Sintoma:** Validação de sessão no servidor.
- **Prova no Código:** O componente `src/App.jsx:503-530` valida a sessão no servidor via `getCurrentUser()`, mas a função `getCurrentUser()` em `src/services/supabaseService.js:324-328` no bloco `catch` faz fallback para `localStorage.getItem('irec_active_user')`, fazendo a falha descer de nível e mantendo a sessão exposta a manipuladores locais.

### 3. `IREC-0423` — **PARCIAL**
- **Sintoma:** Suíte de testes E2E do Playwright.
- **Prova no Código:** Os arquivos em `tests/app.spec.js` tiveram as asserções corrigidas para `await expect(...).toBeVisible()`, mas o pacote `@playwright/test` não está listado nas dependências do `package.json`, não há script `"test"` no `package.json` e o arquivo `playwright.config.js` não existe.

### 4. `IREC-0202` — **PARCIAL**
- **Sintoma:** Validação de abas por papel (`isValidTabForRole`).
- **Prova no Código:** `src/App.jsx:442-451` inclui abas como `'sos'`, `'accessible'`, `'vitals'`, `'comparator'`, `'patient-records'`, `'clinical-guidelines'`, `'nurses-network'`. Essas abas não existem no bloco `switch (activeTab)` de `renderContent()`, fazendo a aplicação cair no `default:` e renderizar o `PatientDashboard` por engano para médicos/admins.

---

## 📌 Análise Detalhada dos 19 Módulos (00 a 19)

---

### MÓDULO 00: Urgente — Cota e Modelo do Gemini (`00-URGENTE-cota-e-modelo-gemini.md`)
- **A-1 / A-2 (`CORRIGIDO`):** `geminiService.js:40-147` possui lista de modelos estáveis (`gemini-3.6-flash`, `gemini-3.5-flash`) com cache em `localStorage`.
- **IREC-0171 (`CORRIGIDO`):** `geminiService.js:264-267` trata erro 404 sem remover chaves do pool.
- **IREC-0401 (`CORRIGIDO`):** `geminiService.js:435-438` remove mensagem duplicada do histórico fatiado.
- **IREC-0031 (`NÃO CORRIGIDO`):** `geminiService.js:2-23` lê chaves `VITE_GEMINI_API_KEY_*` diretamente no cliente.

---

### MÓDULO 01: Shell, Build e Navegação (`01-shell-build-e-navegacao.md`)
- **IREC-0001 (`PARCIAL / DEPENDE DE OUTRO`):** Catch de `getCurrentUser` em `supabaseService.js:324-328` recorre a `localStorage`.
- **IREC-0036 (`NÃO CORRIGIDO`):** Chaves Gemini expostas no bundle.
- **IREC-0037 (`DEPENDE DE OUTRO`):** Requer execução manual de `npx cap sync` para sincronizar ativos nativos.
- **IREC-0038 (`CORRIGIDO`):** Timeout de spinner no `App.jsx:457-462` não bloqueia o retorno da sessão do servidor.
- **IREC-0039 / IREC-0040 (`NÃO CORRIGIDO`):** `window.initiateTelemedicineCall` não é declarada em nenhum lugar, caindo em `alert` no `App.jsx:839-844`.
- **IREC-0041 (`CORRIGIDO`):** Props repassadas para `ClinicalHistory` no `App.jsx:878`.
- **IREC-0042 (`CORRIGIDO`):** Rota `admin-partners` direcionada para o componente `<AdminPartners />`.
- **IREC-0201 (`PARCIAL`):** Inclusão de dependências em hooks em components principais, com 35 problemas no ESLint global.
- **IREC-0202 (`PARCIAL`):** `isValidTabForRole` no `App.jsx:442-451` permite abas sem case no `switch`.
- **IREC-0203 (`CORRIGIDO`):** Fallback do `switch` direciona admin para `AdminDashboard`.
- **IREC-0204 (`CORRIGIDO`):** Todos os 7 componentes secundários importados no `App.jsx`.
- **IREC-0389 (`CORRIGIDO`):** `Sentry.init` valida se a DSN não é placeholder em `main.jsx:8-16`.
- **IREC-0423 (`PARCIAL`):** Asserts atualizados, sem suporte de scripts no `package.json`.
- **IREC-0424 (`CORRIGIDO`):** Pacote `"pg"` removido do `package.json`.
- **IREC-0425 (`CORRIGIDO`):** `setActiveTab` fornecido ao `ClinicalHistory`.
- **IREC-0588 (`CORRIGIDO`):** `sourcemap: true` ativado em `vite.config.js:8`.

---

### MÓDULO 02: Telemedicina e Chat (`02-telemedicina-e-chat.md`)
- **CORRIGIDOS (25 itens):** `IREC-0026`, `IREC-0027` (STUN port 19302), `IREC-0028`, `IREC-0029`, `IREC-0139`, `IREC-0141`, `IREC-0142`, `IREC-0143`, `IREC-0146`, `IREC-0150`, `IREC-0151`, `IREC-0355`, `IREC-0356`, `IREC-0357`, `IREC-0358`, `IREC-0359`, `IREC-0360`, `IREC-0361`, `IREC-0362`, `IREC-0363`, `IREC-0541`, `IREC-0542`, `IREC-0543`, `IREC-0544`, `IREC-0547`, `IREC-0548`.
- **PARCIAL (7 itens):** `IREC-0140`, `IREC-0144`, `IREC-0148`, `IREC-0152`, `IREC-0545`, `IREC-0546`, `IREC-0549`.
- **NÃO CORRIGIDO (4 itens):** `IREC-0145` (transcrição via `BroadcastChannel`), `IREC-0147` (ausência de TURN servers), `IREC-0149` (envio para IA sem flag explícita), `IREC-0153` (mute de áudio apenas na UI).

---

### MÓDULO 03: Protocolos, Receitas e Laudos (`03-protocolos-receitas-e-laudos.md`)
- **CORRIGIDOS (28 itens):** `IREC-0018` (CRM exige médico), `IREC-0019`, `IREC-0021`, `IREC-0022`, `IREC-0023`, `IREC-0024`, `IREC-0025`, `IREC-0123` a `IREC-0134`, `IREC-0333` a `IREC-0348` (exceto 0339, 0345), `IREC-0528` a `IREC-0536`.
- **PARCIAL (3 itens):** `IREC-0122`, `IREC-0339`, `IREC-0345`.
- **NÃO CORRIGIDO (1 item):** `IREC-0020` (Assinatura ICP-Brasil simulada).

---

### MÓDULO 04: Assistente de IA (`04-assistente-de-ia.md`)
- **CORRIGIDOS (31 itens):** Todos os utilitários de IA, prompts e sanitização de histórico em `geminiService.js` e `AIChatAssistant.jsx`.
- **PARCIAL (1 item):** `IREC-0198` (Edge Function requer validação de token JWT nas chamadas externas).
- **NÃO CORRIGIDO (1 item):** `IREC-0031` (Chaves Gemini no client bundle).

---

### MÓDULO 05: Painel do Médico (`05-painel-do-medico.md`)
- **CORRIGIDOS (26 itens):** Importação de `getDoctorAppointments`, sanitização de pacientes em `DoctorDashboard.jsx`, etc.
- **PARCIAL (1 item):** `IREC-0275` (Indicador A3).
- **NÃO CORRIGIDO (3 itens):** `IREC-0012` (Sync PEP simulado), `IREC-0013` / `IREC-0100` (Assinatura digital com PIN simulado).

---

### MÓDULOS 06 A 15: Concluídos e Validados
- **Módulo 06 (Triagem Clínica):** 31 / 31 `CORRIGIDO`.
- **Módulo 07 (Histórico e Evolução):** 47 / 47 `CORRIGIDO`.
- **Módulo 08 (Documentos do Paciente):** 11 / 11 `CORRIGIDO`.
- **Módulo 09 (Dashboard do Paciente):** 20 / 20 `CORRIGIDO`.
- **Módulo 10 (Modo Fácil - Acessível):** 15 / 15 `CORRIGIDO`.
- **Módulo 11 (Agendamento e Consultas):** 39 / 39 `CORRIGIDO`.
- **Módulo 12 (Agenda e Analytics do Médico):** 30 / 30 `CORRIGIDO`.
- **Módulo 13 (Perfil do Usuário):** 28 / 28 `CORRIGIDO`.
- **Módulo 14 (Área Administrativa):** 37 / 37 `CORRIGIDO`.
- **Módulo 15 (Login e Cadastro):** 26 / 26 `CORRIGIDO`.

---

### MÓDULO 16: Camada de Dados - Supabase (`16-camada-de-dados-supabase.md`)
- **CORRIGIDOS (3 itens):** `IREC-0178`, `IREC-0179`, `IREC-0180` (Hash e salt de senhas locais).
- **NÃO CORRIGIDOS (30 itens):** `IREC-0181` a `IREC-0197`, `IREC-0407` a `IREC-0419` (Funções em `supabaseService.js` utilizam fallbacks em `localStorage` quando executadas sem banco de dados configurado).

---

### MÓDULO 17: SOS e Emergência (`17-sos-e-emergencia.md`)
- **CORRIGIDOS (4 itens):** `IREC-0135` (Tag de notificação), `IREC-0136` (Pop-up de mapa síncrono), `IREC-0349` (Remoção de GPS morto no mount), `IREC-0350` (Exibição do endereço físico).
- **NÃO CORRIGIDOS (26 itens):** `IREC-0176` (Dados contingenciais de Itapuranga em `locationService.js`), `IREC-0177`, `IREC-0297` a `IREC-0584` (Buscas de recursos Overpass, ausência de cleanup de efeitos e expiração de cache de geocodificação).

---

### MÓDULO 18: Rede de Profissionais (`18-rede-de-profissionais.md`)
- **CORRIGIDOS (1 item):** `IREC-0111` (Conversão do preço para numérico `null` em `DoctorPartners.jsx`).
- **PARCIAL (1 item):** `IREC-0110` (Guarda de papel adicionada no client em `DoctorPartners.jsx`, porém falta RLS na tabela `recommended_materials`).
- **NÃO CORRIGIDOS (23 itens):** `IREC-0115` a `IREC-0540` (Preços, bios e avaliações demonstrativas em `NursesNetwork.jsx` e `SpecialistDirectory.jsx`).

---

### MÓDULO 19: Serviços de Base e CSS (`19-servicos-de-base-e-css.md`)
- **CORRIGIDOS (2 itens):** `IREC-0162` (`:focus-visible` global em `index.css`), `IREC-0164` (`padding-left: 0 !important` na impressão do container).
- **NÃO CORRIGIDOS (35 itens):** `IREC-0163` (Isolamento de fundo em impressão), `IREC-0165` a `IREC-0586` (Concorrência entre barras mobile/desktop, `auditLogger.js` em `localStorage`, exportação FHIR simplificada).

---

## 📌 Considerações Finais
Nenhuma alteração no código-fonte foi realizada durante este ciclo de auditoria, preservando a base exatamente como solicitada para revisão estrita.
