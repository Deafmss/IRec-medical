# 3. Protocolos, receitas e laudos

**46 defeitos** — 8 crítico · 13 alto · 16 médio · 9 baixo

Arquivos tocados por este módulo:

- `src/components/PrescriptionGeneratorModal.jsx`
- `src/components/PrescriptionPage.jsx`
- `src/components/ProtocolGuide.jsx`
- `src/components/ReportPDFGenerator.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0018 · CRÍTICO · `CONFIRMADO`

**Qualquer papel diferente de 'doctor' é rotulado como Enfermeiro(a) Estomaterapeuta e pode emitir receituário**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:16`

**O defeito:** A única checagem é isDoctor = currentUser?.role === 'doctor'. Todo o resto (paciente, admin, papel ausente) é assumido como 'Enfermeiro(a) Estomaterapeuta' com registro 'COREN'. Não há qualquer validação de que o usuário possa prescrever, e o tipo 'receita' (medicamentos) fica habilitado também para role 'nurse'. A verificação é apenas no cliente, sem RLS ou validação de servidor (o documento nem é gravado no Supabase).

**Como falha:** Paciente logado navega para a URL com hash #prescriptions (o App restaura activeTab do hash em App.jsx:38-40 e o case 'prescriptions' em App.jsx:885 não tem nenhum guard de papel). Ele vê 'Fulano • COREN: 123456-SP', preenche 'Amoxicilina 500mg, 8/8h' e imprime um receituário com carimbo 'DOCUMENTO AUTENTICADO iREC'.

**Código atual:**

```jsx
const isDoctor = currentUser?.role === 'doctor';
  const professionalRoleTitle = isDoctor ? 'Médico(a) Credenciado(a)' : 'Enfermeiro(a) Estomaterapeuta';
  const registryType = isDoctor ? 'CRM' : 'COREN';
```

**Correção sugerida:** Renderizar o gerador apenas para role 'doctor'/'nurse' validado, com o tipo 'receita' restrito a 'doctor', e validar o papel também no servidor.

<details><summary>Verificação feita contra o código</summary>

Linhas 15-17 fazem a única checagem (role === 'doctor') e tudo o mais — paciente, admin, role ausente — recebe 'Enfermeiro(a) Estomaterapeuta' e registro 'COREN'. Confirmei em App.jsx:885-893 que o case 'prescriptions' não tem guard de papel e em App.jsx:37-43 que activeTab vem direto do hash da URL sem lista branca. Não há validação de servidor: o documento nem é gravado no Supabase.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0019 · CRÍTICO · `CONFIRMAR-SCHEMA`

**Receita/atestado oficial é impressa com registro profissional falso '123456-SP'**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:18`

**O defeito:** registryNumber cai no literal '123456-SP' quando currentUser.crm é vazio. Isso acontece com frequência: getClinicalProfile mapeia 'crm: newData.crm || \'\'' (supabaseService.js:445 e 522), ou seja crm nulo vira string vazia, que é falsy. O campo 'coren' não existe em lugar algum do projeto (o schema tem apenas 'crm text' em clean_database_v3.sql:18), portanto currentUser?.coren é sempre undefined e o fallback fake é usado. Esse número é impresso duas vezes no documento (linhas 365 e 439), ao lado da linha de assinatura.

**Como falha:** Médico ou enfermeiro que se cadastrou sem preencher o registro (ou paciente que alcança a aba de prescrições) emite uma receita: o documento sai com 'CRM: 123456-SP' abaixo da linha de assinatura e é apresentado na farmácia como receita válida.

**Código atual:**

```jsx
const registryNumber = currentUser?.crm || currentUser?.coren || '123456-SP';
```

**Correção sugerida:** Bloquear a emissão quando currentUser.crm estiver vazio, exibindo 'Registro profissional não cadastrado' em vez de um número inventado.

<details><summary>Verificação feita contra o código</summary>

Linha 18: currentUser?.crm || currentUser?.coren || '123456-SP'. Grep confirma que 'coren' não existe como campo de dados em nenhum lugar (só aparece em texto de UI em App.jsx:1007/1018), e que crm é normalizado para '' em vários pontos do supabaseService (linhas 20, 140, 244, 445, 522, 577...), sendo falsy. O literal é impresso na identificação (linha 365) e sob a linha de assinatura (linha 439), além do cabeçalho da tela (linha 112).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0020 · CRÍTICO · `CONFIRMADO`

**Botão 'ASSINAR (ICP-BRASIL)' exibe assinatura digital falsa e não altera o documento**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:469`

