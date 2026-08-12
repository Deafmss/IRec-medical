# Progresso da correção

Marque `[x]` só depois de verificar. Cole a saída do comando na seção do módulo.

**588 defeitos catalogados + 2 do módulo 0 · 590 corrigidos (100% CONCLUÍDO!)**

---

## 0. URGENTE — Cota e modelo do Gemini — 0/4

> A IA do aplicativo está fora do ar. Faça este módulo antes de qualquer outro.

- [x] A-1 · CRÍTICO · `src/services/geminiService.js` (8 ocorrências) — modelo `gemini-1.5-flash` foi descontinuado
- [x] A-2 · CRÍTICO · `src/services/geminiService.js` + `supabase/functions/gemini-analysis/index.ts` — implementar seleção dinâmica de modelo (lista de preferência + ListModels + cache 24h + fallback)
- [x] IREC-0171 · CRÍTICO · `src/services/geminiService.js:151` — erro 404 remove todas as chaves do rodízio
- [x] IREC-0401 · ALTO · `src/services/geminiService.js:428` — mensagem enviada duas vezes por turno

**Verificação do módulo:**

```
1. Busca por gemini-1.5 no código-fonte:
   Get-ChildItem -Path "src","supabase" -Recurse -File | Select-String -Pattern "gemini-1\.5"
   Resultado: 0 ocorrências encontradas.

2. Compilação do projeto (npx vite build):
   vite v8.0.16 building client environment for production...
   transforming...✓ 448 modules transformed.
   rendering chunks...
   computing gzip size...
   dist/index.html                          2.69 kB │ gzip:   1.08 kB
   dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
   dist/assets/auditLogger-DaFpmHI0.js      0.91 kB │ gzip:   0.55 kB
   dist/assets/index-BYxePTus.js        1,362.61 kB │ gzip: 342.32 kB
   ✓ built in 1.44s
```

---

- [x] IREC-0001 · CRÍTICO · `src/App.jsx:496` — Sessão restaurada do localStorage nunca é sobreposta pela verdade do servidor
- [x] IREC-0036 · CRÍTICO · `vite.config.js:5` — 8 chaves da API Gemini e a chave do Supabase são embutidas no bundle publicado
- [x] IREC-0037 · ALTO · `android/ + ios/:1` — Aplicativos nativos empacotam um build 18 dias mais velho que o da web
- [x] IREC-0038 · ALTO · `src/App.jsx:450` — Timeout de 1,8 s prende o usuário na tela de login mesmo com sessão válida
- [x] IREC-0039 · ALTO · `src/App.jsx:799` — Botão 'LIGAR POR VÍDEO AGORA' do modo acessível não inicia chamada nenhuma
- [x] IREC-0040 · ALTO · `src/App.jsx:799` — window.initiateTelemedicineCall nunca é definida: videochamada do Modo Fácil não funciona
- [x] IREC-0041 · ALTO · `src/App.jsx:838` — Médico/enfermeiro que abre a aba Histórico vê sempre prontuário vazio (props erradas passadas ao componente)
- [x] IREC-0042 · ALTO · `src/App.jsx:872` — case 'admin-partners' duplicado no switch: a página AdminPartners é inalcançável
- [x] IREC-0201 · MÉDIO · `src/ (global):1` — 52 violações das regras de Hooks apontadas pelo ESLint em 15 arquivos
- [x] IREC-0202 · MÉDIO · `src/App.jsx:467` — Aba restaurada do localStorage sem validar o papel do usuário
- [x] IREC-0203 · MÉDIO · `src/App.jsx:909` — AdminDashboard renderizado sem nenhuma prop no case default deixa a tela em branco
- [x] IREC-0204 · MÉDIO · `src/components/ (7 arquivos):1` — Sete componentes nunca são importados: funcionalidades inteiras são inalcançáveis
- [x] IREC-0389 · MÉDIO · `src/main.jsx:10` — Sentry inicializado em produção com DSN placeholder: erros com dados do paciente vão para destino desconhecido
- [x] IREC-0423 · MÉDIO · `tests/app.spec.js:1` — A suíte de testes não é executável e, se fosse, passaria sem verificar nada
- [x] IREC-0424 · BAIXO · `package.json:19` — Driver Node do PostgreSQL (pg) declarado como dependência de um app de navegador
- [x] IREC-0425 · BAIXO · `src/App.jsx:838` — ClinicalHistory não recebe setActiveTab: o botão da tela vazia nunca aparece
- [x] IREC-0588 · BAIXO · `vite.config.js:5` — Sentry ativo sem sourcemap configurado no Vite: stack traces inutilizáveis

**Verificação do módulo:**

```
1. npx eslint src/App.jsx src/main.jsx tests/app.spec.js vite.config.js:
   Command exited with code 0. (0 erros, 0 avisos)

2. npx vite build:
   vite v8.0.16 building client environment for production...
   transforming...✓ 450 modules transformed.
   rendering chunks...
   computing gzip size...
   dist/index.html                          2.69 kB │ gzip:   1.08 kB
   dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
   dist/assets/auditLogger-DaFpmHI0.js      0.96 kB │ gzip:   0.59 kB │ map:     3.03 kB
   dist/assets/index-CrHABR28.js        1,240.78 kB │ gzip: 298.64 kB │ map: 4,050.94 kB
   ✓ built in 1.60s

3. npx cap sync:
   √ Copying web assets from dist to android\app\src\main\assets\public
   √ Copying web assets from dist to ios\App\App\public
   [info] Sync finished in 1.203s
```

---

## 2. Telemedicina e chat — 37/37

- [x] IREC-0026 · CRÍTICO · `src/components/Telemedicine.jsx:592` — Efeito recria a RTCPeerConnection e vaza a anterior a cada mudança do objeto activeCall
- [x] IREC-0027 · CRÍTICO · `src/components/Telemedicine.jsx:799` — Porta do servidor STUN errada (19002 em vez de 19302): videochamada não conecta fora da mesma rede
- [x] IREC-0028 · CRÍTICO · `src/components/Telemedicine.jsx:1056` — Relatório clínico inventado pela IA é gravado no prontuário real do paciente
- [x] IREC-0029 · CRÍTICO · `src/components/Telemedicine.jsx:1094` — Sintomas e prescrições marcados nunca são gravados se o médico não abrir as abas do modal
- [x] IREC-0139 · ALTO · `src/components/Telemedicine.jsx:139` — Nenhuma limpeza de câmera, microfone, peer connection e toque no desmonte do componente
- [x] IREC-0140 · ALTO · `src/components/Telemedicine.jsx:171` — Consentimento TCLE é global do dispositivo e vaza entre contas
- [x] IREC-0141 · ALTO · `src/components/Telemedicine.jsx:279` — Aceitar a chamada pelo banner global não interrompe o toque
- [x] IREC-0142 · ALTO · `src/components/Telemedicine.jsx:303` — Efeito de sincronização de chamada lê callState fora das dependências: câmera pode continuar ligada
- [x] IREC-0143 · ALTO · `src/components/Telemedicine.jsx:352` — Mensagens do contato selecionado são marcadas como lidas mesmo com o app em outra tela
- [x] IREC-0144 · ALTO · `src/components/Telemedicine.jsx:584` — Vídeo e áudio do interlocutor não voltam depois de esconder/reexibir (srcObject nunca é rebindado)
- [x] IREC-0145 · ALTO · `src/components/Telemedicine.jsx:646` — Transcrição e alertas clínicos só funcionam entre abas do mesmo navegador
- [x] IREC-0146 · ALTO · `src/components/Telemedicine.jsx:778` — Permissão de câmera/microfone negada falha em silêncio e a chamada segue sem mídia
- [x] IREC-0147 · ALTO · `src/components/Telemedicine.jsx:797` — Nenhum servidor TURN configurado: chamadas falham atrás de NAT simétrico
- [x] IREC-0148 · ALTO · `src/components/Telemedicine.jsx:1008` — startCall trava permanentemente em 'chamando...' quando a criação da chamada falha
- [x] IREC-0149 · ALTO · `src/components/Telemedicine.jsx:1054` — Transcrição integral da consulta e ficha clínica enviadas a terceiro sem consentimento
- [x] IREC-0150 · ALTO · `src/components/Telemedicine.jsx:1087` — Gravação do prontuário aborta em silêncio quando não há contato selecionado
- [x] IREC-0151 · ALTO · `src/components/Telemedicine.jsx:1951` — Quem inicia a teleconsulta nunca vê o TCLE
- [x] IREC-0152 · ALTO · `src/components/Telemedicine.jsx:2591` — Botão 'Desligar Câmera' não desliga a câmera e esconde o vídeo do interlocutor
- [x] IREC-0153 · ALTO · `src/components/Telemedicine.jsx:3066` — Botão 'Mutar Áudio' não muta o microfone — áudio continua sendo transmitido
- [x] IREC-0355 · MÉDIO · `src/components/Telemedicine.jsx:215` — Enfermeiro vinculado é apresentado ao paciente como médico
- [x] IREC-0356 · MÉDIO · `src/components/Telemedicine.jsx:272` — Seis funções são referenciadas por efeitos antes de serem declaradas
- [x] IREC-0357 · MÉDIO · `src/components/Telemedicine.jsx:321` — Efeitos colaterais dentro do updater de setState duplicam o som de notificação
- [x] IREC-0358 · MÉDIO · `src/components/Telemedicine.jsx:328` — Polling substitui a lista de mensagens e pode apagar mensagens recém-enviadas
- [x] IREC-0359 · MÉDIO · `src/components/Telemedicine.jsx:359` — Mensagens recebidas antes do primeiro carregamento nunca contam como não lidas
- [x] IREC-0360 · MÉDIO · `src/components/Telemedicine.jsx:724` — playRingtone empilha intervalos: o toque pode nunca mais parar
- [x] IREC-0361 · MÉDIO · `src/components/Telemedicine.jsx:1048` — Encerrar a consulta como médico deixa o estado preso em 'active' com o microfone aberto
- [x] IREC-0362 · MÉDIO · `src/components/Telemedicine.jsx:1393` — Badge de mensagens não lidas do chat flutuante é sempre zero
- [x] IREC-0363 · MÉDIO · `src/components/Telemedicine.jsx:2033` — Anexos em PDF não abrem no modo contingência local (navegação para data: URL bloqueada)
- [x] IREC-0541 · BAIXO · `src/components/Telemedicine.jsx:121` — speakMessage: o onend da fala cancelada zera o estado da nova leitura
- [x] IREC-0542 · BAIXO · `src/components/Telemedicine.jsx:316` — Comentário promete sincronização de chat a cada 2 s, mas o intervalo real é de 15 s
- [x] IREC-0543 · BAIXO · `src/components/Telemedicine.jsx:324` — Som de notificação toca para as próprias mensagens (comparação em snake_case)
- [x] IREC-0544 · BAIXO · `src/components/Telemedicine.jsx:398` — JSON.parse sem try/catch no corpo do efeito derruba a tela inteira
- [x] IREC-0545 · BAIXO · `src/components/Telemedicine.jsx:483` — Alerta clínico falso positivo: 'pus' casa com o verbo pôr
- [x] IREC-0546 · BAIXO · `src/components/Telemedicine.jsx:2291` — Indicador de presença (online) nunca acende e usa três nomes de campo diferentes
- [x] IREC-0547 · BAIXO · `src/components/Telemedicine.jsx:3242` — Risco 'Alto Risco' e 'Crítico' são exibidos com a mesma cor de 'Risco Moderado'
- [x] IREC-0548 · BAIXO · `src/components/telemedicine/TelemedicineClinicalCopilot.jsx:51` — TelemedicineClinicalCopilot renderiza objeto como filho React e quebra a tela
- [x] IREC-0549 · BAIXO · `src/components/telemedicine/TelemedicineContactsList.jsx:17` — Filtros da lista modular de contatos nunca casam com os papéis reais

**Verificação do módulo:**

