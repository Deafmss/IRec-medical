# 9. Dashboard do paciente

**20 defeitos** — 1 crítico · 7 alto · 7 médio · 5 baixo

Arquivos tocados por este módulo:

- `src/components/Dashboard.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0009 · CRÍTICO · `CONFIRMADO`

**Evolução da lesão salta para 100% quando o registro mais recente não tem área medida pela IA**

**Onde:** `src/components/Dashboard.jsx:256`

**O defeito:** `parseFloat(latestEntry.aiAreaCm2) || 0` transforma área ausente (null) em 0 cm². ClinicalTriage.jsx:498 grava `aiAreaCm2: finalResult.aiAreaCm2 || null`, ou seja é comum a IA não devolver área. Com firstArea > 0 e latestArea = 0, `areaReduction` = 100 e o painel anuncia cicatrização total.

**Como falha:** Primeira foto do paciente foi medida em 12 cm². Na segunda foto a IA não devolve `aiAreaCm2` (falha de medição, foto sem régua, modo offline). O card herói mostra 'EVOLUÇÃO DA LESÃO 100%' com o anel completo, sugerindo ao paciente e ao familiar que a ferida cicatrizou, quando ela pode estar maior. Risco clínico de abandono de tratamento.

**Código atual:**

```jsx
      const firstArea = parseFloat(entries[0].aiAreaCm2) || 0;
      const latestArea = parseFloat(latestEntry.aiAreaCm2) || 0;
      if (firstArea > 0) {
        const areaReduction = ((firstArea - latestArea) / firstArea) * 100;
```

**Correção sugerida:** Só calcular a redução quando firstArea > 0 E latestArea > 0, exibindo 'Sem medição nesta avaliação' caso contrário.

<details><summary>Verificação feita contra o código</summary>

Confirmei o trecho em Dashboard.jsx:254-259 e a origem do dado em ClinicalTriage.jsx:498 (`aiAreaCm2: finalResult.aiAreaCm2 || null`), ou seja área ausente é gravada como null. `parseFloat(null) || 0` resulta em 0 e a fórmula ((firstArea - 0)/firstArea)*100 dá exatamente 100, que passa intacto pelo clamp Math.max(0, Math.min(100, ...)). Não existe nenhuma verificação de que latestArea foi realmente medida antes de calcular a redução — só firstArea > 0 é testado. O painel então anuncia cicatrização total num caso em que simplesmente não houve medição.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0081 · ALTO · `CONFIRMADO`

**Chave do checklist usa data UTC: o diário reseta às 21h no horário de Brasília**

**Onde:** `src/components/Dashboard.jsx:155`

**O defeito:** `new Date().toISOString().split('T')[0]` devolve a data em UTC. Em UTC-3 (Brasil), a partir das 21:00 locais o ISO já aponta para o dia seguinte, então `storageKey` muda no meio da noite do paciente. O inverso também ocorre: as marcações feitas entre 21:00 e 23:59 são gravadas na chave de amanhã.

**Como falha:** Paciente marca o curativo noturno às 22:00 do dia 10/08. A marcação é salva em irec_checklist_<id>_2026-08-11. Quem abre o app às 22:30 do mesmo dia 10 vê a lista já 'do dia seguinte'; e no dia 11 de manhã as tarefas aparecem misteriosamente concluídas sem que nada tenha sido feito. O escore de adesão enviado como reflexo de prescrição fica errado todos os dias.

**Código atual:**

```jsx
  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = `irec_checklist_${patientId}_${todayStr}`;
```

**Correção sugerida:** Gerar a chave com data local: `new Date().toLocaleDateString('en-CA')` (ou compor ano/mês/dia via getFullYear/getMonth/getDate).

<details><summary>Verificação feita contra o código</summary>

Dashboard.jsx:155-156 usa `new Date().toISOString().split('T')[0]`, que é sempre a data em UTC. Em UTC-3 o ISO vira o dia seguinte a partir das 21:00 locais, então a storageKey do paciente muda no meio da noite dele e as marcações feitas entre 21:00 e 23:59 são gravadas na chave do dia seguinte — reaparecendo já concluídas na manhã seguinte. Não há nenhuma normalização de fuso no arquivo. Como a lista é apresentada como reflexo das prescrições e alimenta o escore de adesão, o erro tem consequência de cuidado (tarefas noturnas somem/aparecem marcadas).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0082 · ALTO · `CONFIRMADO`

**Checklist diário nunca é restaurado após recarregar a página (chave criada com id 'guest')**

**Onde:** `src/components/Dashboard.jsx:162`

**O defeito:** `storageKey` depende de `clinicalProfile?.id || 'guest'`, mas o estado é inicializado uma única vez no mount. Em App.jsx `clinicalProfile` começa null e só é preenchido por um useEffect assíncrono (App.jsx:551-563), portanto no primeiro render o Dashboard lê `irec_checklist_guest_<data>` e obtém []. Quando o perfil chega, `storageKey` muda para `irec_checklist_<uuid>_<data>` mas `completedTaskIds` continua [] — não há useEffect de ressincronização.

**Como falha:** Paciente marca 6 dos 8 cuidados do dia (gravados em irec_checklist_<uuid>_2026-08-10). Ao dar F5 no app (ou reabrir o PWA), o Dashboard monta antes do perfil carregar, lê a chave 'guest', e a lista aparece 100% desmarcada com 'Adesão Hoje 0%'. O paciente remarca tudo e o histórico de adesão do dia fica corrompido.

**Código atual:**

```jsx
  const [completedTaskIds, setCompletedTaskIds] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
```

**Correção sugerida:** Adicionar `useEffect(() => setCompletedTaskIds(JSON.parse(localStorage.getItem(storageKey) || '[]')), [storageKey])`.

<details><summary>Verificação feita contra o código</summary>

O mecanismo se confirma, com uma correção factual na descrição: em App.jsx:426-440 clinicalProfile NÃO começa null, começa como um objeto default — mas sem a propriedade `id`, então `clinicalProfile?.id || 'guest'` cai em 'guest' do mesmo jeito. O perfil real só chega pelo useEffect assíncrono de App.jsx:551-563, disparado depois que currentUser é setado, portanto o primeiro render do Dashboard já ocorreu. O useState com initializer roda uma única vez no mount e não há nenhum useEffect que releia localStorage quando storageKey muda (verifiquei todos os efeitos do componente: só existem os de appointments e assigned doctor).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0083 · ALTO · `CONFIRMADO`

**Dias de acompanhamento calculados a partir de data pt-BR interpretada como MM/DD (ou inválida)**

**Onde:** `src/components/Dashboard.jsx:241`

**O defeito:** `appearanceDate` é opcional e inicia vazio em ClinicalTriage.jsx:325, então o fallback `entries[0].date` é usado quase sempre. Esse campo é gravado como `new Date().toLocaleDateString('pt-BR')` (ClinicalTriage.jsx:482), isto é 'dd/mm/aaaa'. `new Date('10/08/2026')` é interpretado pelo V8 como 8 de outubro de 2026 (MM/DD) e `new Date('25/12/2026')` é Invalid Date. O `Math.abs` ainda transforma datas futuras em diferença positiva.

**Como falha:** Paciente cadastra a primeira foto em 10/08/2026. O Dashboard interpreta '10/08/2026' como 08/10/2026 (futuro), aplica Math.abs e exibe 'Acompanhamento: 59 dias' no primeiro dia de tratamento. Se o registro tiver sido feito em 25/12, a data é inválida e o painel mostra '0 dias' para sempre. Além disso a fórmula mistura o `appearanceDate` do registro MAIS RECENTE com o `date` do PRIMEIRO registro, então preencher a data de aparecimento em uma reavaliação zera o tempo de tratamento acumulado.

**Código atual:**

```jsx
    const startDateStr = latestEntry.appearanceDate || entries[0].date;
    if (startDateStr) {
      const startDate = new Date(startDateStr);
      if (!isNaN(startDate.getTime())) {
        const diffTime = Math.abs(new Date() - startDate);
```

**Correção sugerida:** Parsear a data pt-BR explicitamente (split '/' → new Date(ano, mes-1, dia)) e usar sempre entries[0] como âncora do início do tratamento.

<details><summary>Verificação feita contra o código</summary>

Confirmei Dashboard.jsx:241-247 e a gravação em ClinicalTriage.jsx:482 (`date: new Date().toLocaleDateString('pt-BR')`), que produz 'dd/mm/aaaa'. `new Date('10/08/2026')` no V8 é parseado como MM/DD (8 de outubro) e '25/12/2026' vira Invalid Date — nesse caso o guard `!isNaN` deixa daysActive em 0 permanentemente, sem qualquer aviso. O Math.abs de fato converte datas futuras em diferença positiva. A mistura de `latestEntry.appearanceDate` (do registro mais recente) com `entries[0].date` (do primeiro) também está no código como descrito, então preencher a data de aparecimento numa reavaliação altera retroativamente o tempo de tratamento.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0084 · ALTO · `CONFIRMAR-SCHEMA`

**Card 'PRÓXIMA CONSULTA' exibe 'undefined às undefined' (nomes de campo divergentes do serviço)**

**Onde:** `src/components/Dashboard.jsx:406`

**O defeito:** `getPatientAppointments` (src/services/supabaseService.js:1442-1478) devolve objetos com `appointmentDate` e `appointmentTime` (mapeados de appointment_date/appointment_time), e o fallback local vem de createAppointment que também usa `appointmentDate`/`appointmentTime` (supabaseService.js:1422-1423). O Dashboard lê `nextApp.date` e `nextApp.time`, campos que não existem em nenhum dos dois caminhos.

**Como falha:** Paciente agenda uma teleconsulta pelo diretório de especialistas e volta ao dashboard. O card azul de próxima consulta mostra literalmente 'undefined às undefined' no lugar da data e hora, e o botão muda para '🎥 Acessar Sala HD' sem que o paciente saiba quando é a consulta.

**Código atual:**

```jsx
                  {nextApp ? `${nextApp.date} às ${nextApp.time}` : 'Nenhuma consulta agendada'}
```

**Correção sugerida:** Trocar por `${nextApp.appointmentDate} às ${nextApp.appointmentTime}` (com formatação pt-BR e fallback 'A definir').

<details><summary>Verificação feita contra o código</summary>

Verifiquei os três pontos da cadeia. BookingModal.jsx:58-74 monta appointmentData com appointmentDate/appointmentTime (nunca date/time); createAppointment (supabaseService.js:1400-1405) faz apenas `...appointmentData`, então o objeto local herda os mesmos nomes; e o mapeamento do Supabase (linhas 1454-1471) devolve appointmentDate/appointmentTime. O Dashboard lê nextApp.date e nextApp.time, que não existem em nenhum dos dois caminhos, e o template literal converte undefined em texto. Não há guarda nem fallback nessa linha (o fallback `|| 'Especialista'` só existe na linha 409 do doctorName).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0085 · ALTO · `CONFIRMADO`

**Enfermeiro responsável é exibido como 'Dr(a).' e com 'CRM:' vazio (role e COREN inexistentes)**

**Onde:** `src/components/Dashboard.jsx:623`

**O defeito:** A condição testa `assignedClinician.role`, mas `getAssignedDoctor` (supabaseService.js:1735-1796) monta o objeto retornado apenas com id, name, crm, specialty, city, state (+avatarUrl/lastSeenAt) — nunca inclui `role`. O segundo teste procura a string 'COREN' dentro de `crm`, porém o cadastro grava o registro como `${crm.toUpperCase()}-${crmState}` (Login.jsx:142), ou seja '123456-SP', sem a palavra COREN nem para enfermeiros. Ambas as condições são sempre falsas.

**Como falha:** Paciente é acompanhado por uma enfermeira estomaterapeuta. O card 'Profissional Responsável' mostra 'Médico(a) Assistente' e 'Dr(a). Fulana', com 'CRM: 123456-SP' — identificação profissional errada em tela de prontuário (violação da distinção CFM/COFEN). Se o registro estiver vazio, a linha renderiza 'CRM:  • Especialista'.

**Código atual:**

```jsx
                  {assignedClinician.role === 'nurse' || (assignedClinician.crm && assignedClinician.crm.toUpperCase().includes('COREN')) ? 'Enfermeiro(a) Responsável' : 'Médico(a) Assistente'}
```

**Correção sugerida:** Incluir `role` (e o tipo de conselho) no objeto retornado por getAssignedDoctor e usá-lo para escolher o rótulo CRM/COREN.

<details><summary>Verificação feita contra o código</summary>

Li getAssignedDoctor inteiro (supabaseService.js:1735-1796): os três caminhos de retorno (local, Supabase e catch) montam o objeto apenas com id, name, crm, specialty, city, state — e o do Supabase acrescenta avatarUrl/lastSeenAt. `role` nunca é incluído, então `assignedClinician.role === 'nurse'` é sempre false. Login.jsx:142 grava `crm: ${crm.toUpperCase()}-${crmState}` para os dois tipos de profissional; a palavra 'COREN' aparece só nos rótulos da UI (linhas 133 e 745), nunca no valor salvo. Ambas as condições das linhas 623, 626 e 629 são inertes, e a linha 629 renderiza 'CRM: ' mesmo para enfermeiros e 'CRM:  • Especialista' quando o registro é vazio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0086 · ALTO · `CONFIRMADO`

**IMC do prontuário exibe 'NaN' ou 'Infinity' e classifica como Obesidade**

**Onde:** `src/components/Dashboard.jsx:784`

**O defeito:** O guard testa apenas a veracidade das strings (`clinicalProfile?.weight && clinicalProfile?.height`). Altura '0' é truthy -> divisão por zero -> Infinity. Altura/peso não numéricos (o campo é texto livre em UserProfileModal.jsx:895-907, aceitando '1,70') -> parseFloat devolve NaN ou 1. Como todas as comparações com NaN são falsas, a cadeia if/else cai no `else` e rotula 'Obesidade'.

**Como falha:** Paciente digita a altura como '1,70' (padrão brasileiro com vírgula). parseFloat('1,70') = 1 -> hM = 0.01 -> IMC = 700000.0 e o prontuário oficial impresso mostra '700000.0 (Obesidade)'. Com altura vazia gravada como '0', mostra 'Infinity (Obesidade)'; com texto não numérico, 'NaN (Obesidade)'. Dado clínico falso em documento apresentado como prontuário CFM/COFEN.

**Código atual:**

```jsx
                        const hM = parseFloat(clinicalProfile.height) / 100;
                        const imcVal = parseFloat(clinicalProfile.weight) / (hM * hM);
```

**Correção sugerida:** Unificar a unidade (metros) e validar: `const h = parseFloat(height); if (!(h > 0.5 && h < 2.5)) return 'Não calculável';`.

<details><summary>Verificação feita contra o código</summary>

O defeito é real e ainda mais grave do que o descrito, mas por outra causa raiz — corrijo a evidência. O campo de altura é `type="number"` com label 'Altura (m)' e placeholder 'Ex: 1.75' (UserProfileModal.jsx:900-908), e o próprio modal calcula `bmi = w / (h * h)` tratando h como METROS (linha 161), salvando `parseFloat(formData.height)` (linha 264). O Dashboard, porém, divide por 100 assumindo centímetros: com 1.75 m e 75 kg, hM = 0.0175 e o IMC impresso no 'prontuário oficial' sai ~244898.0 '(Obesidade)'. As variantes NaN/Infinity do relato são improváveis (type=number bloqueia texto livre, e altura 0 é falsy e barrada pelo guard da linha 778), mas o valor absurdo com classificação 'Obesidade' é reprodutível em todo perfil preenchido pela UI. A linha 775 ainda rotula esse valor como 'cm'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0087 · ALTO · `CONFIRMADO`

**Prontuário afirma ausência de comorbidades quando os campos apenas não foram preenchidos**

**Onde:** `src/components/Dashboard.jsx:804`

**O defeito:** As chips usam ternários sobre campos booleanos que vêm como `undefined`/null do banco (`hasDiabetes: data.has_diabetes` sem default em supabaseService.js:583-589). Falsy é tratado como negativa clínica confirmada: '✕ Sem Diabetes', '✕ Sem Hipertensão', '✕ Sem DAP', '🚭 Não Tabagista', '⚖️ Peso Normal'. Não existe estado 'não informado'.

**Como falha:** Paciente recém-cadastrado que nunca preencheu a ficha abre 'Ver Ficha' e imprime o prontuário. O documento declara categoricamente 'Sem Diabetes', 'Sem Hipertensão' e 'Peso Normal' para um diabético hipertenso obeso. Um profissional que receba esse PDF pode prescrever com base na negativa falsa. Pior, a mesma tela pode mostrar simultaneamente 'Peso Normal' na chip e IMC 34 '(Obesidade)' no bloco acima.

**Código atual:**

```jsx
                    {clinicalProfile?.hasDiabetes ? '✓ Diabetes Mellitus' : '✕ Sem Diabetes'}
```

**Correção sugerida:** Renderizar três estados (`=== true` → possui, `=== false` → nega, nulo/undefined → 'Não informado').

<details><summary>Verificação feita contra o código</summary>

Confirmei as seis chips (linhas 803-820): todas são ternários binários sobre hasDiabetes, hasHypertension, hasVenousInsufficiency, hasPeripheralArterialDisease, isSmoker e isObese, e o ramo falsy imprime afirmações categóricas ('✕ Sem Diabetes', '🚭 Não Tabagista', '⚖️ Peso Normal'). Não existe terceiro estado 'não informado' em nenhuma delas — só hasAmputationHistory (linha 821) usa render condicional. Isso vale tanto para undefined vindo do banco quanto para o perfil default de App.jsx:426-440, que já nasce com hasDiabetes/hasHypertension/isSmoker = false antes de qualquer carregamento. A contradição apontada com o bloco de IMC também procede, já que isObese é um flag independente do IMC calculado logo acima.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0263 · MÉDIO · `CONFIRMAR-SCHEMA`

**Tarefas 'Prescrição da Lesão' nunca aparecem: campo treatmentPlan não existe nas entries**

**Onde:** `src/components/Dashboard.jsx:12`

**O defeito:** O bloco inteiro depende de `latestEntry.treatmentPlan`, mas esse campo nunca é persistido nem devolvido: o objeto salvo em ClinicalTriage.jsx:481-504 não inclui `treatmentPlan` (ele é dobrado em `aiRecommendation` na linha 502) e o mapeamento de `getWoundEntries` (supabaseService.js:866-898) não expõe nenhuma coluna treatment_plan. Grep no projeto confirma que `treatment_plan` não existe no banco. Logo as linhas 12-30 são ramo morto.

**Como falha:** Médico/IA prescreve um plano de tratamento na avaliação da ferida. No 'Diário de Cuidados de Hoje' do paciente nunca aparece nenhuma tarefa da categoria '📌 Prescrição da Lesão', apesar do subtítulo do card afirmar que a lista é 'Reflexo direto das prescrições médicas'. O paciente perde as condutas prescritas e a adesão medida fica sem base.

**Código atual:**

```jsx
    if (latestEntry.treatmentPlan) {
      const planItems = Array.isArray(latestEntry.treatmentPlan)
        ? latestEntry.treatmentPlan
        : typeof latestEntry.treatmentPlan === 'string'
```

**Correção sugerida:** Usar `latestEntry.aiRecommendation` (string com quebras de linha) como fonte do plano, ou persistir treatment_plan na entry.

<details><summary>Verificação feita contra o código</summary>

Grep em todo o src confirma: `treatmentPlan` só aparece em geminiService.js (schema do prompt), em ClinicalTriage.jsx:285-300 (objeto de resultado da IA, não persistido) e no ramo morto do Dashboard. O objeto salvo em ClinicalTriage.jsx:481-504 não inclui treatmentPlan — ele é achatado em `aiRecommendation` na linha 502 — e não há nenhuma coluna treatment_plan no mapeamento de getWoundEntries. Logo as linhas 12-30 nunca executam. Ressalva que reduz a severidade: o ramo seguinte (`latestEntry.appliedDressing`, linha 32) é real e persistido (supabaseService.js:879/994), então a categoria '📌 Curativo Prescrito' funciona; o que se perde é só o plano de conduta.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0264 · MÉDIO · `CONFIRMADO`

**useEffects do Dashboard dependem do objeto clinicalProfile e refazem as consultas a cada 30 segundos, sem cancelamento**

**Onde:** `src/components/Dashboard.jsx:197`

**O defeito:** Os dois efeitos usam `[clinicalProfile]` (objeto) em vez de `[clinicalProfile?.id]`. O App refaz `getClinicalProfile` e chama `setClinicalProfile(profile)` com um objeto NOVO a cada 30 s no polling (src/App.jsx:687-724, linha 696), portanto a identidade muda sempre e os efeitos re-executam indefinidamente. Não há flag de cancelamento/AbortController, então respostas fora de ordem podem sobrescrever dados mais novos.

**Como falha:** Paciente deixa o dashboard aberto: a cada 30 segundos o app dispara novamente getPatientAppointments e getAssignedDoctor contra o Supabase, mesmo sem nada ter mudado. Em rede lenta, duas execuções se sobrepõem e a resposta antiga chega depois da nova, fazendo o card de próxima consulta voltar para um estado desatualizado (race condition entre polling e fetch).

**Código atual:**

```jsx
      getPatientAppointments(clinicalProfile.id).then(apps => {
        setMyAppointments(apps || []);
      });
    }
  }, [clinicalProfile]);
```

**Correção sugerida:** Trocar a dependência para `[clinicalProfile?.id]` e adicionar flag `let cancelled = false` no cleanup de cada efeito.

<details><summary>Verificação feita contra o código</summary>

Verifiquei os dois lados: os efeitos do Dashboard (linhas 191-210) declaram `[clinicalProfile]`, e o polling de App.jsx:687-724 executa a cada 30 s `const profile = await getClinicalProfile(...)` seguido de `setClinicalProfile(profile)` (linha 696) com um objeto sempre novo, sem comparação de igualdade. A identidade referencial muda em toda iteração, então getPatientAppointments e getAssignedDoctor são refeitos indefinidamente. Nenhum dos dois efeitos tem flag de cancelamento no cleanup, então respostas fora de ordem podem sobrescrever estado mais novo. O impacto real é tráfego desnecessário e uma janela de race estreita — não corrompe dado persistido.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0265 · MÉDIO · `CONFIRMADO`

**Profissional responsável desatribuído continua exibido para sempre (falta ramo else)**

**Onde:** `src/components/Dashboard.jsx:204`

**O defeito:** `if (doc) setAssignedClinician(doc)` nunca limpa o estado quando `getAssignedDoctor` devolve null (paciente sem vínculo). Como o efeito reexecuta a cada atualização do perfil, o valor antigo permanece indefinidamente.

**Como falha:** A clínica remove o vínculo médico-paciente (assignment excluído). Na próxima sincronização getAssignedDoctor devolve null, mas o card verde continua mostrando 'Dr(a). João - CRM 12345' como profissional responsável. O paciente segue acreditando que tem acompanhamento ativo e que aquele profissional recebe suas fotos.

**Código atual:**

```jsx
        const doc = await getAssignedDoctor(clinicalProfile.id);
        if (doc) {
          setAssignedClinician(doc);
        }
```

**Correção sugerida:** Trocar por `setAssignedClinician(doc || null)`.

<details><summary>Verificação feita contra o código</summary>

Dashboard.jsx:200-210 confirma o `if (doc) setAssignedClinician(doc);` sem else, e getAssignedDoctor (supabaseService.js:1736, 1740, 1761, 1784) retorna null em quatro situações distintas — patientId ausente, sem assignment local, sem assignment no Supabase e sem perfil do profissional. Como o estado inicial é null e nada volta a limpá-lo, um vínculo removido continua renderizando o card verde da linha 620 indefinidamente. O efeito reexecuta com frequência (ver item 154), então a leitura null realmente acontece, ela apenas não é aplicada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0266 · MÉDIO · `CONFIRMADO`

**Percentual de cicatrização alterna entre duas fórmulas incompatíveis e soma percentuais de tecido**

**Onde:** `src/components/Dashboard.jsx:263`

**O defeito:** Com dois ou mais registros e área válida, o valor é a redução percentual de área; nos demais casos passa a ser `epitelizacao + granulacao`, a soma de duas frações de composição tecidual, que não representa percentual de cicatrização e pode chegar a 100 numa ferida totalmente aberta. As duas fórmulas medem grandezas diferentes e são exibidas no mesmo indicador 'EVOLUÇÃO DA LESÃO'.

**Como falha:** Primeiro registro do paciente: ferida recém-aberta com 90% de granulação e 5% de epitelização. Como só existe um registro, o painel exibe 'EVOLUÇÃO DA LESÃO 95%' com o anel praticamente completo. Ao cadastrar a segunda foto com área medida, o indicador cai para 5% (redução real de área), sugerindo uma piora brutal que não ocorreu.

**Código atual:**

```jsx
      const epitelizacao = parseInt(latestEntry.aiTissueAnalysis?.epitelizacao) || 0;
      const granulacao = parseInt(latestEntry.aiTissueAnalysis?.granulacao) || 0;
      healingProgress = Math.min(100, epitelizacao + granulacao);
```

**Correção sugerida:** Usar uma única métrica (redução de área) e rotular explicitamente 'Composição tecidual' quando não houver duas medições válidas.

<details><summary>Verificação feita contra o código</summary>

Confirmei as linhas 252-270: com entries.length >= 2 e firstArea > 0 o indicador é redução percentual de área; em todos os outros casos (registro único, ou primeira área ausente) vira `epitelizacao + granulacao`, soma de duas frações de composição tecidual clampada em 100. São grandezas diferentes exibidas sob o mesmo rótulo 'EVOLUÇÃO DA LESÃO'. Uma ferida recém-aberta com granulação alta realmente marca perto de 100% no primeiro registro e despenca no segundo, e o campo aiTissueAnalysis existe de fato nas entries (ClinicalTriage.jsx:501, mapeado em getWoundEntries), então o ramo é alcançável. Elevo a severidade acima de 'baixo' porque é o mesmo tipo de dado clínico falso do item 139.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0267 · MÉDIO · `CONFIRMADO`

**Escore de adesão pode passar de 100% porque ids concluídos obsoletos não são depurados**

**Onde:** `src/components/Dashboard.jsx:273`

**O defeito:** `complianceScore` divide `completedTaskIds.length` por `baseTasks.length`, mas `completedTaskIds` guarda ids persistidos que podem não existir mais na lista gerada (a lista é recalculada dinamicamente a partir do perfil e da lesão ativa). Não há filtro cruzando os ids salvos com `baseTasks`, e não há `Math.min(100, ...)`.

**Como falha:** Paciente diabético com lesão ativa e 4 medicamentos marca as 9 tarefas do dia (100%). No mesmo dia o perfil é editado e as comorbidades/medicamentos são corrigidos para vazio: `baseTasks` cai para 1 item (hidratação), mas os 9 ids continuam salvos -> o card mostra 'Adesão Hoje 900%' e a barra de progresso estoura o container.

**Código atual:**

```jsx
  const complianceScore = baseTasks.length > 0
    ? Math.round((completedTaskIds.length / baseTasks.length) * 100)
    : 0;
```

**Correção sugerida:** Calcular sobre a interseção: `completedTaskIds.filter(id => baseTasks.some(t => t.id === id)).length`.

<details><summary>Verificação feita contra o código</summary>

Confirmei que baseTasks é recalculado a cada render por generateDynamicTasks(clinicalProfile, ...) — a lista depende de medications, allergies e das flags de comorbidade (linhas 44-141) — enquanto completedTaskIds vem do localStorage sem nenhum cruzamento com os ids atuais, e o cálculo da linha 273-275 não tem clamp. Editar o perfil encolhe baseTasks sem limpar os ids salvos, então a razão pode exceder 1. O cenário é alcançável, mas exige edição do perfil no mesmo dia após marcar tarefas, e o dano é um indicador inflado e a barra de progresso estourando — não há perda de dado clínico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0268 · MÉDIO · `CONFIRMADO`

**'Próxima consulta' usa o agendamento mais recém-criado, incluindo consultas passadas e canceladas**

**Onde:** `src/components/Dashboard.jsx:278`

**O defeito:** `nextApp = myAppointments[0]`, mas `getPatientAppointments` ordena por `created_at` descendente (supabaseService.js:1451) e não filtra `status` nem data futura. Não há nenhuma ordenação por appointmentDate/appointmentTime nem filtro de canceladas no Dashboard.

**Como falha:** Paciente marca uma consulta para 30/09, depois cancela (status 'canceled' via cancelAppointment) e marca outra para 15/08. Como a de 30/09 foi criada por último... ou como a cancelada continua na lista, o card 'PRÓXIMA CONSULTA' aponta para o agendamento errado (ou para um cancelado/já realizado) e o botão '🎥 Acessar Sala HD' leva o paciente a tentar entrar numa sala de consulta que não existe mais.

**Código atual:**

```jsx
  const nextApp = myAppointments.length > 0 ? myAppointments[0] : null;
```

**Correção sugerida:** Filtrar status não cancelado e data/hora futura, ordenar por appointmentDate+appointmentTime crescente e pegar o primeiro.

<details><summary>Verificação feita contra o código</summary>

Confirmei em supabaseService.js:1442-1479: o caminho Supabase ordena por created_at descendente sem filtrar status nem data, e o fallback local (linha 1443) apenas filtra por patientId sobre uma lista onde createAppointment faz `unshift` (linha 1409), ou seja também ordenada por criação. cancelAppointment (linha 1481-1489) só muda status para 'canceled' — não remove o registro. O Dashboard pega myAppointments[0] sem nenhuma ordenação por appointmentDate nem filtro de status, e o botão passa a '🎥 Acessar Sala HD' sempre que nextApp for truthy. Note que checkAppointmentCollision (linha 1357) prova que 'canceled'/'Cancelado' são status reais em uso.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0269 · MÉDIO · `CONFIRMADO`

**Impressão do prontuário usa window.print() sem CSS de impressão: imprime o app inteiro e corta o conteúdo rolável**

**Onde:** `src/components/Dashboard.jsx:282`

**O defeito:** `handlePrintFullRecord` chama `window.print()` direto. O modal é um portal `position: fixed` com `maxHeight: '90vh'` e `overflowY: 'auto'` (linhas 687 e 740) e a classe `printable-record-content` não possui NENHUMA regra em @media print (grep no projeto: a classe aparece só nesta linha 740; src/index.css:837-889 não a menciona e não isola o modal com visibility/display).

**Como falha:** Paciente clica em '🖨️ Imprimir / Baixar Prontuário em PDF'. O PDF gerado sai com o dashboard de fundo, o prontuário limitado ao pedaço visível do scroll (as seções de comorbidades, alergias e medicamentos ficam cortadas) e páginas subsequentes com o conteúdo da tela por baixo do overlay. O documento apresentado como prontuário oficial CFM/COFEN sai incompleto.

**Código atual:**

```jsx
  const handlePrintFullRecord = () => {
    window.print();
  };
```

**Correção sugerida:** Adicionar regras @media print que ocultem #root e promovam .printable-record-content a position:static com overflow:visible e max-height:none.

<details><summary>Verificação feita contra o código</summary>

Confirmei os três elementos. handlePrintFullRecord (linhas 281-283) é só window.print(). O overlay é position:fixed (linha 670) e o corpo tem maxHeight 90vh no container (linha 687) com overflowY:'auto' na div .printable-record-content (linha 740) — conteúdo rolável não é paginado pelo navegador, é cortado. E o bloco @media print de index.css:837-889 não menciona .printable-record-content em nenhum momento: ele esconde .sidebar/.btn/.badge e reformata .glass-card, mas não isola o modal nem neutraliza o position:fixed/overflow, e o dashboard de fundo continua no fluxo de impressão. O botão de imprimir, aliás, é .btn e some corretamente — o resto não.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0467 · BAIXO · `CONFIRMADO`

**Abertura do prontuário completo não gera log de auditoria LGPD (createAuditLog importado e nunca chamado)**

**Onde:** `src/components/Dashboard.jsx:3`

**O defeito:** `createAuditLog` é importado no topo do arquivo mas não é invocado em nenhum lugar (grep no arquivo retorna apenas esta linha). A tela abre a ficha clínica completa (identificação, CPF, endereço, contato de emergência, comorbidades, alergias e medicamentos) e permite imprimi-la sem registrar o evento de acesso/exportação.

**Como falha:** Em um dispositivo compartilhado (posto de saúde), qualquer pessoa com a sessão aberta clica em '🔍 Ver Ficha' e imprime todos os dados pessoais e clínicos do paciente. Nenhum registro é gravado em irec_log_acessos_prontuario nem no Supabase, portanto a auditoria LGPD não tem como evidenciar o acesso/exportação.

**Código atual:**

```jsx
import { getAssignedDoctor, getPatientAppointments, createAuditLog } from '../services/supabaseService';
```

**Correção sugerida:** Chamar createAuditLog('Acesso ao prontuário completo', clinicalProfile?.id, ...) ao abrir o modal e ao acionar handlePrintFullRecord.

<details><summary>Verificação feita contra o código</summary>

Grep por createAuditLog em Dashboard.jsx retorna exatamente uma ocorrência, a da linha 3 (import). O modal exibe nome, CPF, data de nascimento, telefone, endereço completo com CEP, contato de emergência, comorbidades, alergias e medicamentos (linhas 743-845) e oferece impressão/PDF (linha 860-866) sem registrar nada. O padrão do projeto para esse registro existe e é usado em outro lugar (BookingModal.jsx:81-82 importa e chama services/auditLogger), o que reforça que a omissão aqui é lacuna e não decisão. É import morto além de gap de auditoria, por isso severidade baixa.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0468 · BAIXO · `CONFIRMAR-SCHEMA`

**Checklist gravado sob a chave 'guest' vaza entre usuários do mesmo dispositivo e não é limpo no logout**

**Onde:** `src/components/Dashboard.jsx:154`

**O defeito:** `patientId` cai para a string fixa 'guest' enquanto `clinicalProfile` é null, e o logout do App remove apenas irec_active_user, irec_active_tab, irec_selected_patient e as chaves de aba (src/App.jsx:660-667) — nenhuma chave `irec_checklist_*` é apagada.

**Como falha:** No posto de saúde, o paciente A abre o app e marca cuidados antes do perfil carregar (gravados em irec_checklist_guest_<data>). Ele sai; o paciente B entra no mesmo dispositivo e, na mesma janela antes do perfil carregar, vê as tarefas já marcadas pelo paciente A com o percentual de adesão dele. Dados de cuidado de um paciente exibidos para outro.

**Código atual:**

```jsx
  const patientId = clinicalProfile?.id || 'guest';
```

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0469 · BAIXO · `CONFIRMADO`

**Promise de agendamentos sem .catch() (rejeição não tratada e lista silenciosamente vazia)**

**Onde:** `src/components/Dashboard.jsx:193`

**O defeito:** `getPatientAppointments(...).then(...)` não tem `.catch()`. A função pode rejeitar antes de qualquer try/catch interno: a primeira linha dela é `getLocalAppointments()` (supabaseService.js:1350), que faz `JSON.parse(localStorage.getItem('irec_appointments') || '[]')` fora de try/catch.

**Como falha:** Se a chave irec_appointments do localStorage estiver corrompida (quota excedida em gravação parcial, edição manual, migração de versão), a promise rejeita, o navegador registra 'Unhandled promise rejection', `myAppointments` fica [] e o paciente vê para sempre 'Nenhuma consulta agendada' mesmo tendo consultas marcadas, sem nenhuma mensagem de erro.

**Código atual:**

```jsx
      getPatientAppointments(clinicalProfile.id).then(apps => {
        setMyAppointments(apps || []);
      });
```

**Correção sugerida:** Encadear `.catch(err => { console.warn(err); setMyAppointments([]); })` e envolver o JSON.parse de getLocalAppointments em try/catch.

<details><summary>Verificação feita contra o código</summary>

A cadeia se confirma: Dashboard.jsx:193-195 usa .then sem .catch, e a primeira instrução de getPatientAppointments (supabaseService.js:1443) é `getLocalAppointments()`, definida na linha 1350 como um JSON.parse direto de localStorage sem try/catch — fora do try interno, que só cobre a chamada ao Supabase. Um valor corrompido em irec_appointments faz a async function rejeitar e o estado permanecer [], exibindo 'Nenhuma consulta agendada' sem erro visível. Reduzo a severidade porque a falha exige corrupção prévia do localStorage, um evento raro, e não há perda de dado no servidor.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0470 · BAIXO · `CONFIRMADO`

**Modais do prontuário e do mapa sem semântica de diálogo, sem tecla Esc e sem travar o scroll de fundo**

**Onde:** `src/components/Dashboard.jsx:670`

**O defeito:** Os overlays criados por createPortal (linhas 669-891 e 894-938) não têm `role="dialog"`, `aria-modal`, `aria-label`, não movem o foco para dentro do modal, não prendem o foco e não bloqueiam o scroll do body. Também não há listener de `keydown` para Escape — o fechamento só é possível por clique no overlay ou nos botões (o '✖' do mapa, linha 924-929, é um button sem aria-label, cujo conteúdo é apenas um emoji).

**Como falha:** Usuário de teclado abre 'Ver Ficha': o foco permanece no botão atrás do overlay, Tab percorre os elementos do dashboard escondidos sob o fundo escurecido, Esc não fecha, e a rolagem move a página de trás em vez do conteúdo do prontuário. Em leitor de tela, o overlay não é anunciado como diálogo.

**Código atual:**

```jsx
        }} onClick={() => setShowFullRecordModal(false)}>
