# 15. Login e cadastro

**26 defeitos** — 1 crítico · 3 alto · 12 médio · 10 baixo

Arquivos tocados por este módulo:

- `src/components/Login.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0015 · CRÍTICO · `CONFIRMADO`

**Cadastro de médico/enfermeiro sem nenhuma verificação de credencial, já marcado como 'verified'**

**Onde:** `src/components/Login.jsx:146`

**O defeito:** O componente importa uploadProfessionalCredential (linha 2) e mantém o state documentFile (linha 96), mas não existe nenhum <input type="file"> no formulário: documentFile é sempre null, a função importada nunca é chamada em nenhum lugar do projeto (grep confirma que só existe a linha de import) e professionalDocumentUrl é enviado sempre como ''. Também existe verifyProfessionalRegistry(crmNumber, uf, type) em supabaseService.js:2874 que nunca é invocada. Do outro lado, signUpUser define `let verificationStatus = 'verified'` para todo mundo (supabaseService.js:122).

**Como falha:** Qualquer pessoa abre a tela de cadastro, escolhe "Médico", digita um CRM inventado (ex.: 000000-SP) e uma especialidade qualquer. O perfil é criado com role='doctor' e verification_status='verified', cai no doctor-dashboard e passa a listar/abrir prontuários de pacientes reais. Nenhum documento é pedido e nenhuma consulta ao registro profissional é feita.

**Código atual:**

```jsx
additionalData = { 
            crm: `${crm.toUpperCase()}-${crmState}`, 
            specialty, 
            rqe: clinicianType === 'doctor' ? rqe : '',
            professionalDocumentUrl: ''
          };
```

**Correção sugerida:** Definir verificationStatus='pending' no cadastro de clinico, adicionar o input de arquivo chamando uploadProfessionalCredential, invocar verifyProfessionalRegistry(crm, crmState, clinicianType) e restaurar o gate isVerifiedClinician em App.jsx com RLS no banco.

<details><summary>Verificação feita contra o código</summary>

Li o arquivo inteiro (943 linhas): nao existe nenhum <input type="file"> — documentFile so aparece em useState (linha 96) e em setDocumentFile(null) (linha 161), nunca e preenchido; uploadProfessionalCredential e importado na linha 2 e jamais invocado (grep em src/ retorna apenas o import e a definicao em supabaseService.js:2847); professionalDocumentUrl e sempre '' (linha 145). verifyProfessionalRegistry (supabaseService.js:2874) existe e nunca e chamada por nenhum arquivo. Do outro lado signUpUser define `let verificationStatus = 'verified'` para todos (linha 122). Reforco que encontrei por conta propria: App.jsx:974 tem `const isVerifiedClinician = true; // Clinicians are always bypass-verified`, ou seja o gate de homologacao no shell tambem esta curto-circuitado, e nenhum dos clean_database_*.sql habilita RLS em clinical_profile. Mantenho critico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0112 · ALTO · `CONFIRMAR-SCHEMA`

**CPF, cidade e estado exigidos como obrigatórios são descartados e nunca persistidos**

**Onde:** `src/components/Login.jsx:131`

**O defeito:** O formulário bloqueia o cadastro do paciente sem CPF, cidade e UF alegando "validação de pessoa física" e "serviço de localização de resgate e emergências" (linhas 123 e 129) e monta additionalData = { cpf, birthDate, gender, city, state }. Porém, quando o Supabase está configurado, signUpUser só monta o payload com id, role, name, email, crm, specialty, rqe, birth_date, gender, verification_status e professional_document_url (src/services/supabaseService.js:213-225) e o profile retornado também não contém cpf/city/state (linhas 239-251). Os três campos são silenciosamente jogados fora.

**Como falha:** Paciente preenche CPF, cidade e UF (obrigatórios) e conclui o cadastro. Ao abrir o próprio perfil ou ao ser atendido, CPF aparece vazio e o recurso de SOS/localização de resgate não tem cidade/UF nenhuma — o dado que o app afirmou precisar para emergências nunca chegou ao banco.

**Código atual:**

```jsx
additionalData = { cpf, birthDate, gender, city, state };
```

**Correção sugerida:** Incluir cpf, city e state no payload de signUpUser (e no profile retornado), garantindo as colunas via migration; ou chamar updateClinicalProfile logo apos o signup.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois arquivos. Login.jsx:120-131 bloqueia o cadastro sem cpf/city/state e monta additionalData = { cpf, birthDate, gender, city, state }. Em supabaseService.js:213-225 o payload do upsert contem apenas id, role, name, email, crm, specialty, rqe, birth_date, gender, verification_status, professional_document_url — cpf/city/state nao existem no payload; o profile retornado (239-251) tambem nao os inclui. Prova extra de que sao campos reais e nao inexistentes: updateClinicalProfile (supabaseService.js:692/703/704) grava cpf/city/state, ou seja as colunas existem no banco real e simplesmente nao sao populadas no signup (nenhum dos clean_database_*.sql chega a cria-las, o que so agrava). No modo contingencia local eles SAO salvos (linhas 160/171/172), portanto o defeito e exclusivo do modo Supabase. Rebaixado de critico para alto (perda silenciosa de dado obrigatorio, sem crash).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0113 · ALTO · `CONFIRMADO`

**Login social offline gera novo id a cada acesso e perde todo o histórico do usuário**

**Onde:** `src/components/Login.jsx:198`

**O defeito:** O mock offline usa id = `social_${Date.now()}` (novo em cada login) com e-mail FIXO `${providerId}_user@example.com`. O id novo é gravado em irec_active_user (linha 218), mas o push em irec_users é bloqueado pelo guard de e-mail a partir do segundo login (linha 221), e saveLocalProfile nunca é chamado. Como todos os dados clínicos locais são indexados por id (`irec_profile_<id>`, `irec_entries_<id>` — supabaseService.js:68/72), cada login cria um usuário órfão diferente.

**Como falha:** Com Supabase não configurado, o paciente entra com Google, registra fotos/evoluções da ferida e sai. No próximo login com Google um novo id social_<timestamp> é criado: o histórico anterior (irec_entries_social_<idAntigo>) fica inacessível, o dashboard aparece vazio e o registro em irec_users continua apontando para o primeiro id — perda de dados clínicos a cada sessão.

**Código atual:**