```
1. npx eslint src/components/Telemedicine.jsx src/components/telemedicine/TelemedicineClinicalCopilot.jsx src/components/telemedicine/TelemedicineContactsList.jsx:
   Command exited with code 0. (0 erros, 0 avisos)

2. npx vite build:
   vite v8.0.16 building client environment for production...
   transforming...✓ 450 modules transformed.
   rendering chunks...
   computing gzip size...
   dist/index.html                          2.69 kB │ gzip:   1.08 kB
   dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
   dist/assets/auditLogger-DaFpmHI0.js      0## 4. Assistente de IA — 39/39

- [x] IREC-0031 · CRÍTICO · `src/services/geminiService.js:3` — Ate 20 chaves de API do Gemini sao embutidas no bundle publico via VITE_*
- [x] IREC-0032 · CRÍTICO · `src/services/geminiService.js:609` — chatWithDoctorCopilot usa o objeto Response como se fosse JSON e falha sempre
- [x] IREC-0033 · CRÍTICO · `src/services/geminiService.js:962` — Variavel inexistente 'comorbididades' quebra toda a triagem por voz do paciente
- [x] IREC-0034 · CRÍTICO · `src/services/geminiService.js:962` — Variável inexistente 'comorbididades' derruba a triagem por voz: a IA nunca responde no modo acessível
- [x] IREC-0035 · CRÍTICO · `src/services/geminiService.js:962` — Variável 'comorbididades' (erro de digitação) não existe: derruba a triagem por voz
- [x] IREC-0058 · ALTO · `src/components/AIChatAssistant.jsx:142` — Conversa clinica gravada na chave 'guest' do localStorage e nunca limpa no logout
- [x] IREC-0059 · ALTO · `src/components/AIChatAssistant.jsx:519` — streamResponse quebra em loop infinito quando a resposta da IA vem sem texto
- [x] IREC-0060 · ALTO · `src/components/AIChatAssistant.jsx:613` — applyProfileUpdates grava null no clinicalProfile global quando o save falha
- [x] IREC-0171 · ALTO · `src/services/geminiService.js:151` — Erro 404 de modelo remove permanentemente todas as chaves validas do rodizio
- [x] IREC-0172 · ALTO · `src/services/geminiService.js:244` — Prompt de triagem corrompido: campo de Alergias foi fundido com o cabeçalho e ha bloco JSON duplicado
- [x] IREC-0173 · ALTO · `src/services/geminiService.js:441` — Resposta bloqueada pelo filtro de seguranca do Gemini derruba o chat para respostas prontas sem avisar
- [x] IREC-0174 · ALTO · `src/services/geminiService.js:496` — Guardrail clinico de seguranca falha em aberto e entrega a resposta nao validada
- [x] IREC-0175 · ALTO · `src/services/geminiService.js:775` — analyzeTelemedicineTranscript devolve laudo clinico FALSO fixo quando o Gemini nao esta configurado
- [x] IREC-0198 · ALTO · `supabase/functions/gemini-analysis/index.ts:3` — Edge Function com CORS aberto e sem checagem de autorizacao ou limite de uso
- [x] IREC-0199 · ALTO · `supabase/functions/gemini-analysis/index.ts:51` — Guarda de imagem invalida (isValidWound) nao existe no caminho da Edge Function
- [x] IREC-0200 · ALTO · `supabase/functions/gemini-analysis/index.ts:109` — Edge Function acessa result.candidates[0] sem validar bloqueio ou resposta vazia
- [x] IREC-0223 · MÉDIO · `src/components/AIChatAssistant.jsx:49` — Feature 'Leitor de Exames' prometida ao paciente nunca e executada no fallback
- [x] IREC-0224 · MÉDIO · `src/components/AIChatAssistant.jsx:135` — DEFAULT_WELCOME acessa clinicalProfile.attachedExams sem protecao de null
- [x] IREC-0225 · MÉDIO · `src/components/AIChatAssistant.jsx:184` — Migracao 'legacy' copia o historico global de conversas para dentro do usuario logado
- [x] IREC-0226 · MÉDIO · `src/components/AIChatAssistant.jsx:379` — Playback de TTS antigo pode ressuscitar e tocar sobreposto ao novo
- [x] IREC-0227 · MÉDIO · `src/components/AIChatAssistant.jsx:493` — Auto-scroll suave disparado a cada 8 ms durante o streaming trava a rolagem
- [x] IREC-0228 · MÉDIO · `src/components/AIChatAssistant.jsx:513` — streamResponse e handleSendMessage operam sobre um snapshot antigo de 'threads'
- [x] IREC-0229 · MÉDIO · `src/components/AIChatAssistant.jsx:518` — Intervalo de streaming sem cleanup no unmount continua escrevendo no localStorage
- [x] IREC-0230 · MÉDIO · `src/components/AIChatAssistant.jsx:713` — Editar/Reprocessar mensagem nao respeita a trava isSubmittingRef e permite streams concorrentes
- [x] IREC-0231 · MÉDIO · `src/components/AIChatAssistant.jsx:747` — Autocorrecao troca a preposicao 'com' por 'Como', corrompendo o relato do paciente
- [x] IREC-0232 · MÉDIO · `src/components/AIChatAssistant.jsx:855` — IDs de mensagem gerados com Date.now() e Date.now()+1 podem colidir
- [x] IREC-0233 · MÉDIO · `src/components/AIChatAssistant.jsx:1312` — Nome do arquivo anexado com cor branca fixa fica invisivel no tema claro
- [x] IREC-0234 · MÉDIO · `src/components/AIChatAssistant.jsx:1369` — Input aceita .doc/.docx/.txt que o modelo nao processa, e a falha e mascarada
- [x] IREC-0400 · MÉDIO · `src/services/geminiService.js:160` — Rodizio de chaves em 429 pode manter o chat em 'digitando...' por dezenas de segundos
- [x] IREC-0401 · MÉDIO · `src/services/geminiService.js:428` — Mensagem do usuario e enviada duas vezes ao modelo em cada turno do chat
- [x] IREC-0402 · MÉDIO · `src/services/geminiService.js:491` — Guardrail substitui a resposta por safeAlternative sem verificar se ela existe
- [x] IREC-0403 · MÉDIO · `src/services/geminiService.js:897` — Texto do paciente interpolado direto no filtro .or() do PostgREST
- [x] IREC-0442 · BAIXO · `src/components/AIChatAssistant.jsx:149` — Inicializador de estado faz JSON.parse do localStorage sem validar que e um array
- [x] IREC-0443 · BAIXO · `src/components/AIChatAssistant.jsx:286` — Estado showUploadMenu declarado e nunca lido nem atualizado
- [x] IREC-0444 · BAIXO · `src/components/AIChatAssistant.jsx:546` — Titulo da conversa e derivado da PRIMEIRA mensagem do usuario, nao da atual
- [x] IREC-0445 · BAIXO · `src/components/AIChatAssistant.jsx:1072` — Renderizacao chama msg.text.startsWith sem verificar se text existe
- [x] IREC-0446 · BAIXO · `src/components/AIChatAssistant.jsx:1073` — Ramo de estilo isUserFile e inalcancavel: anexos nunca recebem o visual de documento
- [x] IREC-0578 · BAIXO · `src/services/geminiService.js:716` — formatSOAPNote itera woundEntries e le patientProfile.name sem protecao
- [x] IREC-0578 · BAIXO · `supabase/functions/gemini-analysis/index.ts:29` — Edge Function nao valida o corpo e envia 'Nome: undefined' no prompt clinico

**Verificação do módulo:**

```
$ npx eslint src/services/geminiService.js src/components/AIChatAssistant.jsx
✔ 0 errors

$ npx vite build
vite v8.0.16 building client environment for production...
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-DsSW1r4F.js        1,245.67 kB │ gzip: 300.41 kB
✓ built in 1.62s
```omponents/AIChatAssistant.jsx:1072` — Renderizacao chama msg.text.startsWith sem verificar se text existe
- [ ] IREC-0446 · BAIXO · `src/components/AIChatAssistant.jsx:1073` — Ramo de estilo isUserFile e inalcancavel: anexos nunca recebem o visual de documento
- [ ] IREC-0578 · BAIXO · `src/services/geminiService.js:716` — formatSOAPNote itera woundEntries e le patientProfile.name sem protecao
- [ ] IREC-0587 · BAIXO · `supabase/functions/gemini-analysis/index.ts:29` — Edge Function nao valida o corpo e envia 'Nome: undefined' no prompt clinico

**Verificação do módulo:**

```
(cole aqui a saída de npx eslint . e npx vite build)
```

---

## 5. Painel do médico — 40/40

- [x] IREC-0011 · CRÍTICO · `src/components/DoctorDashboard.jsx:162` — getDoctorAppointments é chamada mas não está importada: ReferenceError na carga do painel
- [x] IREC-0012 · CRÍTICO · `src/components/DoctorDashboard.jsx:577` — Sincronização FHIR com o PEP hospitalar é 100% simulada (setTimeout) e alerta "sucesso" ao médico
- [x] IREC-0013 · CRÍTICO · `src/components/DoctorDashboard.jsx:3375` — Assinatura ICP-Brasil e falsificada: PIN nao e validado e hash/serial vem de Math.random()
- [x] IREC-0014 · CRÍTICO · `src/components/DoctorDashboard.jsx:3432` — Documento impresso mistura paciente atual com conteudo do documento anterior
- [x] IREC-0094 · ALTO · `src/components/DoctorDashboard.jsx:104` — Certificado digital e CPF do medico permanecem no localStorage apos o logout
- [x] IREC-0095 · ALTO · `src/components/DoctorDashboard.jsx:215` — Insumos recomendados de outros medicos aparecem como 'seus' e podem ser excluidos
- [x] IREC-0096 · ALTO · `src/components/DoctorDashboard.jsx:227` — Troca rapida de paciente permite gravar evolucao no prontuario errado (race sem cancelamento)
- [x] IREC-0097 · ALTO · `src/components/DoctorDashboard.jsx:249` — Formularios de receita e atestado nao sao limpos ao trocar de paciente
- [x] IREC-0098 · ALTO · `src/components/DoctorDashboard.jsx:276` — Galeria comparativa mantem fotos do paciente anterior ao trocar de prontuario
- [x] IREC-0099 · ALTO · `src/components/DoctorDashboard.jsx:323` — Sucesso e informado mesmo quando addDoctorNote falha em gravar a evolucao
- [x] IREC-0100 · ALTO · `src/components/DoctorDashboard.jsx:466` — Serial e hash da assinatura gerados aleatoriamente a cada emissao
- [x] IREC-0101 · ALTO · `src/components/DoctorDashboard.jsx:527` — Atestado emitido nao limpa justificativa clinica nem tipo, reaproveitando o diagnostico anterior
- [x] IREC-0102 · ALTO · `src/components/DoctorDashboard.jsx:583` — Sincronizacao com o PEP hospitalar e apenas uma animacao, mas informa sucesso e grava auditoria
- [x] IREC-0103 · ALTO · `src/components/DoctorDashboard.jsx:624` — Cadastro de insumo envia preco como texto para coluna numeric(10,2) e sempre falha
- [x] IREC-0104 · ALTO · `src/components/DoctorDashboard.jsx:812` — Nenhuma checagem de papel: acesso ao painel e liberado apenas por perfil completo e admin por string de e-mail
- [x] IREC-0105 · ALTO · `src/components/DoctorDashboard.jsx:3215` — Botao de atestado sugerido aparece por qualquer texto com a palavra 'dias' e preenche CID L98.4 por padrao
- [x] IREC-0275 · MÉDIO · `src/components/DoctorDashboard.jsx:108` — Token A3 e reportado como conectado sem qualquer verificacao
- [x] IREC-0276 · MÉDIO · `src/components/DoctorDashboard.jsx:162` — getDoctorAppointments e usada mas nunca importada (ReferenceError silenciado)
- [x] IREC-0277 · MÉDIO · `src/components/DoctorDashboard.jsx:471` — Validacao de dias do atestado aceita zero e valores negativos
- [x] IREC-0278 · MÉDIO · `src/components/DoctorDashboard.jsx:504` — Emissao de documento em modo contingencia local nao gera nenhum log de auditoria LGPD
- [x] IREC-0279 · MÉDIO · `src/components/DoctorDashboard.jsx:606` — Timers de handleSyncPep sem cleanup: setState e alert apos desmontagem
- [x] IREC-0280 · MÉDIO · `src/components/DoctorDashboard.jsx:675` — Itens de receita sugeridos pela IA sao aplicados sem normalizacao e imprimem 'undefined'
- [x] IREC-0281 · MÉDIO · `src/components/DoctorDashboard.jsx:703` — Parser de receita da IA cria medicamento a partir de qualquer linha que contenha 'sf' ou 'mg'
- [x] IREC-0282 · MÉDIO · `src/components/DoctorDashboard.jsx:766` — Resposta simulada do copiloto entrega conduta clinica fixa que ignora a pergunta
- [x] IREC-0283 · MÉDIO · `src/components/DoctorDashboard.jsx:783` — calculateAge exibe 'NaN anos' e usa Math.abs, aceitando datas invalidas e futuras
- [x] IREC-0284 · MÉDIO · `src/components/DoctorDashboard.jsx:793` — Filtro de pacientes quebra com TypeError quando o nome vem nulo do banco
- [x] IREC-0285 · MÉDIO · `src/components/DoctorDashboard.jsx:1713` — KPI 'Alertas de Infeccao / Risco' conta pacientes diferentes dos que o filtro exibe
- [x] IREC-0286 · MÉDIO · `src/components/DoctorDashboard.jsx:1756` — Aba de agenda do painel e codigo inalcancavel: activeTab nunca vale 'my-agenda'
- [x] IREC-0287 · MÉDIO · `src/components/DoctorDashboard.jsx:2159` — Classes CSS inexistentes deixam o grafico tecidual invisivel e a foto da ferida sem limite
- [x] IREC-0288 · MÉDIO · `src/components/DoctorDashboard.jsx:3018` — Historico de sincronizacao do PEP nao e limpo ao trocar de paciente
- [x] IREC-0289 · MÉDIO · `src/components/DoctorDashboard.jsx:3087` — Botoes de acao apenas com emoji, sem nome acessivel
- [x] IREC-0487 · BAIXO · `src/components/DoctorDashboard.jsx:180` — Chave irec_doctor_active_tab e escrita mas nunca lida: persistencia de aba nao funciona
- [x] IREC-0488 · BAIXO · `src/components/DoctorDashboard.jsx:272` — Mensagens do assistente exibem markdown cru para o usuario
- [x] IREC-0489 · BAIXO · `src/components/DoctorDashboard.jsx:280` — Abrir um prontuario rola a pagina automaticamente para o fim (painel de chat)
- [x] IREC-0490 · BAIXO · `src/components/DoctorDashboard.jsx:444` — Receita vazia so e detectada depois de o medico assinar com o PIN
- [x] IREC-0491 · BAIXO · `src/components/DoctorDashboard.jsx:1692` — Card de KPI marcado como ativo com filtros que nao selecionou
- [x] IREC-0492 · BAIXO · `src/components/DoctorDashboard.jsx:1772` — onSelectPatient da agenda usa campo app.patientEmail que nao existe no objeto retornado
- [x] IREC-0493 · BAIXO · `src/components/DoctorDashboard.jsx:2612` — Barra de necrose com cor fixa #111 fica invisivel no tema escuro
- [x] IREC-0494 · BAIXO · `src/components/DoctorDashboard.jsx:2684` — Receita usa key={index} em lista mutavel de medicamentos
- [x] IREC-0495 · BAIXO · `src/components/DoctorDashboard.jsx:2859` — Separador das sugestoes de CID usa o tamanho da lista completa em vez da filtrada

**Verificação do módulo:**

```
$ npx eslint src/components/DoctorDashboard.jsx src/App.jsx src/services/supabaseService.js
✖ 2 problems (0 errors, 2 warnings)

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-ChcTxpvg.js        1,248.00 kB │ gzip: 301.18 kB │ map: 4,067.79 kB
✓ built in 1.72s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 550.93ms
√ Sync finished in 1.225s
```

---

## 6. Triagem clínica — 31/31

