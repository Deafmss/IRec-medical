# 12. Agenda e analytics do médico

**30 defeitos** — 1 crítico · 9 alto · 8 médio · 12 baixo

Arquivos tocados por este módulo:

- `src/components/DoctorDashboardAnalytics.jsx`
- `src/components/doctor/DoctorAgendaPage.jsx`
- `src/components/doctor/DoctorAgendaView.jsx`
- `src/components/doctor/DoctorPatientsListView.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0010 · CRÍTICO · `CONFIRMAR-SCHEMA`

**Agenda abre o prontuário com um objeto de paciente incompleto: alergias e comorbidades aparecem como inexistentes**

**Onde:** `src/components/doctor/DoctorAgendaPage.jsx:114`

**O defeito:** Quando o paciente do agendamento não é encontrado na lista local, o código injeta em setSelectedPatient um objeto sintético com apenas { id, name, email } e navega para 'doctor-dashboard'. Esse objeto vai direto para DoctorDashboard como prop selectedPatient (App.jsx:752) e NUNCA é recarregado: não há nenhuma chamada a getClinicalProfile em DoctorDashboard.jsx (confirmado por grep) e o polling de App.jsx:709-714 só recarrega wound entries, não o perfil. O prontuário então renderiza campos ausentes como negativas afirmativas: DoctorDashboard.jsx:1991-1992 exibe {selectedPatient.allergies || 'Nenhuma declarada'} e 1885 exibe {selectedPatient.cpf || 'Não cadastrado'}; 2012 conclui ausência de comorbidades quando todos os flags são undefined.

**Como falha:** O médico abre 'Agenda de Consultas', clica em 'Atender / Ver Prontuário' de um paciente que não está na lista carregada (ex.: paciente cujo perfil não voltou em getAllPatients, ou agendamento vindo do Supabase). O prontuário abre mostrando 'Alergias: Nenhuma declarada', 'CPF: Não cadastrado' e nenhuma comorbidade — para um paciente que é diabético e alérgico a sulfa. O médico prescreve com base nessa tela. Ausência de dado é apresentada como ausência de condição.

**Código atual:**

```jsx
const foundPatient = patients.find(p => p.id === app.patientId || p.name === app.patientName);
            if (foundPatient) {
              setSelectedPatient(foundPatient);
            } else {
              setSelectedPatient({ id: app.patientId, name: app.patientName, email: app.patientEmail });
            }
            setActiveTab('doctor-dashboard');
```

**Correção sugerida:** No ramo else, chamar getClinicalProfile(app.patientId) antes de navegar e, se não houver perfil, bloquear a abertura do prontuário com aviso explícito em vez de montar um objeto sintético.

<details><summary>Verificação feita contra o código</summary>

Linhas 109-117: quando o find falha, setSelectedPatient recebe literalmente { id, name, email } e a navegação segue para 'doctor-dashboard'. Sem nenhum recarregamento do perfil clínico depois disso — o polling de App.jsx:709-714 só recarrega getWoundEntries do paciente selecionado, nunca getClinicalProfile. O prontuário então renderiza campos ausentes como negativas afirmativas ('Nenhuma declarada', 'Não cadastrado', ausência de comorbidades), que é o padrão de falha mais perigoso: ausência de dado apresentada como ausência de condição, com decisão de prescrição em cima.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0089 · ALTO · `CONFIRMAR-SCHEMA`

**Data 'de hoje' calculada em UTC: agenda abre no dia errado após as 21h no horário de Brasília**

**Onde:** `src/components/doctor/DoctorAgendaPage.jsx:13`

**O defeito:** selectedCalendarDateStr é inicializado com new Date().toISOString().split('T')[0], que devolve a data em UTC. Já as células do calendário são construídas com componentes LOCAIS em getCalendarDays (linha 30: `${year}-${String(month + 1)...}` a partir de calendarViewDate.getFullYear()/getMonth()). Em UTC-3, a partir das 21:00 locais a data UTC já é o dia seguinte, criando divergência entre o dia selecionado e o dia real. O mesmo defeito aparece em DoctorAgendaView.jsx:33 (botão 'Hoje') e :91 (cálculo de isToday). A comparação de agendamentos usa appointmentDate, que vem de um <input type="date"> (BookingModal.jsx:248) e é sempre uma data de calendário local — logo não compensa o desvio.

**Como falha:** São 21:30 do dia 10/08 em São Paulo. O médico abre a Agenda: o painel inferior já exibe 'Consultas do dia 11/08/2026' e o médico não vê as consultas ainda pendentes de hoje. A borda verde de 'hoje' aparece na célula do dia 11. Se hoje fosse o último dia do mês, a marcação de 'hoje' desaparece do grid inteiro (a data UTC pertence ao mês seguinte). Clicar em 'Hoje' não corrige — o botão usa a mesma conta em UTC.

**Código atual:**

```jsx
const [selectedCalendarDateStr, setSelectedCalendarDateStr] = useState(new Date().toISOString().split('T')[0]);
```

**Correção sugerida:** Criar um helper toLocalDateStr(d) com getFullYear/getMonth/getDate e usá-lo nos três pontos em vez de toISOString().split('T')[0].

<details><summary>Verificação feita contra o código</summary>

Linha 13: useState(new Date().toISOString().split('T')[0]) — data em UTC. Já getCalendarDays (linha 30) monta dateStr com componentes locais (getFullYear/getMonth). Confirmei o mesmo padrão em DoctorAgendaView.jsx:33 (botão 'Hoje') e :91 (isToday). Em UTC-3, das 21:00 à meia-noite a data UTC é o dia seguinte, então o painel abre no dia errado, a borda de 'hoje' marca a célula errada (e some do grid na virada de mês) e o botão 'Hoje' não corrige. As datas dos agendamentos vêm de <input type="date">, ou seja, calendário local, sem compensar o desvio.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0090 · ALTO · `CONFIRMAR-SCHEMA`

**Agenda baixa o cadastro completo de TODOS os pacientes da plataforma para o navegador do médico**

**Onde:** `src/components/doctor/DoctorAgendaPage.jsx:42`

**O defeito:** loadData chama getAllPatients() sem filtro, apenas para resolver o nome do paciente da consulta. getAllPatients (supabaseService.js:1185-1243) faz select('*') em clinical_profile com role='patient' e mapeia CPF, RG, CNS, telefone, CEP, rua, número, complemento, bairro, cidade, estado, peso, altura, tipo sanguíneo, alergias, medicações, comorbidades e exames anexados de cada paciente. Todo esse conjunto fica em memória e no payload da resposta, acessível via DevTools/network, para um médico que só deveria ver seus próprios pacientes vinculados — a função correta para isso é getAssignedPatients(doctorId), já usada em DoctorDashboardAnalytics.jsx:21.

**Como falha:** Qualquer médico (ou enfermeiro cadastrado como doctor) abre a aba 'Agenda'. O navegador dele recebe, em uma única resposta, o cadastro clínico e os dados pessoais identificáveis de todos os pacientes da base — inclusive pacientes de outros profissionais, com quem ele não tem relação assistencial. Basta abrir o DevTools para exportar a base inteira.

**Código atual:**

```jsx
const allP = await getAllPatients();
      setPatients(allP);