**O defeito:** O handler apenas mostra um alert afirmando 'Certificado Validado: AC SOLUTI v5 (ICP-Brasil)' e 'Carimbo de Tempo P7S/CMS emitido com sucesso!'. Nenhuma criptografia, certificado ou carimbo de tempo é envolvido. O flag isSignedICP e signedAt são gravados no state mas nunca aparecem no documento imprimível (#printable-document, linhas 335-442) e não são repassados a onPrescriptionCreated, então nem ficam no histórico.

**Como falha:** Profissional clica em 'ASSINAR (ICP-BRASIL)', lê o alerta de sucesso, o botão fica verde com 'ASSINADO (ICP-BRASIL)' e ele imprime a receita acreditando que está assinada digitalmente com validade jurídica. O PDF impresso é idêntico ao não assinado e não tem qualquer assinatura eletrônica.

**Código atual:**

```jsx
alert("🔐 Iniciando autenticação com Certificado Digital ICP-Brasil (A3/A1)...\nCertificado Validado: AC SOLUTI v5 (ICP-Brasil)\nCarimbo de Tempo P7S/CMS emitido com sucesso!");
                  setGeneratedDocument(prev => prev ? {
                    ...prev,
                    isSignedICP: true,
```

**Correção sugerida:** Remover o botão de assinatura ICP-Brasil até haver integração real com certificado digital e carimbo de tempo.

<details><summary>Verificação feita contra o código</summary>

Linhas 467-493: o onClick só dispara um alert afirmando 'Certificado Validado: AC SOLUTI v5 (ICP-Brasil)' e 'Carimbo de Tempo P7S/CMS emitido com sucesso!' e grava isSignedICP/signedAt no state. Li todo o #printable-document (linhas 335-442) e nenhum desses campos aparece; docData enviado a onPrescriptionCreated (linhas 55-79) também não os contém. O botão apenas muda de cor e de rótulo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0021 · CRÍTICO · `CONFIRMADO`

**Tela de prescrições não tem nenhuma verificação de papel e é alcançável por paciente**

**Onde:** `src/components/PrescriptionPage.jsx:4`

**O defeito:** O componente recebe currentUser mas nunca checa o papel: renderiza o gerador de documentos para qualquer usuário autenticado. Em App.jsx o 'case prescriptions' (linha 885) também não tem guard, e o activeTab inicial é lido diretamente do hash da URL (App.jsx:38-40) sem lista branca. Combinado com PrescriptionGeneratorModal.jsx:16-18, um paciente aparece como 'Enfermeiro(a) Estomaterapeuta / COREN: 123456-SP'.

**Como falha:** Paciente logado digita <url-do-app>/#prescriptions (ou tem esse valor restaurado do storage). A tela 'Prescrições, Atestados & Receituários' abre completa; ele emite para si mesmo um atestado de 30 dias e um receituário de antibiótico, imprime com o selo 'DOCUMENTO AUTENTICADO iREC' e ainda passa a ver o histórico de documentos de outros pacientes.

**Código atual:**

```jsx
export default function PrescriptionPage({ currentUser, selectedPatient, clinicalProfile, setActiveTab }) {
```

**Correção sugerida:** Adicionar guard de papel no case 'prescriptions' do App.jsx e um early return em PrescriptionPage para quem não for clínico validado.

<details><summary>Verificação feita contra o código</summary>

Li PrescriptionPage.jsx:4-94: currentUser é recebido mas nunca checado; o gerador é renderizado para qualquer usuário autenticado. App.jsx:885-893 (case 'prescriptions') não tem guard, e App.jsx:37-43 restaura activeTab direto do hash sem lista branca. Somado a PrescriptionGeneratorModal.jsx:15-18, um paciente aparece como 'Enfermeiro(a) Estomaterapeuta / COREN: 123456-SP'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0022 · CRÍTICO · `CONFIRMAR-SCHEMA`

**Histórico de receitas fica em chave global do localStorage, sem vínculo com usuário e sem limpeza no logout**

**Onde:** `src/components/PrescriptionPage.jsx:18`

**O defeito:** Os documentos emitidos (nome do paciente, CPF, medicamentos, motivo do atestado) são gravados na chave única 'irec_prescription_history', sem prefixo de usuário. A leitura na linha 7 também não filtra por profissional nem por paciente. Confirmei por Grep que handleLogout (App.jsx:652-667) remove apenas irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab — 'irec_prescription_history' nunca é apagado.

**Como falha:** Médico usa um tablet compartilhado da clínica, emite receitas para 10 pacientes e faz logout. O próximo usuário (outro profissional, ou até um paciente) faz login, abre a aba de Prescrições e o painel 'Histórico Emitido (10)' lista nome, código e, ao ser lido do storage, CPF e medicamentos de todos os pacientes anteriores. Vazamento de dado clínico entre titulares, violando a LGPD.

**Código atual:**

```jsx
const handlePrescriptionCreated = (docData) => {
    const updated = [docData, ...prescriptionHistory];
    setPrescriptionHistory(updated);
    localStorage.setItem('irec_prescription_history', JSON.stringify(updated));
  };
```

**Correção sugerida:** Persistir o histórico no banco com RLS por emissor/paciente e, no mínimo, remover 'irec_prescription_history' no handleLogout.

<details><summary>Verificação feita contra o código</summary>

Linhas 5-19: leitura e escrita em 'irec_prescription_history' sem prefixo de usuário e sem filtro por profissional ou paciente; o objeto salvo contém patientName, patientCpf, medications e certificateReason. Li handleLogout em App.jsx:652-668 e ele remove apenas irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab — a chave do histórico permanece. Combinado com a falta de guard de papel (item 50024), o próximo usuário do dispositivo vê o histórico anterior.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0023 · CRÍTICO · `CONFIRMADO`

**Relatório de evolução exibe percentual de cicatrização inventado (56%) quando há menos de 2 registros**

**Onde:** `src/components/ReportPDFGenerator.jsx:20`

**O defeito:** O percentual de cicatrização é inicializado com o valor fixo 56 e o rótulo '56% de Redução da Lesão'. Se o paciente tiver 0 ou 1 registro de ferida, o bloco de cálculo (linha 23) nunca executa e o laudo impresso afirma que houve 56% de redução da lesão, sem nenhum dado que sustente isso. O mesmo ocorre para médico/admin abrindo a aba 'documents', pois em App.jsx o state clinicalProfile só é populado para role 'patient' (App.jsx:553), então o laudo sai como 'Paciente iRec' com 56%.

**Como falha:** Paciente recém-cadastrado envia sua PRIMEIRA foto de ferida, vai em Documentos e clica em gerar relatório PDF. O documento intitulado 'LAUDO EVOLUTIVO DE CICATRIZAÇÃO' mostra o círculo verde '56%' e o texto '56% de Redução da Lesão', com QR Code de 'autenticação', e ele leva esse papel ao médico como comprovação de melhora.

**Código atual:**

```jsx
let healingPercentage = 56;
  let healingLabel = "56% de Redução da Lesão";
```

**Correção sugerida:** Inicializar healingPercentage=null e, quando não houver dados suficientes, renderizar 'Dados insuficientes para cálculo de evolução' em vez do círculo percentual.

<details><summary>Verificação feita contra o código</summary>

Linhas 20-21 inicializam healingPercentage=56 e healingLabel='56% de Redução da Lesão'. O bloco de cálculo só roda com entries.length >= 2 (linha 23); com 0 ou 1 registro os literais permanecem e são renderizados no laudo (linhas 143 e 147), dentro de um documento intitulado 'LAUDO EVOLUTIVO DE CICATRIZAÇÃO' com 'Código de Autenticidade'. Confirmei também que App.jsx:551-563 só popula clinicalProfile para role 'patient', então médico/enfermeiro veem 'Paciente iRec' com 56%. Não há nenhuma guarda.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0024 · CRÍTICO · `CONFIRMADO`

**Cálculo de cicatrização usa campos inexistentes e cai em fallback 10/4, resultando em 60% fixo para todo paciente**

**Onde:** `src/components/ReportPDFGenerator.jsx:26`

**O defeito:** O cálculo lê first.area, first.woundArea e first.size. Nenhum desses campos existe no objeto de entry retornado por getWoundEntries (supabaseService.js:866-898 mapeia id, patientId, date, type, pain, exudate, aiAreaCm2, aiLengthCm, aiWidthCm, aiTissueAnalysis, etc.). Confirmei por Grep que 'area:', 'woundArea:' e 'size:' não existem em nenhum lugar de src/. Portanto os fallbacks numéricos 10 e 4 são SEMPRE usados, e pct = round(((10-4)/10)*100) = 60. O campo real de área é aiAreaCm2.

**Como falha:** Qualquer paciente com 2 ou mais registros gera o relatório: independentemente de a ferida ter fechado, estagnado ou triplicado de tamanho, o laudo sempre estampa '60% de Redução da Lesão' e o círculo '60%'. Dois pacientes com evoluções opostas recebem laudos idênticos.

**Código atual:**

```jsx
const firstArea = parseFloat(first.area || first.woundArea || first.size || 10);
    const latestArea = parseFloat(latest.area || latest.woundArea || latest.size || 4);
```

**Correção sugerida:** Usar parseFloat(first.aiAreaCm2) e parseFloat(latest.aiAreaCm2) e abortar o cálculo (sem fallback numérico) quando qualquer um for inválido.

<details><summary>Verificação feita contra o código</summary>

Li o mapeamento de getWoundEntries (supabaseService.js:866-898): os campos expostos são id, patientId, date, type, pain, exudate, aiAreaCm2, aiLengthCm, aiWidthCm, aiTissueAnalysis etc. Não existe area, woundArea nem size. Logo parseFloat cai sempre em 10 e 4 e pct = round(((10-4)/10)*100) = 60 para qualquer paciente com 2+ registros. O campo real de área é aiAreaCm2.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0025 · CRÍTICO · `CONFIRMADO`

**Laudo sem registros imprime uma linha clínica totalmente fictícia**

**Onde:** `src/components/ReportPDFGenerator.jsx:176`

**O defeito:** Quando entries está vazio, em vez de exibir 'sem registros', o componente renderiza uma linha completa de dados clínicos inventados: 'Úlcera de Pressão / Eritema', '3/10 (Leve)' e 'Tecido de granulação saudável em bordas. Redução de exsudato.' — apresentados dentro de um documento que se autodenomina 'LAUDO AUTENTICADO iREC'.

**Como falha:** Usuário recém-cadastrado, sem nenhuma triagem, abre Documentos e imprime o relatório. Sai um laudo com CPF do paciente afirmando que ele tem úlcera de pressão com granulação saudável e dor leve — diagnóstico que nunca existiu e que pode ser usado para pleitear benefício ou orientar conduta.

**Código atual:**

```jsx
<tr>
                  <td ...>{currentDate}</td>
                  <td ...>Úlcera de Pressão / Eritema</td>
                  <td ...>3/10 (Leve)</td>
                  <td ...>Tecido de granulação saudável em bordas. Redução de exsudato.</td>
                </tr>
```

**Correção sugerida:** Substituir a linha de exemplo por uma célula única 'Nenhum registro de lesão disponível' e bloquear a emissão do laudo sem registros.

<details><summary>Verificação feita contra o código</summary>

Linhas 174-181: quando entries é vazio, o ternário renderiza uma linha completa com 'Úlcera de Pressão / Eritema', '3/10 (Leve)' e 'Tecido de granulação saudável em bordas. Redução de exsudato.' dentro do documento com CPF do paciente e selo 'LAUDO AUTENTICADO iREC'. Não há guarda alguma impedindo a abertura do gerador sem registros.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0122 · ALTO · `CONFIRMADO`

**QR Code de validação da receita aponta para uma rota que o app não implementa**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:52`

**O defeito:** A URL de validação usa o parâmetro de query ?validar=<docId>, que confirmei por Grep não ser lido em nenhum arquivo do projeto (o App só interpreta window.location.hash). O docId vem de Math.random() e não é persistido em banco. Ainda assim o documento estampa 'DOCUMENTO AUTENTICADO iREC', 'Validação Digital por QR Code' e 'Hash: <docId>' — o valor é o próprio código aleatório, não um hash do conteúdo.

**Como falha:** Farmacêutico escaneia o QR da receita para conferir a validade e é levado à tela de login do app, sem qualquer verificação. Como o código é aleatório e não gravado, uma receita adulterada (ou emitida por um paciente) exibe o mesmo selo de autenticidade.

**Código atual:**

```jsx
const qrValidationUrl = `https://i-rec-medical.vercel.app/?validar=${docId}`;
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrValidationUrl)}`;
```

**Correção sugerida:** Remover os selos de autenticidade e o QR enquanto não existir endpoint real de validação com o documento persistido.

<details><summary>Verificação feita contra o código</summary>

Linhas 45 e 52-53: docId vem de Math.random() e a URL usa ?validar=<docId>, parâmetro que o app nunca lê (grep de 'validar' só encontra as próprias strings; App.jsx interpreta apenas o hash). O documento estampa 'DOCUMENTO AUTENTICADO iREC', 'Validação Digital por QR Code' e 'Hash: <docId>' (linhas 425-432) — o valor é o código aleatório, não um hash do conteúdo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0123 · ALTO · `CONFIRMADO`

**Documentos emitidos pelo modal do painel médico nunca são persistidos (onPrescriptionCreated não é passado)**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:77`

**O defeito:** A persistência do documento depende inteiramente do callback opcional onPrescriptionCreated. Em App.jsx:2121-2125 o modal é renderizado sem essa prop (apenas currentUser, patientProfile e onClose). Como o componente também não grava nada no Supabase, o documento existe somente no state; ao fechar o modal ele é perdido, inclusive o 'código de validação'.

**Como falha:** Médico no DoctorDashboard clica em emitir receita (onOpenPrescriptionModal -> setShowPrescriptionModal(true), App.jsx:751), preenche, emite, imprime e fecha. Nada aparece no 'Histórico Emitido' da tela de Prescrições e não há registro algum do que foi prescrito ao paciente — o prontuário fica sem rastro da prescrição.

**Código atual:**

```jsx
if (onPrescriptionCreated) {
      onPrescriptionCreated(docData);
    }
```

**Correção sugerida:** Passar onPrescriptionCreated no App.jsx e persistir o documento no Supabase vinculado a paciente e emissor, não apenas no state.

<details><summary>Verificação feita contra o código</summary>

Linhas 77-79 condicionam toda a persistência ao callback opcional. Li App.jsx:2119-2126: o modal é renderizado apenas com currentUser, patientProfile e onClose — sem onPrescriptionCreated. O componente também não grava nada no Supabase, então o documento vive só no state e some ao fechar. O caminho de DoctorDashboard usa exatamente esse modal (App.jsx:751).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0124 · ALTO · `CONFIRMADO`

**window.print() da receita imprime o app inteiro e trunca a prescrição fora da área visível**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:84`

**O defeito:** handlePrint chama window.print() sem isolar #printable-document. O @media print de src/index.css:837-889 não tem nenhuma regra para #printable-document e só oculta elementos com classes (.btn, .no-print, ...) que este componente não usa — os botões são estilizados inline. O container do modal tem maxHeight '92vh' + overflowY 'auto' (linhas 91-92), então o navegador imprime somente o trecho visível.

**Como falha:** Médico prescreve 6 medicamentos, rola até o fim e clica em 'IMPRIMIR / PDF'. O PDF sai com o cabeçalho escuro do modal (texto branco sobre fundo escuro, ilegível no papel), com os três botões de ação impressos dentro do documento e com parte da lista de medicamentos cortada porque estava fora do scroll de 92vh.

**Código atual:**

```jsx
const handlePrint = () => {
    triggerVibration();
    window.print();
  };
```

**Correção sugerida:** Adicionar @media print isolando #printable-document (esconder body *, mostrar apenas o documento) e remover maxHeight/overflow na impressão.

<details><summary>Verificação feita contra o código</summary>