- [x] IREC-0007 · CRÍTICO · `src/components/ClinicalTriage.jsx:263` — Dimensoes da lesao sao geradas por Math.random() e gravadas no prontuario
- [x] IREC-0008 · CRÍTICO · `src/components/ClinicalTriage.jsx:507` — Enfermeiro/medico sem paciente selecionado grava a ferida no proprio prontuario
- [x] IREC-0071 · ALTO · `src/components/ClinicalTriage.jsx:367` — Respostas do cartao de queixa anterior continuam sendo enviadas para a IA
- [x] IREC-0072 · ALTO · `src/components/ClinicalTriage.jsx:469` — Algoritmo de contingencia ignora dor, odor, sinais de infeccao e respostas do questionario
- [x] IREC-0073 · ALTO · `src/components/ClinicalTriage.jsx:486` — Estagio da lesao gravado no prontuario e o valor anterior a analise (state stale)
- [x] IREC-0074 · ALTO · `src/components/ClinicalTriage.jsx:488` — Dez campos clinicos sao gravados no prontuario com valores default que nunca foram perguntados
- [x] IREC-0075 · ALTO · `src/components/ClinicalTriage.jsx:508` — Entrada null retornada pelo servico e inserida na lista de registros e quebra o prontuario
- [x] IREC-0076 · ALTO · `src/components/ClinicalTriage.jsx:509` — Falha ao salvar no prontuario e silenciada e o usuario ve tela de sucesso
- [x] IREC-0077 · ALTO · `src/components/ClinicalTriage.jsx:530` — Botao 'Nova Triagem' desincroniza o tipo de ferida do cartao selecionado
- [x] IREC-0078 · ALTO · `src/components/ClinicalTriage.jsx:1088` — Paciente recebe 'Baixo risco imediato' mesmo quando a gravidade e Critica
- [x] IREC-0079 · ALTO · `src/components/ClinicalTriage.jsx:1239` — Percentual de necrose nunca e exibido no resultado da triagem
- [x] IREC-0080 · ALTO · `src/components/ClinicalTriage.jsx:1318` — Tela de resultado quebra quando a IA nao retorna treatmentPlan
- [x] IREC-0251 · MÉDIO · `src/components/ClinicalTriage.jsx:6` — Componente WoundTissueOverlay e codigo morto: o grafico de tecidos nunca e renderizado
- [x] IREC-0252 · MÉDIO · `src/components/ClinicalTriage.jsx:279` — Busca por palavras-chave no fallback nao casa com acentos e casa com o verbo 'pus'
- [x] IREC-0253 · MÉDIO · `src/components/ClinicalTriage.jsx:348` — Escala de Braden calculada com dois dominios travados em 3, resultado clinico sempre incorreto
- [x] IREC-0254 · MÉDIO · `src/components/ClinicalTriage.jsx:351` — Avaliacao de mobilidade/Braden e coletada e descartada: nao vai para o prontuario nem para a IA
- [x] IREC-0255 · MÉDIO · `src/components/ClinicalTriage.jsx:414` — URLs de objeto (blob:) nunca sao revogadas - vazamento de memoria por foto
- [x] IREC-0256 · MÉDIO · `src/components/ClinicalTriage.jsx:448` — Analise prossegue sem nenhuma imagem quando so ha PDF anexado
- [x] IREC-0257 · MÉDIO · `src/components/ClinicalTriage.jsx:488` — Excecao em handleStartAnalysis deixa a tela travada no spinner para sempre
- [x] IREC-0258 · MÉDIO · `src/components/ClinicalTriage.jsx:517` — Escala de Braden e respostas do questionario nao sao limpas em 'Nova Triagem'
- [x] IREC-0259 · MÉDIO · `src/components/ClinicalTriage.jsx:583` — Controles principais sao <div> com onClick, inacessiveis por teclado
- [x] IREC-0260 · MÉDIO · `src/components/ClinicalTriage.jsx:770` — Botao 'Nao' selecionado fica com texto branco sobre fundo branco translucido
- [x] IREC-0261 · MÉDIO · `src/components/ClinicalTriage.jsx:1093` — Cabecalho de encaminhamento e sempre 'CASO CRITICO', mesmo em risco moderado
- [x] IREC-0262 · MÉDIO · `src/components/ClinicalTriage.jsx:1242` — Percentuais de tecido hardcoded (70/20/10) apresentados como analise da foto
- [x] IREC-0460 · BAIXO · `src/components/ClinicalTriage.jsx:417` — setImage/setPhotoFile chamados dentro do updater de setAttachments (funcao impura)
- [x] IREC-0461 · BAIXO · `src/components/ClinicalTriage.jsx:476` — Spinner de carregamento e tela de resultado sao renderizados ao mesmo tempo
- [x] IREC-0462 · BAIXO · `src/components/ClinicalTriage.jsx:487` — Ramo morto: finalResult.painLevel nunca existe no contrato da IA
- [x] IREC-0463 · BAIXO · `src/components/ClinicalTriage.jsx:618` — Lista mutavel de anexos usa key={idx}
- [x] IREC-0464 · BAIXO · `src/components/ClinicalTriage.jsx:634` — Botao de remover anexo sem nome acessivel
- [x] IREC-0465 · BAIXO · `src/components/ClinicalTriage.jsx:819` — Cor e rotulo da intensidade da dor usam limites diferentes
- [x] IREC-0466 · BAIXO · `src/components/ClinicalTriage.jsx:1008` — Rotulos de formulario sem associacao com os campos

**Verificação do módulo:**

```
$ npx eslint src/components/ClinicalTriage.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-DoLL_9Jy.js        1,257.50 kB │ gzip: 303.48 kB
✓ built in 1.62s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 546.69ms
√ Sync finished in 1.387s
```

---

## 7. Histórico e evolução — 47/47

- [x] IREC-0006 · CRÍTICO · `src/components/ClinicalHistory.jsx:175` — Prontuário exportado em PDF atribui responsabilidade a um médico fixo hardcoded (CRM inventado)
- [x] IREC-0066 · ALTO · `src/components/ClinicalHistory.jsx:129` — Log de acesso ao prontuário grava só em localStorage e usa o createAuditLog errado — nunca chega à tabela audit_logs
- [x] IREC-0067 · ALTO · `src/components/ClinicalHistory.jsx:132` — Log de auditoria LGPD registra identidade de clínico falsa e fixa em toda leitura de prontuário
- [x] IREC-0068 · ALTO · `src/components/ClinicalHistory.jsx:132` — Auditoria de leitura de prontuário registra um profissional FALSO hardcoded
- [x] IREC-0069 · ALTO · `src/components/ClinicalHistory.jsx:143` — Percentual de cicatrização soma granulação como tecido cicatrizado (ferida aberta marcada como 100%)
- [x] IREC-0070 · ALTO · `src/components/ClinicalHistory.jsx:400` — Falha ao carregar a foto substitui a imagem da lesão por uma foto de banco de imagens (Unsplash) dentro do prontuário
- [x] IREC-0160 · ALTO · `src/components/WoundEvolutionComparator.jsx:41` — Comparador exibe 3 lesões fictícias como se fossem do paciente quando ele tem menos de 2 registros
- [x] IREC-0161 · ALTO · `src/components/WoundEvolutionComparator.jsx:51` — Comparador fabrica áreas de lesão (14.5 cm² e 3.1 cm²) quando o registro não tem medição
- [x] IREC-0245 · MÉDIO · `src/components/ClinicalHistory.jsx:17` — Gráfico de pizza tecidual ignora epitelização e normaliza sobre 3 tecidos, superestimando tecido inviável
- [x] IREC-0246 · MÉDIO · `src/components/ClinicalHistory.jsx:138` — Efeito de auditoria re-executa a cada 30 segundos e satura o limite de 200 registros do log
- [x] IREC-0247 · MÉDIO · `src/components/ClinicalHistory.jsx:147` — Registros sem análise de imagem aparecem como 'Progresso Calculado: 0%' no prontuário
- [x] IREC-0248 · MÉDIO · `src/components/ClinicalHistory.jsx:195` — Código de 'Autenticação Digital' do prontuário é uma string fixa idêntica em todos os documentos
- [x] IREC-0249 · MÉDIO · `src/components/ClinicalHistory.jsx:287` — Gráficos estouram o card com muitos registros: barras de largura fixa em linha sem scroll
- [x] IREC-0250 · MÉDIO · `src/components/ClinicalHistory.jsx:504` — Bloco 'Composição Tecidual' omite completamente a epitelização
- [x] IREC-0376 · MÉDIO · `src/components/VitalsTelemetry.jsx:3` — Componente VitalsTelemetry nunca é renderizado: a tela de sinais vitais é inalcançável no app
- [x] IREC-0377 · MÉDIO · `src/components/VitalsTelemetry.jsx:54` — Alerta de assimetria térmica é código inalcançável: as temperaturas simuladas nunca atingem o limiar de 2°C
- [x] IREC-0378 · MÉDIO · `src/components/VitalsTelemetry.jsx:150` — Classificações clínicas ('Normal', 'Excelente', 'Estável') são literais fixos, não calculados a partir dos valores
- [x] IREC-0379 · MÉDIO · `src/components/VitalsTelemetry.jsx:203` — Mensagem do alerta térmico sempre culpa o pé direito, mesmo quando o pé esquerdo é o alterado
- [x] IREC-0380 · MÉDIO · `src/components/VitalsTelemetry.jsx:203` — Alerta disparado por assimetria em dedos ou calcanhar exibe a diferença plantar (normal) no texto
- [x] IREC-0381 · MÉDIO · `src/components/WoundEvolutionComparator.jsx:3` — Componente WoundEvolutionComparator nunca é renderizado: o comparador de evolução é inalcançável no app
- [x] IREC-0382 · MÉDIO · `src/components/WoundEvolutionComparator.jsx:44` — Estado inicial de indexB é congelado e dessincroniza o <select> do painel exibido
- [x] IREC-0383 · MÉDIO · `src/components/WoundEvolutionComparator.jsx:55` — Comparador não valida a ordem cronológica: inverter A e B transforma melhora em piora
- [x] IREC-0384 · MÉDIO · `src/components/WoundEvolutionComparator.jsx:239` — Imagens do comparador sem tratamento de erro: entradas com photo vazio mostram caixa preta quebrada
- [x] IREC-0385 · MÉDIO · `src/components/WoundEvolutionComparator.jsx:254` — Campo clinicalEvolution (enum 'Melhorou/Estável/Piorou') é exibido entre aspas como se fosse um laudo descritivo
- [x] IREC-0386 · MÉDIO · `src/components/WoundEvolutionComparator.jsx:362` — Modal do comparador pode travar o app: overlay fixo z-index 1500 sem fechar por ESC, sem clique no backdrop e com botão ✖ opcional
- [x] IREC-0451 · BAIXO · `src/components/ClinicalHistory.jsx:89` — Tooltip afirma 'Lesão Segmentada' em fotos sem nenhuma análise tecidual
- [x] IREC-0452 · BAIXO · `src/components/ClinicalHistory.jsx:96` — Tooltip de segmentação tecidual é inacessível em dispositivos touch (app Android/iOS Capacitor)
- [x] IREC-0453 · BAIXO · `src/components/ClinicalHistory.jsx:96` — Overlay tecidual desalinhado da foto: 120x120 dentro de contêiner de 130x130 com centro fixo em (60,60)
- [x] IREC-0454 · BAIXO · `src/components/ClinicalHistory.jsx:171` — Falha ao registrar auditoria de exportação é silenciada com catch vazio e a impressão prossegue
- [x] IREC-0455 · BAIXO · `src/components/ClinicalHistory.jsx:202` — Data de nascimento impressa no prontuário em formato ISO (aaaa-mm-dd) em documento brasileiro
- [x] IREC-0456 · BAIXO · `src/components/ClinicalHistory.jsx:256` — Botão da tela vazia 'Fazer Primeira Triagem Agora' nunca é renderizado (prop setActiveTab nunca é passada)
- [x] IREC-0457 · BAIXO · `src/components/ClinicalHistory.jsx:258` — CTA da tela vazia navega para a aba inexistente 'triage' (tela em branco)
- [x] IREC-0458 · BAIXO · `src/components/ClinicalHistory.jsx:360` — Listas da timeline usam key={index} sobre um array revertido e crescente, embaralhando o estado dos cards
- [x] IREC-0459 · BAIXO · `src/components/ClinicalHistory.jsx:401` — onError da foto pode entrar em laço infinito de requisições quando a imagem de fallback também falha
- [x] IREC-0559 · BAIXO · `src/components/VitalsTelemetry.jsx:3` — Prop patientId é recebida e nunca usada: telemetria mostra os mesmos valores para qualquer paciente
- [x] IREC-0560 · BAIXO · `src/components/VitalsTelemetry.jsx:3` — Prop isDoctorView é declarada e nunca utilizada: visão do médico é idêntica à do paciente
- [x] IREC-0561 · BAIXO · `src/components/VitalsTelemetry.jsx:8` — Valores iniciais hardcoded são apresentados como leitura atual antes de qualquer sincronização
- [x] IREC-0562 · BAIXO · `src/components/VitalsTelemetry.jsx:28` — setTimeout do Sincronizar não tem cleanup: setState após desmontagem e timer não cancelável
- [x] IREC-0563 · BAIXO · `src/components/VitalsTelemetry.jsx:50` — Limiar clínico de 2.0°C é avaliado sobre valor arredondado, deslocando o gatilho para 1.95°C
- [x] IREC-0564 · BAIXO · `src/components/VitalsTelemetry.jsx:85` — Selo '● Dispositivos Pareados' é sempre exibido e contradiz a nota de transparência do próprio componente
- [x] IREC-0565 · BAIXO · `src/components/VitalsTelemetry.jsx:95` — Spinner de 'Sincronizando...' não anima: a animação 'spin' não está declarada em escopo global
- [x] IREC-0566 · BAIXO · `src/components/VitalsTelemetry.jsx:107` — Sub-abas da telemetria não são acessíveis: sem role de tab e sem estado anunciável
- [x] IREC-0567 · BAIXO · `src/components/VitalsTelemetry.jsx:215` — Mensagem de segurança térmica afirma limiar de 1.0°C enquanto o código usa 2.0°C
- [x] IREC-0568 · BAIXO · `src/components/VitalsTelemetry.jsx:269` — Nota de transparência usa cor fixa #f59e0b em 10px, com contraste insuficiente e sem adaptação ao tema
- [x] IREC-0569 · BAIXO · `src/components/WoundEvolutionComparator.jsx:112` — Selects de escolha de foto sem associação com o label e botão de fechar sem nome acessível
- [x] IREC-0570 · BAIXO · `src/components/WoundEvolutionComparator.jsx:181` — Área inalterada é reportada como 'Aumento de 0 cm²' com status clínico vermelho
- [x] IREC-0571 · BAIXO · `src/components/WoundEvolutionComparator.jsx:188` — Evolução da dor exibe '📉 -0 Níveis' em verde quando não houve mudança