```

**Correção sugerida:** Trocar getAllPatients() por getAssignedPatients(currentUser.id) e restringir por RLS o acesso a clinical_profile de pacientes não vinculados.

<details><summary>Verificação feita contra o código</summary>

loadData (linhas 36-49) chama getAllPatients() sem filtro só para resolver o nome do paciente. Li getAllPatients (supabaseService.js:1185-1248): select('*') em clinical_profile com role='patient', mapeando cpf, rg, cns, telefone, contato de emergência, endereço completo, peso, altura, tipo sanguíneo, alergias, medicações, comorbidades e exames anexados de todos os pacientes da base. Tudo isso chega ao cliente do médico, inspecionável no DevTools. Existe alternativa correta já em uso (getAssignedPatients em DoctorDashboardAnalytics.jsx:21).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0091 · ALTO · `CONFIRMADO`

**Casamento de paciente por NOME pode abrir o prontuário do paciente errado**

**Onde:** `src/components/doctor/DoctorAgendaPage.jsx:110`

**O defeito:** A busca usa o operador || entre id e nome: p.id === app.patientId || p.name === app.patientName. Como getAllPatients() retorna TODOS os pacientes da plataforma (supabaseService.js:1185-1196), qualquer homônimo satisfaz a segunda condição, e o .find devolve o primeiro da lista ordenada por nome. Pior: se app.patientId vier vazio/undefined, o critério de nome é o único usado. Não há desempate por CPF, e-mail ou data de nascimento.

**Como falha:** A plataforma tem dois pacientes chamados 'Maria Silva' (nomes comuns no Brasil). O médico clica em 'Atender / Ver Prontuário' na consulta da Maria Silva agendada para 14h. O find retorna a OUTRA Maria Silva e o app abre o prontuário completo dela — evoluções de ferida, fotos, alergias, medicações. O médico conduz a teleconsulta lendo o prontuário de outra pessoa, e o acesso indevido ao prontuário de terceiro ocorre sem nenhum alerta.

**Código atual:**

```jsx
const foundPatient = patients.find(p => p.id === app.patientId || p.name === app.patientName);
```

**Correção sugerida:** Casar somente por id (p.id === app.patientId) e tratar a ausência como erro explícito, sem fallback por nome.

<details><summary>Verificação feita contra o código</summary>

A linha 110 usa p.id === app.patientId || p.name === app.patientName. Como .find retorna o primeiro elemento que satisfaz qualquer uma das condições e getAllPatients traz TODOS os pacientes ordenados por nome (supabaseService.js:1185-1196), um homônimo posicionado antes vence inclusive sobre o registro cujo id realmente casa. Se app.patientId vier vazio, o nome é o único critério. Não há desempate por CPF/e-mail/nascimento. Homônimos são comuns o bastante para tornar o cenário real, e o resultado é acesso indevido a prontuário de terceiro.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0092 · ALTO · `CONFIRMADO`

**Contadores dos filtros aceitam status alternativos, mas o filtro aplicado usa igualdade estrita: pill mostra N e lista mostra vazio**

**Onde:** `src/components/doctor/DoctorAgendaView.jsx:55`

**O defeito:** Os rótulos dos pills contam status equivalentes — 'Agendado' OU 'confirmed' (linha 52) e 'Cancelado' OU 'canceled' (linha 55) — mas a filtragem efetiva, tanto nas células do calendário (linha 97) quanto no painel do dia (linha 167), é a comparação estrita a.status === agendaStatusFilter. O status realmente gravado no cancelamento é 'canceled' em minúsculo e em inglês: supabaseService.js:1488 faz update({ status: 'canceled' }) e a linha 1498 grava o mesmo valor no localStorage. Nada no código grava 'Cancelado'. Logo o pill 'Canceladas' contabiliza o item, mas o filtro 'Cancelado' jamais o encontra.

**Como falha:** O paciente cancela a consulta de amanhã. O médico abre a Agenda e vê o pill '🔴 Canceladas (1)'. Ele clica no pill para revisar o cancelamento e o painel responde 'Nenhuma consulta agendada para o dia selecionado.' e todas as células do calendário zeram. O médico não consegue, por nenhum caminho da interface, listar a consulta cancelada que o próprio contador afirma existir.

**Código atual:**

```jsx
{ id: 'Cancelado', label: `🔴 Canceladas (${doctorAppointments.filter(a => a.status === 'Cancelado' || a.status === 'canceled').length})` }
// ...
            if (agendaStatusFilter === 'all') return true;
            return a.status === agendaStatusFilter;
```

**Correção sugerida:** Normalizar o status (função canonicalStatus) e usar a mesma lista de equivalências nos contadores e nos dois filtros.

<details><summary>Verificação feita contra o código</summary>

Linhas 52 e 55 contam status equivalentes ('Agendado' || 'confirmed', 'Cancelado' || 'canceled'), mas a filtragem real usa igualdade estrita em dois pontos: linha 97 (células) e linha 167 (painel do dia). Confirmei que o cancelamento grava 'canceled' minúsculo tanto no Supabase (supabaseService.js:1488) quanto no localStorage (1498) e que nada no projeto grava 'Cancelado'. O mesmo vale para 'confirmed' vs 'Agendado' (createAppointment grava 'confirmed' no banco e 'Agendado' no local, linhas 1403/1429). Pill mostra N, filtro devolve vazio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0093 · ALTO · `CONFIRMADO`

**Consulta cancelada aparece na agenda com aparência de agendada e rótulo cru 'canceled'**

**Onde:** `src/components/doctor/DoctorAgendaView.jsx:200`

**O defeito:** As ternárias de cor tratam somente 'Em Espera' e 'Concluído'; qualquer outro status cai no ramo default azul de #0284c7 (rgba(2,132,199,...)), o mesmo usado para consultas agendadas. Como o cancelamento grava 'canceled' (supabaseService.js:1488/1498), a consulta cancelada é renderizada com o visual de agendada, tanto na célula do dia (linhas 137-138) quanto no card do painel (linhas 200-201), e o badge de status imprime o valor bruto do banco: '● canceled'. Ela também continua contando no contador de consultas do dia (linha 123) e mantém o botão 'Atender / Ver Prontuário' ativo.

**Como falha:** O paciente cancela a consulta de 14h. Com o filtro em 'Todas' (padrão), o médico vê no dia 14/08 o mesmo badge azul de sempre, com o texto '● canceled', o horário e o nome do paciente, e o contador do dia mostrando 3 consultas em vez de 2. Ele se organiza para atender às 14h uma consulta que não existe mais.

**Código atual:**

```jsx
backgroundColor: app.status === 'Em Espera' ? 'rgba(234, 179, 8, 0.15)' : (app.status === 'Concluído' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)'),
                        color: app.status === 'Em Espera' ? '#eab308' : (app.status === 'Concluído' ? '#10b981' : '#0284c7')
                      }}>
                        ● {app.status || 'Agendado'}
```

**Correção sugerida:** Mapear status para rótulo/cor pt-BR (incluindo canceled → vermelho 'Cancelada'), excluir cancelados do contador do dia e desabilitar o botão de atendimento.

<details><summary>Verificação feita contra o código</summary>

As ternárias das linhas 137-138 e 200-201 só tratam 'Em Espera' e 'Concluído'; qualquer outro valor, inclusive 'canceled', cai no azul de agendada. A linha 203 imprime '● {app.status || "Agendado"}', ou seja, o valor cru do banco. Confirmei que cancelAppointment grava 'canceled' (supabaseService.js:1488/1498). A consulta cancelada continua contando na badge do dia (linha 123) e mantém o botão 'Atender / Ver Prontuário' (linha 218) ativo — o médico pode se organizar para um atendimento inexistente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0106 · ALTO · `CONFIRMAR-SCHEMA`

**Casos Finalizados e Taxa de Retorno sempre zerados em modo contingência: chaves de localStorage divergentes**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:22`