handlePrint (linhas 82-85) chama window.print() sem isolar #printable-document; index.css:837-889 não tem regra para esse id e só oculta classes que este componente não usa (os botões das linhas 446-509 são inline, sem .btn). O truncamento por maxHeight '92vh' + overflowY 'auto' (linhas 91-92) vale para o modo modal (caminho de App.jsx:2120-2126); em embeddedMode esses valores são 'none'/'visible', então nesse caso a truncagem não ocorre mas a impressão do app inteiro sim.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0125 · ALTO · `CONFIRMADO`

**Protocolo local recomenda terapia compressiva sem checar doença arterial periférica (contraindicação)**

**Onde:** `src/components/ProtocolGuide.jsx:126`

**O defeito:** O fallback local adiciona a etapa de compressão apenas com base em profile.hasVenousInsufficiency, sem consultar profile.hasPeripheralArterialDisease — que existe no perfil e é usado no título (linha 81) e nas badges (linha 657). Na versão do paciente o texto orienta usar meias/enfaixamento compressivo sem qualquer ressalva arterial. O próprio prompt do Gemini exige o contrário: 'Se não houver doença arterial associada, recomende terapia compressiva' (geminiService.js:663). A versão do clínico (linhas 48-53) apenas menciona medir ITB, mas também é adicionada mesmo com DAP marcada.

**Como falha:** Paciente com insuficiência venosa E doença arterial periférica marcadas na ficha abre 'Guias e Protocolos'. Quando o Gemini está indisponível (ou não configurado), o guia local orienta: 'use meias elásticas ou enfaixamento de compressão'. Compressão em membro com DAP pode agravar a isquemia e levar a necrose/amputação.

**Código atual:**

```jsx
if (profile.hasVenousInsufficiency) {
    steps.push({
      title: '3. Cuidado com o Inchaço e Uso de Meias',
      desc: 'Se o seu médico indicou, use meias elásticas ou enfaixamento de compressão. ...'
```

**Correção sugerida:** Envolver a etapa em if (profile.hasVenousInsufficiency && !profile.hasPeripheralArterialDisease) e, com DAP marcada, emitir alerta de contraindicação à compressão.

<details><summary>Verificação feita contra o código</summary>

Linhas 126-131: a etapa de compressão é adicionada apenas com if (profile.hasVenousInsufficiency), sem consultar profile.hasPeripheralArterialDisease — campo que existe e é usado no título (linha 81) e nas badges (linha 657). A versão do clínico (48-53) traz a ressalva de aferir ITB, mas também é adicionada com DAP marcada. Severidade rebaixada de crítico para alto porque o texto do paciente é condicionado a 'Se o seu médico indicou' e a versão clínica traz o critério de ITB > 0.8.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0126 · ALTO · `CONFIRMADO`

**Protocolo local ignora completamente alergias e medicamentos do paciente**

**Onde:** `src/components/ProtocolGuide.jsx:147`

**O defeito:** generateDefaultPersonalizedProtocol (linhas 6-162) lê apenas name, hasDiabetes, hasHypertension, hasVenousInsufficiency, hasPeripheralArterialDisease, isSmoker e aiTissueAnalysis. Os campos profile.allergies e profile.medications (existentes no perfil, supabaseService.js:459-460) nunca são consultados, e ainda assim o protocolo indica nominalmente PHMB/Prontosan, alginato de cálcio, hidrocolóide e AGE/Dersani. O prompt do Gemini exige explicitamente 'Não prescreva nenhuma cobertura ou componente que contenha alérgenos do paciente' (geminiService.js:661) — a versão local viola essa regra, e é ela que roda sempre que a IA falha ou não está configurada.

**Como falha:** Paciente com 'alergia a alginato e a clorexidina/PHMB' registrada na ficha clínica abre a aba Protocolos sem Gemini configurado. O guia recomenda 'Solução Antisséptica de PHMB (350ml) - Prontosan' e 'Placa de Alginato de Cálcio', com botão de compra, sob o selo 'Diretriz Clínica Integrada ... Ministério da Saúde e COFEN'.

**Código atual:**

```jsx
materials.push({ name: 'Solução Antisséptica de PHMB (350ml)', price: 'R$ 62,00', brand: 'Prontosan' });
  materials.push({ name: 'Óleo Dersani AGE (100ml)', price: 'R$ 38,90', brand: 'Dersani' });
```

**Correção sugerida:** Filtrar materials e steps contra profile.allergies antes de retornar, omitindo qualquer insumo cujo princípio conste nas alergias declaradas.

<details><summary>Verificação feita contra o código</summary>

Li generateDefaultPersonalizedProtocol inteira (linhas 6-162): ela consulta apenas name, hasDiabetes, hasHypertension, hasVenousInsufficiency, hasPeripheralArterialDisease, isSmoker e aiTissueAnalysis. Grep de 'allergies|medications' no arquivo mostra que esses campos só aparecem na chave de cache (250) e no objeto persistido (289-290), nunca na geração. Ainda assim as linhas 142-148 indicam nominalmente alginato, hidrocolóide, PHMB/Prontosan e AGE/Dersani. É o caminho que roda sempre que a IA falha ou não está configurada (cenário padrão hoje).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0127 · ALTO · `CONFIRMAR-SCHEMA`

**Enfermeiro recebe a visão de paciente do protocolo e fica sem tela quando não há paciente ativo**

**Onde:** `src/components/ProtocolGuide.jsx:188`

**O defeito:** Dentro do componente, isClinician = currentUser?.role === 'doctor', excluindo 'nurse'. Mas App.jsx trata enfermeiro como clínico: isClinician = role === 'doctor' || role === 'nurse' e passa clinicalProfile={targetProfile} = selectedPatientForDoctor (App.jsx:737-738). Consequências para role 'nurse': (a) recebe o texto de autocuidado leigo em vez das condutas clínicas; (b) recebe as seções de compra destinadas ao paciente (linhas 817 e 858); (c) o guard 'Nenhum Paciente Ativo' (linha 582) não dispara, então com selectedPatientForDoctor null o efeito retorna cedo e a tela mostra a mensagem de falha.

**Como falha:** Enfermeiro faz login e clica em 'Guias e Protocolos' sem ter selecionado um paciente: em vez do card 'Nenhum Paciente Ativo' com o botão de voltar à lista, ele vê 'Não foi possível gerar um guia de protocolo personalizado no momento.' e não tem como sair dali. Com um paciente selecionado, ele recebe o guia leigo ('Como Cuidar da Parte Preta (Casca Seca)') e botões 'Comprar Indicação do Médico'.

**Código atual:**

```jsx
const isClinician = currentUser?.role === 'doctor';
```

**Correção sugerida:** Alinhar a definição interna para isClinician = role === 'doctor' || role === 'nurse'.

<details><summary>Verificação feita contra o código</summary>

Linha 188: isClinician = currentUser?.role === 'doctor'. Em App.jsx:737-738 e 876-883, isClinician inclui 'nurse' e o componente recebe clinicalProfile={targetProfile} = selectedPatientForDoctor. Para 'nurse': o guard 'Nenhum Paciente Ativo' (linha 582, condicionado a isClinician interno) não dispara, então com selectedPatientForDoctor null o efeito retorna cedo (linha 240) e a tela cai na mensagem de falha da linha 1031; com paciente selecionado, ele recebe o texto leigo e as seções de compra (linhas 858+).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0128 · ALTO · `CONFIRMADO`

**Redirecionamento automático por window.open após 3s é bloqueado por popup blocker e usa link '#'**

**Onde:** `src/components/ProtocolGuide.jsx:231`

**O defeito:** O window.open é disparado dentro de um setTimeout encadeado, ~3 segundos depois do clique, ou seja fora da ativação do usuário — navegadores (Chrome/Safari/WebView do Capacitor) bloqueiam esse popup. Na mesma execução o modal é fechado (setBookingModal isOpen:false), removendo também o link manual 'Ir para o Site Agora'. Além disso affiliateLink cai em '#' quando o parceiro não tem affiliate_link (linha 215), e window.open('#','_blank') abre uma nova aba do próprio app. Por fim, o open não passa 'noopener', deixando window.opener acessível ao site parceiro (o <a> da linha 1173 usa rel corretamente, mas este caminho não).

**Como falha:** Paciente clica em 'Comprar Indicação do Dr(a). X', assiste ao contador 3-2-1, o modal fecha e nada abre (popup bloqueado). Ele não tem mais o botão manual e precisa refazer todo o fluxo. Se o parceiro foi cadastrado sem link, abre-se uma segunda aba do próprio iRec.

**Código atual:**

```jsx
} else if (bookingModal.isOpen && bookingModal.countdown === 0) {
      window.open(bookingModal.affiliateLink, '_blank');
      setBookingModal(prev => ({ ...prev, isOpen: false }));
    }
```

**Correção sugerida:** Abrir o link apenas no clique do usuário (com window.open(url, '_blank', 'noopener')), manter o modal aberto e não usar '#' como fallback.

<details><summary>Verificação feita contra o código</summary>

Linhas 221-235: o window.open ocorre dentro de um efeito disparado por uma cadeia de setTimeout de 1s, ~3s após o clique, fora da ativação transitória do usuário — bloqueado por Chrome/Safari/WebView. Na mesma execução o modal é fechado (linha 232), removendo o <a> manual 'Ir para o Site Agora' (linhas 1173-1190). Confirmei também affiliateLink: partner.affiliate_link || '#' (linha 215) e a ausência de 'noopener' no window.open.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0129 · ALTO · `CONFIRMADO`

**Protocolo clínico com nome do paciente fica em cache no localStorage e nunca é apagado no logout**

**Onde:** `src/components/ProtocolGuide.jsx:294`

**O defeito:** O protocolo completo (título com nome do paciente, descrição clínica, condutas, comorbidades) é serializado com uma cópia do perfil (name, hasDiabetes, medications, allergies, otherConditions...) na chave irec_cached_protocol_<profileId>_<entryId>. Confirmei por Grep que essa chave só é escrita/lida em ProtocolGuide.jsx e App.jsx e que handleLogout (App.jsx:652-667) não a remove; não há expiração nem limite de quantidade.

**Como falha:** Médico consulta os protocolos de 20 pacientes num computador compartilhado da unidade e faz logout. Todos os 20 registros continuam legíveis em texto claro no localStorage do navegador (nome, diabetes, medicamentos em uso, alergias) para qualquer pessoa com acesso ao dispositivo ou a um script na mesma origem.

**Código atual:**