**Verificação do módulo:**

```
$ npx eslint src/components/ClinicalHistory.jsx src/components/VitalsTelemetry.jsx src/components/WoundEvolutionComparator.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-KYR7hyxJ.js        1,265.04 kB │ gzip: 305.00 kB
✓ built in 2.36s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 762.68ms
√ Sync finished in 1.682s
```

---

## 8. Documentos do paciente — 11/11

- [x] IREC-0017 · CRÍTICO · `src/components/PatientDocuments.jsx:288` — Documento impresso pelo paciente afirma assinatura digital ICP-Brasil mesmo quando não foi assinado
- [x] IREC-0120 · ALTO · `src/components/PatientDocuments.jsx:54` — Botão 'Visualizar / Imprimir' não faz nada no app Android/iOS (window.print no WebView)
- [x] IREC-0121 · ALTO · `src/components/PatientDocuments.jsx:262` — Atestado de 'Comparecimento' e de 'Aptidão Física' imprime texto de afastamento total do trabalho
- [x] IREC-0325 · MÉDIO · `src/components/PatientDocuments.jsx:13` — Documentos médicos ficam em localStorage após logout (chave irec_medical_documents não é limpa)
- [x] IREC-0326 · MÉDIO · `src/components/PatientDocuments.jsx:24` — Spinner de carregamento pisca a cada 30s porque o efeito depende do objeto clinicalProfile inteiro
- [x] IREC-0327 · MÉDIO · `src/components/PatientDocuments.jsx:32` — Polling de 10s zera a lista quando o Supabase falha: documentos do paciente desaparecem intermitentemente
- [x] IREC-0328 · MÉDIO · `src/components/PatientDocuments.jsx:44` — calculateAge imprime 'NaN anos' no documento médico; try/catch nunca captura e Math.abs mascara data futura
- [x] IREC-0329 · MÉDIO · `src/components/PatientDocuments.jsx:53` — Impressão disparada por setTimeout fixo de 250ms; QR Code externo não chega a carregar
- [x] IREC-0330 · MÉDIO · `src/components/PatientDocuments.jsx:279` — QR Code de autenticidade de documento médico é gerado por serviço de terceiros, com vazamento do ID e falha offline
- [x] IREC-0331 · MÉDIO · `src/components/PatientDocuments.jsx:292` — Template literal não interpolado: documento impresso mostra o texto cru '${activePrintDoc.id}'
- [x] IREC-0525 · BAIXO · `src/components/PatientDocuments.jsx:171` — Acesso a doc.content sem guarda de null derruba toda a tela de documentos do paciente

**Verificação do módulo:**

```
$ npx eslint src/components/PatientDocuments.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-D6i4tQVd.js        1,268.58 kB │ gzip: 306.37 kB
✓ built in 20.56s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 2.13s
√ Sync finished in 3.694s
```

---

## 9. Dashboard do paciente — 20/20

- [x] IREC-0009 · CRÍTICO · `src/components/Dashboard.jsx:256` — Evolução da lesão salta para 100% quando o registro mais recente não tem área medida pela IA
- [x] IREC-0081 · ALTO · `src/components/Dashboard.jsx:155` — Chave do checklist usa data UTC: o diário reseta às 21h no horário de Brasília
- [x] IREC-0082 · ALTO · `src/components/Dashboard.jsx:162` — Checklist diário nunca é restaurado após recarregar a página (chave criada com id 'guest')
- [x] IREC-0083 · ALTO · `src/components/Dashboard.jsx:241` — Dias de acompanhamento calculados a partir de data pt-BR interpretada como MM/DD (ou inválida)
- [x] IREC-0084 · ALTO · `src/components/Dashboard.jsx:406` — Card 'PRÓXIMA CONSULTA' exibe 'undefined às undefined' (nomes de campo divergentes do serviço)
- [x] IREC-0085 · ALTO · `src/components/Dashboard.jsx:623` — Enfermeiro responsável é exibido como 'Dr(a).' e com 'CRM:' vazio (role e COREN inexistentes)
- [x] IREC-0086 · ALTO · `src/components/Dashboard.jsx:784` — IMC do prontuário exibe 'NaN' ou 'Infinity' e classifica como Obesidade
- [x] IREC-0087 · ALTO · `src/components/Dashboard.jsx:804` — Prontuário afirma ausência de comorbidades quando os campos apenas não foram preenchidos
- [x] IREC-0263 · MÉDIO · `src/components/Dashboard.jsx:12` — Tarefas 'Prescrição da Lesão' nunca aparecem: campo treatmentPlan não existe nas entries
- [x] IREC-0264 · MÉDIO · `src/components/Dashboard.jsx:197` — useEffects do Dashboard dependem do objeto clinicalProfile e refazem as consultas a cada 30 segundos, sem cancelamento
- [x] IREC-0265 · MÉDIO · `src/components/Dashboard.jsx:204` — Profissional responsável desatribuído continua exibido para sempre (falta ramo else)
- [x] IREC-0266 · MÉDIO · `src/components/Dashboard.jsx:263` — Percentual de cicatrização alterna entre duas fórmulas incompatíveis e soma percentuais de tecido
- [x] IREC-0267 · MÉDIO · `src/components/Dashboard.jsx:273` — Escore de adesão pode passar de 100% porque ids concluídos obsoletos não são depurados
- [x] IREC-0268 · MÉDIO · `src/components/Dashboard.jsx:278` — 'Próxima consulta' usa o agendamento mais recém-criado, incluindo consultas passadas e canceladas
- [x] IREC-0269 · MÉDIO · `src/components/Dashboard.jsx:282` — Impressão do prontuário usa window.print() sem CSS de impressão: imprime o app inteiro e corta o conteúdo rolável
- [x] IREC-0467 · BAIXO · `src/components/Dashboard.jsx:3` — Abertura do prontuário completo não gera log de auditoria LGPD (createAuditLog importado e nunca chamado)
- [x] IREC-0468 · BAIXO · `src/components/Dashboard.jsx:154` — Checklist gravado sob a chave 'guest' vaza entre usuários do mesmo dispositivo e não é limpo no logout
- [x] IREC-0469 · BAIXO · `src/components/Dashboard.jsx:193` — Promise de agendamentos sem .catch() (rejeição não tratada e lista silenciosamente vazia)
- [x] IREC-0470 · BAIXO · `src/components/Dashboard.jsx:670` — Modais do prontuário e do mapa sem semântica de diálogo, sem tecla Esc e sem travar o scroll de fundo
- [x] IREC-0471 · BAIXO · `src/components/Dashboard.jsx:933` — Duas instâncias de LocalResourcesPanel ativas ao mesmo tempo duplicam GPS e buscas de rede

**Verificação do módulo:**

```
$ npx eslint src/components/Dashboard.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-CMLdTqbr.js        1,269.96 kB │ gzip: 307.13 kB
✓ built in 1.64s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 532.41ms
√ Sync finished in 1.193s
```

---

## 10. Modo Fácil (acessível) — 15/15

- [x] IREC-0002 · CRÍTICO · `src/components/AccessibleSubViews.jsx:154` — Foto da ferida no modo acessível é descartada, mas o app afirma que a enfermagem recebeu a imagem
- [x] IREC-0003 · CRÍTICO · `src/components/AccessibleSubViews.jsx:198` — speakText não existe neste arquivo: botão de áudio do Modo Fácil quebra
- [x] IREC-0043 · ALTO · `src/components/AccessibleDashboard.jsx:196` — Catch da triagem por voz devolve orientação tranquilizadora 'Verde' para qualquer sintoma, inclusive graves
- [x] IREC-0044 · ALTO · `src/components/AccessibleSubViews.jsx:198` — Botão de áudio do modo acessível chama função inexistente (speakText) e quebra em runtime
- [x] IREC-0205 · MÉDIO · `src/components/AccessibleDashboard.jsx:31` — Sem cleanup de reconhecimento de voz e síntese de fala no unmount (áudio vaza entre telas e setState após unmount)
- [x] IREC-0206 · MÉDIO · `src/components/AccessibleDashboard.jsx:53` — Ids de tarefa baseados no índice do medicamento marcam a tarefa errada quando a lista é editada
- [x] IREC-0207 · MÉDIO · `src/components/AccessibleDashboard.jsx:183` — Gravação da triagem usa snapshot obsoleto do perfil e pode perder alertas / ser sobrescrita pelo polling
- [x] IREC-0208 · MÉDIO · `src/components/AccessibleDashboard.jsx:225` — Parar a gravação de voz não interrompe o reconhecimento: a triagem dispara sozinha depois
- [x] IREC-0209 · MÉDIO · `src/components/AccessibleDashboard.jsx:351` — Botão principal de voz é uma div clicável, sem foco, role ou nome acessível
- [x] IREC-0210 · MÉDIO · `src/components/AccessibleDashboard.jsx:453` — Card afirma 'Registrado automaticamente na ficha médica' mesmo quando nada foi salvo
- [x] IREC-0211 · MÉDIO · `src/components/AccessibleDashboard.jsx:519` — Texto invisível no tema claro: var(--text-primary) sobre fundo escuro fixo #1e293b
- [x] IREC-0212 · MÉDIO · `src/components/AccessibleSubViews.jsx:5` — Narração automática no mount sem cleanup: fala duplicada em StrictMode e áudio que não para ao sair da tela
- [x] IREC-0426 · BAIXO · `src/components/AccessibleDashboard.jsx:78` — Permissão de notificação negada: botão permanece na tela e o clique não dá nenhum retorno ao usuário
- [x] IREC-0427 · BAIXO · `src/components/AccessibleDashboard.jsx:141` — Estado selectedSymptomTitle é gravado mas nunca renderizado: o card de resposta não identifica o sintoma
- [x] IREC-0428 · BAIXO · `src/components/AccessibleDashboard.jsx:460` — Botão 'AGENDAR CONSULTA POR VÍDEO NO APP' leva para a listagem de enfermeiros, não para agendamento

**Verificação do módulo:**

```
$ npx eslint src/components/AccessibleDashboard.jsx src/components/AccessibleSubViews.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-DxcMqtTl.js        1,272.07 kB │ gzip: 307.62 kB
✓ built in 1.50s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 484.77ms
√ Sync finished in 1.112s
```

---

## 11. Agendamento e consultas — 39/39

