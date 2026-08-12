# 5. Painel do médico

**40 defeitos** — 4 crítico · 12 alto · 15 médio · 9 baixo

Arquivos tocados por este módulo:

- `src/components/DoctorDashboard.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0011 · CRÍTICO · `CONFIRMADO`

**getDoctorAppointments é chamada mas não está importada: ReferenceError na carga do painel**

**Onde:** `src/components/DoctorDashboard.jsx:162`

**O defeito:** A função existe em supabaseService.js:1503 mas não consta do bloco de import de DoctorDashboard (linhas 2-15). Confirmado pelo ESLint (no-undef).

**Como falha:** Todo médico que faz login dispara loadLists() na montagem e a cada 30 s. As duas primeiras consultas populam as listas e então a linha 162 lança ReferenceError, capturado pelo catch. setDoctorAppointments nunca é chamada: a agenda do médico fica permanentemente vazia, sem nenhuma mensagem de erro.

**Código atual:**

```jsx
// linha 162
const apps = await getDoctorAppointments(doctorProfile.id);
// import das linhas 2-15 (não contém getDoctorAppointments):
import { getAllPatients, getAssignedPatients, followPatient, unfollowPatient, getWoundEntries, addDoctorNote, issueDocument, getPatientDocuments, createAuditLog, getRecommendedMaterials, addRecommendedMaterial, deleteRecommendedMaterial } from '../services/supabaseService';
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0012 · CRÍTICO · `CONFIRMADO`

**Sincronização FHIR com o PEP hospitalar é 100% simulada (setTimeout) e alerta "sucesso" ao médico**

**Onde:** `src/components/DoctorDashboard.jsx:577`

**O defeito:** handleSyncPep não chama nenhum serviço, endpoint FHIR ou exportFHIRBundle. É apenas uma cadeia de setTimeout que anima a barra de progresso (10 -> 45 -> 80 -> 100), grava um log de auditoria afirmando que houve integração com 'Philips Tasy / MV Soul' e exibe alert de sucesso. Nada sai do navegador. Os setTimeout aninhados também não têm cleanup: se o médico fechar a ficha/desmontar o componente durante os 2,4s, setSyncProgress/setSyncingPep executam após o unmount e o alert aparece em outra tela.

**Como falha:** Médico abre a ficha de um paciente, clica em sincronizar com o PEP, vê a barra chegar a 100% e o alerta "Prontuário integrado sincronizado com sucesso no PEP do Hospital (Tasy/MV) via HL7 FHIR Bundle!". Ele passa a assumir que o hospital já tem o prontuário e não envia por outro meio. O hospital nunca recebeu nada, e o log de auditoria (SYNC_EHR_PATIENT) registra uma integração que não existiu.

**Código atual:**

```jsx
setTimeout(() => { setSyncProgress(45); setTimeout(() => { setSyncProgress(80); setTimeout(async () => { setSyncProgress(100); ... await createAuditLog('SYNC_EHR_PATIENT', selectedPatient.id, { ... ehrSystem: 'Philips Tasy / MV Soul' }); ... alert('Prontuário integrado sincronizado com sucesso no PEP do Hospital (Tasy/MV) via HL7 FHIR Bundle!');
```

**Correção sugerida:** Substituir a simulação por uma chamada real ao endpoint FHIR (ou remover o botão), guardando os ids dos timers em uma ref com clearTimeout no cleanup e só gravando o audit log/alert após resposta 2xx do servidor.

<details><summary>Verificação feita contra o código</summary>

Li DoctorDashboard.jsx:577-607. handleSyncPep é exatamente uma cadeia de três setTimeout de 800ms que apenas move setSyncProgress (10/45/80/100), grava createAuditLog('SYNC_EHR_PATIENT', ..., ehrSystem: 'Philips Tasy / MV Soul') e emite alert('Prontuário integrado sincronizado com sucesso no PEP do Hospital (Tasy/MV) via HL7 FHIR Bundle!'). Não há fetch, endpoint, nem sequer chamada a exportFHIRBundle — nenhum dado sai do navegador. Não existe guarda: o único early return é !selectedPatient. Os timers também não têm clearTimeout nem ref de cancelamento, então setSyncProgress/setSyncingPep e o alert executam mesmo após desmontagem. O log de auditoria afirma uma integração inexistente, o que é pior que o silêncio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0013 · CRÍTICO · `CONFIRMADO`

**Assinatura ICP-Brasil e falsificada: PIN nao e validado e hash/serial vem de Math.random()**

**Onde:** `src/components/DoctorDashboard.jsx:3375`

**O defeito:** O modal de assinatura aceita qualquer string nao vazia como PIN/OTP/senha do certificado (nenhuma verificacao contra o arquivo .pfx, token ou provedor em nuvem). Em seguida executeIssueDocument grava signatureDetails com serial e hash gerados por Math.random(), e o documento impresso afirma que houve assinatura eletronica com infraestrutura credenciada pela MP 2.200-2/2001. O QR code aponta para uma URL de validacao construida apenas com o id do documento (linha 3477), sem relacao com o hash exibido.

**Como falha:** Medico marca 'Assinar com ICP-Brasil', clica em 'Emitir e Salvar Atestado', digita qualquer caractere (ex: '1') no campo de PIN e clica em 'Assinar Documento'. O documento e salvo com isSigned=true e impresso com o selo 'ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)' e um 'HASH: SHA256:xxxx' aleatorio. O paciente/empregador recebe um atestado que se apresenta como juridicamente assinado, sem nenhuma assinatura criptografica real e sem que a senha do certificado tenha sido conferida.

**Código atual:**

```jsx
                  if (signaturePin.trim() !== '') {
                    setSignatureModalOpen(false);
                    executeIssueDocument(pendingDocType, true);
```