```

**Correção sugerida:** Adicionar role="dialog" aria-modal="true" aria-label, listener de Escape, foco inicial no modal e overflow:hidden no body enquanto aberto.

<details><summary>Verificação feita contra o código</summary>

Li os dois portais completos (linhas 669-891 e 894-938): nenhum tem role, aria-modal ou aria-label; não há useEffect de keydown/Escape nem manipulação de document.body.style.overflow em lugar nenhum do arquivo; e não há foco programático nem focus trap. O fechamento só ocorre por clique no overlay ou nos botões. Confirmei também que o '✖' do mapa (linhas 924-929) é um button sem aria-label cujo conteúdo é apenas o emoji, enquanto o do prontuário (linha 716-736) ao menos tem title="Fechar janela". Impacto é de acessibilidade, sem perda de dado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0471 · BAIXO · `CONFIRMAR-SCHEMA`

**Duas instâncias de LocalResourcesPanel ativas ao mesmo tempo duplicam GPS e buscas de rede**

**Onde:** `src/components/Dashboard.jsx:933`

**O defeito:** O painel de recursos locais é montado na coluna direita (linha 634, compact) e novamente dentro do modal do mapa (linha 933, versão completa). Cada instância mantém o próprio estado de coords/geocoding/busca (LocalResourcesPanel.jsx:5-13), portanto ambas executam geolocalização e as consultas de hospitais/farmácias em paralelo.

**Como falha:** Paciente clica em '🗺️ Ver Mapa Completo de Hospitais & UPAs'. Duas instâncias passam a pedir localização e a consultar o serviço de POIs simultaneamente para o mesmo endereço, podendo gerar dois prompts de permissão de GPS e resultados divergentes entre o painel compacto e o do modal.

**Código atual:**

```jsx
              <LocalResourcesPanel clinicalProfile={clinicalProfile} />
```

**Correção sugerida:** Elevar coords/hospitais/farmácias para o Dashboard (ou um contexto) e passá-los por props às duas instâncias.

<details><summary>Verificação feita contra o código</summary>

O fato estrutural procede: há duas montagens do painel (linha 634 compact e linha 933 dentro do modal do mapa) e cada uma tem seu próprio estado local (LocalResourcesPanel.jsx:5-13), então abrir o mapa dispara uma segunda rodada completa de getCurrentPosition e fetchNearbyHealthcareResources. Mas o cenário descrito está superestimado: o efeito de localização depende de `[profileAddressKey]`, uma string estável (linha 77), então a instância compacta NÃO reexecuta quando o modal abre — não há execução simultânea nem, na prática, dois prompts de GPS, já que a permissão de geolocalização é persistida por origem após a primeira concessão. Marco PLAUSIVEL porque o desperdício de requisição e a possível divergência de resultados entre os dois painéis são reais, mas o dano descrito não é o que ocorre.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "Dashboard.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
