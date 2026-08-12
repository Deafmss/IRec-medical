# 11. Agendamento e consultas

**39 defeitos** — 2 crítico · 8 alto · 20 médio · 9 baixo

Arquivos tocados por este módulo:

- `src/components/BookingModal.jsx`
- `src/components/DateRangePicker.jsx`
- `src/components/PatientAppointmentsCalendar.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0005 · CRÍTICO · `CONFIRMADO`

**Agendamento gravado como PAGO sem qualquer confirmação de pagamento**

**Onde:** `src/components/BookingModal.jsx:72`

**O defeito:** paymentStatus é hardcoded como 'paid' no payload enviado a createAppointment (supabaseService.js:1428 persiste payment_status). Não existe integração com PSP, nem verificação de recebimento do PIX, nem autorização de cartão. O único gate é a checagem de campos não vazios do cartão (linhas 52-56), e no fluxo PIX não há gate nenhum.

**Como falha:** Paciente escolhe PIX, NÃO paga nada, clica em 'CONFIRMAR E AGENDAR'. O agendamento é criado com payment_status='paid' e a tela de sucesso afirma 'Valor Pago: R$ 250,00 (PIX)' (linha 562). O profissional recebe um agendamento marcado como pago e realiza o atendimento sem nunca receber.

**Código atual:**

```jsx
price: price,
        paymentMethod: paymentMethod,
        paymentStatus: 'paid',
        status: 'Agendado'
```

**Correção sugerida:** Gravar paymentStatus: 'pending' até que uma confirmação real do PSP/webhook seja recebida.

<details><summary>Verificação feita contra o código</summary>

Linha 72 fixa paymentStatus: 'paid' no payload e supabaseService.js:1428 persiste payment_status com esse valor. handleConfirmPayment (46-96) só valida campos de cartão não vazios; no fluxo PIX não há gate algum e nenhuma chamada a PSP existe no arquivo. A tela de sucesso (linha 562) ainda afirma 'Valor Pago: R$ X (PIX)'. Falha alcançável em um clique.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0016 · CRÍTICO · `CONFIRMADO`

**Consultas clínicas FABRICADAS exibidas como reais quando o paciente não tem agendamentos**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:64`

**O defeito:** Se getPatientAppointments retorna lista vazia (paciente novo, sem consultas), o componente injeta três consultas inventadas com nomes de médicos, especialidades, preços, endereço de clínica e observações clínicas hardcoded (linhas 15-53). Esses dados falsos alimentam também os três KPIs (linhas 148-150), o calendário (linha 457) e o modal de detalhes. Não há qualquer marcação visual de 'demonstração'.

**Como falha:** Paciente recém-cadastrado abre a aba 'Minhas Consultas'. Ele vê 'Dr. Carlos Eduardo Santos - Estomaterapia' amanhã às 14:30 com a observação 'Avaliação de cicatriz em pé diabético e troca de curativo especial' e o card 'PRÓXIMAS CONSULTAS: 2'. Nenhuma dessas consultas existe: o paciente pode faltar a compromissos reais ou comparecer a 'Av. Paulista, 1000 - Cj 502' (endereço inventado na linha 36) acreditando ter consulta marcada.

**Código atual:**

```jsx
if (data && data.length > 0) {
  setAppointments(data);
} else {
  setAppointments(getMockAppointments());
}
```

**Correção sugerida:** Remover getMockAppointments e renderizar um estado vazio ('Você ainda não possui consultas agendadas') quando data estiver vazia.

<details><summary>Verificação feita contra o código</summary>

Li as linhas 15-77: getMockAppointments() devolve três consultas com médicos, especialidades, endereço 'Av. Paulista, 1000 - Cj 502', preços e observações clínicas hardcoded, e é injetado no state em três caminhos (lista vazia, sem currentUser.id e catch). Não há flag de demonstração nem qualquer marcação visual — os mesmos objetos alimentam KPIs (148-150), células do calendário (457) e o modal de detalhes. Dado clínico inventado apresentado como real.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0061 · ALTO · `CONFIRMAR-SCHEMA`

**Data padrão e atributo min do seletor calculados em UTC: pulam um dia à noite**

**Onde:** `src/components/BookingModal.jsx:10`

**O defeito:** selectedDate inicial faz tomorrow.toISOString().split('T')[0] e o min do input usa new Date().toISOString().split('T')[0]. Ambos convertem para UTC, adiantando um dia sempre que o horário local (UTC-3) estiver entre 21h e 00h.

**Como falha:** Às 22h de 10/08 em São Paulo: o campo já vem preenchido com 12/08 (dois dias à frente, não 'amanhã') e min='2026-08-11', de forma que o paciente fica IMPEDIDO de selecionar 11/08 pelo próprio date picker. Um paciente que precisa de curativo amanhã não consegue escolher amanhã.

**Código atual:**

```jsx
const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
...
min={new Date().toISOString().split('T')[0]}
```

**Correção sugerida:** Formatar as datas com getFullYear/getMonth/getDate locais (helper toLocalISODate) em vez de toISOString().

<details><summary>Verificação feita contra o código</summary>

Linhas 7-11 e 249 usam toISOString() sobre datas locais. Simulei 10/08 22h em UTC-3: 'tomorrow' local vira 11/08 22h = 12/08 01h UTC ⇒ selectedDate inicial '2026-08-12' (dois dias à frente) e min = '2026-08-11', impedindo a escolha de 11/08 no próprio picker. Comportamento determinístico em toda noite do fuso brasileiro.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0062 · ALTO · `CONFIRMADO`

**Código PIX 'copia e cola' é inválido (CRC fixo e campo de valor malformado)**

**Onde:** `src/components/BookingModal.jsx:29`

**O defeito:** O payload EMV é montado por concatenação de string com CRC16 hardcoded ('6304E8A2'), chave inventada ('irec-<id>-<timestamp>') e o campo 54 (valor) sem indicador de tamanho — '520400005303986540' seguido do valor sem os 2 dígitos de length. Qualquer app bancário rejeita o código, e o mesmo texto inválido é enviado ao gerador de QR (linha 443).

**Como falha:** Paciente clica em 'COPIAR CÓDIGO PIX COPIA E COLA', cola no app do banco e recebe 'QR Code inválido'. Se escanear o QR, o mesmo erro ocorre. Como o botão de confirmar não depende do pagamento, ele conclui o agendamento acreditando ter pago.

**Código atual:**

```jsx
const pixCode = `00020126580014BR.GOV.BCB.PIX0136irec-${professional.id.substring(0, 8)}-${Date.now()}520400005303986540${price.toFixed(2).replace('.', '')}5802BR5912iRec Saude6009Sao Paulo62070503***6304E8A2`;
```

**Correção sugerida:** Gerar o payload EMV com biblioteca de PIX (TLV correto + CRC16-CCITT calculado) ou obtê-lo do PSP.

<details><summary>Verificação feita contra o código</summary>

Verifiquei a string da linha 29 caractere a caractere: o campo 26 declara length 58 mas a chave 'irec-<8>-<13 dígitos>' tem 27 chars (declarados 36); após '5303986' vem '540' + valor sem indicador de tamanho correto; e o CRC16 é literal '6304E8A2', não calculado sobre o payload. Nenhum app bancário aceita esse EMV, e o mesmo texto vai ao gerador de QR (linha 443).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0063 · ALTO · `CONFIRMADO`

**Formulário de cartão de crédito sem qualquer validação além de 'não vazio'**

**Onde:** `src/components/BookingModal.jsx:53`

**O defeito:** A única checagem é a existência dos 4 campos. Não há validação de dígitos, algoritmo de Luhn, formato MM/AA, expiração no passado, nem tamanho de CVV. Além disso os dados do cartão nunca são enviados a nenhum gateway — o payload (linhas 58-74) não os inclui — mas o agendamento é marcado paymentStatus 'paid'.