**O defeito:** getDoctorPatientsWoundEntries, no caminho sem Supabase (supabaseService.js:2752-2755), lê localStorage 'irec_local_assignments' e 'irec_local_wound_entries'. Nenhuma das duas chaves é escrita em lugar algum: os vínculos médico-paciente são gravados em 'irec_assignments' (supabaseService.js:81, saveLocalAssignments) e as evoluções de ferida são gravadas por usuário em `irec_entries_${userId}` (supabaseService.js:71-77). Assim a função retorna sempre [] em contingência, e todas as métricas derivadas de woundEntries — latestWoundEntriesPerPatient (linha 84), finalizedCount (linha 98) e returnRatePct (linha 109) — ficam permanentemente em zero. Note que getAssignedPatients usa a chave CORRETA ('irec_assignments' via getLocalAssignments), o que produz um painel autocontraditório.

**Como falha:** O app roda em modo contingência local (Supabase não configurado). O médico tem 8 pacientes vinculados, vários com alta registrada e múltiplas evoluções. O painel mostra 'PACIENTES VINCULADOS: 8' (que lê a chave certa) e, ao lado, 'CASOS FINALIZADOS: 0' e 'TAXA DE RETORNO: 0% — 0 de 0 pacientes com evoluções'. Os indicadores clínicos do médico são apresentados como zero absoluto sem nenhum aviso de indisponibilidade.

**Código atual:**

```jsx
getDoctorPatientsWoundEntries(currentUser.id),
// supabaseService.js:2752-2755:
// const assignments = JSON.parse(localStorage.getItem('irec_local_assignments') || '[]');
// const allWounds = JSON.parse(localStorage.getItem('irec_local_wound_entries') || '[]');
// mas a gravação usa 'irec_assignments' (linha 81) e `irec_entries_${userId}` (linha 77)
```

**Correção sugerida:** Corrigir getDoctorPatientsWoundEntries para usar getLocalAssignments() e as chaves `irec_entries_${patientId}` de cada paciente vinculado.

<details><summary>Verificação feita contra o código</summary>

Confirmei por grep que 'irec_local_assignments' e 'irec_local_wound_entries' aparecem apenas em leituras (supabaseService.js:2717, 2734, 2752, 2754, 2661) e nunca em escrita; as gravações reais usam 'irec_assignments' (linhas 80-81, getLocalAssignments/saveLocalAssignments) e `irec_entries_${userId}` (linhas 72/77). Logo getDoctorPatientsWoundEntries retorna [] em contingência, zerando latestWoundEntriesPerPatient (linha 84), finalizedCount (98) e returnRatePct (109), enquanto getAssignedPatients usa a chave certa — painel autocontraditório, e é exatamente o modo em que o app roda hoje.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0107 · ALTO · `CONFIRMADO`

**Período 'Últimos 15 dias' não é tratado e cai no ramo 'all': painel mostra o histórico inteiro**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:66`

**O defeito:** getFilteredCalls só trata '24h', '7d', '30d' e 'custom'; qualquer outro valor cai no else que retorna calls sem nenhum filtro. O DateRangePicker, porém, oferece o preset '15d' e grava exatamente esse valor via setTimePeriod('15d') (DateRangePicker.jsx:58-62), sendo também o valor que o botão destaca como selecionado (DateRangePicker.jsx:258). Não há default nem validação.

**Como falha:** O médico abre o seletor de período e escolhe 'Últimos 15 dias'. O rótulo do botão passa a exibir 'Últimos 15 dias', mas o painel volta a contar TODAS as teleconsultas desde o início do cadastro. Ele lê '84 atendimentos no período' e '1.260 minutos dedicados' acreditando serem os últimos 15 dias, e compara esse número com o dos 30 dias (que é menor), obtendo dados incoerentes.

**Código atual:**

```jsx
} else {
      return calls; // 'all'
    }
```

**Correção sugerida:** Adicionar o ramo '15d' (thresholdDate.setDate(now.getDate() - 15)) e um default seguro para períodos desconhecidos.

<details><summary>Verificação feita contra o código</summary>

getFilteredCalls (linhas 42-69) trata apenas '24h', '7d', '30d' e 'custom'; o else da linha 66 devolve calls inteiro. Confirmei em DateRangePicker.jsx que o preset '15d' existe e grava exatamente esse valor (linhas 58-62), aparece na lista de opções (linha 258) e no rótulo (linha 90). Portanto escolher 'Últimos 15 dias' exibe o rótulo correto e conta todo o histórico, sem qualquer indicação.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0108 · ALTO · `CONFIRMADO`

**KPI 'finalizados com sucesso' e 'Taxa de conclusão' são sempre 0: o status gravado é 'ended', não 'completed'**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:75`

**O defeito:** completedCalls filtra c.status === 'completed' || c.status === 'finished'. O encerramento real de chamada grava 'ended': Telemedicine.jsx:1046 chama updateCallStatus(activeCall.id, 'ended', callDuration), e os únicos outros valores escritos são 'accepted' e 'rejected' (Telemedicine.jsx:1021/1031, App.jsx:2026/2045). Nenhum ponto do projeto grava 'completed' nem 'finished' em telemedicine_calls. Logo completedCalls é sempre 0, e as duas métricas derivadas (linhas 196, 263 e 337) são sempre zero.

**Como falha:** O médico realiza 12 teleconsultas na semana, todas encerradas normalmente pelo botão de finalizar. Ao abrir 'Meu Painel Clínico', o cartão exibe '12' atendimentos no período e, logo abaixo, '0 finalizados com sucesso', além de 'Taxa de conclusão de chamadas: 0%' em dois lugares. O médico conclui que o sistema não registrou nenhum atendimento concluído.

**Código atual:**

```jsx
const completedCalls = filteredCalls.filter(c => c.status === 'completed' || c.status === 'finished').length;
// Telemedicine.jsx:1046 -> await updateCallStatus(activeCall.id, 'ended', callDuration);
```

**Correção sugerida:** Incluir 'ended' no filtro (c.status === 'ended' || 'completed' || 'finished') aqui e padronizar o vocabulário de status das chamadas.

<details><summary>Verificação feita contra o código</summary>

Linha 75 filtra c.status === 'completed' || 'finished'. O grep em todo o src mostra que os únicos status escritos em telemedicine_calls são 'accepted' (Telemedicine.jsx:1021), 'rejected' (1031, App.jsx:2026) e 'ended' (Telemedicine.jsx:1046, único ponto que passa duração) — 'completed'/'finished' aparecem apenas em filtros de leitura (AdminReports, AdminDashboard) e em appointments, nunca como valor gravado em chamadas. Portanto completedCalls é sempre 0 e as métricas derivadas exibem 0 atendimentos concluídos e 0% de conclusão.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0109 · ALTO · `CONFIRMAR-SCHEMA`

