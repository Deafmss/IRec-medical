# 13. Perfil do usuário

**28 defeitos** — 1 crítico · 6 alto · 12 médio · 9 baixo

Arquivos tocados por este módulo:

- `src/components/UserProfileModal.jsx`
- `src/components/UserProfilePage.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0030 · CRÍTICO · `CONFIRMAR-SCHEMA`

**Salvamento do perfil sempre reporta sucesso, mesmo quando o UPDATE no Supabase falha (perda silenciosa de dados clínicos)**

**Onde:** `src/components/UserProfileModal.jsx:289`

**O defeito:** O modal decide sucesso/erro pelo valor de retorno de updateClinicalProfile ('if (result)'), mas essa função em src/services/supabaseService.js NUNCA retorna valor falsy após resolver o userId: no caminho de sucesso retorna 'profile' (linha 741) e no bloco catch também retorna 'profile' (linha 754). Assim, qualquer falha real (bloqueio de RLS, coluna inexistente, rede caída, 4xx do PostgREST) cai no catch, é apenas logada no console e o modal exibe 'Perfil atualizado com sucesso!'. O ramo 'else setErrorMsg(...)' da linha 296-298 é praticamente inalcançável (código morto). Pior: onProfileUpdate(result) atualiza o estado do App com os dados não persistidos, então a tela passa a mostrar valores que não existem no banco.

**Como falha:** Paciente entra em Perfil, corrige 'Alergias Conhecidas' para 'Alergia a Iodo' e clica em Salvar. A policy de RLS de clinical_profile rejeita o UPDATE. O usuário vê o banner verde 'Perfil atualizado com sucesso!', o modal fecha em 1,2 s e a alergia aparece na tela. Em outro dispositivo (ou após limpar o cache local) a alergia não existe — o profissional que atender esse paciente lerá o prontuário sem a alergia.

**Código atual:**

```jsx
UserProfileModal.jsx:289-298
      const result = await updateClinicalProfile(currentUser.id, updatedProfile);
      if (result) {
        onProfileUpdate(result);
        setSuccessMsg('Perfil atualizado com sucesso!');
        setTimeout(() => { onClose(); }, 1200);
      } else {
        setErrorMsg('Erro ao atualizar perfil.');
      }

supabaseService.js:742-755
  } catch (err) {
    console.error('Erro ao atualizar perfil no Supabase:', err);
    saveLocalProfile(userId, profile);
    ...
    return profile;
  }
```

**Correção sugerida:** Fazer updateClinicalProfile retornar null (ou relançar o erro) no bloco catch e tratar esse caso no modal exibindo erro real de sincronização.

<details><summary>Verificação feita contra o código</summary>

Verifiquei supabaseService.js:719-755: o caminho de sucesso retorna `profile` (linha 741) e o catch, após logar e chamar saveLocalProfile, também retorna `profile` (linha 754). O único retorno falsy é `return null` na linha 656, antes de qualquer tentativa de UPDATE. Portanto `if (result)` em UserProfileModal.jsx:290 é sempre verdadeiro quando há userId, o ramo `else setErrorMsg('Erro ao atualizar perfil.')` é código morto e o usuário vê banner verde mesmo com erro de RLS/rede/coluna. onProfileUpdate(result) ainda propaga ao App dados não persistidos no servidor.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0154 · ALTO · `CONFIRMAR-SCHEMA`

**Unidade da altura divergente: perfil grava metros e o Dashboard do paciente divide por 100, exibindo IMC absurdo**

**Onde:** `src/components/UserProfileModal.jsx:160`

**O defeito:** O formulário pede altura em METROS (label 'Altura (m)', step 0.01, placeholder 'Ex: 1.75') e calcula bmi = w / (h*h) sem nenhuma conversão nem validação de faixa. Já src/components/Dashboard.jsx trata o mesmo campo como CENTÍMETROS: exibe '${clinicalProfile.height} cm' (linha 775) e calcula 'const hM = parseFloat(clinicalProfile.height) / 100' (linha 783). DoctorDashboard.jsx:1941 usa metros ('wVal / (hVal * hVal)'), concordando com o modal. Ou seja: o mesmo valor gera um IMC correto no perfil e no prontuário do médico, e um IMC completamente errado na tela do paciente. Também não há validação que impeça o paciente de digitar 175 (cm), o que inverte o erro e faz o perfil calcular IMC ~0,002, marcando 'Abaixo do peso (Desnutrição)' e isObese=false.

**Como falha:** Paciente com 75 kg digita 1.75 no campo 'Altura (m)'. O modal mostra corretamente 'IMC 24,5 – Peso Saudável'. Ao voltar ao Dashboard, a mesma pessoa vê 'Altura Tecnológica: 1.75 cm' e 'IMC: 244897,9 (Obesidade)'. Se, guiado por essa tela, ele voltar ao perfil e digitar 175, o perfil passa a mostrar 'IMC 0,0 – Abaixo do peso (Desnutrição)' e grava nutritionalStatus='Desnutrição' e isObese=false no prontuário.

**Código atual:**

```jsx
UserProfileModal.jsx:159-161
  const w = parseFloat(formData.weight);
  const h = parseFloat(formData.height);
  const bmi = (w && h) ? (w / (h * h)) : null;

Dashboard.jsx:783-784
                        const hM = parseFloat(clinicalProfile.height) / 100;
                        const imcVal = parseFloat(clinicalProfile.weight) / (hM * hM);
```

**Correção sugerida:** Padronizar a unidade de height com validação de faixa e corrigir Dashboard.jsx:775/783 para usá-la sem a divisão por 100.

<details><summary>Verificação feita contra o código</summary>

UserProfileModal.jsx:159-161 calcula `bmi = w / (h*h)` sem conversão (altura em metros, label 'Altura (m)') e não há validação de faixa. Dashboard.jsx:775 exibe `${clinicalProfile.height} cm` e Dashboard.jsx:783-784 faz `parseFloat(height) / 100` antes do cálculo, tratando o mesmo campo como centímetros. O mesmo valor persistido produz IMC correto no modal e IMC absurdo na tela do paciente; e digitar 175 (cm) faz o modal calcular IMC ~0,002 e gravar nutritionalStatus='Desnutrição' e isObese=false.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0155 · ALTO · `CONFIRMADO`

**Flag clínica isObese é sobrescrita automaticamente pelo IMC, apagando comorbidade registrada por profissional**

**Onde:** `src/components/UserProfileModal.jsx:276`

**O defeito:** Não existe checkbox de 'Obesidade' na grade de comorbidades (linhas 1018-1080 só têm diabetes, HAS, insuficiência venosa, DAP, tabagismo e amputação), e a linha 276 recalcula isObese a partir do IMC sempre que peso e altura estiverem preenchidos, descartando o valor anterior. Esse campo é consumido como comorbidade em vários pontos: prompt da IA (src/services/geminiService.js:240 '- Obesidade: ${profile.isObese ? ...}'), badge do prontuário (src/components/DoctorDashboard.jsx:2010), ProtocolGuide.jsx:659, Dashboard.jsx:818 e relatórios administrativos (AdminReports.jsx:36). Como o campo é derivado sem aviso, o paciente não tem como manter nem corrigir o dado.

**Como falha:** O médico marca o paciente como obeso (is_obese=true) na avaliação clínica. Depois o próprio paciente abre Perfil > Ficha de Saúde apenas para atualizar 'Medicamentos em Uso', com peso 78 e altura 1,75 já gravados (IMC 25,5). Ao salvar, isObese vira false: o badge 'Obeso' desaparece do prontuário, o relatório de obesidade do admin perde o caso e o prompt enviado à IA passa a informar 'Obesidade: Não'.

**Código atual:**

```jsx
UserProfileModal.jsx:276
        isObese: (bmi !== null) ? (bmi >= 30) : (formData.isObese || false),