**Como falha:** Paciente digita 'a' em nome, '1' em número, '1/1' em validade e '1' em CVV. A validação passa, o agendamento é criado como pago e a tela de sucesso informa 'Valor Pago: R$ 250,00 (CARD)'. Nenhuma cobrança existe e o paciente acredita ter pagado com cartão.

**Código atual:**

```jsx
if (paymentMethod === 'card') {
          if (!cardNumber || !cardHolder || !cardExpiry || !cardCvc) {
            throw new Error('Por favor, preencha todos os dados do cartão de crédito.');
          }
        }
```

**Correção sugerida:** Integrar um SDK/tokenização de PSP e só marcar como pago após autorização, validando formato dos campos antes do envio.

<details><summary>Verificação feita contra o código</summary>

Linhas 52-56 confirmam que a única checagem é a existência dos 4 campos — sem Luhn, formato MM/AA, expiração ou tamanho de CVV. E o payload (58-74) realmente não inclui nenhum dado de cartão, ainda assim marcando paymentStatus 'paid' e exibindo 'Valor Pago' na linha 562. Cobrança inexistente apresentada como concluída.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0064 · ALTO · `CONFIRMADO`

**Log de auditoria LGPD grava paciente e profissional invertidos**

**Onde:** `src/components/BookingModal.jsx:82`

**O defeito:** A assinatura real é createAuditLog(actionType, clinician, patient, details) (src/services/auditLogger.js:8, que preenche clinicianId/clinicianName/clinicianRole a partir do 2º argumento e patientId/patientName a partir do 3º). Aqui o 2º argumento é currentUser (o PACIENTE) e o 3º é professional (o MÉDICO/ENFERMEIRO). O registro imutável de auditoria fica com os papéis trocados.

**Como falha:** Paciente 'Maria Souza' agenda com 'Dra. Ana Paula Silva'. O log salvo em irec_log_acessos_prontuario fica: clinicianName='Maria Souza', clinicianRole='patient', patientName='Dra. Ana Paula Silva'. Na tela admin-logs (auditoria LGPD) consta que a paciente Maria atuou como clínica sobre o 'prontuário' da médica — a trilha de auditoria exigida pela LGPD é inutilizável e aponta o profissional errado.

**Código atual:**

```jsx
createAuditLog('Agendamento de Consulta', currentUser, professional, `Consulta ${modality === 'online' ? 'Online' : 'Presencial'} agendada para ${selectedDate} às ${selectedTime}`);
```

**Correção sugerida:** Inverter os argumentos: createAuditLog('Agendamento de Consulta', professional, currentUser, ...).

<details><summary>Verificação feita contra o código</summary>

auditLogger.js:8 é createAuditLog(actionType, clinician, patient, details) e preenche clinicianId/Name/Role do 2º argumento e patientId/Name do 3º. BookingModal.jsx:82 passa currentUser (paciente) como 2º e professional (profissional) como 3º — papéis efetivamente invertidos no registro. Rebaixo de crítico para alto porque a trilha é apenas localStorage ('irec_log_acessos_prontuario', 200 últimos), sem valor probatório externo, mas ainda assim é a tela de auditoria LGPD do admin.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0065 · ALTO · `CONFIRMADO`

**Visita domiciliar pode ser confirmada com endereço vazio**

**Onde:** `src/components/BookingModal.jsx:363`

**O defeito:** O botão 'IR PARA PAGAMENTO' do step 3 apenas chama setStep(4), sem validar patientAddress quando modality === 'presential'. O input do endereço (linha 315) não é required e handleConfirmPayment só valida campos de cartão. O payload grava address: patientAddress (linha 69), que pode ser string vazia.

**Como falha:** Paciente sem endereço no perfio (currentUser.street ausente ⇒ patientAddress inicia '' na linha 14) escolhe 'Visita Domiciliar', deixa o campo em branco, avança e confirma. O agendamento é criado com address: '' e paymentStatus 'paid'. O enfermeiro recebe uma visita domiciliar paga sem endereço para comparecer.

**Código atual:**

```jsx
onClick={() => setStep(4)}
...
address: modality === 'presential' ? patientAddress : 'Atendimento Online via Vídeo (Telemedicina)',
```

**Correção sugerida:** Bloquear o avanço quando modality === 'presential' && !patientAddress.trim(), exibindo mensagem de erro.

<details><summary>Verificação feita contra o código</summary>

O botão do step 3 (linhas 362-367) só faz setStep(4); o input de endereço (315-330) não tem required nem validação; handleConfirmPayment valida apenas cartão (52-56). Com currentUser sem street, patientAddress inicia '' (linha 14) e o payload grava address: '' (linha 69) junto com paymentStatus 'paid'. Alcançável sem esforço.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0088 · ALTO · `CONFIRMADO`

**Preset 'Últimos 15 dias' não é reconhecido por nenhum consumidor: exibe o período completo**

**Onde:** `src/components/DateRangePicker.jsx:258`

**O defeito:** handlePreset('15d') faz setTimePeriod('15d') (linha 59). AdminDashboard.getFilteredDataByPeriod (linhas 147-199) trata apenas '24h', '7d', '30d' e 'custom', caindo no else que retorna calls/logs/woundEntries SEM filtro. DoctorDashboardAnalytics.getFilteredCalls (linhas 46-68) tem exatamente a mesma lacuna.

**Como falha:** Admin abre admin-metrics, seleciona 'Últimos 15 dias'. O botão passa a exibir 'Últimos 15 dias', mas todos os números (chamadas, logs de auditoria, registros de feridas) passam a mostrar o histórico INTEIRO da plataforma — inclusive maior que o resultado anterior de 30 dias. Métricas de conformidade e faturamento são lidas como se fossem de 15 dias.

**Código atual:**

```jsx
{ id: '15d', label: 'Últimos 15 dias' },
// AdminDashboard.jsx:197
} else {
      return { callsFiltered: calls, logsFiltered: logs, woundEntriesFiltered: woundEntries };
```

**Correção sugerida:** Adicionar o ramo '15d' em getFilteredDataByPeriod (e nos demais consumidores) ou fazer o preset gravar timePeriod 'custom' com as datas.

<details><summary>Verificação feita contra o código</summary>

DateRangePicker.jsx:58-62 grava timePeriod '15d' (e o item existe na lista, linha 258), mas AdminDashboard.getFilteredDataByPeriod (147-199) só trata '24h', '7d', '30d' e 'custom' — '15d' cai no else da linha 197 e devolve calls/logs/woundEntries sem filtro algum. O rótulo do botão passa a dizer 'Últimos 15 dias' sobre números do histórico inteiro.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0118 · ALTO · `CONFIRMADO`

**Falha de rede na carga de consultas é mascarada por dados fictícios**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:71`

**O defeito:** O catch do loadData substitui o erro por getMockAppointments() e apenas console.warn. Não há estado de erro nem opção de tentar novamente; o usuário não tem como saber que a leitura falhou.

**Como falha:** Supabase fora do ar / celular sem rede. O paciente abre 'Minhas Consultas' e, em vez de um aviso de falha, vê três consultas inexistentes com médicos e horários inventados. Ele organiza o dia em torno de um compromisso que não existe e não vê suas consultas reais.

**Código atual:**

```jsx
} catch (err) {
        console.warn('Erro ao carregar agendamentos:', err);
        setAppointments(getMockAppointments());
      }
```

**Correção sugerida:** Definir um estado de erro no catch e renderizar aviso com opção de tentar novamente, sem substituir por dados fictícios.

<details><summary>Verificação feita contra o código</summary>

Linhas 69-74: o catch faz console.warn e setAppointments(getMockAppointments()). Não existe estado de erro nem botão de retry no componente. Em falha de leitura o paciente recebe três consultas inexistentes indistinguíveis de reais, sem nenhum aviso.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0119 · ALTO · `CONFIRMADO`

**todayStr calculado em UTC desloca 'Hoje', 'É HOJE!' e os filtros em um dia no fim da tarde/noite**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:101`