**Tempo de teleconsulta sempre 0 minutos: campo local é 'duration', não 'duration_seconds'**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:76`

**O defeito:** A soma lê c.duration_seconds || c.durationSeconds. No caminho local de updateCallStatus (supabaseService.js:2266) a duração é gravada como calls[idx].duration = duration — nome diferente. Esse caminho local é usado não só quando isSupabaseConfigured é false, mas também sempre que o id da chamada não é numérico (supabaseService.js:2259-2261: isNumericId), o que ocorre com chamadas criadas localmente mesmo com o Supabase ativo. Nesses casos duration_seconds nunca existe e a soma resulta 0. O AdminDashboard.jsx:233 trata corretamente os dois nomes (c.duration_seconds || c.duration); aqui não.

**Como falha:** O médico faz três teleconsultas de 20, 35 e 15 minutos em modo contingência local (ou com ids de chamada não numéricos). No painel, o card 'Eficiência em Telemedicina' exibe '0 minutos dedicados', 'média de 0 minutos por chamada' e 'Total de Tempo Clínico On-line: 0 minutos', apesar de mais de uma hora real de atendimento registrada.

**Código atual:**

```jsx
const totalCallDuration = filteredCalls.reduce((acc, c) => acc + (parseInt(c.duration_seconds || c.durationSeconds || 0) / 60), 0);
// supabaseService.js:2265-2266 -> calls[idx].status = status; calls[idx].duration = duration;
```

**Correção sugerida:** Ler (c.duration_seconds || c.durationSeconds || c.duration || 0), como já faz AdminDashboard.jsx:233.

<details><summary>Verificação feita contra o código</summary>

Linha 76 lê c.duration_seconds || c.durationSeconds. Li updateCallStatus (supabaseService.js:2252-2271): o ramo local grava calls[idx].duration = duration (linha 2266) e esse ramo é usado quando !isSupabaseConfigured OU quando o id não é numérico (linha 2259-2261) — o que inclui chamadas criadas localmente mesmo com Supabase ativo. Nesses casos duration_seconds não existe e a soma dá 0. O AdminDashboard.jsx trata os dois nomes; aqui não. Hoje, com .env vazio, é o caminho padrão.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0272 · MÉDIO · `CONFIRMADO`

**Falha de carregamento da agenda é silenciosa e indistinguível de 'nenhuma consulta'**

**Onde:** `src/components/doctor/DoctorAgendaPage.jsx:44`

**O defeito:** O catch só faz console.error(e) e o finally desliga o loading. Não há estado de erro, mensagem ou botão de tentar novamente. Como doctorAppointments permanece [], a tela renderiza exatamente o mesmo resultado de uma agenda legitimamente vazia: 'Nenhuma consulta agendada para o dia selecionado' e todos os contadores dos filtros em zero.

**Como falha:** O token do Supabase expira ou a rede cai enquanto o médico abre a Agenda. A tela carrega normalmente, sem qualquer aviso, com todos os pills zerados ('Todas (0)') e o painel dizendo que não há consultas. O médico conclui que a agenda do dia está vazia e não comparece aos atendimentos que existem no servidor.

**Código atual:**

```jsx
} catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
```

**Correção sugerida:** Adicionar estado de erro no loadData e renderizar mensagem de falha com botão 'Tentar novamente' em vez do estado vazio.

<details><summary>Verificação feita contra o código</summary>

Linhas 44-48: o catch faz apenas console.error(e) e o finally desliga o loading; não há estado de erro nem retry. Com doctorAppointments = [], DoctorAgendaView renderiza exatamente o mesmo resultado de agenda vazia — pills 'Todas (0)' e 'Nenhuma consulta agendada para o dia selecionado' (linha 173). O médico não tem como distinguir falha de rede/RLS de agenda realmente vazia.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0273 · MÉDIO · `CONFIRMADO`

**Filtros 'Em Espera' e 'Concluídas' são ramos mortos: nenhum código grava esses status e não há ação para concluir consulta**

**Onde:** `src/components/doctor/DoctorAgendaView.jsx:53`

**O defeito:** Busca em todo o src confirma que as strings 'Em Espera' e 'Concluído' só existem dentro deste arquivo (linhas 53, 54, 137, 138, 200, 201) — nenhum serviço, formulário ou fluxo as grava. A única função capaz de mudar o status, updateAppointmentStatus (supabaseService.js:1367), está exportada e NUNCA é chamada em nenhum lugar do projeto. O único botão do card é 'Atender / Ver Prontuário' (linha 218), que apenas navega. Portanto os dois filtros são permanentemente (0), as cores amarela/verde são código inalcançável, e não existe forma de encerrar um agendamento.

**Como falha:** O médico atende a consulta das 14h e quer marcá-la como concluída para limpar a agenda. Não há nenhum controle para isso. A consulta permanece com status 'Agendado' indefinidamente, continua contando no pill 'Todas' e no contador da célula do dia para sempre, e os filtros '🟡 Em Espera (0)' e '🟢 Concluídas (0)' nunca saem de zero, sugerindo que o médico nunca concluiu nenhum atendimento.

**Código atual:**

```jsx
{ id: 'Em Espera', label: `🟡 Em Espera (${doctorAppointments.filter(a => a.status === 'Em Espera').length})` },
            { id: 'Concluído', label: `🟢 Concluídas (${doctorAppointments.filter(a => a.status === 'Concluído').length})` },
// updateAppointmentStatus (supabaseService.js:1367) não possui nenhum chamador no projeto
```

**Correção sugerida:** Adicionar ação 'Marcar como concluída/em espera' chamando updateAppointmentStatus, ou remover os filtros que nunca podem ter resultado.

<details><summary>Verificação feita contra o código</summary>

O grep por 'Em Espera' e 'Concluído' em todo o src retorna somente este arquivo (linhas 53, 54, 137, 138, 200, 201) — nenhum serviço grava esses valores. O grep por updateAppointmentStatus retorna apenas a definição em supabaseService.js:1367, sem nenhum chamador. E o único botão do card (linha 218-224) apenas navega. Logo os dois pills ficam permanentemente em (0), as cores amarela/verde são inalcançáveis e não existe forma na UI de encerrar um agendamento.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0274 · MÉDIO · `CONFIRMADO`

**Consulta sem preço é exibida como 'Pago', ignorando o paymentStatus disponível**

**Onde:** `src/components/doctor/DoctorAgendaView.jsx:213`

**O defeito:** A expressão usa app.price como condição de verdade: quando price é 0, null, undefined ou string vazia, o componente escreve 'Pago' em verde (#10b981), afirmando pagamento confirmado. O campo paymentStatus está disponível no objeto (mapeado em supabaseService.js:1530) e é simplesmente ignorado. Note que price = 0 é um valor legítimo (atendimento gratuito/convênio) e cai no mesmo ramo.

**Como falha:** Existe um agendamento gravado sem price (criado por outra rota, migração ou atendimento de cortesia). Na Agenda, o card mostra 'Pago' em verde no lugar do valor. O médico atende acreditando que a consulta está quitada, quando o paymentStatus pode ser 'pending'. O erro é sistematicamente favorável ao 'pago', nunca ao 'pendente'.

**Código atual:**

```jsx
{app.price ? `R$ ${app.price.toFixed(2)}` : 'Pago'}
```

**Correção sugerida:** Exibir o valor quando houver price e, caso contrário, derivar o rótulo de app.paymentStatus ('Pago'/'Pendente'/'Sem valor'), nunca assumir pagamento.

<details><summary>Verificação feita contra o código</summary>

Linha 213: {app.price ? `R$ ${app.price.toFixed(2)}` : 'Pago'}, renderizada em verde (#10b981, linha 212). Qualquer price falsy (0, null, undefined, '') resulta na afirmação 'Pago'. Confirmei que o mapeamento força price = 0 quando ausente (supabaseService.js:1528: item.price ? parseFloat(item.price) : 0), então o ramo é rotineiro, e que paymentStatus está disponível no mesmo objeto (linha 1530) e é simplesmente ignorado. O erro é sempre a favor de 'pago'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0290 · MÉDIO · `CONFIRMADO`

**Falha no carregamento apresenta todos os KPIs clínicos como zero, sem indicar erro**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:32`