```jsx
const mockProfile = {
          id: `social_${Date.now()}`,
          role: 'patient', // default to patient for social logins
```

**Correção sugerida:** Derivar o id de forma estavel a partir do email (ex.: `social_${providerId}`) e, se o usuario ja existir em irec_users, reutilizar o id e o perfil salvos em vez de criar um novo.

<details><summary>Verificação feita contra o código</summary>

Confirmado linha a linha: id `social_${Date.now()}` (198) novo em cada clique, email fixo `${providerId}_user@example.com` (201); irec_active_user e sobrescrito com o id novo (218); o push em irec_users so ocorre se o email ainda nao existir (221), logo do segundo login em diante o registro antigo permanece com o id antigo; saveLocalProfile nunca e chamado neste caminho, portanto irec_profile_<novoId> nao existe. Como getLocalProfile/getLocalEntries/saveLocalEntries indexam por id (supabaseService.js:8/68/72), o historico anterior fica orfao. Nenhuma guarda impede isso. Mantenho alto (perda de dado clinico, restrita ao modo contingencia local).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0114 · ALTO · `CONFIRMAR-SCHEMA`

**Enfermeiro é cadastrado com role 'doctor' e o papel 'nurse' nunca é criado**

**Onde:** `src/components/Login.jsx:622`

**O defeito:** O card "Enfermeiro" faz setRole('doctor') + setClinicianType('nurse'), mas clinicianType nunca é enviado ao serviço: handleSubmit chama signUpUser(email, password, name, role, additionalData) com role='doctor' e additionalData contendo apenas crm/specialty/rqe/professionalDocumentUrl (linhas 141-146). Confirmei em src/services/supabaseService.js:121-225 que o valor de `role` é gravado literalmente em clinical_profile.role. Ou seja, nenhum usuário com role 'nurse' é jamais criado pelo cadastro, apesar de o papel existir e ser usado em todo o app (App.jsx:481/708/727/737, AdminDashboard.jsx:208/421/824, Telemedicine.jsx:2363, TelemedicineContactsList.jsx:160).

**Como falha:** Uma enfermeira se cadastra escolhendo o card "Enfermeiro", informa COREN e especialidades de enfermagem. Resultado: o perfil é salvo com role='doctor'; App.handleLoginSuccess (App.jsx:645) a leva para 'doctor-dashboard' com permissões de médico; o painel admin exibe "0 Enfermeiros" e a conta aparece na lista de médicos; na telemedicina o badge mostra "👨‍⚕️ Médico"; o filtro "Enfermeiros" nunca a encontra.

**Código atual:**

```jsx
onClick={() => {
  setRole('doctor');
  setClinicianType('nurse');
  setSpecialty('');
```

**Correção sugerida:** Passar o papel real: const finalRole = clinicianType === 'nurse' ? 'nurse' : role; signUpUser(email, password, name, finalRole, ...) — e migrar o CHECK da coluna role para incluir 'nurse'.

<details><summary>Verificação feita contra o código</summary>

Li Login.jsx:604-633 e 141-150: o card Enfermeiro faz setRole('doctor')+setClinicianType('nurse'), e handleSubmit chama signUpUser(email,password,name,role,additionalData) com additionalData = {crm, specialty, rqe, professionalDocumentUrl} — clinicianType nao aparece em nenhum lugar do payload (grep de clinicianType em src/ mostra que ele so e usado para labels/filtros de UI dentro de Login.jsx). Em supabaseService.js:130/137 e 213-219 o valor de role e gravado literalmente. Grep de 'nurse' em src/ nao encontra nenhum caminho de escrita que crie esse papel (todas as ocorrencias sao leitura/filtro). Reforco adicional: clean_database_v3.sql:13 define role com CHECK (role IN ('patient','doctor')), ou seja o proprio schema do repositorio nem aceita 'nurse'. Nao existe guarda. Rebaixado de critico para alto: e falha funcional/integridade + permissao ampliada, mas nao ha crash nem vazamento.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0300 · MÉDIO · `CONFIRMAR-SCHEMA`

**COREN do enfermeiro é gravado no campo 'crm' sem prefixo, quebrando a heurística de exibição**

**Onde:** `src/components/Login.jsx:142`

**O defeito:** Para clinicianType==='nurse' o valor é montado como `${crm.toUpperCase()}-${crmState}` e salvo na coluna crm, sem qualquer marca de que é um COREN. Isso conflita diretamente com a heurística usada para diferenciar enfermeiro de médico em src/components/Dashboard.jsx:623/626: `assignedClinician.role === 'nurse' || (assignedClinician.crm && assignedClinician.crm.toUpperCase().includes('COREN'))`. Como o role é 'doctor' (bug correlato) e o crm nunca contém 'COREN', as duas condições falham.

**Como falha:** Enfermeira cadastra COREN 78900/SP; o perfil grava crm='78900-SP'. No dashboard do paciente ela aparece como "Médico(a) Assistente" e "Dr(a). <nome>", e a tela exibe "CRM 78900-SP" para um registro de enfermagem — informação profissional incorreta apresentada ao paciente.

**Código atual:**

```jsx
crm: `${crm.toUpperCase()}-${crmState}`, 
```

**Correção sugerida:** Gravar com prefixo do orgao: crm: `${clinicianType === 'nurse' ? 'COREN' : 'CRM'} ${crm.toUpperCase()}-${crmState}` (ou adicionar coluna registry_type) e ajustar os consumidores para usar o role.

<details><summary>Verificação feita contra o código</summary>

Login.jsx:142 monta crm: `${crm.toUpperCase()}-${crmState}` para os dois tipos de clinico, sem qualquer marcador. Confirmei a heuristica consumidora em Dashboard.jsx:623/626/629, que depende de role==='nurse' OU crm.toUpperCase().includes('COREN'); como role e sempre 'doctor' (achado 1) e o crm nunca contem 'COREN', as duas condicoes falham e a linha 629 imprime literalmente `CRM: 78900-SP`. Nao existe normalizacao intermediaria. E em grande parte consequencia do achado 1 e o impacto e de exibicao/informacao incorreta, nao de perda de dado -> rebaixado de alto para medio.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0301 · MÉDIO · `CONFIRMADO`

**Botão reabilita durante o setTimeout de 1,5 s e permite cadastro duplicado**

**Onde:** `src/components/Login.jsx:152`