**O defeito:** todayStr usa toISOString() (UTC), enquanto as células do calendário são montadas com year/month/day LOCAIS (linhas 453-455) e as datas das consultas são strings locais 'YYYY-MM-DD'. Em UTC-3, a partir das 21h o UTC já está no dia seguinte, então todayStr aponta para amanhã.

**Como falha:** Às 21h30 de 10/08 em São Paulo, todayStr = '2026-08-11'. Resultado observável: (1) a célula do dia 11 recebe a borda verde e o selo 'Hoje'; (2) a consulta real de hoje (10/08) deixa de satisfazer appointmentDate >= todayStr e desaparece do filtro 'Próximas', reaparecendo em 'Histórico / Concluídas'; (3) o selo 'É HOJE!' é aplicado à consulta de amanhã. O paciente perde a consulta de hoje à noite.

**Código atual:**

```jsx
const todayStr = new Date().toISOString().split('T')[0];
```

**Correção sugerida:** Construir todayStr com getFullYear/getMonth/getDate locais em vez de toISOString().

<details><summary>Verificação feita contra o código</summary>

Linha 101 usa new Date().toISOString().split('T')[0] (UTC), enquanto fullDateStr das células é montado com year/month/dayNum locais (linhas 452-455) e comparado em isToday (458). Em UTC-3, após as 21h locais o dia UTC já avançou: o selo 'Hoje' vai para a célula errada e o predicado appointmentDate >= todayStr (linhas 114/148) exclui a consulta de hoje à noite das 'Próximas'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0235 · MÉDIO · `CONFIRMADO`

**Médico especialista em estomaterapia é classificado como enfermeiro e recebe preço de enfermagem**

**Onde:** `src/components/BookingModal.jsx:26`

**O defeito:** isNurse é inferido por substring da especialidade, incluindo 'estomaterapia' — que é especialidade tanto de enfermagem quanto de medicina. Esse booleano decide o título do modal, o ícone, a especialidade gravada no agendamento (linha 64) e o preço fallback (linha 27).

**Como falha:** Médico com specialty 'Estomaterapia & Feridas Crônicas' (perfil existente no próprio projeto, PatientAppointmentsCalendar.jsx:19): o modal exibe 'Contratar Enfermeiro(a)', cobra R$ 130,00 em vez de R$ 250,00 e grava doctorSpecialty 'Enfermagem Estomaterapia' quando a especialidade estiver ausente. Paciente e faturamento passam a tratar um médico como enfermeiro.

**Código atual:**

```jsx
const isNurse = (professional.specialty || '').toLowerCase().includes('enferm') || (professional.specialty || '').toLowerCase().includes('estomaterapia');
```

**Correção sugerida:** Derivar isNurse de professional.role === 'nurse' em vez de heurística sobre o texto da especialidade.

<details><summary>Verificação feita contra o código</summary>

Linha 26 infere isNurse por substring de specialty incluindo 'estomaterapia', e esse booleano governa o título 'Contratar Enfermeiro(a)' (146), o ícone (142), o fallback de especialidade gravada (64) e o preço (27). Estomaterapia é especialidade médica e de enfermagem — e o próprio projeto tem o perfil 'Estomaterapia & Feridas Crônicas' atribuído a um 'Dr.' (PatientAppointmentsCalendar.jsx:18-19).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0236 · MÉDIO · `CONFIRMADO`

**Preço cobrado é inventado pelo modal quando o profissional não tem valor cadastrado**

**Onde:** `src/components/BookingModal.jsx:27`

**O defeito:** price cai em um fallback hardcoded (130 para 'enfermeiro', 250 para médico). Confirmado nos consumidores: NursesNetwork.jsx:54 e SpecialistDirectory.jsx:66 definem price: null para profissionais reais sem valor, e o card do diretório mostra 'Sob Consulta' (NursesNetwork.jsx:262). Esse valor fictício é exibido como total, embutido no PIX e persistido no agendamento (linha 70).

**Como falha:** Enfermeira real cadastrada sem consultationFee: o card do diretório diz 'Visita Domiciliar: Sob Consulta'; ao clicar em contratar, o cabeçalho do modal já exibe 'R$ 130,00', o checkout cobra R$ 130,00 e o agendamento é gravado com price 130 e payment_status 'paid' — valor que a profissional nunca definiu e não receberá.

**Código atual:**

```jsx
const price = professional.price || professional.consultationFee || (isNurse ? 130 : 250);
```

**Correção sugerida:** Quando price/consultationFee for nulo, bloquear o checkout e exibir 'Sob consulta — combine o valor com o profissional' em vez de arbitrar um preço.

<details><summary>Verificação feita contra o código</summary>

Linha 27 tem o fallback (isNurse ? 130 : 250). Grep confirma NursesNetwork.jsx:54 (price: doc.consultationFee ? ... : null) e o card exibindo 'Sob Consulta' (NursesNetwork.jsx:262, SpecialistDirectory.jsx:267) para o mesmo profissional. O valor fictício é exibido no cabeçalho (149), no total (383), embutido no PIX (29) e persistido no agendamento (70) como pago.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0237 · MÉDIO · `CONFIRMADO`

**pixCode é recalculado com Date.now() em cada render: o código copiado difere do QR exibido**

**Onde:** `src/components/BookingModal.jsx:29`

**O defeito:** pixCode está no corpo do componente (sem useMemo) e contém Date.now(). Qualquer re-render gera outro código: o próprio handleCopyPix chama setPixCopied(true) (linha 42) e o setTimeout de 3s chama setPixCopied(false) (linha 43), forçando dois re-renders. O src da <img> muda a cada vez, disparando novo request ao gerador de QR.

**Como falha:** Paciente clica em 'COPIAR CÓDIGO PIX': o texto copiado carrega o timestamp T1. Imediatamente o componente re-renderiza e o QR na tela passa a representar o código T2; 3 segundos depois vira T3 (o QR pisca/recarrega). Código copiado, QR exibido e valor efetivamente 'cobrado' nunca coincidem, impossibilitando qualquer conciliação por identificador.

**Código atual:**

```jsx
const pixCode = `00020126580014BR.GOV.BCB.PIX0136irec-${professional.id.substring(0, 8)}-${Date.now()}5204...`;
...
  setPixCopied(true);
  setTimeout(() => setPixCopied(false), 3000);
```

**Correção sugerida:** Envolver pixCode em useMemo com dependências [professional.id, price] para congelar o identificador.

<details><summary>Verificação feita contra o código</summary>

pixCode está no corpo do componente (linha 29), fora de useMemo, e embute Date.now(); handleCopyPix (39-44) dispara setPixCopied(true) e um setTimeout que dispara setPixCopied(false), forçando dois re-renders e portanto dois novos códigos e dois novos src de <img>. Comportamento confirmado. Rebaixo para médio porque o código já é inválido (50050) e nenhum identificador é usado para conciliação em lugar nenhum do projeto — o dano incremental é o QR piscando/recarregando.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0238 · MÉDIO · `CONFIRMADO`

**'Horários Disponíveis' são uma lista fixa, não a agenda real do profissional**

**Onde:** `src/components/BookingModal.jsx:31`

**O defeito:** availableTimes é um array hardcoded de 7 horários, idêntico para todo profissional, todo dia da semana (inclusive sábados/domingos e feriados). Não há consulta a nenhuma função de disponibilidade; a única checagem é a colisão com outro agendamento no mesmo par (doctorId, data, hora) feita dentro de createAppointment.

**Como falha:** Paciente escolhe domingo às 19:00 para uma enfermeira que atende de segunda a sexta até 17h. Como não há colisão, o agendamento é criado e cobrado. No dia, ninguém comparece; o rótulo 'Horários Disponíveis' induziu o paciente ao erro.

**Código atual:**