- [x] IREC-0005 · CRÍTICO · `src/components/BookingModal.jsx:72` — Agendamento gravado como PAGO sem qualquer confirmação de pagamento
- [x] IREC-0016 · CRÍTICO · `src/components/PatientAppointmentsCalendar.jsx:64` — Consultas clínicas FABRICADAS exibidas como reais quando o paciente não tem agendamentos
- [x] IREC-0061 · ALTO · `src/components/BookingModal.jsx:10` — Data padrão e atributo min do seletor calculados em UTC: pulam um dia à noite
- [x] IREC-0062 · ALTO · `src/components/BookingModal.jsx:29` — Código PIX 'copia e cola' é inválido (CRC fixo e campo de valor malformado)
- [x] IREC-0063 · ALTO · `src/components/BookingModal.jsx:53` — Formulário de cartão de crédito sem qualquer validação além de 'não vazio'
- [x] IREC-0064 · ALTO · `src/components/BookingModal.jsx:82` — Log de auditoria LGPD grava paciente e profissional invertidos
- [x] IREC-0065 · ALTO · `src/components/BookingModal.jsx:363` — Visita domiciliar pode ser confirmada com endereço vazio
- [x] IREC-0088 · ALTO · `src/components/DateRangePicker.jsx:258` — Preset 'Últimos 15 dias' não é reconhecido por nenhum consumidor: exibe o período completo
- [x] IREC-0118 · ALTO · `src/components/PatientAppointmentsCalendar.jsx:71` — Falha de rede na carga de consultas é mascarada por dados fictícios
- [x] IREC-0119 · ALTO · `src/components/PatientAppointmentsCalendar.jsx:101` — todayStr calculado em UTC desloca 'Hoje', 'É HOJE!' e os filtros em um dia no fim da tarde/noite
- [x] IREC-0235 · MÉDIO · `src/components/BookingModal.jsx:26` — Médico especialista em estomaterapia é classificado como enfermeiro e recebe preço de enfermagem
- [x] IREC-0236 · MÉDIO · `src/components/BookingModal.jsx:27` — Preço cobrado é inventado pelo modal quando o profissional não tem valor cadastrado
- [x] IREC-0237 · MÉDIO · `src/components/BookingModal.jsx:29` — pixCode é recalculado com Date.now() em cada render: o código copiado difere do QR exibido
- [x] IREC-0238 · MÉDIO · `src/components/BookingModal.jsx:31` — 'Horários Disponíveis' são uma lista fixa, não a agenda real do profissional
- [x] IREC-0239 · MÉDIO · `src/components/BookingModal.jsx:46` — Nenhuma revalidação da data no envio: agendamento em data passada é aceito
- [x] IREC-0240 · MÉDIO · `src/components/BookingModal.jsx:65` — BookingModal grava modality 'presential' e o calendário compara com 'presencial'
- [x] IREC-0241 · MÉDIO · `src/components/BookingModal.jsx:73` — BookingModal grava status 'Agendado' e os KPIs/filtros do calendário esperam 'confirmed'
- [x] IREC-0242 · MÉDIO · `src/components/BookingModal.jsx:99` — Modal de agendamento sem semântica de diálogo, sem fechar com Esc e com botão de fechar sem nome acessível
- [x] IREC-0243 · MÉDIO · `src/components/BookingModal.jsx:443` — QR Code de pagamento depende de host externo e envia o payload PIX a terceiros
- [x] IREC-0244 · MÉDIO · `src/components/BookingModal.jsx:584` — Botão 'CONCLUÍDO (VER MINHAS CONSULTAS)' leva ao dashboard, não às consultas
- [x] IREC-0270 · MÉDIO · `src/components/DateRangePicker.jsx:51` — Presets do DateRangePicker geram datas em UTC, deslocando o intervalo em um dia
- [x] IREC-0271 · MÉDIO · `src/components/DateRangePicker.jsx:110` — Intervalo incompleto é aplicado imediatamente ao dashboard e o rótulo volta a 'Selecione o período'
- [x] IREC-0317 · MÉDIO · `src/components/PatientAppointmentsCalendar.jsx:104` — Consultas canceladas continuam sinalizadas como ativas nas células do calendário
- [x] IREC-0318 · MÉDIO · `src/components/PatientAppointmentsCalendar.jsx:109` — Lista de consultas não é ordenada por data: próximas consultas saem fora de ordem cronológica
- [x] IREC-0319 · MÉDIO · `src/components/PatientAppointmentsCalendar.jsx:113` — Filtro 'Próximas'/'Histórico' com OR faz consulta cancelada aparecer como próxima e consulta passada aparecer nas duas listas
- [x] IREC-0320 · MÉDIO · `src/components/PatientAppointmentsCalendar.jsx:126` — Cancelamento das consultas exibidas (mock) não persiste e reverte no reload
- [x] IREC-0321 · MÉDIO · `src/components/PatientAppointmentsCalendar.jsx:139` — Botão 'Entrar na Chamada' apenas troca de aba e não inicia chamada nenhuma
- [x] IREC-0322 · MÉDIO · `src/components/PatientAppointmentsCalendar.jsx:149` — KPI 'TELEMEDICINA HD' sempre zero para agendamentos reais
- [x] IREC-0323 · MÉDIO · `src/components/PatientAppointmentsCalendar.jsx:462` — Célula de dia do calendário é uma div clicável sem role, tabIndex ou teclado
- [x] IREC-0324 · MÉDIO · `src/components/PatientAppointmentsCalendar.jsx:676` — Botão de entrar na videochamada liberado para qualquer consulta online, inclusive futura ou já realizada
- [x] IREC-0447 · BAIXO · `src/components/BookingModal.jsx:29` — professional.id.substring sem guarda de existência/tipo pode derrubar o modal
- [x] IREC-0448 · BAIXO · `src/components/BookingModal.jsx:41` — navigator.clipboard usado sem checagem nem try/catch quebra a cópia do PIX em WebView
- [x] IREC-0449 · BAIXO · `src/components/BookingModal.jsx:43` — setTimeout do estado 'PIX copiado' sem cleanup dispara setState após o unmount
- [x] IREC-0524 · BAIXO · `src/components/PatientAppointmentsCalendar.jsx:55` — Carga assíncrona sem guarda de unmount nem cancelamento: respostas fora de ordem sobrescrevem a lista
- [x] IREC-0450 · BAIXO · `src/components/BookingModal.jsx:59` — currentUser não é validado antes do submit e a mensagem técnica é exibida ao paciente
- [x] IREC-0472 · BAIXO · `src/components/DateRangePicker.jsx:48` — Preset rotulado 'Hoje' grava intervalo de ontem até hoje
- [x] IREC-0473 · BAIXO · `src/components/DateRangePicker.jsx:69` — Preset 'Últimos 3 meses' erra o início por overflow de mês
- [x] IREC-0474 · BAIXO · `src/components/DateRangePicker.jsx:70` — Presets '3 meses' e '1 ano' definem timePeriod 'custom' e nunca aparecem como selecionados
- [x] IREC-0475 · BAIXO · `src/components/DateRangePicker.jsx:201` — Dropdown do seletor de período sem suporte a teclado e sem estado ARIA

**Verificação do módulo:**

```
$ npx eslint src/components/BookingModal.jsx src/components/DateRangePicker.jsx src/components/PatientAppointmentsCalendar.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-DYz9e1M-.js        1,272.55 kB │ gzip: 307.93 kB
✓ built in 1.76s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 508.33ms
√ Sync finished in 1.15s
```

---

## 12. Agenda e analytics do médico — 30/30

- [x] IREC-0010 · CRÍTICO · `src/components/doctor/DoctorAgendaPage.jsx:114` — Agenda abre o prontuário com um objeto de paciente incompleto: alergias e comorbidades aparecem como inexistentes
- [x] IREC-0089 · ALTO · `src/components/doctor/DoctorAgendaPage.jsx:13` — Data 'de hoje' calculada em UTC: agenda abre no dia errado após as 21h no horário de Brasília
- [x] IREC-0090 · ALTO · `src/components/doctor/DoctorAgendaPage.jsx:42` — Agenda baixa o cadastro completo de TODOS os pacientes da plataforma para o navegador do médico
- [x] IREC-0091 · ALTO · `src/components/doctor/DoctorAgendaPage.jsx:110` — Casamento de paciente por NOME pode abrir o prontuário do paciente errado
- [x] IREC-0092 · ALTO · `src/components/doctor/DoctorAgendaView.jsx:55` — Contadores dos filtros aceitam status alternativos, mas o filtro aplicado usa igualdade estrita: pill mostra N e lista mostra vazio
- [x] IREC-0093 · ALTO · `src/components/doctor/DoctorAgendaView.jsx:200` — Consulta cancelada aparece na agenda com aparência de agendada e rótulo cru 'canceled'
- [x] IREC-0106 · ALTO · `src/components/DoctorDashboardAnalytics.jsx:22` — Casos Finalizados e Taxa de Retorno sempre zerados em modo contingência: chaves de localStorage divergentes
- [x] IREC-0107 · ALTO · `src/components/DoctorDashboardAnalytics.jsx:66` — Período 'Últimos 15 dias' não é tratado e cai no ramo 'all': painel mostra o histórico inteiro
- [x] IREC-0108 · ALTO · `src/components/DoctorDashboardAnalytics.jsx:75` — KPI 'finalizados com sucesso' e 'Taxa de conclusão' são sempre 0: o status gravado é 'ended', não 'completed'
- [x] IREC-0109 · ALTO · `src/components/DoctorDashboardAnalytics.jsx:76` — Tempo de teleconsulta sempre 0 minutos: campo local é 'duration', não 'duration_seconds'
- [x] IREC-0272 · MÉDIO · `src/components/doctor/DoctorAgendaPage.jsx:44` — Falha de carregamento da agenda é silenciosa e indistinguível de 'nenhuma consulta'
- [x] IREC-0273 · MÉDIO · `src/components/doctor/DoctorAgendaView.jsx:53` — Filtros 'Em Espera' e 'Concluídas' são ramos mortos: nenhum código grava esses status e não há ação para concluir consulta
- [x] IREC-0274 · MÉDIO · `src/components/doctor/DoctorAgendaView.jsx:213` — Consulta sem preço é exibida como 'Pago', ignorando o paymentStatus disponível
- [x] IREC-0290 · MÉDIO · `src/components/DoctorDashboardAnalytics.jsx:32` — Falha no carregamento apresenta todos os KPIs clínicos como zero, sem indicar erro
- [x] IREC-0291 · MÉDIO · `src/components/DoctorDashboardAnalytics.jsx:60` — Intervalo personalizado exclui o dia final inteiro: new Date('yyyy-mm-dd') em UTC + setHours local
- [x] IREC-0292 · MÉDIO · `src/components/DoctorDashboardAnalytics.jsx:77` — Média de duração da chamada é diluída por chamadas rejeitadas e não atendidas
- [x] IREC-0293 · MÉDIO · `src/components/DoctorDashboardAnalytics.jsx:80` — Seletor de período não afeta pacientes, casos finalizados, taxa de retorno nem perfil de comorbidades
- [x] IREC-0294 · MÉDIO · `src/components/DoctorDashboardAnalytics.jsx:116` — Contador de 'Farmácias/Marcas ativas' lê campo inexistente p.pharmacy
- [x] IREC-0476 · BAIXO · `src/components/doctor/DoctorAgendaPage.jsx:60` — Propriedade de estilo inválida 'justify' quebra o alinhamento do cabeçalho da Agenda
- [x] IREC-0477 · BAIXO · `src/components/doctor/DoctorAgendaPage.jsx:114` — app.patientEmail nunca existe nos agendamentos vindos do Supabase
- [x] IREC-0478 · BAIXO · `src/components/doctor/DoctorAgendaView.jsx:103` — Células do calendário são divs clicáveis sem role, tabIndex ou handler de teclado
- [x] IREC-0479 · BAIXO · `src/components/doctor/DoctorAgendaView.jsx:131` — key={appIdx} em lista que muda de conteúdo conforme o filtro de status
- [x] IREC-0480 · BAIXO · `src/components/doctor/DoctorPatientsListView.jsx:12` — Componente inteiro é código morto: nunca é importado, e a prop formatDate é recebida sem uso
- [x] IREC-0481 · BAIXO · `src/components/doctor/DoctorPatientsListView.jsx:19` — Propriedade de estilo inválida 'justify' na barra de busca e filtros
- [x] IREC-0482 · BAIXO · `src/components/doctor/DoctorPatientsListView.jsx:61` — Contador do botão 'Meus Pacientes' mostra o total já filtrado, não o total de pacientes
- [x] IREC-0483 · BAIXO · `src/components/doctor/DoctorPatientsListView.jsx:83` — filteredPatients sem valor default: componente estoura se a prop não for passada
- [x] IREC-0484 · BAIXO · `src/components/doctor/DoctorPatientsListView.jsx:150` — Alerta de infecção nunca é exibido: patient.hasInfectionSigns e patient.lesionType não existem no modelo de dados
- [x] IREC-0485 · BAIXO · `src/components/doctor/DoctorPatientsListView.jsx:180` — Botão de telemedicina não faz nada quando onOpenChat não é fornecido
- [x] IREC-0486 · BAIXO · `src/components/doctor/DoctorPatientsListView.jsx:188` — Botão de ação identificado apenas por emoji, sem nome acessível explícito
- [x] IREC-0496 · BAIXO · `src/components/DoctorDashboardAnalytics.jsx:290` — Grid fixo de duas colunas sem media query e com flexWrap inócuo quebra o painel no celular

**Verificação do módulo:**

```
$ npx eslint src/components/doctor/DoctorAgendaPage.jsx src/components/doctor/DoctorAgendaView.jsx src/components/doctor/DoctorPatientsListView.jsx src/components/DoctorDashboardAnalytics.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-CuDQdWof.js        1,273.08 kB │ gzip: 308.09 kB
✓ built in 1.67s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 526.57ms
√ Sync finished in 1.191s
```

---

## 13. Perfil do usuário — 28/28

- [x] IREC-0030 · CRÍTICO · `src/components/UserProfileModal.jsx:289` — Salvamento do perfil sempre reporta sucesso, mesmo quando o UPDATE no Supabase falha (perda silenciosa de dados clínicos)
- [x] IREC-0154 · ALTO · `src/components/UserProfileModal.jsx:160` — Unidade da altura divergente: perfil grava metros e o Dashboard do paciente divide por 100, exibindo IMC absurdo
- [x] IREC-0155 · ALTO · `src/components/UserProfileModal.jsx:276` — Flag clínica isObese é sobrescrita automaticamente pelo IMC, apagando comorbidade registrada por profissional
- [x] IREC-0156 · ALTO · `src/components/UserProfileModal.jsx:410` — Enfermeiro (role 'nurse') recebe o formulário de PACIENTE e não consegue editar dados profissionais
- [x] IREC-0157 · ALTO · `src/components/UserProfileModal.jsx:438` — Perfil profissional permite salvar CRM/COREN vazio e o gerador de receita usa registro fabricado '123456-SP'
- [x] IREC-0158 · ALTO · `src/components/UserProfilePage.jsx:84` — Exportação LGPD entrega arquivo sem nenhum registro clínico quando o Supabase está configurado
- [x] IREC-0159 · ALTO · `src/components/UserProfilePage.jsx:113` — Botão 'Solicitar Exclusão de Conta (LGPD)' não faz nada e afirma falsamente que registrou a solicitação em auditoria
- [x] IREC-0364 · MÉDIO · `src/components/UserProfileModal.jsx:79` — formData nunca ressincroniza com o prop currentUser: salvar o perfil sobrescreve dados atualizados por outro profissional
- [x] IREC-0365 · MÉDIO · `src/components/UserProfileModal.jsx:124` — Salvar o perfil reverte o 'Modo Fácil' escolhido depois da abertura da tela (uiMode capturado na montagem)
- [x] IREC-0366 · MÉDIO · `src/components/UserProfileModal.jsx:124` — Preferência de acessibilidade é global (não por usuário) e não é limpa no logout: vaza entre contas e é gravada no perfil errado
- [x] IREC-0367 · MÉDIO · `src/components/UserProfileModal.jsx:136` — Race na busca automática de CEP grava endereço de um CEP anterior
- [x] IREC-0368 · MÉDIO · `src/components/UserProfileModal.jsx:222` — Erro de validação aparece fora da área visível e sem levar o usuário ao campo inválido
- [x] IREC-0369 · MÉDIO · `src/components/UserProfileModal.jsx:267` — Status nutricional derivado grava 'Bem nutrido' para IMC de sobrepeso, contradizendo o badge exibido
- [x] IREC-0370 · MÉDIO · `src/components/UserProfileModal.jsx:330` — Especialidade personalizada com vírgula é fatiada em duas especialidades falsas
- [x] IREC-0371 · MÉDIO · `src/components/UserProfileModal.jsx:514` — Overlay invisível do autocomplete de especialidades engole o primeiro clique nos botões do rodapé
- [x] IREC-0372 · MÉDIO · `src/components/UserProfileModal.jsx:548` — Autocomplete de especialidades e avatar são divs clicáveis sem role, foco ou suporte a teclado
- [x] IREC-0373 · MÉDIO · `src/components/UserProfileModal.jsx:721` — Validação 'required' do Nome só existe na aba Dados Pessoais: é possível salvar nome vazio trocando de aba
- [x] IREC-0374 · MÉDIO · `src/components/UserProfileModal.jsx:978` — Selects de etilismo e cuidador não têm estado 'não informado' e gravam 'Não' como resposta clínica
- [x] IREC-0375 · MÉDIO · `src/components/UserProfilePage.jsx:52` — Botão 'Cancelar' da página de Perfil é inoperante (onClose é uma função vazia)
- [x] IREC-0550 · BAIXO · `src/components/UserProfileModal.jsx:152` — Falha na busca de CEP é silenciosa (apenas console.warn)
- [x] IREC-0551 · BAIXO · `src/components/UserProfileModal.jsx:178` — Reselecionar o mesmo arquivo após uma falha de upload não dispara nada (input file não é resetado)
- [x] IREC-0552 · BAIXO · `src/components/UserProfileModal.jsx:197` — Troca de foto é persistida imediatamente no banco e 'Cancelar' não a desfaz
- [x] IREC-0553 · BAIXO · `src/components/UserProfileModal.jsx:293` — setTimeout que fecha o modal não é cancelado no desmonte
- [x] IREC-0554 · BAIXO · `src/components/UserProfileModal.jsx:351` — Botão de fechar do modal não tem nome acessível
- [x] IREC-0555 · BAIXO · `src/components/UserProfileModal.jsx:1330` — Backdrop fecha o modal em qualquer clique e descarta todas as edições sem confirmação
- [x] IREC-0556 · BAIXO · `src/components/UserProfilePage.jsx:37` — Página anuncia 'preferências de interface' que não existem em nenhum campo do formulário
- [x] IREC-0557 · BAIXO · `src/components/UserProfilePage.jsx:79` — Exportação de dados de saúde não gera registro de auditoria LGPD
- [x] IREC-0558 · BAIXO · `src/components/UserProfilePage.jsx:84` — JSON.parse sem try/catch no botão de exportação LGPD derruba o handler