**O defeito:** O Promise.all é envolvido por um único try/catch que apenas faz console.error. Não existe estado de erro nem mensagem na UI. Como é um Promise.all, a rejeição de UMA das quatro chamadas descarta o resultado das outras três: patients, woundEntries e calls permanecem [] e o painel renderiza normalmente com todos os indicadores em zero, incluindo o texto afirmativo 'Sem pacientes vinculados no momento.' (linha 299).

**Como falha:** Uma política de RLS bloqueia a consulta a doctor_patient_assignment ou a sessão expira. O médico abre 'Meu Painel Clínico' e vê, sem qualquer aviso: 0 atendimentos, 0 pacientes vinculados, 0 casos finalizados, 0% de retorno e 'Sem pacientes vinculados no momento.' O painel afirma que o médico não tem carteira de pacientes, em vez de informar que os dados não puderam ser carregados.

**Código atual:**

```jsx
} catch (err) {
        console.error('Error fetching doctor analytics:', err);
      } finally {
        setLoading(false);
      }
```

**Correção sugerida:** Usar Promise.allSettled e expor um estado de erro por bloco ('não foi possível carregar') em vez de renderizar zeros.

<details><summary>Verificação feita contra o código</summary>

Linhas 20-36: um único Promise.all com quatro chamadas dentro de um try cujo catch faz apenas console.error, sem estado de erro na UI. Sendo Promise.all, a rejeição de qualquer uma descarta as outras três e patients/woundEntries/calls ficam [], levando o painel a renderizar 0 em todos os KPIs e o texto afirmativo de carteira vazia. Falha de dado apresentada como resultado clínico real.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0291 · MÉDIO · `CONFIRMADO`

**Intervalo personalizado exclui o dia final inteiro: new Date('yyyy-mm-dd') em UTC + setHours local**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:60`

**O defeito:** new Date(endDate) com uma string 'yyyy-mm-dd' é interpretada como meia-noite UTC. Em UTC-3 esse instante equivale a 21:00 do DIA ANTERIOR em hora local. O setHours(23,59,59,999) subsequente opera em hora LOCAL, movendo o limite para 23:59:59 do dia anterior — e não do dia escolhido. O mesmo desvio afeta o início: new Date(startDate) posiciona o corte às 21:00 do dia anterior, incluindo 3 horas indevidas. O DateRangePicker gera exatamente essas strings via toISOString().split('T')[0] (DateRangePicker.jsx:52) e handleDayClick (linha 108).

**Como falha:** O médico seleciona o intervalo 01/08 a 10/08 para fechar o relatório do período. As teleconsultas realizadas no dia 10/08 (o dia final escolhido) são todas descartadas do cálculo, porque endLimit acaba valendo 09/08 23:59:59 no horário local. Simultaneamente, atendimentos feitos após as 21:00 de 31/07 entram no total. O médico fecha o mês com contagem errada nas duas pontas.

**Código atual:**

```jsx
if (startDate && new Date(startDate) > callDate) return false;
        if (endDate) {
          const endLimit = new Date(endDate);
          endLimit.setHours(23, 59, 59, 999);
          if (callDate > endLimit) return false;
        }
```

**Correção sugerida:** Parsear com new Date(endDate + 'T23:59:59.999') e new Date(startDate + 'T00:00:00') para trabalhar em hora local.

<details><summary>Verificação feita contra o código</summary>

Linhas 55-65: new Date(endDate) com string 'yyyy-mm-dd' é meia-noite UTC, que em UTC-3 corresponde às 21:00 do dia anterior local; o setHours(23,59,59,999) opera em hora local e leva o limite para 23:59:59 do dia ANTERIOR ao escolhido. O mesmo desvio afeta o início (inclui 3 horas indevidas do dia anterior). Confirmei que DateRangePicker gera exatamente essas strings (toISOString().split('T')[0], linhas 51-77, e handleDayClick na linha 108).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0292 · MÉDIO · `CONFIRMADO`

**Média de duração da chamada é diluída por chamadas rejeitadas e não atendidas**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:77`

**O defeito:** avgCallDuration divide o tempo total pelo total de registros do período (totalCalls), que inclui chamadas com status 'rejected' (Telemedicine.jsx:1031, App.jsx:2026), 'ringing' e 'accepted' sem duração — todas com duração 0. O divisor correto seria o número de chamadas efetivamente realizadas com duração > 0. O AdminDashboard.jsx:234 faz exatamente isso, dividindo por completedCalls.length. Além disso, cada parcela já é arredondada implicitamente por parseInt antes da divisão por 60, e o resultado passa por Math.round, o que zera qualquer média abaixo de 30 segundos.

**Como falha:** O médico realiza 2 teleconsultas de 30 minutos e recebe 8 chamadas perdidas/rejeitadas no mesmo período. O painel calcula 60 minutos ÷ 10 chamadas e exibe 'Média de Duração da Chamada: 6 minutos' em dois lugares (linhas 259 e 327). O indicador de produtividade do médico é subestimado em 5 vezes.

**Código atual:**

```jsx
const avgCallDuration = totalCalls > 0 ? Math.round(totalCallDuration / totalCalls) : 0;
```

**Correção sugerida:** Dividir apenas pelas chamadas efetivamente realizadas (duração > 0 / status encerrado), não por todos os registros do período.

<details><summary>Verificação feita contra o código</summary>

Linha 77: avgCallDuration = totalCallDuration / totalCalls, e totalCalls (linha 74) é filteredCalls.length, incluindo registros com status 'rejected'/'ringing'/'accepted' de duração 0 — confirmei que 'rejected' é efetivamente gravado (Telemedicine.jsx:1031, App.jsx:2026). O divisor correto seria o número de chamadas com duração > 0, como faz AdminDashboard.jsx:234. O Math.round também zera médias abaixo de 30 s. Subestima sistematicamente a produtividade.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0293 · MÉDIO · `CONFIRMADO`

**Seletor de período não afeta pacientes, casos finalizados, taxa de retorno nem perfil de comorbidades**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:80`

**O defeito:** Apenas calls passa por getFilteredCalls. patients, woundEntries e partners são usados brutos: totalPatients (linha 80), latestWoundEntriesPerPatient/finalizedCount (linhas 84-98), patientEntryCounts/returnRatePct (linhas 101-111), totalRecommendedProducts (linha 114) e getDoctorPathologyStats (linhas 120-145) ignoram completamente timePeriod/startDate/endDate. Ainda assim o DateRangePicker está posicionado no header (linha 173), acima de todos os cards, e o card da direita anuncia 'Métricas de Teleconsultas no Período' — sugerindo que o recorte vale para o painel inteiro.

**Como falha:** O médico seleciona 'Hoje' para ver a produção do dia. O cartão 'ATENDIMENTOS NO PERÍODO' cai para 2, mas 'CASOS FINALIZADOS' continua mostrando os 37 casos de toda a carteira histórica e a 'TAXA DE RETORNO' continua em 68% de todo o histórico, lado a lado, sob o mesmo seletor de período. O médico lê os números como se todos se referissem ao dia.

**Código atual:**

```jsx
const filteredCalls = getFilteredCalls();
// ...
  // 2. Pacientes Atendidos (Total assigned patients)
  const totalPatients = patients.length;
