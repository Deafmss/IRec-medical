# 6. Triagem clínica

**31 defeitos** — 2 crítico · 10 alto · 12 médio · 7 baixo

Arquivos tocados por este módulo:

- `src/components/ClinicalTriage.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0007 · CRÍTICO · `CONFIRMADO`

**Dimensoes da lesao sao geradas por Math.random() e gravadas no prontuario**

**Onde:** `src/components/ClinicalTriage.jsx:263`

**O defeito:** generateLocalFallbackAnalysis produz area, comprimento e largura da lesao multiplicando uma area-base por um numero aleatorio, e tambem inventa percentuais fixos de tecido (granulacao 60 / epitelizacao 40). Esses valores voltam em aiAreaCm2/aiLengthCm/aiWidthCm/aiTissueAnalysis, sao exibidos como 'Area Estimada', 'Comprimento' e 'Largura' (linhas 1299-1307) e sao persistidos no prontuario via newEntryData (linhas 498-501). O banner de contingencia (linha 1078) diz apenas 'Relatorio gerado com base no protocolo de contingencia e sintomas informados', sem avisar que as medidas nao foram medidas.

**Como falha:** Sem Gemini/Edge Function configurados (analyzeWoundWithAI retorna null em geminiService.js:216), o paciente conclui a triagem e ve 'Area Estimada: 4.1 cm2 / Comprimento 2.6 cm / Largura 1.6 cm'. Repetindo a mesma triagem com a mesma foto no minuto seguinte aparece 3.6 cm2. O medico abre o prontuario e compara duas medidas aleatorias como se fossem evolucao da ferida.

**Código atual:**

```jsx
const variation = 0.85 + Math.random() * 0.3;
const area = Math.round(baseArea * variation * 10) / 10;
const length = Math.round(Math.sqrt(area) * 1.3 * 10) / 10;
const width = Math.round((area / length) * 10) / 10;
```

**Correção sugerida:** Retornar aiAreaCm2/aiLengthCm/aiWidthCm como null no fallback e exibir 'Nao mensurado' em vez de valores gerados aleatoriamente.

<details><summary>Verificação feita contra o código</summary>

Linhas 263-266 geram area/comprimento/largura a partir de baseArea * (0.85 + Math.random()*0.3) e as linhas 301-304 devolvem isso em aiAreaCm2/aiLengthCm/aiWidthCm mais tecidos fixos (granulacao 60 / epitelizacao 40). Esses valores sao exibidos como 'Area Estimada / Comprimento / Largura' (linhas 1297-1308) e persistidos em newEntryData (linhas 498-501). O banner de contingencia (linhas 1078-1081) nao avisa que as medidas nao foram medidas. Como o .env esta vazio, este e hoje o caminho padrao de toda triagem: numeros aleatorios entram no prontuario como medida clinica.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0008 · CRÍTICO · `CONFIRMAR-SCHEMA`

**Enfermeiro/medico sem paciente selecionado grava a ferida no proprio prontuario**

**Onde:** `src/components/ClinicalTriage.jsx:507`

**O defeito:** O id do paciente vem de clinicalProfile?.id. Em src/App.jsx:738 o prop clinicalProfile recebe targetProfile, que para role 'doctor'/'nurse' e selectedPatientForDoctor (pode ser null). Quando e null, clinicalProfile?.id e undefined e addWoundEntry (src/services/supabaseService.js:921-923) faz fallback para getActiveUserId(), que retorna o id do PROFISSIONAL logado. O menu lateral de enfermeiro cai no ramo 'else' de src/App.jsx:1256 (que e o menu de paciente) e por isso exibe o item 'Fotografar Ferida' (src/App.jsx:1270), sem nenhuma tela de selecao de paciente.

**Como falha:** Enfermeiro faz login, clica em 'Fotografar Ferida' no menu lateral, fotografa a ferida do paciente e conclui a triagem. O registro clinico e inserido em wound_entries com patient_id = id do enfermeiro. O prontuario do paciente fica sem o registro e o prontuario do enfermeiro passa a conter dados clinicos de terceiro. Alem disso a analise roda com clinicalProfile null, ou seja, sem nenhuma comorbidade, e o algoritmo de contingencia classifica tudo como 'Leve'.

**Código atual:**

```jsx
const savedEntry = await addWoundEntryService(newEntryData, photoFile, clinicalProfile?.id, attachments);
```

**Correção sugerida:** Bloquear o case 'upload' para clinico sem paciente selecionado e exigir clinicalProfile?.id valido antes de chamar addWoundEntryService.

<details><summary>Verificação feita contra o código</summary>

Cadeia verificada ponta a ponta: App.jsx:737-738 define targetProfile = isClinician ? selectedPatientForDoctor : clinicalProfile e App.jsx:784-789 monta <ClinicalTriage clinicalProfile={targetProfile}/> sem nenhuma guarda para selectedPatientForDoctor null (o case 'upload' so trata uiMode acessivel). supabaseService.addWoundEntry linhas 921-924 faz exatamente 'if (!patientId) patientId = await getActiveUserId()', ou seja, o id do profissional logado. E App.jsx:1174 direciona apenas role==='doctor' ao menu clinico, entao o enfermeiro cai no menu de paciente e ve 'Fotografar Ferida' (App.jsx:1269-1279). Severidade critica confirmada: dado clinico de terceiro gravado no prontuario errado.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0071 · ALTO · `CONFIRMADO`

**Respostas do cartao de queixa anterior continuam sendo enviadas para a IA**

**Onde:** `src/components/ClinicalTriage.jsx:367`

**O defeito:** O useEffect que sincroniza patientComplaintType ajusta woundType/lesionStage mas nunca limpa dynamicAnswers. As respostas ficam num unico objeto indexado por q.key e so sao apagadas em resetTriageForm (linha 529). Como as perguntas de cada cartao sao exibidas condicionalmente, o usuario nao ve mais as respostas antigas, mas elas continuam no state e entram em fullSymptoms (linha 456-457).

**Como falha:** Paciente clica em 'Ferida Aberta ou Corte Profundo' e responde 'Ha sangramento ativo no momento?' = Sim e 'E possivel ver gordura ou tecido profundo?' = Sim. Depois percebe que e apenas vermelhidao, clica em 'Vermelhidao ou Inchaco' e envia. O prompt enviado ao Gemini continua contendo 'hasBleeding: Sim, isDeep: Sim', o que faz a IA marcar isRedirect=true e exibir 'CASO CRITICO - ENCAMINHAMENTO RECOMENDADO' para uma pele apenas irritada.

**Código atual:**

```jsx
useEffect(() => {
    switch (patientComplaintType) {
      case 'vermelhidao':
        setWoundType('Vermelhidão / Inflamação de Pele');
        setLesionStage('Estágio I');
        break;
```

**Correção sugerida:** Limpar dynamicAnswers no useEffect de patientComplaintType (ou filtrar por activeComplaintCard.questions ao montar dynamicAnswersText).

<details><summary>Verificação feita contra o código</summary>

O useEffect de sincronizacao (linhas 367-404) so chama setWoundType/setLesionStage e o focus do textarea; nao ha setDynamicAnswers({}). dynamicAnswers so e limpo em resetTriageForm (linha 529). A linha 456 monta dynamicAnswersText percorrendo Object.entries(dynamicAnswers) inteiro, sem filtrar pelas questoes do cartao ativo, entao respostas de cartoes abandonados entram em fullSymptoms (linha 457) e vao para o prompt.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0072 · ALTO · `CONFIRMADO`

**Algoritmo de contingencia ignora dor, odor, sinais de infeccao e respostas do questionario**

**Onde:** `src/components/ClinicalTriage.jsx:469`

**O defeito:** generateLocalFallbackAnalysis recebe apenas symptomsText (o texto livre), e nao fullSymptoms, que e a string montada na linha 457 com dynamicAnswers, pain, odor, infectionSigns e localTemperature. Dentro do fallback a gravidade e decidida somente por comorbidades do perfil (linhas 244-256); os sintomas atuais nao influenciam nada.

**Como falha:** Modo contingencia (sem Gemini). Paciente sem comorbidades cadastradas responde dor 10/10, marca 'Apresenta cheiro/odor forte local?' e responde 'Ha sangramento ativo no momento? Sim', deixando o campo de texto livre vazio. O fallback devolve severity='Leve' e isRedirect=false, e a tela mostra o card verde 'Baixo risco imediato. Siga as orientacoes prescritas pelo seu medico assistente.'

**Código atual:**

```jsx
finalResult = generateLocalFallbackAnalysis(woundType, lesionStage, clinicalProfile, symptomsText);
```

**Correção sugerida:** Passar fullSymptoms, pain, odor e infectionSigns ao fallback e escalar a severidade por esses sinais.

<details><summary>Verificação feita contra o código</summary>

A linha 469 passa symptomsText (texto livre) e nao fullSymptoms (linha 457, que agrega dynamicAnswers, temperatura, infeccao etc.); pain e odor nao sao passados a funcao em nenhuma forma (assinatura na linha 232: woundType, lesionStage, clinicalProfile, symptomsText). Dentro do fallback, severity/isRedirect saem exclusivamente das comorbidades (linhas 244-256); symptomsText so influencia a classificacao de tecidos (274-283) e o texto do resumo. Paciente sem comorbidade com dor 10/10 e odor recebe severity='Leve' e o card verde.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0073 · ALTO · `CONFIRMADO`

**Estagio da lesao gravado no prontuario e o valor anterior a analise (state stale)**

**Onde:** `src/components/ClinicalTriage.jsx:486`

**O defeito:** Na linha 473 o codigo faz setLesionStage(finalResult.lesionStage), mas o objeto newEntryData montado logo abaixo (mesmo tick sincrono) le a variavel de state 'lesionStage', que ainda contem o valor antigo definido pelo useEffect do cartao de queixa. Os campos vizinhos usam corretamente o resultado da IA (type na linha 483 e clinicalEvolution na linha 496 usam 'finalResult.X || state'), o que evidencia o esquecimento.

**Como falha:** Paciente seleciona o cartao 'Vermelhidao ou Inchaco' (o useEffect fixa lesionStage='Estagio I'), anexa a foto e a IA classifica a lesao como 'Estagio IV'. A tela mostra o resultado, mas o registro salvo em wound_entries tem lesion_stage='Estagio I'. O medico abre o prontuario e ve uma lesao grave classificada como estagio inicial.

**Código atual:**

```jsx
if (finalResult.lesionStage) setLesionStage(finalResult.lesionStage);
...
      lesionStage: lesionStage,
```

**Correção sugerida:** Gravar 'lesionStage: finalResult.lesionStage || lesionStage' em vez do state.

<details><summary>Verificação feita contra o código</summary>

Linha 473 faz setLesionStage(finalResult.lesionStage) e a linha 486 monta 'lesionStage: lesionStage' no mesmo tick sincrono, lendo o valor antigo do state. O contraste com os vizinhos e evidente: linha 483 usa 'finalResult.type || woundType' e linha 496 usa 'finalResult.clinicalEvolution || clinicalEvolution'. Nao ha guarda; o estagio salvo e sempre o definido pelo useEffect do cartao (linhas 367-403), nunca o da IA.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0074 · ALTO · `CONFIRMADO`

**Dez campos clinicos sao gravados no prontuario com valores default que nunca foram perguntados**

**Onde:** `src/components/ClinicalTriage.jsx:488`

**O defeito:** Os states exudate, appearanceDate, anatomicalLocation, localTemperature, infectionSigns, appliedDressing, dressingQuantity, dressingFrequency, performedProcedures e clinicalOutcome nao possuem nenhum campo na UI: seus setters aparecem apenas na declaracao (linhas 316-335) e em resetTriageForm (linhas 524-541). Ainda assim todos entram em newEntryData (linhas 481-504) e sao persistidos como se tivessem sido avaliados.

**Como falha:** Qualquer triagem concluida grava no prontuario exudate='MODERADO', infection_signs='Nenhum', local_temperature='Normal', anatomical_location='' e appearance_date=''. O medico abre o registro e le 'Sinais de infeccao: Nenhum' e 'Exsudato: MODERADO' de uma ferida que o paciente nunca foi questionado sobre isso, e sem saber em que parte do corpo ela esta. A mesma string vazia vai no prompt da IA: 'Local Anatomico: . Data de Aparecimento: . Cobertura: .'

**Código atual:**

```jsx
exudate: (finalResult.exudate || exudate).toUpperCase(),
      odor: odor,
      localTemperature: localTemperature,
      infectionSigns: infectionSigns,
```

**Correção sugerida:** Ou coletar esses campos na UI, ou omiti-los do prontuario/prompt quando nao houver valor informado (null em vez de default).

<details><summary>Verificação feita contra o código</summary>

Grep dos dez setters no arquivo retorna apenas duas ocorrencias de cada: a declaracao (linhas 316-335) e resetTriageForm (linhas 524-541). Nenhum aparece em handler de UI, ou seja, nenhum desses campos e coletado. Mesmo assim todos entram em newEntryData (linhas 484-503) e em fullSymptoms (linha 457), gravando exudate='MODERADO', infectionSigns='Nenhum', localTemperature='Normal' e strings vazias de local anatomico e data de aparecimento como se tivessem sido avaliados. E o mesmo tipo de defeito do valor hardcoded apresentado como dado clinico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0075 · ALTO · `CONFIRMADO`

**Entrada null retornada pelo servico e inserida na lista de registros e quebra o prontuario**

**Onde:** `src/components/ClinicalTriage.jsx:508`

**O defeito:** addWoundEntry retorna null quando nao consegue resolver o patientId (src/services/supabaseService.js:924 'if (!patientId) return null;'). O componente repassa esse valor direto para addClinicalEntry sem validar, e addClinicalEntryLocal (src/App.jsx:726-733) faz setEntries(prev => [...prev, newEntry]), inserindo null no array.

**Como falha:** Sessao expirada / localStorage 'irec_active_user' ausente: o paciente conclui a triagem, entries passa a conter [null]. Ao abrir 'Ver no Prontuario', ClinicalHistory faz entries.map(entry => getEntryProgress(entry)) e {formatDateShort(entry.date)} (src/components/ClinicalHistory.jsx:279-302) sobre null e a tela de historico quebra em branco.

**Código atual:**

```jsx
const savedEntry = await addWoundEntryService(newEntryData, photoFile, clinicalProfile?.id, attachments);
      addClinicalEntry(savedEntry);
```

**Correção sugerida:** Chamar addClinicalEntry apenas quando savedEntry for truthy e avisar o usuario no caso contrario.

<details><summary>Verificação feita contra o código</summary>

supabaseService.js:924 tem literalmente 'if (!patientId) return null;' e ClinicalTriage:507-508 repassa savedEntry direto a addClinicalEntry sem validar. App.jsx:726-733 (addClinicalEntryLocal) faz setEntries/setSelectedPatientEntriesForDoctor com [...prev, newEntry], inserindo null. ClinicalHistory.jsx percorre entries.map em 5 pontos (279, 300, 322, 343, 360) sem filtrar nulos, entao o acesso a entry.date/entry.aiTissueAnalysis lanca e a tela de historico quebra.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0076 · ALTO · `CONFIRMADO`

**Falha ao salvar no prontuario e silenciada e o usuario ve tela de sucesso**

**Onde:** `src/components/ClinicalTriage.jsx:509`

**O defeito:** O unico tratamento de erro da gravacao e um console.error. Nao ha alert, nao ha estado de erro na UI e o fluxo continua exibindo o relatorio completo e o botao 'Ver no Prontuario'. O passo anterior chegou a exibir 'Gravando no Prontuario do Paciente...' (linha 479), reforcando a falsa confirmacao.

**Como falha:** Paciente esta em area sem rede / o bucket 'wounds' esta cheio / a policy RLS de wound_entries rejeita o insert. addWoundEntry lanca, o catch registra no console e a tela mostra normalmente 'Lesao Liberada para Cuidado Domiciliar Monitorado' e o plano de conduta. O paciente clica em 'Ver no Prontuario' e nao encontra registro nenhum, sem nunca ter sido avisado da falha.

**Código atual:**

```jsx
} catch (err) {
      console.error('Falha ao salvar no prontuário:', err);
    }
```

**Correção sugerida:** No catch, setar um estado de erro e exibir aviso explicito de que o registro nao foi salvo, oferecendo nova tentativa.

<details><summary>Verificação feita contra o código</summary>

O bloco 506-511 tem como unico tratamento um console.error, sem setState de erro nem alert, e o fluxo segue para setIsAnalyzing(false) exibindo o relatorio completo (linhas 1069+) e o botao 'Ver no Prontuario'. O passo anterior chegou a mostrar 'Gravando no Prontuario do Paciente...' (linha 479), reforcando a falsa confirmacao. Falha silenciosa de gravacao de registro clinico e defeito real, nao estilo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0077 · ALTO · `CONFIRMADO`

**Botao 'Nova Triagem' desincroniza o tipo de ferida do cartao selecionado**

**Onde:** `src/components/ClinicalTriage.jsx:530`

**O defeito:** resetTriageForm define patientComplaintType='vermelhidao' e woundType='Ulcera Venosa'. O useEffect de sincronizacao depende apenas de [patientComplaintType]; se o valor ja era 'vermelhidao' (o default) ele nao re-executa e woundType permanece 'Ulcera Venosa', contradizendo o cartao visualmente marcado como 'Vermelhidao ou Inchaco'.

**Como falha:** Paciente mantem o cartao default 'Vermelhidao ou Inchaco', conclui a triagem (a IA sobrescreve woundType, ex.: 'Dermatologia'), clica em 'Nova Triagem' e envia a segunda foto sem trocar de cartao. O prompt e o prontuario registram type='Ulcera Venosa', diagnostico que o paciente nunca selecionou.

**Código atual:**

```jsx
setPatientComplaintType('vermelhidao');
    setDynamicAnswers({});
    setWoundType('Úlcera Venosa');
```

**Correção sugerida:** No reset, alinhar o default de woundType ao cartao ('Vermelhidão / Inflamação de Pele') ou derivar woundType do cartao em vez de manter state duplicado.

<details><summary>Verificação feita contra o código</summary>

resetTriageForm (linhas 528-530) faz setPatientComplaintType('vermelhidao') e depois setWoundType('Ulcera Venosa'). O useEffect depende apenas de [patientComplaintType] (linha 404); se o valor ja era 'vermelhidao' o React nao reexecuta o efeito e woundType fica 'Ulcera Venosa', contradizendo o cartao marcado (cujo mapeamento e 'Vermelhidao / Inflamacao de Pele', linha 370). Como no fallback a linha 292 devolve 'type: woundType', o diagnostico errado entra no prontuario e no prompt (linha 457).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0078 · ALTO · `CONFIRMADO`

**Paciente recebe 'Baixo risco imediato' mesmo quando a gravidade e Critica**

**Onde:** `src/components/ClinicalTriage.jsx:1088`

**O defeito:** A decisao entre alerta vermelho e banner verde depende exclusivamente do booleano result.isRedirect. O campo result.severity (que pode ser 'Critico' ou 'Alto Risco') nao e lido em nenhum lugar do render. Se isRedirect vier false, ausente ou como string vazia no JSON do modelo, o valor e falsy e o paciente recebe a mensagem tranquilizadora.

**Como falha:** O Gemini devolve {"severity": "Critico", "reason": "suspeita de infeccao sistemica"} mas omite isRedirect (ou o devolve como a string "false"/false). A tela exibe o card verde 'Lesao Liberada para Cuidado Domiciliar Monitorado - Baixo risco imediato', e o paciente com risco critico e orientado a tratar em casa. O mesmo ocorre no fallback local quando severity='Risco Moderado' (linha 255) com isRedirect=false.

**Código atual:**

```jsx
{result.isRedirect ? (
            <div className="glass-card glass-card-danger-glow neon-edge-danger" style={{ margin: 0 }}>
```

**Correção sugerida:** Derivar o alerta de result.isRedirect === true OU result.severity em ['Alto Risco','Crítico'], e exibir a severidade no card.

<details><summary>Verificação feita contra o código</summary>

O ternario da linha 1088 depende exclusivamente de result.isRedirect, e o grep por 'result.severity' no arquivo inteiro nao retornou nenhuma ocorrencia: a gravidade nunca e renderizada. O cenario e alcancavel sem depender de IA: no fallback, hipertensao isolada gera severity='Risco Moderado' com isRedirect=false (linhas 254-256), e o paciente ve o card verde 'Lesao Liberada... Baixo risco imediato' (linhas 1115-1122).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0079 · ALTO · `CONFIRMADO`

**Percentual de necrose nunca e exibido no resultado da triagem**

**Onde:** `src/components/ClinicalTriage.jsx:1239`

**O defeito:** A caixa de explicacao dos hotspots so renderiza granulacao (hotspot 1), fibrina (hotspot 2) e epitelizacao (hotspot 3). O campo aiTissueAnalysis.necrose - o mais grave dos quatro e o unico que exige desbridamento especializado segundo o proprio GLOSSARY_DB da linha 225 - nao aparece em nenhum ponto do render. O componente WoundTissueOverlay (linhas 6-123), que desenharia a necrose, nunca e instanciado.

**Como falha:** A IA retorna aiTissueAnalysis = {necrose: 80, fibrina: 10, granulacao: 10, epitelizacao: 0}. O paciente clica nos tres pontos numerados e le 'Tecido de Granulacao (10%)', 'Esfacelo (10%)' e 'Borda e Pele Perilesional (0%)'. Nada informa que 80% do leito da ferida esta necrosado, e o rotulo do ponto 3 ('Borda e Pele Perilesional') ainda usa o valor de epitelizacao, que e outro conceito.

**Código atual:**

```jsx
[Ponto 1] Tecido de Granulação ({result.aiTissueAnalysis?.granulacao !== undefined ? result.aiTissueAnalysis.granulacao : 70}%)
```

**Correção sugerida:** Adicionar um quarto ponto/linha exibindo aiTissueAnalysis.necrose com destaque e corrigir o rotulo do ponto 3 para 'Epitelização'.

<details><summary>Verificação feita contra o código</summary>

A caixa de explicacao (linhas 1239-1273) tem exatamente tres ramos: granulacao (1242), fibrina (1252) e epitelizacao (1262). Li o arquivo ate o fim (1353) e nao existe nenhuma outra renderizacao de aiTissueAnalysis.necrose nem secao de glossario; o WoundTissueOverlay local nunca e instanciado. O fallback chega a calcular necrose=30 (linha 275) e a IA pode devolver qualquer valor, e nada disso aparece. O rotulo do ponto 3 realmente mistura 'Borda e Pele Perilesional' com o percentual de epitelizacao.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0080 · ALTO · `CONFIRMAR-SCHEMA`

**Tela de resultado quebra quando a IA nao retorna treatmentPlan**

**Onde:** `src/components/ClinicalTriage.jsx:1318`

**O defeito:** O render do plano de conduta chama .map() diretamente em result.treatmentPlan sem qualquer guarda. O objeto result vem de JSON.parse da resposta do Gemini (src/services/geminiService.js:300) ou do retorno cru da Edge Function 'gemini-analysis' (geminiService.js:209), nenhum dos dois com garantia de schema. O proprio autor sabe que o campo pode faltar: na linha 502 do mesmo arquivo usa 'finalResult.treatmentPlan?.join' com optional chaining, mas no render a protecao nao existe.

**Como falha:** Paciente anexa a foto, clica em 'Iniciar Analise Clinica iRec'. O modelo responde um JSON valido porem sem a chave treatmentPlan (ou com ela como string). O componente lanca 'Cannot read properties of undefined (reading map)', a tela inteira fica em branco (nao ha ErrorBoundary nesse ramo) e o paciente perde o resultado - embora a entrada JA tenha sido gravada no prontuario na linha 507.

**Código atual:**

```jsx
{result.treatmentPlan.map((step, idx) => (
  <li key={idx} style={{ listStyleType: 'decimal', lineHeight: '1.5' }}>{step}</li>
))}
```

**Correção sugerida:** Trocar por (result.treatmentPlan || []).map(...) e renderizar um texto alternativo quando a lista vier vazia.

<details><summary>Verificação feita contra o código</summary>

A linha 1318 chama result.treatmentPlan.map() sem qualquer guarda, enquanto a linha 502 do mesmo fluxo usa finalResult.treatmentPlan?.join(), provando que o autor sabe que o campo pode faltar. Nao existe ErrorBoundary em src (grep por ErrorBoundary/componentDidCatch nao retornou nada), entao um erro de render desmonta a arvore inteira e deixa a tela em branco. Rebaixo de critico para alto porque o gatilho depende de uma resposta da IA fora do schema; no estado atual do repositorio (.env vazio) o caminho executado e sempre generateLocalFallbackAnalysis, que sempre devolve treatmentPlan (linha 300).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0251 · MÉDIO · `CONFIRMADO`

**Componente WoundTissueOverlay e codigo morto: o grafico de tecidos nunca e renderizado**

**Onde:** `src/components/ClinicalTriage.jsx:6`

**O defeito:** WoundTissueOverlay (linhas 6-123) desenha o grafico de segmentacao dos 4 tecidos com tooltip interativo, mas o identificador nao aparece em nenhum JSX do arquivo nem e exportado - e inalcancavel. Em seu lugar a secao 'Mapeamento de Tecidos da Foto' usa tres hotspots com coordenadas absolutas fixas (bottom 40/right 65, top 40/left 80, bottom 25/left 30, linhas 1164-1234) que nao tem qualquer relacao com a imagem enviada.

**Como falha:** O paciente le 'Clique nos pontos numerados sobre a imagem para entender a analise de cada tecido' e clica no ponto vermelho. O ponto esta sempre na mesma coordenada da moldura de 240x180, apontando para um pedaco arbitrario da foto (frequentemente pele sadia ou fundo), e o texto afirma que ali existe tecido de granulacao. A visualizacao real dos tecidos, que existe no arquivo, nunca e mostrada.

**Código atual:**

```jsx
function WoundTissueOverlay({ entry }) {
  const canvasRef = useRef(null);
  const [hoveredTissue, setHoveredTissue] = useState(null);
```

**Correção sugerida:** Remover a copia morta e substituir os tres hotspots fixos pelo grafico de tecidos (ou por uma legenda sem pontos posicionados sobre a foto).

<details><summary>Verificação feita contra o código</summary>

O grep mostra WoundTissueOverlay definido em ClinicalTriage.jsx:6 e nunca usado nesse arquivo (a unica instanciacao do projeto e a copia de ClinicalHistory.jsx:404); o componente tambem nao e exportado. Em seu lugar, os hotspots das linhas 1164, 1188 e 1212 usam coordenadas absolutas fixas sobre a moldura de 240x180 (bottom 40/right 65, top 40/left 80, bottom 25/left 30), sem relacao com a imagem. Mantenho medio nao pelo codigo morto em si (que isolado seria baixo), mas porque o substituto exibido ao paciente e enganoso.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0252 · MÉDIO · `CONFIRMADO`

**Busca por palavras-chave no fallback nao casa com acentos e casa com o verbo 'pus'**

**Onde:** `src/components/ClinicalTriage.jsx:279`

**O defeito:** O fallback classifica os tecidos por substring do texto livre sem normalizar acentos. 'secreção'.includes('secrec') e false (o 'c' com cedilha nao casa), portanto o termo mais usado pelos pacientes nunca dispara a regra. Ja 'pus' casa com o passado do verbo por ('eu pus'), e nao ha tratamento de negacao para 'escuro'/'preto'.

**Como falha:** Paciente escreve 'a ferida esta com muita secrecao amarelada' com acentuacao correta ('secreção') e sem a palavra 'amarel' - a regra nao dispara e o fallback devolve granulacao 60% / fibrina 0%, como se a ferida estivesse cicatrizando bem. Inversamente, 'eu pus a pomada ontem e nao saiu nada' dispara fibrina 35% e classifica uma ferida limpa como tendo tecido inviavel. E 'a pele nao esta escura' dispara necrose 30%.

**Código atual:**

```jsx
} else if (text.includes('amarel') || text.includes('pus') || text.includes('secrec')) {
    fibrina = 35;
```

**Correção sugerida:** Normalizar o texto com normalize('NFD').replace(/[̀-ͯ]/g,'') e usar limites de palavra (regex \bpus\b) com tratamento de negacao.

<details><summary>Verificação feita contra o código</summary>

Linha 273 faz apenas .toLowerCase(), sem normalizacao de acentos, e a linha 279 testa includes('secrec'), que de fato nao casa com 'secrecao' escrito corretamente ('secreç'). includes('pus') casa com 'eu pus a pomada' e o teste de 'escuro'/'preto' (linha 274) nao trata negacao. Consequencia limitada aos percentuais de tecido do fallback, que ja sao fabricados (item 31), por isso mantenho medio e nao alto.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0253 · MÉDIO · `CONFIRMADO`

**Escala de Braden calculada com dois dominios travados em 3, resultado clinico sempre incorreto**

**Onde:** `src/components/ClinicalTriage.jsx:348`

**O defeito:** bradenNutrition e bradenFriction sao declarados com useState sem setter e ficam permanentemente em 3, mas entram na soma total da linha 351 como se tivessem sido avaliados. A escala de Braden real tem 6 dominios (total 6 a 23); aqui o total so pode variar entre 10 e 22, e as faixas de risco das linhas 355-364 sao aplicadas sobre esse valor deslocado. Um paciente com nutricao muito pobre (dominio 1) nunca pode ser identificado.

**Como falha:** Paciente acamado, desnutrido, imovel e com pele sempre umida responde as 4 perguntas com o pior valor (1 cada). O total fica 1+1+1+1+3+3 = 10, quando na escala real seria 4-6. Um paciente que anda normalmente e tem nutricao pessima marca 4+4+4+4+3+3 = 22 e recebe 'Excelente (Pele Protegida)'. Alem disso a faixa 15-18 (risco leve na literatura) e rotulada 'Bom (Cuidados Convencionais)'.

**Código atual:**

```jsx
const [bradenNutrition] = useState(3);
  const [bradenFriction] = useState(3);

  const bradenTotalScore = Number(bradenSensory) + Number(bradenMoisture) + Number(bradenActivity) + Number(bradenMobility) + Number(bradenNutrition) + Number(bradenFriction);
```

**Correção sugerida:** Coletar nutricao e friccao/cisalhamento na UI (ou remover os dois do somatorio e renomear o indicador para nao se apresentar como Braden).

<details><summary>Verificação feita contra o código</summary>

Linhas 348-349 declaram bradenNutrition e bradenFriction com useState(3) sem setter (nao ha UI para eles) e a linha 351 os soma ao total como se avaliados; as faixas 355-364 sao aplicadas sobre um total que so pode variar de 10 a 22, deslocado em relacao a escala real (6-23). Rebaixo de alto para medio porque o resultado e apenas exibido no rotulo 'Nivel de Protecao da Pele' (linha 846) e nao e persistido nem enviado a IA (ver item 44), limitando o dano a informacao enganosa em tela.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0254 · MÉDIO · `CONFIRMADO`

**Avaliacao de mobilidade/Braden e coletada e descartada: nao vai para o prontuario nem para a IA**

**Onde:** `src/components/ClinicalTriage.jsx:351`

**O defeito:** bradenTotalScore e os quatro dominios respondidos pelo paciente sao usados apenas para pintar o texto 'Nivel de Protecao da Pele' na linha 846. Nenhum deles aparece em fullSymptoms (linha 457) nem em newEntryData (linhas 481-504), portanto o risco de lesao por pressao nao chega ao medico nem influencia a triagem.

**Como falha:** Paciente acamado responde as 4 perguntas da secao 'Mobilidade & Cuidados Diarios' e ve o alerta vermelho 'Atencao Elevada (Risco de Lesao por Pressao...)'. Conclui a triagem; nem o prontuario nem o prompt da IA contem qualquer informacao sobre mobilidade, e o alerta desaparece sem deixar registro.

**Código atual:**

```jsx
const fullSymptoms = `Tipo/Queixa: ${woundType}. Respostas Específicas: ${dynamicAnswersText}. Local Anatômico: ${anatomicalLocation}. Data de Aparecimento: ${appearanceDate}. Estágio: ${lesionStage}. Temperatura Local: ${localTemperature}. Infecção: ${infectionSigns}. Cobertura: ${appliedDressing}. Quantidade: ${dressingQuantity}. Frequência: ${dressingFrequency}. Procedimentos: ${performedProcedures}. Evolução: ${clinicalEvolution}. Sintomas: ${symptomsText}`;
```

**Correção sugerida:** Incluir bradenTotalScore e os dominios em fullSymptoms e em newEntryData.

<details><summary>Verificação feita contra o código</summary>

bradenTotalScore aparece somente nas comparacoes das linhas 355-361 e no rotulo da linha 846. A string fullSymptoms (linha 457) e o objeto newEntryData (linhas 481-504) foram lidos integralmente e nao contem nenhum campo de Braden/mobilidade. O paciente responde quatro perguntas, ve um alerta de risco de lesao por pressao e nada disso chega ao medico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0255 · MÉDIO · `CONFIRMADO`

**URLs de objeto (blob:) nunca sao revogadas - vazamento de memoria por foto**

**Onde:** `src/components/ClinicalTriage.jsx:414`

**O defeito:** Cada anexo de imagem cria uma URL via URL.createObjectURL. Nao existe URL.revokeObjectURL em nenhum ponto do arquivo: nem em handleRemoveAttachment (linha 432), nem em resetTriageForm (linha 527, que apenas faz setAttachments([])), nem em cleanup de useEffect no unmount. Cada blob mantem o arquivo inteiro retido na memoria do navegador.

**Como falha:** Enfermeiro em visita domiciliar faz 20 triagens seguidas no celular, anexando 2 a 3 fotos de camera (3-5 MB cada) e clicando em 'Nova Triagem' entre elas. Nenhum blob e liberado; a aba acumula centenas de MB e o WebView do Capacitor é encerrado por consumo de memoria no meio de um atendimento.

**Código atual:**

```jsx
const newAttachments = files.map(file => ({
      file,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
```

**Correção sugerida:** Chamar URL.revokeObjectURL(att.url) ao remover anexo, no reset e em cleanup de useEffect no unmount.

<details><summary>Verificação feita contra o código</summary>

URL.createObjectURL e criado na linha 414 para cada anexo de imagem e o grep por 'revokeObjectURL' no arquivo inteiro nao retornou nenhuma ocorrencia: nem em handleRemoveAttachment (432-445), nem em resetTriageForm (517-544, que so faz setAttachments([])), nem em cleanup de useEffect. Cada blob mantem o arquivo retido enquanto o documento viver.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0256 · MÉDIO · `CONFIRMADO`

**Analise prossegue sem nenhuma imagem quando so ha PDF anexado**

**Onde:** `src/components/ClinicalTriage.jsx:448`

**O defeito:** A validacao exige apenas attachments.length > 0, sem verificar se existe algum arquivo de imagem. Se o usuario anexar somente PDF/video, photoFile fica null (linhas 424-426) e analyzeWoundWithAI e chamada sem imagem, porem a tela de resultado continua apresentando a secao 'Mapeamento de Tecidos da Foto' com os hotspots clicaveis.

**Como falha:** Paciente do cartao 'Consulta & Acompanhamento Geral' anexa apenas o laudo em PDF e clica em 'Iniciar Analise Clinica iRec'. O resultado exibe a caixa com o texto 'Sem Imagem' e, sobre ela, os tres pontos numerados; clicando neles aparece '[Ponto 1] Tecido de Granulacao (70%)' referente a uma foto que nunca existiu.

**Código atual:**

```jsx
if (attachments.length === 0) {
      alert("Por favor, selecione ou tire pelo menos uma foto ou anexo da região afetada primeiro.");
      return;
    }
```

**Correção sugerida:** Exigir attachments.some(a => a.file.type.startsWith('image/')) e ocultar o mapeamento de tecidos quando image for null.

<details><summary>Verificação feita contra o código</summary>

A validacao das linhas 448-451 checa apenas attachments.length === 0. Com somente PDF/video, handleAttachmentsChange cai no else das linhas 423-426 e zera image/photoFile, mas a analise segue e a tela de resultado renderiza 'Mapeamento de Tecidos da Foto' com o placeholder 'Sem Imagem' (linha 1160) e os tres hotspots clicaveis por cima (1164-1234), com percentuais de tecido de uma foto inexistente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0257 · MÉDIO · `CONFIRMAR-SCHEMA`

**Excecao em handleStartAnalysis deixa a tela travada no spinner para sempre**

**Onde:** `src/components/ClinicalTriage.jsx:488`

**O defeito:** setIsAnalyzing(true) e feito na linha 453 e o unico setIsAnalyzing(false) fora dos early-returns esta na linha 513, sem try/finally cobrindo as linhas 456-504. Qualquer excecao nesse trecho deixa isAnalyzing=true permanentemente. A linha 488 e um ponto concreto de falha: finalResult.exudate nao existe no schema pedido ao modelo (src/services/geminiService.js:251-280), portanto se o modelo devolver esse campo com um numero ou objeto, .toUpperCase() lanca TypeError.

**Como falha:** O modelo devolve "exudate": 2 (ou um objeto) no JSON. A promise rejeita sem handler, setIsAnalyzing(false) nunca roda e o paciente fica indefinidamente na tela 'Analisando imagem e sintomas com o Sistema iRec...' com o spinner girando, sem botao de cancelar nem forma de voltar ao formulario a nao ser trocando de aba.

**Código atual:**

```jsx
exudate: (finalResult.exudate || exudate).toUpperCase(),
```

**Correção sugerida:** Envolver todo o corpo de handleStartAnalysis em try/catch/finally com setIsAnalyzing(false) no finally.

<details><summary>Verificação feita contra o código</summary>

Confirmado o defeito estrutural: setIsAnalyzing(true) na linha 453 e o unico setIsAnalyzing(false) do caminho feliz esta na linha 513, sem try/finally cobrindo 456-504 (o try da linha 506 cobre so a gravacao). Qualquer throw nesse trecho trava o spinner sem saida. Confirmei tambem que 'exudate' nao existe no schema pedido ao modelo (geminiService.js:251-280 lista isValidWound, type, lesionStage, severity, isRedirect, specialist, reason, geminiSummary, medPalmDiagnosis, treatmentPlan, aiArea/Length/Width, aiTissueAnalysis, aiRecommendation, clinicalEvolution). Rebaixo para medio porque o gatilho concreto citado (modelo devolver exudate numerico) e especulativo e nao existe outro throw provavel nesse intervalo.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0258 · MÉDIO · `CONFIRMADO`

**Escala de Braden e respostas do questionario nao sao limpas em 'Nova Triagem'**

**Onde:** `src/components/ClinicalTriage.jsx:517`

**O defeito:** resetTriageForm restaura 17 states mas nao restaura bradenSensory, bradenMoisture, bradenActivity nem bradenMobility. Como a tela e usada tambem por enfermeiro em sequencia de atendimentos (menu 'Fotografar Ferida' em src/App.jsx:1270), as respostas de mobilidade do paciente anterior permanecem marcadas.

**Como falha:** Enfermeiro avalia um paciente acamado, marca 'Totalmente deitado (acamado)' e 'Nao mudo de posicao (imovel)', conclui e clica em 'Nova Triagem' para o proximo paciente. A tela reabre com as opcoes do paciente anterior ainda selecionadas e exibindo 'Atencao Elevada (Risco de Lesao por Pressao)' para um paciente que anda normalmente.

**Código atual:**

```jsx
const resetTriageForm = () => {
    if (attachmentsInputRef.current) {
      attachmentsInputRef.current.value = "";
    }
    setImage(null);
    setPhotoFile(null);
```

**Correção sugerida:** Adicionar setBradenSensory(4), setBradenMoisture(4), setBradenActivity(4) e setBradenMobility(4) em resetTriageForm.

<details><summary>Verificação feita contra o código</summary>

Li resetTriageForm por completo (linhas 517-544): ela restaura 20 states mas nao chama setBradenSensory, setBradenMoisture, setBradenActivity nem setBradenMobility. Como 'Nova Triagem' nao desmonta o componente, os valores do atendimento anterior permanecem e o rotulo da linha 846 continua refletindo o paciente anterior. (dynamicAnswers, ao contrario do titulo do item, e limpo na linha 529.)

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0259 · MÉDIO · `CONFIRMADO`

**Controles principais sao <div> com onClick, inacessiveis por teclado**

**Onde:** `src/components/ClinicalTriage.jsx:583`

**O defeito:** O botao de anexar foto (linha 583), os 7 cartoes de queixa (linha 685) e os 3 hotspots do mapeamento (linhas 1164, 1188, 1212) sao <div onClick> sem role="button", sem tabIndex e sem handler de teclado. Nenhum deles recebe foco por Tab nem responde a Enter/Espaco. O <input type="file"> tambem esta com display:none e sem label associado.

**Como falha:** Paciente com limitacao motora que navega apenas por teclado (ou usa leitor de tela) chega a aba 'Fotografar Ferida' e nao consegue abrir o seletor de arquivos nem selecionar o tipo de queixa: o Tab pula direto para o slider de dor. O fluxo de triagem fica completamente inutilizavel para ele.

**Código atual:**

```jsx
<div 
                  onClick={() => attachmentsInputRef.current?.click()}
                  style={{
                    width: '100px',
```

**Correção sugerida:** Trocar esses <div onClick> por <button type="button"> (ou adicionar role="button", tabIndex={0} e onKeyDown para Enter/Espaco).

<details><summary>Verificação feita contra o código</summary>

Verificados todos os pontos citados: linha 583 (<div onClick={() => attachmentsInputRef.current?.click()}>), linha 685 (<div onClick={() => setPatientComplaintType(card.id)}> para os 7 cartoes) e as linhas 1164, 1188 e 1212 (hotspots). Nenhum deles tem role, tabIndex ou onKeyDown, e o <input type=file> das linhas 572-579 tem display:none sem label associado. Sao os controles de entrada do fluxo, entao a triagem fica inutilizavel apenas por teclado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0260 · MÉDIO · `CONFIRMADO`

**Botao 'Nao' selecionado fica com texto branco sobre fundo branco translucido**

**Onde:** `src/components/ClinicalTriage.jsx:770`

**O defeito:** Quando dynamicAnswers[q.key] === 'Nao', o botao recebe backgroundColor rgba(255,255,255,0.25) e color '#ffffff' fixos. No tema claro esse fundo translucido sobre --bg-secondary claro resulta em texto branco praticamente sobre branco. Os demais estados usam variaveis de tema, este e o unico com cor absoluta.

**Como falha:** Paciente no tema claro responde 'Nao' para 'A regiao esta quente ao toque?'. O rotulo do botao desaparece: ele nao consegue mais ler qual das duas opcoes esta marcada e nao tem como confirmar a resposta antes de enviar a triagem.

**Código atual:**

```jsx
backgroundColor: dynamicAnswers[q.key] === 'Não' ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                                  color: dynamicAnswers[q.key] === 'Não' ? '#ffffff' : 'var(--text-primary)',
```

**Correção sugerida:** Usar uma cor solida com contraste garantido no estado selecionado do 'Não' (ex.: backgroundColor 'var(--text-secondary)' com color 'var(--bg-primary)').

<details><summary>Verificação feita contra o código</summary>

Linhas 769-771 confirmam backgroundColor rgba(255,255,255,0.25) e color '#ffffff' fixos no estado selecionado, sobre um painel claro (rgba(2,132,199,0.08) do bloco iniciado na linha 719). E o unico estado do arquivo com cor absoluta: o botao 'Sim' usa #10b981 com branco (contraste ok, linhas 752-753) e os chips de select usam var(--primary) (795-796). No tema claro o rotulo 'Nao' fica ilegivel.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0261 · MÉDIO · `CONFIRMADO`

**Cabecalho de encaminhamento e sempre 'CASO CRITICO', mesmo em risco moderado**

**Onde:** `src/components/ClinicalTriage.jsx:1093`

**O defeito:** O texto do alerta vermelho e um literal fixo. result.severity, que pode valer 'Leve', 'Risco Moderado', 'Alto Risco' ou 'Critico', nunca e renderizado. Como o fallback local marca isRedirect=true para qualquer paciente diabetico ou fumante (linha 249), independentemente da queixa, o alerta maximo dispara em situacoes banais.

**Como falha:** Paciente diabetico seleciona o cartao 'Consulta & Acompanhamento Geral' apenas para registrar acompanhamento, sem lesao alguma. Em modo contingencia o fallback devolve severity='Alto Risco' com isRedirect=true e a tela grita 'CASO CRITICO - ENCAMINHAMENTO RECOMENDADO' com botao SOS de agendamento, gerando panico desnecessario. A justificativa exibida ainda afirma lesao em membro inferior sem que a localizacao tenha sido informada.

**Código atual:**

```jsx
<h3 style={{ fontSize: '16px', color: '#ef4444', fontWeight: '900', margin: 0 }}>CASO CRÍTICO - ENCAMINHAMENTO RECOMENDADO</h3>
```

**Correção sugerida:** Renderizar o titulo a partir de result.severity (ex.: 'ENCAMINHAMENTO RECOMENDADO - {severity}') em vez do literal 'CASO CRÍTICO'.

<details><summary>Verificação feita contra o código</summary>

Linha 1093 e literal fixo e result.severity nao aparece em nenhum ponto do arquivo (grep vazio). O fallback marca isRedirect=true com severity='Alto Risco' para qualquer diabetico ou fumante (linhas 249-253), independentemente da queixa selecionada, e o 'Motivo' exibido (linha 1102) afirma 'lesao em membro inferior' sem que localizacao alguma tenha sido informada - o campo anatomicalLocation nem sequer e coletado (item 42).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0262 · MÉDIO · `CONFIRMADO`

**Percentuais de tecido hardcoded (70/20/10) apresentados como analise da foto**

**Onde:** `src/components/ClinicalTriage.jsx:1242`

**O defeito:** Quando aiTissueAnalysis nao traz os campos, os hotspots exibem os literais 70, 20 e 10 como se fossem resultado da visao computacional, sob o titulo 'Mapeamento de Tecidos da Foto' e o texto 'Clique nos pontos numerados sobre a imagem para entender a analise de cada tecido'. Ao mesmo tempo o prontuario grava aiTissueAnalysis: {} (linha 501), gerando divergencia entre o que o paciente viu e o que ficou registrado.

**Como falha:** A IA responde sem o objeto aiTissueAnalysis. O paciente clica no ponto 1 e le 'Tecido de Granulacao (70%)' - numero que nunca foi calculado a partir da imagem dele. Abrindo o prontuario depois, nao existe nenhum percentual de tecido gravado.

**Código atual:**

```jsx
{result.aiTissueAnalysis?.granulacao !== undefined ? result.aiTissueAnalysis.granulacao : 70}%
```

**Correção sugerida:** Ocultar o ponto/percentual quando o campo for undefined em vez de exibir 70/20/10.

<details><summary>Verificação feita contra o código</summary>

Os literais 70, 20 e 10 estao nas linhas 1242, 1252 e 1262 como fallback de exibicao, sob o titulo 'Mapeamento de Tecidos da Foto' (1130) e o texto 'Clique nos pontos numerados... para entender a analise de cada tecido' (1133), enquanto a linha 501 grava aiTissueAnalysis: {} - divergencia real entre tela e prontuario. Rebaixo de alto para medio porque o caminho so e alcancado quando a IA responde sem o objeto: o fallback local (linha 304) sempre preenche os quatro campos.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0460 · BAIXO · `CONFIRMADO`

**setImage/setPhotoFile chamados dentro do updater de setAttachments (funcao impura)**

**Onde:** `src/components/ClinicalTriage.jsx:417`

**O defeito:** Os dois handlers de anexo executam setImage e setPhotoFile dentro da funcao passada a setAttachments. Updaters de state precisam ser puros; o app roda com <StrictMode> (src/main.jsx:19), que invoca a funcao de atualizacao duas vezes em desenvolvimento, disparando os efeitos colaterais em duplicidade e tornando o resultado dependente da quantidade de invocacoes que o React decide fazer.

**Como falha:** Em desenvolvimento, cada selecao de arquivo executa o corpo do updater duas vezes, chamando setImage/setPhotoFile duas vezes por anexo. Se o React reexecutar o updater com um valor de 'prev' diferente (rebase de atualizacoes concorrentes), image/photoFile podem terminar apontando para um anexo que nao e o ultimo da lista, e a foto enviada para a IA nao sera a exibida na tela.

**Código atual:**

```jsx
setAttachments(prev => {
      const updated = [...prev, ...newAttachments];
      const lastImage = [...updated].reverse().find(att => att.file.type.startsWith('image/'));
      if (lastImage) {
        setImage(lastImage.url);
        setPhotoFile(lastImage.file);
```

**Correção sugerida:** Calcular a lista atualizada fora do updater e chamar setAttachments/setImage/setPhotoFile em sequencia, sem efeitos dentro do updater.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois handlers (linhas 417-428 e 433-444): setImage/setPhotoFile sao chamados dentro da funcao passada a setAttachments, o que viola a exigencia de updater puro, e main.jsx:19 confirma <StrictMode>. Rebaixo de medio para baixo porque a dupla invocacao apenas repete setState com o mesmo valor (idempotente); o cenario de 'prev' divergente exige rebase concorrente que este codigo, sem transicoes, nao produz na pratica.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0461 · BAIXO · `CONFIRMADO`

**Spinner de carregamento e tela de resultado sao renderizados ao mesmo tempo**

**Onde:** `src/components/ClinicalTriage.jsx:476`

**O defeito:** setResult(finalResult) e executado na linha 476, antes de setAnalysisStep('Gravando no Prontuario...') e antes do await da gravacao. Os blocos condicionais do render sao independentes: {isAnalyzing && ...} na linha 1049 e {result && ...} na linha 1069, sem guarda mutua. Durante toda a gravacao os dois aparecem simultaneamente e os botoes de acao do resultado ficam clicaveis.

**Como falha:** Apos a analise o paciente ve o spinner 'Gravando no Prontuario do Paciente...' e, logo abaixo, o relatorio completo com os botoes 'Nova Triagem' e 'Ver no Prontuario'. Se ele clicar em 'Ver no Prontuario' nesse instante, resetTriageForm limpa o formulario e a navegacao ocorre antes de addClinicalEntry(savedEntry) rodar; ele chega ao historico e nao encontra o registro que acabou de fazer.

**Código atual:**

```jsx
setResult(finalResult);
    setSelectedHotspot(null);

    setAnalysisStep('Gravando no Prontuário do Paciente...');
```

**Correção sugerida:** Trocar a condicao do bloco de resultado para {result && !isAnalyzing && ...} (ou so chamar setResult apos a gravacao).

<details><summary>Verificação feita contra o código</summary>

setResult(finalResult) esta na linha 476, antes de setAnalysisStep('Gravando no Prontuario...') (479) e do await da gravacao (507); os blocos {isAnalyzing && ...} (1049) e {result && ...} (1069) sao independentes, sem guarda mutua - so o formulario tem a guarda !isAnalyzing && !result (559). Logo, spinner e relatorio aparecem juntos durante a gravacao. Rebaixo de medio para baixo porque o cenario descrito exagera: mesmo se o usuario clicar em 'Ver no Prontuario', addClinicalEntry(savedEntry) ainda executa depois e atualiza o state do historico, entao nao ha perda do registro.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0462 · BAIXO · `CONFIRMAR-SCHEMA`

**Ramo morto: finalResult.painLevel nunca existe no contrato da IA**

**Onde:** `src/components/ClinicalTriage.jsx:487`

**O defeito:** O codigo tenta priorizar finalResult.painLevel, mas esse campo nao existe no schema JSON exigido do modelo (src/services/geminiService.js:251-280) nem no retorno de generateLocalFallbackAnalysis (linhas 291-309). A condicao e sempre falsa e o operador ternario e um ramo inalcancavel.

**Como falha:** Nenhuma resposta possivel do backend ativa esse caminho: pain sempre vem do slider. O trecho sugere ao proximo desenvolvedor que a IA reavalia a dor, quando na pratica isso nunca acontece.

**Código atual:**

```jsx
pain: finalResult.painLevel !== undefined ? finalResult.painLevel : pain,
```

**Correção sugerida:** Simplificar para 'pain: pain' ou incluir painLevel no schema pedido ao modelo, se a reavaliacao da dor for desejada.

<details><summary>Verificação feita contra o código</summary>

Li o schema exigido do modelo em geminiService.js:251-280 e nao ha 'painLevel' (os campos sao isValidWound, invalidReason, type, lesionStage, severity, isRedirect, specialist, reason, geminiSummary, medPalmDiagnosis, treatmentPlan, aiAreaCm2/LengthCm/WidthCm, aiTissueAnalysis, aiRecommendation, clinicalEvolution); generateLocalFallbackAnalysis (291-309) tambem nao o devolve. O ternario da linha 487 e, portanto, inalcancavel - defeito de manutencao, sem impacto funcional.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0463 · BAIXO · `VERIFICAR`

**Lista mutavel de anexos usa key={idx}**

**Onde:** `src/components/ClinicalTriage.jsx:618`

**O defeito:** Os cards de anexo sao renderizados com key igual ao indice, embora a lista sofra remocoes no meio via handleRemoveAttachment. O React reaproveita os nos DOM por posicao em vez de por arquivo.

**Como falha:** Usuario anexa foto A, video B e PDF C e remove o item do meio (B). O React mantem o no da posicao 1 e apenas troca o conteudo, reaproveitando o elemento anterior; estados internos do DOM daquela posicao (scroll do nome do arquivo, animacao de entrada, imagem em cache de decodificacao) ficam vinculados ao anexo errado, e um <img> pode exibir brevemente a miniatura do arquivo removido.

**Código atual:**

```jsx
<div key={idx} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '16px', overflow: 'hidden', border: '1.5px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
```

**Correção sugerida:** Usar uma key estavel por anexo (ex.: `${file.name}-${file.lastModified}` ou um id gerado no momento do upload).

<details><summary>Verificação feita contra o código</summary>

O padrao existe: linha 618 usa key={idx} numa lista que sofre remocao no meio (handleRemoveAttachment, linha 432). Porem os cards de anexo nao guardam estado interno de React e o <img src> e reatribuido no mesmo commit, entao o cenario descrito (miniatura obsoleta, animacao vinculada ao anexo errado) e teoricamente possivel mas nao consegui confirmar efeito visivel. Anti-padrao real, dano nao comprovado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0464 · BAIXO · `CONFIRMADO`

**Botao de remover anexo sem nome acessivel**

**Onde:** `src/components/ClinicalTriage.jsx:634`

**O defeito:** O botao de exclusao de anexo tem como unico conteudo o caractere decorativo '✕', sem aria-label, title ou texto visualmente oculto, e sem indicar de qual anexo se trata.

**Como falha:** Paciente com leitor de tela anexou 3 fotos e um PDF. Ao percorrer a lista, o leitor anuncia quatro botoes identicos ('letra X' ou nada, dependendo do leitor), sem dizer o que fazem nem qual arquivo removem. Ele nao consegue apagar a foto errada com seguranca.

**Código atual:**

```jsx
<button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        style={{
                          position: 'absolute',
```

**Correção sugerida:** Adicionar aria-label={`Remover anexo ${fileObj.file.name}`} ao botao.

<details><summary>Verificação feita contra o código</summary>

Linhas 634-657: o <button> tem apenas o caractere '✕' como conteudo, sem aria-label, sem title e sem referencia ao arquivo. Com varios anexos, o leitor de tela anuncia botoes indistinguiveis.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0465 · BAIXO · `CONFIRMADO`

**Cor e rotulo da intensidade da dor usam limites diferentes**

**Onde:** `src/components/ClinicalTriage.jsx:819`

**O defeito:** A cor usa os cortes >6 (vermelho) e >3 (ambar), enquanto o rotulo textual usa <=3 (Leve), <=7 (Moderada) e >7 (Intensa). Os limites divergem em 7, produzindo estado inconsistente na mesma linha de texto.

**Como falha:** Paciente arrasta o slider para 7. O valor aparece em vermelho de risco alto mas escrito '7/10 (Moderada)'. O paciente (e o enfermeiro que le a tela) recebe dois sinais contraditorios sobre a gravidade da dor.

**Código atual:**

```jsx
<span style={{ fontWeight: '800', fontSize: '13px', color: pain > 6 ? '#ef4444' : pain > 3 ? '#f59e0b' : '#10b981' }}>
                    {pain}/10 ({pain === 0 ? 'Sem dor' : pain <= 3 ? 'Leve' : pain <= 7 ? 'Moderada' : 'Intensa'})
```

**Correção sugerida:** Alinhar os cortes de cor aos do rotulo (pain > 7 vermelho, pain > 3 ambar).

<details><summary>Verificação feita contra o código</summary>

Linhas 819-820: a cor usa pain > 6 (vermelho) e pain > 3 (ambar), enquanto o rotulo usa pain <= 3 'Leve', <= 7 'Moderada' e > 7 'Intensa'. Em pain=7 o numero aparece vermelho com o texto 'Moderada' - inconsistencia real, porem apenas cosmetica e sem efeito no prontuario.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0466 · BAIXO · `CONFIRMADO`

**Rotulos de formulario sem associacao com os campos**

**Onde:** `src/components/ClinicalTriage.jsx:1008`

**O defeito:** O <label> da descricao de sintomas e o da 'Intensidade da Dor' (linha 818) nao envolvem o controle nem possuem htmlFor/id correspondente. Os <label> das perguntas dinamicas (linha 737) apontam para grupos de <button>, que nao sao elementos rotulaveis, e o grupo nao esta em fieldset/legend.

**Como falha:** Paciente com leitor de tela chega ao textarea e ouve apenas o placeholder, sem saber que se trata da 'Descricao adicional da queixa ou sintomas'. Nas perguntas dinamicas ouve somente 'Sim' e 'Nao' repetidos, sem a pergunta a que se referem, e responde as questoes trocadas.

**Código atual:**

```jsx
<label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '6px' }}>
                  Descrição adicional da queixa ou sintomas
                </label>
                <textarea
                  ref={textareaRef}
```

**Correção sugerida:** Associar cada label ao controle via htmlFor/id e trocar os grupos de botoes por fieldset/legend (ou role="radiogroup" com aria-labelledby).

<details><summary>Verificação feita contra o código</summary>

Verificado nas tres ocorrencias: o <label> da linha 1008 nao tem htmlFor e o <textarea> das linhas 1011-1031 nao tem id; o <label> 'Intensidade da Dor' (818) tampouco se liga ao input range (823-830); e o <label> das perguntas dinamicas (737-739) precede um grupo de <button> sem fieldset/legend nem aria-labelledby. Todos sao rotulos orfaos para tecnologia assistiva.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "ClinicalTriage.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