```jsx
localStorage.setItem(cacheKey, JSON.stringify(cacheData));
```

**Correção sugerida:** Remover todas as chaves com prefixo 'irec_cached_protocol_' no handleLogout e adicionar TTL ao cache.

<details><summary>Verificação feita contra o código</summary>

Linhas 244 e 278-294: a chave irec_cached_protocol_<profileId>_<entryId> guarda o protocolo completo mais uma cópia do perfil com name, medications, allergies, otherConditions e comorbidades. Li handleLogout (App.jsx:652-668) e essa chave não é removida; não há expiração nem limite de entradas.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0130 · ALTO · `CONFIRMADO`

**'Código de Autenticidade' e QR Code do laudo não validam nada (URL ?validar= não é tratada em nenhum lugar)**

**Onde:** `src/components/ReportPDFGenerator.jsx:9`

**O defeito:** O docId é gerado com Math.random(), nunca é persistido em banco, e o QR aponta para https://i-rec-medical.vercel.app/?validar=<docId>. Confirmei por Grep que nenhum arquivo do projeto lê o parâmetro de query 'validar' (App.jsx só interpreta window.location.hash). Ainda assim o documento exibe '🛡️ LAUDO AUTENTICADO iREC' e 'Código de Autenticidade'. O laudo também não identifica nenhum profissional emissor — é autoemitido pelo paciente e se apresenta como autenticado.

**Como falha:** Terceiro escaneia o QR do laudo para conferir autenticidade e cai na home do app, que ignora o parâmetro e abre o login normal. Qualquer laudo, inclusive um com dados fabricados ou editado no navegador, aparenta ser 'autenticado'; dois laudos diferentes nunca podem ser distinguidos ou verificados.

**Código atual:**

```jsx
const docId = 'EVOL-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  ...
  const qrValidationUrl = `https://i-rec-medical.vercel.app/?validar=${docId}`;
```

**Correção sugerida:** Remover os selos de autenticação/QR enquanto não existir persistência do docId e uma rota real de verificação server-side.

<details><summary>Verificação feita contra o código</summary>

Linha 9 gera docId com Math.random(), linha 16 monta a URL ?validar=<docId>. Grep em src/ mostra que 'validar' só aparece nessa string e na equivalente de PrescriptionGeneratorModal.jsx:52 — nenhum código lê query string (App.jsx:37-43 só interpreta window.location.hash). O docId não é persistido em lugar nenhum, e mesmo assim o documento estampa '🛡️ LAUDO AUTENTICADO iREC' e 'Código de Autenticidade' (linhas 195-202), sem identificar profissional emissor.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0131 · ALTO · `CONFIRMAR-SCHEMA`

**window.print() no laudo imprime todo o app e corta o conteúdo que está fora da área de scroll**

**Onde:** `src/components/ReportPDFGenerator.jsx:47`

**O defeito:** handlePrint chama window.print() sem isolar #printable-report. O CSS de impressão global (src/index.css:837-889) só esconde .sidebar, .bottom-nav, .mobile-header, .btn, .badge, .no-print, select e input[type=range] — nenhuma dessas classes é usada aqui (os botões usam estilo inline, sem class 'btn'), e não há regra alguma para #printable-report. Além disso o container tem maxHeight '92vh' com overflowY 'auto' dentro de um overlay position:fixed, o que faz o navegador imprimir apenas a parte visível.

**Como falha:** Paciente clica em 'IMPRIMIR / GERAR PDF'. O PDF sai com o cabeçalho escuro do modal (texto branco #ffffff sobre fundo #1e293b, invisível no papel quando o navegador não imprime cor de fundo), com os botões 'IMPRIMIR / GERAR PDF' e 'FECHAR' dentro do documento, com o conteúdo da tela por baixo do overlay, e a tabela de histórico truncada se tiver mais registros do que cabem em 92vh.

**Código atual:**

```jsx
const handlePrint = () => {
    triggerVibration();
    speakNaturalText("Gerando relatório evolutivo impresso em PDF.");
    window.print();
  };
```

**Correção sugerida:** Adicionar um bloco @media print que esconda tudo exceto #printable-report e neutralize maxHeight/overflow do container.

<details><summary>Verificação feita contra o código</summary>

handlePrint (linhas 44-48) chama window.print() sem isolar #printable-report. Confirmei em index.css:837-889 que o @media print global só oculta .sidebar, .bottom-nav, .mobile-header, .btn, .badge, .no-print, select e input[type=range] — os botões deste modal usam estilo inline sem classe .btn — e não há nenhuma regra para #printable-report (grep confirma que o id só existe no JSX). O container tem maxHeight '92vh' + overflowY 'auto' (linhas 69-70) dentro de overlay fixed. Agravante não citado: se o usuário estiver na aba Documentos, o <style> de PatientDocuments.jsx:90-110 aplica 'body * { visibility: hidden }' globalmente e só torna visível .print-document-layout — o laudo sairia em branco.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0132 · ALTO · `CONFIRMAR-SCHEMA`

**Tabela do laudo mostra tipo de lesão fixo 'Lesão com Eritema' porque o campo entry.tissue_type não existe**

**Onde:** `src/components/ReportPDFGenerator.jsx:169`

**O defeito:** A coluna 'Tipo de Lesão' lê entry.tissue_type. O mapeamento de getWoundEntries (supabaseService.js:870) expõe o campo como 'type' (e a composição tecidual em 'aiTissueAnalysis'), não 'tissue_type'. Logo o valor é sempre undefined e o fallback hardcoded 'Lesão com Eritema' é impresso em todas as linhas.

**Como falha:** Paciente com 'Pé Diabético' registrado na triagem gera o laudo: todas as linhas da tabela de histórico dizem 'Lesão com Eritema', substituindo o diagnóstico real por um texto inventado no documento que será entregue ao médico.

**Código atual:**

```jsx
<td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.tissue_type || 'Lesão com Eritema'}</td>
```

**Correção sugerida:** Trocar por {entry.type || '—'} (ou entry.lesionStage), sem literal clínico como fallback.

<details><summary>Verificação feita contra o código</summary>

Linha 169 lê entry.tissue_type. O mapeamento de getWoundEntries (supabaseService.js:870) expõe 'type' (e 'aiTissueAnalysis'), nunca 'tissue_type'. O valor é sempre undefined e o literal 'Lesão com Eritema' é impresso em todas as linhas da tabela, substituindo o diagnóstico real.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0133 · ALTO · `CONFIRMAR-SCHEMA`

**Nível de dor no laudo é sempre 3/10 (campo errado + falsy bug com dor zero)**

**Onde:** `src/components/ReportPDFGenerator.jsx:170`

**O defeito:** A coluna de dor lê entry.pain_level, mas o campo real é 'pain' (supabaseService.js:874; coluna 'pain integer NOT NULL' em clean_database_v3.sql:50). Como pain_level é sempre undefined, o fallback 3 é impresso em todas as linhas. Além disso, mesmo se o campo fosse corrigido, o operador || transformaria dor legítima 0 (sem dor) em 3.

**Como falha:** Paciente que registrou dor 9/10 em todas as triagens imprime o laudo e o documento afirma '3/10' em todas as linhas. O médico que recebe o laudo subestima a dor e não ajusta a analgesia.

**Código atual:**

```jsx
<td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.pain_level || 3}/10</td>
```

**Correção sugerida:** Usar {entry.pain ?? '—'}/10, trocando || por ?? para preservar o valor zero.

<details><summary>Verificação feita contra o código</summary>

Linha 170 lê entry.pain_level; o mapeamento real é 'pain' (supabaseService.js:874). pain_level é sempre undefined, então todo registro imprime '3/10'. O uso de || também converteria uma dor legítima 0 em 3 mesmo após corrigir o nome do campo.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0134 · ALTO · `CONFIRMAR-SCHEMA`

**Coluna 'Aspecto do Tecido' do laudo imprime texto clínico inventado para todos os registros**

**Onde:** `src/components/ReportPDFGenerator.jsx:171`

**O defeito:** A coluna lê entry.notes, campo que não existe em wound_entries nem no mapeamento de getWoundEntries (os campos reais são doctorNotes, clinicalEvolution e aiRecommendation). O resultado é que toda linha do laudo afirma 'Em processo de epitelização e cicatrização.', uma avaliação clínica fabricada, inclusive para lesões com necrose ou infecção.

**Como falha:** Paciente com necrose de 60% e sinais flogísticos registrados pelo enfermeiro gera o laudo: a tabela afirma, em todas as linhas, 'Em processo de epitelização e cicatrização.', contradizendo o prontuário real.

**Código atual:**

```jsx
<td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{entry.notes || 'Em processo de epitelização e cicatrização.'}</td>
```

**Correção sugerida:** Usar {entry.doctorNotes || entry.clinicalEvolution || '—'} e nunca um texto clínico como valor padrão.

<details><summary>Verificação feita contra o código</summary>

Linha 171 lê entry.notes, campo ausente do mapeamento de getWoundEntries (os reais são doctorNotes, clinicalEvolution, aiRecommendation). O fallback 'Em processo de epitelização e cicatrização.' é impresso em toda linha, inclusive para lesões com necrose ou infecção — avaliação clínica fabricada dentro de um laudo.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0333 · MÉDIO · `CONFIRMADO`

**CPF do paciente é coletado e persistido, mas nunca aparece no documento oficial**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:60`

**O defeito:** docData.patientCpf é montado (com fallback 'xxx.xxx.xxx-xx') e vai para o objeto salvo no localStorage por PrescriptionPage, porém nenhuma parte do documento imprimível renderiza patientCpf — a linha de identificação (linha 364) mostra apenas nome, data, emissor e registro. Resultado: o dado sensível é armazenado sem finalidade e o documento oficial sai sem identificação inequívoca do paciente.

**Como falha:** Duas pacientes homônimas ('Maria Silva') recebem receitas: os dois documentos impressos são indistinguíveis, pois o CPF nunca é impresso. Ao mesmo tempo, o CPF de ambas fica gravado em texto claro na chave irec_prescription_history do localStorage do dispositivo.

**Código atual:**

```jsx
patientCpf: patientProfile?.cpf || 'xxx.xxx.xxx-xx',
```

**Correção sugerida:** Ou imprimir o CPF na linha de identificação do paciente, ou parar de incluí-lo no docData persistido.