geminiService.js:240
- Obesidade: ${profile.isObese ? 'Sim' : 'Não'}
```

**Correção sugerida:** Adicionar checkbox de Obesidade na grade e usar o IMC apenas como sugestão, sem sobrescrever isObese quando já houver valor registrado.

<details><summary>Verificação feita contra o código</summary>

Li a grade de comorbidades completa (linhas 1018-1080): existem apenas Diabetes, Hipertensão, Insuficiência Venosa, DAP, Tabagismo e Histórico de Amputação — não há checkbox de Obesidade. A linha 276 `isObese: (bmi !== null) ? (bmi >= 30) : (formData.isObese || false)` descarta o valor anterior sempre que peso e altura estiverem preenchidos, e o payload grava is_obese (supabaseService.js:682). O usuário não tem nenhum controle na UI para preservar ou corrigir a flag registrada pelo profissional.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0156 · ALTO · `CONFIRMADO`

**Enfermeiro (role 'nurse') recebe o formulário de PACIENTE e não consegue editar dados profissionais**

**Onde:** `src/components/UserProfileModal.jsx:410`

**O defeito:** A bifurcação do formulário usa apenas 'currentUser.role === "doctor"'. O papel 'nurse' existe e é tratado como clínico em todo o App (src/App.jsx:481, 708, 727, 737: 'currentUser.role === "doctor" || currentUser.role === "nurse"'), mas aqui cai no ramo 'else', que é a ficha do paciente (abas Dados Pessoais / Endereço / Ficha de Saúde). Consequências: o enfermeiro não tem campo de COREN, especialidade, RQE, biografia, formação nem endereço da clínica; e ao salvar, o objeto enviado grava na linha dele campos de prontuário de paciente (peso, altura, comorbidades, tipo sanguíneo, mobilidade). A legenda da foto (linha 405) também mostra 'Prontuário do Paciente' para o enfermeiro.

**Como falha:** Enfermeira estomaterapeuta faz login (role 'nurse'), abre Perfil para cadastrar o COREN e a especialidade exigidos para aparecer no diretório/NursesNetwork. Ela só vê abas de paciente com CPF, peso, altura e comorbidades. Não existe caminho na UI para preencher COREN/especialidade; ao salvar, a linha dela recebe has_diabetes=false, weight=null, mobility=null etc.

**Código atual:**

```jsx
UserProfileModal.jsx:405,410
  {currentUser.role === 'doctor' ? 'Perfil Médico' : 'Prontuário do Paciente'}
  ...
  {currentUser.role === 'doctor' ? (
    <div className="form-grid">  {/* campos CRM/COREN, especialidade, RQE, bio */}

App.jsx:708
      const isClinician = currentUser.role === 'doctor' || currentUser.role === 'nurse';
```

**Correção sugerida:** Trocar a condição por `['doctor','nurse'].includes(currentUser.role)` nas linhas 405 e 410, rotulando o registro como CRM ou COREN conforme o papel.

<details><summary>Verificação feita contra o código</summary>

Linhas 405 e 410 usam exclusivamente `currentUser.role === 'doctor'`; não há menção a 'nurse' em nenhuma das duas expressões. O papel 'nurse' existe e é tratado como clínico no App (isClinician = doctor || nurse). Logo o enfermeiro cai no ramo else (abas Dados Pessoais/Endereço/Ficha de Saúde), sem CRM/COREN, especialidade, RQE, bio ou formação, e vê a legenda 'Prontuário do Paciente'. Além disso o payload de handleSubmit (linhas 263-277) envia weight/height/comorbidades para a linha dele. Observação: a validação obrigatória de CPF/cidade/estado (linha 222) só vale para role 'patient', então o enfermeiro consegue salvar mesmo assim.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0157 · ALTO · `CONFIRMADO`

**Perfil profissional permite salvar CRM/COREN vazio e o gerador de receita usa registro fabricado '123456-SP'**

**Onde:** `src/components/UserProfileModal.jsx:438`

**O defeito:** O campo 'CRM / COREN' não tem required nem qualquer validação em handleSubmit (a única validação existente, linhas 222-234, é de CPF/cidade/estado e só para role 'patient'). Um profissional pode salvar o perfil com crm='' e o app grava crm: null (supabaseService.js:689). A jusante, src/components/PrescriptionGeneratorModal.jsx:18 faz fallback para um número de registro INVENTADO quando o campo está vazio: 'const registryNumber = currentUser?.crm || currentUser?.coren || "123456-SP"'. Ou seja, a ausência de validação no perfil resulta em documento assistencial com registro profissional fabricado. Observação: o campo 'coren' usado no fallback nem é gerado por este formulário (só existe 'crm'), portanto o fallback fabricado é sempre o alcançado.

**Como falha:** Médico recém-cadastrado abre Perfil, preenche nome/telefone/especialidade, deixa 'CRM / COREN' em branco e salva (nenhum erro é exibido). Em seguida emite uma receita pelo PrescriptionGeneratorModal: o documento sai assinado com o registro '123456-SP', que não pertence a ele.

**Código atual:**

```jsx
UserProfileModal.jsx:436-444
                  <label>CRM / COREN</label>
                  <input type="text" className="form-control" placeholder="Ex: CRM/SP 123456" value={formData.crm} onChange={e => setFormData(prev => ({ ...prev, crm: e.target.value }))} />

PrescriptionGeneratorModal.jsx:18
  const registryNumber = currentUser?.crm || currentUser?.coren || '123456-SP';
```

**Correção sugerida:** Tornar CRM/COREN obrigatório para doctor/nurse no handleSubmit e bloquear a emissão de documentos quando o registro estiver ausente, em vez do fallback '123456-SP'.

<details><summary>Verificação feita contra o código</summary>

O input de CRM/COREN (linhas 438-444) não tem `required` e handleSubmit só valida CPF/cidade/estado para role 'patient' (linhas 222-234), então o profissional salva com crm='' e o serviço grava `crm: profile.crm || null` (supabaseService.js:689). Confirmei por grep que PrescriptionGeneratorModal.jsx:18 é `const registryNumber = currentUser?.crm || currentUser?.coren || '123456-SP'` e que esse valor é impresso no documento (linhas 112, 365 e 439). Como o formulário não gera o campo 'coren', o fallback fabricado é o efetivamente alcançado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0158 · ALTO · `CONFIRMADO`

**Exportação LGPD entrega arquivo sem nenhum registro clínico quando o Supabase está configurado**

**Onde:** `src/components/UserProfilePage.jsx:84`

**O defeito:** O botão 'Exportar Meus Dados de Saúde' monta 'localEntries' lendo somente localStorage na chave irec_entries_<id>. Essa chave só é escrita pelo modo de contingência local (supabaseService.js:76-78 saveLocalEntries, chamado em 956 e 1089); no fluxo normal com Supabase configurado, getWoundEntries busca da tabela wound_entries e NÃO faz cache local (linhas 857-898; getLocalEntries só é usado no fallback de erro, linhas 854 e 901). Resultado: o JSON exportado sai com localEntries: [] e, ainda assim, o alert afirma que os 'dados clínicos' foram baixados e o texto acima promete 'cópia completa dos seus dados de saúde' (Art. 18 da LGPD). Nenhuma evolução de ferida, foto, medida de área ou recomendação é exportada.

**Como falha:** Paciente com 14 registros de evolução de ferida no Supabase clica em 'Exportar Meus Dados de Saúde (.JSON)'. Baixa um arquivo com o perfil e "localEntries": [], recebe o alerta '📥 Exportação LGPD concluída com sucesso!' e acredita ter recebido o histórico completo. O direito de portabilidade não foi atendido.

**Código atual:**

```jsx
UserProfilePage.jsx:84
                localEntries: JSON.parse(localStorage.getItem(`irec_entries_${currentUser?.id}`) || '[]')

UserProfilePage.jsx:93
              alert("📥 Exportação LGPD concluída com sucesso! Seu arquivo de dados clínicos foi baixado.");

supabaseService.js:857-864 (caminho normal, sem gravar em localStorage)
    const { data, error } = await supabase.from('wound_entries').select('*, wound_entry_attachments(*)')...
```

**Correção sugerida:** Tornar o handler assíncrono e montar o export a partir de getWoundEntries/getClinicalProfile, com fallback ao localStorage apenas em modo offline.

<details><summary>Verificação feita contra o código</summary>

Li o arquivo inteiro (137 linhas): o único conteúdo clínico do JSON é `localEntries: JSON.parse(localStorage.getItem('irec_entries_'+id) || '[]')`, e não há import nem chamada de getWoundEntries ou de qualquer serviço. Com Supabase configurado o caminho normal de getWoundEntries lê wound_entries sem popular essa chave, então o arquivo sai com localEntries: [] enquanto o alert da linha 93 afirma que os 'dados clínicos' foram baixados e o texto da linha 74 promete 'cópia completa dos seus dados de saúde'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0159 · ALTO · `CONFIRMADO`

**Botão 'Solicitar Exclusão de Conta (LGPD)' não faz nada e afirma falsamente que registrou a solicitação em auditoria**

**Onde:** `src/components/UserProfilePage.jsx:113`

**O defeito:** O handler apenas mostra window.confirm e, ao confirmar, exibe um alert dizendo 'Solicitação de exclusão registrada com sucesso em auditoria. Nossa equipe entrará em contato em até 48 horas.'. Não há nenhuma chamada a serviço, nenhuma escrita no Supabase, nenhuma chamada a createAuditLog (nem a de supabaseService.js:333 nem a de auditLogger.js:8) e nenhum envio de e-mail. A solicitação é descartada e o usuário recebe confirmação falsa de um direito previsto na LGPD.

**Como falha:** Paciente decide revogar o consentimento, clica em 'Solicitar Exclusão de Conta (LGPD)', confirma e lê que a solicitação foi 'registrada com sucesso em auditoria'. Nenhum operador da plataforma jamais recebe o pedido; o prazo de 48 h prometido nunca é cumprido porque não existe registro algum.

**Código atual:**

```jsx
UserProfilePage.jsx:114-118
            onClick={() => {
              if (window.confirm("⚠️ Tem certeza de que deseja solicitar a exclusão de sua conta? ...")) {
                alert("📩 Solicitação de exclusão registrada com sucesso em auditoria. Nossa equipe entrará em contato em até 48 horas.");
              }
            }}
```

**Correção sugerida:** Persistir a solicitação (tabela de pedidos LGPD ou fila) e registrar auditoria antes de exibir a confirmação; enquanto não existir backend, trocar o texto por instrução de contato real.

<details><summary>Verificação feita contra o código</summary>

O handler das linhas 114-118 contém apenas window.confirm seguido de alert('Solicitação de exclusão registrada com sucesso em auditoria...'). O arquivo inteiro importa somente React e UserProfileModal — não há chamada a createAuditLog (nem a de supabaseService nem a de auditLogger), nenhuma escrita no Supabase e nenhum envio de mensagem. A confirmação exibida ao titular é falsa.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0364 · MÉDIO · `CONFIRMADO`

**formData nunca ressincroniza com o prop currentUser: salvar o perfil sobrescreve dados atualizados por outro profissional**

**Onde:** `src/components/UserProfileModal.jsx:79`

**O defeito:** formData é inicializado uma única vez no useState (linhas 79-125) e não existe nenhum useEffect que reaja a mudanças do prop currentUser. Como handleSubmit monta o payload com '...currentUser' + formData, todo o snapshot antigo é reenviado. Isso se agrava porque (a) a UserProfilePage passa currentUser, e não clinicalProfile, sendo que o polling de 30 s do App atualiza apenas clinicalProfile (App.jsx:694-697 setClinicalProfile, sem setCurrentUser) e (b) o resolveAuth do App só aceita o primeiro resultado ('if (resolved) return;' em App.jsx:459), de modo que o perfil restaurado do cache localStorage 'irec_active_user' permanece como currentUser durante toda a sessão, mesmo depois de a busca fresca no Supabase terminar. A tela de Perfil, portanto, edita uma cópia potencialmente defasada e a reescreve por cima da versão nova (last-write-wins silencioso).

**Como falha:** Paciente deixa a tela Perfil aberta. Nesse intervalo a enfermeira registra 'Alergia a Neomicina' e liga hasVenousInsufficiency no prontuário dele. O Dashboard do paciente (que usa clinicalProfile, atualizado pelo polling) já mostra a alergia nova. O paciente então só corrige o número da casa no endereço e clica em Salvar: o payload leva allergies e hasVenousInsufficiency do snapshot antigo e apaga as duas informações inseridas pela enfermeira.

**Código atual:**

```jsx
UserProfileModal.jsx:79-80
  const [formData, setFormData] = useState({
    name: currentUser.name || '',

UserProfileModal.jsx:238-239
      const updatedProfile = {
        ...currentUser,

App.jsx:458-460
    const resolveAuth = (userProfile) => {
      if (resolved) return;
      resolved = true;
```

**Correção sugerida:** Adicionar um useEffect que reinicialize formData quando currentUser.id/updatedAt mudar, ou enviar no update apenas os campos efetivamente alterados.

<details><summary>Verificação feita contra o código</summary>

Grep por 'useEffect' em UserProfileModal.jsx não retorna nenhuma ocorrência: formData é inicializado só no useState (linhas 79-125) e nunca reage a mudanças do prop. handleSubmit monta o payload com `...currentUser` mais todos os campos de formData (linhas 238-283), reenviando o snapshot da montagem — inclusive allergies, medications e as flags de comorbidade. Qualquer atualização feita em paralelo por outro profissional é sobrescrita em last-write-wins silencioso ao salvar.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0365 · MÉDIO · `CONFIRMADO`

**Salvar o perfil reverte o 'Modo Fácil' escolhido depois da abertura da tela (uiMode capturado na montagem)**

**Onde:** `src/components/UserProfileModal.jsx:124`

**O defeito:** formData.uiMode é lido de localStorage uma única vez, na montagem (linha 124), e reescrito no localStorage no submit (linhas 285-287). O modal não tem nenhum controle de interface para alterar uiMode, portanto ele só serve para reescrever um valor possivelmente obsoleto. O botão de alternância fica no header do App e continua clicável com a página de Perfil montada (App.jsx:1451-1472 toggleUiMode → setUiMode + localStorage.setItem). Como o modal/página nunca é remontado nessa troca, o submit grava o valor velho e desfaz a preferência de acessibilidade.

**Como falha:** Paciente idoso está na aba Perfil, clica no botão '👁️ Padrão' do header para ativar o Modo Fácil (localStorage passa a 'accessible'), volta ao formulário e clica em 'Salvar Alterações'. O modal regrava localStorage.irec_ui_mode='standard'. Ao recarregar o app (ou reabrir o PWA), a interface acessível foi perdida e ele precisa reativar tudo de novo.

**Código atual:**

```jsx
UserProfileModal.jsx:124
    uiMode: localStorage.getItem('irec_ui_mode') || currentUser.uiMode || 'standard'

UserProfileModal.jsx:285-287
      if (formData.uiMode) {
        localStorage.setItem('irec_ui_mode', formData.uiMode);
      }

App.jsx:92-96
  const toggleUiMode = () => { const nextMode = ...; setUiMode(nextMode); localStorage.setItem('irec_ui_mode', nextMode); };
```

**Correção sugerida:** Remover a regravação de irec_ui_mode no submit, ou ler o valor atual do localStorage no momento do submit em vez do snapshot.

<details><summary>Verificação feita contra o código</summary>

Grep de 'uiMode' mostra que no modal só existem 4 usos: leitura no useState (124), envio no payload (282) e regravação no submit (285-286) — nenhum controle de UI. No App, o toggle (linhas 93-95) faz setUiMode + localStorage.setItem e o botão fica no header (linha 1470), disponível enquanto a página de Perfil está montada. Como o modal não é remontado nessa troca, o submit regrava o valor capturado na montagem e desfaz a preferência persistida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0366 · MÉDIO · `CONFIRMAR-SCHEMA`

**Preferência de acessibilidade é global (não por usuário) e não é limpa no logout: vaza entre contas e é gravada no perfil errado**

**Onde:** `src/components/UserProfileModal.jsx:124`

**O defeito:** A chave irec_ui_mode não tem o id do usuário no nome e o handleLogout do App não a remove (App.jsx:660-667 remove irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab — irec_ui_mode fica). O modal lê essa chave global e a prioriza acima de currentUser.uiMode (linha 124), além de persistir o valor no objeto de perfil enviado ao serviço (linha 282). Em dispositivo compartilhado (posto de saúde, tablet de enfermaria) a preferência de um paciente contamina o próximo.

**Como falha:** Paciente A ativa o Modo Fácil e faz logout no tablet da unidade. Paciente B faz login: o app já entra em modo acessível e, quando B abre Perfil e clica em Salvar, o registro de B passa a carregar uiMode='accessible' herdado de A, sem que B tenha escolhido nada.

**Código atual:**

```jsx
UserProfileModal.jsx:124 e 282
    uiMode: localStorage.getItem('irec_ui_mode') || currentUser.uiMode || 'standard'
...
        uiMode: formData.uiMode

App.jsx:660-667 (logout não remove irec_ui_mode)
    localStorage.removeItem('irec_active_user');
    localStorage.removeItem('irec_active_tab');
    ...
```

**Correção sugerida:** Namespacear a chave por usuário (irec_ui_mode_<id>) e removê-la no handleLogout do App.

<details><summary>Verificação feita contra o código</summary>

O grep de 'irec_ui_mode' em todo o src retorna apenas leituras/escritas (App.jsx:90/95 e UserProfileModal.jsx:124/286) — nenhum removeItem em lugar algum, confirmando que o logout não limpa a chave. A chave não tem o id do usuário e a linha 124 a prioriza sobre currentUser.uiMode, enquanto a linha 282 persiste o valor no perfil enviado ao serviço. Em dispositivo compartilhado a preferência de um usuário contamina o próximo e acaba gravada no registro dele.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0367 · MÉDIO · `CONFIRMADO`

**Race na busca automática de CEP grava endereço de um CEP anterior**

**Onde:** `src/components/UserProfileModal.jsx:136`

**O defeito:** handleCepChange dispara um fetch ao ViaCEP a cada vez que o valor limpo atinge 8 dígitos, sem AbortController, sem guardar um id de requisição e sem verificar se o CEP da resposta ainda é o CEP do campo. Duas requisições podem retornar fora de ordem e a última a chegar sobrescreve street/neighborhood/city/state. Como o endereço do paciente alimenta a localização de emergência/SOS (mensagem de validação da linha 230), o dado errado tem impacto assistencial. Além disso o setFormData pode ocorrer após o desmonte do modal (usuário fecha antes da resposta).

**Como falha:** Paciente digita '01310100', percebe que errou, apaga e digita '20040002'. As duas chamadas ao ViaCEP já saíram; a resposta do primeiro CEP chega depois da do segundo. O formulário fica com cep='20040002' (Rio) e rua/bairro/cidade/UF de São Paulo, e é isso que vai para o banco ao salvar.

**Código atual:**

```jsx
UserProfileModal.jsx:139-151
    if (value.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({ ...prev, street: data.logradouro || '', neighborhood: data.bairro || '', city: data.localidade || '', state: data.uf || '' }));
```

**Correção sugerida:** Guardar o CEP consultado (ou usar AbortController) e só aplicar a resposta se o valor ainda for o mesmo do campo.

<details><summary>Verificação feita contra o código</summary>

handleCepChange (linhas 136-156) dispara fetch sempre que o valor limpo tem 8 dígitos, sem AbortController, sem token de requisição e sem comparar o CEP da resposta com o valor atual do campo — o setFormData das linhas 144-150 aplica cegamente o que chegar por último. Como não há useEffect no componente, também não existe cleanup: a resposta pode chegar após o desmonte. O impacto no SOS depende do consumo do endereço em outra tela, mas o defeito de concorrência em si é claro no código.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0368 · MÉDIO · `CONFIRMADO`

**Erro de validação aparece fora da área visível e sem levar o usuário ao campo inválido**

**Onde:** `src/components/UserProfileModal.jsx:222`

**O defeito:** As validações de paciente (CPF com 11 dígitos, cidade e estado) só rodam no submit e reportam via setErrorMsg. O banner de erro é renderizado no topo do container .profile-modal-content, que tem max-height 60vh e overflow-y auto (CSS nas linhas 1183-1187), e não há scroll programático, foco no campo nem troca automática para a aba que contém o campo inválido (CPF está na aba 'pessoais'; cidade/estado na aba 'endereco'). Para quem clicou em Salvar no fim da aba 'Ficha de Saúde', o botão só pisca 'Salvando...' e volta, sem nenhuma pista visível do motivo.

**Como falha:** Paciente sem CPF cadastrado preenche a Ficha de Saúde, rola até o fim e clica em 'Salvar Alterações'. Nada aparece na tela (o banner ficou acima, fora do scroll) e o perfil não é salvo. Ele repete a operação várias vezes achando que o app travou.

**Código atual:**

```jsx
UserProfileModal.jsx:224-227
      if (!cleanCpf || cleanCpf.length !== 11) {
        setErrorMsg('O CPF é obrigatório e deve conter 11 dígitos para confirmação de identidade.');
        setSaving(false);
        return;

UserProfileModal.jsx:1183-1187
          .profile-modal-content {
            padding: 20px 24px;
            overflow-y: auto;
            max-height: 60vh;
          }
```

**Correção sugerida:** Ao falhar a validação, trocar para a aba do campo inválido, focá-lo e rolar o banner de erro para a viewport.

<details><summary>Verificação feita contra o código</summary>

As validações (224-233) apenas chamam setErrorMsg e retornam; o banner é renderizado no topo de .profile-modal-content (linhas 374-378), container com `overflow-y: auto` e `max-height: 60vh` (CSS 1183-1187). Não há scrollIntoView, foco no campo nem troca automática de aba — o CPF está na aba 'pessoais' e cidade/estado na aba 'endereco', então quem salva a partir da 'Ficha de Saúde' não recebe nenhuma pista visível.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0369 · MÉDIO · `CONFIRMAR-SCHEMA`

**Status nutricional derivado grava 'Bem nutrido' para IMC de sobrepeso, contradizendo o badge exibido**

**Onde:** `src/components/UserProfileModal.jsx:267`

**O defeito:** A derivação automática do status nutricional usa apenas três faixas (<18,5 / <30 / resto), então todo IMC entre 25,0 e 29,9 é gravado como 'Bem nutrido'. Isso contradiz (a) o próprio badge que o usuário acabou de ver na tela, calculado por getBmiCategory (linha 167 devolve 'Sobrepeso' para value < 30) e (b) a opção 'Sobrepeso' que existe no select de Status Nutricional (linha 969). O valor derivado é persistido em nutritional_status (supabaseService.js:709) e usado no prontuário/relatórios como dado clínico.

**Como falha:** Paciente com 85 kg e 1,72 m (IMC 28,7) abre Perfil > Ficha de Saúde, vê o badge 'Sobrepeso' e não toca no select de Status Nutricional (que está vazio). Ao salvar, o prontuário grava nutritionalStatus='Bem nutrido'. O clínico que abrir a ficha lê 'Bem nutrido' enquanto o IMC calculado indica sobrepeso.

**Código atual:**

```jsx
UserProfileModal.jsx:267
        nutritionalStatus: formData.nutritionalStatus || (bmiCat ? (bmi < 18.5 ? 'Desnutrição' : bmi < 30 ? 'Bem nutrido' : 'Obesidade') : ''),

UserProfileModal.jsx:167
    if (value < 30) return { text: 'Sobrepeso', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' };
```

**Correção sugerida:** Alinhar a derivação com getBmiCategory acrescentando a faixa `bmi < 25 ? 'Bem nutrido' : bmi < 30 ? 'Sobrepeso' : 'Obesidade'`.

<details><summary>Verificação feita contra o código</summary>

A linha 267 usa três faixas (<18,5 Desnutrição / <30 Bem nutrido / resto Obesidade), enquanto getBmiCategory (linha 167) devolve 'Sobrepeso' para 25 <= IMC < 30, e o select de Status Nutricional (linha 969) oferece justamente a opção 'Sobrepeso'. Como a derivação só ocorre quando o select está vazio, um paciente com IMC 28,7 vê o badge 'Sobrepeso' e grava nutritional_status='Bem nutrido' (supabaseService.js:709).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0370 · MÉDIO · `CONFIRMAR-SCHEMA`

**Especialidade personalizada com vírgula é fatiada em duas especialidades falsas**

**Onde:** `src/components/UserProfileModal.jsx:330`

**O defeito:** As especialidades são serializadas em uma única string separada por ', ' (addSpecialty, linha 330) e desserializadas por split(',') (linha 312). O campo aceita texto livre via showCustomOption (linhas 324-326 e 534), sem bloquear vírgulas. Qualquer especialidade digitada com vírgula é quebrada em duas na renderização seguinte e persiste corrompida na coluna specialty (supabaseService.js:690), afetando o diretório de especialistas e a heurística isNurse (linhas 313-317).

**Como falha:** Enfermeiro/médico digita 'Enfermagem em Terapia Intensiva, Adulto' e clica em '➕ Adicionar especialidade'. Ao voltar o render, aparecem dois chips: 'Enfermagem em Terapia Intensiva' e 'Adulto'. Após salvar, o diretório passa a listar o profissional com a especialidade inexistente 'Adulto', e remover o chip original é impossível porque a string única não existe mais.

**Código atual:**

```jsx
UserProfileModal.jsx:312
  const selectedSpecialties = formData.specialty ? formData.specialty.split(',').map(s => s.trim()).filter(Boolean) : [];

UserProfileModal.jsx:328-332
  const addSpecialty = (specName) => {
    if (!selectedSpecialties.includes(specName)) {
      const updated = [...selectedSpecialties, specName].join(', ');
      setFormData(prev => ({ ...prev, specialty: updated }));
```

**Correção sugerida:** Remover ou rejeitar vírgulas em addSpecialty, ou armazenar a lista como array/JSON em vez de string separada por vírgula.

<details><summary>Verificação feita contra o código</summary>

A serialização é `[...selectedSpecialties, specName].join(', ')` (linha 330) e a desserialização é `formData.specialty.split(',')` (linha 312). A opção customizada (linhas 532-546, condicionada por showCustomOption nas linhas 324-326) aceita texto livre sem bloquear vírgulas, e addSpecialty não sanitiza. Uma especialidade com vírgula vira dois chips no render seguinte, persiste corrompida em specialty (supabaseService.js:690) e afeta a heurística isNurse (313-317).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0371 · MÉDIO · `CONFIRMADO`

**Overlay invisível do autocomplete de especialidades engole o primeiro clique nos botões do rodapé**

**Onde:** `src/components/UserProfileModal.jsx:514`

**O defeito:** Enquanto o dropdown de especialidades está aberto, é renderizada uma div de captura com position: fixed cobrindo top/left/right/bottom e zIndex 998, cuja única ação é fechar o dropdown. Como o container do modal mantém transform aplicado pela animação 'modalScaleUp ... forwards' (linhas 1174 e 1313-1316), ele se torna o bloco de contenção do position: fixed — o overlay cobre exatamente a área do modal, inclusive o rodapé com 'Cancelar' e 'Salvar Alterações'. O primeiro clique nesses botões é consumido pelo overlay e não chega ao botão.

**Como falha:** Médico adiciona a especialidade, o dropdown continua aberto (o input mantém o foco) e ele clica em 'Salvar Alterações'. Nada acontece — apenas o dropdown fecha. É preciso clicar uma segunda vez para o formulário submeter; muitos usuários interpretam como botão travado.

**Código atual:**

```jsx
UserProfileModal.jsx:513-517
                      <>
                        <div 
                          onClick={() => setSpecDropdownOpen(false)} 
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                        />

UserProfileModal.jsx:1174
            animation: modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
```

**Correção sugerida:** Fechar o dropdown via onBlur ou listener de clique no document, em vez de um overlay fixed dentro do modal.

<details><summary>Verificação feita contra o código</summary>

Confirmei a div de captura `position: fixed; top/left/right/bottom: 0; zIndex: 998` nas linhas 514-517, e que .profile-modal-container recebe `animation: modalScaleUp ... forwards` (linha 1174) cujo keyframe final é `transform: scale(1) translateY(0)` (1313-1316). Um transform diferente de `none`, mesmo identidade, torna o elemento bloco de contenção de descendentes fixed, então o overlay cobre apenas a área do modal — inclusive o rodapé (1130-1148). Como o dropdown abre no onFocus do input (linha 500) e a condição da linha 512 é satisfeita quando há opções filtradas, o primeiro clique em 'Salvar Alterações'/'Cancelar' é consumido. Vale só para o formulário de doctor.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0372 · MÉDIO · `CONFIRMADO`

**Autocomplete de especialidades e avatar são divs clicáveis sem role, foco ou suporte a teclado**

**Onde:** `src/components/UserProfileModal.jsx:548`

**O defeito:** As opções do combobox de especialidades são <div onClick> sem role="option"/listbox, sem tabIndex, sem onKeyDown e sem aria-activedescendant (linhas 532-561); o input associado não anuncia o popup. O mesmo vale para o círculo do avatar, que é uma <div onClick={handleAvatarClick}> sem role="button", tabIndex ou handler de teclado (linha 387), e cujo texto 'Alterar Foto' só existe no overlay revelado no hover (.avatar-circle:hover .avatar-overlay, linha 1241) — inatingível por teclado e por toque.

**Como falha:** Profissional que navega por teclado (ou usa leitor de tela) chega ao campo de especialidade com Tab, digita 'Cardio', e não consegue selecionar nenhuma sugestão: setas não movem, Enter submete o formulário. Do mesmo modo, não há como acionar a troca de foto de perfil sem mouse.

**Código atual:**

```jsx
UserProfileModal.jsx:548-561
                          {filteredOptions.map((opt, idx) => (
                            <div 
                              key={idx}
                              onClick={() => addSpecialty(opt)}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12.5px' }}
                              className="autocomplete-option"
                            >

UserProfileModal.jsx:387
              <div className="avatar-circle" onClick={handleAvatarClick}>
```

**Correção sugerida:** Converter as opções e o avatar em <button> ou elementos com role/tabIndex adequados, com navegação por setas e Enter no combobox.

<details><summary>Verificação feita contra o código</summary>

As opções do dropdown (532-546 e 548-561) são `<div onClick>` sem role, tabIndex, onKeyDown ou aria-activedescendant, e o input associado (492-510) não tem role=combobox nem aria-expanded. O avatar (linha 387) é `<div className="avatar-circle" onClick={handleAvatarClick}>` sem role="button", tabIndex ou handler de teclado, e o rótulo 'Alterar Foto' está no .avatar-overlay revelado por hover. Não há caminho por teclado para nenhum dos dois.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0373 · MÉDIO · `CONFIRMADO`

**Validação 'required' do Nome só existe na aba Dados Pessoais: é possível salvar nome vazio trocando de aba**

**Onde:** `src/components/UserProfileModal.jsx:721`

**O defeito:** O único campo obrigatório do fluxo de paciente é o input de Nome, com o atributo HTML required, mas ele está dentro do bloco condicional 'activeTab === "pessoais"' (linha 712). Quando o usuário troca para 'endereco' ou 'saude', o input é desmontado e a restrição desaparece do formulário — o submit passa com formData.name === ''. handleSubmit não revalida o nome (as validações das linhas 222-234 cobrem apenas CPF, cidade e estado). O nome vazio é então persistido em name (supabaseService.js:673).

**Como falha:** Paciente apaga o conteúdo de 'Nome Completo' na aba Dados Pessoais (sem submeter), clica na aba 'Ficha de Saúde' para ajustar o peso e clica em 'Salvar Alterações'. O perfil é gravado com nome vazio; a partir daí o cabeçalho, a lista de pacientes do médico e os documentos gerados exibem o paciente sem nome.

**Código atual:**

```jsx
UserProfileModal.jsx:712 e 716-722
                {activeTab === 'pessoais' && (
...
                      <input type="text" className="form-control" value={formData.name} onChange={...} required />
```

**Correção sugerida:** Validar `formData.name.trim()` no início de handleSubmit, independentemente da aba ativa.

<details><summary>Verificação feita contra o código</summary>

O input de Nome com `required` (linhas 716-722) está dentro do bloco `{activeTab === 'pessoais' && (...)}` (linha 712); ao trocar para 'endereco' ou 'saude' ele é desmontado e a validação HTML deixa de existir. handleSubmit (222-234) valida apenas CPF, cidade e estado, nunca o nome, e o payload grava `name: profile.name` (supabaseService.js:673) sem checagem. Nome vazio é persistido.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0374 · MÉDIO · `CONFIRMAR-SCHEMA`

**Selects de etilismo e cuidador não têm estado 'não informado' e gravam 'Não' como resposta clínica**

**Onde:** `src/components/UserProfileModal.jsx:978`

**O defeito:** Diferente dos outros selects da ficha (Tipo Sanguíneo, Mobilidade, Status Nutricional, que têm <option value="">Selecione...</option>), os campos 'Consumo de Álcool (Etilismo)' e 'Possui Cuidador Principal?' são booleanos coagidos: value={formData.alcoholism ? "sim" : "nao"}. Com o dado ausente (undefined/null vindo do banco), a UI já exibe 'Não / Ocasional' e 'Não (Realiza auto-curativo)' como se o paciente tivesse respondido, e o submit persiste alcoholism=false e has_caregiver=false (supabaseService.js:710-711). Não existe forma de registrar 'não informado'.

**Como falha:** Paciente acamado que depende de cuidador nunca respondeu a essa pergunta. Ao salvar qualquer outro campo do perfil, o prontuário passa a afirmar 'Não possui cuidador / realiza auto-curativo' e 'Não etilista'. O clínico que planejar o curativo domiciliar lê que o paciente é independente.

**Código atual:**

```jsx
UserProfileModal.jsx:976-983
                        <select 
                          className="form-control" 
                          value={formData.alcoholism ? "sim" : "nao"} 
                          onChange={e => setFormData(prev => ({ ...prev, alcoholism: e.target.value === "sim" }))}
                        >
                          <option value="nao">Não / Ocasional</option>
                          <option value="sim">Sim (Frequente/Crônico - interfere na cicatrização)</option>
```

**Correção sugerida:** Usar valores tri-estado ('', 'sim', 'nao') com opção 'Selecione...' e persistir null quando não informado.

<details><summary>Verificação feita contra o código</summary>

Comparei no mesmo bloco: Mobilidade (952) e Status Nutricional (966) têm `<option value="">Selecione...</option>`, enquanto Etilismo (976-983) e Cuidador (988-995) usam `value={formData.alcoholism ? "sim" : "nao"}` com apenas duas opções. Com o dado ausente a UI já exibe 'Não / Ocasional' e 'Não (Realiza auto-curativo)', e o serviço grava `alcoholism: profile.alcoholism || false` e `has_caregiver: profile.hasCaregiver || false` (supabaseService.js:710-711). Não existe forma de registrar 'não informado'.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0375 · MÉDIO · `CONFIRMADO`

**Botão 'Cancelar' da página de Perfil é inoperante (onClose é uma função vazia)**

**Onde:** `src/components/UserProfilePage.jsx:52`

**O defeito:** A página embute o UserProfileModal com onClose={() => {}}. O rodapé do modal é renderizado também em embeddedMode (linhas 1130-1148 de UserProfileModal.jsx, fora de qualquer condicional de embeddedMode) e seu botão 'Cancelar' chama exatamente esse onClose. Clicar em 'Cancelar' não descarta as alterações, não recarrega os valores originais e não navega para lugar algum: o botão não faz absolutamente nada. Pelo mesmo motivo, o setTimeout(() => onClose(), 1200) após salvar (linha 293) também é inócuo e a faixa verde de sucesso fica na tela indefinidamente.

**Como falha:** O paciente altera peso, altura e medicamentos na aba Ficha de Saúde, se arrepende e clica em 'Cancelar'. Os campos continuam com os valores editados na tela e nenhum feedback é dado; ele fica sem saber se cancelou ou não.

**Código atual:**

```jsx
UserProfilePage.jsx:50-55
        <UserProfileModal 
          currentUser={currentUser}
          onClose={() => {}}
          onProfileUpdate={onProfileUpdate}
          embeddedMode={true}
        />

UserProfileModal.jsx:1131-1139 (rodapé sempre renderizado)
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving} ...>Cancelar</button>
```

**Correção sugerida:** Em embeddedMode, esconder o 'Cancelar' ou ligá-lo a um reset do formData, e passar um onClose que navegue de volta.

<details><summary>Verificação feita contra o código</summary>

UserProfilePage.jsx:52 passa `onClose={() => {}}` com embeddedMode={true}, e o rodapé do modal (UserProfileModal.jsx:1129-1148) fica fora de qualquer condicional de embeddedMode — o botão 'Cancelar' chama exatamente esse no-op. Confirmei também que o setTimeout(() => onClose(), 1200) da linha 293 é inócuo nesse modo, deixando a faixa verde de sucesso permanentemente na tela.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0550 · BAIXO · `CONFIRMADO`

**Falha na busca de CEP é silenciosa (apenas console.warn)**

**Onde:** `src/components/UserProfileModal.jsx:152`

**O defeito:** Quando o fetch ao ViaCEP falha (offline, DNS, CORS, timeout) ou quando o serviço devolve data.erro, o usuário não recebe nenhuma informação: no primeiro caso só há console.warn, e no segundo a condição !data.erro simplesmente não preenche nada. Como o formulário auto-preenche rua/bairro/cidade/UF, o usuário fica esperando o preenchimento que nunca vem — e no fluxo de paciente cidade/estado são obrigatórios para salvar (linha 229).

**Como falha:** Paciente em área com internet instável digita o CEP correto e aguarda. Nada é preenchido e nenhuma mensagem aparece. Ao clicar em Salvar recebe 'Cidade e Estado são obrigatórios...' sem entender que a consulta de CEP falhou e que precisa digitar manualmente.

**Código atual:**

```jsx
UserProfileModal.jsx:143-154
        if (!data.erro) {
          setFormData(prev => ({ ...prev, street: ..., state: data.uf || '' }));
        }
      } catch (err) {
        console.warn("Erro ao buscar CEP:", err);
      }
```

**Correção sugerida:** Exibir estado de busca e mensagem ('CEP não encontrado ou falha na consulta — preencha manualmente') nos dois caminhos de falha.

<details><summary>Verificação feita contra o código</summary>

Nas linhas 139-155 não há estado de carregamento nem mensagem: em caso de exceção há apenas console.warn (153), e quando data.erro é verdadeiro a condição da linha 143 simplesmente não preenche nada. Como cidade e estado são obrigatórios para role 'patient' (linha 229), o usuário fica sem entender por que o salvamento é bloqueado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0551 · BAIXO · `CONFIRMADO`

**Reselecionar o mesmo arquivo após uma falha de upload não dispara nada (input file não é resetado)**

**Onde:** `src/components/UserProfileModal.jsx:178`

**O defeito:** handleFileChange nunca limpa e.target.value (nem no sucesso, nem no erro, nem no finally). O navegador só emite o evento change quando o valor do input muda; escolher exatamente o mesmo arquivo mantém o value e o handler não roda. Também não há bloqueio do clique durante o upload (a div .avatar-circle continua clicável mesmo com uploading===true), permitindo uploads concorrentes cujo vencedor é indeterminado.

**Como falha:** O upload da foto falha por instabilidade de rede e aparece 'Erro ao salvar foto de perfil.'. O usuário clica no avatar e escolhe a mesma foto novamente: nada acontece, nem spinner nem erro. Ele precisa escolher outro arquivo (ou recarregar a página) para conseguir tentar de novo.

**Código atual:**

```jsx
UserProfileModal.jsx:178-181 e 210-212
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
...
    } finally {
      setUploading(false);
    }
```

**Correção sugerida:** Fazer `e.target.value = ''` no finally de handleFileChange e ignorar o clique no avatar enquanto uploading for true.

<details><summary>Verificação feita contra o código</summary>

handleFileChange (178-213) não limpa `e.target.value` em nenhum caminho — nem nos returns antecipados de tipo/tamanho (183-190), nem no sucesso, nem no catch, nem no finally (210-212). Sem mudança de value o navegador não emite novo evento change para o mesmo arquivo. Além disso handleAvatarClick (174-176) não checa `uploading`, e a div do avatar (387) segue clicável durante o upload.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0552 · BAIXO · `CONFIRMADO`

**Troca de foto é persistida imediatamente no banco e 'Cancelar' não a desfaz**

**Onde:** `src/components/UserProfileModal.jsx:197`

**O defeito:** handleFileChange chama uploadAvatar, que já grava avatar_url na tabela clinical_profile (supabaseService.js:811-815) e no cache local, e o modal ainda chama onProfileUpdate para propagar ao App. Nada disso é transacional com o formulário: o botão 'Cancelar' (e o fechamento pelo backdrop) não revertem a foto, apesar de a UI sugerir que as mudanças só valem ao clicar em 'Salvar Alterações'.

**Como falha:** Usuário troca a foto de perfil por engano, percebe o erro e clica em 'Cancelar' para descartar. A foto nova continua no banco, no avatar do header e visível para os profissionais que abrirem o perfil dele.

**Código atual:**

```jsx
UserProfileModal.jsx:197-203
      const publicUrl = await uploadAvatar(currentUser.id, file);
      if (publicUrl) {
        setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
        const updated = { ...currentUser, avatarUrl: publicUrl };
        onProfileUpdate(updated);
        setSuccessMsg('Foto de perfil atualizada!');
```

**Correção sugerida:** Segurar o arquivo em estado local como preview e só chamar uploadAvatar dentro de handleSubmit, ou avisar explicitamente que a foto é salva de imediato.

<details><summary>Verificação feita contra o código</summary>

Confirmei em supabaseService.js:794-823 que uploadAvatar faz o upload no storage e em seguida `update({ avatar_url: publicUrl }).eq('id', resolvedId)` na tabela clinical_profile, além de atualizar saveLocalProfile e irec_active_user (no modo local, grava base64 no perfil salvo, linhas 767-781). O modal ainda chama onProfileUpdate na linha 202. Nada disso é revertido por 'Cancelar' (1131-1139) nem pelo fechamento no backdrop, embora a UI sugira que as mudanças só valem ao salvar.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0553 · BAIXO · `CONFIRMADO`

**setTimeout que fecha o modal não é cancelado no desmonte**

**Onde:** `src/components/UserProfileModal.jsx:293`

**O defeito:** Após salvar, é agendado um setTimeout de 1200 ms para chamar onClose, sem guardar o id nem cancelá-lo em cleanup. O componente não tem useEffect algum, portanto o timer sobrevive ao desmonte (ex.: o usuário fecha o modal pelo backdrop ou muda de aba nesse intervalo) e o callback executa em um componente já desmontado, disparando setState no App fora do ciclo esperado.

**Como falha:** O paciente clica em Salvar e, antes de 1,2 s, clica no backdrop para fechar. O modal fecha; 1,2 s depois o timer chama onClose() novamente (setShowProfileModal(false) em um componente desmontado). Em outro cenário, se o usuário reabrir o modal dentro desse intervalo, o timer o fecha sozinho.

**Código atual:**

```jsx
UserProfileModal.jsx:292-295
        setSuccessMsg('Perfil atualizado com sucesso!');
        setTimeout(() => {
          onClose();
        }, 1200);
```

**Correção sugerida:** Guardar o id do timer em um useRef e limpá-lo em um useEffect de cleanup e ao reabrir o modal.

<details><summary>Verificação feita contra o código</summary>

As linhas 293-295 agendam `setTimeout(() => onClose(), 1200)` sem guardar o id, e o grep confirma que o componente não tem nenhum useEffect, logo não existe cleanup possível. Se o usuário fechar antes pelo backdrop e reabrir dentro do intervalo, o timer fecha o modal sozinho. O impacto é limitado (onClose atua sobre o App, que segue montado; React 18 não emite mais warning de setState em componente desmontado), por isso a severidade baixa é adequada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0554 · BAIXO · `CONFIRMADO`

**Botão de fechar do modal não tem nome acessível**

**Onde:** `src/components/UserProfileModal.jsx:351`

**O defeito:** O botão de fechar contém apenas um <svg> decorativo, sem aria-label, sem title e sem texto visualmente oculto. Leitores de tela anunciam apenas 'botão'. É o único controle de fechamento além do backdrop (que também não é acessível por teclado, já que não há tratamento de Escape).

**Como falha:** Usuário de leitor de tela abre 'Editar Perfil de Usuário', percorre os controles e encontra um 'botão' sem rótulo no cabeçalho; não há como saber que ele fecha o modal, e nem Escape funciona.

**Código atual:**

```jsx
UserProfileModal.jsx:351-366
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', ... }}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
```

**Correção sugerida:** Adicionar aria-label="Fechar" ao botão e aria-hidden="true" ao svg.

<details><summary>Verificação feita contra o código</summary>

O botão das linhas 351-366 contém apenas um <svg> sem aria-label, sem title, sem aria-hidden no ícone e sem texto oculto — leitores de tela anunciam só 'botão'. Confirmei também, pelo grep sem resultados de useEffect, que não há tratamento de Escape, de modo que esse botão e o backdrop (também não acessível por teclado) são as únicas saídas. Vale apenas no modo modal, já que o cabeçalho é condicionado por !embeddedMode.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0555 · BAIXO · `CONFIRMADO`

**Backdrop fecha o modal em qualquer clique e descarta todas as edições sem confirmação**

**Onde:** `src/components/UserProfileModal.jsx:1330`

**O defeito:** No modo modal, o backdrop chama onClose em qualquer clique, sem checar se há alterações pendentes e sem pedir confirmação. Não há tratamento de tecla Escape nem de beforeunload. Como o formulário é longo (três abas com dezenas de campos clínicos), um clique acidental na borda apaga todo o trabalho — e, como formData é reinicializado só na montagem, reabrir o modal traz os valores antigos.

**Como falha:** Paciente preenche as três abas (dados pessoais, endereço e ficha de saúde completa com comorbidades e medicamentos) e, ao tentar rolar a página, clica alguns pixels fora do card. O modal fecha imediatamente, tudo é perdido e nada é salvo.

**Código atual:**

```jsx
UserProfileModal.jsx:1329-1333
  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      {contentMarkup}
    </div>
  );
```

**Correção sugerida:** Pedir confirmação no clique do backdrop quando houver alterações não salvas, comparando formData com o snapshot inicial.

<details><summary>Verificação feita contra o código</summary>

A linha 1330 é `<div className="profile-modal-backdrop" onClick={onClose}>` sem qualquer checagem de estado sujo, e o grep de useEffect não retorna nada — não existe handler de Escape nem beforeunload. Como formData só é inicializado na montagem, reabrir traz o snapshot antigo. Ressalva: fechar no backdrop é padrão amplamente aceito e afeta apenas o modo modal (a página de Perfil usa embeddedMode); o defeito real é a ausência de confirmação em formulário longo, o que reduz a severidade.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0556 · BAIXO · `CONFIRMAR-SCHEMA`

**Página anuncia 'preferências de interface' que não existem em nenhum campo do formulário**

**Onde:** `src/components/UserProfilePage.jsx:37`

**O defeito:** O subtítulo da página promete gerenciar 'preferências de interface', mas o UserProfileModal embutido não expõe nenhum controle de uiMode ou de tema: uiMode só existe como valor oculto lido do localStorage (UserProfileModal.jsx:124) e regravado no submit (linhas 285-287). Não há select, switch ou checkbox correspondente em nenhuma das abas nem no formulário profissional.

**Como falha:** Paciente idoso acessa Perfil & Configurações da Conta procurando ativar o modo de leitura fácil descrito no subtítulo, percorre as três abas e não encontra nenhuma opção de interface. O único acesso a essa configuração é um botão de ícone no header, que ele não relaciona à tela de configurações.

**Código atual:**

```jsx
UserProfilePage.jsx:36-38
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Gerencie suas credenciais profissionais, dados de contato, foto de perfil e preferências de interface.
          </p>

UserProfileModal.jsx:124 (único uso de uiMode: valor oculto)
    uiMode: localStorage.getItem('irec_ui_mode') || currentUser.uiMode || 'standard'
```

**Correção sugerida:** Adicionar um controle de Modo Fácil/tema na página de Perfil ou remover a promessa do subtítulo.

<details><summary>Verificação feita contra o código</summary>

O subtítulo da linha 37 promete gerenciar 'preferências de interface', mas o grep de 'uiMode' no UserProfileModal retorna somente as linhas 124, 282, 285 e 286 — leitura do localStorage, envio no payload e regravação no submit. Não existe nenhum select, switch ou checkbox de uiMode/tema em nenhuma aba nem no formulário profissional; o único controle é o botão no header do App (App.jsx:1470).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0557 · BAIXO · `CONFIRMADO`

**Exportação de dados de saúde não gera registro de auditoria LGPD**

**Onde:** `src/components/UserProfilePage.jsx:79`

**O defeito:** O handler de exportação despeja todo o perfil (incluindo CPF, RG, CNS, telefone, endereço, comorbidades e medicamentos) em um arquivo baixado, sem registrar o evento em nenhuma trilha de auditoria: não chama createAuditLog de src/services/auditLogger.js (cuja documentação prevê explicitamente 'acesso, alteração ou exportação de prontuário') nem createAuditLog de src/services/supabaseService.js:333. O mesmo vale para a solicitação de exclusão. Fica sem rastro quem exportou dados sensíveis e quando.

**Como falha:** Em um tablet compartilhado onde a sessão de um paciente ficou aberta, um terceiro clica em 'Exportar Meus Dados de Saúde (.JSON)' e leva o arquivo com CPF, RG, CNS e prontuário. A tela Admin > Logs (que lê irec_log_acessos_prontuario) não mostra nenhum evento de exportação; não há como auditar o incidente.

**Código atual:**

```jsx
UserProfilePage.jsx:79-94 (handler completo, sem chamada de auditoria)
            onClick={() => {
              const exportData = { user: currentUser, exportedAt: ..., localEntries: ... };
              ...
              alert("📥 Exportação LGPD concluída com sucesso! ...");
            }}

auditLogger.js:6-8
 * Registra um evento imutável de acesso, alteração ou exportação de prontuário
export const createAuditLog = async (actionType, clinician, patient, details = '') => {
```

**Correção sugerida:** Chamar createAuditLog registrando EXPORT_PRONTUARIO e SOLICITACAO_EXCLUSAO antes de concluir cada ação.

<details><summary>Verificação feita contra o código</summary>

Li o arquivo completo: os únicos imports são React e UserProfileModal, e o handler de exportação (79-94) monta o JSON com todo o objeto currentUser (CPF, RG, CNS, telefone, endereço, comorbidades, medicamentos) e dispara o download sem nenhuma chamada de auditoria — o mesmo vale para o botão de exclusão (114-118). Nenhum dos dois createAuditLog do projeto é invocado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0558 · BAIXO · `CONFIRMADO`

**JSON.parse sem try/catch no botão de exportação LGPD derruba o handler**

**Onde:** `src/components/UserProfilePage.jsx:84`

**O defeito:** A leitura de irec_entries_<id> é feita com JSON.parse direto, sem try/catch. Se o conteúdo estiver corrompido (escrita interrompida, quota do localStorage excedida no meio do setItem de supabaseService.js:77, ou chave adulterada), o parse lança SyntaxError dentro do onClick: a exportação não acontece, nenhum arquivo é gerado, nenhum alert aparece e nenhuma mensagem de erro é mostrada — o botão simplesmente parece morto (o erro só aparece no console/Sentry).

**Como falha:** O paciente usou o app offline e o localStorage estourou a quota durante saveLocalEntries, deixando JSON truncado. Ao clicar em 'Exportar Meus Dados de Saúde (.JSON)', nada acontece em nenhuma tentativa, sem qualquer feedback do que está errado.

**Código atual:**

```jsx
UserProfilePage.jsx:80-85
              const exportData = {
                user: currentUser,
                exportedAt: new Date().toISOString(),
                lgpdNotice: '...',
                localEntries: JSON.parse(localStorage.getItem(`irec_entries_${currentUser?.id}`) || '[]')
              };
```

**Correção sugerida:** Envolver a leitura em try/catch com fallback para [] e exibir mensagem de erro se a exportação falhar.

<details><summary>Verificação feita contra o código</summary>

A linha 84 faz JSON.parse direto dentro do onClick, sem try/catch em nenhum ponto do handler (linhas 79-94). Conteúdo corrompido em irec_entries_<id> lança SyntaxError antes da criação do link, sem feedback ao usuário. O defeito é real, mas o gatilho (localStorage truncado/adulterado) é pouco frequente e só afeta o botão de exportação — por isso rebaixo a severidade.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "UserProfileModal.jsx|UserProfilePage.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