**O defeito:** No sucesso do cadastro o redirecionamento é agendado com setTimeout de 1500 ms, mas o bloco finally executa setLoading(false) imediatamente (linha 183), reabilitando o botão (disabled={loading}, linha 915) durante toda a janela do timer. O timeout também não é cancelado em nenhum lugar (não há useEffect/ref guardando o id), então ele dispara mesmo depois de novos cliques ou de o componente ser desmontado.

**Como falha:** Usuário clica "Cadastrar e Criar Ficha"; o cadastro dá certo e aparece "Cadastro realizado com sucesso! Redirecionando...", mas o botão volta a ficar clicável. Ele clica de novo (comportamento comum em conexão lenta) e um segundo signUp é disparado: a mensagem de sucesso é substituída pelo erro "User already registered" e, 1,5 s depois, o timer antigo ainda chama onLoginSuccess(profile) — o usuário vê um erro na tela e é logado ao mesmo tempo.

**Código atual:**

```jsx
setSuccessMsg('Cadastro realizado com sucesso! Redirecionando...');
          setTimeout(() => {
            onLoginSuccess(profile);
          }, 1500);
```

**Correção sugerida:** Guardar o id em useRef, limpar no unmount, e nao chamar setLoading(false) no caminho de sucesso do cadastro (ou usar um state separado `redirecting` que mantenha o botao desabilitado).

<details><summary>Verificação feita contra o código</summary>

Verificado: linhas 149-154 agendam onLoginSuccess com setTimeout de 1500ms e o finally das linhas 182-184 executa setLoading(false) imediatamente (o finally roda antes do timer, que e macrotask). O botao usa disabled={loading} (linha 915), logo fica clicavel durante os 1,5s. Nao existe useRef/useEffect guardando o id do timer nem cleanup no unmount (o arquivo inteiro nao tem nenhum useEffect). Rebaixado de alto para medio: o segundo signUp e rejeitado pelo backend ('Este e-mail ja esta cadastrado' / 'User already registered'), entao nao ha criacao duplicada real — o dano e a mensagem de erro exibida junto com o login bem-sucedido disparado pelo timer antigo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0302 · MÉDIO · `CONFIRMADO`

**E-mail sem trim/lowercase impede o login no modo contingência local**

**Onde:** `src/components/Login.jsx:176`

**O defeito:** O valor de email é usado exatamente como digitado tanto no cadastro (linha 150) quanto no login (linha 176). No modo contingência, signInUser compara com igualdade estrita: `users.find(u => u.email === email && u.password === password)` (src/services/supabaseService.js:266), e signUpUser também usa `users.some(u => u.email === email)`. Espaço em branco final (comum em teclado mobile com autocompletar) ou diferença de caixa quebra a correspondência.

**Como falha:** Paciente se cadastra como "Joao@Mail.com" (teclado mobile capitaliza a primeira letra) e depois tenta entrar digitando "joao@mail.com": recebe "E-mail ou senha incorretos." indefinidamente, sem nenhuma pista do motivo e sem recuperação de senha na tela.

**Código atual:**

```jsx
const profile = await signInUser(email, password);
```

**Correção sugerida:** Normalizar uma vez no submit: `const normalizedEmail = email.trim().toLowerCase();` e usar essa variavel em signUpUser/signInUser (e no comparador do servico).

<details><summary>Verificação feita contra o código</summary>

A parte de CAIXA se confirma: supabaseService.js:266 compara `u.email === email` e a linha 126 usa `users.some(u => u.email === email)`, ambos case-sensitive, e Login.jsx:150/176 passa o email como digitado. Cadastrar 'Joao@Mail.com' e tentar entrar com 'joao@mail.com' realmente falha no modo contingencia. Refuto a parte do espaco em branco: o input e type="email" (linha 655) e o algoritmo de sanitizacao de valor do HTML para esse tipo remove newlines e espacos no inicio/fim, entao e.target.value ja chega aparado. Alem disso, no modo Supabase o GoTrue normaliza o e-mail em lowercase no servidor, portanto o defeito e restrito ao modo contingencia local. Severidade medio mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0303 · MÉDIO · `CONFIRMADO`

**onLoginSuccess é chamado com profile possivelmente null e derruba o app**

**Onde:** `src/components/Login.jsx:177`

**O defeito:** signInUser pode resolver com null: em src/services/supabaseService.js:286-290 o retorno é `await getClinicalProfile(user.id)` sem checagem, e getClinicalProfile termina em `catch { return getLocalProfile(resolvedId); }` (linha 636-639), sendo que getLocalProfile retorna null quando não há `irec_profile_<id>` nem registro em `irec_users` (linhas 7-65). No modo contingência local o mesmo acontece (linha 270-272). O Login não valida o retorno e repassa null direto para o pai, que faz `profile.email` sem guarda (App.jsx:641-649).

**Como falha:** Usuário já cadastrado entra em um dispositivo novo (localStorage vazio) e o SELECT em clinical_profile falha por RLS/rede: signInUser retorna null -> onLoginSuccess(null) -> App.jsx:643 lança "TypeError: Cannot read properties of null (reading 'email')" -> tela branca, sem mensagem de erro e sem como voltar ao formulário exceto recarregando.

**Código atual:**

```jsx
const profile = await signInUser(email, password);
        onLoginSuccess(profile);
```

**Correção sugerida:** Em Login.jsx:176-177: `if (!profile) throw new Error('Nao foi possivel carregar seu perfil clinico. Verifique sua conexao e tente novamente.');` antes de onLoginSuccess, e adicionar guarda `if (!profile) return;` em App.handleLoginSuccess.

<details><summary>Verificação feita contra o código</summary>

O null realmente pode chegar: supabaseService.js:286-290 faz `const profile = await getClinicalProfile(user.id)` e retorna sem checar; getClinicalProfile termina em catch { return getLocalProfile(resolvedId); } (linhas 636-639) e getLocalProfile retorna null (linha 64) quando nao ha irec_profile_<id> nem match em irec_users. App.jsx:641-643 faz profile.email sem guarda. POREM refuto o cenario descrito: onLoginSuccess(profile) na linha 177 esta DENTRO do try de handleSubmit (aberto na linha 112), entao o TypeError sobe pela pilha sincrona e e capturado pelo catch da linha 179 -> setErrorMsg('Cannot read properties of null...'). Nao ha tela branca (main.jsx nao tem ErrorBoundary, mas ele nunca e acionado): o usuario permanece no formulario vendo uma mensagem tecnica em ingles. Defeito real, impacto muito menor que o alegado -> critico rebaixado para medio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0304 · MÉDIO · `CONFIRMADO`