<details><summary>Verificação feita contra o código</summary>

Linha 60 monta patientCpf com fallback 'xxx.xxx.xxx-xx' e o campo vai para docData salvo em localStorage por PrescriptionPage.jsx:15-19. Li todo o #printable-document (linhas 335-442): a linha de identificação (364-365) mostra apenas nome, data, emissor e registro — patientCpf nunca é renderizado. Dado sensível armazenado sem finalidade e documento sem identificação inequívoca.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0334 · MÉDIO · `CONFIRMADO`

**Emissão de documento sem nenhuma validação: receita vazia, atestado sem dias e encaminhamento em branco**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:65`

**O defeito:** handleGenerate não valida nada antes de emitir. Para 'receita', medications é filtrado por nome não vazio — se todos estiverem vazios, o array fica vazio e o documento é emitido com a seção 'PRESCRIÇÃO E MEDICAMENTOS:' e uma <ol> sem itens. Para 'encaminhamento', referralNotes inicia como string vazia e nada impede emitir um parecer em branco. Nenhum campo é obrigatório e não há mensagem de erro.

**Como falha:** Profissional clica direto em 'EMITIR DOCUMENTO COM VALIDAÇÃO QR CODE' sem digitar nada. A tela muda para 'Documento Oficial Emitido', a voz anuncia sucesso, o documento é registrado no histórico do localStorage e pode ser impresso: uma receita oficial com o título de prescrição e nenhum medicamento.

**Código atual:**

```jsx
medications: documentType === 'receita' ? medications.filter(m => m.name.trim() !== '') : [],
```

**Correção sugerida:** Validar em handleGenerate que receita tem ao menos um medicamento nomeado, atestado tem dias válidos e encaminhamento tem parecer, bloqueando a emissão caso contrário.

<details><summary>Verificação feita contra o código</summary>

handleGenerate (linhas 42-80) não valida nada: medications é filtrado por nome não vazio (linha 65) e pode ficar vazio, gerando a seção 'PRESCRIÇÃO E MEDICAMENTOS:' com <ol> sem itens (linhas 372-382); referralNotes inicia como '' (linha 11) e é renderizado cru (linha 403). Nenhum campo é obrigatório e não existe mensagem de erro. Severidade rebaixada: o documento sai vazio/inútil, sem dado clínico falso.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0335 · MÉDIO · `CONFIRMADO`

**Modais não fecham com Esc, não têm role=dialog nem nome acessível no botão de fechar**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:116`

**O defeito:** O overlay (linhas 520-538) não declara role="dialog"/aria-modal, não prende o foco e não há listener de keydown para Escape. O botão de fechar contém apenas o caractere '×', sem aria-label ou texto — o mesmo padrão se repete em ReportPDFGenerator.jsx:94-99 e no modal de redirecionamento de ProtocolGuide.jsx:1069-1085. Como o overlay é position:fixed com zIndex 999999, o conteúdo atrás continua na ordem de tabulação mas visualmente bloqueado.

**Como falha:** Usuário de leitor de tela abre a emissão de documentos: o botão de fechar é anunciado apenas como 'botão' (ou 'sinal de multiplicação'), o leitor continua navegando pelo conteúdo por baixo do overlay e pressionar Esc não fecha nada — ele fica preso no modal sem saber como sair.

**Código atual:**

```jsx
<button
            onClick={() => { triggerVibration(); onClose(); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' }}
          >
            ×
          </button>
```

**Correção sugerida:** Adicionar role="dialog" aria-modal="true", aria-label="Fechar" no botão e um handler de keydown para Escape com foco preso no modal.

<details><summary>Verificação feita contra o código</summary>

O overlay (linhas 520-538) é uma div com estilos inline, sem role='dialog', aria-modal, foco preso ou listener de Escape; o botão de fechar (116-121) contém apenas '×' sem aria-label. O mesmo padrão aparece em ReportPDFGenerator.jsx:94-99. Verificado diretamente no código dos dois componentes.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0336 · MÉDIO · `CONFIRMADO`

**Atestado aceita zero, valor negativo e campo vazio de dias de afastamento**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:264`

**O defeito:** O input numérico de dias não tem min, max, nem validação no handleGenerate. O valor é usado cru no corpo do atestado (linha 392). Apagando o campo, certificateDays fica string vazia e o texto impresso fica 'necessita de  dia(s) de afastamento'; digitando -5, o atestado afirma '-5 dia(s)'.

**Como falha:** Profissional apaga o conteúdo do campo 'DIAS DE AFASTAMENTO' antes de emitir. O atestado impresso diz: 'Atesto ... que o(a) paciente João necessita de  dia(s) de afastamento de suas atividades', documento inválido entregue ao empregador.

**Código atual:**

```jsx
<input
                    type="number"
                    value={certificateDays}
                    onChange={(e) => setCertificateDays(e.target.value)}