```jsx
const availableTimes = ['08:00', '09:00', '10:30', '14:00', '15:30', '17:00', '19:00'];
```

**Correção sugerida:** Buscar a disponibilidade real do profissional (agenda/working hours) para a data escolhida e renderizar apenas os slots livres.

<details><summary>Verificação feita contra o código</summary>

Linha 31 é um array literal de 7 horários renderizado sob o rótulo 'Horários Disponíveis' (265-267), idêntico para todo profissional e todo dia, sem consulta a nenhuma função de disponibilidade. A única restrição é checkAppointmentCollision dentro de createAppointment (supabaseService.js:1390), que só impede duplicidade no mesmo par doctor/data/hora.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0239 · MÉDIO · `CONFIRMAR-SCHEMA`

**Nenhuma revalidação da data no envio: agendamento em data passada é aceito**

**Onde:** `src/components/BookingModal.jsx:46`

**O defeito:** O atributo min do input type=date é apenas uma dica do widget; o valor continua legível e nada em handleConfirmPayment (nem em createAppointment) rejeita datas anteriores a hoje. Não há form nem checkValidity().

**Como falha:** Paciente digita 10/01/2020 no campo de data (ou usa um navegador/WebView que aceita valores fora do min) e conclui o fluxo. Um agendamento retroativo é criado, marcado como pago, e passa a ser contado como 'Histórico' no calendário do paciente.

**Código atual:**

```jsx
const handleConfirmPayment = async () => {
    triggerVibration();
    setLoading(true);
    setErrorMsg('');

    try {
      if (paymentMethod === 'card') {
```

**Correção sugerida:** Rejeitar em handleConfirmPayment quando selectedDate for anterior à data local de hoje, com mensagem ao usuário.

<details><summary>Verificação feita contra o código</summary>

handleConfirmPayment (46-96) valida somente cartão; não há <form>, checkValidity() nem comparação de selectedDate com a data atual, e createAppointment (supabaseService.js:1388-1440) também não rejeita datas passadas. O min da linha 249 é apenas dica de widget e não impede valor programático/colado. Alcançável, embora exija ação incomum do usuário.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0240 · MÉDIO · `CONFIRMADO`

**BookingModal grava modality 'presential' e o calendário compara com 'presencial'**

**Onde:** `src/components/BookingModal.jsx:65`

**O defeito:** O modal usa a string 'presential' (linhas 6, 65, 69, 197, 312) e o consumidor PatientAppointmentsCalendar.jsx:150 filtra por 'presencial' (com C). Confirmado por grep: as duas grafias coexistem no projeto e nunca se cruzam.

**Como falha:** Paciente contrata uma Visita Domiciliar. Na aba 'Minhas Consultas' o card KPI '🏥 PRESENCIAIS' continua marcando 0, porque presencialCount nunca casa com 'presential'. Qualquer relatório ou filtro futuro por modalidade presencial ignora 100% dos agendamentos domiciliares reais.

**Código atual:**

```jsx
modality: modality, // 'online' or 'presential'
// PatientAppointmentsCalendar.jsx:150
const presencialCount = appointments.filter(a => a.modality === 'presencial' && a.status === 'confirmed').length;
```

**Correção sugerida:** Padronizar em uma única constante de modalidade ('presencial') no payload e em todos os consumidores.

<details><summary>Verificação feita contra o código</summary>

BookingModal usa 'presential' (linhas 6, 65, 69, 197) e PatientAppointmentsCalendar.jsx:150 filtra por 'presencial'. As grafias nunca se cruzam, então presencialCount é sempre 0 para agendamentos reais. Rebaixo para médio: a listagem e o badge do calendário (linha 505, ternário sobre 'online') continuam corretos; o dano observável é o KPI zerado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0241 · MÉDIO · `CONFIRMAR-SCHEMA`

**BookingModal grava status 'Agendado' e os KPIs/filtros do calendário esperam 'confirmed'**

**Onde:** `src/components/BookingModal.jsx:73`

**O defeito:** O payload fixa status: 'Agendado' (string em português com maiúscula). supabaseService.js:1429 usa appointmentData.status || 'confirmed', então 'Agendado' é persistido. Já PatientAppointmentsCalendar.jsx:148-150 conta apenas status === 'confirmed' e o filtro 'upcoming' (linha 114) só reconhece 'confirmed' e 'pending'. Vocabulários de status divergentes entre escrita e leitura.

**Como falha:** Paciente agenda 3 consultas online reais. Ao abrir 'Minhas Consultas', os cards mostram 'PRÓXIMAS CONSULTAS: 0' e 'TELEMEDICINA HD: 0' mesmo com as 3 consultas listadas logo abaixo — o paciente conclui que os agendamentos não foram registrados.

**Código atual:**

```jsx
paymentStatus: 'paid',
        status: 'Agendado'
// PatientAppointmentsCalendar.jsx:148
const upcomingCount = appointments.filter(a => a.status === 'confirmed' && a.appointmentDate >= todayStr).length;
```

**Correção sugerida:** Gravar status: 'confirmed' no payload (ou normalizar o vocabulário de status em uma única constante compartilhada).

<details><summary>Verificação feita contra o código</summary>

Linha 73 grava status: 'Agendado' e supabaseService.js:1403/1429 preserva esse valor (o default 'confirmed' nunca é usado). PatientAppointmentsCalendar.jsx:148-150 só conta status === 'confirmed', logo os três KPIs ficam em 0 para agendamentos reais. Rebaixo para médio porque o filtro 'upcoming' (linha 114) tem um OR por data que ainda lista as consultas — o usuário vê a lista, mas com contadores zerados.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0242 · MÉDIO · `CONFIRMADO`

**Modal de agendamento sem semântica de diálogo, sem fechar com Esc e com botão de fechar sem nome acessível**

**Onde:** `src/components/BookingModal.jsx:99`

**O defeito:** O overlay é uma div sem role="dialog"/aria-modal, sem foco inicial, sem focus trap e sem handler de keydown para Escape. O botão de fechar tem apenas o caractere '×' como conteúdo (linha 157) e nenhum aria-label. O conteúdo atrás continua focável por Tab.

**Como falha:** Usuário de leitor de tela (público-alvo inclui pacientes idosos, o app tem 'uiMode accessible') abre o modal: o leitor continua anunciando o diretório atrás, o Tab sai do modal e o único botão de fechar é lido como 'multiplicação, botão'. Sem mouse e sem Esc, não há como sair do fluxo de pagamento.

**Código atual:**

```jsx
<button
            onClick={() => { triggerVibration(); onClose(); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' }}
          >
            ×
          </button>
```

**Correção sugerida:** Adicionar role="dialog" aria-modal="true" com aria-labelledby, listener de Escape, foco inicial e aria-label="Fechar" no botão ×.

<details><summary>Verificação feita contra o código</summary>

O overlay das linhas 99-113 é uma <div> sem role='dialog'/aria-modal; o arquivo importa apenas useState (linha 1), portanto não existe useEffect com listener de keydown para Escape nem foco inicial/focus trap; e o botão de fechar (153-158) tem apenas '×' como conteúdo, sem aria-label. Público-alvo inclui pacientes idosos e o app tem modo acessível.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0243 · MÉDIO · `CONFIRMADO`

**QR Code de pagamento depende de host externo e envia o payload PIX a terceiros**

**Onde:** `src/components/BookingModal.jsx:443`

**O defeito:** O QR é gerado por api.qrserver.com via querystring, sem onError, sem fallback e sem estado de carregamento. Além da dependência externa em um app com PWA/service worker e Capacitor (offline/CSP), o payload — que contém o id do profissional — é transmitido a um serviço de terceiros.

**Como falha:** Paciente sem conexão estável, ou com a rede bloqueando o domínio, vê apenas um quadrado branco de 150x150 onde deveria estar o QR, sem mensagem de erro e sem alternativa além do código 'copia e cola' (que é inválido). O pagamento não pode ser realizado.