**Senha sem validação mínima: erro cru do Supabase em inglês é exibido ao usuário**

**Onde:** `src/components/Login.jsx:181`

**O defeito:** O input de senha não tem minLength nem padrão, e a validação de cadastro só checa truthiness (linha 115). Qualquer erro do Supabase Auth é repassado cru para a interface via err.message, sem tradução nem mapeamento. As mensagens do GoTrue são em inglês ('Password should be at least 6 characters', 'Invalid login credentials', 'User already registered', 'Email rate limit exceeded').

**Como falha:** Paciente idoso cadastra a senha "123": o formulário aceita, envia ao Supabase e exibe na caixa vermelha "Password should be at least 6 characters" — texto em inglês, sem indicar que é a senha nem qual o requisito, em um app 100% em português.

**Código atual:**

```jsx
setErrorMsg(err.message || 'Ocorreu um erro no processo de autenticação.');
```

**Correção sugerida:** Adicionar minLength={6} no input + validacao local ('A senha deve ter no minimo 6 caracteres') e um mapa de traducao dos erros do GoTrue antes do setErrorMsg.

<details><summary>Verificação feita contra o código</summary>

Confirmado: o input de senha (666-673) tem apenas `required`, sem minLength/pattern, e a validacao da linha 115 so testa truthiness; a linha 181 faz setErrorMsg(err.message || ...) sem nenhum mapeamento/traducao, e o erro do GoTrue chega literal via o throw de supabaseService.js:258. Nao existe nenhum dicionario de traducao dessas mensagens no projeto. Agravante que verifiquei: no modo contingencia (supabaseService.js:124-132) nao ha regra nenhuma de senha, entao '123' e aceita definitivamente. Severidade medio mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0305 · MÉDIO · `CONFIRMADO`

**JSON.parse de 'irec_users' sem try/catch e sem validar que é array**

**Onde:** `src/components/Login.jsx:220`

**O defeito:** O login social offline faz JSON.parse(localStorage.getItem('irec_users') || '[]') dentro de um setTimeout, fora de qualquer try/catch, e em seguida chama users.some(...) e users.push(...). Se a chave estiver corrompida (escrita parcial, quota excedida, outra aba) o parse lança SyntaxError; se contiver um objeto/valor não-array, users.some não existe (TypeError). Como a exceção ocorre dentro do callback do timer, ela não é capturada pelo catch de handleSocialLogin e loading nunca volta a false.

**Como falha:** Usuário com localStorage.irec_users corrompido (ex.: '[{"id":') clica em "Google" no modo contingência: exceção não tratada no timer, nenhuma mensagem de erro aparece e o botão "Processando..." fica travado para sempre até recarregar a página.

**Código atual:**

```jsx
const users = JSON.parse(localStorage.getItem('irec_users') || '[]');
        if (!users.some(u => u.email === mockProfile.email)) {
```

**Correção sugerida:** Envolver o corpo do setTimeout em try/catch com setLoading(false) no finally e usar `const parsed = JSON.parse(...); const users = Array.isArray(parsed) ? parsed : [];`.

<details><summary>Verificação feita contra o código</summary>

Confirmado: o JSON.parse da linha 220 e o users.some/push (221-222) estao dentro do callback do setTimeout iniciado na linha 196, ou seja fora do try/catch das linhas 231-243 — o catch de handleSocialLogin nao cobre callbacks assincronos, e o setLoading(false) (225) esta depois do parse, entao o loading realmente nunca e revertido. Nao existe validacao Array.isArray. Rebaixado de alto para medio: exige localStorage corrompido/nao-array, condicao pouco frequente, e o mesmo padrao inseguro ja existe em getLocalUsers (supabaseService.js:4), portanto nao e um risco introduzido so aqui.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0306 · MÉDIO · `CONFIRMADO`

**Tokens OAuth do hash são interpretados como aba e persistidos em localStorage**

**Onde:** `src/components/Login.jsx:235`

**O defeito:** signInWithOAuth é chamado com redirectTo: window.location.origin e o cliente é criado sem flowType (src/supabaseClient.js:20-22), portanto o fluxo implícito devolve o usuário com `#access_token=...&refresh_token=...` no fragmento. App.jsx:37-43 inicializa activeTab exatamente com `window.location.hash.replace('#','').trim()`, App.jsx:65-66 faz replaceState desse conteúdo e App.jsx:671-675 grava `localStorage.setItem('irec_active_tab', activeTab)`.

**Como falha:** Paciente entra com Google: ao voltar, activeTab passa a valer a string "access_token=eyJ...&refresh_token=...", que cai no `default` do switch (App.jsx:907) em vez do dashboard, e o access/refresh token é escrito em texto puro na chave irec_active_tab do localStorage (e no history state), ficando legível por qualquer script da página.

**Código atual:**

```jsx
const { error } = await supabase.auth.signInWithOAuth({
        provider: providerId,
        options: {
          redirectTo: window.location.origin
        }
      });
```

**Correção sugerida:** Validar o hash contra uma allowlist de abas em App.jsx (ignorar valores que contenham '=' ou '&') e passar `auth: { flowType: 'pkce' }` em createClient para o token nunca aparecer na URL.

<details><summary>Verificação feita contra o código</summary>

Fui verificar a premissa do flowType no node_modules: @supabase/supabase-js/dist/index.cjs:67-72 define DEFAULT_AUTH_OPTIONS com flowType: 'implicit' e auth-js 2.108.2 (GoTrueClient.js:21) tambem; supabaseClient.js:20-22 nao passa options, logo o fluxo e implicito e o retorno traz #access_token=...&refresh_token=... Do lado do App confirmei App.jsx:37-43 (useState inicializa activeTab com window.location.hash.replace('#','').trim()), App.jsx:65-66 (replaceState com esse conteudo) e App.jsx:671-675 (localStorage.setItem('irec_active_tab', activeTab)) — os efeitos rodam no mount, antes da limpeza assincrona do hash pelo detectSessionInUrl. Nao ha sanitizacao (setActiveTab so valida typeof string). Rebaixado de alto para medio por duas mitigacoes reais: (a) o `default` do switch (App.jsx:907-935) ainda renderiza Dashboard/DoctorDashboard, nao tela vazia; (b) com persistSession:true o proprio Supabase ja guarda access/refresh token em localStorage (sb-*-auth-token), entao a copia extra e incremental.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0307 · MÉDIO · `VERIFICAR`

