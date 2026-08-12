# 14. Área administrativa

**37 defeitos** — 1 crítico · 13 alto · 10 médio · 13 baixo

Arquivos tocados por este módulo:

- `src/components/AdminDashboard.jsx`
- `src/components/AdminPartners.jsx`
- `src/components/AdminReports.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0004 · CRÍTICO · `CONFIRMADO`

**Tabela LGPD renderiza objeto JSON direto como filho React e quebra a aba Seguranca**

**Onde:** `src/components/AdminReports.jsx:703`

**O defeito:** A celula 'Detalhes do Evento' renderiza `log.details` diretamente. O gravador real de logs (`createAuditLog` em src/services/supabaseService.js:333) sempre grava `details` como OBJETO (`{ patient_name: ... }`, `{ fields_updated: [...] }`, `{ entry_id, entry_type }` - vide chamadas nas linhas 629, 739 e 1075 do servico). Renderizar um objeto como filho React lanca 'Objects are not valid as a React child'. Note que o AdminDashboard trata isso corretamente com `JSON.stringify(log.details)` (AdminDashboard.jsx:985), mas o AdminReports nao.

**Como falha:** Admin abre 'admin-reports' -> clica na categoria '🔒 Seguranca & LGPD'. Se existir ao menos um registro em audit_logs cuja acao contenha VIEW/ACCESS/DOWNLOAD/LOGIN (ex.: 'VIEW_PATIENT_RECORD', gravado toda vez que um medico abre um prontuario), o React lanca 'Objects are not valid as a React child (found: object with keys {patient_name})' e toda a arvore do painel administrativo desmonta -> tela branca. O relatorio de conformidade LGPD fica permanentemente inacessivel exatamente quando ha acessos a prontuario para auditar.

**Código atual:**

```jsx
<td style={{ padding: '8px', color: 'var(--text-primary)', fontWeight: '500' }}>
  {log.details || 'Consulta de dados confidenciais pelo profissional.'}