**Código atual:**

```jsx
<img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(pixCode)}`}
                    alt="QR Code PIX"
```

**Correção sugerida:** Gerar o QR localmente (ex.: biblioteca qrcode empacotada) e adicionar onError com mensagem de falha.

<details><summary>Verificação feita contra o código</summary>

Linhas 441-447: <img src={`https://api.qrserver.com/...&data=${encodeURIComponent(pixCode)}`}> sem onError, sem fallback e sem estado de carregamento, dentro de um contêiner branco fixo de 150x150 — offline ou com o domínio bloqueado o usuário vê um quadrado vazio sem mensagem. O payload (com o prefixo do id do profissional e o valor) é enviado a um serviço de terceiros.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0244 · MÉDIO · `CONFIRMADO`

**Botão 'CONCLUÍDO (VER MINHAS CONSULTAS)' leva ao dashboard, não às consultas**

**Onde:** `src/components/BookingModal.jsx:584`

**O defeito:** O botão chama onSuccess?.() e onClose(). Os dois únicos consumidores passam onSuccess={() => setActiveTab('dashboard')} (SpecialistDirectory.jsx:527 e NursesNetwork.jsx:522). Nenhum navega para 'my-appointments'/'appointments', e nenhum recarrega a lista de consultas.

**Como falha:** Paciente acaba de agendar, clica em 'CONCLUÍDO (VER MINHAS CONSULTAS)' e cai na tela inicial. Sem ver a consulta na agenda, ele repete o fluxo e cria um segundo agendamento (em outro horário, pois o mesmo horário colide), sendo cobrado duas vezes.

**Código atual:**

```jsx
onClick={() => {
                triggerVibration();
                onSuccess?.();
                onClose();
              }}
...
CONCLUÍDO (VER MINHAS CONSULTAS)
```

**Correção sugerida:** Passar onSuccess={() => setActiveTab('my-appointments')} nos dois consumidores (ou ajustar o rótulo do botão).

<details><summary>Verificação feita contra o código</summary>

Linhas 565-585: o botão rotulado 'CONCLUÍDO (VER MINHAS CONSULTAS)' chama onSuccess?.() e onClose(). Grep confirma que os dois únicos consumidores passam onSuccess={() => setActiveTab('dashboard')} (SpecialistDirectory.jsx:527 e NursesNetwork.jsx:522) — nenhum navega para a aba de consultas nem recarrega a lista. Rótulo não corresponde ao comportamento.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0270 · MÉDIO · `CONFIRMADO`

**Presets do DateRangePicker geram datas em UTC, deslocando o intervalo em um dia**

**Onde:** `src/components/DateRangePicker.jsx:51`

**O defeito:** Todos os presets serializam com toISOString().split('T')[0]. Em UTC-3, após as 21h locais a data UTC já é a do dia seguinte, então endDate fica no futuro e startDate desloca um dia. Os consumidores comparam esses valores com new Date(startDate) (UTC 00:00) contra created_at local — AdminDashboard.jsx:168-172.

**Como falha:** Admin às 22h de 10/08 clica em 'Últimos 3 meses': startDate/endDate são gravados como 11/05 e 11/08. O filtro 'custom' passa a excluir os registros de 10/05 e a incluir um dia que ainda não existe; o rótulo do botão exibe '11 de mai, 2026 - 11 de ago, 2026' — uma data final futura.

**Código atual:**

```jsx
start.setDate(now.getDate() - 7);
      setTimePeriod('7d');
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
```

**Correção sugerida:** Serializar as datas com um helper local (getFullYear/getMonth/getDate) em vez de toISOString().

<details><summary>Verificação feita contra o código</summary>

Todos os ramos de handlePreset (48-82) serializam com toISOString().split('T')[0] sobre objetos Date locais; em UTC-3 após as 21h a data UTC já é a do dia seguinte, então endDate fica no futuro e startDate desloca. O impacto real recai sobre '3m' e '1y', que gravam timePeriod 'custom' e, aí sim, fazem AdminDashboard.jsx:165-196 comparar essas strings (new Date(startDate) = UTC 00:00) com created_at; e sobre o rótulo do botão (getLabel, 94-101).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0271 · MÉDIO · `CONFIRMADO`

**Intervalo incompleto é aplicado imediatamente ao dashboard e o rótulo volta a 'Selecione o período'**

**Onde:** `src/components/DateRangePicker.jsx:110`

**O defeito:** Ao primeiro clique num dia, o componente chama setStartDate(dia), setEndDate('') e setTimePeriod('custom') diretamente no estado do pai — não existe botão 'Aplicar'. O filtro passa a valer com intervalo aberto, e getLabel (linhas 94-101) exige startDate && endDate, retornando 'Selecione o período' mesmo com filtro ativo. Se o usuário fechar clicando fora (handleClickOutside, linhas 19-23), o estado pela metade permanece.

**Como falha:** Admin clica no dia 05, se distrai e clica fora para fechar o dropdown. O dashboard já está filtrado de 05 até o infinito, mas o botão exibe 'Selecione o período' e nenhum preset está destacado. O admin lê os números como se fossem do período padrão de 30 dias.

**Código atual:**

```jsx
if (!startDate || (startDate && endDate)) {
      setStartDate(clickedDateStr);
      setEndDate('');
      setTimePeriod('custom');
    }
```

**Correção sugerida:** Só propagar ao pai quando o intervalo estiver completo (ou adicionar botão 'Aplicar' e reverter estado parcial ao fechar).

<details><summary>Verificação feita contra o código</summary>

handleDayClick (107-127) escreve direto no estado do pai: setStartDate(dia), setEndDate(''), setTimePeriod('custom'), sem botão 'Aplicar'. Com isso AdminDashboard.jsx:165-196 entra no ramo 'custom' e filtra de startDate até o infinito (o bloco de endDate é pulado), enquanto getLabel (94-103) exige startDate && endDate e devolve 'Selecione o período'. Fechar clicando fora mantém o estado pela metade.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0317 · MÉDIO · `CONFIRMADO`

**Consultas canceladas continuam sinalizadas como ativas nas células do calendário**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:104`

**O defeito:** getAppsForDate filtra somente por data, sem excluir status 'canceled'. As badges coloridas do dia (linhas 495-519) e o contador '+N mais' incluem consultas canceladas com a mesma aparência das ativas.

**Como falha:** Paciente cancela a consulta de 20/08 e continua vendo no dia 20 a etiqueta azul '14:30 📹', idêntica a uma consulta ativa. Ele acredita que o cancelamento não funcionou (ou que ainda tem consulta) e pode deixar de reagendar.

**Código atual:**

```jsx
const getAppsForDate = (dateStr) => {
    return appointments.filter(a => a.appointmentDate === dateStr);
  };
```

**Correção sugerida:** Filtrar status !== 'canceled' em getAppsForDate (ou estilizar as canceladas com risco/opacidade distinta).

<details><summary>Verificação feita contra o código</summary>

getAppsForDate (104-106) filtra só por appointmentDate. As badges das linhas 495-519 e o contador '+N mais' usam esse retorno e só variam a cor por modalidade (linha 505), sem distinguir status 'canceled' — uma consulta cancelada continua com etiqueta idêntica a uma ativa.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0318 · MÉDIO · `CONFIRMADO`

**Lista de consultas não é ordenada por data: próximas consultas saem fora de ordem cronológica**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:109`

**O defeito:** filteredAppointments apenas filtra; nunca há sort por appointmentDate/appointmentTime. A origem dos dados vem ordenada por created_at desc (supabaseService.js:1451) e o fallback local faz unshift do mais novo (supabaseService.js:1409), ou seja, ordem de criação decrescente.

**Como falha:** Paciente agenda primeiro uma consulta para 15/08 e depois uma para 11/08. Na aba 'Próximas' a de 11/08 aparece acima da de 15/08 apenas por ter sido criada depois; com 6 ou 7 consultas a lista fica embaralhada e a próxima consulta real não é a primeira do topo.