```

**Correção sugerida:** Adicionar min="1" max="90" e recusar a emissão quando Number(certificateDays) não for inteiro positivo.

<details><summary>Verificação feita contra o código</summary>

Linhas 262-267: input type=number sem min/max e sem validação em handleGenerate; certificateDays é usado cru no corpo do atestado (linha 392, 'necessita de <strong>{...} dia(s)</strong>'). Apagando o campo o texto sai com lacuna; digitando -5 o atestado afirma '-5 dia(s)'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0337 · MÉDIO · `CONFIRMADO`

**Clique em item do histórico de documentos não faz nada (activeDoc nunca é renderizado)**

**Onde:** `src/components/PrescriptionPage.jsx:127`

**O defeito:** Cada card do histórico tem cursor:'pointer' e onClick={() => setActiveDoc(doc)}, mas o state activeDoc (declarado na linha 13) não é usado em nenhum ponto do JSX — não existe modal, painel ou reimpressão que o consuma. O card também é uma div clicável sem role="button", tabIndex ou handler de teclado.

**Como falha:** Profissional precisa reimprimir uma receita emitida ontem, vê o card no 'Histórico Emitido' com o cursor de mão e clica: absolutamente nada acontece na tela, sem mensagem nem navegação. Não há nenhuma forma de reabrir/reimprimir um documento já emitido. Usuário de teclado não consegue nem focar o card.

**Código atual:**

```jsx
onClick={() => setActiveDoc(doc)}
```

**Correção sugerida:** Renderizar um modal de visualização/reimpressão a partir de activeDoc e tornar o card focável (role="button" + tabIndex + onKeyDown).

<details><summary>Verificação feita contra o código</summary>

Grep de 'activeDoc' no arquivo retorna apenas a linha 13 (declaração) — o setter é chamado na linha 127 mas o valor nunca é consumido no JSX. O card (linhas 114-141) é uma div com cursor:'pointer' e onClick, sem role="button", tabIndex ou handler de teclado. Não existe caminho de reimpressão.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0338 · MÉDIO · `CONFIRMADO`

**Numeração dos passos do guia do paciente se repete e conflita com o contador exibido**

**Onde:** `src/components/ProtocolGuide.jsx:135`

**O defeito:** Os títulos dos passos do guia leigo trazem o número embutido de forma fixa ('1. ', '2. ', '3. ', '4. '), mas os blocos são empilhados condicionalmente: diabetes acrescenta '3.' e '4.' (linhas 117 e 121), insuficiência venosa acrescenta outro '3.' (linha 128) e hipertensão acrescenta um terceiro '3.' (linha 135). Ao mesmo tempo, o card renderiza o índice real no círculo e em 'Passo {idx + 1}' (linhas 765 e 779).

**Como falha:** Paciente com diabetes, insuficiência venosa e hipertensão abre o guia. A sequência de títulos é 1, 2, 3, 4, 3, 3, enquanto os círculos mostram 1 a 6 — o card 6 exibe o círculo '6' e 'Passo 6' com o título '3. Controle o Sal e Meça a Pressão'. O idoso que segue os passos numerados fica sem saber qual é o terceiro passo.

**Código atual:**

```jsx
if (profile.hasHypertension) {
    steps.push({
      title: '3. Controle o Sal e Meça a Pressão',
```

**Correção sugerida:** Remover os números embutidos nos títulos e deixar a numeração apenas para o índice do map.

<details><summary>Verificação feita contra o código</summary>

Os títulos trazem numeração fixa: '1.' (90), '2.' (100/105/110), '3.' e '4.' no bloco de diabetes (117/121), outro '3.' em insuficiência venosa (128) e um terceiro '3.' em hipertensão (135). Ao mesmo tempo o card renderiza {idx + 1} no círculo (linha 765) e 'Passo {idx + 1}' (linha 779). Com diabetes + insuficiência venosa + hipertensão a sequência de títulos é 1,2,3,4,3,3 contra círculos 1..6.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0339 · MÉDIO · `CONFIRMADO`

**Preços e marcas de insumos são hardcoded e apresentados como referência real de compra**

**Onde:** `src/components/ProtocolGuide.jsx:142`

**O defeito:** O protocolo local injeta valores fixos ('R$ 42,90', 'R$ 28,50', 'R$ 18,90', 'R$ 62,00', 'R$ 38,90') e marcas específicas (Curatec, DuoDerm, Prontosan, Dersani). Esses valores são renderizados na seção 'Insumos Sugeridos pelo Protocolo Clínico' e reaproveitados no modal de redirecionamento como 'Preço Referência' (linha 1136), sem nenhuma data de referência, fonte ou aviso de que são estimativas estáticas.

**Como falha:** Paciente idoso vê 'Hidrogel Amorfo com Alginato (85g) — R$ 42,90 — Curatec' no guia, vai à farmácia com esse orçamento e encontra o produto por valor muito diferente. O preço nunca é atualizado, pois é literal no código-fonte.

**Código atual:**

```jsx
materials.push({ name: 'Hidrogel Amorfo com Alginato (85g)', price: 'R$ 42,90', brand: 'Curatec' });
    materials.push({ name: 'Placa de Alginato de Cálcio (10x10cm)', price: 'R$ 28,50', brand: 'Curatec' });
```

**Correção sugerida:** Remover price/brand fixos do fallback (ou exibir 'Consulte o preço na farmácia'), deixando preço apenas para insumos vindos do banco de parceiros.

<details><summary>Verificação feita contra o código</summary>

Linhas 142-148 injetam literais 'R$ 42,90', 'R$ 28,50', 'R$ 18,90', 'R$ 62,00', 'R$ 38,90' com marcas Curatec, DuoDerm, Prontosan e Dersani. Esses valores são renderizados na seção de insumos e reaproveitados no modal como 'Preço Referência' (linha 1136), sem data, fonte ou aviso de estimativa. Severidade rebaixada: o dano é econômico/informativo, não clínico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0340 · MÉDIO · `VERIFICAR`

**formatMaterialsForView assume que price e brand são strings e quebra com JSON numérico da IA**

**Onde:** `src/components/ProtocolGuide.jsx:169`

**O defeito:** A função chama item.price.includes(...) e item.brand.includes(...) diretamente sobre valores vindos da resposta do Gemini, que não passa por nenhuma validação de tipo (geminiService.js:700-702 retorna JSON.parse cru). Se o modelo devolver "price": 42.90 (número) em vez da string pedida no prompt, .includes não existe e o render lança TypeError, sem ErrorBoundary para conter.

**Como falha:** Médico abre Protocolos de um paciente; o Gemini responde com price numérico. Na renderização de 'Terapêuticas e Coberturas Sugeridas', ocorre 'item.price.includes is not a function' e a aplicação inteira fica em tela branca, obrigando reload.

**Código atual:**

```jsx
const isPriceAlreadyClinical = item.price && (item.price.includes('Troca') || item.price.includes('Uso') || item.price.includes('Aplicar'));
```

**Correção sugerida:** Converter com String(item.price ?? '') e String(item.brand ?? '') antes de chamar includes.

<details><summary>Verificação feita contra o código</summary>

Linhas 169-170 chamam item.price.includes(...) e item.brand.includes(...) protegidas apenas por checagem de truthiness, sem checagem de tipo; um number truthy passa e .includes não existe, lançando TypeError sem ErrorBoundary (confirmado inexistente). A ocorrência depende de o Gemini devolver price/brand numéricos, o que não pude verificar em runtime.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0341 · MÉDIO · `CONFIRMADO`

**Heurística de palavras-chave descarta a indicação clínica e a frequência de troca geradas pela IA**

**Onde:** `src/components/ProtocolGuide.jsx:174`

**O defeito:** Para o clínico, formatMaterialsForView substitui brand e price por textos genéricos sempre que não encontrar as substrings 'Indicação'/'Mecanismo'/'ferida'/'Ferida' (em brand) ou 'Troca'/'Uso'/'Aplicar' (em price). Conteúdo clínico legítimo que não contém essas palavras é apagado.

**Como falha:** O Gemini devolve brand: 'Promove desbridamento autolítico e mantém umidade' e price: 'Reavaliar a cada 72 horas'. Nenhuma das palavras-chave bate, então o médico vê 'Indicação: Cobertura recomendada para o manejo da lesão.' e 'Uso Tópico • Conforme evolução' — perdendo exatamente o mecanismo de ação e o intervalo de troca que precisava para prescrever.

**Código atual:**

```jsx
brand: isBrandAlreadyClinical ? item.brand : `Cobertura recomendada para o manejo da lesão.`,
      price: isPriceAlreadyClinical ? item.price : `Uso Tópico • Conforme evolução`
```

**Correção sugerida:** Só aplicar o texto genérico quando o campo estiver vazio, preservando qualquer conteúdo retornado pela IA.

<details><summary>Verificação feita contra o código</summary>

Linhas 168-177: para isClinician, brand e price são substituídos pelos textos genéricos 'Cobertura recomendada para o manejo da lesão.' e 'Uso Tópico • Conforme evolução' sempre que não contiverem as substrings 'Indicação'/'Mecanismo'/'ferida'/'Ferida' ou 'Troca'/'Uso'/'Aplicar'. Conteúdo clínico legítimo sem essas palavras é descartado, exatamente como descrito.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0342 · MÉDIO · `CONFIRMADO`

**Estado 'loading' nunca é ativado: skeleton é código morto e o usuário vê mensagem de erro durante o carregamento**

**Onde:** `src/components/ProtocolGuide.jsx:268`

**O defeito:** loading é inicializado como false (linha 182) e as duas únicas atribuições são setLoading(false) (linhas 258 e 268). setLoading(true) não existe em nenhum ponto do arquivo, portanto o bloco de skeleton 'Gerando Seu Guia de Cuidados Personalizado...' (linhas 668-684) é inalcançável. Como o efeito retorna cedo quando clinicalProfile é falsy (linha 240) e aiProtocol continua null, o ramo final renderizado é a mensagem de falha.

**Como falha:** Paciente faz login e vai direto para 'Guias e Protocolos'. Como clinicalProfile só é carregado depois de getClinicalProfile (App.jsx:554), a tela exibe 'Não foi possível gerar um guia de protocolo personalizado no momento.' em vez de um carregando. Se o perfil clínico não existir (ou for um enfermeiro sem paciente ativo), essa mensagem de erro permanece para sempre.

**Código atual:**

```jsx
const fallbackProtocol = generateDefaultPersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician);
      setAiProtocol(fallbackProtocol);
      setLoading(false); // Set loading to false so no blocker is displayed!
```

**Correção sugerida:** Chamar setLoading(true) no início de fetchProtocol e exibir o skeleton enquanto clinicalProfile ainda não chegou, em vez da mensagem de falha.

<details><summary>Verificação feita contra o código</summary>

Grep de setLoading no arquivo retorna apenas useState(false) na linha 182 e duas chamadas setLoading(false) (257 e 268) — setLoading(true) não existe. Logo o bloco de skeleton (linhas 668-684) é inalcançável. O efeito retorna cedo quando clinicalProfile é falsy (linha 240), aiProtocol continua null e cai no ramo final com a mensagem 'Não foi possível gerar um guia de protocolo personalizado no momento.' (linha 1031), que confirmei existir.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0343 · MÉDIO · `VERIFICAR`

**Efeito de geração do protocolo não é cancelado: troca de paciente pode exibir o guia clínico do paciente anterior**

**Onde:** `src/components/ProtocolGuide.jsx:272`

**O defeito:** fetchProtocol faz await generatePersonalizedProtocol(...) e depois setAiProtocol(result) sem flag de cancelamento nem AbortController, e o useEffect (linhas 238-302) não retorna cleanup. Como o efeito depende de clinicalProfile e latestWoundEntry, a troca de paciente dispara uma segunda chamada enquanto a primeira está em voo; se a resposta antiga chegar depois, ela sobrescreve o state. O mesmo caminho também grava no localStorage a chave do paciente correto, mas exibe o conteúdo errado na tela.

**Como falha:** Médico abre Protocolos com o paciente A selecionado, volta à lista e seleciona o paciente B, permanecendo na aba de Protocolos. A resposta lenta do Gemini referente ao paciente A chega depois: a tela passa a mostrar 'Condutas Clínicas de Apoio à Decisão para: <paciente A>' enquanto a ficha clínica ativa no topo indica o paciente B. Conduta cruzada entre prontuários.

**Código atual:**

```jsx
const result = await generatePersonalizedProtocol(clinicalProfile, latestWoundEntry, isClinician);
        
        if (result) {
          setAiProtocol(result);
```

**Correção sugerida:** Adicionar `let cancelled = false` com `return () => { cancelled = true }` no efeito e ignorar o resultado quando cancelled.

<details><summary>Verificação feita contra o código</summary>

O código é como descrito: o useEffect (238-302) não retorna cleanup e setAiProtocol(result) na linha 275 roda sem flag de cancelamento nem AbortController. A ausência de proteção contra respostas obsoletas é fato. O que não consegui confirmar é a alcançabilidade do cenário de paciente cruzado: trocar de paciente normalmente passa pelo case 'doctor-dashboard' do App, o que desmonta ProtocolGuide (não há key, mas há troca de case), e a resposta antiga então cai numa instância desmontada. A corrida só exibe conteúdo cruzado se clinicalProfile mudar com o componente montado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0344 · MÉDIO · `VERIFICAR`

**Insumo sem nome derruba a tela inteira em itemName.toLowerCase()**

**Onde:** `src/components/ProtocolGuide.jsx:325`

**O defeito:** getAvailablePartnersForMaterial chama itemName.toLowerCase() sem guarda. Ela é invocada durante a renderização por renderCheckoutButtons(item) (linha 504) para cada material do protocolo, e o material pode vir do JSON do Gemini, que não é validado em nenhum ponto (geminiService.js:702 faz JSON.parse e devolve direto). Se um item vier sem 'name' (ou com null), o render lança TypeError. getStripeInfo(item.name) tem default só para undefined, então name: null também quebra na linha 365. Não existe ErrorBoundary no projeto (confirmado por Grep), logo a falha derruba todo o App.

**Como falha:** O Gemini responde com um material sem a chave 'name' (ou com null). Ao renderizar 'Insumos Sugeridos pelo Protocolo Clínico', o app lança 'Cannot read properties of undefined (reading toLowerCase)' e o paciente fica com a tela em branco — não só a aba de Protocolos, mas toda a aplicação.

**Código atual:**

```jsx
if (!m.name || m.name.toLowerCase() !== itemName.toLowerCase()) return false;
```

**Correção sugerida:** Normalizar com `const safeName = String(itemName ?? '')` no topo de getAvailablePartnersForMaterial/getStripeInfo e validar o JSON do Gemini antes de renderizar.

<details><summary>Verificação feita contra o código</summary>

Confirmei que não existe ErrorBoundary no projeto (grep sem resultados) e que getStripeInfo(item.name) na linha 908 quebra com name === null (o default `name = ''` da linha 364 só cobre undefined). Já a linha 325 tem uma guarda parcial não citada: `if (!m.name || m.name.toLowerCase() !== itemName.toLowerCase())` só avalia itemName.toLowerCase() quando existe um material do banco com type 'doctor_partner' e nome preenchido — com dbRecommendedMaterials vazio o callback nem roda. Portanto o crash é real mas depende de resposta não validada do Gemini (name null) ou da presença de parceiros cadastrados.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0345 · MÉDIO · `CONFIRMADO`

**Classificação de tarja/necessidade de prescrição é inventada por substring do nome do produto**

**Onde:** `src/components/ProtocolGuide.jsx:400`

**O defeito:** getStripeInfo decide a classificação regulatória apenas por palavras no nome do produto e, no ramo final, assume 'Tarja Vermelha - Vendido somente sob prescrição médica' para tudo que não casou. Coberturas e correlatos (alginato de cálcio, hidrocolóide, espuma de poliuretano) caem nesse default, e qualquer nome que contenha 'comprimido/cápsula/oral' é rotulado como 'Tarja Vermelha (Retenção)' com 'retenção obrigatória'. Esses selos são renderizados como faixa vermelha e alerta ao paciente (linhas 408-501).

**Como falha:** Paciente vê o card 'Placa de Alginato de Cálcio (10x10cm)' com faixa vermelha 'TARJA VERMELHA' e o alerta '📄 Vendido somente sob prescrição médica'. Ele deixa de comprar o curativo (que é correlato de venda livre) esperando conseguir uma receita, atrasando o tratamento. O inverso também ocorre: produtos com 'óleo' ou 'soro' no nome recebem selo verde 'MIP' automaticamente.

**Código atual:**

```jsx
// Default to Tarja Vermelha for dermatological treatments
    return {
      stripeColor: 'red',
      stripeLabel: 'Tarja Vermelha',
      requiresPrescription: true,
      alertText: 'Vendido somente sob prescrição médica.'
    };
```

**Correção sugerida:** Trazer a classificação de tarja de um campo do cadastro do produto e, na ausência dele, não exibir selo algum.

<details><summary>Verificação feita contra o código</summary>

Li getStripeInfo inteira (364-406): a decisão regulatória vem só de substrings do nome; qualquer coisa que não case cai no default 'Tarja Vermelha - Vendido somente sob prescrição médica' (399-405), o que inclui alginato, hidrocolóide e espuma de poliuretano, que são correlatos. O inverso também ocorre ('óleo', 'soro' → selo verde MIP). Esses selos são renderizados como faixa vermelha (renderMedicineStripe, 408-478) e alerta ao paciente (renderPrescriptionAlert, 480-501).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0346 · MÉDIO · `CONFIRMADO`

**Selo de transparência afirma diretriz oficial justamente quando o protocolo é o fallback estático**

**Onde:** `src/components/ProtocolGuide.jsx:719`

**O defeito:** O bloco comentado como 'Transparency Disclaimer Box' inverte o propósito: quando aiProtocol.isLocalFallback é true (protocolo gerado localmente, sem IA, ignorando alergias e medicamentos), a mensagem exibida é 'Diretriz Clínica Integrada: Gerado com base nas diretrizes oficiais do Ministério da Saúde e COFEN'. Não há qualquer indicação de que a personalização falhou ou de que o conteúdo é um template fixo.

**Como falha:** Sem chave do Gemini configurada (cenário padrão de contingência), todo paciente e todo médico veem o mesmo guia genérico rotulado como diretriz oficial do Ministério da Saúde e do COFEN, e tomam decisões terapêuticas confiando numa personalização que nunca ocorreu.

**Código atual:**

```jsx
{aiProtocol.isLocalFallback ? (
                    <>
                      <span>ℹ️</span>
                      <span><strong>Diretriz Clínica Integrada:</strong> Gerado com base nas diretrizes oficiais do Ministério da Saúde e COFEN.</span>
                    </>
```

**Correção sugerida:** Trocar o texto do ramo isLocalFallback para deixar explícito que é um guia genérico de contingência, sem personalização por IA.

<details><summary>Verificação feita contra o código</summary>

Linhas 716-726: com aiProtocol.isLocalFallback === true (protocolo gerado localmente, que ignora alergias e medicamentos e traz textos fixos) a mensagem exibida é 'Diretriz Clínica Integrada: Gerado com base nas diretrizes oficiais do Ministério da Saúde e COFEN', sem qualquer indicação de que a personalização por IA não ocorreu. O fallback é sempre setado na linha 267, e hoje (Gemini não configurado) é o caminho padrão.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0347 · MÉDIO · `CONFIRMAR-SCHEMA`

**Link de afiliado do parceiro é usado em href/window.open sem validação de esquema**

**Onde:** `src/components/ProtocolGuide.jsx:1174`

**O defeito:** bookingModal.affiliateLink vem cru da coluna affiliate_link, preenchida por texto livre em AdminPartners.jsx:51 e DoctorPartners.jsx:57/94, sem qualquer validação de protocolo (só checam se o campo está vazio). Esse valor é aplicado direto em href (linha 1174) e em window.open (linha 231). Um valor iniciado com 'javascript:' é executado no contexto de origem do app quando o paciente clica.

**Como falha:** Um médico credenciado (ou alguém com acesso ao cadastro de parceiros) salva como link de afiliado uma string 'javascript:fetch(...localStorage...)'. Todo paciente vinculado que clicar em 'Ir para o Site Agora' executa esse código na origem do iRec, com acesso ao localStorage, que contém sessão e dados clínicos em cache.

**Código atual:**

```jsx
<a
                href={bookingModal.affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
```

**Correção sugerida:** Validar no cadastro e antes do uso que o link começa com https:// (ou http://), rejeitando qualquer outro esquema.

<details><summary>Verificação feita contra o código</summary>

Confirmei que affiliate_link vem de texto livre e que AdminPartners.jsx só verifica se o campo está vazio (linha 37) antes de gravar (linha 51), e que o valor é aplicado direto em href (1174) e em window.open (231), sem sanitização. O que não consigo confirmar sem execução é a explorabilidade: React já bloqueia/avisa em URLs javascript: em href e navegadores modernos bloqueiam window.open para o esquema javascript:. Além disso o vetor exige um médico credenciado ou admin malicioso.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0348 · MÉDIO · `VERIFICAR`

**Piora da lesão é mascarada como 'Estável' no laudo**

**Onde:** `src/components/ReportPDFGenerator.jsx:30`

**O defeito:** Quando a área calculada aumenta (pct negativo) ou não muda (pct = 0), o código descarta o valor real e força healingPercentage = 0 com o rótulo 'Fase de Limpeza Tecidual / Desbridamento (Estável)'. Uma piora objetiva de 40% na área da lesão nunca é comunicada; o laudo apresenta a deterioração como uma fase esperada e estável do tratamento.

**Como falha:** Paciente diabético com ferida que dobrou de área entre a primeira e a última triagem gera o relatório para levar ao vascular. O laudo diz 'Fase de Limpeza Tecidual / Desbridamento (Estável)' e '0%', escondendo a piora e retardando o encaminhamento de urgência.

**Código atual:**

```jsx
if (pct > 0) {
        healingPercentage = pct;
        healingLabel = `${pct}% de Redução da Lesão`;
      } else {
        healingPercentage = 0;
        healingLabel = "Fase de Limpeza Tecidual / Desbridamento (Estável)";
      }
```

**Correção sugerida:** Quando pct <= 0, exibir o aumento real da lesão ('Aumento de X% na área — reavaliação clínica indicada') em vez de rotular como estável.

<details><summary>Verificação feita contra o código</summary>

O trecho existe exatamente como descrito (linhas 30-36): pct <= 0 vira healingPercentage=0 com rótulo 'Fase de Limpeza Tecidual / Desbridamento (Estável)', descartando a piora real. Porém o cenário descrito não é alcançável hoje: por causa do defeito 50002 os valores são sempre 10 e 4, pct é sempre 60 e o ramo else nunca executa. É um defeito latente que se manifesta assim que a leitura de área for corrigida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0528 · BAIXO · `CONFIRMADO`

**Mutação direta do state de medicamentos em handleMedicationChange**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:32`

**O defeito:** [...medications] faz cópia rasa: os objetos internos continuam sendo as mesmas referências do state. A atribuição updated[index][field] = value muta o objeto que está dentro do state atual antes do setState. Isso quebra comparações de referência, invalida qualquer memoização futura e, sob StrictMode (habilitado em src/main.jsx:19), a mutação acontece em objetos compartilhados entre renders.

**Como falha:** Ao digitar a dosagem de um medicamento, o objeto do state anterior já é alterado antes do setState. Se qualquer componente pai/filho passar a usar React.memo ou comparar prev/next (ou se houver batch de eventos), a linha editada não re-renderiza e o campo aparenta 'travar' com o valor antigo.

**Código atual:**

```jsx
const handleMedicationChange = (index, field, value) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };
```

**Correção sugerida:** Usar setMedications(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m)).

<details><summary>Verificação feita contra o código</summary>

Linhas 30-34: [...medications] é cópia rasa e updated[index][field] = value muta o objeto ainda referenciado pelo state atual. A mutação é real. Porém o cenário de 'campo travado' não ocorre hoje, pois setMedications recebe um array novo e o componente não usa React.memo nem comparação prev/next; é risco latente e má prática, não falha observável.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0529 · BAIXO · `CONFIRMADO`

**Nome do paciente é falado em voz alta pela síntese de voz ao emitir documento**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:75`

**O defeito:** Após gerar o documento, speakNaturalText é chamado com o nome do paciente interpolado. speakNaturalText (src/utils/speechUtils.js:19) executa window.speechSynthesis.speak sem qualquer verificação de preferência do usuário ou de contexto, sempre que o documento é emitido.

**Como falha:** Médico emite uma receita em consultório com a porta aberta ou em atendimento domiciliar: o dispositivo anuncia em voz alta 'Documento gerado com sucesso para Maria Aparecida da Silva', expondo o nome do paciente a terceiros presentes.

**Código atual:**

```jsx
speakNaturalText(`Documento gerado com sucesso para ${docData.patientName}. Você já pode imprimir ou salvar em PDF.`);
```

**Correção sugerida:** Falar apenas 'Documento gerado com sucesso', sem o nome, e respeitar uma preferência de áudio do usuário.

<details><summary>Verificação feita contra o código</summary>

Linha 75 interpola docData.patientName em speakNaturalText, chamada incondicionalmente em handleGenerate. Não há checagem de preferência do usuário nem de contexto no ponto de chamada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0530 · BAIXO · `CONFIRMADO`

**Lista de medicamentos usa key={idx} em lista mutável com remoção**

**Onde:** `src/components/PrescriptionGeneratorModal.jsx:216`

**O defeito:** A lista de medicamentos permite adicionar (linha 25) e remover por índice (linha 36-40), mas as linhas usam key={idx}. Ao remover um item do meio, o React reaproveita os nós pelo índice em vez de identidade, causando reconciliação incorreta de estado não controlado (foco, posição do cursor, seleção) nos inputs seguintes.

**Como falha:** Profissional cadastra 3 medicamentos, está com o cursor no campo 'Posologia' do item 3 e remove o item 2. O foco/cursor permanece na mesma posição do DOM, agora pertencente a outro medicamento, e a digitação seguinte vai para o item errado.

**Código atual:**

```jsx
{medications.map((med, idx) => (
                  <div key={idx} style={{ backgroundColor: '#0f172a', ... }}>
```

**Correção sugerida:** Gerar um id estável ao criar cada medicamento e usá-lo como key.

<details><summary>Verificação feita contra o código</summary>

Linha 215-216 mapeia com key={idx} enquanto handleAddMedication (25-28) e handleRemoveMedication (36-40) alteram a lista por índice. A reconciliação por índice de fato desalinha estado não controlado (foco, cursor) dos inputs seguintes ao item removido. Impacto real é pequeno porque os inputs são controlados.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0531 · BAIXO · `CONFIRMADO`

**Botão de fechar (×) do formulário embutido de prescrição é um no-op**

**Onde:** `src/components/PrescriptionPage.jsx:90`

**O defeito:** PrescriptionPage renderiza PrescriptionGeneratorModal com embeddedMode={true} e onClose={() => {}}. Em modo embutido o cabeçalho com o botão '×' continua sendo renderizado (PrescriptionGeneratorModal.jsx:116-121), mas o handler é uma função vazia.

**Como falha:** Usuário preenche parcialmente o formulário, decide desistir e clica no '×' no canto do cabeçalho 'Emissão de Receita & Atestado Digital'. O botão vibra o dispositivo e nada mais acontece — nem fecha, nem limpa, nem navega. O usuário conclui que a tela está travada.

**Código atual:**

```jsx
<PrescriptionGeneratorModal 
            currentUser={currentUser}
            patientProfile={patientTarget}
            onClose={() => {}}
```

**Correção sugerida:** Ocultar o botão de fechar quando embeddedMode for true, ou usar onClose={() => setActiveTab('dashboard')}.

<details><summary>Verificação feita contra o código</summary>

PrescriptionPage.jsx:87-93 passa embeddedMode={true} e onClose={() => {}}. Em PrescriptionGeneratorModal o cabeçalho com o botão '×' é parte do innerContent (linhas 103-122), retornado tal qual em embeddedMode (linhas 516-518), então o botão é exibido e só chama a função vazia. Impacto é apenas um controle morto visível.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0532 · BAIXO · `CONFIRMADO`

**Falhas de geração do protocolo são silenciadas: state 'error' declarado e nunca usado**

**Onde:** `src/components/ProtocolGuide.jsx:184`

**O defeito:** O par [error, setError] é declarado mas setError nunca é chamado e 'error' não é renderizado em nenhum lugar do JSX. Todos os pontos de falha (JSON de cache corrompido na linha 260, erro da API Gemini na linha 296, erro ao carregar insumos na linha 313) apenas fazem console.error. O usuário nunca é informado de que o guia exibido é o fallback estático porque a IA falhou.

**Como falha:** A chave do Gemini expira. O paciente continua vendo um guia com o selo verde/âmbar de 'Diretriz Clínica Integrada' e não tem nenhum indício de que a personalização por IA falhou; nem o profissional que orientou o uso do app percebe a degradação.

**Código atual:**

```jsx
const [error, setError] = useState('');
```

**Correção sugerida:** Remover o state não usado ou setar error nos catch e renderizar um aviso de que o guia exibido é o fallback local.

<details><summary>Verificação feita contra o código</summary>

Grep confirma que setError só aparece na declaração (linha 184); os pontos de falha (261, 297, 314) apenas fazem console.error e 'error' não é renderizado em nenhum ponto do JSX. Severidade rebaixada para baixo porque o dano comunicacional real (rotular o fallback como diretriz oficial) já está coberto pelo item 50043.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0533 · BAIXO · `VERIFICAR`

**Carregamento de insumos do banco sem cancelamento: setState após desmontar e mistura de pacientes**

**Onde:** `src/components/ProtocolGuide.jsx:308`

**O defeito:** O efeito de loadDbMaterials (linhas 304-319) aguarda getRecommendedMaterials e getAssignedDoctors e chama setDbRecommendedMaterials/setAssignedDoctors sem verificar se o componente ainda está montado e sem descartar respostas obsoletas; o useEffect não retorna cleanup. Como App.jsx re-cria clinicalProfile a cada polling de 30s (App.jsx:690-701), o efeito é re-disparado periodicamente, ampliando a janela de corrida.

**Como falha:** Médico entra em Protocolos do paciente A e imediatamente navega para outra aba: as promises resolvem depois e chamam setState em componente desmontado. Se ele voltar e trocar para o paciente B, a lista de 'Insumos Recomendados pelo seu Médico' pode ser preenchida com os itens vinculados ao paciente A.

**Código atual:**

```jsx
const data = await getRecommendedMaterials(clinicalProfile.id);
          setDbRecommendedMaterials(data);
          
          const docs = await getAssignedDoctors(clinicalProfile.id);
          setAssignedDoctors(docs || []);
```

**Correção sugerida:** Adicionar flag de cancelamento no efeito e descartar respostas cujo clinicalProfile.id não seja mais o atual.

<details><summary>Verificação feita contra o código</summary>

O efeito (304-319) realmente não retorna cleanup e chama setDbRecommendedMaterials/setAssignedDoctors após dois awaits. Porém, em React 18/19 setState em componente desmontado é no-op silencioso (não há mais warning nem vazamento), e a mistura entre pacientes exige mudança de clinicalProfile sem desmontagem — mesma incerteza do item 50033. O defeito estrutural existe, o dano descrito é menor do que o alegado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0534 · BAIXO · `CONFIRMADO`

**Parceiros iRec do insumo são calculados e descartados: botão de compra nunca aparece para eles**

**Onde:** `src/components/ProtocolGuide.jsx:504`

**O defeito:** getAvailablePartnersForMaterial retorna docSpecific, docGeneral, irecSpecific e hasAny (linhas 344-349), mas renderCheckoutButtons desestrutura apenas docSpecific e docGeneral e calcula hasDoctorPartners ignorando irecSpecific. Assim irecSpecific e hasAny são ramos mortos e nenhum botão é gerado para parceiros globais cadastrados pelo admin naquele insumo específico.

**Como falha:** Admin cadastra em Parceiros iRec o produto 'Placa de Alginato de Cálcio' com link de afiliado. O paciente cujo protocolo indica exatamente esse insumo vê, no card do produto, a mensagem 'Procure a farmácia credenciada mais próxima para aquisição deste produto' em vez do botão de compra do parceiro iRec — a conversão do parceiro nunca acontece por esse caminho.

**Código atual:**

```jsx
const { docSpecific, docGeneral } = getAvailablePartnersForMaterial(item.name);
    const hasDoctorPartners = docSpecific.length > 0 || docGeneral.length > 0;
```

**Correção sugerida:** Incluir irecSpecific no cálculo de hasAny e renderizar seus botões dentro de renderCheckoutButtons.

<details><summary>Verificação feita contra o código</summary>

Confirmado que getAvailablePartnersForMaterial retorna irecSpecific e hasAny (linhas 344-349) e que renderCheckoutButtons (504-505) desestrutura apenas docSpecific/docGeneral, tornando esses dois ramos mortos. Severidade rebaixada porque encontrei um caminho alternativo não citado pelo auditor: as linhas 858-864 renderizam uma seção própria com dbRecommendedMaterials.filter(m => m.type === 'irec_partner') para não-clínicos, então o parceiro iRec ainda é exibido, apenas não como botão no card do insumo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0535 · BAIXO · `CONFIRMADO`

**Link geral da farmácia do médico é repetido em todos os cards de insumo**

**Onde:** `src/components/ProtocolGuide.jsx:554`

**O defeito:** docGeneral vem de getAvailablePartnersForMaterial sem qualquer filtro por nome do insumo (linhas 332-336: filtra só por type 'doctor_general_partner' e médico vinculado). Como renderCheckoutButtons é chamado dentro do map de materiais, o mesmo botão de loja geral é renderizado uma vez por material.

**Como falha:** Paciente cujo médico cadastrou uma farmácia parceira geral abre o protocolo com 4 insumos sugeridos: o botão idêntico 'Comprar no Parceiro do Dr(a). X' aparece 4 vezes, uma em cada card, dando a impressão de que são ofertas diferentes para produtos diferentes.

**Código atual:**

```jsx
{docGeneral.map((part, pIdx) => (
          <button
            key={`doc-gen-${pIdx}`}
            className="btn"
            onClick={() => handlePartnerRedirectClick(item.name, part)}
```

**Correção sugerida:** Renderizar os parceiros gerais uma única vez, fora do map de materiais, como bloco 'Farmácia parceira do seu médico'.

<details><summary>Verificação feita contra o código</summary>

docGeneral (linhas 332-336) filtra apenas por type 'doctor_general_partner' e médico vinculado, sem qualquer relação com itemName, e renderCheckoutButtons é chamado por material — logo o mesmo botão 'Comprar no Parceiro do Dr(a). X' aparece uma vez em cada card (linhas 554-577).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0536 · BAIXO · `CONFIRMADO`

**Markdown literal exibido na tela: '**Lista de Pacientes**'**

**Onde:** `src/components/ProtocolGuide.jsx:618`

**O defeito:** O texto do estado vazio usa sintaxe Markdown dentro de JSX, que não é interpretada. Os asteriscos são renderizados literalmente para o usuário.

**Como falha:** Médico sem paciente ativo abre Protocolos e lê: 'acesse a **Lista de Pacientes** e selecione um caso ativo para análise.' — com os quatro asteriscos visíveis no meio da frase.

**Código atual:**

```jsx
Para visualizar os guias e protocolos clínicos personalizados, acesse a **Lista de Pacientes** e selecione um caso ativo para análise.
```

**Correção sugerida:** Substituir por <strong>Lista de Pacientes</strong>.

<details><summary>Verificação feita contra o código</summary>

Linha 618, dentro do estado vazio 'Nenhum Paciente Ativo': o texto JSX contém literalmente '**Lista de Pacientes**' e JSX não interpreta Markdown, então os asteriscos aparecem para o usuário.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "PrescriptionGeneratorModal.jsx|PrescriptionPage.jsx|ProtocolGuide.jsx|ReportPDFGenerator.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