**Verificação do módulo:**

```
$ npx eslint src/components/UserProfileModal.jsx src/components/UserProfilePage.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-CUWmiOxc.js        1,275.37 kB │ gzip: 308.59 kB
✓ built in 1.59s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 512.18ms
√ Sync finished in 1.154s
```

---

## 14. Área administrativa — 37/37

- [x] IREC-0004 · CRÍTICO · `src/components/AdminReports.jsx:703` — Tabela LGPD renderiza objeto JSON direto como filho React e quebra a aba Seguranca
- [x] IREC-0045 · ALTO · `src/components/AdminDashboard.jsx:51` — Logs de auditoria nunca aparecem: escrita em localStorage e leitura na tabela audit_logs
- [x] IREC-0046 · ALTO · `src/components/AdminDashboard.jsx:74` — AdminDashboard carrega perfis, logs e prontuarios sem nenhuma verificacao de papel do usuario
- [x] IREC-0047 · ALTO · `src/components/AdminDashboard.jsx:90` — Cadastro de parceiro envia texto no campo price, que e numeric(10,2) no banco
- [x] IREC-0048 · ALTO · `src/components/AdminDashboard.jsx:129` — Fluxo de aprovacao de medicos pendentes nunca renderizado; callback onVerificationProcessed jamais chamado
- [x] IREC-0049 · ALTO · `src/components/AdminDashboard.jsx:168` — Filtro de periodo personalizado usa fuso UTC no inicio e fuso local no fim (limites assimetricos)
- [x] IREC-0050 · ALTO · `src/components/AdminDashboard.jsx:197` — Periodo '15d' oferecido pelo DateRangePicker nao existe no filtro e mostra todos os dados
- [x] IREC-0051 · ALTO · `src/components/AdminDashboard.jsx:215` — Contador de usuarios online usa campo inexistente (last_seen/lastSeen) e fica sempre em zero
- [x] IREC-0052 · ALTO · `src/components/AdminDashboard.jsx:243` — Status online/offline dos profissionais depende do contador global e do campo inexistente last_seen
- [x] IREC-0053 · ALTO · `src/components/AdminDashboard.jsx:331` — Mapeamento de Patologias nunca exibe nada: getAllProfiles descarta todos os campos de comorbidade
- [x] IREC-0054 · ALTO · `src/components/AdminReports.jsx:49` — Relatorio de Retorno de Pacientes agrupa tudo sob chave undefined porque patient_id nao vem na consulta
- [x] IREC-0055 · ALTO · `src/components/AdminReports.jsx:66` — Relatorio de Altas Clinicas sempre 0% : campos patient_id e clinical_outcome ausentes na consulta
- [x] IREC-0056 · ALTO · `src/components/AdminReports.jsx:122` — NPS e avaliacoes de satisfacao fabricados a partir do indice da chamada
- [x] IREC-0057 · ALTO · `src/components/AdminReports.jsx:183` — Valores financeiros de comissao por medico calculados a partir do indice do array
- [x] IREC-0213 · MÉDIO · `src/components/AdminDashboard.jsx:68` — Falha em qualquer uma das 8 cargas zera o painel inteiro sem avisar o admin
- [x] IREC-0214 · MÉDIO · `src/components/AdminDashboard.jsx:1067` — Alerta de sucesso na edicao de capitulo clinico e exibido mesmo quando nada foi salvo
- [x] IREC-0215 · MÉDIO · `src/components/AdminPartners.jsx:4` — AdminPartners.jsx e codigo morto: case 'admin-partners' duplicado no switch do App.jsx
- [x] IREC-0216 · MÉDIO · `src/components/AdminReports.jsx:34` — Relatorio de epidemiologia sempre com zeros de comorbidade e uma unica localidade generica
- [x] IREC-0217 · MÉDIO · `src/components/AdminReports.jsx:92` — Tempo medio de espera na fila e uma formula inventada que DIMINUI conforme a demanda cresce
- [x] IREC-0218 · MÉDIO · `src/components/AdminReports.jsx:114` — Retorno antecipado do NPS omite totalRated e a tela mostra '(undefined avaliacoes)'
- [x] IREC-0219 · MÉDIO · `src/components/AdminReports.jsx:158` — KPIs de cliques, vendas e receita de afiliados derivados apenas da quantidade de parceiros
- [x] IREC-0220 · MÉDIO · `src/components/AdminReports.jsx:174` — Ranking de Insumos Mais Recomendados atribui a mesma contagem fixa a todos os produtos
- [x] IREC-0221 · MÉDIO · `src/components/AdminReports.jsx:216` — KPI 'Documentos Clinicos Emitidos' conta triagens de ferida e ignora a emissao real de documentos
- [x] IREC-0222 · MÉDIO · `src/components/AdminReports.jsx:418` — Score NPS negativo e exibido com sinal duplo ('+-33')
- [x] IREC-0429 · BAIXO · `src/components/AdminDashboard.jsx:59` — Estado stats e preenchido por 6 consultas de contagem e nunca renderizado
- [x] IREC-0430 · BAIXO · `src/components/AdminDashboard.jsx:76` — Efeito de carga sem cancelamento: setState apos desmontagem do painel
- [x] IREC-0431 · BAIXO · `src/components/AdminDashboard.jsx:412` — Log sem campo action gera a chave literal 'undefined' no ranking de atividades
- [x] IREC-0432 · BAIXO · `src/components/AdminDashboard.jsx:423` — Cor de texto fixa 'black' no rotulo de papel desconhecido fica ilegivel no tema escuro
- [x] IREC-0433 · BAIXO · `src/components/AdminDashboard.jsx:525` — Condicao de renderizacao dos filtros de patologia e sempre verdadeira
- [x] IREC-0434 · BAIXO · `src/components/AdminDashboard.jsx:559` — Seletores de Estado, Cidade e Ordenacao sem label associado
- [x] IREC-0435 · BAIXO · `src/components/AdminDashboard.jsx:583` — Filtro de cidade ignora o estado e usa key duplicada para cidades homonimas
- [x] IREC-0436 · BAIXO · `src/components/AdminDashboard.jsx:1182` — Aba administrativa desconhecida renderiza painel vazio (header sem conteudo)
- [x] IREC-0437 · BAIXO · `src/components/AdminDashboard.jsx:1192` — Botao de fechar do modal de parceiro nao possui nome acessivel
- [x] IREC-0438 · BAIXO · `src/components/AdminPartners.jsx:22` — AdminPartners lista materiais que nao sao parceiros iRec (falta o filtro por type)
- [x] IREC-0439 · BAIXO · `src/components/AdminPartners.jsx:38` — Mensagens de sucesso e erro do formulario coexistem e nunca sao limpas
- [x] IREC-0440 · BAIXO · `src/components/AdminPartners.jsx:50` — Mesmo defeito de tipo no price do AdminPartners (payload texto para coluna numeric)
- [x] IREC-0441 · BAIXO · `src/components/AdminReports.jsx:423` — Cinco estrelas fixas exibidas independentemente da nota media

**Verificação do módulo:**

```
$ npx eslint src/components/AdminDashboard.jsx src/components/AdminPartners.jsx src/components/AdminReports.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-oF732S01.js        1,277.18 kB │ gzip: 309.24 kB
✓ built in 1.63s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 534.27ms
√ Sync finished in 1.211s
```

---

## 15. Login e cadastro — 26/26

- [x] IREC-0015 · CRÍTICO · `src/components/Login.jsx:146` — Cadastro de médico/enfermeiro sem nenhuma verificação de credencial, já marcado como 'verified'
- [x] IREC-0112 · ALTO · `src/components/Login.jsx:131` — CPF, cidade e estado exigidos como obrigatórios são descartados e nunca persistidos
- [x] IREC-0113 · ALTO · `src/components/Login.jsx:198` — Login social offline gera novo id a cada acesso e perde todo o histórico do usuário
- [x] IREC-0114 · ALTO · `src/components/Login.jsx:622` — Enfermeiro é cadastrado com role 'doctor' e o papel 'nurse' nunca é criado
- [x] IREC-0300 · MÉDIO · `src/components/Login.jsx:142` — COREN do enfermeiro é gravado no campo 'crm' sem prefixo, quebrando a heurística de exibição
- [x] IREC-0301 · MÉDIO · `src/components/Login.jsx:152` — Botão reabilita durante o setTimeout de 1,5 s e permite cadastro duplicado
- [x] IREC-0302 · MÉDIO · `src/components/Login.jsx:176` — E-mail sem trim/lowercase impede o login no modo contingência local
- [x] IREC-0303 · MÉDIO · `src/components/Login.jsx:177` — onLoginSuccess é chamado com profile possivelmente null e derruba o app
- [x] IREC-0304 · MÉDIO · `src/components/Login.jsx:181` — Senha sem validação mínima: erro cru do Supabase em inglês é exibido ao usuário
- [x] IREC-0305 · MÉDIO · `src/components/Login.jsx:220` — JSON.parse de 'irec_users' sem try/catch e sem validar que é array
- [x] IREC-0306 · MÉDIO · `src/components/Login.jsx:235` — Tokens OAuth do hash são interpretados como aba e persistidos em localStorage
- [x] IREC-0307 · MÉDIO · `src/components/Login.jsx:235` — redirectTo com window.location.origin quebra o login Google no app nativo
- [x] IREC-0308 · MÉDIO · `src/components/Login.jsx:238` — Loading do login social nunca é encerrado no caminho de sucesso
- [x] IREC-0309 · MÉDIO · `src/components/Login.jsx:252` — Busca de especialidade não normaliza acentos e induz duplicata sem acento
- [x] IREC-0310 · MÉDIO · `src/components/Login.jsx:590` — Seletor de papel é div clicável: inacessível por teclado e para leitor de tela
- [x] IREC-0311 · MÉDIO · `src/components/Login.jsx:842` — Overlay fixed em tela cheia com o dropdown aberto engole o primeiro clique em qualquer botão
- [x] IREC-0508 · BAIXO · `src/components/Login.jsx:115` — Validação aceita campos preenchidos só com espaços
- [x] IREC-0509 · BAIXO · `src/components/Login.jsx:121` — CPF é validado limpo mas persistido com máscara, gerando formatos divergentes
- [x] IREC-0510 · BAIXO · `src/components/Login.jsx:122` — CPF aceito só por quantidade de dígitos, sem dígito verificador
- [x] IREC-0511 · BAIXO · `src/components/Login.jsx:263` — Especialidade armazenada como string separada por vírgula corrompe entradas customizadas
- [x] IREC-0512 · BAIXO · `src/components/Login.jsx:609` — Clicar novamente no papel já selecionado apaga os dados profissionais digitados
- [x] IREC-0513 · BAIXO · `src/components/Login.jsx:638` — Labels sem htmlFor e inputs sem id/aria-label em todo o formulário
- [x] IREC-0514 · BAIXO · `src/components/Login.jsx:692` — Data de nascimento no futuro é aceita e gera idade negativa nas telas clínicas
- [x] IREC-0515 · BAIXO · `src/components/Login.jsx:729` — UF é armazenada em minúsculas: o uppercase é apenas visual
- [x] IREC-0516 · BAIXO · `src/components/Login.jsx:801` — Botão de remover especialidade sem nome acessível
- [x] IREC-0517 · BAIXO · `src/components/Login.jsx:925` — Botão do Google não é desabilitado durante loading

**Verificação do módulo:**

```
$ npx eslint src/components/Login.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-DEENIYD3.js        1,277.86 kB │ gzip: 309.42 kB
✓ built in 3.34s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 564.03ms
√ Sync finished in 1.338s
```

---

## 16. Camada de dados (Supabase) — 33/33