```

**Correção sugerida:** Aplicar o mesmo recorte temporal às wound entries/pacientes ou rotular explicitamente cada card como 'no período' vs 'histórico total'.

<details><summary>Verificação feita contra o código</summary>

Só calls passa por getFilteredCalls (linha 71). Verifiquei que totalPatients (80), latestWoundEntriesPerPatient/finalizedCount (84-98), patientEntryCounts/returnRatePct (101-111), totalRecommendedProducts (114) e getDoctorPathologyStats (120-145) usam os arrays brutos, sem qualquer referência a timePeriod/startDate/endDate. Com o DateRangePicker no header acima de todos os cards, o médico lê números de escopos diferentes lado a lado como se fossem do mesmo período.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0294 · MÉDIO · `CONFIRMAR-SCHEMA`

**Contador de 'Farmácias/Marcas ativas' lê campo inexistente p.pharmacy**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:116`

**O defeito:** getRecommendedMaterials devolve as linhas cruas de recommended_materials (supabaseService.js:2510-2516, sem mapeamento de nomes), portanto em snake_case. A coluna real é pharmacy_name — usada corretamente em DoctorPartners.jsx:58/317, AdminPartners.jsx:52/136 e DoctorDashboard.jsx:626/3072. O campo 'pharmacy' não existe em nenhum ponto do projeto, então o segundo operando do || nunca contribui e o Set agrupa apenas por brand. Pior: DoctorPartners.jsx:55 grava brand fixo 'Parceria de Vendas Geral' em toda parceria de farmácia cadastrada, colapsando todas elas em um único valor.

**Como falha:** O médico cadastra 4 farmácias parceiras pela tela 'Parcerias' (todas gravadas com brand = 'Parceria de Vendas Geral' e pharmacy_name distinto). No painel clínico, o rodapé do card de parcerias exibe '🤝 Farmácias/Marcas ativas no seu catálogo: 1'. O médico acredita que 3 dos 4 cadastros falharam.

**Código atual:**

```jsx
const uniquePartnerBrands = new Set(
    partners.map(p => p.brand || p.pharmacy || '').filter(Boolean)
  ).size;
```

**Correção sugerida:** Trocar por p.pharmacy_name || p.brand no Set de parceiros únicos.

<details><summary>Verificação feita contra o código</summary>

Linha 116: p.brand || p.pharmacy. Confirmei que getRecommendedMaterials devolve as linhas cruas de recommended_materials (supabaseService.js:2510-2516, return data sem mapeamento), portanto em snake_case, e que a coluna real é pharmacy_name — usada em DoctorPartners.jsx:58/95/317, AdminPartners.jsx:52/136, DoctorDashboard.jsx:626/3072 e ProtocolGuide.jsx. O grep não encontra nenhuma ocorrência do campo 'pharmacy' isolado no projeto, logo o segundo operando nunca contribui e o Set agrupa apenas por brand.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0476 · BAIXO · `CONFIRMADO`

**Propriedade de estilo inválida 'justify' quebra o alinhamento do cabeçalho da Agenda**

**Onde:** `src/components/doctor/DoctorAgendaPage.jsx:60`

**O defeito:** O objeto de estilo usa a chave 'justify', que não existe em CSS nem em React (o correto é justifyContent). O React não aplica a propriedade e emite aviso no console. O container permanece flex sem distribuição, colando os dois blocos à esquerda em vez de separar título e badge de CRM. O mesmo erro existe em DoctorPatientsListView.jsx:19.

**Como falha:** Qualquer médico que abra a Agenda vê o bloco 'CRM/Registro' encostado no texto 'Profissional logado: Dr(a)...' em vez de alinhado à direita do cabeçalho, com espaço em branco sobrando na direita do card.

**Código atual:**

```jsx
<div className="clinician-header" style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
```

**Correção sugerida:** Trocar 'justify' por justifyContent: 'space-between' nos dois arquivos.

<details><summary>Verificação feita contra o código</summary>

Linha 60: style={{ display: 'flex', justify: 'space-between', ... }}. 'justify' não é propriedade CSS nem chave válida de style no React; o valor é ignorado e o container fica sem distribuição, colando o bloco de CRM ao texto de boas-vindas. Mesmo erro em DoctorPatientsListView.jsx:19 (confirmado na leitura). É defeito visual real, porém puramente cosmético.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0477 · BAIXO · `CONFIRMAR-SCHEMA`

**app.patientEmail nunca existe nos agendamentos vindos do Supabase**

**Onde:** `src/components/doctor/DoctorAgendaPage.jsx:114`

**O defeito:** O objeto sintético grava email: app.patientEmail, mas o mapeamento de getDoctorAppointments (supabaseService.js:1515-1532) não expõe nenhum campo patientEmail — e o insert de createAppointment (supabaseService.js:1414-1430) nem grava a coluna patient_email, apesar de BookingModal.jsx:61 montar patientEmail no objeto local. Portanto, para qualquer agendamento lido do banco, app.patientEmail é undefined.

**Como falha:** O médico abre um paciente pela Agenda. O perfil selecionado passa a ter email: undefined. Qualquer tela que use selectedPatient.email (contato, envio de documento, identificação no prontuário) exibe vazio ou 'undefined', e o médico não tem o e-mail do paciente disponível mesmo estando cadastrado no perfil clínico.

**Código atual:**

```jsx
setSelectedPatient({ id: app.patientId, name: app.patientName, email: app.patientEmail });
// supabaseService.js:1515-1532 não retorna patientEmail
```

**Correção sugerida:** Remover o campo email do objeto sintético (ou passar a persistir/mapear patient_email) e carregar o perfil real antes de abrir o prontuário.

<details><summary>Verificação feita contra o código</summary>

Verifiquei o mapeamento de getDoctorAppointments (supabaseService.js:1515-1532): não há patientEmail, e o payload de createAppointment (1414-1430) não grava coluna patient_email. Logo, para agendamento lido do banco, app.patientEmail é undefined e o objeto sintético fica com email: undefined. Reduzo a severidade: o campo só é usado no ramo em que o paciente não foi encontrado, que já é o defeito maior do item 50185 — este é um sub-sintoma cosmético dele.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0478 · BAIXO · `CONFIRMAR-SCHEMA`

**Células do calendário são divs clicáveis sem role, tabIndex ou handler de teclado**

**Onde:** `src/components/doctor/DoctorAgendaView.jsx:103`

**O defeito:** Cada dia do mês é um <div onClick> com cursor pointer, sem role="button"/"gridcell", sem tabIndex, sem onKeyDown e sem aria-label/aria-selected. Selecionar um dia é a única forma de ver as consultas daquele dia, portanto a função central da tela fica inacessível por teclado e o leitor de tela não anuncia o elemento como interativo nem informa o estado selecionado.

**Como falha:** Um profissional que navega por teclado (ou usa leitor de tela) abre a Agenda. O Tab passa pelos botões de mês e pelos pills de filtro, mas nunca chega às células dos dias: não há como selecionar outro dia nem descobrir quantas consultas ele tem. A única data acessível é a inicial.

**Código atual:**

```jsx
<div
              key={dayObj.dateStr}
              onClick={() => setSelectedCalendarDateStr(dayObj.dateStr)}
              style={{
                minHeight: '75px',
```

**Correção sugerida:** Converter a célula em <button type="button"> (ou div com role="gridcell", tabIndex={0}, onKeyDown Enter/Espaço e aria-selected).

<details><summary>Verificação feita contra o código</summary>

Linhas 101-115: cada dia é <div key onClick style={{cursor:'pointer'}}> sem role, tabIndex, onKeyDown, aria-label ou aria-selected. Como selecionar o dia é a única maneira de listar as consultas daquele dia (painel da linha 163), a função central da tela é inacessível por teclado e o leitor de tela não anuncia a célula como interativa nem seu estado de seleção.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0479 · BAIXO · `CONFIRMADO`

**key={appIdx} em lista que muda de conteúdo conforme o filtro de status**