**Correção sugerida:** Bloquear a emissão assinada até existir assinatura real (PKCS#7/PAdES via provedor ICP-Brasil) ou remover integralmente o selo e o texto da MP 2.200-2/2001.

<details><summary>Verificação feita contra o código</summary>

A linha 3375 aceita qualquer string não vazia como PIN/OTP e chama executeIssueDocument(pendingDocType, true), sem nenhuma verificação contra .pfx, token ou provedor. O documento sai com isSigned=true, selo 'ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)' e o texto da MP 2.200-2/2001 (linhas 3488-3490), e o QR code (linha 3477) só codifica o id do documento, sem relação com o hash exibido. Documento clínico apresentado como juridicamente assinado sem qualquer assinatura criptográfica.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0014 · CRÍTICO · `CONFIRMAR-SCHEMA`

**Documento impresso mistura paciente atual com conteudo do documento anterior**

**Onde:** `src/components/DoctorDashboard.jsx:3432`

**O defeito:** handlePrintDocument (linha 570) grava activePrintDoc e chama window.print() apos 250ms, mas NUNCA limpa activePrintDoc (nao ha setActivePrintDoc(null) em nenhum ponto do arquivo). Ao mesmo tempo, o layout A4 imprime os dados do paciente a partir de selectedPatient (estado atual), e nao do paciente dono do documento (activePrintDoc.patientId existe, mas e ignorado).

**Como falha:** Medico abre o prontuario do paciente A, aba 'Documentos Clinicos', clica em 'Imprimir / PDF' de uma receita de A. Depois clica em 'Voltar para a Lista de Pacientes', abre o paciente B e pressiona Ctrl+P (ou imprime a evolucao de B). O layout .print-only continua montado (activePrintDoc ainda e o documento de A) e a folha impressa sai com 'Paciente: <nome de B>', 'Idade: <idade de B>' e 'Genero: <genero de B>' no cabecalho, mas com os medicamentos, CID, dias de afastamento e data de emissao da RECEITA DE A, alem do carimbo de assinatura de A. Receita clinicamente invalida e atribuida ao paciente errado.

**Código atual:**

```jsx
                <div><strong>Paciente:</strong> {selectedPatient?.name}</div>
                <div><strong>Idade:</strong> {calculateAge(selectedPatient?.birthDate)}</div>
                <div><strong>Genero:</strong> {selectedPatient?.gender}</div>
```

**Correção sugerida:** Renderizar o cabeçalho a partir do paciente dono do documento (activePrintDoc.patientId) e limpar activePrintDoc no evento 'afterprint'.

<details><summary>Verificação feita contra o código</summary>

Grep confirma que setActivePrintDoc só é chamado na linha 571 (nunca com null), e o layout .print-only (linha 3393) permanece montado indefinidamente. O cabeçalho do paciente (linhas 3432-3434) lê selectedPatient, enquanto todo o corpo, o selo de assinatura e o QR code leem activePrintDoc. Basta trocar de paciente e imprimir (Ctrl+P) para sair uma receita com dados cadastrais de B e conteúdo/assinatura do documento de A.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0094 · ALTO · `CONFIRMAR-SCHEMA`

**Certificado digital e CPF do medico permanecem no localStorage apos o logout**

**Onde:** `src/components/DoctorDashboard.jsx:104`

**O defeito:** digitalCertType, birdIdUser (CPF do provedor em nuvem) e a1CertName sao inicializados a partir do localStorage (linhas 102, 104 e 105) e gravados nas chaves irec_cert_type, irec_birdid_user e irec_a1_name (linhas 1455, 1517, 1547 e 1586). O handleLogout de src/App.jsx (linhas 661 a 667) remove apenas irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab - nenhuma das tres chaves de certificado e apagada.

**Como falha:** Dr. Joao configura o certificado em nuvem no consultorio compartilhado, digitando o CPF dele (gravado em irec_birdid_user), e faz logout. Dra. Maria loga na mesma maquina/navegador: o cabecalho ja mostra 'Certificado Nuvem (BirdID Ativo)', o botao 'Emitir Receita / Atestado' esta desbloqueado e o modal exibe o CPF do Dr. Joao no campo 'CPF / Usuario do Provedor'. Ela emite documentos marcados como assinados usando a configuracao de certificado de outro profissional, e o CPF de terceiro fica visivel para ela (vazamento de dado pessoal entre usuarios).

**Código atual:**

```jsx
  const [birdIdUser, setBirdIdUser] = useState(() => localStorage.getItem('irec_birdid_user') || '');
  const [a1CertName, setA1CertName] = useState(() => localStorage.getItem('irec_a1_name') || '');
```

**Correção sugerida:** Adicionar removeItem de irec_cert_type, irec_birdid_user e irec_a1_name ao handleLogout de App.jsx.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois lados: as linhas 102/104/105 inicializam digitalCertType, birdIdUser e a1CertName a partir de irec_cert_type, irec_birdid_user e irec_a1_name; o handleLogout de App.jsx (linhas 660-667) remove apenas as 7 chaves de navegação, nenhuma das três de certificado. Em máquina compartilhada o próximo médico herda a configuração de certificado e vê o CPF do anterior.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0095 · ALTO · `CONFIRMAR-SCHEMA`

**Insumos recomendados de outros medicos aparecem como 'seus' e podem ser excluidos**

**Onde:** `src/components/DoctorDashboard.jsx:215`

**O defeito:** getRecommendedMaterials em src/services/supabaseService.js:2492 aceita (patientId, doctorId) e, quando recebe apenas patientId (linha 2519), executa .or('patient_id.is.null,patient_id.eq.<id>') sem filtrar por doctor_id, retornando as recomendacoes de TODOS os medicos para aquele paciente. O componente chama sempre sem o segundo argumento (linhas 215, 240, 640 e 658) e apenas filtra por type === 'doctor_partner'. A lista e rotulada 'Seus Insumos Indicados para este Paciente' (linha 3054) e cada item tem botao de exclusao (linha 3076) sem checagem de dono.

**Como falha:** Dr. Joao cadastra um insumo com o link de afiliado dele para o paciente X. Dra. Maria, que tambem acompanha X, abre a aba 'Receitar Insumos' e ve o insumo com o link de afiliado do Dr. Joao listado como se fosse dela; ao clicar na lixeira, deleteRecommendedMaterial remove o registro do Dr. Joao do banco. Um profissional apaga a prescricao de insumo de outro e visualiza o link de monetizacao de terceiro.

**Código atual:**

```jsx
        const mats = await getRecommendedMaterials(selectedPatient.id);
        setRecommendedMaterials(mats.filter(m => m.type === 'doctor_partner'));
```

**Correção sugerida:** Passar doctorProfile.id às quatro chamadas e filtrar por m.doctor_id === doctorProfile.id antes de listar e permitir exclusão.

<details><summary>Verificação feita contra o código</summary>

getRecommendedMaterials (supabaseService.js:2492) só filtra por doctor_id no ramo (doctorId && !patientId); com patientId (linha 2519/2503) devolve tudo que pertence ao paciente, de qualquer médico. As quatro chamadas do componente (215, 240, 640, 658) passam só patientId e filtram apenas por type==='doctor_partner', a lista é rotulada 'Seus Insumos Indicados' (3054) e o botão de lixeira (3076) chama deleteRecommendedMaterial sem checar dono. Em modo local não há RLS alguma para mitigar.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0096 · ALTO · `CONFIRMAR-SCHEMA`

**Troca rapida de paciente permite gravar evolucao no prontuario errado (race sem cancelamento)**

**Onde:** `src/components/DoctorDashboard.jsx:227`

**O defeito:** O efeito de selectedPatient dispara fetchEntries com quatro awaits sequenciais e nao possui flag de cancelamento nem AbortController; nao limpa selectedEntry, selectedPatientEntries, patientDocuments e recommendedMaterials antes de buscar. Duas selecoes em sequencia geram duas execucoes concorrentes e a que terminar por ultimo sobrescreve o estado.

**Como falha:** O medico clica no paciente A e, um instante depois, clica em 'Voltar' e no paciente B (conexao lenta). Enquanto a busca de B nao retorna, a tela ja mostra o nome e os dados cadastrais de B, porem selectedEntry e selectedPatientEntries ainda sao as lesoes de A e a caixa de evolucao ja esta preenchida com a nota de A. Se o medico clicar em 'Gravar Nota no Prontuario' nesse intervalo, addDoctorNote(selectedEntry.id, ...) grava a evolucao no registro de lesao do PACIENTE A. Se a resposta de A chegar depois da de B, as lesoes de A ficam permanentemente exibidas sob o cabecalho de B.

**Código atual:**

```jsx
      const fetchEntries = async () => {
        const history = await getWoundEntries(selectedPatient.id);
        setSelectedPatientEntries(history);
```

**Correção sugerida:** Usar flag de cancelamento (let cancelled=false no efeito, return () => { cancelled = true }) e limpar selectedEntry/entries/doctorNote no início do efeito.

<details><summary>Verificação feita contra o código</summary>

O efeito (227-265) faz quatro awaits sequenciais sem flag de cancelamento nem AbortController e não limpa selectedEntry/selectedPatientEntries/doctorNote antes de buscar — o reset só acontece dentro do then, depois do await da linha 230. Com rede lenta, o cabeçalho já mostra B enquanto selectedEntry ainda é a lesão de A, e handleSaveNote (319-323) grava em selectedEntry.id, ou seja, no prontuário de A. Respostas fora de ordem também sobrescrevem o estado.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0097 · ALTO · `CONFIRMAR-SCHEMA`

**Formularios de receita e atestado nao sao limpos ao trocar de paciente**

**Onde:** `src/components/DoctorDashboard.jsx:249`

**O defeito:** Ao selecionar um novo paciente, o efeito reseta apenas selectedSubTab, doctorNote, prescribedDressing e prescribedFrequency. Nao reseta prescriptionItems (linha 85), atestadoReason (linha 87), atestadoCid (linha 88), atestadoType (linha 90), syncSuccessTime (linha 114) nem patientDocuments/recommendedMaterials antes do fetch.

**Como falha:** Medico abre o paciente A, aba Documentos, seleciona no autocomplete o CID 'A46 - Erisipela' (o que preenche atestadoReason com 'Paciente diagnosticado com Erisipela (A46)...'), mas nao emite. Volta e abre o paciente B, clica em Documentos > Atestado Medico: o campo CID continua 'A46' e a justificativa clinica continua descrevendo a Erisipela do paciente A. Se clicar em 'Emitir e Salvar Atestado', o atestado de B sai com o diagnostico de A. O mesmo ocorre com medicamentos digitados na receita.

**Código atual:**

```jsx
        setSelectedSubTab('wounds');
        
        if (history.length > 0) {
```

**Correção sugerida:** Resetar prescriptionItems, atestadoReason, atestadoCid e atestadoType no mesmo efeito de troca de selectedPatient.

<details><summary>Verificação feita contra o código</summary>

Lido o efeito completo (227-276): reseta só selectedSubTab, doctorNote, prescribedDressing e prescribedFrequency. prescriptionItems (85), atestadoReason (87), atestadoCid (88), atestadoType (90) e syncSuccessTime (114) persistem entre pacientes, e o autocomplete de CID (linha 2852) grava o diagnóstico por extenso em atestadoReason. Diagnóstico e medicamentos do paciente anterior ficam no formulário do novo paciente.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0098 · ALTO · `CONFIRMAR-SCHEMA`

**Galeria comparativa mantem fotos do paciente anterior ao trocar de prontuario**

**Onde:** `src/components/DoctorDashboard.jsx:276`

**O defeito:** O useEffect disparado por selectedPatient recarrega entries, documentos, materiais e reseta selectedSubTab, mas nao limpa compareEntries (linha 122) nem showComparison (linha 123). Esses estados guardam objetos de entry completos (foto, area, notas) do paciente anterior.

**Como falha:** Medico abre o paciente A, vai em 'Galeria Evolutiva', marca duas fotos e clica em 'Comparar Lado a Lado'. Clica em 'Voltar para a Lista de Pacientes' (selectedPatient = null, mas o componente permanece montado) e abre o paciente B. Ao clicar em 'Galeria Evolutiva', showComparison ainda e true e a tela abre direto na comparacao exibindo as DUAS FOTOS DE FERIDA DO PACIENTE A, com area, estagio, dor e evolucao clinica de A, dentro do prontuario identificado como paciente B. Exposicao de imagem clinica de um paciente na ficha de outro.

**Código atual:**

```jsx
      setChatHistory([
        { 
          sender: 'ai', 
          text: `Ola, Dr(a). ${docName}! ...` 
        }
      ]);
    }
  }, [selectedPatient]);
```

**Correção sugerida:** Adicionar setCompareEntries([]) e setShowComparison(false) ao efeito disparado por selectedPatient.

<details><summary>Verificação feita contra o código</summary>

O efeito de [selectedPatient] (linhas 227-276) reseta selectedSubTab, entries, documentos, materiais e chatHistory, mas não toca em compareEntries (122) nem showComparison (123), que guardam objetos de entry completos (foto, área, notas) do paciente anterior. Como 'Voltar para a Lista' apenas zera selectedPatient sem desmontar o componente, o estado sobrevive e a galeria de B abre exibindo as fotos de ferida de A.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0099 · ALTO · `CONFIRMADO`

**Sucesso e informado mesmo quando addDoctorNote falha em gravar a evolucao**

**Onde:** `src/components/DoctorDashboard.jsx:323`

**O defeito:** addDoctorNote (src/services/supabaseService.js:1799) retorna false quando nao encontra o entry (tanto no caminho local, linha 1814, quanto no fallback do catch, linha 1844) e nunca lanca excecao. O componente ignora o valor retornado, exibe alert de sucesso e ainda atualiza o estado local de forma otimista, mascarando a falha.

**Como falha:** Em modo contingencia local (ou quando o update no Supabase falha e o fallback tambem nao encontra o entry, por exemplo entry recem-criado em outro dispositivo), o medico escreve a evolucao clinica, clica em 'Gravar Nota no Prontuario' e recebe 'Evolucao medica e prescricao salvas com sucesso!'. A tela passa a mostrar a nota (estado local), mas nada foi persistido: ao recarregar a pagina ou apos o polling de 30s do App.jsx sobrescrever selectedPatientEntries, a evolucao desaparece. Perda silenciosa de registro de prontuario.

**Código atual:**

```jsx
      await addDoctorNote(selectedEntry.id, doctorNote, prescribedDressing, prescribedFrequency);
      alert('Evolucao medica e prescricao salvas com sucesso!');
```

**Correção sugerida:** Capturar o retorno (const ok = await addDoctorNote(...)) e exibir erro sem atualizar o estado local quando ok for false.

<details><summary>Verificação feita contra o código</summary>

addDoctorNote (supabaseService.js:1799) retorna false sem lançar quando não acha o entry, tanto no caminho local (1814) quanto no fallback do catch (1844); e no caminho Supabase um update que não casa nenhuma linha nem sequer gera erro, retornando true. A linha 323 descarta o retorno, exibe alert de sucesso e atualiza o estado local otimistamente, mascarando a perda do registro até o próximo reload/polling.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0100 · ALTO · `CONFIRMADO`

**Serial e hash da assinatura gerados aleatoriamente a cada emissao**

**Onde:** `src/components/DoctorDashboard.jsx:466`

**O defeito:** Os campos que representam o certificado e a integridade do documento (serial ICP-Brasil e hash SHA256) sao produzidos com Math.random(), sem qualquer relacao com o conteudo do documento nem com um certificado real. O mesmo bloco esta duplicado para atestado nas linhas 495 e 496.

**Como falha:** Duas receitas identicas emitidas pelo mesmo medico recebem hashes diferentes; a mesma receita reimpressa nao pode ser conferida contra o conteudo. Qualquer alteracao posterior no conteudo do documento nao altera o hash. A validacao anunciada em 'https://irec.com.br/validar' e impossivel de ser cumprida, ou seja, o selo de integridade e decorativo.

**Código atual:**

```jsx
            serial: `BR-${Math.floor(Math.random() * 900000000000 + 100000000000)}-CFM`,
            hash: `SHA256:${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`
```

**Correção sugerida:** Substituir por hash real do conteúdo canonizado (SHA-256 via crypto.subtle) e pelo serial do certificado efetivamente usado, ou remover os campos.

<details><summary>Verificação feita contra o código</summary>

Linhas 466-467 (receita) e 495-496 (atestado) geram serial e hash com Math.random(), sem relação com o conteúdo nem com certificado. O hash é impresso como prova de integridade na linha 3492 e a validação prometida em https://irec.com.br/validar é impossível. É a mesma falha estrutural do item 174 (selo decorativo), por isso ajusto de critico para alto para não contar o dano em dobro.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0101 · ALTO · `CONFIRMADO`

**Atestado emitido nao limpa justificativa clinica nem tipo, reaproveitando o diagnostico anterior**

**Onde:** `src/components/DoctorDashboard.jsx:527`

**O defeito:** Depois de emitir com sucesso, o reset cobre apenas atestadoDays e atestadoCid. atestadoReason (que contem o texto do diagnostico, muitas vezes com o nome da doenca e o CID por extenso, conforme linha 2852) e atestadoType permanecem preenchidos.

**Como falha:** Medico emite um atestado para o paciente A com justificativa 'Paciente diagnosticado com Diabetes mellitus tipo 2 com complicacoes circulatorias perifericas (E11.5)...'. Em seguida emite um atestado para o paciente B: o CID aparece vazio (foi resetado), mas o campo de justificativa continua com o diagnostico de diabetes de A e e gravado e impresso no atestado de B ('...esteve sob meus cuidados clinicos ... e Paciente diagnosticado com Diabetes...'). Diagnostico de um paciente vaza no documento oficial de outro.

**Código atual:**

```jsx
        } else {
          setAtestadoDays('3');
          setAtestadoCid('');
        }
```

**Correção sugerida:** Incluir setAtestadoReason(<texto padrão>) e setAtestadoType('Afastamento') no bloco de reset após a emissão bem-sucedida.

<details><summary>Verificação feita contra o código</summary>

O reset pós-emissão (linhas 525-530) cobre prescriptionItems no caso receita e apenas atestadoDays/atestadoCid no caso atestado. atestadoReason — preenchido com o texto 'Paciente diagnosticado com <doença> (<CID>)' pela linha 2852 — e atestadoType permanecem, e é atestadoReason que é impresso em negrito no corpo do atestado (linha 3460). Diagnóstico do paciente anterior vaza no documento oficial do seguinte.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0102 · ALTO · `CONFIRMADO`

**Sincronizacao com o PEP hospitalar e apenas uma animacao, mas informa sucesso e grava auditoria**

**Onde:** `src/components/DoctorDashboard.jsx:583`

**O defeito:** handleSyncPep nao faz nenhuma chamada de rede: encadeia tres setTimeout que apenas movem a barra de progresso e, ao final, grava um log de auditoria SYNC_EHR_PATIENT afirmando a integracao e exibe alert de sucesso. A tela ainda mostra um identificador de paciente fixo no PEP ('TASY-PR-93218-B', linha 2998) igual para todos os pacientes e um endpoint FHIR estatico.

**Como falha:** Medico abre a aba 'Integracao PEP' de um paciente, clica em 'Sincronizar Prontuario FHIR com o PEP', ve a barra chegar a 100% e recebe 'Prontuario integrado sincronizado com sucesso no PEP do Hospital (Tasy/MV) via HL7 FHIR Bundle!'. Nada foi enviado ao hospital. O medico passa a acreditar que a equipe hospitalar tem acesso a evolucao da ferida, e o historico da tela registra 'Ultima em: <data/hora>' reforcando a falsa confirmacao.

**Código atual:**

```jsx
    setTimeout(() => {
      setSyncProgress(45);
      setTimeout(() => {
        setSyncProgress(80);
        setTimeout(async () => {
          setSyncProgress(100);
```

**Correção sugerida:** Marcar a tela como demonstração/homologação e desabilitar o botão até existir integração real, ou implementar o POST do Bundle FHIR.

<details><summary>Verificação feita contra o código</summary>

handleSyncPep (577-607) só encadeia três setTimeout de 800ms movendo a barra de progresso; não há fetch, supabase nem chamada FHIR. Ao final grava o audit log SYNC_EHR_PATIENT e exibe alert afirmando integração via HL7 FHIR Bundle. A tela ainda mostra identificador fixo 'TASY-PR-93218-B' (linha 2998) igual para todos os pacientes e endpoint estático. O profissional é levado a crer que a equipe hospitalar recebeu a evolução.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0103 · ALTO · `CONFIRMAR-SCHEMA`

**Cadastro de insumo envia preco como texto para coluna numeric(10,2) e sempre falha**

**Onde:** `src/components/DoctorDashboard.jsx:624`

**O defeito:** O payload envia price com o valor digitado no campo de texto livre (placeholder 'Ex: R$ 45,00', linha 3128) ou a string literal 'A consultar' quando vazio. A coluna price da tabela recommended_materials e numeric(10,2) (clean_database_v5.sql, linha 17), portanto qualquer string nao numerica gera erro de insert no Supabase; addRecommendedMaterial (supabaseService.js:2566) relanca o erro.

**Como falha:** Com Supabase configurado, o medico preenche o formulario 'Recomendar Novo Insumo Afiliado' deixando o preco em branco (ou digitando 'R$ 45,00'), clica em 'Vincular Recomendacao Particular' e recebe 'Erro ao recomendar insumo. Tente novamente.' O insert falha com 'invalid input syntax for type numeric'. O recurso de recomendacao de insumos e inutilizavel em producao, independente do que o medico digite.

**Código atual:**

```jsx
        price: newMatPrice || 'A consultar',
```

**Correção sugerida:** Normalizar o preço para número antes do insert (parse de 'R$ 45,00') e enviar null quando vazio.

<details><summary>Verificação feita contra o código</summary>

A linha 624 envia price: newMatPrice || 'A consultar' e clean_database_v5.sql:17 declara price numeric(10,2); addRecommendedMaterial (2543) relança o erro, caindo no alert genérico da linha 645. O título exagera ao dizer 'sempre falha' — digitar '45' funcionaria —, mas o caminho padrão (campo em branco -> 'A consultar') e o formato sugerido pelo placeholder ('R$ 45,00') falham sempre em modo Supabase.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0104 · ALTO · `CONFIRMADO`

**Nenhuma checagem de papel: acesso ao painel e liberado apenas por perfil completo e admin por string de e-mail**

**Onde:** `src/components/DoctorDashboard.jsx:812`

**O defeito:** O unico gate do componente e isProfileComplete (CRM, especialidade, bio, formacao, valor e foto) e a excecao isAdmin baseada na comparacao de e-mail com a string 'admin@irec.com' em codigo do cliente. Nao ha verificacao de doctorProfile.role. Alem disso loadLists() roda no useEffect da linha 175, ou seja, ANTES do gate de render, chamando getAllPatients() que retorna CPF, RG, CNS, telefone e endereco completo de todos os pacientes da plataforma.

**Como falha:** O App.jsx renderiza este componente no case 'doctor-dashboard' sem checar o papel (App.jsx linha 742) e o activeTab e lido do hash da URL. Um paciente autenticado digita #doctor-dashboard: o componente monta, o useEffect executa getAllPatients() e a resposta com PII de todos os pacientes chega ao navegador dele (visivel no DevTools), mesmo que o render final mostre a tela 'Perfil Profissional Obrigatorio'. E qualquer usuario que consiga registrar a conta admin@irec.com pula o gate profissional e ganha acesso total aos prontuarios.

**Código atual:**

```jsx
  const isAdmin = doctorProfile?.email === 'admin@irec.com';

  if (!isProfileComplete && !isAdmin) {
```

**Correção sugerida:** Checar currentUser.role === 'doctor' || 'nurse' no case de App.jsx e sair cedo de loadLists quando o papel não for clínico.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois arquivos: o gate do componente (804-814) só olha completude do perfil e o isAdmin por comparação literal com 'admin@irec.com' no cliente, sem checar doctorProfile.role; e App.jsx:742 renderiza o case 'doctor-dashboard' sem verificar currentUser.role. O activeTab é alcançável por hash (handlePopState em App.jsx:68-70 lê window.location.hash) e por irec_active_tab no localStorage (linha 468). Como os hooks rodam antes do early return, loadLists() executa getAllPatients() mesmo para quem cai na tela 'Perfil Profissional Obrigatório'. Ressalva: em produção RLS no Supabase pode barrar o SELECT — em modo contingência local não há barreira alguma.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0105 · ALTO · `CONFIRMADO`

**Botao de atestado sugerido aparece por qualquer texto com a palavra 'dias' e preenche CID L98.4 por padrao**

**Onde:** `src/components/DoctorDashboard.jsx:3215`

**O defeito:** Quando a IA nao devolve suggestedDocument estruturado, a exibicao do botao 'Preencher Atestado Sugerido' e decidida por busca de substring em msg.text: 'atestado', 'afastamento' ou 'dias'. Ao clicar, handleApplyAISuggestion extrai o numero antes de 'dias' com regex (linha 733) e, se nao houver CID no texto, assume 'L98.4' (linha 736) e sobrescreve a justificativa com um texto de afastamento laboral (linha 740).

**Como falha:** O medico pergunta no copiloto 'qual a frequencia de troca do curativo?' e a IA responde 'Recomenda-se a troca a cada 3 dias'. Como o texto contem 'dias', surge o botao 'Preencher Atestado Sugerido'. Um clique preenche o formulario de atestado com 3 dias de afastamento, CID L98.4 (ulcera cronica da pele) e a justificativa 'necessita de afastamento das atividades laborais...', mesmo sem a IA ter sugerido qualquer afastamento. Se o medico apenas confirmar, e emitido um atestado de afastamento laboral com CID que a IA nunca indicou.

**Código atual:**

```jsx
                  {msg.sender === 'ai' && (msg.suggestedDocument?.type === 'atestado' || (!msg.suggestedDocument && (msg.text.toLowerCase().includes('atestado') || msg.text.toLowerCase().includes('afastamento') || msg.text.toLowerCase().includes('dias')))) && (
```

**Correção sugerida:** Exibir o botão apenas quando msg.suggestedDocument?.type === 'atestado' e nunca inferir CID por padrão.

<details><summary>Verificação feita contra o código</summary>

Linha 3215 confirmada: sem suggestedDocument estruturado, o botão aparece por substring 'atestado', 'afastamento' ou 'dias'. handleApplyAISuggestion (732-742) extrai o número antes de 'dias' (733), assume 'L98.4' quando não há CID (736) e sobrescreve atestadoReason com texto de afastamento laboral (740) — tudo sem a IA ter sugerido afastamento. Uma resposta trivial como 'trocar o curativo a cada 3 dias' produz um atestado de 3 dias com CID inventado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0275 · MÉDIO · `CONFIRMADO`

**Token A3 e reportado como conectado sem qualquer verificacao**

**Onde:** `src/components/DoctorDashboard.jsx:108`

**O defeito:** a3TokenConnected e inicializado como true e seu setter nunca e chamado em nenhum ponto do arquivo (nao ha deteccao de leitora, PKCS#11 ou WebPKI). A aba A3 do modal exibe texto fixo afirmando que o leitor esta ativo e que o servico de assinatura esta rodando em localhost, e o botao 'Salvar e Ativar Certificado' nao valida nada para essa aba (as unicas validacoes, linhas 1570 a 1583, cobrem a1 e birdid).

**Como falha:** O medico, sem nenhum token USB conectado, abre 'Vincular Certificado Digital', clica na aba 'USB / Cartao A3' (que informa 'Leitor / Token Ativo: Aladdin eToken / Safenet PKCS#11') e clica em 'Salvar e Ativar Certificado'. O sistema responde '✅ Certificado Digital (A3) configurado e ativado com sucesso!', o cabecalho passa a exibir '🟢 Certificado A3 (USB Ativo)' e a emissao assinada e liberada, sem que exista qualquer certificado no computador.

**Código atual:**

```jsx
  const [a3TokenConnected, setA3TokenConnected] = useState(true);
```

**Correção sugerida:** Remover o indicador de token ativo ou derivá-lo de uma verificação real do serviço/extensão de assinatura.

<details><summary>Verificação feita contra o código</summary>

Grep em todo o arquivo mostra a3TokenConnected apenas na declaração da linha 108 (useState(true)); setA3TokenConnected nunca é chamado, ou seja, não há detecção de leitora, PKCS#11 ou WebPKI. A aba A3 apresenta ao médico um estado de hardware inventado e libera a emissão 'assinada'. É a face de UI da mesma falsificação dos itens 174/175.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0276 · MÉDIO · `CONFIRMADO`

**getDoctorAppointments e usada mas nunca importada (ReferenceError silenciado)**

**Onde:** `src/components/DoctorDashboard.jsx:162`

**O defeito:** O bloco de imports (linhas 2 a 15) traz getAllPatients, getAssignedPatients, followPatient, unfollowPatient, getWoundEntries, addDoctorNote, issueDocument, getPatientDocuments, createAuditLog, getRecommendedMaterials, addRecommendedMaterial e deleteRecommendedMaterial, mas NAO importa getDoctorAppointments. A funcao existe em src/services/supabaseService.js:1503 (confirmado por Grep), porem nao esta no escopo deste arquivo. Como a chamada esta dentro do try de loadLists, o ReferenceError e engolido pelo catch (linha 165) e apenas logado no console.

**Como falha:** Medico faz login. loadLists() roda no mount (linha 175) e a cada 30s (linha 199). getAllPatients e getAssignedPatients executam e populam as listas, mas na linha 162 e lancado 'ReferenceError: getDoctorAppointments is not defined'. O catch registra o erro e setDoctorAppointments NUNCA e chamado: doctorAppointments fica [] para sempre. Resultado: contadores da agenda ('Todas (0)', 'Agendadas (0)') sempre zerados e nenhum agendamento aparece, alem de um erro no console a cada 30 segundos.

**Código atual:**

```jsx
      if (doctorProfile?.id) {
        const apps = await getDoctorAppointments(doctorProfile.id);
        setDoctorAppointments(apps);
      }
```

**Correção sugerida:** Adicionar getDoctorAppointments à lista de imports de '../services/supabaseService' na linha 14.

<details><summary>Verificação feita contra o código</summary>

O bloco de imports (linhas 2-15) realmente não traz getDoctorAppointments, e a função existe apenas em supabaseService.js:1503. A chamada na linha 162 lança ReferenceError engolido pelo catch da linha 165. Porém o erro ocorre DEPOIS de setPatients e setMyPatients, então as listas de pacientes continuam funcionando; e doctorAppointments só é consumido no bloco 'my-agenda', que é inalcançável (item 188). Dano real: erro no console a cada 30s e agenda vazia numa tela que ninguém abre. Severidade rebaixada de critico para medio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0277 · MÉDIO · `CONFIRMADO`

**Validacao de dias do atestado aceita zero e valores negativos**

**Onde:** `src/components/DoctorDashboard.jsx:471`

**O defeito:** A checagem !atestadoDays || isNaN(Number(atestadoDays)) nao rejeita '0' (string truthy cujo Number e 0), nem valores negativos, nem valores acima do limite visual de 90. Os atributos min="1" e max="90" do input (linhas 2802 e 2803) nao sao validados porque o botao nao esta dentro de um form com submit.

**Como falha:** O medico digita 0 (ou apaga e digita -5) no campo 'Dias de Afastamento / Repouso' e clica em 'Emitir e Salvar Atestado'. O documento e emitido e impresso com 'pelo periodo de 0 dia(s), contados a partir desta data' ou '-5 dia(s)', gerando um atestado oficial invalido entregue ao paciente/empregador.

**Código atual:**

```jsx
        if (!atestadoDays || isNaN(Number(atestadoDays))) {
          alert('Por favor, informe um numero de dias valido.');
```

**Correção sugerida:** Trocar por const d = Number(atestadoDays); if (!Number.isInteger(d) || d < 1 || d > 90) rejeitar.

<details><summary>Verificação feita contra o código</summary>

A guarda !atestadoDays || isNaN(Number(atestadoDays)) deixa passar '0' (string truthy, Number 0) e '-5' (número válido). Não há outra validação antes do insert nem no render; os atributos min/max do input não são checados porque o botão não faz submit de form. O valor cai direto no texto impresso do atestado (linha 3460).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0278 · MÉDIO · `CONFIRMADO`

**Emissao de documento em modo contingencia local nao gera nenhum log de auditoria LGPD**

**Onde:** `src/components/DoctorDashboard.jsx:504`

**O defeito:** createAuditLog (src/services/supabaseService.js:333) comeca com 'if (!isSupabaseConfigured) return null;'. Todas as chamadas de auditoria deste arquivo (assinatura de documento na linha 504, emissao na linha 511, exportacao FHIR na linha 311 e sincronizacao PEP na linha 594) sao no-ops silenciosos nesse modo, mas o componente ignora o retorno e exibe as mensagens de sucesso.

**Como falha:** Com o app rodando em modo contingencia local (supabase === null), o medico assina e emite um atestado, exporta o prontuario completo em FHIR JSON e sincroniza o PEP. Nenhuma dessas acoes sobre dados sensiveis fica registrada em lugar algum, embora o sistema confirme 'assinado e emitido com sucesso' e 'Prontuario exportado no padrao HL7 FHIR JSON com sucesso'. A trilha de auditoria exigida pela LGPD fica vazia sem qualquer aviso ao profissional.

**Código atual:**

```jsx
          await createAuditLog('SIGN_MEDICAL_DOCUMENT', doc.id, {
            type,
            doctorName: doctorProfile.name,
            patientName: selectedPatient.name,
```

**Correção sugerida:** Fazer createAuditLog gravar em localStorage (via services/auditLogger) quando isSupabaseConfigured for false.

<details><summary>Verificação feita contra o código</summary>

supabaseService.js:334 abre com 'if (!isSupabaseConfigured) return null;' e o catch (355-358) também devolve null sem lançar. Como o .env está vazio, todas as chamadas do componente (311, 504, 511, 594) são no-ops silenciosos, enquanto os alerts de sucesso são exibidos. Existe ainda o auditLogger local, mas ele não é usado aqui.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0279 · MÉDIO · `CONFIRMADO`

**Timers de handleSyncPep sem cleanup: setState e alert apos desmontagem**

**Onde:** `src/components/DoctorDashboard.jsx:606`

**O defeito:** Os tres setTimeout encadeados (2,4 segundos no total) nao sao registrados em ref nem cancelados em nenhum useEffect de cleanup. O unico cleanup do componente (linha 430) apenas para o reconhecimento de voz. handlePrintDocument (linha 572) tem o mesmo problema.

**Como falha:** Medico clica em 'Sincronizar Prontuario FHIR com o PEP' e imediatamente troca de aba no menu lateral (o App desmonta o DoctorDashboard porque a key muda). Cerca de 2 segundos depois os timers ainda pendentes chamam setSyncProgress/setSyncingPep/setSyncSuccessTime em um componente desmontado e disparam um alert('Prontuario integrado sincronizado...') sobre uma tela totalmente diferente (por exemplo, a Telemedicina), alem de gravar o log de auditoria da sincronizacao que o medico abandonou.

**Código atual:**

```jsx
        }, 800);
      }, 800);
    }, 800);
  };
```

**Correção sugerida:** Guardar os ids dos timers em um useRef e limpá-los no cleanup do useEffect do componente.

<details><summary>Verificação feita contra o código</summary>

Os três setTimeout (583-606) e o de handlePrintDocument (572) não são guardados em ref; o único cleanup do componente (linhas 430-434, confirmado por grep) apenas para o reconhecimento de voz. Trocando de aba, o App desmonta o DoctorDashboard (key={activeTab}) e ~2,4s depois o alert de sucesso e o audit log ainda disparam sobre outra tela. Em React 19 não há mais warning de setState pós-desmontagem, mas o alert e o log espúrios permanecem.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0280 · MÉDIO · `CONFIRMAR-SCHEMA`

**Itens de receita sugeridos pela IA sao aplicados sem normalizacao e imprimem 'undefined'**

**Onde:** `src/components/DoctorDashboard.jsx:675`

**O defeito:** setPrescriptionItems(dataOrText.items) grava direto o array vindo do JSON da IA. O contrato do prompt (src/services/geminiService.js linhas 574 a 580) pede name, dosage, route e instructions, mas nao ha garantia de que o modelo devolva todos os campos, e os inputs/selects da receita sao controlados por item.dosage, item.route e item.instructions.

**Como falha:** A IA devolve suggestedDocument.content.items = [{ name: 'Alginato de Calcio' }]. O medico clica em 'Preencher Receita Sugerida': o input de posologia recebe value={undefined} e passa de controlado para nao controlado (aviso do React e campo que o usuario nao consegue mais limpar via estado), o select de via fica com value undefined exibindo 'Via Topica' enquanto o estado nao tem esse valor. Ao emitir, a receita impressa sai como 'Alginato de Calcio - undefined (undefined)' e 'Instrucoes: undefined'.

**Código atual:**

```jsx
        if (dataOrText.items && dataOrText.items.length > 0) {
          setPrescriptionItems(dataOrText.items);
        }
```

**Correção sugerida:** Normalizar antes de setar: items.map(i => ({ name: i.name || '', dosage: i.dosage || '', route: i.route || 'Via Tópica', instructions: i.instructions || '' })).

<details><summary>Verificação feita contra o código</summary>

A linha 675 realmente grava dataOrText.items cru no estado, e os inputs das linhas 2690/2700 são controlados por item.name/item.dosage — um item sem dosage vira input não controlado e imprime 'undefined' no layout A4 (linha 3446). O que não consegui confirmar é se o modelo de fato omite campos: depende da resposta da IA em runtime, não do código. O defeito de robustez, porém, é real.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0281 · MÉDIO · `CONFIRMADO`

**Parser de receita da IA cria medicamento a partir de qualquer linha que contenha 'sf' ou 'mg'**

**Onde:** `src/components/DoctorDashboard.jsx:703`

**O defeito:** O reconhecimento de itens de receita a partir do texto livre da IA usa lower.includes('sf'), lower.includes('mg'), lower.includes('soro') e lower.includes('comprimido'). 'sf' e 'mg' sao substrings extremamente comuns em portugues (por exemplo 'satisfatoria' contem 'sf'; 'algum', 'imagem' contem 'mg' apenas em casos raros, mas 'mg' aparece em qualquer dosagem citada em prosa).

**Como falha:** A IA responde 'Evolucao satisfatoria da lesao, manter conduta.' O medico clica em 'Preencher Receita Sugerida'. A linha passa pelo filtro por conter 'sf' (sati-sf-atoria) e e transformada em um item de prescricao com name='Evolucao satisfatoria da lesao', dosage='1 unidade', route='Via Topica' e instructions='Uso conforme indicacao.'. Se o medico emitir, a receita impressa lista 'Evolucao satisfatoria da lesao - 1 unidade (Via Topica)' como medicamento prescrito.

**Código atual:**

```jsx
          lower.includes('sf') ||
          lower.includes('soro') ||
          lower.includes('mg') ||
          lower.includes('comprimido')
```

**Correção sugerida:** Trocar as substrings por regex com limite de palavra (ex: /\b(sf|mg|comprimido)\b/) e exigir padrão de dosagem numérica.

<details><summary>Verificação feita contra o código</summary>

As linhas 703-706 usam includes('sf'), includes('soro'), includes('mg') e includes('comprimido') sobre a linha inteira em minúsculas; 'satisfatória' contém 'sf', então prosa clínica vira item de prescrição com dosage '1 unidade' e route 'Via Tópica' (710-717). Rebaixo de alto para medio porque o item aparece no formulário editável e o médico ainda precisa clicar em 'Emitir', mas o comportamento é claramente defeituoso.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0282 · MÉDIO · `CONFIRMADO`

**Resposta simulada do copiloto entrega conduta clinica fixa que ignora a pergunta**

**Onde:** `src/components/DoctorDashboard.jsx:766`

**O defeito:** Quando chatWithDoctorCopilot retorna null (Gemini nao configurado, conforme src/services/geminiService.js:509), o componente injeta na conversa uma mensagem que se apresenta como parecer do assistente clinico, com recomendacao terapeutica fixa, sem qualquer aviso de que e um texto simulado e sem relacao com a pergunta feita.

**Como falha:** Sem chave de IA configurada, o medico pergunta 'este paciente tem alergia a prata?' e recebe: 'Atencao, doutor: ... Recomenda-se manter o desbridamento e acompanhamento regular.' A mesma frase e devolvida para qualquer pergunta. Como a bolha e identica as respostas reais da IA, o medico pode tomar a recomendacao de desbridamento como suporte a decisao clinica gerado sobre o caso.

**Código atual:**

```jsx
          text: `Atencao, doutor: analisando o historico desse paciente, notei que ele possui ${selectedPatient.hasDiabetes ? 'Diabetes' : 'nenhuma comorbidade declarada'} e a lesao atual e do tipo ${selectedEntry?.type || 'nao especificada'}. Recomenda-se manter o desbridamento e acompanhamento regular.`
```

**Correção sugerida:** Substituir o fallback por aviso explícito de indisponibilidade do assistente, sem recomendação clínica.

<details><summary>Verificação feita contra o código</summary>

O else da linha 762 injeta na conversa uma bolha 'ai' com texto fixo terminando em 'Recomenda-se manter o desbridamento e acompanhamento regular', idêntica visualmente às respostas reais (mesmo className na linha 3187), sem qualquer rótulo de conteúdo simulado. Sem chave de IA configurada, qualquer pergunta recebe essa mesma recomendação terapêutica.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0283 · MÉDIO · `CONFIRMADO`

**calculateAge exibe 'NaN anos' e usa Math.abs, aceitando datas invalidas e futuras**

**Onde:** `src/components/DoctorDashboard.jsx:783`

**O defeito:** A funcao so trata a string vazia (linha 778). Para uma data invalida, new Date('...') gera Invalid Date, getTime() retorna NaN e Math.abs(NaN - 1970) resulta em NaN, sem lancar excecao, portanto o try/catch nunca protege. Alem disso Math.abs transforma datas futuras em idades positivas e new Date('YYYY-MM-DD') e interpretado em UTC, o que desloca a idade em um dia para quem nasceu em 1 de janeiro no fuso do Brasil.

**Como falha:** Paciente com birth_date gravado como '00/00/0000' ou '31/02/1980' (formato pt-BR salvo em coluna text). No card e no cabecalho do prontuario o medico le 'NaN anos', e o mesmo 'NaN anos' e impresso no campo 'Idade' da receita e do atestado (linha 3433). Se a data for futura ('2030-01-01'), o sistema exibe '4 anos' em vez de sinalizar erro.

**Código atual:**

```jsx
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return `${age} anos`;
```

**Correção sugerida:** Validar isNaN(birth.getTime()) e diff < 0 retornando 'Idade inválida' antes do cálculo.

<details><summary>Verificação feita contra o código</summary>

A função (777-788) só trata string vazia. Para data inválida, new Date(...) não lança: getTime() é NaN, a subtração é NaN e Math.abs(NaN) é NaN, então o try/catch nunca é acionado e o retorno é literalmente 'NaN anos'. Math.abs também converte datas futuras em idade positiva. O valor é impresso no cabeçalho da receita/atestado (linha 3433).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0284 · MÉDIO · `CONFIRMADO`

**Filtro de pacientes quebra com TypeError quando o nome vem nulo do banco**

**Onde:** `src/components/DoctorDashboard.jsx:793`

**O defeito:** p.name.toLowerCase() e chamado sem guarda durante o render. getAllPatients e getAssignedPatients (supabaseService.js:1203 e 1685) mapeiam name: item.name sem fallback (todos os outros campos usam || ''), portanto um registro de clinical_profile com name NULL entrega name undefined. O mesmo acesso desprotegido aparece na linha 1796 (patient.name.split(' ')).

**Como falha:** Um paciente se cadastra e nao preenche o nome (ou um registro e criado por trigger sem nome). Ao abrir o Painel Clinico, o filter da linha 792 lanca 'TypeError: Cannot read properties of undefined (reading toLowerCase)' durante o render. Como nao ha error boundary no App, a tela do medico fica completamente em branco e nenhum paciente pode ser atendido ate que o registro seja corrigido no banco.

**Código atual:**

```jsx
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
```

**Correção sugerida:** Usar (p.name || '').toLowerCase() no filtro e aplicar fallback name: item.name || '' no map de getAllPatients/getAssignedPatients.

<details><summary>Verificação feita contra o código</summary>

Linha 793 chama p.name.toLowerCase() sem guarda durante o render, e a linha 1796 faz patient.name.split(' ') igualmente desprotegido. Verifiquei getAllPatients (supabaseService.js:1200-1224): name: item.name é o único campo sem fallback '||' — todos os vizinhos (birthDate, gender, cpf, etc.) têm. Registro com name NULL derruba o render inteiro e, sem error boundary no App, a tela do médico fica em branco.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0285 · MÉDIO · `CONFIRMADO`

**KPI 'Alertas de Infeccao / Risco' conta pacientes diferentes dos que o filtro exibe**

**Onde:** `src/components/DoctorDashboard.jsx:1713`

**O defeito:** O contador do card conta qualquer paciente com triageAlerts.length > 0, mas o clique aplica filterAlert='infection', cujo predicado (linha 799) exige que algum alerta contenha a substring 'Infeccao' ou 'Critica'. As duas regras nao coincidem.

**Como falha:** O medico tem 4 pacientes com alertas de triagem do tipo 'Dor intensa' ou 'Exsudato aumentado'. O card mostra 'Alertas de Infeccao / Risco: 4'. Ao clicar no card para investigar, a lista exibe 'Nenhum paciente encontrado com os filtros aplicados.' O medico conclui que houve falha do sistema ou que perdeu os pacientes de risco.

**Código atual:**

```jsx
                  {myPatients.filter(p => p.triageAlerts && p.triageAlerts.length > 0).length}
```

**Correção sugerida:** Extrair o predicado de infecção para uma função única usada tanto no contador quanto no filtro.

<details><summary>Verificação feita contra o código</summary>

O contador (1713) usa triageAlerts.length > 0, enquanto o clique aplica filterAlert='infection', cujo predicado (799) exige alert.includes('Infecção') || alert.includes('Crítica'). As regras divergem, então o card pode mostrar N e a lista vir vazia com 'Nenhum paciente encontrado com os filtros aplicados.'

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0286 · MÉDIO · `CONFIRMADO`

**Aba de agenda do painel e codigo inalcancavel: activeTab nunca vale 'my-agenda'**

**Onde:** `src/components/DoctorDashboard.jsx:1756`

**O defeito:** activeTab e inicializado com initialTab || 'my-patients' (linha 54) e o App.jsx passa initialTab="my-patients" nas duas ocorrencias do componente (App.jsx linhas 756 e 924), alem do useEffect da linha 191 forcar setActiveTab(initialTab). O unico setActiveTab interno (linhas 1694 e 1706) tambem grava 'my-patients'. Grep em todo src confirma que a string 'my-agenda' so aparece nas tres comparacoes deste arquivo, nunca em uma atribuicao. Consequencia adicional: listToRender (linha 791) e sempre myPatients, tornando a lista de todos os pacientes inalcancavel, e o prop setActiveTab recebido do App (renomeado setParentActiveTab na linha 43) nunca e usado.

**Como falha:** Nao existe caminho de navegacao que renderize <DoctorAgendaView>. O medico nunca ve o calendario de consultas dentro do Painel Clinico, apesar de todo o estado (doctorAppointments, calendarViewDate, selectedCalendarDateStr, agendaStatusFilter) e do componente estarem carregados e do polling tentar buscar os agendamentos a cada 30s. Todo o bloco das linhas 1757 a 1775 e morto.

**Código atual:**

```jsx
          {activeTab === 'my-agenda' ? (
            <DoctorAgendaView
              doctorAppointments={doctorAppointments}
```

**Correção sugerida:** Adicionar um botão/rota que faça setActiveTab('my-agenda') ou remover o bloco 1756-1775 e o estado de agenda associado.

<details><summary>Verificação feita contra o código</summary>

Grep em src confirma que 'my-agenda' aparece só em três comparações deste arquivo (1689, 1720, 1756), nunca em atribuição; activeTab nasce de initialTab || 'my-patients' (54), o efeito da linha 191 reforça initialTab e App.jsx passa initialTab="my-patients" nas duas ocorrências (756 e 924). Os setActiveTab internos (1694, 1706) só gravam 'my-patients'. Logo <DoctorAgendaView> nunca renderiza e listToRender (791) é sempre myPatients. Rebaixo de alto para medio: é funcionalidade ausente/código morto, sem dado incorreto exibido.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0287 · MÉDIO · `CONFIRMAR-SCHEMA`

**Classes CSS inexistentes deixam o grafico tecidual invisivel e a foto da ferida sem limite**

**Onde:** `src/components/DoctorDashboard.jsx:2159`

**O defeito:** As classes wound-selector-strip, wound-tab, evolution-grid, wound-photo-frame, tissue-chart-box, tissue-bar-row, tissue-label-percent, tissue-track, tissue-fill, notes-compose-box, notes-textarea, pulsing-record e filter-select nao existem em src/index.css nem no bloco <style> interno do componente (linhas 903 a 1309, que define somente doctor-dashboard-wrapper, clinician-header, stats-strip, stat-box, patients-grid, patient-card, detail-*, info-cell, clinical-chat-panel, chat-*, login-tabs e login-tab-btn). Grep em todo o projeto confirma que essas classes so aparecem como uso, nunca como definicao.

**Como falha:** Na aba 'Lesoes & Evolucoes' o bloco 'Composicao Tecidual Computacional' renderiza quatro divs .tissue-fill com width em porcentagem, mas sem height nenhum: as barras tem 0px de altura e o medico nao ve nenhuma barra, apenas os percentuais. A foto da lesao dentro de .wound-photo-frame nao tem max-width e uma imagem de 4000px estoura o layout horizontalmente. Os botoes de selecao de lesao (.wound-tab.active) nao tem estilo de selecionado, portanto nao ha indicacao visual de qual triagem esta aberta. A textarea de evolucao clinica (.notes-textarea) fica com a altura minima padrao (2 linhas).

**Código atual:**

```jsx
                                  <div className="tissue-track">
                                    <div className="tissue-fill" style={{ width: `${selectedEntry.aiTissueAnalysis.granulacao || 0}%`, backgroundColor: 'var(--danger)' }}></div>
                                  </div>
```

**Correção sugerida:** Definir as classes ausentes no bloco <style> do componente (ao menos .tissue-track/.tissue-fill com height, .wound-photo-frame com max-width:100% e .notes-textarea com min-height).

<details><summary>Verificação feita contra o código</summary>

Grep por seletores (\.tissue-fill, \.tissue-track, \.wound-photo-frame, \.notes-textarea, \.wound-tab, \.evolution-grid) em todos os .css do projeto não retorna nenhuma definição, e dentro do próprio DoctorDashboard.jsx essas strings só aparecem como className. Confirmado que as barras das linhas 2160/2169/2178/2187 ficam sem height (invisíveis) — note o contraste com a mesma visualização na comparação (linhas 2610-2621), que funciona por usar estilos inline. A subclaim sobre .filter-select é inócua, pois a linha 1745 já traz estilos inline equivalentes.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0288 · MÉDIO · `CONFIRMAR-SCHEMA`

**Historico de sincronizacao do PEP nao e limpo ao trocar de paciente**

**Onde:** `src/components/DoctorDashboard.jsx:3018`

**O defeito:** syncSuccessTime (linha 114) e global do componente e nunca resetado no efeito de troca de selectedPatient (linhas 227 a 276), embora seja exibido como o historico de sincronizacao do paciente aberto.

**Como falha:** Medico sincroniza o prontuario do paciente A (aparece 'Ultima em: 10/08/2026 as 14:32'), volta para a lista e abre o paciente B, aba 'Integracao PEP'. A tela de B mostra 'Ultima em: 10/08/2026 as 14:32' como se o prontuario de B tambem tivesse sido enviado ao hospital, quando nenhuma sincronizacao de B ocorreu.

**Código atual:**

```jsx
                            {syncSuccessTime ? `Ultima em: ${syncSuccessTime}` : 'Aguardando primeira sincronizacao...'}
```

**Correção sugerida:** Adicionar setSyncSuccessTime(null) ao efeito de troca de selectedPatient.

<details><summary>Verificação feita contra o código</summary>

syncSuccessTime (114) é estado global do componente, exibido na linha 3018 como 'Histórico de Sincronizações' do paciente aberto, e não é resetado no efeito de troca de selectedPatient (227-276). Após sincronizar A, o paciente B exibe a mesma data/hora como se também tivesse sido enviado ao hospital.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0289 · MÉDIO · `CONFIRMADO`

**Botoes de acao apenas com emoji, sem nome acessivel**

**Onde:** `src/components/DoctorDashboard.jsx:3087`

**O defeito:** O botao de exclusao de insumo tem como unico conteudo o emoji de lixeira, sem aria-label, sem title e sem texto alternativo. O botao de fechar do modal de certificado (linha 1355) tambem tem apenas o caractere '✕' sem aria-label.

**Como falha:** Um profissional que usa leitor de tela navega pela lista 'Seus Insumos Indicados para este Paciente'. O leitor anuncia apenas 'botao, cesto de lixo' sem dizer a qual insumo se refere, e no modal de certificado anuncia 'botao, x'. Nao ha como identificar com seguranca qual recomendacao sera excluida (a acao e destrutiva e apenas confirmada por window.confirm generico na linha 652).

**Código atual:**

```jsx
                              <button 
                                onClick={() => handleDeleteMaterial(mat.id)}
                                className="btn" 
...
                                🗑️
                              </button>
```

**Correção sugerida:** Adicionar aria-label={`Remover recomendação ${mat.name}`} ao botão (e aria-label no botão de fechar do modal de certificado).

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 3075-3088: o botão de exclusão tem como único conteúdo o emoji 🗑️, sem aria-label nem title, e a confirmação (652) é um window.confirm genérico que não identifica o insumo. É falha real de nome acessível em ação destrutiva, embora sem impacto clínico direto.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0487 · BAIXO · `CONFIRMAR-SCHEMA`

**Chave irec_doctor_active_tab e escrita mas nunca lida: persistencia de aba nao funciona**

**Onde:** `src/components/DoctorDashboard.jsx:180`

**O defeito:** O componente grava activeTab em irec_doctor_active_tab a cada mudanca e o App.jsx remove essa chave no logout (App.jsx linha 664), mas nenhum ponto do codigo le esse valor - a inicializacao de activeTab usa initialTab || 'my-patients' (linha 54), diferente de selectedSubTab e selectedDocTab, que sao restaurados do localStorage (linhas 83 e 84). Grep em todo o src confirma que so existem a escrita e o removeItem.

**Como falha:** O medico esta na aba interna do painel, recarrega a pagina (F5) e sempre volta para 'my-patients', enquanto a sub-aba do prontuario (por exemplo 'Documentos Clinicos') e restaurada. O comportamento de persistencia de navegacao fica incoerente entre os niveis de aba e o gravador de estado escreve uma chave morta.

**Código atual:**

```jsx
  useEffect(() => {
    localStorage.setItem('irec_doctor_active_tab', activeTab);
  }, [activeTab]);
```

**Correção sugerida:** Inicializar activeTab com initialTab || localStorage.getItem('irec_doctor_active_tab') || 'my-patients', ou remover a escrita.

<details><summary>Verificação feita contra o código</summary>

Grep em todo o src retorna exatamente duas ocorrências: a escrita na linha 180 deste arquivo e o removeItem em App.jsx:664. Nenhuma leitura — activeTab é inicializado com initialTab || 'my-patients' (54), diferente de selectedSubTab e selectedDocTab, que leem localStorage (83 e 84). Chave morta e incoerência de comportamento entre níveis de aba.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0488 · BAIXO · `CONFIRMADO`

**Mensagens do assistente exibem markdown cru para o usuario**

**Onde:** `src/components/DoctorDashboard.jsx:272`

**O defeito:** A mensagem inicial e construida com asteriscos de negrito e o render (linha 3188) coloca msg.text dentro de <p> com whiteSpace pre-wrap, sem interpretar markdown. O prompt enviado a IA (geminiService, linha 568) pede explicitamente resposta 'em markdown formal', portanto todas as respostas tambem chegam com ** e # visiveis.

**Como falha:** Ao abrir qualquer prontuario, o medico le literalmente 'Estou carregado com os dados clinicos e historico do(a) paciente **Maria Silva**.' e, nas respostas da IA, titulos como '### Conduta' e '**Alginato de Calcio**' aparecem com os sinais de pontuacao, poluindo o parecer clinico exibido.

**Código atual:**

```jsx
          text: `Ola, Dr(a). ${docName}! Estou carregado com os dados clinicos e historico do(a) paciente **${patName}**. \n\nComo posso auxilia-lo na conduta de cuidados e escolha de coberturas hoje?` 
```

**Correção sugerida:** Renderizar com um parser de markdown leve ou remover a marcação dos textos gerados/pedidos ao modelo.

<details><summary>Verificação feita contra o código</summary>

A mensagem inicial (272) usa **negrito** e o render (3188) coloca msg.text em <p> com whiteSpace pre-wrap, sem parser de markdown — os asteriscos aparecem literalmente. Defeito cosmético, severidade baixo correta.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0489 · BAIXO · `VERIFICAR`

**Abrir um prontuario rola a pagina automaticamente para o fim (painel de chat)**

**Onde:** `src/components/DoctorDashboard.jsx:280`

**O defeito:** O efeito de scroll do chat depende de chatHistory, que e reinicializado com a mensagem de boas-vindas dentro do efeito de selecao de paciente (linha 269). Como o painel de chat fica no fim da pagina (linha 3177) e scrollIntoView atua no scroll da pagina inteira (a div .chat-body-doctor tem overflow-y auto, mas o elemento alvo esta no fim de todo o container), o navegador rola a janela.

**Como falha:** O medico clica em um paciente na lista. Em vez de ver o topo do prontuario (nome, comorbidades, alergias e alertas clinicos), a pagina salta automaticamente para o fim, no 'Assistente Clinico iRec'. Ele precisa rolar de volta manualmente em cada paciente que abre.

**Código atual:**

```jsx
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);
```

**Correção sugerida:** Rolar apenas o container do chat (chatBodyRef.current.scrollTop = scrollHeight) ou pular o scroll na primeira mensagem de boas-vindas.

<details><summary>Verificação feita contra o código</summary>

O encadeamento existe: o efeito de selectedPatient reinicializa chatHistory (269-274) e o efeito 279-281 chama scrollIntoView no chatEndRef a cada mudança de chatHistory, sem guarda de primeira renderização. Não consegui confirmar a magnitude do salto sem executar o app: .clinical-chat-panel (definido em 1199) é um flex column que pode ficar como coluna lateral, então o deslocamento depende do layout de grid em telas largas. Rebaixo para baixo por ser incômodo de navegação, não erro de dado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0490 · BAIXO · `CONFIRMADO`

**Receita vazia so e detectada depois de o medico assinar com o PIN**

**Onde:** `src/components/DoctorDashboard.jsx:444`

**O defeito:** A validacao de 'pelo menos um medicamento com nome' esta dentro de executeIssueDocument, que so e chamada apos o modal de assinatura ser confirmado (linha 3377). handleIssueDocument (linha 540) abre o modal sem validar nada. Alem disso pendingDocType nao e limpo depois do fluxo.

**Como falha:** O medico clica em 'Emitir e Salvar Receita' com a linha de medicamento em branco. Abre o modal de assinatura ICP-Brasil, ele digita a senha do certificado, clica em 'Assinar Documento', o modal fecha e so entao aparece 'Por favor, adicione pelo menos um medicamento com nome.' Ele digitou a senha do certificado para nada e precisa repetir todo o fluxo.

**Código atual:**

```jsx
        const filledItems = prescriptionItems.filter(item => item.name.trim() !== '');
        if (filledItems.length === 0) {
          alert('Por favor, adicione pelo menos um medicamento com nome.');
```

**Correção sugerida:** Mover a validação de conteúdo para o início de handleIssueDocument, antes de abrir o modal.

<details><summary>Verificação feita contra o código</summary>

A validação de item preenchido está em executeIssueDocument (444-449) e handleIssueDocument (540-555) abre o modal de assinatura sem validar nada; a confirmação do PIN (3375-3377) é quem chama executeIssueDocument. Confirmado também que pendingDocType nunca é limpo. Impacto é apenas retrabalho e digitação desnecessária da senha do certificado — severidade baixo adequada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0491 · BAIXO · `CONFIRMAR-SCHEMA`

**Card de KPI marcado como ativo com filtros que nao selecionou**

**Onde:** `src/components/DoctorDashboard.jsx:1692`

**O defeito:** O destaque visual do primeiro card ('Pacientes sob Meu Acompanhamento', que representa filterAlert='all') e calculado com filterAlert !== 'infection', logo ele permanece com a classe active quando o filtro selecionado no select e 'diabetes' ou 'hypertension'.

**Como falha:** O medico escolhe 'Apenas Diabeticos' no select. O card 'Pacientes sob Meu Acompanhamento' continua realcado com borda e fundo de selecionado, indicando 'Todas as Condicoes', enquanto a lista mostra apenas diabeticos. Indicacao de estado contraditoria: o medico nao sabe qual filtro esta valendo.

**Código atual:**

```jsx
                className={`stat-box interactive ${filterAlert !== 'infection' ? 'active' : ''}`}
```

**Correção sugerida:** Trocar a condição para filterAlert === 'all'.

<details><summary>Verificação feita contra o código</summary>

Linha 1692 confirma className com filterAlert !== 'infection' ? 'active' : '', logo o card 'Pacientes sob Meu Acompanhamento' fica destacado também quando o select está em 'diabetes' ou 'hypertension'. Defeito puramente visual, severidade baixa está correta.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0492 · BAIXO · `CONFIRMAR-SCHEMA`

**onSelectPatient da agenda usa campo app.patientEmail que nao existe no objeto retornado**

**Onde:** `src/components/DoctorDashboard.jsx:1772`

**O defeito:** getDoctorAppointments (src/services/supabaseService.js:1515 a 1532) mapeia id, createdAt, patientId, doctorId, patientName, doctorName, doctorSpecialty, modality, appointmentDate, appointmentTime, notes, address, price, paymentMethod, paymentStatus e status. Nao existe patientEmail. O fallback monta um paciente sintetico apenas com id, name e email=undefined e o injeta em setSelectedPatient, que alimenta toda a tela de prontuario e a impressao de documentos.

**Como falha:** Ao clicar em uma consulta cujo paciente nao esta na lista carregada, abre-se o prontuario com 'E-mail: ' vazio, 'Idade nao informada ()', CPF/RG/CNS/endereco todos 'Nao cadastrado' e nenhuma comorbidade, mesmo que o paciente tenha ficha completa - porque o objeto sintetico nao tem esses campos. Se o medico emitir uma receita nesse estado, o cabecalho impresso sai com 'Genero: ' em branco.

**Código atual:**

```jsx
                  setSelectedPatient({ id: app.patientId, name: app.patientName, email: app.patientEmail });
```

**Correção sugerida:** Buscar o perfil completo com getPatientById(app.patientId) em vez de montar um paciente sintético (corrigir também DoctorAgendaPage.jsx:114).

<details><summary>Verificação feita contra o código</summary>

O map de getDoctorAppointments (supabaseService.js:1515-1532) realmente não expõe patientEmail, e o objeto sintético da linha 1772 só tem id, name e email, alimentando toda a tela de prontuário e a impressão. Ressalvas que reduzem a severidade: no fallback local o objeto vem de BookingModal.jsx:61, que grava patientEmail; e esta linha está dentro do bloco 'my-agenda', inalcançável (item 188). O mesmo defeito, esse sim vivo, está em src/components/doctor/DoctorAgendaPage.jsx:114.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0493 · BAIXO · `CONFIRMADO`

**Barra de necrose com cor fixa #111 fica invisivel no tema escuro**

**Onde:** `src/components/DoctorDashboard.jsx:2612`

**O defeito:** As barras de composicao tecidual usam cores literais ('#111' para necrose, 'gold', 'pink') sobre trilhas cujo fundo e var(--bg-primary), que no tema escuro e praticamente preto. O mesmo valor fixo aparece na linha 2178 na visao de detalhe da lesao.

**Como falha:** No tema escuro, ao comparar duas fotos na 'Galeria Evolutiva', a barra de 'Necrose' (preto #111) sobre a trilha var(--bg-primary) escura nao e visivel: o medico ve o rotulo 'Necrose 45%' sem nenhuma barra, e nao consegue comparar visualmente a carga de tecido inviavel entre as duas datas, que e justamente o objetivo da tela.

**Código atual:**

```jsx
                                        ['Necrose', entry.aiTissueAnalysis.necrose || 0, '#111'],
```

**Correção sugerida:** Trocar '#111' por uma cor com contraste garantido nos dois temas (ex.: var(--text-primary) ou #4b5563).

<details><summary>Verificação feita contra o código</summary>

Linhas 2610-2620: as cores são literais ('gold', '#111', 'pink') e a trilha usa backgroundColor 'var(--bg-primary)' (linha 2619), que no tema escuro é quase preta — a barra de necrose fica indistinguível do fundo. O mesmo '#111' aparece na linha 2178. Severidade baixo adequada: o percentual numérico continua legível ao lado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0494 · BAIXO · `CONFIRMADO`

**Receita usa key={index} em lista mutavel de medicamentos**

**Onde:** `src/components/DoctorDashboard.jsx:2684`

**O defeito:** A lista de prescriptionItems permite adicionar (linha 557) e remover itens do meio (linha 561), mas a key e o indice. Ao remover um item intermediario, o React reaproveita os nos DOM e associa cada input a um medicamento diferente do que o usuario estava editando.

**Como falha:** O medico cadastra 3 medicamentos, coloca o cursor no campo 'Instrucoes de Uso' do terceiro item e, sem sair dele, clica na lixeira do primeiro item. Apos a remocao, o foco continua no mesmo no DOM, que agora pertence ao segundo medicamento restante; o que o medico digitar em seguida vai para as instrucoes do medicamento errado.

**Código atual:**

```jsx
                        {prescriptionItems.map((item, index) => (
                          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr auto', ...
```

**Correção sugerida:** Atribuir um id estável a cada item na criação e usar key={item.id}.

<details><summary>Verificação feita contra o código</summary>

Linha 2684 confirma key={index} com adição (557) e remoção do meio (561). O anti-padrão existe. Mas o cenário descrito é mais brando do que o relatado: como os inputs são controlados pelo estado, os valores exibidos se corrigem no re-render — o usuário vê o campo mudar de conteúdo; a única consequência real é o foco permanecer num nó DOM que agora pertence a outro medicamento. Rebaixo de medio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0495 · BAIXO · `CONFIRMADO`

**Separador das sugestoes de CID usa o tamanho da lista completa em vez da filtrada**

**Onde:** `src/components/DoctorDashboard.jsx:2859`

**O defeito:** A condicao de borda inferior compara o indice do item filtrado com COMMON_CID10.length - 1 (16 itens), quando o array renderizado e o resultado do filter. O indice do ultimo item filtrado quase nunca coincide com 15.

**Como falha:** O medico digita 'diabetes' no campo CID-10. O dropdown mostra 2 sugestoes e a ultima delas continua com uma linha divisoria embaixo, como se houvesse mais itens abaixo, sugerindo que a lista pode ser rolada quando nao pode.

**Código atual:**

```jsx
                                      borderBottom: idx < COMMON_CID10.length - 1 ? '1px solid var(--border-color)' : 'none',
```

**Correção sugerida:** Extrair o array filtrado para uma const e comparar idx com filtrados.length - 1.

<details><summary>Verificação feita contra o código</summary>

Linha 2859 compara idx (índice dentro do array já filtrado nas linhas 2842-2846) com COMMON_CID10.length - 1, que é fixo em 15. Com poucos resultados, o último item mantém a borda inferior. Defeito puramente cosmético.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "DoctorDashboard.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