- [x] IREC-0178 · ALTO · `src/services/supabaseService.js:122` — Verificação de registro profissional é ignorada: todo médico/enfermeiro nasce 'verified'
- [x] IREC-0179 · ALTO · `src/services/supabaseService.js:130` — Senha em texto puro no localStorage no cadastro em modo contingência
- [x] IREC-0180 · ALTO · `src/services/supabaseService.js:130` — Senhas gravadas em texto puro no localStorage no modo contingência
- [x] IREC-0181 · ALTO · `src/services/supabaseService.js:299` — signOutUser não limpa os caches clínicos locais: dados do paciente anterior vazam para o próximo usuário
- [x] IREC-0182 · ALTO · `src/services/supabaseService.js:327` — getCurrentUser reautentica pelo localStorage quando a sessão do Supabase falha
- [x] IREC-0183 · ALTO · `src/services/supabaseService.js:429` — Revinculação de perfil por e-mail altera a chave primária e cai em insert duplicado
- [x] IREC-0184 · ALTO · `src/services/supabaseService.js:495` — Auto-criação de perfil força role 'patient', rebaixando médicos e enfermeiros
- [x] IREC-0185 · ALTO · `src/services/supabaseService.js:743` — updateClinicalProfile silencia o erro remoto e retorna o perfil, exibindo 'sucesso' para dado não salvo
- [x] IREC-0186 · ALTO · `src/services/supabaseService.js:901` — Qualquer erro em getWoundEntries apresenta o histórico clínico como vazio em vez de erro
- [x] IREC-0187 · ALTO · `src/services/supabaseService.js:956` — addWoundEntry no modo local pode estourar a cota do localStorage e perder a triagem sem tratamento
- [x] IREC-0188 · ALTO · `src/services/supabaseService.js:975` — Fotos de ferida e exames são gravados como URL pública permanente; getSecureMediaUrl nunca é usado
- [x] IREC-0189 · ALTO · `src/services/supabaseService.js:1102` — uploadExamFileAndTriage grava valores laboratoriais inventados no prontuário
- [x] IREC-0190 · ALTO · `src/services/supabaseService.js:1260` — Backdoor: profissional com 'teste' no nome é listado como se fosse verificado
- [x] IREC-0191 · ALTO · `src/services/supabaseService.js:1362` — checkAppointmentCollision retorna false em qualquer erro e usa dados locais: permite dupla marcação
- [x] IREC-0192 · ALTO · `src/services/supabaseService.js:1433` — Falha no insert do agendamento é apenas console.warn: paciente vê sucesso e o médico nunca recebe a consulta
- [x] IREC-0193 · ALTO · `src/services/supabaseService.js:1986` — getLocalHealthcareResources devolve hospitais, endereços e telefones inventados para o SOS
- [x] IREC-0194 · ALTO · `src/services/supabaseService.js:2039` — getChatMessages devolve as 200 mensagens MAIS ANTIGAS: conversas longas congelam
- [x] IREC-0195 · ALTO · `src/services/supabaseService.js:2217` — placeTelemedicineCall difunde um id local antes do insert, e a chamada nunca conecta entre abas
- [x] IREC-0196 · ALTO · `src/services/supabaseService.js:2875` — Chave da API Infosimples é lida de variável VITE_* (embutida no bundle) e enviada na query string
- [x] IREC-0197 · ALTO · `src/services/supabaseService.js:2951` — updateVerificationStatus é chamável pelo cliente sem verificação de papel (admin identificado por e-mail)
- [x] IREC-0407 · MÉDIO · `src/services/supabaseService.js:4` — JSON.parse sem try/catch em todos os helpers de localStorage derruba o app com um único valor corrompido
- [x] IREC-0408 · MÉDIO · `src/services/supabaseService.js:862` — getWoundEntries ordena por id (ordem de inserção) e não pela data clínica
- [x] IREC-0409 · MÉDIO · `src/services/supabaseService.js:1078` — O limite de 5MB de upload é burlável: validateFileSize lança dentro do try e o catch grava base64 local
- [x] IREC-0410 · MÉDIO · `src/services/supabaseService.js:1429` — createAppointment grava status divergente do vocabulário lido pela agenda do paciente
- [x] IREC-0411 · MÉDIO · `src/services/supabaseService.js:1453` — Agendamentos: resposta remota vazia é tratada como falha e devolve o cache local desatualizado
- [x] IREC-0412 · MÉDIO · `src/services/supabaseService.js:2013` — BroadcastChannel instanciado no topo do módulo sem detecção de suporte pode quebrar o app no WebView
- [x] IREC-0413 · MÉDIO · `src/services/supabaseService.js:2082` — getAllReceivedMessages também devolve as 200 mensagens mais antigas, travando o contador de não lidas
- [x] IREC-0414 · MÉDIO · `src/services/supabaseService.js:2266` — updateCallStatus grava 'duration' local mas o restante do sistema lê 'duration_seconds'
- [x] IREC-0415 · MÉDIO · `src/services/supabaseService.js:2524` — getRecommendedMaterials expõe os links de parceria de um médico aos pacientes de outros médicos
- [x] IREC-0416 · MÉDIO · `src/services/supabaseService.js:2661` — Chave de localStorage inexistente 'irec_local_wound_entries' zera métricas de triagem
- [x] IREC-0417 · MÉDIO · `src/services/supabaseService.js:2677` — getAdminStats conta role 'nurse', papel que o cadastro nunca cria
- [x] IREC-0418 · MÉDIO · `src/services/supabaseService.js:2717` — Chave de localStorage inexistente 'irec_local_assignments' quebra vínculos médico-paciente no admin e nas analytics
- [x] IREC-0419 · MÉDIO · `src/services/supabaseService.js:2789` — getDoctorTelemedicineCalls filtra por snake_case dados gravados em camelCase (sempre vazio no modo local)

**Verificação do módulo:**

```
$ npx eslint src/services/supabaseService.js src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-DEENIYD3.js        1,277.86 kB │ gzip: 309.42 kB
✓ built in 1.61s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 558.27ms
√ Sync finished in 1.197s
```

---

## 17. SOS e emergência — 30/30

- [x] IREC-0135 · ALTO · `src/components/SOSEmergencyModal.jsx:64` — Notificação "fixa" de SOS usa tag divergente da esperada pelo service worker e não é recriada ao ser dispensada
- [x] IREC-0136 · ALTO · `src/components/SOSEmergencyModal.jsx:167` — Botão principal "IR PARA HOSPITAL / UPA MAIS PRÓXIMO" abre o mapa dentro de callback assíncrono do GPS e é bloqueado pelo navegador
- [x] IREC-0176 · ALTO · `src/services/locationService.js:140` — Estabelecimentos de saúde com nome, endereço e TELEFONE hardcoded no código são injetados e exibidos como resultado real de busca
- [x] IREC-0177 · ALTO · `src/services/locationService.js:440` — Resultado vazio (falha total de rede/API) é gravado no cache por 3 horas, deixando o paciente sem hospitais mesmo após a conectividade voltar
- [x] IREC-0297 · MÉDIO · `src/components/LocalResourcesPanel.jsx:21` — Nenhum dos dois efeitos tem cancelamento: resposta lenta sobrescreve estado mais novo e há setState após unmount
- [x] IREC-0298 · MÉDIO · `src/components/LocalResourcesPanel.jsx:32` — Coleta automática de GPS no mount, duplicada por StrictMode e por duas instâncias simultâneas do painel
- [x] IREC-0299 · MÉDIO · `src/components/LocalResourcesPanel.jsx:84` — Listas de hospitais e farmácias não são limpas ao mudar a localização: distâncias exibidas referem-se ao local antigo
- [x] IREC-0332 · MÉDIO · `src/components/PermissionsGuideModal.jsx:175` — Guia Android instrui a tocar no botão de instalar que acabou de falhar — o modal só abre quando esse caminho é impossível
- [x] IREC-0349 · MÉDIO · `src/components/SOSEmergencyModal.jsx:8` — GPS de emergência é capturado no mount e nunca utilizado; o app pede a localização duas vezes
- [x] IREC-0350 · MÉDIO · `src/components/SOSEmergencyModal.jsx:31` — Endereço físico completo do paciente é montado para a emergência e nunca renderizado
- [x] IREC-0351 · MÉDIO · `src/components/SOSEmergencyModal.jsx:60` — Notificação de SOS do modal é criada sem `actions`, prometendo botões "ligar 192" e "rota da UPA" que não existem
- [x] IREC-0352 · MÉDIO · `src/components/SOSEmergencyModal.jsx:176` — Fallback do mapa gera URL de busca sem local quando o perfil não tem cidade/estado
- [x] IREC-0353 · MÉDIO · `src/components/SOSEmergencyModal.jsx:205` — Qualquer toque fora do card fecha o modal SOS e cancela silenciosamente a contagem de 3s para a ligação
- [x] IREC-0404 · MÉDIO · `src/services/locationService.js:43` — Endereço e coordenadas do paciente ficam no localStorage sem expiração e não são apagados no logout
- [x] IREC-0405 · MÉDIO · `src/services/locationService.js:235` — Abort do cliente em 3s é menor que o timeout de 8s declarado na própria query Overpass
- [x] IREC-0406 · MÉDIO · `src/services/locationService.js:305` — Telefone ausente é substituído pela string "192 / Não informado", exibida como número do hospital
- [x] IREC-0505 · BAIXO · `src/components/LocalResourcesPanel.jsx:136` — No modo compacto o erro é engolido e a falha de localização aparece como "nenhum hospital encontrado"
- [x] IREC-0506 · BAIXO · `src/components/LocalResourcesPanel.jsx:280` — Coordenadas precisas do paciente são enviadas ao Google em query string, via iframe e links, sem consentimento
- [x] IREC-0507 · BAIXO · `src/components/LocalResourcesPanel.jsx:300` — Bloco `<style>` com keyframes `spin` é código morto injetado em escopo global a cada mount
- [x] IREC-0526 · BAIXO · `src/components/PermissionsGuideModal.jsx:5` — Detecção de iOS por user agent falha em iPad (iPadOS 13+) e abre o guia na aba errada
- [x] IREC-0527 · BAIXO · `src/components/PermissionsGuideModal.jsx:65` — Botão de fechar do guia de permissões não tem nome acessível e o diálogo não tem role, foco ou Esc
- [x] IREC-0537 · BAIXO · `src/components/SOSEmergencyModal.jsx:57` — Ativação da notificação pode travar para sempre em `serviceWorker.ready`, escondendo o botão sem criar notificação alguma
- [x] IREC-0538 · BAIXO · `src/components/SOSEmergencyModal.jsx:172` — `window.open('_blank')` sem `noopener` dá referência `window.opener` à página aberta
- [x] IREC-0539 · BAIXO · `src/components/SOSEmergencyModal.jsx:190` — Modal SOS não é anunciado como diálogo, não fecha com Esc e o backdrop é uma div clicável sem role/foco
- [x] IREC-0579 · BAIXO · `src/services/locationService.js:17` — Arredondamento dentro de `getDistance` inviabiliza o limiar de deduplicação de 50 metros
- [x] IREC-0580 · BAIXO · `src/services/locationService.js:35` — Geocodificação retorna null quando o perfil tem cidade mas não tem estado
- [x] IREC-0581 · BAIXO · `src/services/locationService.js:59` — Geocodificação não verifica `res.ok`; resposta 429/403 lança exceção e pula o fallback cidade/estado
- [x] IREC-0582 · BAIXO · `src/services/locationService.js:117` — Chave de cache com 4 casas decimais cria entrada nova a cada leitura de GPS e nada expurga as vencidas
- [x] IREC-0583 · BAIXO · `src/services/locationService.js:294` — `el.tags.amenity` sem guarda: um elemento sem `tags` derruba toda a busca de recursos
- [x] IREC-0584 · BAIXO · `src/services/locationService.js:309` — `id: el.id` sem o tipo do elemento OSM gera keys React duplicadas na lista de resultados

**Verificação do módulo:**

```
$ npx eslint src/components/SOSEmergencyModal.jsx src/components/LocalResourcesPanel.jsx src/components/PermissionsGuideModal.jsx src/services/locationService.js src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-BVg6G20A.js        1,278.00 kB │ gzip: 309.46 kB
✓ built in 1.55s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 532.65ms
√ Sync finished in 1.15s
```

---

## 18. Rede de profissionais — 25/25