**Onde:** `src/components/doctor/DoctorAgendaView.jsx:131`

**O defeito:** As prévias de consulta dentro da célula do dia usam o índice do array como key, embora dayApps seja recalculado a cada mudança de agendaStatusFilter e a cada recarga de doctorAppointments — ou seja, a mesma posição 0 pode passar a representar outra consulta. O objeto possui app.id (usado corretamente na linha 182). Com key por índice o React reaproveita o nó DOM anterior e pode manter estilos/estado visual do item antigo.

**Como falha:** O médico alterna do filtro 'Todas' para 'Agendadas'. Nas células do calendário, o React reaproveita os nós por posição em vez de por identidade, podendo exibir transitoriamente o horário/nome de uma consulta com a cor de status da consulta anterior naquela posição.

**Código atual:**

```jsx
{dayApps.slice(0, 2).map((app, appIdx) => (
                  <div 
                    key={appIdx} 
```

**Correção sugerida:** Usar key={app.id} nas prévias dentro da célula do dia.

<details><summary>Verificação feita contra o código</summary>

Linha 129-131: dayApps.slice(0,2).map((app, appIdx) => <div key={appIdx}>. dayApps é recalculado a cada mudança de agendaStatusFilter e a cada recarga, então a mesma posição pode representar outra consulta, e app.id existe (usado corretamente na linha 182). O impacto real, porém, é apenas transitório/visual — os nós não têm estado interno nem animação —, então mantenho severidade baixa.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0480 · BAIXO · `CONFIRMADO`

**Componente inteiro é código morto: nunca é importado, e a prop formatDate é recebida sem uso**

**Onde:** `src/components/doctor/DoctorPatientsListView.jsx:12`

**O defeito:** Busca por 'PatientsListView' em todos os arquivos .js/.jsx de src retorna apenas a própria declaração deste arquivo — nenhum import em App.jsx nem em DoctorDashboard.jsx (que implementa sua própria lista de pacientes internamente, ver DoctorDashboard.jsx:1788). Além disso, a prop formatDate é desestruturada na linha 12 e nunca utilizada no corpo do componente, indicando que a exibição de datas (última consulta/última evolução) prevista na interface nunca foi implementada. Todos os defeitos listados acima para este arquivo estão portanto latentes, e a versão realmente exibida ao médico é outra — o que faz correções aplicadas aqui não surtirem efeito em produção.

**Como falha:** Um desenvolvedor recebe o relato 'o alerta de infecção não aparece na lista de pacientes', encontra este arquivo pelo nome, corrige o campo hasInfectionSigns e valida no app: nada muda, porque a tela renderizada é a lista embutida em DoctorDashboard.jsx. O tempo é gasto em um arquivo que não é executado.

**Código atual:**

```jsx
export default function DoctorPatientsListView({
  filteredPatients,
  ...
  onOpenChat,
  formatDate
}) {
```

**Correção sugerida:** Integrar o componente na tela de pacientes do médico (substituindo a lista embutida em DoctorDashboard.jsx) ou removê-lo do repositório.

<details><summary>Verificação feita contra o código</summary>

O grep por DoctorPatientsListView em todo o src retorna apenas a própria declaração (linha 3) — nenhum import em App.jsx nem em DoctorDashboard.jsx, ao contrário de DoctorAgendaPage e DoctorDashboardAnalytics, que aparecem importados em App.jsx:17-18 e usados em 863/866. Também confirmei que formatDate é desestruturada na linha 12 e não aparece em nenhum outro ponto do corpo. Isso valida a observação e é a razão de eu rebaixar os itens 50208-50213 deste arquivo para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0481 · BAIXO · `CONFIRMADO`

**Propriedade de estilo inválida 'justify' na barra de busca e filtros**

**Onde:** `src/components/doctor/DoctorPatientsListView.jsx:19`

**O defeito:** O objeto de estilo do container flex usa a chave 'justify' em vez de justifyContent. O React não reconhece a propriedade, ela não é aplicada e o alinhamento pretendido entre o campo de busca e o grupo de botões de filtro não acontece. Mesmo defeito de DoctorAgendaPage.jsx:60.

**Como falha:** Em telas largas, o campo de busca e os botões de filtro ficam encostados um no outro à esquerda do card, com espaço vazio à direita, em vez de distribuídos nas extremidades como o layout pretende.

**Código atual:**

```jsx
<div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
```

**Correção sugerida:** Trocar 'justify' por justifyContent: 'space-between'.

<details><summary>Verificação feita contra o código</summary>

Li a linha 19: style={{ display: 'flex', justify: 'space-between', ... }} — chave inexistente em CSS/React, ignorada na renderização, deixando busca e filtros sem a distribuição pretendida. Mesmo defeito de DoctorAgendaPage.jsx:60. Cosmético e, aqui, em componente não utilizado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0482 · BAIXO · `CONFIRMADO`

**Contador do botão 'Meus Pacientes' mostra o total já filtrado, não o total de pacientes**

**Onde:** `src/components/doctor/DoctorPatientsListView.jsx:61`

**O defeito:** O rótulo do botão de filtro 'Meus Pacientes' usa filteredPatients.length — o array que já sofreu a busca por texto e o filtro ativo. O contador que deveria representar o tamanho da carteira passa a refletir o próprio resultado filtrado, e nenhuma prop com o total sem filtro é recebida pelo componente.

**Como falha:** O médico tem 25 pacientes. Ele digita 'mar' na busca e a lista reduz para 2; o botão passa a exibir '📋 Meus Pacientes (2)'. Ao clicar em '⚠️ Alertas de Infecção', o mesmo botão exibe a contagem do recorte de infecção. Em nenhum momento o médico consegue ver quantos pacientes tem de fato na carteira.

**Código atual:**

```jsx
📋 Meus Pacientes ({filteredPatients.length})
```

**Correção sugerida:** Receber uma prop totalPatients (lista sem filtro) e usá-la no rótulo do botão.

<details><summary>Verificação feita contra o código</summary>

Linha 61 usa filteredPatients.length no rótulo do botão de filtro, e o componente não recebe nenhuma prop com o total sem filtro (assinatura nas linhas 3-13). O contador realmente reflete o próprio recorte ativo. Severidade rebaixada: o componente é código morto, não importado em nenhum arquivo do projeto.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0483 · BAIXO · `CONFIRMADO`

**filteredPatients sem valor default: componente estoura se a prop não for passada**

**Onde:** `src/components/doctor/DoctorPatientsListView.jsx:83`

**O defeito:** A prop filteredPatients é desestruturada sem default (linha 4) e é usada imediatamente como array em três pontos: filteredPatients.length (linhas 61 e 83) e filteredPatients.map (linha 93). Nenhuma guarda (?? [], Array.isArray, optional chaining) existe. Compare com DoctorAgendaView.jsx:4, que define doctorAppointments = [] como default. Como o componente não é importado em nenhum arquivo fonte do projeto (grep em src confirma que só a própria declaração existe), o defeito está latente e será acionado na primeira integração.

**Como falha:** Ao integrar a lista em uma tela nova, o desenvolvedor renderiza <DoctorPatientsListView selectedPatient={...} setSelectedPatient={...} /> sem passar filteredPatients (ou passando o resultado de um fetch ainda undefined). O render quebra com 'TypeError: Cannot read properties of undefined (reading "length")' e derruba a árvore, em vez de exibir o estado vazio já previsto na linha 84.

**Código atual:**

```jsx
{filteredPatients.length === 0 ? (
```

**Correção sugerida:** Declarar filteredPatients = [] no destructuring das props.

<details><summary>Verificação feita contra o código</summary>

A prop é desestruturada sem default (linha 4) e usada como array nas linhas 61, 83 e 93, sem qualquer guarda. DoctorAgendaView.jsx:4 usa doctorAppointments = [] como default, confirmando a inconsistência. Porém, como o próprio item admite e o grep confirma, o componente não é importado em nenhum lugar — o defeito é puramente latente, o que não sustenta severidade média.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0484 · BAIXO · `CONFIRMADO`

**Alerta de infecção nunca é exibido: patient.hasInfectionSigns e patient.lesionType não existem no modelo de dados**

**Onde:** `src/components/doctor/DoctorPatientsListView.jsx:150`

**O defeito:** Busca em todo o src mostra que 'hasInfectionSigns' e 'lesionType' aparecem exclusivamente neste arquivo (linhas 148 e 150). Os mapeamentos de perfil de paciente em supabaseService.js — getAllPatients (1200-1243) e getAssignedPatients (1682-1730) — não expõem nenhum desses campos; sinais de infecção e tipo de lesão pertencem às wound_entries, não ao clinical_profile. Portanto o pill sempre cai no texto default e o bloco de alerta é código inalcançável, o que torna o botão de filtro '⚠️ Alertas de Infecção' (linha 64) inútil.

**Como falha:** O médico abre a lista de pacientes procurando quem tem sinal de infecção. Todos os cards exibem '🩺 Sem lesão registrada' — inclusive pacientes com úlcera ativa — e nenhum card mostra o selo vermelho '⚠️ Alerta de Infecção', mesmo havendo pacientes com sinais de infecção registrados nas evoluções. Clicar em 'Alertas de Infecção' apenas muda a cor do botão.

**Código atual:**

```jsx
🩺 {patient.lesionType || 'Sem lesão registrada'}
                  </span>
                  {patient.hasInfectionSigns && (
```

**Correção sugerida:** Derivar sinais de infecção e tipo de lesão da última wound entry do paciente e passá-los explicitamente ao componente.

<details><summary>Verificação feita contra o código</summary>

O grep por hasInfectionSigns/lesionType em todo o src retorna exclusivamente as linhas 148 e 150 deste arquivo — nenhum mapeamento de perfil (getAllPatients 1200-1243, getAssignedPatients) expõe esses campos, que de fato pertenceriam às wound entries. Logo o pill sempre cai no default e o bloco de alerta é inalcançável. Rebaixo a severidade porque o componente inteiro não é importado em lugar nenhum (ver item 50214): o defeito é latente, nenhum médico vê essa tela hoje.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0485 · BAIXO · `CONFIRMADO`

**Botão de telemedicina não faz nada quando onOpenChat não é fornecido**

**Onde:** `src/components/doctor/DoctorPatientsListView.jsx:180`

**O defeito:** O handler é onClick={() => onOpenChat && onOpenChat(patient.id)}: se o callback não for passado (é uma prop opcional, sem default e sem validação), o clique é silenciosamente descartado. O botão continua com aparência ativa, cursor de clique e title 'Telemedicina', sem qualquer indicação de indisponibilidade.

**Como falha:** A lista é montada em uma tela que esquece de passar onOpenChat. O médico clica repetidamente no botão 📹 para iniciar a teleconsulta com o paciente e nada acontece — nenhuma navegação, nenhum erro, nenhum feedback. Ele conclui que a telemedicina está fora do ar.

**Código atual:**

```jsx
onClick={() => onOpenChat && onOpenChat(patient.id)}
```

**Correção sugerida:** Renderizar o botão apenas quando onOpenChat existir, ou desabilitá-lo (disabled={!onOpenChat}).

<details><summary>Verificação feita contra o código</summary>

Linha 180: onClick={() => onOpenChat && onOpenChat(patient.id)} — o clique é descartado em silêncio se a prop não vier, com o botão mantendo aparência ativa. É um defeito real de UX defensiva, mas latente (componente não renderizado em lugar nenhum) e condicionado a um erro futuro de integração.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0486 · BAIXO · `CONFIRMADO`

**Botão de ação identificado apenas por emoji, sem nome acessível explícito**

**Onde:** `src/components/doctor/DoctorPatientsListView.jsx:188`

**O defeito:** O botão que inicia a teleconsulta tem como único conteúdo o emoji 📹, sem aria-label. Depende exclusivamente do atributo title para gerar nome acessível, que é fallback frágil (não é anunciado de forma consistente por todos os leitores de tela nem exposto em navegação por voz) e, em toque no mobile, o title não é exibido. O botão irmão ao lado ('📋 Ver Prontuário', linha 176) tem texto; este não.

**Como falha:** Um profissional que usa leitor de tela (ou controle por voz, dizendo 'clicar em Telemedicina') percorre o card do paciente. O segundo botão é anunciado apenas como 'câmera de vídeo, botão' ou 'botão', sem indicar que inicia uma teleconsulta, e não é acionável por comando de voz pelo nome visível.

**Código atual:**

```jsx
<button
                    className="btn btn-secondary"
                    onClick={() => onOpenChat && onOpenChat(patient.id)}
                    style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '8px' }}
                    title="Telemedicina"
                  >
                    📹
                  </button>
```

**Correção sugerida:** Adicionar aria-label="Iniciar teleconsulta" ao botão, mantendo o title.

<details><summary>Verificação feita contra o código</summary>

Linhas 178-189: o botão tem como conteúdo apenas o emoji 📹 e depende só do atributo title para nome acessível, ao contrário do botão irmão da linha 176 que tem texto. title é fallback frágil para leitores de tela e controle por voz e não aparece em toque no mobile. Defeito real de acessibilidade, embora em componente não renderizado hoje.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0496 · BAIXO · `CONFIRMAR-SCHEMA`

**Grid fixo de duas colunas sem media query e com flexWrap inócuo quebra o painel no celular**

**Onde:** `src/components/DoctorDashboardAnalytics.jsx:290`

**O defeito:** O container usa display grid com gridTemplateColumns '1fr 1fr' rígido e gap de 24px, mais flexWrap: 'wrap' — propriedade que não tem efeito algum em container grid (só se aplica a flex). Não há media query nem minmax/auto-fit (ao contrário dos grids das linhas 184 e 244, que usam auto-fit com minmax). O container externo (linha 159) ainda soma padding de 30px de cada lado.

**Como falha:** O médico abre o painel no app Android em tela de 360px de largura. As duas colunas ('Perfil Clínico da sua Carteira' e 'Métricas de Teleconsultas') permanecem lado a lado com cerca de 138px úteis cada, comprimindo as barras de percentual e quebrando os rótulos de comorbidade e os valores em várias linhas ou causando estouro horizontal.

**Código atual:**

```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
```

**Correção sugerida:** Trocar por gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' e remover o flexWrap.

<details><summary>Verificação feita contra o código</summary>

O container usa gridTemplateColumns: '1fr 1fr' inline com flexWrap: 'wrap' — propriedade sem efeito algum em container grid. Estilo inline não pode ser sobrescrito por folha de estilo sem !important, e verifiquei que a única regra !important de grid-template-columns em index.css (linha 878) está dentro do bloco @media print e mira .history-charts-grid, ou seja, não cobre este container. Sem media query nem auto-fit/minmax (usados corretamente nas linhas 184 e 244), as duas colunas permanecem lado a lado em telas estreitas.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "DoctorDashboardAnalytics.jsx|DoctorAgendaPage.jsx|DoctorAgendaView.jsx|DoctorPatientsListView.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