**redirectTo com window.location.origin quebra o login Google no app nativo**

**Onde:** `src/components/Login.jsx:235`

**O defeito:** O capacitor.config.json não define server.url nem hostname (apenas appId/appName/webDir), então dentro do app nativo window.location.origin vale http://localhost (Android) ou capacitor://localhost (iOS). Esse valor é enviado como redirectTo do OAuth e não pode ser cadastrado como URL de redirecionamento válida no Supabase, além de não haver tratamento de appUrlOpen/deep link em nenhum ponto do projeto.

**Como falha:** Usuário instala o APK e toca em "Google": o provedor rejeita o redirect_uri (redirect_uri_mismatch) ou abre o consentimento no navegador externo e a sessão nunca retorna ao app; ele volta para a tela de login sem estar autenticado e sem mensagem explicativa.

**Código atual:**

```jsx
redirectTo: window.location.origin
```

**Correção sugerida:** Detectar Capacitor.isNativePlatform() e usar um redirectTo com esquema customizado registrado (ex.: com.irec.medical://auth-callback) + listener appUrlOpen chamando supabase.auth.exchangeCodeForSession, cadastrando a URL na allowlist do Supabase.

<details><summary>Verificação feita contra o código</summary>

Verifiquei as duas premissas: capacitor.config.json contem apenas appId/appName/webDir (sem server.url nem hostname), logo no app nativo window.location.origin e http://localhost / capacitor://localhost; e grep por appUrlOpen/@capacitor/app/Browser.open em src/ nao retorna nada, e @capacitor/app nao esta em package.json — nao existe tratamento de deep link. Porem a mecanica alegada esta imprecisa: o redirect_uri enviado ao Google e o callback do proprio Supabase (/auth/v1/callback), nao o redirectTo, portanto 'redirect_uri_mismatch do provedor' nao e o erro esperado; o que ocorreria e o Supabase recusar o redirectTo fora da allowlist e/ou a sessao voltar no navegador do sistema sem retornar ao WebView. Nao pude confirmar em dispositivo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0308 · MÉDIO · `VERIFICAR`

**Loading do login social nunca é encerrado no caminho de sucesso**

**Onde:** `src/components/Login.jsx:238`

**O defeito:** handleSocialLogin faz setLoading(true) e só volta a false no bloco catch. Quando signInWithOAuth resolve sem erro, o código conta com a navegação do browser para descartar a página; se a navegação não acontecer (WebView do Capacitor, popup/redirect bloqueado por política do navegador, usuário volta com o botão "voltar"), o componente continua montado com loading=true e sem nenhum caminho para resetar.

**Como falha:** Usuário toca em "Google" no app Android (WebView) ou com bloqueio de redirecionamento: o botão de submit fica permanentemente em "Processando..." e desabilitado, sem mensagem de erro; a única saída é fechar e reabrir o app.

**Código atual:**

```jsx
if (error) throw error;
    } catch (err) {
```

**Correção sugerida:** Mover o setLoading(false) para um bloco finally (ou resetar no evento pageshow/visibilitychange) para o botao nao ficar preso em 'Processando...'.

<details><summary>Verificação feita contra o código</summary>

O fato de codigo esta confirmado: handleSocialLogin faz setLoading(true) na linha 190 e setLoading(false) aparece somente em 225 (caminho offline) e 242 (catch) — no caminho de sucesso com Supabase (linhas 232-238) nao ha reset nem finally, e o componente nao tem nenhum useEffect de cleanup. Nao consegui confirmar a manifestacao: no fluxo normal signInWithOAuth executa o redirect do browser e a pagina e descartada, entao o loading preso depende de a navegacao nao acontecer (WebView do Capacitor, bloqueio de redirect, volta pelo botao back) — condicao que nao pude verificar sem executar o app.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0309 · MÉDIO · `CONFIRMADO`

**Busca de especialidade não normaliza acentos e induz duplicata sem acento**

**Onde:** `src/components/Login.jsx:252`

**O defeito:** O filtro compara apenas toLowerCase(), sem remover diacríticos. Como a maioria das especialidades da lista tem acento ('Clínico Geral', 'Pediatria' não, 'Cardiologia' não, mas 'Ginecologia e Obstetrícia', 'Otorrinolaringologia', 'Radiologia e Diagnóstico por Imagem' sim), digitar sem acento não encontra o item; pior, showCustomOption (linha 257) fica true e o app oferece criar a especialidade duplicada.

**Como falha:** Médico digita "clinico": nenhuma opção da lista aparece e a interface sugere "➕ Adicionar especialidade: \"clinico\"". Ele aceita, e o banco passa a ter a especialidade solta "clinico" além de "Clínico Geral" — o diretório de médicos filtrado por "Clínico Geral" não o encontra.

**Código atual:**

```jsx
const filteredOptions = clinicianSpecialties.filter(s => 
    s.toLowerCase().includes(specSearch.toLowerCase()) && 
    !selectedSpecialties.includes(s)
  );
```

**Correção sugerida:** Criar helper `const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()` e usa-lo no filteredOptions e no showCustomOption.

<details><summary>Verificação feita contra o código</summary>

Confirmado: o filtro das linhas 252-255 usa apenas toLowerCase() em ambos os lados, sem normalize('NFD')/remocao de diacriticos, e showCustomOption (257-259) fica true justamente quando nenhum item bate — a lista realmente contem itens acentuados ('Clinico Geral' na linha 21, 'Ginecologia e Obstetricia', 'Radiologia e Diagnostico por Imagem', 'Enfermagem Geronto-Geriatrica'). Digitar 'clinico' nao encontra 'Clinico Geral' e o app oferece criar a duplicata. Nao ha guarda. Severidade medio mantida (dado sujo em campo usado para busca de profissionais).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0310 · MÉDIO · `CONFIRMAR-SCHEMA`

**Seletor de papel é div clicável: inacessível por teclado e para leitor de tela**

**Onde:** `src/components/Login.jsx:590`

**O defeito:** Os três cards (Paciente/Médico/Enfermeiro) são <div> com onClick, sem role="radio"/"button", sem tabIndex, sem onKeyDown e sem estado aria-checked; o container também não é um radiogroup. Não há nenhuma alternativa (select, input radio) para escolher o papel.

**Como falha:** Usuário que navega só por teclado (ou com leitor de tela) chega à tela de cadastro: o Tab pula direto do botão "Cadastrar" para o campo "Nome Completo", o papel fica travado em 'patient' e é impossível se cadastrar como médico ou enfermeiro.

**Código atual:**

```jsx
<div 
                    className={`role-option ${role === 'patient' ? 'active' : ''}`}
                    onClick={() => {
```

**Correção sugerida:** Trocar por <input type="radio" name="role"> com <label> estilizado, ou adicionar role="radio" + tabIndex={0} + aria-checked + onKeyDown (Enter/Espaco/setas) e role="radiogroup" no container.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 589-634: os tres cards sao <div className="role-option"> com apenas onClick — sem role, tabIndex, onKeyDown ou aria-checked — e o container (linha 589) nao e um radiogroup. Nao ha nenhuma alternativa acessivel (select/input radio) no arquivo. Como role inicia em 'patient' (linha 80), um usuario que so navega por teclado realmente nao consegue se cadastrar como medico/enfermeiro. Severidade medio mantida (barreira funcional, nao apenas rotulagem).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0311 · MÉDIO · `CONFIRMADO`

**Overlay fixed em tela cheia com o dropdown aberto engole o primeiro clique em qualquer botão**

**Onde:** `src/components/Login.jsx:842`

**O defeito:** Ao focar o campo de especialidades, setSpecDropdownOpen(true) é disparado (onFocus, linha 828) e a condição da linha 840 fica verdadeira mesmo com a busca vazia, porque filteredOptions.length > 0. Isso monta um <div position:fixed> cobrindo top/left/right/bottom com zIndex 998 sobre toda a página, cujo único handler é fechar o dropdown.

**Como falha:** Médico clica no campo de especialidades (sem digitar nada) e depois clica em "Cadastrar e Criar Ficha": o clique é capturado pelo overlay invisível e nada acontece; ele precisa clicar duas vezes no botão. O mesmo vale para as abas "Entrar"/"Cadastrar" e para o botão do Google, dando a impressão de que os botões estão travados.

**Código atual:**

```jsx
<div 
                        onClick={() => setSpecDropdownOpen(false)} 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                      />
```

**Correção sugerida:** Trocar o overlay por click-outside via useRef + listener no document, ou exigir `specSearch.trim()` para abrir o dropdown.

<details><summary>Verificação feita contra o código</summary>

Confirmado: o onFocus da linha 828 abre o dropdown e a condicao da linha 840 e `specDropdownOpen && (specSearch.trim() || filteredOptions.length > 0)` — com busca vazia filteredOptions ainda tem itens, entao o overlay das linhas 842-845 (position:fixed, top/left/right/bottom 0, zIndex 998, unico handler = fechar) e montado. Investiguei uma possivel refutacao: .login-card tem backdrop-filter: blur(20px) (linha 292), o que cria containing block para descendentes fixed, entao o overlay cobre a caixa do card e nao a viewport inteira — mas o botao de submit (911), as abas Entrar/Cadastrar (555-578) e o botao do Google (925) estao todos DENTRO do card, portanto o primeiro clique continua sendo engolido. Severidade medio mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0508 · BAIXO · `CONFIRMADO`

**Validação aceita campos preenchidos só com espaços**

**Onde:** `src/components/Login.jsx:115`

**O defeito:** As checagens de obrigatoriedade usam apenas truthiness (!email || !password || !name; !city || !state; !crm), sem trim. Uma string de espaços é truthy e passa por todas elas; o atributo HTML required também considera espaços como preenchimento.

**Como falha:** Usuário aperta espaço no campo "Nome Completo" e envia: o cadastro é criado com name="   ", e todas as telas que mostram o nome do paciente/médico (dashboard, lista do médico, telemedicina) exibem um espaço vazio no lugar do nome.

**Código atual:**

```jsx
if (!email || !password || !name) {
          throw new Error('Por favor, preencha todos os campos obrigatórios.');
        }
```

**Correção sugerida:** Validar com trim e enviar os valores ja aparados: `if (!email.trim() || !password || !name.trim())` e usar name.trim() em signUpUser.

<details><summary>Verificação feita contra o código</summary>

Confirmado: a linha 115 (!email || !password || !name), a 128 (!city || !state) e a 134 (!crm) usam apenas truthiness, sem trim, e o atributo HTML required considera ' ' como preenchido. Os campos name (639), city (717) e crm (748) sao type="text", que nao sofre sanitizacao do browser — entao name='   ' e realmente gravado (supabaseService.js:137/196). Nota: o campo email escapa disso porque input type="email" tem sanitizacao de valor que remove espacos nas pontas. Severidade baixo mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0509 · BAIXO · `CONFIRMAR-SCHEMA`

**CPF é validado limpo mas persistido com máscara, gerando formatos divergentes**

**Onde:** `src/components/Login.jsx:121`

**O defeito:** A validação usa cleanCpf (só dígitos) para conferir o tamanho, mas additionalData recebe a variável `cpf` crua, exatamente como digitada, com pontos e traço. Não há normalização em nenhum ponto do caminho (o serviço apenas repassa additionalData.cpf, supabaseService.js:160). Assim o mesmo CPF pode ser gravado como "123.456.789-09" ou "12345678909" dependendo de o usuário ter digitado a máscara ou não.

**Como falha:** Paciente A se cadastra digitando "123.456.789-09" e depois é pré-cadastrado por um médico com "12345678909": nenhuma checagem de duplicidade ou busca por CPF casa os dois registros, resultando em dois prontuários para a mesma pessoa.

**Código atual:**

```jsx
const cleanCpf = (cpf || '').replace(/\D/g, '');
          if (!cleanCpf || cleanCpf.length !== 11) {
```

**Correção sugerida:** Persistir sempre o valor limpo: `additionalData = { cpf: cleanCpf, ... }`, aplicando mascara apenas na exibicao.

<details><summary>Verificação feita contra o código</summary>

Confirmado: a linha 121 calcula cleanCpf apenas para validar o tamanho e a linha 131 envia a variavel `cpf` crua; o input (681-688) e type="text" sem mascara nem normalizacao, e supabaseService.js:160 repassa additionalData.cpf como veio. Rebaixado de alto para baixo por dois motivos verificados: no modo Supabase o CPF nem chega a ser gravado no signup (achado 3), e o grep por cpf em supabaseService.js (linhas 38/160/463/540/595/692/1220/1702) mostra que nao existe nenhuma busca nem checagem de duplicidade por CPF — o cenario dos dois prontuarios ocorreria igual com o formato normalizado.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0510 · BAIXO · `CONFIRMADO`

**CPF aceito só por quantidade de dígitos, sem dígito verificador**

**Onde:** `src/components/Login.jsx:122`

**O defeito:** A mensagem promete "validação de pessoa física", mas a única checagem é cleanCpf.length !== 11. Sequências inválidas conhecidas (11111111111, 00000000000) e qualquer combinação aleatória de 11 dígitos passam. Não há cálculo dos dígitos verificadores em nenhum ponto do fluxo (nem no serviço).

**Como falha:** Usuário digita "111.111.111-11" para não informar o CPF real: o cadastro é concluído normalmente e o prontuário é criado com um CPF inválido, inviabilizando qualquer conferência de identidade ou integração com sistemas de saúde.

**Código atual:**

```jsx
if (!cleanCpf || cleanCpf.length !== 11) {
```

**Correção sugerida:** Implementar validacao de digitos verificadores (rejeitando tambem sequencias repetidas) em um util isValidCPF e chama-la antes de montar additionalData.

<details><summary>Verificação feita contra o código</summary>

Confirmado: a unica checagem e cleanCpf.length !== 11 (linha 122), e grep por validaCpf/validateCpf/digitoVerificador/cpfValido em src/ nao retorna nada — nao existe calculo de digitos verificadores em nenhum ponto do projeto, nem no servico. '111.111.111-11' passa. Rebaixado de medio para baixo: e lacuna de hardening/validacao (nada quebra) e, no modo Supabase, o CPF nem e persistido no signup (achado 3), o que reduz o impacto pratico atual.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0511 · BAIXO · `CONFIRMADO`

**Especialidade armazenada como string separada por vírgula corrompe entradas customizadas**

**Onde:** `src/components/Login.jsx:263`

**O defeito:** A lista de especialidades é serializada com join(', ') em um único state string e reconstruída com specialty.split(',') (linha 246). O campo de texto livre ("Adicionar especialidade: ...", linha 862) aceita qualquer conteúdo, inclusive vírgulas, sem escapar nem bloquear.

**Como falha:** Médico digita a especialidade customizada "Cirurgia Geral, área de Trauma" e clica em adicionar. Ao renderizar, o chip se parte em dois: "Cirurgia Geral" e "área de Trauma". Remover um deles apaga metade do texto original e o perfil é salvo com duas especialidades inexistentes.

**Código atual:**

```jsx
const updated = [...selectedSpecialties, specName].join(', ');
```

**Correção sugerida:** Guardar as especialidades em um array de state (ou JSON) em vez de string com virgulas; alternativamente rejeitar/substituir virgulas em addSpecialty.

<details><summary>Verificação feita contra o código</summary>

Confirmado: a linha 263 serializa com join(', '), a linha 246 reconstroi com specialty.split(',').map(trim), e a opcao customizada (linhas 860-874) chama addSpecialty(specSearch.trim()) sem bloquear nem escapar virgulas — o input livre da linha 820 nao tem restricao. Logo 'Cirurgia Geral, area de Trauma' vira dois chips. Rebaixado de medio para baixo: exige que o usuario digite virgula em uma especialidade customizada (nenhum dos ~70 itens de ALL_SPECIALTIES contem virgula) e o dano e de qualidade de dado, sem quebra funcional.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0512 · BAIXO · `CONFIRMADO`

**Clicar novamente no papel já selecionado apaga os dados profissionais digitados**

**Onde:** `src/components/Login.jsx:609`

**O defeito:** O onClick de cada card executa setSpecialty(''), setCrm('') e setRqe('') incondicionalmente, sem verificar se o papel clicado já é o ativo.

**Como falha:** Médico seleciona "Médico", preenche CRM 123456, adiciona três especialidades e o RQE; depois clica de novo no card "Médico" (por hábito, para conferir a seleção). Todos os chips de especialidade, o CRM e o RQE são apagados sem aviso e ele precisa refazer o preenchimento.

**Código atual:**

```jsx
setRole('doctor');
                      setClinicianType('doctor');
                      setSpecialty('');
                      setCrm('');
                      setRqe('');
```

**Correção sugerida:** Envolver a limpeza em uma guarda, ex.: `if (role !== 'doctor' || clinicianType !== 'doctor') { setSpecialty(''); setCrm(''); setRqe(''); }` em cada card.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos tres onClick (592-597, 606-612, 621-627): setSpecialty(''), setCrm('') e setRqe('') sao chamados incondicionalmente, sem comparar com o role/clinicianType atual. Reclicar no card ja ativo limpa os chips (selectedSpecialties e derivado de specialty, linha 246), o CRM e o RQE sem confirmacao. Severidade baixo mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0513 · BAIXO · `CONFIRMADO`

**Labels sem htmlFor e inputs sem id/aria-label em todo o formulário**

**Onde:** `src/components/Login.jsx:638`

**O defeito:** Nenhum dos campos (Nome, E-mail, Senha, CPF, Data de Nascimento, Gênero, Cidade, UF, CRM/COREN, RQE) possui id associado a um htmlFor, e o input de busca de especialidades (linha 820) não tem label nem aria-label — apenas placeholder. Os rótulos são <label className="form-label"> soltos.

**Como falha:** Usuário com leitor de tela percorre o formulário de cadastro e ouve apenas "campo de edição" nos campos, sem saber qual é qual; clicar no texto "Senha *" também não move o foco para o campo correspondente.

**Código atual:**

```jsx
<label className="form-label">Nome Completo *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Seu nome completo"
```

**Correção sugerida:** Adicionar id em cada campo e htmlFor correspondente no label (ex.: id="reg-name" / htmlFor="reg-name") e aria-label no input de busca de especialidades.

<details><summary>Verificação feita contra o código</summary>

Confirmado na leitura completa do JSX (linhas 585-908): nenhum input/select possui id, nenhum <label className="form-label"> possui htmlFor, e o input de busca de especialidades (820-838) tem apenas placeholder, sem label nem aria-label. Nao ha aria-labelledby como alternativa em nenhum campo. Severidade baixo mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0514 · BAIXO · `VERIFICAR`

**Data de nascimento no futuro é aceita e gera idade negativa nas telas clínicas**

**Onde:** `src/components/Login.jsx:692`

**O defeito:** O input type="date" não tem atributo max e a validação em handleSubmit apenas verifica se birthDate é truthy (linha 125). Nenhum limite de intervalo é aplicado antes de enviar para signUpUser, e o valor alimenta calculateAge em src/components/DoctorDashboard.jsx:777-780 (`new Date(birthDateString)`), que não trata datas futuras.

**Como falha:** Paciente erra o ano e informa 2035-05-10 (ou digita a data no formato errado no mobile). O cadastro é aceito e, na lista de pacientes do médico, aparece uma idade negativa junto ao nome ("-9 anos"), corrompendo também o contexto clínico enviado à IA de triagem (geminiService usa profile.birthDate).

**Código atual:**

```jsx
<input 
                  type="date" 
                  className="form-input" 
                  value={birthDate} 
                  onChange={(e) => setBirthDate(e.target.value)} 
                  required
                />
```

**Correção sugerida:** Adicionar max={new Date().toISOString().split('T')[0]} no input e validar faixa no handleSubmit (data no passado e idade <= 120 anos).

<details><summary>Verificação feita contra o código</summary>

Metade do achado se confirma: o input das linhas 692-698 nao tem max e a validacao da linha 125 so checa truthiness, logo 2035-05-10 e aceito e enviado. Mas REFUTO o efeito alegado: li calculateAge em DoctorDashboard.jsx:777-785 e ela faz `Math.abs(ageDate.getUTCFullYear() - 1970)`, ou seja uma data futura produz idade POSITIVA (~9 anos), nunca '-9 anos' — nao existe idade negativa em tela. Sobra um defeito real de validacao de entrada (dado clinico implausivel aceito e exibido como idade errada), com impacto bem menor. Marquei PLAUSIVEL porque o defeito existe mas o cenario de falha descrito nao ocorre como alegado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0515 · BAIXO · `CONFIRMAR-SCHEMA`

**UF é armazenada em minúsculas: o uppercase é apenas visual**

**Onde:** `src/components/Login.jsx:729`

**O defeito:** O campo de UF aplica textTransform: 'uppercase' via CSS, que altera apenas a renderização; o onChange grava e.target.value sem normalizar (linha 733). Nada converte o valor antes de enviá-lo em additionalData.state.

**Como falha:** Paciente digita "sp": a tela mostra "SP" e ele conclui o cadastro convicto de que gravou a sigla correta, mas o valor persistido é "sp". Qualquer filtro/agrupamento por UF (busca de profissionais por estado, métricas administrativas) compara com 'SP' e não encontra o paciente.

**Código atual:**

```jsx
style={{ flex: 1, textTransform: 'uppercase' }}
```

**Correção sugerida:** Normalizar no onChange: `onChange={(e) => setState(e.target.value.toUpperCase().slice(0,2))}` (ou usar um <select> com as 27 UFs, como ja e feito no campo de CRM).

<details><summary>Verificação feita contra o código</summary>

Confirmado: a linha 729 usa style textTransform:'uppercase' (puramente visual) e o onChange da linha 733 grava e.target.value sem normalizar; nada converte antes de additionalData.state (linha 131). Rebaixado de medio para baixo porque a consequencia alegada nao se sustenta: no modo Supabase o campo state nem e persistido no signup (achado 3) e nao encontrei nenhum consumidor que filtre perfis por UF — o filtro de AdminDashboard.jsx:581 opera sobre uma lista estatica de cidades (c.state), nao sobre perfis, e grep por state em DoctorsDirectory/NursesNetwork/UserProfilePage nao retorna nada.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0516 · BAIXO · `CONFIRMADO`

**Botão de remover especialidade sem nome acessível**

**Onde:** `src/components/Login.jsx:801`

**O defeito:** O botão de remoção do chip contém apenas a entidade &times; e não possui aria-label nem texto alternativo, além de não indicar a qual especialidade se refere.

**Como falha:** Médico cego com 4 especialidades adicionadas navega pelos chips e ouve "botão ×" quatro vezes iguais, sem saber qual especialidade cada botão remove — remove a errada.

**Código atual:**

```jsx
<button 
                          type="button" 
                          onClick={() => removeSpecialty(spec)}
```

**Correção sugerida:** Adicionar aria-label={`Remover especialidade ${spec}`} (e title) no botao.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 801-817: o botao tem como unico conteudo a entidade &times; e nao possui aria-label, title nem texto visualmente oculto, portanto nao ha como distinguir a qual chip ele pertence. Severidade baixo mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0517 · BAIXO · `CONFIRMADO`

**Botão do Google não é desabilitado durante loading**

**Onde:** `src/components/Login.jsx:925`

**O defeito:** Diferente do submit (disabled={loading}, linha 915), o social-btn não tem disabled nem qualquer guarda contra reentrância; handleSocialLogin pode ser executado em paralelo com um cadastro/login em andamento ou várias vezes seguidas.

**Como falha:** Usuário clica "Entrar na Plataforma", a requisição demora, ele então clica em "Google": dois fluxos de autenticação concorrem; no modo contingência dois timers de 1 s criam perfis mock e o último onLoginSuccess vence, podendo logar com o mock em vez da conta real digitada.

**Código atual:**

```jsx
<button 
            type="button" 
            className="social-btn" 
            onClick={() => handleSocialLogin('Google')}
```

**Correção sugerida:** Adicionar disabled={loading} ao social-btn e um early return `if (loading) return;` no inicio de handleSocialLogin.

<details><summary>Verificação feita contra o código</summary>

Confirmado por leitura: o botao das linhas 925-938 nao tem atributo disabled (ao contrario do submit, linha 915) e handleSocialLogin nao tem guarda de reentrancia (`if (loading) return`). O cenario offline tambem se sustenta: cada clique agenda um timer de 1000ms (linha 196) que sobrescreve irec_active_user e chama onLoginSuccess. Rebaixado de medio para baixo: e defeito de UX/reentrancia, o dano exige uma sequencia especifica de cliques e no modo Supabase o redirect encerra a pagina.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "Login.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