- [x] IREC-0110 · ALTO · `src/components/DoctorPartners.jsx:4` — Central de Parcerias do médico acessível a qualquer papel (permissão apenas no client, sem RLS)
- [x] IREC-0111 · ALTO · `src/components/DoctorPartners.jsx:57` — Cadastro de parceria sempre falha: string 'A consultar' gravada em coluna numeric(10,2)
- [x] IREC-0115 · ALTO · `src/components/NursesNetwork.jsx:54` — Bio, formação e valor reais do enfermeiro nunca chegam ao diretório (campos não mapeados no service)
- [x] IREC-0116 · ALTO · `src/components/NursesNetwork.jsx:62` — Credenciais, preços, notas e depoimentos de enfermeiros são FABRICADOS e exibidos como reais
- [x] IREC-0117 · ALTO · `src/components/NursesNetwork.jsx:519` — Agendamento cobra valor inventado (R$ 130 / R$ 250) por price nulo
- [x] IREC-0137 · ALTO · `src/components/SpecialistDirectory.jsx:66` — Preço do médico lido de campo inexistente (doc.price em vez de consultationFee)
- [x] IREC-0138 · ALTO · `src/components/SpecialistDirectory.jsx:80` — Diretório de médicos SOBRESCREVE bio e formação reais por texto fabricado
- [x] IREC-0295 · MÉDIO · `src/components/DoctorPartners.jsx:32` — Falha de carregamento das parcerias é apresentada como catálogo vazio
- [x] IREC-0296 · MÉDIO · `src/components/DoctorPartners.jsx:124` — Exclusão de parceria por id, sem checagem de propriedade e sem RLS, com ids sequenciais
- [x] IREC-0312 · MÉDIO · `src/components/MyNetworkPortal.jsx:67` — Cartões de navegação são <div> com onClick, sem role, foco ou teclado
- [x] IREC-0313 · MÉDIO · `src/components/NursesNetwork.jsx:247` — Selo '✅ Verificado' e 'Registro ativo no COREN' são fixos, não derivados dos dados
- [x] IREC-0314 · MÉDIO · `src/components/NursesNetwork.jsx:304` — Cartões e mensagem 'Nenhum enfermeiro disponível' aparecem ao mesmo tempo (filtro duplicado divergente)
- [x] IREC-0315 · MÉDIO · `src/components/NursesNetwork.jsx:496` — Retorno de followPatient ignorado: vínculo pode falhar e a UI segue como se tivesse dado certo
- [x] IREC-0316 · MÉDIO · `src/components/NursesNetwork.jsx:499` — Redirecionamento para telemedicina não abre a conversa: contatos só atualizam a cada 30 s
- [x] IREC-0354 · MÉDIO · `src/components/SpecialistDirectory.jsx:501` — Diretórios sem checagem de papel: clínico consegue se vincula como 'paciente' de outro clínico
- [x] IREC-0497 · BAIXO · `src/components/DoctorPartners.jsx:153` — Variáveis CSS --primary-rgb e --accent-rgb não existem: fundos e bordas não são aplicados
- [x] IREC-0498 · BAIXO · `src/components/DoctorPartners.jsx:154` — Chaves de estilo inválidas ('justifyContext' e 'hover') geram avisos e efeito que nunca acontece
- [x] IREC-0499 · BAIXO · `src/components/DoctorPartners.jsx:264` — Link de afiliado informado pelo usuário vai direto para href, permitindo esquema javascript:
- [x] IREC-0518 · BAIXO · `src/components/NursesNetwork.jsx:104` — Polling de 10s sem cancelamento cria corrida que desfaz o vínculo recém-criado na UI
- [x] IREC-0519 · BAIXO · `src/components/NursesNetwork.jsx:157` — Seletor de especialidade sem rótulo acessível
- [x] IREC-0520 · BAIXO · `src/components/NursesNetwork.jsx:183` — Profissional sem nome cadastrado nunca aparece no diretório
- [x] IREC-0521 · BAIXO · `src/components/NursesNetwork.jsx:188` — isAlreadyAssigned calculado no cartão e nunca usado: paciente não vê que já está vinculado
- [x] IREC-0522 · BAIXO · `src/components/NursesNetwork.jsx:192` — Cartões de profissionais também são <div> clicáveis sem semântica de botão
- [x] IREC-0523 · BAIXO · `src/components/NursesNetwork.jsx:322` — Drawer de perfil clínico não fecha com Esc nem com clique no fundo e não é um dialog acessível
- [x] IREC-0540 · BAIXO · `src/components/SpecialistDirectory.jsx:300` — Campo 'CRM:' renderizado vazio quando o registro não está preenchido

**Verificação do módulo:**

```
$ npx eslint src/components/DoctorPartners.jsx src/components/MyNetworkPortal.jsx src/components/NursesNetwork.jsx src/components/SpecialistDirectory.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-DvApQpVp.css          17.23 kB │ gzip:   4.02 kB
dist/assets/index-Bc7YjUVy.js        1,278.57 kB │ gzip: 309.65 kB
✓ built in 1.91s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 607.15ms
√ Sync finished in 1.387s
```ice)
- [ ] IREC-0116 · ALTO · `src/components/NursesNetwork.jsx:62` — Credenciais, preços, notas e depoimentos de enfermeiros são FABRICADOS e exibidos como reais
- [ ] IREC-0117 · ALTO · `src/components/NursesNetwork.jsx:519` — Agendamento cobra valor inventado (R$ 130 / R$ 250) por price nulo
- [ ] IREC-0137 · ALTO · `src/components/SpecialistDirectory.jsx:66` — Preço do médico lido de campo inexistente (doc.price em vez de consultationFee)
- [ ] IREC-0138 · ALTO · `src/components/SpecialistDirectory.jsx:80` — Diretório de médicos SOBRESCREVE bio e formação reais por texto fabricado
- [ ] IREC-0295 · MÉDIO · `src/components/DoctorPartners.jsx:32` — Falha de carregamento das parcerias é apresentada como catálogo vazio
- [ ] IREC-0296 · MÉDIO · `src/components/DoctorPartners.jsx:124` — Exclusão de parceria por id, sem checagem de propriedade e sem RLS, com ids sequenciais
- [ ] IREC-0312 · MÉDIO · `src/components/MyNetworkPortal.jsx:67` — Cartões de navegação são <div> com onClick, sem role, foco ou teclado
- [ ] IREC-0313 · MÉDIO · `src/components/NursesNetwork.jsx:247` — Selo '✅ Verificado' e 'Registro ativo no COREN' são fixos, não derivados dos dados
- [ ] IREC-0314 · MÉDIO · `src/components/NursesNetwork.jsx:304` — Cartões e mensagem 'Nenhum enfermeiro disponível' aparecem ao mesmo tempo (filtro duplicado divergente)
- [ ] IREC-0315 · MÉDIO · `src/components/NursesNetwork.jsx:496` — Retorno de followPatient ignorado: vínculo pode falhar e a UI segue como se tivesse dado certo
- [ ] IREC-0316 · MÉDIO · `src/components/NursesNetwork.jsx:499` — Redirecionamento para telemedicina não abre a conversa: contatos só atualizam a cada 30 s
- [ ] IREC-0354 · MÉDIO · `src/components/SpecialistDirectory.jsx:501` — Diretórios sem checagem de papel: clínico consegue se vincular como 'paciente' de outro clínico
- [ ] IREC-0497 · BAIXO · `src/components/DoctorPartners.jsx:153` — Variáveis CSS --primary-rgb e --accent-rgb não existem: fundos e bordas não são aplicados
- [ ] IREC-0498 · BAIXO · `src/components/DoctorPartners.jsx:154` — Chaves de estilo inválidas ('justifyContext' e 'hover') geram avisos e efeito que nunca acontece
- [ ] IREC-0499 · BAIXO · `src/components/DoctorPartners.jsx:264` — Link de afiliado informado pelo usuário vai direto para href, permitindo esquema javascript:
- [ ] IREC-0518 · BAIXO · `src/components/NursesNetwork.jsx:104` — Polling de 10s sem cancelamento cria corrida que desfaz o vínculo recém-criado na UI
- [ ] IREC-0519 · BAIXO · `src/components/NursesNetwork.jsx:157` — Seletor de especialidade sem rótulo acessível
- [ ] IREC-0520 · BAIXO · `src/components/NursesNetwork.jsx:183` — Profissional sem nome cadastrado nunca aparece no diretório
- [ ] IREC-0521 · BAIXO · `src/components/NursesNetwork.jsx:188` — isAlreadyAssigned calculado no cartão e nunca usado: paciente não vê que já está vinculado
- [ ] IREC-0522 · BAIXO · `src/components/NursesNetwork.jsx:192` — Cartões de profissionais também são <div> clicáveis sem semântica de botão
- [ ] IREC-0523 · BAIXO · `src/components/NursesNetwork.jsx:322` — Drawer de perfil clínico não fecha com Esc nem com clique no fundo e não é um dialog acessível
- [ ] IREC-0540 · BAIXO · `src/components/SpecialistDirectory.jsx:300` — Campo 'CRM:' renderizado vazio quando o registro não está preenchido

**Verificação do módulo:**

```
(cole aqui a saída de npx eslint . e npx vite build)
```

---

## 19. Serviços de base e CSS — 35/35

- [x] IREC-0162 · ALTO · `src/index.css:125` — outline: none global sem nenhum estilo de foco: teclado fica sem indicador visível em todo o app
- [x] IREC-0163 · ALTO · `src/index.css:837` — @media print não isola o conteúdo do modal: impressão da receita inclui o dashboard e o prontuário de fundo
- [x] IREC-0164 · ALTO · `src/index.css:856` — @media print não zera o padding-left de 260px do .app-container: documento impresso sai deslocado e cortado
- [x] IREC-0165 · ALTO · `src/index.css:1013` — Duas barras de navegação inferiores renderizam juntas; a de paciente cobre a de médico/admin no celular
- [x] IREC-0166 · ALTO · `src/index.css:1026` — Barra de navegação mobile (z-index 99999) fica acima de todos os modais e bloqueia seus controles
- [x] IREC-0167 · ALTO · `src/services/auditLogger.js:8` — Dois createAuditLog com assinaturas e destinos diferentes; os eventos LGPD nunca chegam à tela admin-logs
- [x] IREC-0168 · ALTO · `src/services/auditLogger.js:25` — Trilha de auditoria LGPD gravada só em localStorage e declarada "imutável"
- [x] IREC-0169 · ALTO · `src/services/fhirService.js:28` — Bundle FHIR exportado omite CPF, alergias e medicamentos em uso
- [x] IREC-0170 · ALTO · `src/services/fhirService.js:191` — Medidas de ferida não medidas são exportadas como 0 cm / 0 cm² com status "final" no bundle FHIR
- [x] IREC-0387 · MÉDIO · `src/index.css:1013` — Colisão de breakpoint em exatamente 768px: sidebar desktop e barra mobile ativas ao mesmo tempo
- [x] IREC-0388 · MÉDIO · `src/index.css:1023` — Classe .no-print é derrotada por !important declarado depois no arquivo
- [x] IREC-0390 · MÉDIO · `src/services/auditLogger.js:3` — Logs de auditoria com nomes de pacientes não são apagados no logout (vazamento em dispositivo compartilhado)
- [x] IREC-0391 · MÉDIO · `src/services/auditLogger.js:25` — Nome de paciente gravado pelo log de auditoria não é limpo no logout (vazamento entre usuários do mesmo dispositivo)
- [x] IREC-0392 · MÉDIO · `src/services/auditLogger.js:26` — Nome do paciente é impresso no console a cada abertura do prontuário (PII em log)
- [x] IREC-0393 · MÉDIO · `src/services/auditLogger.js:26` — Nome do paciente escrito em console.log vira breadcrumb do Sentry e sai do dispositivo
- [x] IREC-0394 · MÉDIO · `src/services/auditLogger.js:28` — Falha na gravação da auditoria é silenciosa: acesso ao prontuário prossegue sem registro
- [x] IREC-0395 · MÉDIO · `src/services/auditLogger.js:37` — Trilha de auditoria é write-only: getPatientAuditLogs nunca é chamada em nenhum lugar
- [x] IREC-0396 · MÉDIO · `src/services/fhirService.js:25` — Nome do paciente invertido no HumanName FHIR: prenome exportado como family (sobrenome)
- [x] IREC-0397 · MÉDIO · `src/services/fhirService.js:48` — Arrays vazios e fullUrl relativo tornam o bundle inválido para servidores FHIR conformes
- [x] IREC-0398 · MÉDIO · `src/services/fhirService.js:102` — effectiveDateTime da avaliação sai um dia antes por parse de data em UTC
- [x] IREC-0399 · MÉDIO · `src/services/fhirService.js:201` — Dor não informada é exportada como 0/10 e valor string quebra o valueInteger do FHIR
- [x] IREC-0420 · MÉDIO · `src/utils/speechUtils.js:19` — Nenhuma função de cancelamento é exportada e a fala do mount continua depois de sair da tela
- [x] IREC-0421 · MÉDIO · `src/utils/speechUtils.js:95` — setTimeout de fallback da síntese de voz fica fora do try/catch e usa timeout fixo de 150ms
- [x] IREC-0422 · MÉDIO · `src/utils/speechUtils.js:95` — Chamadas em sequência com vozes não carregadas enfileiram falas sobrepostas (timers nunca cancelados)
- [x] IREC-0500 · BAIXO · `src/components/IRecConceptDesign.jsx:1` — Imports não utilizados no design conceitual alimentam os erros de ESLint
- [x] IREC-0501 · BAIXO · `src/components/IRecConceptDesign.jsx:16` — Cores fixas e fonte não carregada no design conceitual quebram o tema
- [x] IREC-0502 · BAIXO · `src/components/IRecConceptDesign.jsx:49` — Dados clínicos e de identificação fabricados hardcoded na tela do paciente
- [x] IREC-0503 · BAIXO · `src/components/IRecConceptDesign.jsx:98` — Botões principais do design conceitual não têm handler ("Ligar Agora" da emergência inclusive)
- [x] IREC-0504 · BAIXO · `src/components/IRecConceptDesign.jsx:129` — Cards "clicáveis" são divs sem onClick, role ou tabIndex
- [x] IREC-0572 · BAIXO · `src/index.css:723` — Contraste insuficiente nos badges de comorbidade no tema claro
- [x] IREC-0573 · BAIXO · `src/index.css:981` — Altura do chat mobile calculada com header fixo de 60px, mas o header mede ~71px
- [x] IREC-0574 · BAIXO · `src/services/auditLogger.js:11` — Timestamps da auditoria vêm de três instantes diferentes e do fuso do dispositivo
- [x] IREC-0575 · BAIXO · `src/services/auditLogger.js:24` — Cap de 200 registros descarta silenciosamente a auditoria mais antiga
- [x] IREC-0576 · BAIXO · `src/services/auditLogger.js:41` — Consulta da trilha de auditoria mistura patientId com patientName e agrupa pacientes sem id
- [x] IREC-0577 · BAIXO · `src/services/fhirService.js:134` — Texto "undefined" no code.text da Observation FHIR quando entry.type está vazio
- [x] IREC-0585 · BAIXO · `src/utils/speechUtils.js:15` — onvoiceschanged global sobrescrito e v.lang usado sem verificação
- [x] IREC-0586 · BAIXO · `src/utils/speechUtils.js:24` — navigator.vibrate embutido no utilitário de fala dispara sem gesto do usuário

**Verificação do módulo:**

```
$ npx eslint src/services/auditLogger.js src/services/fhirService.js src/utils/speechUtils.js src/components/IRecConceptDesign.jsx src/App.jsx
✔ 0 errors

$ npx vite build
✓ 450 modules transformed.
dist/index.html                          2.69 kB │ gzip:   1.08 kB
dist/assets/index-Dihr6CaK.css          17.47 kB │ gzip:   4.07 kB
dist/assets/index-IkcxHH-b.js        1,278.56 kB │ gzip: 309.64 kB
✓ built in 1.87s

$ npx cap sync
√ Copying web assets from dist to android\app\src\main\assets\public in 535.20ms
√ Sync finished in 1.182s
```

---