</td>
```

**Correção sugerida:** Renderizar {typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || 'Consulta de dados confidenciais pelo profissional.')}, como ja e feito em AdminDashboard.jsx:985.

<details><summary>Verificação feita contra o código</summary>

A celula realmente faz {log.details || '...'} sem serializar. Os logs vem de getAuditLogs() com .select('*') da tabela audit_logs (supabaseService.js:2595-2611) e TODOS os gravadores desse caminho passam details como objeto: {patient_name} (629), {fields_updated} (739), {entry_id, entry_type} (1075), alem de DoctorDashboard 311/504/511/594. Objeto vazio {} tambem e truthy, entao o fallback nao protege. Nao existe nenhum ErrorBoundary no projeto (grep por componentDidCatch/getDerivedStateFromError: zero ocorrencias), logo o throw derruba a arvore inteira do admin (tela branca). Vale apenas no modo Supabase: com isSupabaseConfigured=false, getAuditLogs retorna [] e createAuditLog e no-op, entao a tabela fica vazia e nao quebra. Como o modo real de producao e o Supabase, mantenho critico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0045 · ALTO · `CONFIRMADO`

**Logs de auditoria nunca aparecem: escrita em localStorage e leitura na tabela audit_logs**

**Onde:** `src/components/AdminDashboard.jsx:51`

**O defeito:** O painel le os logs por `getAuditLogs()`, que consulta a tabela Supabase `audit_logs` e, quando o Supabase nao esta configurado, retorna `[]` de forma incondicional (supabaseService.js:2596-2598). Ja o servico de auditoria LGPD `src/services/auditLogger.js` grava exclusivamente em localStorage na chave `irec_log_acessos_prontuario` (linhas 3 e 25), com campos totalmente diferentes (`timestamp`, `clinicianId`, `patientId`) dos consumidos aqui (`created_at`, `user_id`). Componentes reais gravam por esse caminho (BookingModal.jsx:81-82, ClinicalHistory.jsx:129 e 164). Nao existe ponte entre os dois armazenamentos.

**Como falha:** App rodando em modo contingencia local (supabase === null). Medicos abrem prontuarios e emitem receitas durante um mes, gerando 200 registros em `irec_log_acessos_prontuario`. Admin abre 'admin-logs' e ve 'Nenhum log de auditoria registrado no banco de dados' e o Ranking de Atividades vazio; o 'Relatorio 11: Auditoria de Acessos a Prontuarios (Conformidade LGPD)' tambem aparece vazio. A promessa de rastreabilidade LGPD do sistema fica quebrada exatamente na tela feita para comprova-la.

**Código atual:**

```jsx
const [statsData, usersData, logsData, partnersData, callsData, assignmentsData, woundEntriesData, trainingData] = await Promise.all([
  getAdminStats(),
  getAllProfiles(),
  getAuditLogs(),
```

**Correção sugerida:** Fazer getAuditLogs ler e normalizar irec_log_acessos_prontuario no modo local, e unificar os dois createAuditLog num unico gravador.

<details><summary>Verificação feita contra o código</summary>

getAuditLogs (supabaseService.js:2595-2598) retorna [] incondicionalmente quando !isSupabaseConfigured, que e o estado atual do repositorio (.env vazio) - logo o painel 'admin-logs' e o ranking ficam sempre vazios, exatamente como no cenario. Ressalva a descricao: nao e verdade que os componentes gravem so via auditLogger - AIChatAssistant, DoctorDashboard e TCLETelemedicineModal usam supabaseService.createAuditLog (tabela audit_logs). O que de fato nunca chega ao painel, em nenhum modo, sao os logs LGPD de acesso a prontuario gravados por auditLogger.js em irec_log_acessos_prontuario (BookingModal.jsx:81, ClinicalHistory.jsx:129 e 164). Os dois problemas juntos sustentam o achado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0046 · ALTO · `CONFIRMADO`

**AdminDashboard carrega perfis, logs e prontuarios sem nenhuma verificacao de papel do usuario**

**Onde:** `src/components/AdminDashboard.jsx:74`

**O defeito:** O `useEffect` chama `loadData()` no mount sem receber nem consultar o usuario logado - o componente nao possui prop `currentUser` e nao faz nenhuma checagem de papel. E o switch do App.jsx que renderiza os cases 'admin-*' tambem NAO envolve os cases em nenhum teste `isAdmin` (App.jsx:848-861), enquanto o activeTab e inicializado diretamente a partir do hash da URL (App.jsx:37-43). O unico filtro de privacidade presente e cosmetico e no cliente: `if (u.email === 'admin@irec.com') return false` (linha 133), que apenas esconde o proprio admin da lista.

**Como falha:** Um paciente autenticado edita a URL para '#admin-users' e recarrega. O AdminDashboard monta, dispara `getAllProfiles()`, `getAuditLogs()`, `getAdminWoundEntries()` e `getAdminTelemedicineCalls()`, e o paciente passa a ver nome, e-mail, CRM, especialidade e cidade/estado de todos os medicos, enfermeiros e pacientes da plataforma, alem dos logs de auditoria com user_id e detalhes de prontuario ('admin-logs'). Se o RLS do Supabase nao bloquear, ha vazamento de dados clinicos e PII entre papeis.

**Código atual:**

```jsx
useEffect(() => {
  loadData();
}, []);
```

**Correção sugerida:** Envolver o grupo de cases 'admin-*' em App.jsx com if (!isAdmin) return <AccessDenied/> e passar currentUser ao AdminDashboard para bloquear loadData quando o papel nao for admin.

<details><summary>Verificação feita contra o código</summary>

Verificado: AdminDashboard nao recebe currentUser e o useEffect (74-76) dispara loadData() no mount sem qualquer checagem. Em App.jsx, isAdmin so existe nas linhas 908 (ramo default), 1087, 1393, 1499 e 1741 - os cases 'admin-*' (848-861) nao tem gate algum, e activeTab e inicializado direto do hash da URL (App.jsx:37-43). Logo, um paciente autenticado que navegue para #admin-users monta o painel e dispara getAllProfiles/getAuditLogs/getAdminWoundEntries/getAdminTelemedicineCalls. O unico filtro presente e cosmetico (linha 133, esconde admin@irec.com). O RLS do Supabase pode mitigar em producao, mas a autorizacao no cliente esta ausente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0047 · ALTO · `CONFIRMAR-SCHEMA`

**Cadastro de parceiro envia texto no campo price, que e numeric(10,2) no banco**

**Onde:** `src/components/AdminDashboard.jsx:90`

**O defeito:** O payload envia `price: partPrice || 'A consultar'`, e o placeholder do proprio formulario instrui 'Ex: R$ 52,00' (linha 1230). A coluna real e `price numeric(10,2)` (clean_database_v5.sql:17). Qualquer string nao numerica ('A consultar', 'R$ 52,00', '40-60') faz o Postgres retornar erro 22P02 (invalid input syntax for type numeric). `addRecommendedMaterial` re-lanca o erro (supabaseService.js:2568), o catch mostra apenas um alert genérico e o parceiro nunca e criado. Com o campo Preco vazio o erro e garantido, porque o fallback 'A consultar' e sempre texto.

**Como falha:** Admin abre 'admin-partners' -> '➕ Cadastrar Parceiro iRec' -> preenche Nome, Rede de Farmacias e Link, deixa 'Preco Sugerido' em branco (campo opcional, sem asterisco) -> clica 'Cadastrar Parceiro'. O modal exibe 'Erro ao cadastrar parceiro iRec.' e nenhum parceiro e salvo. Se o admin seguir o placeholder e digitar 'R$ 52,00', falha igualmente. So funciona digitando um numero puro, o que nada na UI indica.

**Código atual:**

```jsx
const payload = {
  name: partName,
  brand: partBrand || 'Genérico/Outros',
  price: partPrice || 'A consultar',
  affiliate_link: partLink,
```

**Correção sugerida:** Enviar price: partPrice ? Number(String(partPrice).replace(/[^0-9,.]/g,'').replace(',','.')) : null e validar numericamente no formulario.

<details><summary>Verificação feita contra o código</summary>

Verificado: AdminDashboard.jsx:90 envia price: partPrice || 'A consultar' e clean_database_v5.sql:17 declara price numeric(10,2). addRecommendedMaterial (supabaseService.js:2557-2569) faz insert direto e re-lanca o erro; handleAddPartner so exibe alert('Erro ao cadastrar parceiro iRec.'). Com o campo vazio a falha e garantida em modo Supabase, pois o fallback e sempre a string 'A consultar'. Hoje, em modo local (isSupabaseConfigured=false), o insert vai para localStorage e nao falha - por isso o defeito e latente, mas real assim que o .env for preenchido.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0048 · ALTO · `CONFIRMADO`

**Fluxo de aprovacao de medicos pendentes nunca renderizado; callback onVerificationProcessed jamais chamado**

**Onde:** `src/components/AdminDashboard.jsx:129`

**O defeito:** O componente calcula `pendingClinicians` (medicos com verificationStatus 'pending'), importa `updateVerificationStatus` (linha 2) e recebe a prop `onVerificationProcessed`, mas nenhum dos tres e usado em nenhum ponto do JSX ou dos handlers - confirmado por grep no arquivo inteiro (unicas ocorrencias: linhas 2, 6 e 129). O App.jsx passa `onVerificationProcessed={fetchPendingCount}` (App.jsx:859) e mantem um contador de pendencias recalculado a cada mudanca de aba (App.jsx:110-124), contador que nunca pode ser zerado porque nao existe UI de aprovacao/rejeicao.

**Como falha:** Um medico se cadastra e envia o documento profissional; seu perfil fica com verification_status='pending'. O admin faz login, ve o badge de pendencias, entra em 'admin-users' e encontra o medico listado como um card comum, sem qualquer botao 'Aprovar' ou 'Rejeitar' e sem indicacao do status de verificacao. Nao existe nenhuma tela no painel capaz de chamar `updateVerificationStatus`, portanto o medico permanece 'pending' para sempre e o badge de pendencias nunca desaparece.

**Código atual:**

```jsx
const pendingClinicians = users.filter(u => u.role === 'doctor' && u.verificationStatus === 'pending');
```

**Correção sugerida:** Renderizar na aba de usuarios um bloco de pendingClinicians com botoes Aprovar/Rejeitar que chamem updateVerificationStatus e depois onVerificationProcessed().

<details><summary>Verificação feita contra o código</summary>

Grep no arquivo inteiro confirma: updateVerificationStatus so aparece no import (linha 2), onVerificationProcessed so na assinatura (linha 6) e pendingClinicians so na linha 129 - nenhum deles e usado no JSX ou em handler. App.jsx:859 passa onVerificationProcessed={fetchPendingCount}, que nunca sera invocado, logo o badge de pendencias nao tem como ser zerado pelo painel. Medico verificado fica 'pending' indefinidamente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0049 · ALTO · `CONFIRMADO`

**Filtro de periodo personalizado usa fuso UTC no inicio e fuso local no fim (limites assimetricos)**

**Onde:** `src/components/AdminDashboard.jsx:168`

**O defeito:** `new Date(startDate)` com string no formato 'yyyy-mm-dd' e interpretado pela especificacao como meia-noite UTC. Ja o limite final e construido com `new Date(endDate)` seguido de `setHours(23,59,59,999)`, que opera em horario LOCAL. Em UTC-3 (Brasil) isso significa que o limite inferior real e 21:00 do dia ANTERIOR ao startDate, enquanto o superior e 23:59 local do endDate. O DateRangePicker, por sua vez, formata o rotulo com `new Date(dateStr + 'T00:00:00')` (DateRangePicker.jsx:96), ou seja, meia-noite local - a UI promete um intervalo diferente do aplicado.

**Como falha:** Admin em Sao Paulo seleciona o intervalo 10/03 a 10/03 (um unico dia) no seletor de datas. Alem das chamadas do dia 10/03, o painel tambem conta todas as teleconsultas, logs e evolucoes registradas entre 21:00 e 23:59 do dia 09/03. O total do dia fica inflado e nao fecha com o relatorio de nenhum outro dia, produzindo divergencia de faturamento/conformidade que o admin nao consegue reconciliar.

**Código atual:**

```jsx
const callDate = new Date(c.created_at || c.createdAt);
if (startDate && new Date(startDate) > callDate) return false;
if (endDate) {
  const endLimit = new Date(endDate);
  endLimit.setHours(23, 59, 59, 999);
```

**Correção sugerida:** Construir ambos os limites em horario local: new Date(startDate + 'T00:00:00') e new Date(endDate + 'T23:59:59.999').

<details><summary>Verificação feita contra o código</summary>

Confirmado nas tres copias do bloco custom (166-195): new Date('yyyy-mm-dd') e meia-noite UTC, enquanto endLimit.setHours(23,59,59,999) opera em horario local. O defeito e ate pior que o descrito: em UTC-3, para startDate=endDate=10/03, o limite inferior e 09/03 21:00 local e o superior vira 09/03 23:59 local (setHours atua sobre o dia 9 local), ou seja a janela cobre so a noite do dia 9 e exclui quase todo o dia 10. Divergencia real e nao reconciliavel pelo admin; o rotulo do DateRangePicker (linha 96, new Date(dateStr+'T00:00:00')) usa meia-noite local, contradizendo o filtro.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0050 · ALTO · `CONFIRMADO`

**Periodo '15d' oferecido pelo DateRangePicker nao existe no filtro e mostra todos os dados**

**Onde:** `src/components/AdminDashboard.jsx:197`

**O defeito:** `getFilteredDataByPeriod()` trata apenas '24h', '7d', '30d' e 'custom'; qualquer outro valor cai no `else` que devolve as listas COMPLETAS sem filtro. O DateRangePicker (src/components/DateRangePicker.jsx:58-62) oferece o preset 'Ultimos 15 dias' e executa `setTimePeriod('15d')` - valor que nenhum ramo trata. O rotulo do botao continua exibindo 'Ultimos 15 dias' (DateRangePicker.jsx:90), entao a UI afirma um recorte que nao foi aplicado.

**Como falha:** Admin abre 'admin-metrics', clica no seletor de datas e escolhe 'Ultimos 15 dias'. O botao passa a exibir 'Ultimos 15 dias', mas todos os cartoes (Atendimentos Ativos, Tempo Medio, Classificacao de Feridas, Ranking de Auditoria) e todos os 12 relatorios continuam somando o historico inteiro da plataforma, inclusive registros de anos anteriores. O admin compara esse numero com o de 'Ultimos 30 dias' e ve o periodo menor com valor maior ou igual, sem entender o motivo.

**Código atual:**

```jsx
} else {
  return { callsFiltered: calls, logsFiltered: logs, woundEntriesFiltered: woundEntries };
}
```

**Correção sugerida:** Adicionar o ramo '15d' (e '3m') com thresholdDate.setDate(now.getDate()-15) ou substituir a cadeia por um mapa periodo->dias.

<details><summary>Verificação feita contra o código</summary>

getFilteredDataByPeriod (143-200) trata apenas '24h', '7d', '30d' e 'custom'; o else da linha 197-199 devolve as listas completas. DateRangePicker.jsx:58-60 executa setTimePeriod('15d') e a linha 90 rotula o botao 'Ultimos 15 dias'. O rotulo afirma um recorte que nao e aplicado. Observacao: o preset '3m' (DateRangePicker.jsx:260) tende a cair na mesma armadilha, ampliando o defeito.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0051 · ALTO · `CONFIRMAR-SCHEMA`

**Contador de usuarios online usa campo inexistente (last_seen/lastSeen) e fica sempre em zero**

**Onde:** `src/components/AdminDashboard.jsx:215`

**O defeito:** `getActiveUsersStats()` le `u.last_seen || u.lastSeen`, mas `getAllProfiles()` (src/services/supabaseService.js:2647) expoe o campo com o nome `lastSeenAt` (mapeado de `last_seen_at`). Confirmei por grep que TODO o service layer usa `lastSeenAt` (linhas 562, 617, 1242, 1289, 1338, 1575, 1724, 1779, 2647); `last_seen` e `lastSeen` nao existem em nenhum lugar. No modo local (`getAllProfiles` linhas 2616-2625) o campo nao e devolvido de forma alguma. Portanto `new Date(undefined)` = Invalid Date, e `Invalid Date >= fifteenMinsAgo` e sempre `false`.

**Como falha:** Admin abre 'admin-metrics' com 40 usuarios ativos no momento (varios com last_seen_at atualizado ha 1 minuto). O cartao 'ATIVIDADE DA REDE (ONLINE)' exibe '0 / 40 usuarios' e 'Medicos: 0 | Enfermeiros: 0 | Pacientes: 0'. O admin conclui que a plataforma esta sem uso e o indicador de presenca fica inutil.

**Código atual:**

```jsx
if (!u.last_seen && !u.lastSeen) return false;
const lastSeenDate = new Date(u.last_seen || u.lastSeen);
return lastSeenDate >= fifteenMinsAgo;
```

**Correção sugerida:** Trocar por const ts = u.lastSeenAt || u.last_seen_at; if (!ts) return false; return new Date(ts) >= fifteenMinsAgo; e passar last_seen_at tambem no fallback local de getAllProfiles.

<details><summary>Verificação feita contra o código</summary>

Li getAllProfiles (supabaseService.js:2632-2650): o mapeamento Supabase expoe lastSeenAt (de last_seen_at) e o modo local (2616-2625) nem devolve o campo. AdminDashboard:213-217 testa u.last_seen || u.lastSeen, que nunca existem. Pequena imprecisao na descricao: a guarda da linha 214 evita o Invalid Date, mas o efeito e identico - o filtro retorna false para todos e onlineCount fica sempre 0, com o cartao de presenca inutil. Rebaixo de critico para alto porque e feature nao funcional, sem perda ou corrupcao de dado clinico.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0052 · ALTO · `CONFIRMAR-SCHEMA`

**Status online/offline dos profissionais depende do contador global e do campo inexistente last_seen**

**Onde:** `src/components/AdminDashboard.jsx:243`

**O defeito:** Dois defeitos na mesma expressao: (1) le novamente `u.last_seen || u.lastSeen`, campos que `getAllProfiles()` nunca devolve (o correto e `lastSeenAt`), de modo que `new Date(undefined)` gera Invalid Date e a comparacao e sempre false; (2) o operando `activeUserStats.onlineCount > 0 &&` faz o status INDIVIDUAL de cada profissional depender de um contador GLOBAL - mesmo que o campo fosse corrigido, se o contador global fosse 0 nenhum profissional apareceria online, e a checagem individual seria curto-circuitada.

**Como falha:** Admin abre 'admin-metrics' e rola ate '📊 Relatorio de Atendimentos por Profissional de Saude'. A coluna STATUS mostra a bolinha cinza (offline) para os 100% dos medicos e enfermeiros, inclusive para o profissional que esta naquele exato momento em uma teleconsulta ativa contada no cartao 'ATENDIMENTOS ATIVOS'. O admin nao consegue identificar quem esta disponivel para escalar atendimentos.

**Código atual:**

```jsx
const isOnline = activeUserStats.onlineCount > 0 && totalClinicalUsers.find(u => u.id === cli.id && (new Date(u.last_seen || u.lastSeen) >= new Date(Date.now() - 15 * 60 * 1000)));
```

**Correção sugerida:** Remover o prefixo do contador global e comparar com o campo correto: const isOnline = cli.lastSeenAt && new Date(cli.lastSeenAt) >= new Date(Date.now() - 15*60*1000).

<details><summary>Verificação feita contra o código</summary>

Linha 243 confere literalmente com a evidencia. Aqui, ao contrario da linha 214, nao ha guarda: new Date(u.last_seen || u.lastSeen) e sempre Invalid Date (o campo correto e lastSeenAt), e Invalid Date >= X e sempre false. Alem disso o prefixo activeUserStats.onlineCount > 0 faz o status individual depender do contador global (que, pelo item 61, e sempre 0), curto-circuitando a checagem. Os dois defeitos coexistem e todo profissional aparece offline.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0053 · ALTO · `CONFIRMADO`

**Mapeamento de Patologias nunca exibe nada: getAllProfiles descarta todos os campos de comorbidade**

**Onde:** `src/components/AdminDashboard.jsx:331`

**O defeito:** `getDynamicPathologiesStats()` depende de `has_diabetes/hasDiabetes`, `has_hypertension`, `has_venous_insufficiency`, `has_peripheral_arterial_disease`, `is_obese`, `is_smoker` e `other_conditions`. Porem `getAllProfiles()` (src/services/supabaseService.js:2632-2650) faz um mapeamento com whitelist explicita que devolve APENAS id, role, name, email, crm, specialty, rqe, birthDate, gender, healthUnit, phone, avatarUrl, city, state, lastSeenAt, verificationStatus e professionalDocumentUrl. Nenhum campo de comorbidade e repassado, apesar de existirem na tabela clinical_profile (confirmado em clean_database_v2.sql:15-22). No modo local (linhas 2616-2625) o mapeamento e ainda mais reduzido.

**Como falha:** Admin cadastra 200 pacientes, todos com diabetes e hipertensao marcados na ficha clinica, e abre 'admin-metrics'. O painel '🩺 Mapeamento Dinamico de Patologias & Comorbidades' mostra 'Nenhuma patologia identificada nos prontuarios dos pacientes cadastrados' e 'Base: 200 pacientes'. Os filtros de Estado/Cidade/Ordenacao ficam sem efeito. O recurso principal de inteligencia epidemiologica do painel nunca funciona.

**Código atual:**

```jsx
if (u.has_diabetes || u.hasDiabetes) {
  pathologyCounts['Diabetes Mellitus'] = (pathologyCounts['Diabetes Mellitus'] || 0) + 1;
}
if (u.has_hypertension || u.hasHypertension) {
```

**Correção sugerida:** Incluir hasDiabetes/hasHypertension/hasVenousInsufficiency/hasPeripheralArterialDisease/isObese/isSmoker/otherConditions (e city/state no modo local) no map de getAllProfiles.

<details><summary>Verificação feita contra o código</summary>

getAllProfiles (supabaseService.js:2632-2650) usa whitelist explicita e nao inclui nenhum campo de comorbidade; o fallback local (2616-2625) e ainda menor, sem nem city/state. getDynamicPathologiesStats (331-352) le has_diabetes/hasDiabetes, has_hypertension, ..., other_conditions - todos undefined. Portanto pathologyCounts fica sempre vazio e o painel exibe 'Nenhuma patologia identificada' independentemente da base. Rebaixo para alto: e um painel inteiro inoperante, mas nao gera dado clinico incorreto.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0054 · ALTO · `CONFIRMAR-SCHEMA`

**Relatorio de Retorno de Pacientes agrupa tudo sob chave undefined porque patient_id nao vem na consulta**

**Onde:** `src/components/AdminReports.jsx:49`

**O defeito:** `getPatientReturnStats()` agrupa por `entry.patient_id || entry.patientId`, mas `getAdminWoundEntries()` (src/services/supabaseService.js:2739) faz `.select('type, created_at')` - nao traz `patient_id`. Logo `pId` e sempre `undefined`, `counts` fica com uma unica chave 'undefined' contendo TODAS as evolucoes, e as metricas colapsam: totalPatientsWithEntries = 1 sempre; returnRate = 100% se houver >=2 registros no periodo, 0% se houver exatamente 1.

**Como falha:** Admin abre 'admin-reports' -> '🩺 Clinicos & Regiao'. Com 300 evolucoes de 250 pacientes distintos (a maioria com um unico registro), o 'Relatorio 2: Retorno de Pacientes' exibe '100%' de taxa de retorno, '1 pacientes enviaram 2 ou mais evolucoes' e '0 pacientes registraram apenas um evento isolado'. Metrica de fidelizacao completamente falsa e usada para decisao gerencial.

**Código atual:**

```jsx
woundEntriesFiltered.forEach(entry => {
  const pId = entry.patient_id || entry.patientId;
  counts[pId] = (counts[pId] || 0) + 1;
});
```

**Correção sugerida:** Incluir patient_id (e clinical_outcome) no .select() de getAdminWoundEntries.

<details><summary>Verificação feita contra o código</summary>

Confirmei getAdminWoundEntries com .select('type, created_at') (supabaseService.js:2739) e o prop woundEntriesFiltered vem exatamente dessa funcao (AdminDashboard.jsx:55 e 151). Nao ha guarda: pId e sempre undefined, counts vira {'undefined': N}, totalPatientsWithEntries=1 e returnRate=100% para N>=2. No modo local a falha e outra mas igualmente quebrada: getAdminWoundEntries le a chave 'irec_local_wound_entries', que nenhum codigo do projeto jamais escreve (as evolucoes locais sao salvas por saveLocalEntries com chave por paciente), entao o array e sempre vazio e o relatorio mostra 0%.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0055 · ALTO · `CONFIRMAR-SCHEMA`

**Relatorio de Altas Clinicas sempre 0% : campos patient_id e clinical_outcome ausentes na consulta**

**Onde:** `src/components/AdminReports.jsx:66`

**O defeito:** `getDischargeStats()` indexa `latestEntries` por `entry.patient_id || entry.patientId` e le `entry.clinical_outcome || entry.clinicalOutcome`. Nenhum dos dois vem de `getAdminWoundEntries()`, que seleciona apenas `type, created_at` (supabaseService.js:2739) - embora `clinical_outcome` seja coluna real (mapeada em supabaseService.js:890/1005). Resultado: `latestEntries` tem exatamente uma chave ('undefined'), `totalActiveCases` = 1, `outcome` e sempre undefined e o filtro de altas devolve lista vazia.

**Como falha:** Admin abre 'admin-reports' -> '🩺 Clinicos & Regiao'. Mesmo com 80 casos com alta clinica registrada, o 'Relatorio 3: Altas Clinicas por Periodo' mostra '0%' de taxa de resolucao, '0 acompanhamentos finalizados com alta clinica' e '1 pacientes continuam em tratamento ativo'. O indicador de desfecho clinico e sempre zero, dando a impressao de que o servico nunca resolve casos.

**Código atual:**

```jsx
if (!latestEntries[pId] || new Date(entry.created_at) > new Date(latestEntries[pId].created_at)) {
  latestEntries[pId] = entry;
}
```

**Correção sugerida:** Adicionar patient_id e clinical_outcome ao .select() de getAdminWoundEntries (supabaseService.js:2739).

<details><summary>Verificação feita contra o código</summary>

Mesma consulta truncada .select('type, created_at'). clinical_outcome existe de fato como coluna (mapeada em supabaseService.js:890 e gravada em 1005), mas nao e selecionada. Logo latestEntries tem uma unica chave 'undefined', totalActiveCases=1, outcome e sempre undefined e o filtro de altas devolve lista vazia: exibe 0% de resolucao e '1 pacientes continuam em tratamento ativo' mesmo com dezenas de altas registradas. Nenhuma guarda intermediaria.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0056 · ALTO · `CONFIRMADO`

**NPS e avaliacoes de satisfacao fabricados a partir do indice da chamada**

**Onde:** `src/components/AdminReports.jsx:122`

**O defeito:** `getNpsStats()` atribui estrelas por `(idx % 8 === 0) ? 3 : (idx % 12 === 0) ? 4 : 5`, isto e, pela posicao da chamada no array, e nao por qualquer avaliacao de paciente (nenhum campo de rating e lido de `c`). O resultado e apresentado na UI como 'Score Net Promoter' e '(N avaliacoes)', sugerindo dados reais de satisfacao. Alem disso o ramo `idx % 12 === 0` e praticamente inalcancavel, porque todo multiplo de 12 que tambem e multiplo de 8... na verdade idx=12 nao e multiplo de 8, mas idx=0 e 24 e 48 caem no primeiro ramo - a formula produz sempre a mesma proporcao fixa de ~12,5% detratores.

**Como falha:** Admin abre 'admin-reports' -> '📞 Telemedicina & Fila'. Com 40 chamadas concluidas e zero avaliacoes coletadas de pacientes (o sistema nao possui tela de avaliacao), o cartao mostra '+75 Score Net Promoter', '4.7 / 5.0' e '(40 avaliacoes)', alem do rodape '💚 Zona de Excelencia ativa'. O admin reporta a diretoria um NPS que nunca foi medido.

**Código atual:**

```jsx
completedCalls.forEach((c, idx) => {
  const stars = (idx % 8 === 0) ? 3 : (idx % 12 === 0) ? 4 : 5;
  totalStars += stars;
  if (stars === 5) promoters++;
```

**Correção sugerida:** Ler rating real da chamada (ou exibir 'sem avaliacoes coletadas') em vez de derivar estrelas do indice.

<details><summary>Verificação feita contra o código</summary>

Linhas 121-126 confirmam stars = (idx%8===0)?3:(idx%12===0)?4:5, sem ler nenhum campo de avaliacao do objeto c. O resultado alimenta score, avgStars e totalRated exibidos na UI como 'Score Net Promoter', 'X / 5.0' e '(N avaliacoes)' (418-425), com rodape fixo 'Zona de Excelencia ativa' (429). Nao existe nenhuma tela de avaliacao no fluxo, entao o numero e integralmente fabricado e apresentado como dado de satisfacao real.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0057 · ALTO · `CONFIRMAR-SCHEMA`

**Valores financeiros de comissao por medico calculados a partir do indice do array**

**Onde:** `src/components/AdminReports.jsx:183`

**O defeito:** `getDoctorCommissionReport()` deriva a quantidade de prescricoes de `4 + (idx * 3) % 7` - ou seja, da POSICAO do medico no array `doctors`, nao de nenhum dado real de recomendacao ou venda. A partir disso multiplica por R$ 85,00 e aplica 10% para produzir a coluna 'A Repassar (10%)'. Nao existe nenhuma fonte de dados de vendas envolvida; o valor a pagar muda apenas porque a ordem dos perfis retornados pelo Supabase mudou (o `.select('*')` de getAllProfiles nao tem `order`).

**Como falha:** Admin abre 'admin-reports' -> '💼 Comercial & Afiliados' e usa a tabela 'Relatorio 10: Comissao de Afiliados a Pagar por Medico' para pagar os medicos. Um medico que nunca recomendou nada aparece com 'R$ 34,00 a repassar'. Ao recarregar a pagina, se o banco devolver os perfis em outra ordem, o mesmo medico passa a aparecer com 'R$ 85,00'. O painel apresenta valores monetarios a pagar que sao pura funcao do indice do array.

**Código atual:**

```jsx
return doctors.map((doc, idx) => {
  const recommendationsCount = 4 + (idx * 3) % 7; 
  const totalSalesValue = recommendationsCount * 85.00;
  const commissionValue = totalSalesValue * 0.10; // 10% repasse
```

**Correção sugerida:** Calcular a partir de dados reais de recomendacao/venda ou remover o relatorio ate existir a fonte de dados, nunca derivar valor monetario do indice.

<details><summary>Verificação feita contra o código</summary>

Linhas 181-195 confirmam: recommendationsCount = 4 + (idx*3)%7, sales = count*85.00, commission = sales*0.10, sem consultar nenhuma prescricao, assignment ou venda. O valor e renderizado na coluna 'A Repassar (10%)' com R$ e duas casas (linha 588) sob o titulo 'Comissao de Afiliados a Pagar por Medico' e o subtitulo 'Consolidado das comissoes obtidas a partir de vendas convertidas' (566), ou seja, apresentado como valor financeiro real. getAllProfiles usa .select('*') sem order, entao a ordem (e o valor devido) pode mesmo variar entre cargas.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0213 · MÉDIO · `CONFIRMADO`

**Falha em qualquer uma das 8 cargas zera o painel inteiro sem avisar o admin**

**Onde:** `src/components/AdminDashboard.jsx:68`

**O defeito:** `loadData()` usa `Promise.all` com 8 chamadas e um unico bloco try. Como todos os `setX()` ficam depois do await, se UMA promessa rejeitar nenhum estado e atualizado e o catch apenas faz `console.error` - nao ha `setError` nem qualquer feedback na tela. Varias dessas funcoes fazem `JSON.parse(localStorage...)` FORA do try interno e podem lancar (supabaseService.js:2699, 2717, 2734, 2967, 2494), assim como `getRecommendedMaterials` no modo local.

**Como falha:** A chave localStorage 'irec_local_calls' fica corrompida (escrita parcial, aba fechada no meio de um setItem). Admin abre 'admin-metrics': o spinner 'Carregando dados...' desaparece normalmente e o painel exibe 0 usuarios online, 0 atendimentos, 'Nenhuma patologia identificada', 'Nenhum profissional de saude cadastrado no sistema' e 'Nenhum log de auditoria'. Nada indica erro; o admin conclui que perdeu a base de dados.

**Código atual:**

```jsx
} catch (e) {
  console.error("Erro ao carregar dados do admin:", e);
} finally {
  setLoading(false);
}
```

**Correção sugerida:** Trocar por Promise.allSettled com fallback por chamada e adicionar um estado de erro exibido no topo do painel.

<details><summary>Verificação feita contra o código</summary>

loadData (45-72) tem um unico try com Promise.all de 8 chamadas e todos os setters apos o await; o catch (67-68) so faz console.error, sem setError nem feedback. E os fallbacks locais realmente fazem JSON.parse fora de qualquer try: getAdminTelemedicineCalls:2699, getAdminAssignments:2717, getAdminWoundEntries:2734, getTrainingKnowledgeList:2967, getAdminStats:2660-2661. Um item de localStorage corrompido rejeita a Promise.all e o painel aparece integralmente vazio, sem sinal de erro.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0214 · MÉDIO · `CONFIRMADO`

**Alerta de sucesso na edicao de capitulo clinico e exibido mesmo quando nada foi salvo**

**Onde:** `src/components/AdminDashboard.jsx:1067`

**O defeito:** O handler ignora o valor de retorno de `updateTrainingKnowledgeChapter`, que no modo local retorna `false` quando o id nao e encontrado, sem lancar excecao (supabaseService.js:2986-2993). Como nenhuma excecao ocorre, o fluxo segue para `alert('Capitulo clinico atualizado com sucesso!')` na linha 1071. O mesmo vale para `deleteTrainingKnowledgeChapter` (linha 1144), que sempre retorna true no modo local mesmo sem remover nada.

**Como falha:** Admin abre 'admin-curatoria' em modo contingencia local, edita as diretrizes clinicas de um capitulo e clica 'Salvar Alteracoes'. Se o registro tiver sido removido/reindexado por outra aba (id nao encontrado), o servico retorna false, o formulario fecha, o alert 'Capitulo clinico atualizado com sucesso!' aparece, e apos o loadData o conteudo antigo volta. O admin acredita que a base de conhecimento da IA foi atualizada quando nao foi.

**Código atual:**

```jsx
await updateTrainingKnowledgeChapter(selectedChapter.id, editCategory, editContent);
setIsEditingChapter(false);
setSelectedChapter(null);
await loadData();
alert('Capítulo clínico atualizado com sucesso!');
```

**Correção sugerida:** Capturar o retorno (const ok = await updateTrainingKnowledgeChapter(...)) e exibir alerta de falha quando ok for false, sem fechar o formulario.

<details><summary>Verificação feita contra o código</summary>

O handler das linhas 1064-1077 ignora o retorno de updateTrainingKnowledgeChapter, que no modo local retorna false quando o id nao e encontrado (supabaseService.js:2986-2993) sem lancar - o fluxo segue e o alert de sucesso da linha 1071 aparece. Mesmo padrao em deleteTrainingKnowledgeChapter (2009-3014), que retorna true no modo local mesmo sem remover nada (linha 1144-1146). O admin recebe confirmacao falsa de que a base RAG da IA foi atualizada. Rebaixo? Nao: medio e proporcional, pois o dado exibido depois do loadData contradiz o alert.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0215 · MÉDIO · `CONFIRMADO`

**AdminPartners.jsx e codigo morto: case 'admin-partners' duplicado no switch do App.jsx**

**Onde:** `src/components/AdminPartners.jsx:4`

**O defeito:** O switch de `renderContent()` (src/App.jsx:741) declara `case 'admin-partners'` duas vezes: na linha 852 (agrupado com os demais cases que renderizam `<AdminDashboard .../>`) e novamente na linha 872 (`return <AdminPartners setActiveTab={setActiveTab} />`). Em JavaScript o primeiro case correspondente vence, portanto a linha 873 e inalcancavel e o componente AdminPartners NUNCA e montado. Todo o arquivo (formulario, lista, validacao, mensagens) esta morto, e qualquer correcao feita nele nao tem efeito no produto.

**Como falha:** Admin clica em 'Parceiros' no menu -> activeTab='admin-partners' -> App.jsx casa na linha 852 e renderiza a aba 'partners' do AdminDashboard (layout de cards com botao '➕ Cadastrar Parceiro iRec' em modal), nunca a tela de AdminPartners (layout de duas colunas com formulario lateral). O admin nunca ve a tela projetada neste arquivo, e o bug de tipo do campo 'price' corrigido aqui continuaria quebrado na tela realmente usada.

**Código atual:**

```jsx
// src/App.jsx:852  ->  case 'admin-partners':  (dentro do grupo que retorna <AdminDashboard/>)
// src/App.jsx:872-873 (INALCANCAVEL):
//   case 'admin-partners':
//     return <AdminPartners setActiveTab={setActiveTab} />;
export default function AdminPartners({ setActiveTab }) {
```

**Correção sugerida:** Remover o case duplicado da linha 872-873 e, se AdminPartners nao for mais a tela desejada, excluir o arquivo; caso seja, tirar 'admin-partners' do grupo da linha 852.

<details><summary>Verificação feita contra o código</summary>

Confirmado em App.jsx: case 'admin-partners' aparece na linha 852 dentro do grupo que retorna <AdminDashboard .../> e de novo na linha 872-873 retornando <AdminPartners/>. O primeiro case vence, entao AdminPartners nunca e montado - arquivo inteiro morto (o ESLint ja acusa no-duplicate-case em App.jsx:872). Rebaixo para medio: nao ha dano ao usuario final (o AdminDashboard cobre a mesma funcao); o risco e de manutencao, com correcoes aplicadas em tela que nunca renderiza.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0216 · MÉDIO · `CONFIRMAR-SCHEMA`

**Relatorio de epidemiologia sempre com zeros de comorbidade e uma unica localidade generica**

**Onde:** `src/components/AdminReports.jsx:34`

**O defeito:** Mesma causa raiz do defeito do mapeamento de patologias: `getEpidemiologyData()` le `p.hasDiabetes || p.has_diabetes`, `p.hasHypertension`, `p.isObese` e `p.isSmoker`, campos que `getAllProfiles()` nunca devolve (mapeamento com whitelist em supabaseService.js:2632-2650). Adicionalmente, no modo contingencia local o mapeamento (linhas 2616-2625) tambem omite `city` e `state`, entao todo paciente cai na chave 'SEM ESTADO - Sem Cidade'.

**Como falha:** Admin abre 'admin-reports' -> '🩺 Clinicos & Regiao' com 150 pacientes cadastrados em 12 municipios, muitos diabeticos e hipertensos. No modo local a tabela 'Perfil Epidemiologico por Regiao' mostra uma unica linha 'SEM ESTADO - Sem Cidade | 150 | 0 | 0 | 0 | 0'. No modo Supabase as cidades aparecem, mas as quatro colunas de comorbidade permanecem zeradas em todas as linhas.

**Código atual:**

```jsx
geoGroups[key].total++;
if (p.hasDiabetes || p.has_diabetes) geoGroups[key].diabetes++;
if (p.hasHypertension || p.has_hypertension) geoGroups[key].hypertension++;
```

**Correção sugerida:** Incluir city, state e as colunas de comorbidade nos mapeamentos de getAllProfiles (ambos os modos) ou remover as colunas nao suportadas da tabela.

<details><summary>Verificação feita contra o código</summary>

Confirmei que o prop users vem de getAllProfiles (AdminDashboard.jsx:50). O mapeamento Supabase (2632-2650) e uma whitelist que inclui city e state mas nao inclui nenhum campo de comorbidade, e o mapeamento local (2616-2625) omite city, state e as comorbidades. Logo, no modo Supabase as quatro colunas (diabetes, hipertensao, obesidade, tabagismo) ficam zeradas em todas as linhas, e no modo local tudo colapsa na chave 'SEM ESTADO - Sem Cidade'. A tabela e renderizada como 'Perfil Epidemiologico por Regiao' com essas colunas (300-321), apresentando zeros como dado apurado. Elevo de baixo para medio: sao zeros exibidos como fato epidemiologico.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0217 · MÉDIO · `CONFIRMADO`

**Tempo medio de espera na fila e uma formula inventada que DIMINUI conforme a demanda cresce**

**Onde:** `src/components/AdminReports.jsx:92`

**O defeito:** `getEstimatedWaitTime()` nao mede tempo algum: parte de uma constante 4.2 e subtrai 0.05 por chamada existente, com piso em 1.5. A logica esta invertida em relacao ao mundo real (mais demanda deveria aumentar, nao reduzir, o tempo de fila) e, a partir de 54 chamadas no periodo, o resultado fica travado em '1.5' para sempre. Ainda assim o texto da UI afirma ser o 'Tempo medio estimado decorrido desde a solicitacao do paciente na fila ate o efetivo atendimento' e e comparado a uma meta da ANS.

**Como falha:** Admin abre 'admin-reports' -> '📞 Telemedicina & Fila'. Em um mes de pico com 500 teleconsultas, o 'Relatorio 4' exibe '1.5 minutos em fila' com o selo '🎯 Meta ideal recomendada pela ANS: < 15.0 minutos'. Em um mes fraco com 5 chamadas, exibe '4.0 minutos'. O indicador melhora justamente quando a fila piora, e o admin reporta conformidade com a ANS baseado em um numero que nao mede espera.

**Código atual:**

```jsx
const baseWait = 4.2; 
const wait = Math.max(1.5, baseWait - (callCount * 0.05));
return wait.toFixed(1);
```

**Correção sugerida:** Calcular a diferenca real entre created_at e answered_at/started_at das chamadas, ou ocultar o cartao enquanto esse dado nao existir.

<details><summary>Verificação feita contra o código</summary>

Linhas 87-94 confirmam baseWait=4.2 menos 0.05 por chamada, com piso 1.5, sem ler nenhum timestamp de entrada na fila versus atendimento. A UI descreve o numero como 'Tempo medio estimado decorrido desde a solicitacao do paciente na fila ate o efetivo atendimento' (403) e o compara com a meta da ANS (407), tratando-o como indicador de conformidade. A inversao e o travamento em 1.5 a partir de 54 chamadas sao aritmeticamente corretos conforme descrito.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0218 · MÉDIO · `CONFIRMADO`

**Retorno antecipado do NPS omite totalRated e a tela mostra '(undefined avaliacoes)'**

**Onde:** `src/components/AdminReports.jsx:114`

**O defeito:** Quando nao ha chamadas concluidas, `getNpsStats()` retorna `{ score: 0, promoters: 0, detractors: 0, avgStars: 4.8 }` - sem a chave `totalRated` presente no retorno normal (linha 130). O JSX da linha 425 renderiza `({nps.totalRated} avaliacoes)`, produzindo o texto literal 'undefined' para o usuario. Alem disso o `avgStars: 4.8` fixo faz o cartao exibir nota 4.8/5.0 sem nenhuma avaliacao existente.

**Como falha:** Plataforma recem-implantada, sem nenhuma teleconsulta concluida. Admin abre 'admin-reports' -> '📞 Telemedicina & Fila' e le no 'Relatorio 6': '★★★★★ 4.8 / 5.0 (undefined avaliacoes)'. Texto quebrado visivel ao usuario e nota de satisfacao inventada em base zero.

**Código atual:**

```jsx
if (completedCalls.length === 0) return { score: 0, promoters: 0, detractors: 0, avgStars: 4.8 };
```

**Correção sugerida:** Retornar totalRated: 0 e avgStars: '0.0' no early return, e exibir 'sem avaliacoes' quando totalRated for 0.

<details><summary>Verificação feita contra o código</summary>

Linha 114 retorna { score, promoters, detractors, avgStars: 4.8 } sem totalRated, enquanto o retorno normal (linha 130) inclui a chave. A linha 425 renderiza '({nps.totalRated} avaliacoes)' sem optional chaining nem default, produzindo o texto literal 'undefined'. O caso e trivialmente alcancavel (nenhuma teleconsulta com status completed/finished no periodo — situacao padrao no modo local, onde irec_local_calls costuma estar vazio). O avgStars 4.8 fixo agrava: mostra nota alta com zero avaliacoes.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0219 · MÉDIO · `CONFIRMADO`

**KPIs de cliques, vendas e receita de afiliados derivados apenas da quantidade de parceiros**

**Onde:** `src/components/AdminReports.jsx:158`

**O defeito:** `getAffiliatePerformance()` multiplica `partners.length` por constantes fixas (8 cliques por produto, 15% de conversao, R$ 18,50 de comissao). Nenhum evento de clique, visualizacao ou venda e lido de qualquer fonte de dados - nao existe rastreio de clique no codigo. Os tres cartoes sao rotulados como 'CLIQUES DE AFILIADOS (EST.)', 'VENDAS CONVERTIDAS (EST.)' e 'RECEITA DE COMISSAO iREC (EST.)' e o valor monetario e exibido com duas casas decimais, aparentando precisao contabil.

**Como falha:** Admin cadastra 10 parceiros iRec e nao publica nenhum link para pacientes. Ao abrir 'admin-reports' -> '💼 Comercial & Afiliados', o painel informa '80' cliques de afiliados, '12' vendas convertidas e 'R$ 222.00' de receita de comissao. Excluir um parceiro reduz a 'receita' em R$ 22,20 instantaneamente. O numero varia com o catalogo, nunca com vendas reais.

**Código atual:**

```jsx
const totalAssignedMaterials = partners.length;
const estimatedClicks = totalAssignedMaterials * 8; // Simulating 8 views/clicks per product link
const estimatedSales = Math.round(estimatedClicks * 0.15); // 15% conversion rate
const estimatedCommission = estimatedSales * 18.50; // average 18.50 BRL commission per item
```

**Correção sugerida:** Substituir por contagem real de eventos de clique/venda ou rotular explicitamente como projecao teorica sem valor monetario.

<details><summary>Verificação feita contra o código</summary>

Linhas 156-163 confirmam partners.length * 8 * 0.15 * 18.50, sem nenhuma fonte de evento de clique ou venda. Os rotulos trazem '(EST.)' (526/536/546), o que atenua um pouco, mas o valor e exibido como 'R$ {estimatedCommission.toFixed(2)}' com precisao contabil e o subtitulo afirma 'Cliques nos links recomendados' e 'Taxa de conversao: 15%', apresentando como medicao e nao como constante. Excluir um parceiro reduz a 'receita' instantaneamente, como descrito. O sufixo (EST.) nao e guarda suficiente para o dano descrito.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0220 · MÉDIO · `CONFIRMADO`

**Ranking de Insumos Mais Recomendados atribui a mesma contagem fixa a todos os produtos**

**Onde:** `src/components/AdminReports.jsx:174`

**O defeito:** `getMostRecommendedInsumos()` incrementa `counts[key].count += 3` uma vez por parceiro cadastrado, sem consultar nenhuma prescricao ou recomendacao real. Como cada nome distinto entra no mapa uma unica vez, TODOS os itens terminam com o valor 3 e o `sort((a,b) => b.count - a.count)` nao reordena nada (comparador sempre 0), fazendo o 'Top 5' virar simplesmente os 5 primeiros parceiros na ordem em que vieram do banco.

**Como falha:** Admin abre 'admin-reports' -> '💼 Comercial & Afiliados' e le o 'Relatorio 9: Insumos Mais Recomendados'. Os cinco itens listados exibem exatamente '3 indicacoes' cada, e o item que o admin sabe ser o mais prescrito da plataforma pode nem aparecer na lista (basta ter sido cadastrado em sexto lugar). O ranking nao informa nada sobre recomendacao real.

**Código atual:**

```jsx
counts[key].count += 3; // base multiplier for platform presence
});
return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
```

**Correção sugerida:** Contar recomendacoes reais (assignments/prescricoes por material) em vez de somar 3 por parceiro cadastrado.

<details><summary>Verificação feita contra o código</summary>

Linhas 167-176 confirmam count += 3 por parceiro, sem consultar prescricoes. Como a chave e p.name, cada nome distinto recebe exatamente 3 e o comparador b.count-a.count retorna 0 para todos, preservando a ordem de chegada do banco; o 'Top 5' vira os 5 primeiros do array. A UI mostra '{item.count}' sob o rotulo 'indicacoes' (618-619) e o cabecalho fala em 'lideres de recomendacao ativa' (602). Unica ressalva ao texto do achado: nomes duplicados somariam 6, mas isso nao muda o defeito.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0221 · MÉDIO · `CONFIRMADO`

**KPI 'Documentos Clinicos Emitidos' conta triagens de ferida e ignora a emissao real de documentos**

**Onde:** `src/components/AdminReports.jsx:216`

**O defeito:** O contador filtra logs cuja acao contenha 'ADD' ou 'CREATE'. As acoes realmente gravadas incluem 'ADD_WOUND_ENTRY' (supabaseService.js:1075), que e o registro de uma evolucao de ferida - nao um documento. Ao mesmo tempo as acoes que representam emissao de documento, 'ISSUE_MEDICAL_DOCUMENT' e 'SIGN_MEDICAL_DOCUMENT' (DoctorDashboard.jsx:504 e 511), nao contem 'ADD' nem 'CREATE' e por isso NAO sao contadas. O rotulo exibido e 'DOCUMENTOS CLINICOS EMITIDOS ... Atestados, Laudos e Prescricoes'.

**Como falha:** No periodo, medicos assinaram 12 atestados/laudos (12 logs ISSUE_MEDICAL_DOCUMENT) e pacientes registraram 300 evolucoes de ferida (300 logs ADD_WOUND_ENTRY). Admin abre 'admin-reports' -> '🔒 Seguranca & LGPD' e le 'DOCUMENTOS CLINICOS EMITIDOS: 300 arquivos'. O numero real de documentos (12) nao aparece em lugar algum, e o indicador usado para conformidade documental esta 25x inflado.

**Código atual:**

```jsx
const totalRecipesCount = logsFiltered.filter(l => (l.action || '').toUpperCase().includes('ADD') || (l.action || '').toUpperCase().includes('CREATE')).length;
```

**Correção sugerida:** Filtrar por acoes ISSUE_MEDICAL_DOCUMENT e SIGN_MEDICAL_DOCUMENT em vez de substrings 'ADD'/'CREATE'.

<details><summary>Verificação feita contra o código</summary>

Linha 216 confirma o filtro includes('ADD') || includes('CREATE'). Verifiquei todas as acoes gravadas em audit_logs: 'ADD_WOUND_ENTRY' (supabaseService.js:1075) casa com 'ADD'; 'ISSUE_MEDICAL_DOCUMENT' e 'SIGN_MEDICAL_DOCUMENT' (DoctorDashboard.jsx:511 e 504) nao contem nem 'ADD' nem 'CREATE' e ficam de fora; demais acoes (VIEW_PATIENT_RECORD, UPDATE_CLINICAL_PROFILE, EXPORT_FHIR_JSON, TCLE_ACCEPTED, AI_CHAT_*) tambem nao casam. O KPI e rotulado 'DOCUMENTOS CLINICOS EMITIDOS / Atestados, Laudos e Prescricoes' (642/647). Conta exatamente o oposto do que anuncia.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0222 · MÉDIO · `CONFIRMADO`

**Score NPS negativo e exibido com sinal duplo ('+-33')**

**Onde:** `src/components/AdminReports.jsx:418`

**O defeito:** O JSX prefixa o score com '+' literal: `+{nps.score}`. `getNpsStats()` calcula `score = Math.round(((promoters - detractors) / completedCalls.length) * 100)`, que e negativo quando ha mais detratores que promotores. A cor tambem e fixa em 'var(--success-light)' (verde) e o rodape fixo afirma '💚 Zona de Excelencia ativa no atendimento de video', independentemente do valor.

**Como falha:** Se a regra de estrelas for corrigida para usar avaliacoes reais e o resultado ficar negativo (mais detratores que promotores), o cartao 'Relatorio 6' exibe ao admin '+-33 Score Net Promoter' em verde, com o rodape 'Zona de Excelencia ativa'. O admin le um NPS ruim como se fosse excelente.

**Código atual:**

```jsx
<span style={{ fontSize: '42px', fontWeight: '850', color: 'var(--success-light)' }}>+{nps.score}</span>
<span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Score Net Promoter</span>
```

**Correção sugerida:** Renderizar {nps.score > 0 ? '+' : ''}{nps.score} e derivar cor e rodape de faixas do score.

<details><summary>Verificação feita contra o código</summary>

Linha 418 confirma o '+' literal, a cor fixa var(--success-light) e o rodape fixo 'Zona de Excelencia ativa' (429). Ao contrario do que o proprio relato sugere (que exigiria corrigir antes a regra de estrelas), o cenario JA e alcancavel com a formula atual: com exatamente 1 chamada concluida, idx=0 cai no ramo idx%8===0, gera 3 estrelas, detractors=1 e promoters=0, resultando em score=-100 e no texto '+-100' renderizado em verde com selo de excelencia. Com 2 chamadas o score e 0 e exibe '+0', tambem em verde.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0429 · BAIXO · `CONFIRMADO`

**Estado stats e preenchido por 6 consultas de contagem e nunca renderizado**

**Onde:** `src/components/AdminDashboard.jsx:59`

**O defeito:** `stats` e declarado (linha 8) e atualizado por `setStats(statsData)` (linha 59), mas nao e lido em nenhum ponto do arquivo - confirmado por grep: as unicas ocorrencias de 'stats' relacionadas sao as linhas 8, 48 e 59. `getAdminStats()` executa seis consultas COUNT no Supabase (supabaseService.js:2674-2681) a cada carga e a cada refresh do botao 'Atualizar Base'. Como consequencia, os totalizadores que essas consultas produzem (notadamente `triages` e `partners`) nao aparecem em nenhum lugar do painel.

**Como falha:** Admin abre 'admin-metrics' e clica em 'Atualizar Base' na aba de curatoria varias vezes: cada clique dispara seis consultas COUNT cujo resultado e descartado. O admin tambem nao encontra em nenhuma aba o total de triagens realizadas na plataforma, embora esse numero seja buscado do banco em toda carga.

**Código atual:**

```jsx
setStats(statsData);
setUsers(usersData);
setLogs(logsData);
```

**Correção sugerida:** Ou renderizar os totalizadores de stats num cartao de resumo, ou remover getAdminStats do Promise.all e o estado stats.

<details><summary>Verificação feita contra o código</summary>

Grep no arquivo confirma que 'stats' aparece apenas nas linhas 8 (useState) e 59 (setStats), sem nenhuma leitura no JSX. getAdminStats (supabaseService.js:2673-2690) dispara seis COUNT em paralelo a cada loadData - e loadData e reexecutado apos cadastro/exclusao de parceiro e apos editar/excluir capitulo. Trabalho desperdicado e totalizadores (triages, partners) invisiveis no painel. Severidade baixa correta.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0430 · BAIXO · `CONFIRMADO`

**Efeito de carga sem cancelamento: setState apos desmontagem do painel**

**Onde:** `src/components/AdminDashboard.jsx:76`

**O defeito:** O `useEffect` dispara `loadData()` e nao retorna funcao de limpeza nem usa flag de cancelamento/AbortController. `loadData` executa 8 requisicoes e, ao terminar, chama 8 setters mais `setLoading(false)`. Como o AdminDashboard e desmontado assim que o `activeTab` sai do grupo 'admin-*' (App.jsx:848-861), as respostas em voo continuam escrevendo em um componente desmontado. O mesmo padrao aparece nos `await loadData()` de handleAddPartner (linha 108), handleDeletePartner (122) e nos handlers de curatoria (1070 e 1145).

**Como falha:** Admin abre 'admin-metrics' em uma conexao lenta e, antes de a carga concluir, clica em 'Perfil' no menu. O AdminDashboard e desmontado, mas o Promise.all termina depois e executa os 9 setState orfaos. Os dados carregados sao descartados e, ao reabrir o painel, todo o ciclo de 8 requisicoes recomeca do zero.

**Código atual:**

```jsx
useEffect(() => {
  loadData();
}, []);
```

**Correção sugerida:** Usar let cancelled = false no useEffect, checar antes dos setters e retornar () => { cancelled = true; }.

<details><summary>Verificação feita contra o código</summary>

O useEffect (74-76) nao retorna cleanup nem usa flag/AbortController, e loadData executa 9 setters apos await; o componente e desmontado quando activeTab sai do grupo 'admin-*' (App.jsx:848-861). Os mesmos awaits sem guarda aparecem em handleAddPartner (108), handleDeletePartner (122) e nos handlers de curatoria (1070, 1145). Ressalva: React 18/19 nao emite mais o aviso de setState em componente desmontado nem ha vazamento de memoria real - o dano se limita a trabalho descartado e as 8 requisicoes refeitas do zero. Severidade baixa correta.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0431 · BAIXO · `VERIFICAR`

**Log sem campo action gera a chave literal 'undefined' no ranking de atividades**

**Onde:** `src/components/AdminDashboard.jsx:412`

**O defeito:** `getAuditActionStats()` indexa `actionCounts[log.action]` sem validar. Se `log.action` for null/undefined, a chave do objeto torna-se a string 'undefined'. Essa string chega ao `formatLogAction`, que so protege contra valores falsy (`if (!action) return 'ACAO DESCONHECIDA'`) - a string 'undefined' e truthy, passa pela guarda e e impressa como texto. A mesma agregacao tambem soma todos esses registros num unico bucket.

**Como falha:** Um registro e inserido em audit_logs com action nula (insercao manual, migracao ou falha do gravador). Admin abre 'admin-logs' e o topo do '📊 Ranking de Atividades Frequentes no Sistema' exibe a linha 'undefined - 3 ocorrencias', com barra de progresso, como se fosse uma atividade legitima do sistema.

**Código atual:**

```jsx
logsFiltered.forEach(log => {
  actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
});
```

**Correção sugerida:** Usar const key = log.action || 'ACAO_DESCONHECIDA' antes de agregar em actionCounts.

<details><summary>Verificação feita contra o código</summary>

A mecanica esta correta: getAuditActionStats (409-415) indexa actionCounts[log.action] sem validar e formatLogAction (427-430) so protege contra falsy, deixando a string 'undefined' passar e ser impressa. Nao consegui confirmar, porem, que um log com action nula chegue a existir: todos os chamadores de createAuditLog no codigo passam a acao explicitamente, e no modo local getAuditLogs retorna [] sempre - o cenario depende de insercao manual/migracao ou de um schema sem NOT NULL, que nao verifiquei. Severidade baixa por depender de estado improvavel.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0432 · BAIXO · `CONFIRMADO`

**Cor de texto fixa 'black' no rotulo de papel desconhecido fica ilegivel no tema escuro**

**Onde:** `src/components/AdminDashboard.jsx:423`

**O defeito:** O ramo default de `getRoleLabel` fixa `color: 'black'` sobre `bg: 'rgba(0,0,0,0.05)'`, ignorando as variaveis de tema (--text-primary/--text-secondary) usadas em todos os outros ramos. No tema escuro do iRec, texto preto sobre fundo escuro semitransparente resulta em contraste praticamente nulo. O rotulo e renderizado na linha 862 (`label.text.toUpperCase()`) nos cards da aba de usuarios.

**Como falha:** Admin com tema escuro ativo abre 'admin-users'. Qualquer perfil cujo role nao seja exatamente 'doctor', 'nurse' ou 'patient' (por exemplo um papel novo como 'admin' ou 'caregiver') exibe o badge de papel em preto sobre fundo escuro: o texto fica invisivel e o admin nao consegue identificar o papel daquele usuario.

**Código atual:**

```jsx
default: return { text: role, bg: 'rgba(0,0,0,0.05)', color: 'black' };
```

**Correção sugerida:** Usar { text: role || 'Indefinido', bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' } no ramo default.

<details><summary>Verificação feita contra o código</summary>

Linha 423 confere: default retorna color 'black' sobre bg rgba(0,0,0,0.05), quebrando o padrao das variaveis de tema usadas nos outros tres ramos (420-422). No tema escuro o contraste e praticamente nulo. Ressalva de alcancabilidade: os papeis do sistema sao apenas patient/doctor/nurse e o admin e filtrado pelo email na linha 133, entao o ramo default so e atingido com papel atipico ou vazio - alem disso, com role undefined o text vira undefined e o toUpperCase do card quebraria. Severidade baixa e adequada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0433 · BAIXO · `CONFIRMADO`

**Condicao de renderizacao dos filtros de patologia e sempre verdadeira**

**Onde:** `src/components/AdminDashboard.jsx:525`

**O defeito:** `pathologyStats.list.length >= 0` nunca pode ser falso, porque o comprimento de um array nunca e negativo. A guarda nao tem efeito: a barra de busca e os tres seletores (Estado, Cidade, Ordenacao) sao sempre renderizados, inclusive quando a lista esta vazia e o bloco imediatamente abaixo (linha 601) exibe 'Nenhuma patologia identificada'. A intencao evidente era `> 0`.

**Como falha:** Admin abre 'admin-metrics' com a lista de patologias vazia (o caso normal, dado o defeito dos campos de comorbidade). O painel mostra a caixa '🔍 Filtrar patologias/comorbidades' e os tres seletores plenamente interativos, e logo abaixo 'Nenhuma patologia identificada nos prontuarios'. O admin digita e troca filtros repetidamente acreditando que a busca esta com problema.

**Código atual:**

```jsx
{pathologyStats.list.length >= 0 && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
```

**Correção sugerida:** Trocar >= 0 por > 0 na condicao da linha 525.

<details><summary>Verificação feita contra o código</summary>

Linha 525 e literalmente {pathologyStats.list.length >= 0 && (...)} - comprimento de array nunca e negativo, entao a guarda nunca bloqueia. Busca e os tres seletores sao sempre renderizados, inclusive junto com a mensagem 'Nenhuma patologia identificada' da linha 601-604. Intencao evidente era > 0. Severidade baixa correta.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0434 · BAIXO · `CONFIRMAR-SCHEMA`

**Seletores de Estado, Cidade e Ordenacao sem label associado**

**Onde:** `src/components/AdminDashboard.jsx:559`

**O defeito:** Os tres `<select>` do painel de patologias (linhas 559, 574 e 588) nao possuem `<label>`, `aria-label` nem `aria-labelledby`. O unico texto que sugere a funcao esta dentro da primeira `<option>` ('Estado: Todos', 'Cidade: Todas'), e o seletor de ordenacao nao tem nem isso - suas opcoes sao 'Mais Casos', 'Menos Casos', 'Ordem: A-Z'. O campo de busca da linha 528 tambem usa apenas placeholder como rotulo.

**Como falha:** Admin com leitor de tela navega pelo painel de patologias. O terceiro combo e anunciado apenas como 'caixa de combinacao, Mais Casos', sem informar que se trata do critério de ordenacao. Depois de escolher uma opcao, o rotulo desaparece do valor selecionado e o usuario nao tem como saber qual filtro esta manipulando.

**Código atual:**

```jsx
<select
  value={selectedState}
  onChange={(e) => {
    setSelectedState(e.target.value);
    setSelectedCity('all'); // Reset city on state change
  }}
```

**Correção sugerida:** Adicionar aria-label nos tres selects ('Filtrar por estado', 'Filtrar por cidade', 'Ordenar patologias') e no input de busca.

<details><summary>Verificação feita contra o código</summary>

Li as linhas 557-596: os tres <select> nao tem <label>, aria-label nem aria-labelledby. Os dois primeiros so insinuam a funcao pela primeira <option> ('Estado: Todos', 'Cidade: Todas'), que some assim que o usuario escolhe outro valor; o de ordenacao (588-596) nao tem nem isso. O input de busca (528-543) tambem depende so do placeholder. Severidade baixa correta.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0435 · BAIXO · `CONFIRMADO`

**Filtro de cidade ignora o estado e usa key duplicada para cidades homonimas**

**Onde:** `src/components/AdminDashboard.jsx:583`

**O defeito:** `getUniqueStatesAndCities()` deduplica cidades pelo par {name, state} (linhas 297-301), mas o `<option>` usa `key={c.name}` e `value={c.name}` - somente o nome. Duas cidades homonimas em UFs diferentes geram duas options com a MESMA key (aviso 'Encountered two children with the same key' e reconciliacao incorreta) e duas entradas visualmente identicas na lista. Pior: o filtro em `getDynamicPathologiesStats()` (linha 324) compara apenas `u.city`, sem considerar o estado selecionado, entao a selecao mistura pacientes de UFs diferentes.

**Como falha:** Base com pacientes em 'Bom Jesus/PI' e 'Bom Jesus/RS'. Admin abre 'admin-metrics', escolhe 'Estado: PI' e depois 'Cidade: Bom Jesus'. O React emite aviso de key duplicada, o dropdown mostra 'Bom Jesus' duas vezes e as estatisticas de patologia somam tambem os pacientes do Rio Grande do Sul, inflando a prevalencia atribuida ao municipio piauiense.

**Código atual:**

```jsx
{citiesList
  .filter(c => selectedState === 'all' || c.state === selectedState)
  .map(c => (
    <option key={c.name} value={c.name}>{c.name}</option>
  ))}
```

**Correção sugerida:** Usar key/value compostos (`${c.name}|${c.state}`) e desmembrar name/state no filtro de cidade.

<details><summary>Verificação feita contra o código</summary>

A metade da key duplicada e real: getUniqueStatesAndCities (294-308) deduplica por {name,state} e o <option> da linha 583 usa key={c.name} e value={c.name}, gerando duas options identicas com a mesma key para homonimas. Mas o cenario descrito esta ERRADO: em getDynamicPathologiesStats o filtro de estado (318-320) e aplicado ANTES do de cidade (322-325), entao ao escolher 'Estado: PI' os pacientes do RS ja foram excluidos e nao ha mistura. A mistura de UFs so ocorre com 'Estado: Todos' + cidade homonima selecionada. Por isso rebaixo de medio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0436 · BAIXO · `CONFIRMADO`

**Aba administrativa desconhecida renderiza painel vazio (header sem conteudo)**

**Onde:** `src/components/AdminDashboard.jsx:1182`

**O defeito:** A cadeia de ternarios que escolhe o conteudo termina em `: null`, sem ramo padrao. `activeTab` vem de `propActiveTab` (linha 7), e o App.jsx renderiza `<AdminDashboard />` SEM nenhuma prop no ramo default do switch (App.jsx:908-910). Nesse caso `propActiveTab` e undefined, nenhum dos ternarios casa e o componente devolve apenas o header e o seletor de datas - area de conteudo completamente vazia, sem mensagem de erro nem redirecionamento.

**Como falha:** Admin salva/compartilha um link com hash antigo ou digitado errado, por exemplo '#admin' ou '#admin-metricas'. O switch do App.jsx nao casa nenhum case, cai no default, detecta isAdmin e renderiza `<AdminDashboard />` sem props. A tela exibe o titulo '🛡️ Dashboard Administrativo iRec' e o seletor de periodo, e abaixo nada - area em branco. O admin fica preso sem conteudo e sem indicacao do que fazer.

**Código atual:**

```jsx
      ) : null}

      {/* POPUP MODAL: ADD PARTNER */}
```

**Correção sugerida:** Trocar o ': null' final por um ramo padrao com mensagem e botao de voltar, e passar activeTab='metrics' no <AdminDashboard /> do ramo default do App.jsx.

<details><summary>Verificação feita contra o código</summary>

Confirmado: a cadeia de ternarios encerra em ': null' na linha 1182, sem ramo padrao, e activeTab vem de propActiveTab (linha 7). App.jsx:907-910 renderiza <AdminDashboard /> sem nenhuma prop no ramo default, logo propActiveTab e undefined e nada casa - sobram apenas header e seletor de datas. A rota so e alcancada por hash desconhecido (o hash 'dashboard' casa no case da linha 759), o que reduz a frequencia real; por isso rebaixo de medio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0437 · BAIXO · `CONFIRMADO`

**Botao de fechar do modal de parceiro nao possui nome acessivel**

**Onde:** `src/components/AdminDashboard.jsx:1192`

**O defeito:** O botao de fechar do modal 'Cadastrar Parceiro iRec' tem como unico conteudo o caractere '✕' e nao possui `aria-label`, `title` nem texto alternativo. O mesmo ocorre com o botao de limpar a busca de patologias (linha 545), que tambem contem apenas '✕'. Leitores de tela anunciam apenas 'botao' ou o nome do glifo, sem indicar a acao.

**Como falha:** Admin que usa leitor de tela abre o modal de cadastro de parceiro e navega por Tab. Ao chegar no controle de fechar, o leitor anuncia apenas 'botao', sem dizer 'Fechar'. O usuario nao consegue distinguir esse controle dos demais e nao sabe como sair do modal sem enviar o formulario.

**Código atual:**

```jsx
<button 
  onClick={() => setShowPartnerModal(false)}
  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
>
  ✕
</button>
```

**Correção sugerida:** Adicionar aria-label="Fechar" (e aria-label="Limpar busca" no da linha 545) aos botoes com apenas glifo.

<details><summary>Verificação feita contra o código</summary>

Li o bloco 1192-1197: o botao tem apenas o glifo '✕', sem aria-label, title ou texto alternativo; o mesmo vale para o botao de limpar busca em 1545-1553 (tambem so '✕'). Leitores de tela anunciam apenas 'botao' ou o nome do glifo. Severidade baixa correta.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0438 · BAIXO · `CONFIRMAR-SCHEMA`

**AdminPartners lista materiais que nao sao parceiros iRec (falta o filtro por type)**

**Onde:** `src/components/AdminPartners.jsx:22`

**O defeito:** `getRecommendedMaterials(null)` devolve todos os registros com patient_id e doctor_id nulos, sem distinguir o campo `type`, cujo DEFAULT no banco e 'doctor_partner' (clean_database_v5.sql:20). O AdminDashboard, que cobre a mesma funcao, aplica explicitamente `partnersData.filter(p => p.type === 'irec_partner')` (AdminDashboard.jsx:62). Aqui nao ha filtro algum, entao as duas telas mostram conjuntos diferentes para o mesmo conceito de 'parceria global'.

**Como falha:** A base possui 5 registros globais legados com type='doctor_partner' (default do banco) e 2 parcerias iRec reais. A tela 'Parcerias Ativas' exibe 7 itens e o contador de parcerias divergira do exibido em 'Parcerias Globais iRec (2)' do AdminDashboard. Se o admin excluir um dos itens legados achando que e uma parceria iRec, remove um material de outro contexto.

**Código atual:**

```jsx
const data = await getRecommendedMaterials(null); // Fetch only global partners
setPartners(data);
```

**Correção sugerida:** Aplicar setPartners(data.filter(p => p.type === 'irec_partner')) em loadPartners.

<details><summary>Verificação feita contra o código</summary>

getRecommendedMaterials(null) cai no ramo 'global partners' (supabaseService.js:2527-2535, patient_id e doctor_id nulos) sem distinguir type, cujo DEFAULT e 'doctor_partner' (clean_database_v5.sql:20); ja o AdminDashboard aplica partnersData.filter(p => p.type === 'irec_partner') na linha 62. As duas telas mostrariam conjuntos diferentes. Como AdminPartners nunca e montado (item 63), o impacto atual e nulo - rebaixo de medio para baixo.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0439 · BAIXO · `CONFIRMADO`

**Mensagens de sucesso e erro do formulario coexistem e nunca sao limpas**

**Onde:** `src/components/AdminPartners.jsx:38`

**O defeito:** No retorno antecipado da validacao (linhas 37-40) o codigo faz `setErrorMsg(...)` sem limpar `successMsg`. E `successMsg`, definido em caso de sucesso (linha 59), nunca e apagado - nao ha timeout, nem limpeza ao digitar, nem limpeza no unmount. Os dois blocos de aviso (linhas 245-255) sao renderizados por condicoes independentes.

**Como falha:** Admin cadastra um parceiro com sucesso ('✅ Parceiro iRec cadastrado com sucesso!' aparece). Em seguida tenta cadastrar outro e submete com a farmacia em branco: a tela passa a mostrar SIMULTANEAMENTE '✅ Parceiro iRec cadastrado com sucesso!' e '⚠️ Por favor, preencha os campos obrigatorios (*)'. O admin nao sabe se o segundo cadastro foi salvo.

**Código atual:**

```jsx
if (!name || !affiliateLink || !pharmacyName) {
  setErrorMsg('Por favor, preencha os campos obrigatórios (*).');
  return;
}
```

**Correção sugerida:** Mover setErrorMsg('')/setSuccessMsg('') para o inicio de handleSubmit, antes da validacao.

<details><summary>Verificação feita contra o código</summary>

Confirmado: no retorno antecipado (37-40) o setErrorMsg ocorre antes das limpezas das linhas 43-44, que ficam depois do return; e successMsg (linha 59) nunca e apagado - nao ha timeout nem limpeza ao digitar/desmontar. Os dois avisos sao renderizados por condicoes independentes, entao aparecem juntos. Severidade baixa ja era adequada, e o componente ainda esta morto (item 63).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0440 · BAIXO · `CONFIRMAR-SCHEMA`

**Mesmo defeito de tipo no price do AdminPartners (payload texto para coluna numeric)**

**Onde:** `src/components/AdminPartners.jsx:50`

**O defeito:** Repeticao do defeito: `price: price || 'A consultar'` enviado para `price numeric(10,2)` (clean_database_v5.sql:17), com placeholder 'Ex: R$ 42,90' na linha 210. O insert falha com erro 22P02 e a UI mostra apenas 'Erro ao cadastrar parceiro. Tente novamente.' (linha 68), sem indicar qual campo esta invalido.

**Como falha:** Se o case duplicado do App.jsx for corrigido e esta tela passar a renderizar, o admin preenche o formulario 'Cadastrar Novo Parceiro' deixando Preco vazio e recebe 'Erro ao cadastrar parceiro. Tente novamente.' indefinidamente, sem nenhuma pista de que o problema e o valor 'A consultar' num campo numerico.

**Código atual:**

```jsx
const payload = {
  name,
  brand: brand || 'Genérico/Outros',
  price: price || 'A consultar',
  affiliate_link: affiliateLink,
```

**Correção sugerida:** Aplicar a mesma normalizacao numerica do item 64 (ou null) antes do insert, junto com a remocao do case duplicado.

<details><summary>Verificação feita contra o código</summary>

O codigo existe exatamente como descrito (AdminPartners.jsx:50, price: price || 'A consultar' contra price numeric(10,2)) e o catch da linha 68 mostra mensagem generica. Porem o proprio item 63 estabelece que este componente nunca e montado - nenhum usuario alcanca esse fluxo hoje. Defeito real, mas em codigo morto: rebaixo de alto para baixo enquanto o case duplicado do App.jsx nao for corrigido.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0441 · BAIXO · `CONFIRMADO`

**Cinco estrelas fixas exibidas independentemente da nota media**

**Onde:** `src/components/AdminReports.jsx:423`

**O defeito:** O widget de estrelas e uma string literal '★★★★★' com cor fixa '#FBBF24', sem qualquer vinculo com `nps.avgStars` renderizado ao lado. A representacao visual nunca muda, mesmo quando a nota numerica cai.

**Como falha:** Admin abre 'admin-reports' -> '📞 Telemedicina & Fila'. Ainda que o valor numerico exiba '3.2 / 5.0', o widget ao lado mostra cinco estrelas cheias douradas. Quem olha o painel rapidamente (ou tira print para uma apresentacao) le nota maxima de satisfacao quando a nota apurada e 3.2.

**Código atual:**

```jsx
<span style={{ color: '#FBBF24', fontSize: '18px' }}>★★★★★</span>
<strong style={{ color: 'var(--text-primary)' }}>{nps.avgStars} / 5.0</strong>
```

**Correção sugerida:** Gerar as estrelas a partir de nps.avgStars (ex.: '★'.repeat(Math.round(avgStars)) + '☆'.repeat(5 - Math.round(avgStars))).

<details><summary>Verificação feita contra o código</summary>

Linha 423 confirma a string literal '★★★★★' com cor fixa #FBBF24, imediatamente ao lado de {nps.avgStars} / 5.0 (424), sem qualquer vinculo com o valor. A representacao visual nunca muda. E defeito real de UI (dado visual dissociado do numerico), embora de impacto limitado porque o numero correto aparece ao lado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "AdminDashboard.jsx|AdminPartners.jsx|AdminReports.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