**Código atual:**

```jsx
const filteredAppointments = appointments.filter(app => {
    if (selectedDay) {
      if (app.appointmentDate !== selectedDay) return false;
    }
```

**Correção sugerida:** Adicionar .sort((a,b) => (a.appointmentDate+a.appointmentTime).localeCompare(b.appointmentDate+b.appointmentTime)) na lista filtrada.

<details><summary>Verificação feita contra o código</summary>

filteredAppointments (109-120) apenas filtra; não há .sort em nenhum ponto do fluxo de exibição. A origem confirma ordem por criação decrescente: supabaseService.js:1451 ordena por created_at desc e o fallback local usa unshift (linha 1409). Logo a lista 'Próximas' sai por ordem de criação, não por data da consulta.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0319 · MÉDIO · `CONFIRMADO`

**Filtro 'Próximas'/'Histórico' com OR faz consulta cancelada aparecer como próxima e consulta passada aparecer nas duas listas**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:113`

**O defeito:** O predicado de 'upcoming' é (status confirmed OU pending OU data >= hoje) e o de 'completed' é (status completed OU canceled OU data < hoje). As condições se sobrepõem e não são mutuamente exclusivas: status e data são avaliados alternativamente, não em conjunto.

**Como falha:** (1) Paciente cancela a consulta de 20/08; status vira 'canceled', mas 20/08 >= hoje, então ela continua listada em 'Próximas'. (2) Uma consulta de 01/07 que nunca teve o status atualizado ('confirmed') aparece simultaneamente em 'Próximas' (por status) e em 'Histórico' (por data), inflando as duas listas.

**Código atual:**

```jsx
if (filterStatus === 'upcoming') {
      return app.status === 'confirmed' || app.status === 'pending' || app.appointmentDate >= todayStr;
    }
    if (filterStatus === 'completed') {
      return app.status === 'completed' || app.status === 'canceled' || app.appointmentDate < todayStr;
    }
```

**Correção sugerida:** Trocar por lógica conjuntiva: 'upcoming' = status não cancelado/concluído E data >= hoje; 'completed' = o complemento.

<details><summary>Verificação feita contra o código</summary>

Linhas 113-118 confirmam os predicados com OR entre status e data. Uma consulta 'canceled' com data futura satisfaz 'appointmentDate >= todayStr' e continua em 'Próximas'; uma consulta passada com status 'confirmed' satisfaz ambos os predicados e aparece nas duas abas. As condições não são mutuamente exclusivas.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0320 · MÉDIO · `CONFIRMADO`

**Cancelamento das consultas exibidas (mock) não persiste e reverte no reload**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:126`

**O defeito:** handleCancel chama cancelAppointment(appId) e atualiza o state local. Para ids do mock ('app_mock_1'...), cancelAppointment (supabaseService.js:1481-1501) faz um update no Supabase que não afeta linha alguma e um map em irec_appointments que não encontra o id — retornando true de qualquer forma. O componente interpreta como sucesso.

**Como falha:** Paciente vê as consultas (mock) na tela, clica em 'Cancelamento', confirma o window.confirm e o card fica esmaecido como cancelado. Ao trocar de aba e voltar, a mesma consulta reaparece como 'confirmed'. O paciente acredita ter cancelado e o cancelamento simplesmente não existe.

**Código atual:**

```jsx
await cancelAppointment(appId);
      setAppointments(prev => prev.map(a => a.id === appId ? { ...a, status: 'canceled' } : a));
```

**Correção sugerida:** Retornar false quando nenhuma linha for afetada (Supabase error ou id ausente no local) e exibir erro ao usuário.

<details><summary>Verificação feita contra o código</summary>

supabaseService.js:1481-1501: cancelAppointment ignora o resultado do update do Supabase (apenas console.warn em erro), faz um map em irec_appointments que não encontra ids 'app_mock_*' e retorna true incondicionalmente. handleCancel (122-137) trata como sucesso e só altera o state local; ao remontar, loadData reinjeta os mocks com status 'confirmed'. Rebaixo para médio: o dano principal deriva do mock (50047), mas o 'return true' silencioso também mascara falha real do Supabase.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0321 · MÉDIO · `CONFIRMADO`

**Botão 'Entrar na Chamada' apenas troca de aba e não inicia chamada nenhuma**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:139`

**O defeito:** handleEnterTelemedicine só faz setTelemedicineContactId(docId || 'doc_1') e setActiveTab('telemedicine'). No consumidor (Telemedicine.jsx:257-265) o targetContactId apenas pré-seleciona um contato SE ele existir na lista de contatos do paciente (contacts.find(...)); nada chama initiateTelemedicineCall. Para os ids mock ('doc_1', 'doc_2', 'doc_3') nunca há match.

**Como falha:** Paciente clica em '🎥 Entrar na Chamada' (ou no botão do modal, linha 826). A tela de telemedicina abre sem contato selecionado e sem chamada — nada acontece. O paciente fica esperando o médico em uma chamada que nunca foi criada e perde o horário da teleconsulta.

**Código atual:**

```jsx
const handleEnterTelemedicine = (docId) => {
    if (setTelemedicineContactId) {
      setTelemedicineContactId(docId || 'doc_1');
    }
    if (setActiveTab) {
      setActiveTab('telemedicine');
    }
  };
```

**Correção sugerida:** Disparar initiateTelemedicineCall para o doctorId após a troca de aba, ou renomear o botão para 'Ir para Telemedicina'.

<details><summary>Verificação feita contra o código</summary>

handleEnterTelemedicine (139-146) só chama setTelemedicineContactId e setActiveTab. Telemedicine.jsx:256-266 apenas pré-seleciona o contato se contacts.find casar com o id — nenhuma iniciação de chamada. Para os ids mock nunca há match. Rebaixo para médio: com doctorId real o paciente cai na tela de telemedicina com o contato selecionado e ainda pode ligar; o defeito é o rótulo prometer entrada direta na chamada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0322 · MÉDIO · `CONFIRMADO`

**KPI 'TELEMEDICINA HD' sempre zero para agendamentos reais**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:149`

**O defeito:** onlineCount exige status === 'confirmed', valor que nenhum agendamento criado pelo app possui (BookingModal grava 'Agendado'; cancelAppointment grava 'canceled'). Só os mocks internos (linha 23/35) têm 'confirmed', portanto o KPI só é diferente de zero quando os dados são falsos.

**Como falha:** Paciente com 5 teleconsultas agendadas vê '📹 TELEMEDICINA HD: 0'. Assim que os dados reais existem o indicador zera; quando não existem (mock), ele mostra 2. O indicador funciona ao contrário do esperado.

**Código atual:**

```jsx
const onlineCount = appointments.filter(a => a.modality === 'online' && a.status === 'confirmed').length;
```

**Correção sugerida:** Contar por modalidade excluindo apenas status 'canceled', em vez de exigir 'confirmed'.

<details><summary>Verificação feita contra o código</summary>

Linha 149 exige status === 'confirmed', valor que nenhum agendamento criado pelo fluxo possui ('Agendado') e que apenas os mocks internos (linhas 23/35) carregam. O indicador realmente só é diferente de zero quando os dados são fictícios. Mesma raiz de 50053, verificada de forma independente na leitura; severidade média por ser indicador de tela, não bloqueio de fluxo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0323 · MÉDIO · `CONFIRMADO`

**Célula de dia do calendário é uma div clicável sem role, tabIndex ou teclado**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:462`

**O defeito:** O único mecanismo para filtrar por data é onClick em uma <div> sem role="button"/"gridcell", sem tabIndex, sem onKeyDown e sem aria-label com a data completa. Os selos dentro da célula também são apenas texto/emoji.

**Como falha:** Paciente que navega por teclado (ou com leitor de tela) não consegue focar nem selecionar nenhum dia do calendário: a funcionalidade de filtrar consultas por data é inacessível, restando apenas a visão de lista.

**Código atual:**

```jsx
<div
                    key={`day_${dayNum}`}
                    onClick={() => setSelectedDay(isSelected ? null : fullDateStr)}
                    style={{
                      height: '75px',
```

**Correção sugerida:** Trocar a div por <button type="button"> com aria-label da data completa e contagem de consultas do dia.

<details><summary>Verificação feita contra o código</summary>

Linhas 462-478: a célula é uma <div> com onClick e cursor:'pointer', sem role, tabIndex, onKeyDown ou aria-label com a data; os selos internos (497-519) são só texto/emoji. A filtragem por data fica inacessível a teclado e leitor de tela — resta apenas a visão em lista.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0324 · MÉDIO · `CONFIRMADO`

**Botão de entrar na videochamada liberado para qualquer consulta online, inclusive futura ou já realizada**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:676`

**O defeito:** A condição de exibição é apenas app.modality === 'online' && !isCanceled. Não há verificação de appointmentDate/appointmentTime nem janela de tolerância, e consultas com status 'completed' online continuam com o botão ativo.

**Como falha:** Paciente com teleconsulta marcada para 30 dias à frente clica em 'Entrar na Chamada' e é levado para a tela de telemedicina; o profissional não está lá. O mesmo ocorre em consultas já concluídas, gerando tentativas de chamada fora do horário contratado.

**Código atual:**

```jsx
{app.modality === 'online' && !isCanceled && (
                      <button
                        onClick={() => handleEnterTelemedicine(app.doctorId)}
```

**Correção sugerida:** Exibir o botão apenas dentro de uma janela (ex.: 15 min antes até 60 min depois) do appointmentDate/appointmentTime e com status ativo.

<details><summary>Verificação feita contra o código</summary>

Linha 676: a condição é exatamente {app.modality === 'online' && !isCanceled}, sem checagem de appointmentDate/appointmentTime nem janela de tolerância; consultas com status 'completed' online continuam exibindo o botão. Cenário alcançável, dano limitado a frustração/tentativa fora de horário.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0447 · BAIXO · `CONFIRMAR-SCHEMA`

**professional.id.substring sem guarda de existência/tipo pode derrubar o modal**

**Onde:** `src/components/BookingModal.jsx:29`

**O defeito:** pixCode é avaliado no corpo do componente, antes de qualquer render, e chama professional.id.substring(0, 8) sem verificar se id existe ou é string. A única guarda anterior é !professional (linha 24). Ids numéricos (coluna bigint) ou registros sem id quebram a chamada.

**Como falha:** Profissional cujo registro chega sem id (ou com id numérico) é aberto para agendamento: lança TypeError: professional.id.substring is not a function no render, o modal nunca aparece e a árvore de SpecialistDirectory/NursesNetwork estoura para o error boundary — o paciente perde a tela do diretório.

**Código atual:**

```jsx
const pixCode = `00020126580014BR.GOV.BCB.PIX0136irec-${professional.id.substring(0, 8)}-${Date.now()}...
```

**Correção sugerida:** Usar String(professional.id || '').substring(0, 8) na montagem do pixCode.

<details><summary>Verificação feita contra o código</summary>

A ausência de guarda é certa: a única checagem anterior é if (!professional) return null (linha 24) e a linha 29 chama professional.id.substring(0,8) no corpo do componente, antes de qualquer render. O que não consegui confirmar é a alcançabilidade: não verifiquei se algum caminho de dados entrega profissional sem id ou com id numérico (o schema real do Supabase não está disponível — o .env está vazio). Se ocorrer, é TypeError no render e a árvore do diretório quebra.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0448 · BAIXO · `CONFIRMADO`

**navigator.clipboard usado sem checagem nem try/catch quebra a cópia do PIX em WebView**

**Onde:** `src/components/BookingModal.jsx:41`

**O defeito:** navigator.clipboard é undefined em contexto não seguro e pode estar ausente/bloqueado em WebView Android (o projeto usa Capacitor 8). A chamada não está protegida e writeText retorna Promise cujo rejeito não é tratado, produzindo TypeError/unhandled rejection dentro do handler.

**Como falha:** Paciente no app Android toca em 'COPIAR CÓDIGO PIX COPIA E COLA'. Lança TypeError: Cannot read properties of undefined (reading 'writeText'); setPixCopied nunca é chamado, o botão não muda de estado e nada é copiado. Sem QR válido nem cópia, o pagamento fica impossível e o usuário não recebe nenhuma mensagem.

**Código atual:**

```jsx
const handleCopyPix = () => {
    triggerVibration();
    navigator.clipboard.writeText(pixCode);
    setPixCopied(true);
```

**Correção sugerida:** Envolver em try/catch com await e só chamar setPixCopied(true) em caso de sucesso, com fallback de seleção de texto.

<details><summary>Verificação feita contra o código</summary>

Linhas 39-44: navigator.clipboard.writeText é chamado sem guarda de existência, sem await/catch, e setPixCopied(true) é executado incondicionalmente logo em seguida. Mesmo sem afirmar que clipboard é undefined no WebView do Capacitor (isso é ambiente), o defeito confirmado é que qualquer rejeição da Promise fica sem tratamento e a UI passa a exibir 'CÓDIGO PIX COPIADO!' sem nada ter sido copiado. Severidade rebaixada para baixo por depender de ambiente e ter fallback visual (QR).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0449 · BAIXO · `CONFIRMADO`

**setTimeout do estado 'PIX copiado' sem cleanup dispara setState após o unmount**

**Onde:** `src/components/BookingModal.jsx:43`

**O defeito:** O timer de 3s criado em handleCopyPix não é guardado nem limpo. O modal é desmontado por onClose (linha 154) ou pelo pai (bookingDoctor = null), enquanto o timer continua vivo.

**Como falha:** Paciente copia o código PIX e fecha o modal em menos de 3 segundos. Passados os 3s, setPixCopied(false) é executado em um componente desmontado — atualização de estado descartada, com risco de warning e de vazamento do timer em fluxos repetidos de abrir/fechar.

**Código atual:**

```jsx
setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
```

**Correção sugerida:** Guardar o id do timer em useRef e limpá-lo em um useEffect de cleanup (e antes de agendar um novo).

<details><summary>Verificação feita contra o código</summary>

Linha 43: o timer de 3s não é guardado em ref nem limpo, e o modal pode ser desmontado antes (botão × na linha 154 ou o pai zerando bookingDoctor). O comportamento descrito ocorre, porém sem warning no React 18+ e sem efeito visível ao usuário — apenas atualização descartada e timer pendente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0450 · BAIXO · `VERIFICAR`

**currentUser não é validado antes do submit e a mensagem técnica é exibida ao paciente**

**Onde:** `src/components/BookingModal.jsx:59`

**O defeito:** appointmentData acessa currentUser.id/name/email sem guarda; se currentUser for null, o TypeError é capturado no catch e a própria err.message é renderizada na caixa de erro (linhas 93 e 161-164), sem tratamento.

**Como falha:** Sessão expirada/modo contingência em que currentUser é null: ao clicar em 'CONFIRMAR E AGENDAR', o paciente vê a mensagem '⚠️ Cannot read properties of null (reading \'id\')' e não tem nenhuma orientação sobre reautenticar.

**Código atual:**

```jsx
const appointmentData = {
        patientId: currentUser.id,
        patientName: currentUser.name || 'Paciente',
```

**Correção sugerida:** Validar currentUser?.id no início de handleConfirmPayment com mensagem amigável de reautenticação, e não renderizar err.message cru.

<details><summary>Verificação feita contra o código</summary>

Confirmado no código: appointmentData acessa currentUser.id/name/email sem guarda (58-61), enquanto a linha 14 usa currentUser?.street — inconsistência real; e o catch (91-95) joga err.message cru na caixa de erro renderizada em 161-164. O que não confirmei é currentUser chegar null nesse fluxo (o diretório é renderizado para usuário logado), então a mensagem técnica ao paciente depende de estado que não pude reproduzir.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0472 · BAIXO · `CONFIRMADO`

**Preset rotulado 'Hoje' grava intervalo de ontem até hoje**

**Onde:** `src/components/DateRangePicker.jsx:48`

**O defeito:** O preset '24h' — cujo rótulo é 'Hoje' (linha 88 e linha 256) — faz start.setHours(now.getHours() - 24), o que retrocede para o mesmo horário do dia anterior, e grava startDate = ontem, endDate = hoje.

**Como falha:** Admin seleciona 'Hoje' esperando os números do dia corrente. O estado exportado ao pai passa a ser startDate=ontem/endDate=hoje e, se em seguida o usuário fizer qualquer clique no calendário (que fixa timePeriod 'custom'), o intervalo aplicado engloba dois dias. Métricas de 'hoje' incluem o movimento de ontem à noite.

**Código atual:**

```jsx
if (preset === '24h') {
      start.setHours(now.getHours() - 24);
      setTimePeriod('24h');
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
```

**Correção sugerida:** Renomear o preset para 'Últimas 24 horas' ou zerar o horário (start.setHours(0,0,0,0)) para que 'Hoje' signifique o dia corrente.

<details><summary>Verificação feita contra o código</summary>

O preset '24h' tem rótulo 'Hoje' (linhas 88 e 256) mas faz start.setHours(now.getHours() - 24) e grava startDate = ontem, endDate = hoje (51-52); AdminDashboard.jsx:147-152 igualmente aplica uma janela móvel de 24h, incluindo o movimento de ontem à noite. Confirmado como mislabel semântico; rebaixo para baixo porque o desvio é de horas e não troca o conjunto de dados.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0473 · BAIXO · `CONFIRMADO`

**Preset 'Últimos 3 meses' erra o início por overflow de mês**

**Onde:** `src/components/DateRangePicker.jsx:69`

**O defeito:** start.setMonth(now.getMonth() - 3) mantém o dia do mês; quando o mês destino tem menos dias, o JS transborda para o mês seguinte.

**Como falha:** Admin em 31/05 seleciona 'Últimos 3 meses': setMonth(1) sobre o dia 31 produz 03/03 (fevereiro tem 28 dias), então o intervalo começa em 03/03 e não em 28/02/01-03. Três dias de chamadas e de logs de auditoria ficam fora do relatório sem nenhum aviso.

**Código atual:**

```jsx
} else if (preset === '3m') {
      start.setMonth(now.getMonth() - 3);
      setTimePeriod('custom');
```

**Correção sugerida:** Fixar start.setDate(1) antes do setMonth, ou usar new Date(y, m-3, d) com clamp do dia ao último dia do mês destino.

<details><summary>Verificação feita contra o código</summary>

Linha 69: start é inicializado como new Date() (dia de hoje) e recebe setMonth(now.getMonth() - 3), preservando o dia do mês. Em 31/05, setMonth(1) sobre o dia 31 transborda para 03/03. O bug existe, mas é limitado a datas 29-31 e desloca no máximo 3 dias — por isso rebaixo de médio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0474 · BAIXO · `CONFIRMADO`

**Presets '3 meses' e '1 ano' definem timePeriod 'custom' e nunca aparecem como selecionados**

**Onde:** `src/components/DateRangePicker.jsx:70`

**O defeito:** Ambos gravam 'custom', mas o destaque da lista compara timePeriod === p.id (linhas 272-275) e o rótulo do botão só trata '24h','7d','15d','30d','all' (linhas 88-92). O estado visual do controle não reflete a escolha do usuário.

**Como falha:** Admin clica em 'Últimos 3 meses'; o dropdown fecha, nenhum item fica marcado e ao reabrir parece que nada foi selecionado. O botão mostra apenas '11 de mai, 2026 - 11 de ago, 2026', então o admin volta a clicar no preset e reaplica o filtro repetidamente sem saber se está ativo.

**Código atual:**

```jsx
start.setMonth(now.getMonth() - 3);
      setTimePeriod('custom');
...
fontWeight: timePeriod === p.id ? '750' : '500',
```

**Correção sugerida:** Gravar setTimePeriod('3m')/('1y') e tratar esses ids nos consumidores e em getLabel.

<details><summary>Verificação feita contra o código</summary>

Linhas 70 e 75 gravam setTimePeriod('custom') enquanto o destaque visual da lista compara timePeriod === p.id (272-275) com ids '3m'/'1y', e getLabel (88-92) só nomeia '24h','7d','15d','30d','all'. Nenhum item fica marcado após o clique. Defeito real, mas puramente de estado visual do controle — rebaixo para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0475 · BAIXO · `CONFIRMADO`

**Dropdown do seletor de período sem suporte a teclado e sem estado ARIA**

**Onde:** `src/components/DateRangePicker.jsx:201`

**O defeito:** O botão que abre o painel não tem aria-expanded/aria-haspopup, o painel não tem role, não há fechamento por Escape e o fechamento por clique externo escuta apenas 'mousedown'. Os dias são botões rotulados somente pelo número, sem a data completa.

**Como falha:** Admin navegando por teclado abre o painel com Enter e não recebe indicação de que ele abriu; Escape não fecha, o foco não é movido para dentro do painel e o leitor de tela anuncia apenas '5, botão', sem mês/ano, impedindo a escolha confiável do intervalo.

**Código atual:**

```jsx
<button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
```

**Correção sugerida:** Adicionar aria-haspopup/aria-expanded no gatilho, role="dialog" no painel, fechamento por Escape e aria-label com a data completa em cada dia.

<details><summary>Verificação feita contra o código</summary>

Linhas 201-226: o botão que abre o painel não tem aria-expanded nem aria-haspopup; o painel (228-243) é uma div sem role; não há handler de Escape nem movimentação de foco; e os dias são <button> rotulados apenas pelo número (156-159), sem a data completa. Navegação por teclado/leitor de tela fica sem indicação de abertura e sem contexto de mês/ano.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0524 · BAIXO · `CONFIRMADO`

**Carga assíncrona sem guarda de unmount nem cancelamento: respostas fora de ordem sobrescrevem a lista**

**Onde:** `src/components/PatientAppointmentsCalendar.jsx:55`

**O defeito:** O efeito dispara loadData sem flag de montagem nem AbortController, e depende de [currentUser] (identidade de objeto). Sob StrictMode o efeito roda duas vezes e, quando currentUser é substituído (App.jsx:899/1968 chamam setCurrentUser após atualização de perfil), uma segunda requisição parte antes da primeira retornar.

**Como falha:** Paciente abre 'Minhas Consultas' e edita o perfil (setCurrentUser gera nova referência): duas cargas ficam em voo. Se a primeira (que ainda enxerga lista vazia e cai no mock) responder depois da segunda, o state final volta a ser o das três consultas fictícias. Se o paciente trocar de aba durante o await, setAppointments/setLoading são chamados após o unmount.

**Código atual:**

```jsx
useEffect(() => {
    async function loadData() {
      setLoading(true);
...
    loadData();
  }, [currentUser]);
```

**Correção sugerida:** Usar uma flag local (let active = true) com cleanup no efeito e depender de [currentUser?.id] em vez do objeto.

<details><summary>Verificação feita contra o código</summary>

useEffect (55-77) chama loadData sem flag de montagem, sem AbortController e com dependência [currentUser] (identidade de objeto), então toda substituição da referência dispara nova carga concorrente e a última resposta a chegar vence. A corrida é real. Rebaixo para baixo: exige que duas cargas se sobreponham com resultados divergentes, e o React 18+ já não emite warning para setState pós-unmount.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "BookingModal.jsx|DateRangePicker.jsx|PatientAppointmentsCalendar.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
