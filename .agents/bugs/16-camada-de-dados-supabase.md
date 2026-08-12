# 16. Camada de dados (Supabase)

**33 defeitos** — 0 crítico · 20 alto · 13 médio · 0 baixo

Arquivos tocados por este módulo:

- `src/services/supabaseService.js`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0178 · ALTO · `CONFIRMADO`

**Verificação de registro profissional é ignorada: todo médico/enfermeiro nasce 'verified'**

**Onde:** `src/services/supabaseService.js:122`

**O defeito:** A variável verificationStatus é inicializada com 'verified' e NUNCA é reatribuída em nenhum ramo de signUpUser. O resultado de verifyProfessionalRegistry (linha 2874) não é consumido em nenhum lugar do cadastro, e a chave VITE_INFOSIMPLES_API_KEY nem existe no .env do projeto (verificado), de modo que a função retornaria {status:'pending'} de imediato. Consequência: verification_status é gravado como 'verified' no clinical_profile de qualquer profissional, e todos os diretórios (getAllDoctors/getAllNurses/getAllClinicians, que filtram por verification_status='verified') passam a listar profissionais nunca homologados. A fila de homologação do admin (App.jsx linha 114 filtra role==='doctor' && verificationStatus==='pending') fica permanentemente vazia.

**Como falha:** Um usuário qualquer abre a tela de cadastro, escolhe 'Sou profissional de saúde', digita CRM 'ABC123' inexistente e conclui. O perfil é salvo com verification_status='verified'. Ele aparece imediatamente em 'Diretório de Médicos' para os pacientes, pode ser contratado via BookingModal e emitir documentos, sem qualquer validação de CRM/COREN. O painel admin-users mostra 0 homologações pendentes.

**Código atual:**

```jsx
let verificationStatus = 'verified'; // All users are verified automatically by default
```

**Correção sugerida:** Inicializar `verificationStatus = 'pending'` e só promover para 'verified' com o retorno de verifyProfessionalRegistry ou por ação do admin.

<details><summary>Verificação feita contra o código</summary>

Li signUpUser inteiro (121-260): `let verificationStatus = 'verified'` nunca é reatribuído em nenhum ramo, e verifyProfessionalRegistry (2874) não é chamada em ponto algum do cadastro. O valor é gravado tanto no perfil local (145) quanto no payload remoto (223, `verification_status`). Confirmei também que verifyProfessionalRegistry retorna {status:'pending'} imediatamente quando não há VITE_INFOSIMPLES_API_KEY (2876-2879), ou seja, mesmo se fosse consumida nada seria verificado. Consequentemente os diretórios que filtram `verification_status='verified'` (1268, 1317, 1554) listam qualquer profissional. Reduzo de crítico para alto porque o comportamento é explicitamente assumido no comentário do código (decisão de produto), embora continue sendo um defeito de segurança clínica real.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0179 · ALTO · `CONFIRMADO`

**Senha em texto puro no localStorage no cadastro em modo contingência**

**Onde:** `src/services/supabaseService.js:130`

**O defeito:** Quando o Login chama signUpUser sem Supabase configurado (isSupabaseConfigured === false), o objeto gravado em `irec_users` inclui o campo `password` com a senha em texto puro, e signInUser depois compara `u.password === password` (linha 266). Qualquer script da página, extensão ou pessoa com acesso ao dispositivo lê a senha em claro no DevTools.

**Como falha:** O app roda em modo contingência local (situação padrão quando o .env não está preenchido). Um paciente se cadastra e a senha dele fica visível em localStorage.irec_users -> [{..."password":"minhasenha123"}], reutilizável em outros serviços onde ele repita a senha.

**Código atual:**

```jsx
const newUser = { id: userId, email, password, name, role, ...additionalData };
```

**Correção sugerida:** Nunca persistir a senha: gravar apenas um hash derivado (ex.: SHA-256 via crypto.subtle com salt por usuário) e comparar o hash em signInUser.

<details><summary>Verificação feita contra o código</summary>

Linha 130 grava exatamente `const newUser = { id: userId, email, password, name, role, ...additionalData }` em `irec_users` via saveLocalUsers (132), e signInUser na linha 266 compara `u.email === email && u.password === password`. Não há hash, ofuscação nem remoção no logout (signOutUser, linha 299, só apaga `irec_active_user`). Como o .env está vazio, isSupabaseConfigured é false e este é o caminho padrão hoje. Item duplicado do 213.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0180 · ALTO · `CONFIRMADO`

**Senhas gravadas em texto puro no localStorage no modo contingência**

**Onde:** `src/services/supabaseService.js:130`

**O defeito:** No modo contingência local, signUpUser persiste o objeto do usuário incluindo o campo password sem qualquer hash na chave 'irec_users', e signInUser (linha 266) compara u.password === password em texto puro. A chave nunca é removida no logout.

**Como falha:** Em um tablet compartilhado da unidade de saúde (cenário previsto pelo modo contingência), qualquer pessoa abre o DevTools ou digita localStorage.getItem('irec_users') e lê e-mail e senha em claro de todos os pacientes e profissionais que já se cadastraram naquele dispositivo, inclusive senhas reutilizadas em outros serviços.

**Código atual:**

```jsx
const newUser = { id: userId, email, password, name, role, ...additionalData };
    users.push(newUser);
    saveLocalUsers(users);
```

**Correção sugerida:** Armazenar somente hash+salt da senha em `irec_users` e comparar hashes no login local.

<details><summary>Verificação feita contra o código</summary>

Mesma evidência do item 11, verificada em código: linha 130 inclui `password` no objeto persistido em `irec_users`; linha 266 compara em texto puro; signOutUser (299) não remove a chave. Rebaixo de crítico para alto: o alcance é limitado ao dispositivo (não há vazamento remoto), mas o dano de reuso de senha é real e o modo local é o padrão atual.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0181 · ALTO · `CONFIRMADO`

**signOutUser não limpa os caches clínicos locais: dados do paciente anterior vazam para o próximo usuário**

**Onde:** `src/services/supabaseService.js:299`

**O defeito:** signOutUser remove apenas 'irec_active_user'. Continuam no localStorage: irec_profile_<id> (CPF, RG, CNS, endereço, comorbidades), irec_entries_<id> (fotos de ferida em base64, notas médicas), irec_chat_messages, irec_medical_documents, irec_appointments, irec_local_calls, irec_users e irec_assignments. App.jsx (linhas 661-667) também só limpa chaves de navegação. Pior: getClinicalProfile (linha 638) e getWoundEntries (linha 901) fazem fallback para essas mesmas chaves em qualquer erro remoto.

**Como falha:** Paciente A usa o app no tablet da clínica e sai (logout). Paciente B loga no mesmo tablet. Se qualquer chamada ao Supabase falhar (rede oscilando, RLS), getClinicalProfile/getWoundEntries devolvem o conteúdo remanescente de irec_profile_/irec_entries_ do dispositivo. Além disso, qualquer pessoa com o tablet lê o prontuário de A pelo localStorage sem estar logada.

**Código atual:**

```jsx
export const signOutUser = async () => {
  localStorage.removeItem('irec_active_user');
  if (!isSupabaseConfigured) return true;
```

**Correção sugerida:** Em signOutUser, varrer localStorage removendo todas as chaves com prefixo `irec_` exceto preferências não sensíveis.

<details><summary>Verificação feita contra o código</summary>

signOutUser (298-310) remove apenas `irec_active_user` e retorna. Confirmei que os caches sensíveis permanecem: `irec_profile_<id>` (68), `irec_entries_<id>` (77), `irec_chat_messages` (2016), `irec_local_calls` (2019), `irec_appointments` (1351), `irec_users` (5), `irec_assignments` (81). E os fallbacks realmente releem essas chaves em qualquer erro: getClinicalProfile linha 638 e getWoundEntries linha 901 retornam getLocalProfile/getLocalEntries no catch. O cenário de tablet compartilhado é alcançável por usuário real.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0182 · ALTO · `CONFIRMADO`

**getCurrentUser reautentica pelo localStorage quando a sessão do Supabase falha**

**Onde:** `src/services/supabaseService.js:327`

**O defeito:** No catch de getCurrentUser, qualquer falha de getSession (token expirado, refresh token revogado, erro de rede) faz a função devolver o perfil armazenado em 'irec_active_user'. O App.jsx trata esse retorno como usuário autenticado, ou seja, a autenticação passa a ser puramente client-side e um perfil pode ser restaurado sem sessão válida.

**Como falha:** Um administrador revoga a sessão de um médico no Supabase. Na próxima abertura do app, getSession falha, o catch devolve o perfil em cache e o médico continua navegando com o prontuário selecionado como se estivesse autenticado. Basta também editar manualmente irec_active_user no navegador (por exemplo colocando email 'admin@irec.com') para o app abrir o painel administrativo.

**Código atual:**

```jsx
} catch (err) {
    console.error('Erro ao verificar sessão no Supabase:', err);
    const data = localStorage.getItem('irec_active_user');
    return data ? JSON.parse(data) : null;
  }
```

**Correção sugerida:** No catch, retornar null (ou só usar o cache local quando o erro for comprovadamente de rede, marcando o retorno como não autenticado).

<details><summary>Verificação feita contra o código</summary>

Linhas 319-329: qualquer throw dentro do try (inclusive sessionError de token revogado/expirado ou erro de rede) cai no catch que devolve `JSON.parse(localStorage.getItem('irec_active_user'))`. Não há nenhuma guarda distinguindo erro de rede de sessão inválida. O objeto retornado é o mesmo formato de perfil que o App consome como usuário autenticado, e como o admin é identificado só por `currentUser.email === 'admin@irec.com'` (App.jsx), editar a chave manualmente eleva privilégio na UI. Só o dado remoto continua protegido por RLS — por isso não é escalação total, mas a autenticação client-side é confirmada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0183 · ALTO · `CONFIRMAR-SCHEMA`

**Revinculação de perfil por e-mail altera a chave primária e cai em insert duplicado**

**Onde:** `src/services/supabaseService.js:429`

**O defeito:** Quando existe um perfil com o mesmo e-mail, o código faz UPDATE da PK (id) do clinical_profile. Nos esquemas do repositório (clean_database_v3.sql linhas 42-75) wound_entries.patient_id e doctor_patient_assignment.doctor_id/patient_id referenciam clinical_profile(id) apenas com ON DELETE CASCADE (sem ON UPDATE CASCADE), então a troca de id falha por violação de FK sempre que o perfil pré-existente já tiver registros. Pior: se o UPDATE der certo mas o SELECT seguinte (linhas 433-437) falhar, não há return e a execução continua até o INSERT da linha 505 com o mesmo id, que falha por PK duplicada; sem return, cai no throw da linha 568 e o catch devolve getLocalProfile (normalmente null).

**Como falha:** O médico pré-cadastra o paciente pelo e-mail e já registra 3 evoluções de ferida. O paciente se cadastra com o mesmo e-mail e faz login: o UPDATE do id falha por FK, o fluxo tenta inserir um perfil novo, também falha, e getClinicalProfile devolve null. O paciente entra com prontuário vazio, sem histórico e sem mensagem de erro.

**Código atual:**

```jsx
const { error: updateError } = await supabase
              .from('clinical_profile')
              .update({ id: resolvedId })
              .eq('id', existingEmailProfile.id);
```

**Correção sugerida:** Não alterar a PK: manter o id antigo e gravar o vínculo (auth_user_id) em coluna própria, com `return` explícito em cada ramo de erro.

<details><summary>Verificação feita contra o código</summary>

Confirmei o UPDATE da PK nas linhas 427-430 e a ausência de ON UPDATE CASCADE: no clean_database_v3.sql as FKs wound_entries.patient_id (44) e doctor_patient_assignment.doctor_id/patient_id (74-75) declaram apenas ON DELETE CASCADE. Confirmei também o defeito de fluxo puro: se o UPDATE der certo mas o SELECT de 433-437 falhar, não há `return` — a execução escapa do bloco `if (existingEmailProfile)` e segue para o INSERT da linha 505 com o mesmo id (agora duplicado); sem return, chega ao `throw error` da linha 568 e o catch (636-639) devolve getLocalProfile, normalmente null. Perda silenciosa de histórico.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0184 · ALTO · `CONFIRMADO`

**Auto-criação de perfil força role 'patient', rebaixando médicos e enfermeiros**

**Onde:** `src/services/supabaseService.js:495`

**O defeito:** Quando getClinicalProfile recebe PGRST116 (perfil inexistente) ele insere um perfil novo com role fixo 'patient', ignorando user.user_metadata.role que o próprio signUpUser gravou no Auth (linha 198). Esse caminho é alcançado sempre que o upsert do cadastro falha, pois na linha 231 o erro do upsert é apenas logado com console.warn e o fluxo prossegue como sucesso.

**Como falha:** Um médico se cadastra; o upsert em clinical_profile falha por RLS/coluna ausente (apenas warn no console). Ele confirma o e-mail e faz login: getClinicalProfile não encontra o perfil, cria um novo com role='patient'. O médico entra no app como paciente — vê o dashboard de paciente, perde acesso a doctor-dashboard, prescriptions e protocols, e nenhuma mensagem de erro é exibida.

**Código atual:**

```jsx
const payload = {
            id: user.id,
            role: 'patient',
            name: name,
            email: user.email,
```

**Correção sugerida:** Usar `role: user.user_metadata?.role || 'patient'` no payload de auto-criação do perfil.

<details><summary>Verificação feita contra o código</summary>

O payload das linhas 493-503 fixa `role: 'patient'` mesmo tendo `user` (session.user) em mãos com user_metadata.role gravado em signUpUser (linha 198); o nome é lido de user_metadata (416) mas o role não. O caminho é alcançável: o upsert do cadastro (227-231) só emite console.warn em caso de erro e o fluxo segue como sucesso — e nenhum dos clean_database*.sql do repositório sequer declara a coluna verification_status enviada no payload (223), o que torna a falha do upsert bastante provável. Rebaixo de crítico para alto por depender dessa precondição.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0185 · ALTO · `CONFIRMADO`

**updateClinicalProfile silencia o erro remoto e retorna o perfil, exibindo 'sucesso' para dado não salvo**

**Onde:** `src/services/supabaseService.js:743`

**O defeito:** No catch a função grava o perfil no localStorage e retorna profile (valor truthy), sem sinalizar a falha. UserProfileModal (linha 290) e AccessibleDashboard tratam qualquer retorno truthy como sucesso.

**Como falha:** O paciente corrige alergias e medicações em uso; o update no Supabase falha (RLS, coluna ausente, offline). O modal exibe 'Perfil atualizado com sucesso!' e fecha. O dado existe apenas no localStorage daquele navegador: o médico que abre o prontuário em outro dispositivo continua vendo a alergia antiga e pode prescrever medicamento contraindicado.

**Código atual:**

```jsx
} catch (err) {
    console.error('Erro ao atualizar perfil no Supabase:', err);
    saveLocalProfile(userId, profile);
```

**Correção sugerida:** Re-lançar o erro (ou retornar `{ ok:false, profile }`) após o fallback local, para a UI exibir 'salvo apenas neste dispositivo'.

<details><summary>Verificação feita contra o código</summary>

Catch das linhas 742-755: loga o erro, chama saveLocalProfile, sincroniza irec_active_user e faz `return profile` — indistinguível do caminho de sucesso (741), que retorna o mesmo objeto. Não há flag de erro nem re-throw. O chamador não tem como saber que o update falhou. Dado clínico afetado (alergias, medicações) fica divergente entre dispositivos.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0186 · ALTO · `CONFIRMAR-SCHEMA`

**Qualquer erro em getWoundEntries apresenta o histórico clínico como vazio em vez de erro**

**Onde:** `src/services/supabaseService.js:901`

**O defeito:** O select embute a relação wound_entry_attachments(*) — tabela que não existe em nenhum dos clean_database*.sql do repositório. Qualquer erro (relação ausente, RLS, rede) cai no catch e devolve getLocalEntries(resolvedId), que no modo Supabase nunca é populado (addWoundEntry só grava local no fallback). O resultado é um array vazio indistinguível de 'paciente sem registros'.

**Como falha:** O paciente com 12 evoluções registradas abre 'history': a tela mostra 'nenhum registro encontrado'. Ele registra tudo de novo, gerando duplicatas. O médico abre o mesmo prontuário e também vê a lista vazia, concluindo que o paciente não fez acompanhamento.

**Código atual:**

```jsx
} catch (err) {
    console.error('Erro ao buscar histórico do Supabase:', err);
    return getLocalEntries(resolvedId);
  }
```

**Correção sugerida:** Propagar o erro (ou retornar `{ error, entries }`) para a tela distinguir 'falha ao carregar' de 'sem registros'.

<details><summary>Verificação feita contra o código</summary>

O select embute `wound_entry_attachments(*)` (860) e confirmei por grep que essa tabela não é criada em nenhum *.sql do repositório — qualquer erro (relação ausente, RLS, rede) cai no catch 899-902 e devolve getLocalEntries(resolvedId). No modo Supabase esse cache só é populado pelo caminho de falha do addWoundEntry (1088-1089), então na prática retorna [], indistinguível de 'paciente sem registros'. Nenhuma guarda diferencia erro de lista vazia.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0187 · ALTO · `CONFIRMADO`

**addWoundEntry no modo local pode estourar a cota do localStorage e perder a triagem sem tratamento**

**Onde:** `src/services/supabaseService.js:956`

**O defeito:** No ramo !isSupabaseConfigured a foto e todos os anexos são convertidos para base64 e concatenados em irec_entries_<id> sem nenhuma chamada a validateFileSize (que só é usada no ramo Supabase, linha 962). A chamada saveLocalEntries das linhas 955-956 está fora de qualquer try/catch, então o QuotaExceededError do localStorage propaga como exceção não tratada e o registro é totalmente perdido.

**Como falha:** Modo contingência em um tablet: o paciente fotografa a ferida (foto de 4 MB, ~5,4 MB em base64) e envia a triagem. localStorage estoura a cota de ~5 MB, saveLocalEntries lança QuotaExceededError, a Promise de addWoundEntry rejeita e o ClinicalTriage quebra no meio do salvamento. A triagem — incluindo a análise de IA já realizada — é perdida e nenhuma mensagem clara é exibida.

**Código atual:**

```jsx
const newEntry = { ...entry, patientId, id: Date.now(), photo: photoUrl, attachments: base64Attachments };
    const localEntries = getLocalEntries(patientId);
    saveLocalEntries(patientId, [...localEntries, newEntry]);
```

**Correção sugerida:** Chamar validateFileSize também no ramo local e envolver saveLocalEntries em try/catch com mensagem clara de cota esgotada.

<details><summary>Verificação feita contra o código</summary>

No ramo `!isSupabaseConfigured` (927-958) não há nenhuma chamada a validateFileSize — ela só aparece no ramo Supabase (962) e nos anexos (1026). A foto e todos os anexos viram base64 (934, 949) e as linhas 955-956 (getLocalEntries + saveLocalEntries) estão fora de qualquer try/catch, então um QuotaExceededError rejeita a Promise de addWoundEntry. Base64 infla ~33%, o que torna o estouro realista com fotos de celular no limite típico de 5MB por origem.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0188 · ALTO · `CONFIRMADO`

**Fotos de ferida e exames são gravados como URL pública permanente; getSecureMediaUrl nunca é usado**

**Onde:** `src/services/supabaseService.js:975`

**O defeito:** addWoundEntry, uploadAvatar (linha 803), sendChatMessage (linha 2153), uploadProfessionalCredential (linha 2863) e os anexos (linha 1037) usam getPublicUrl e persistem essa URL pública no banco. A função getSecureMediaUrl (linha 101), documentada como 'LGPD sensitive media security (signed URLs with 15 minutes expiration)', é exportada mas não é chamada em nenhum arquivo do projeto (verificado por grep em todo src/). As políticas de storage nos SQLs (clean_database.sql linhas 96-110) são de leitura pública nos buckets wounds e exams.

**Como falha:** Um paciente envia a foto da lesão no genital/mama. A URL final (https://<proj>.supabase.co/storage/v1/object/public/wounds/1739...jpg) fica gravada em wound_entries.photo_url e é acessível para sempre por qualquer pessoa que tenha o link, sem autenticação, inclusive após a exclusão da conta. O mesmo vale para o documento do CRM enviado no cadastro e para os anexos de chat.

**Código atual:**

```jsx
const { data: { publicUrl } } = supabase.storage
        .from('wounds')
        .getPublicUrl(filePath);

      photoUrl = publicUrl;
```

**Correção sugerida:** Persistir apenas o filePath no banco e resolver a exibição via getSecureMediaUrl (signed URL) nos componentes.

<details><summary>Verificação feita contra o código</summary>

Verifiquei getPublicUrl persistido em addWoundEntry (975-979 → photo_url no payload, 999), uploadAvatar (803-813), anexos (1037-1062) e uploadProfessionalCredential (2863-2867). Grep em todo src/ mostra getSecureMediaUrl apenas na própria definição (linha 101) — nenhum consumidor. As URLs públicas ficam gravadas em colunas do banco, portanto permanecem válidas indefinidamente mesmo após exclusão lógica do registro. Mitigação parcial: nomes de arquivo contêm timestamp, o que dificulta adivinhação, mas não impede o vazamento por link.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0189 · ALTO · `CONFIRMADO`

**uploadExamFileAndTriage grava valores laboratoriais inventados no prontuário**

**Onde:** `src/services/supabaseService.js:1102`

**O defeito:** A função não lê nem interpreta o arquivo enviado: escolhe entre três strings fixas com resultados numéricos concretos ('Leucócitos: 13.500/mm³', 'HbA1c: 8.2%', 'Refluxo de Safenas') apenas pela examKey e persiste esses alertas em clinical_profile.triage_alerts. Para examKey==='glicose' ela ainda marca has_diabetes = true (linhas 1126 e 1163) sem qualquer evidência do exame.

**Como falha:** Um paciente anexa um hemograma normal identificado como 'hemograma'. O prontuário passa a exibir, para o médico, o alerta '⚠️ Suspeita de Infecção/Inflamação (Leucócitos: 13.500/mm³)' — um valor que não existe no exame. No caso de 'glicose', o paciente é marcado como diabético no prontuário, alterando a estratificação de risco e as recomendações de curativo geradas pela IA.

**Código atual:**

```jsx
if (examKey === 'hemograma') {
    examType = 'Hemograma Completo';
    triageAlert = '⚠️ Suspeita de Infecção/Inflamação (Leucócitos: 13.500/mm³)';
```

**Correção sugerida:** Remover os alertas hardcoded e só gerar triage_alerts a partir de valores efetivamente extraídos do exame (ou informados pelo usuário).

<details><summary>Verificação feita contra o código</summary>

Li 1095-1178: a função recebe `file` mas nunca o lê nem o interpreta — o alerta é escolhido por um if/else sobre examKey (1100-1109) com strings fixas contendo valores numéricos concretos ('Leucócitos: 13.500/mm³', 'HbA1c: 8.2%'), e esses alertas são persistidos em clinical_profile.triage_alerts (1120, 1162). Para examKey==='glicose' ainda há `hasDiabetes: true` (1126) e `has_diabetes: true` (1163) sem qualquer evidência. Valor inventado apresentado ao médico como dado clínico é defeito mesmo sendo proposital.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0190 · ALTO · `CONFIRMADO`

**Backdoor: profissional com 'teste' no nome é listado como se fosse verificado**

**Onde:** `src/services/supabaseService.js:1260`

**O defeito:** Os fallbacks locais de getAllNurses (1260, 1296), getAllDoctors (1309, 1345) e getAllClinicians (1546, 1582) aceitam o perfil quando p.verificationStatus === 'verified' OU quando o nome contém a substring 'teste'. Basta um nome com essa substring para burlar o filtro de homologação.

**Como falha:** Alguém se cadastra como profissional com o nome 'Dr. Teste Silva' e status pendente/rejeitado. No modo contingência (ou em qualquer fallback após erro do Supabase) ele aparece na lista de profissionais oferecida ao paciente em 'doctors_directory' e pode ser contratado, mesmo sem homologação.

**Código atual:**

```jsx
return users.map(u => getLocalProfile(u.id)).filter(p => p && (p.verificationStatus === 'verified' || p.name?.toLowerCase().includes('teste')));
```

**Correção sugerida:** Remover a cláusula `|| p.name?.toLowerCase().includes('teste')` das seis ocorrências (ou envolvê-la em `import.meta.env.DEV`).

<details><summary>Verificação feita contra o código</summary>

Verifiquei as seis ocorrências citadas: 1260 e 1296 (getAllNurses), 1309 e 1345 (getAllDoctors), 1546 e 1582 (getAllClinicians), todas com `p.verificationStatus === 'verified' || p.name?.toLowerCase().includes('teste')`. Não há nenhuma guarda de ambiente (import.meta.env.DEV) em volta. Alcançável por qualquer pessoa que escolha um nome contendo 'teste' no cadastro, e o modo local é o padrão atual do repositório.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0191 · ALTO · `CONFIRMADO`

**checkAppointmentCollision retorna false em qualquer erro e usa dados locais: permite dupla marcação**

**Onde:** `src/services/supabaseService.js:1362`

**O defeito:** A checagem anticolisão depende de getDoctorAppointments, que só devolve dados remotos se data.length > 0 (linha 1514) e cai para o localStorage do próprio navegador caso contrário. Se o paciente não tiver permissão de leitura sobre os agendamentos de outros pacientes (RLS), a consulta remota volta vazia e a verificação passa a olhar apenas os agendamentos locais do próprio paciente. Além disso, qualquer exceção resulta em return false ('não há colisão'), e a sequência ler-depois-inserir não é atômica.

**Como falha:** Dois pacientes diferentes abrem o BookingModal do mesmo médico e escolhem 05/09 às 14:00. Para cada um, a consulta remota volta vazia (ou falha) e a colisão é reportada como false. Os dois pagam e são confirmados para o mesmo horário; o médico recebe dois pacientes simultâneos no mesmo slot.

**Código atual:**

```jsx
} catch (err) {
    console.warn('[iRec] Erro ao verificar colisão de horário:', err);
    return false;
  }
```

**Correção sugerida:** Em caso de erro, retornar true (ou lançar) para bloquear a marcação, e garantir unicidade no banco com UNIQUE(doctor_id, appointment_date, appointment_time).

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois pontos: o catch das linhas 1361-1364 retorna false ('sem colisão') para qualquer exceção, e getDoctorAppointments só aceita o resultado remoto quando `!error && data && data.length > 0` (1514) — uma lista remota vazia (por RLS ou por a tabela não existir) faz a checagem cair para `getLocalAppointments().filter(...)` (1504), isto é, os agendamentos do próprio navegador. A sequência ler-em-1390 / inserir-em-1432 também não é atômica. Falha aberta (fail-open) em verificação de disponibilidade.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0192 · ALTO · `CONFIRMADO`

**Falha no insert do agendamento é apenas console.warn: paciente vê sucesso e o médico nunca recebe a consulta**

**Onde:** `src/services/supabaseService.js:1433`

**O defeito:** createAppointment grava sempre no localStorage e trata o erro do Supabase apenas com console.warn, retornando newApp. O BookingModal (linha 78) interpreta qualquer retorno truthy como sucesso e avança para a tela de confirmação de pagamento. Note ainda que id é gerado como string `app_${Date.now()}` e enviado como PK da tabela appointments (que não existe em nenhum dos clean_database*.sql do repositório), tornando a falha de insert o caminho mais provável.

**Como falha:** O paciente informa dados do cartão, paga R$ 250 e vê 'Agendamento confirmado'. O insert falhou (tabela ausente/RLS/tipo de id incompatível) e a consulta existe só no localStorage daquele navegador. O médico abre 'doctor-agenda' em outro dispositivo e não vê nenhum agendamento; o paciente comparece e não é atendido.

**Código atual:**

```jsx
const { error } = await supabase.from('appointments').insert(payload);
      if (error) console.warn('[iRec] Aviso ao salvar agendamento no Supabase (usando local):', error.message);
```

**Correção sugerida:** Propagar o erro (throw) quando o insert remoto falhar com Supabase configurado, para o BookingModal não confirmar pagamento de uma consulta não persistida.

<details><summary>Verificação feita contra o código</summary>

Linhas 1432-1439: o erro do insert só gera console.warn e a função retorna `newApp` (truthy) de qualquer forma; o catch externo (1434-1436) faz o mesmo. Confirmei ainda por grep nos *.sql do repositório que NÃO existe CREATE TABLE appointments em nenhum arquivo, e o id enviado como PK é a string `app_${Date.now()}` (1401, 1415) — a falha do insert é de fato o caminho mais provável. Nada distingue sucesso de falha para o chamador.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0193 · ALTO · `CONFIRMADO`

**getLocalHealthcareResources devolve hospitais, endereços e telefones inventados para o SOS**

**Onde:** `src/services/supabaseService.js:1986`

**O defeito:** A função gera nomes ('Hospital Geral de <cidade>'), endereços ('Av. Presidente Kennedy, Centro') e telefones por template. O DDD é derivado de um ternário que só conhece SP e RJ e cai em '71' (Salvador) para qualquer outro estado, e ainda é prefixado com 0, produzindo '(011) 3220-4000' — formato inválido para discagem. Nenhum dos dados vem de uma base real.

**Como falha:** Um paciente em Curitiba/PR abre o SOS de emergência com sangramento na lesão. A tela mostra 'Hospital Geral de Curitiba', endereço 'Av. Presidente Kennedy, Centro - Curitiba/PR' e telefone '(071) 3220-4000'. Ele liga para um número inexistente/de outro estado e tenta se deslocar para um endereço que não existe, perdendo tempo em uma emergência.

**Código atual:**

```jsx
phone: `(0${cleanState === 'SP' ? '11' : cleanState === 'RJ' ? '21' : '71'}) 3220-4000`
```

**Correção sugerida:** Substituir por uma base real (ex.: CNES/DataSUS) ou exibir apenas os números nacionais confiáveis (192/193) enquanto não houver fonte.

<details><summary>Verificação feita contra o código</summary>

Linhas 1981-2006: nomes, endereços e telefones são todos montados por template a partir de city/state; a linha 1986 é literalmente `(0${cleanState === 'SP' ? '11' : cleanState === 'RJ' ? '21' : '71'}) 3220-4000`, produzindo DDD 71 (Salvador) para qualquer estado fora SP/RJ e com o prefixo '0' inválido. Não há consulta a nenhuma base real nem aviso na função de que os dados são fictícios. Contexto de emergência agrava o dano.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0194 · ALTO · `CONFIRMADO`

**getChatMessages devolve as 200 mensagens MAIS ANTIGAS: conversas longas congelam**

**Onde:** `src/services/supabaseService.js:2039`

**O defeito:** A query combina .order('created_at', { ascending: true }) com .limit(200). O PostgREST aplica o LIMIT após a ordenação crescente, logo retorna as 200 primeiras mensagens da conversa e descarta todas as posteriores. Para paginar do fim seria necessário ordenar decrescente e reverter no cliente.

**Como falha:** Médico e paciente trocam 210 mensagens ao longo do tratamento. Ao reabrir o chat, o paciente vê apenas as 200 mensagens iniciais; as 10 últimas (que podem conter a orientação de curativo mais recente) desaparecem da tela. Cada nova mensagem enviada aparece na hora via BroadcastChannel/otimismo local, mas some no próximo carregamento — dando a impressão de mensagem perdida.

**Código atual:**

```jsx
.order('created_at', { ascending: true })
      .limit(200);
```

**Correção sugerida:** Ordenar `{ ascending: false }` com limit(200) e inverter o array no cliente antes de retornar.

<details><summary>Verificação feita contra o código</summary>

Linhas 2034-2039: `.order('created_at', { ascending: true }).limit(200)`. O PostgREST traduz para ORDER BY ... ASC LIMIT 200, retornando as 200 primeiras linhas da conversa. Não há offset, range nem paginação em nenhum ponto da função, e o fallback local (2058-2062) não tem limite — o que torna o comportamento inconsistente entre os dois modos. Cenário alcançável em qualquer tratamento longo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0195 · ALTO · `CONFIRMADO`

**placeTelemedicineCall difunde um id local antes do insert, e a chamada nunca conecta entre abas**

**Onde:** `src/services/supabaseService.js:2217`

**O defeito:** O postMessage INCOMING_CALL é disparado antes do insert no Supabase, carregando o id temporário `call_${Date.now()}`. No modo Supabase a função retorna depois {...newCall, id: data.id} (id bigint real, linha 2242) e nunca chama saveLocalCalls. O receptor que recebeu o evento fica com id 'call_...'; ao aceitar, updateCallStatus calcula isNumericId=false (linha 2259), cai no ramo local, não encontra a chamada em irec_local_calls (vazio) e retorna false sem atualizar o banco. O CALL_STATUS_UPDATE difundido leva o id 'call_...', que não bate com o activeCall.id numérico do emissor (Telemedicine.jsx linha 440).

**Como falha:** Médico e paciente logados em duas abas/janelas do mesmo navegador (cenário de teste e de consulta em desktop compartilhado). O médico liga; o paciente ouve o toque e clica em Aceitar. Nada acontece: o status não é gravado no banco, o emissor continua na tela 'chamando...' até o timeout, e a chamada nunca é estabelecida. Nenhum erro é exibido.

**Código atual:**

```jsx
if (chatChannel) {
    chatChannel.postMessage({ type: 'INCOMING_CALL', call: newCall });
  }

  if (!isSupabaseConfigured) {
```

**Correção sugerida:** Fazer o insert primeiro e só então difundir o INCOMING_CALL já com o id definitivo retornado pelo banco.

<details><summary>Verificação feita contra o código</summary>

Confirmado linha a linha: o postMessage INCOMING_CALL ocorre em 2216-2218 com `newCall.id = 'call_<ts>'` (2209), antes do insert; no ramo Supabase o retorno é `{...newCall, id: data.id}` (2242) e saveLocalCalls NÃO é chamado no caminho de sucesso (só nos ramos local 2223 e catch 2247). No receptor, updateCallStatus calcula `isNumericId = /^\d+$/.test('call_...')` = false (2259) e entra no ramo local (2261), onde getLocalCalls está vazio → findIndex -1 → return false, sem tocar no banco. O CALL_STATUS_UPDATE (2255-2257) também carrega o id 'call_...', divergente do id numérico do emissor.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0196 · ALTO · `CONFIRMADO`

**Chave da API Infosimples é lida de variável VITE_* (embutida no bundle) e enviada na query string**

**Onde:** `src/services/supabaseService.js:2875`

**O defeito:** Toda variável com prefixo VITE_ é inlinada no JavaScript publicado pelo Vite. A chave é ainda concatenada na URL via URLSearchParams (token=...), ficando exposta em logs de proxy, histórico e Referer. Além disso, o catch (linha 2925) devolve { success: true, status: 'pending' } — uma falha de comunicação é reportada como sucesso.

**Como falha:** Após o deploy, qualquer visitante abre o bundle em /assets/index-*.js, procura por 'infosimples' e extrai o token, podendo consumir a cota paga da conta. Em ambiente de rede corporativa o token também aparece na URL registrada pelos proxies.

**Código atual:**

```jsx
const apiKey = import.meta.env.VITE_INFOSIMPLES_API_KEY;
```

**Correção sugerida:** Chamar a Infosimples a partir de uma Edge Function do Supabase com a chave em secret de servidor, nunca via VITE_*.

<details><summary>Verificação feita contra o código</summary>

Linha 2875 usa `import.meta.env.VITE_INFOSIMPLES_API_KEY` — o Vite inlineia literalmente toda variável com prefixo VITE_ no bundle publicado, portanto a chave fica legível em /assets/index-*.js. Confirmei também a concatenação na URL via URLSearchParams (2884-2896, `token: apiKey`) e o catch das linhas 2925-2932 devolvendo `{ success: true, status: 'pending' }` para falha de comunicação. Hoje a chave não existe no .env, então a exposição ainda não materializou, mas o padrão é o defeito.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0197 · ALTO · `CONFIRMAR-SCHEMA`

**updateVerificationStatus é chamável pelo cliente sem verificação de papel (admin identificado por e-mail)**

**Onde:** `src/services/supabaseService.js:2951`

**O defeito:** A função executa um UPDATE direto em clinical_profile.verification_status para qualquer userId, sem checar o papel do chamador. A única barreira é a interface: App.jsx linha 108 define isAdmin = currentUser.email === 'admin@irec.com'. O mesmo vale para getAllProfiles (linha 2628), que faz select('*') de todos os perfis (nome, e-mail, telefone, cidade, CRM) sem restrição de papel no serviço.

**Como falha:** Um profissional com cadastro pendente abre o console do navegador na própria sessão e chama o módulo do serviço (ou reproduz a chamada REST com o anon key e seu JWT) executando update verification_status='verified' no próprio id. Sem RLS restritiva, ele se autohomologa e passa a ser listado no diretório de profissionais para os pacientes.

**Código atual:**

```jsx
const { error } = await supabase
      .from('clinical_profile')
      .update({ verification_status: status })
      .eq('id', userId);
```

**Correção sugerida:** Mover a homologação para uma Edge Function/RPC com SECURITY DEFINER que valide o papel de admin no servidor, e restringir o UPDATE por RLS.

<details><summary>Verificação feita contra o código</summary>

O trecho existe como descrito: updateVerificationStatus (2935-2962) faz UPDATE direto em clinical_profile.verification_status para qualquer userId sem checar o papel do chamador, e getAllProfiles faz select('*') sem restrição — a única barreira é a UI (isAdmin por e-mail em App.jsx). Não consigo confirmar a exploração real: nenhum dos *.sql do repositório define políticas RLS para clinical_profile (a coluna verification_status sequer é criada neles), então o resultado depende do que está aplicado no projeto Supabase real. Mantenho alto porque autorização exclusivamente client-side em fluxo de homologação profissional é falha de projeto independentemente do RLS.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0407 · MÉDIO · `CONFIRMADO`

**JSON.parse sem try/catch em todos os helpers de localStorage derruba o app com um único valor corrompido**

**Onde:** `src/services/supabaseService.js:4`

**O defeito:** Todos os acessos ao localStorage fazem JSON.parse direto: getLocalUsers (4), getLocalProfile (9), getLocalEntries (73), getLocalAssignments (80), getActiveUserId (386), getLocalAppointments (1350), getLocalDocuments (1850), getLocalMessages (2015), getLocalCalls (2018), getRecommendedMaterials (2495) e os leitores admin (2660, 2699, 2717, 2734). Vários são chamados fora de try/catch — por exemplo getLocalAppointments em createAppointment (1408) e getActiveUserId em getClinicalProfile (396).

**Como falha:** Um QuotaExceededError durante um setItem (foto grande em base64) deixa 'irec_entries_<id>' truncado, ou o usuário edita a chave manualmente. Na próxima abertura, JSON.parse lança SyntaxError dentro de getActiveUserId/getLocalAppointments; a exceção sobe até o componente e a tela fica em branco, sem qualquer caminho de recuperação além de limpar o navegador.

**Código atual:**

```jsx
const getLocalUsers = () => JSON.parse(localStorage.getItem('irec_users') || '[]');
```

**Correção sugerida:** Criar um helper `safeParse(key, fallback)` com try/catch que descarte o valor corrompido, e usá-lo em todos os leitores de localStorage.

<details><summary>Verificação feita contra o código</summary>

Verifiquei a linha 4 (`getLocalUsers`), 9 (getLocalProfile), 73 (getLocalEntries), 80 (getLocalAssignments), 386 (getActiveUserId), 1350 (getLocalAppointments), 2015/2018 (mensagens e chamadas), 2495 e os leitores admin 2660/2699/2717/2734: nenhum tem try/catch. Confirmei também os chamadores sem proteção: getLocalAppointments em createAppointment (1408) e getActiveUserId em getClinicalProfile (396). Rebaixo de alto para médio: a corrupção do valor exige QuotaExceededError durante escrita ou edição manual, cenário pouco frequente, e o dano é tela em branco recuperável limpando o navegador.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0408 · MÉDIO · `CONFIRMAR-SCHEMA`

**getWoundEntries ordena por id (ordem de inserção) e não pela data clínica**

**Onde:** `src/services/supabaseService.js:862`

**O defeito:** A ordenação usa .order('id', { ascending: true }) sobre uma coluna bigint identity (clean_database_v3.sql linha 43), ou seja, ordem de gravação. O campo clínico entry.date é ignorado, e o fallback getLocalEntries não ordena nada.

**Como falha:** O enfermeiro registra hoje, em bloco, os curativos atrasados dos dias 01, 05 e 03 (nessa ordem de digitação). O histórico e o gráfico de evolução da área da ferida exibem a sequência 01 → 05 → 03, desenhando uma piora/melhora que não existe e induzindo o médico a interpretar a evolução da lesão de forma errada.

**Código atual:**

```jsx
.eq('patient_id', resolvedId)
      .order('id', { ascending: true });
```

**Correção sugerida:** Trocar para `.order('date', { ascending: true }).order('id', { ascending: true })` e ordenar também o fallback local.

<details><summary>Verificação feita contra o código</summary>

Linha 862 é `.order('id', { ascending: true })` sobre a PK identity de wound_entries, ou seja, ordem de gravação; o campo clínico `entry.date` (mapeado em 869) é ignorado. O fallback getLocalEntries (linha 71-74) não ordena nada. Cenário de registro retroativo em bloco é realista em enfermagem, mas exige essa condição específica — médio é proporcional.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0409 · MÉDIO · `CONFIRMADO`

**O limite de 5MB de upload é burlável: validateFileSize lança dentro do try e o catch grava base64 local**

**Onde:** `src/services/supabaseService.js:1078`

**O defeito:** Em addWoundEntry, validateFileSize(photoFile) (linha 962) é executado dentro do try; a exceção 'Arquivo muito grande' é capturada pelo catch da linha 1078, que converte o arquivo para base64 e grava a entrada no localStorage, retornando sucesso. O mesmo padrão ocorre em uploadAvatar (validateFileSize na linha 789, catch com fallback base64 na linha 829). Assim, nem o limite é respeitado nem a mensagem chega ao usuário.

**Como falha:** O paciente seleciona uma foto de 18 MB. A validação lança o erro previsto, o catch converte tudo para base64 e tenta salvar no localStorage: ou estoura a cota (registro perdido) ou grava um registro gigante que nunca é sincronizado com o Supabase. Em ambos os casos a UI informa que a triagem foi salva e o médico nunca recebe a imagem.

**Código atual:**

```jsx
} catch (err) {
    console.error('Erro ao salvar entrada no Supabase, caindo para local:', err);
    if (photoFile) {
      try {
        photoUrl = await fileToBase64(photoFile);
```

**Correção sugerida:** Chamar validateFileSize antes do try (ou re-lançar no catch quando o erro for de tamanho), para o limite abortar a operação com mensagem ao usuário.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois pontos: em addWoundEntry, validateFileSize(photoFile) está na linha 962 dentro do try iniciado em 960, e o catch da 1078 converte para base64 (1082) e grava a entrada retornando sucesso (1087-1090); em uploadAvatar, validateFileSize está na 789 dentro do try da 788 e o catch da 829 faz o mesmo (832-838). A mensagem 'Arquivo muito grande' nunca chega ao usuário e o limite não é respeitado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0410 · MÉDIO · `CONFIRMAR-SCHEMA`

**createAppointment grava status divergente do vocabulário lido pela agenda do paciente**

**Onde:** `src/services/supabaseService.js:1429`

**O defeito:** A mesma função usa dois defaults diferentes para o mesmo campo: o registro local recebe status 'Agendado' (linha 1403) e o payload remoto 'confirmed' (linha 1429). O BookingModal envia status 'Agendado', portanto ambos ficam 'Agendado'. Já PatientAppointmentsCalendar conta e filtra por status === 'confirmed' (linhas 114, 148-150) e cancelAppointment grava 'canceled' (linha 1488), enquanto checkAppointmentCollision testa 'canceled' e 'Cancelado' (linha 1357). Não existe um vocabulário único de status.

**Como falha:** O paciente conclui o pagamento de uma consulta. Em 'my-appointments' os contadores 'Próximas consultas', 'Online' e 'Presencial' mostram 0 porque nenhuma consulta tem status 'confirmed'; o cartão da consulta aparece na lista apenas pela regra de data, e o botão de entrar na teleconsulta depende de comparações de status que não casam.

**Código atual:**

```jsx
payment_status: appointmentData.paymentStatus || 'paid',
        status: appointmentData.status || 'confirmed'
```

**Correção sugerida:** Padronizar um único vocabulário de status ('confirmed'/'canceled') em createAppointment, cancelAppointment e nos componentes que leem.

<details><summary>Verificação feita contra o código</summary>

Divergência confirmada: registro local recebe `'Agendado'` (1403) e o payload remoto `'confirmed'` (1429) na mesma função; cancelAppointment grava 'canceled' (1488) enquanto checkAppointmentCollision testa 'canceled' e 'Cancelado' (1357). Grep confirma PatientAppointmentsCalendar.jsx contando por `status === 'confirmed'` nas linhas 148-150, e DoctorAgendaView.jsx:52 precisando aceitar os dois valores. Rebaixo de alto para médio: a linha 114 do calendário tem a guarda `|| app.appointmentDate >= todayStr`, então a consulta ainda aparece na lista; o dano fica nos contadores e nas comparações de status.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0411 · MÉDIO · `CONFIRMADO`

**Agendamentos: resposta remota vazia é tratada como falha e devolve o cache local desatualizado**

**Onde:** `src/services/supabaseService.js:1453`

**O defeito:** getPatientAppointments (1453) e getDoctorAppointments (1514) só aceitam o resultado remoto quando data.length > 0. Uma lista remota legitimamente vazia (todas as consultas removidas/canceladas no servidor) faz a função devolver localApps, que nunca é reconciliado com o servidor.

**Como falha:** A secretária remove no banco os agendamentos de um paciente. O paciente abre 'my-appointments' e continua vendo os agendamentos antigos, gravados no localStorage no momento da compra, inclusive com o botão de entrar na teleconsulta. Ele comparece a uma consulta que já não existe.

**Código atual:**

```jsx
if (!error && data && data.length > 0) {
```

**Correção sugerida:** Aceitar o resultado remoto sempre que `!error` (mesmo com data vazio) e usar o local só quando houver erro de fato.

<details><summary>Verificação feita contra o código</summary>

Linhas 1453 e 1514: ambas as funções só retornam o resultado remoto quando `!error && data && data.length > 0`; caso contrário caem no `return localApps` (1478, 1539), que nunca é reconciliado nem invalidado. Uma lista remota legitimamente vazia é indistinguível de falha, e o cache local nunca expira. Cenário de agendamento removido no servidor é alcançável.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0412 · MÉDIO · `VERIFICAR`

**BroadcastChannel instanciado no topo do módulo sem detecção de suporte pode quebrar o app no WebView**

**Onde:** `src/services/supabaseService.js:2013`

**O defeito:** A única guarda é typeof window !== 'undefined'. Em WebViews que não implementam BroadcastChannel (WKWebView do iOS anterior ao 15.4, WebViews antigos do Android usados pelo Capacitor 8, e alguns modos privados), 'new BroadcastChannel' lança ReferenceError/TypeError durante a avaliação do módulo — antes de qualquer render, e sem try/catch.

**Como falha:** O app empacotado com Capacitor é aberto em um iPhone com iOS antigo. O import de supabaseService (feito por App.jsx e praticamente todos os componentes) lança na linha 2013 e o aplicativo abre em tela branca, sem tela de login e sem mensagem de erro.

**Código atual:**

```jsx
const chatChannel = typeof window !== 'undefined' ? new BroadcastChannel('irec_telemedicine_signaling') : null;
```

**Correção sugerida:** Trocar por `typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('irec_telemedicine_signaling') : null` dentro de um try/catch.

<details><summary>Verificação feita contra o código</summary>

O código é exatamente o descrito: linha 2013, `new BroadcastChannel(...)` no escopo de módulo, com a única guarda `typeof window !== 'undefined'` e sem try/catch — se a API não existir, o erro ocorre durante a avaliação do módulo, antes de qualquer render, e derruba tudo que o importa. O que não consigo confirmar é a alcançabilidade: BroadcastChannel é suportado no Safari/WKWebView desde 15.4 e no Chrome Android há muito mais tempo, e o Capacitor 8 já exige plataformas mais novas — o alvo real seria uma fatia residual de dispositivos. Rebaixo de médio... mantenho médio pela severidade do modo de falha (tela branca total).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0413 · MÉDIO · `CONFIRMADO`

**getAllReceivedMessages também devolve as 200 mensagens mais antigas, travando o contador de não lidas**

**Onde:** `src/services/supabaseService.js:2082`

**O defeito:** Mesma combinação incorreta de order ascendente com limit: a função devolve as 200 primeiras mensagens recebidas pelo usuário, não as mais recentes. Essa lista alimenta a detecção de mensagens novas e o badge de não lidas do Telemedicine.

**Como falha:** Um médico com histórico de mais de 200 mensagens recebidas passa a nunca receber notificação: as mensagens novas de pacientes não estão nas 200 mais antigas, o badge de não lidas fica congelado e o alerta sonoro deixa de tocar ao recarregar a tela.

**Código atual:**

```jsx
.eq('recipient_id', userId)
      .order('created_at', { ascending: true })
      .limit(200);
```

**Correção sugerida:** Ordenar `{ ascending: false }` com limit(200) e reverter no cliente, para trazer sempre as mais recentes.

<details><summary>Verificação feita contra o código</summary>

Linhas 2077-2082 repetem o padrão do item 217: `.eq('recipient_id', userId).order('created_at', { ascending: true }).limit(200)`, retornando as 200 mensagens recebidas mais antigas. A partir da 201ª mensagem recebida, nenhuma mensagem nova entra no conjunto retornado, o que congela qualquer detecção de novidade baseada nessa lista.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0414 · MÉDIO · `CONFIRMAR-SCHEMA`

**updateCallStatus grava 'duration' local mas o restante do sistema lê 'duration_seconds'**

**Onde:** `src/services/supabaseService.js:2266`

**O defeito:** O ramo local grava calls[idx].duration = duration, enquanto o ramo remoto grava a coluna duration_seconds (linha 2276) e os consumidores leem c.duration_seconds || c.durationSeconds (DoctorDashboardAnalytics linha 76). A chave 'duration' nunca é lida.

**Como falha:** Modo contingência: o médico conduz uma teleconsulta de 22 minutos e encerra. Em 'doctor-analytics' a 'Duração média de atendimento' aparece como 0 min, pois o campo gravado (duration) não é o campo lido (duration_seconds).

**Código atual:**

```jsx
calls[idx].status = status;
      calls[idx].duration = duration;
      saveLocalCalls(calls);
```

**Correção sugerida:** Gravar `calls[idx].duration_seconds = duration` nos ramos locais, para casar com o campo lido pelos consumidores.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois ramos locais (2266 e 2287) gravando `calls[idx].duration`, contra o ramo remoto gravando a coluna `duration_seconds` (2276). Nenhuma leitura de `.duration` existe no serviço. Impacto restrito a métrica de duração média em analytics.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0415 · MÉDIO · `CONFIRMAR-SCHEMA`

**getRecommendedMaterials expõe os links de parceria de um médico aos pacientes de outros médicos**

**Onde:** `src/services/supabaseService.js:2524`

**O defeito:** Para um paciente a query é .or('patient_id.is.null,patient_id.eq.<id>'), que não filtra doctor_id. As linhas globais de qualquer médico (patient_id null, doctor_id preenchido) satisfazem patient_id.is.null e são devolvidas a todos os pacientes. No ramo local (linha 2502) o problema é o mesmo e ainda atinge a chamada (null, null) usada pelo AdminDashboard/AdminPartners, que deveria devolver só parceiros da plataforma (o ramo remoto equivalente filtra também doctor_id, linha 2533).

**Como falha:** O médico A cadastra em 'doctor-partners' seus links de afiliado. Um paciente que só é acompanhado pelo médico B abre 'protocols' e recebe as recomendações comerciais do médico A. No painel de admin (modo local), esses itens privados aparecem como parceiros da plataforma e podem ser excluídos pelo admin em AdminPartners.

**Código atual:**

```jsx
.select('*')
        .or(`patient_id.is.null,patient_id.eq.${patientId}`);
```

**Correção sugerida:** Na consulta do paciente, restringir as linhas globais a `doctor_id.is.null` além das do médico vinculado ao paciente.

<details><summary>Verificação feita contra o código</summary>

Linha 2524: `.or('patient_id.is.null,patient_id.eq.<id>')` sem nenhum filtro sobre doctor_id — qualquer linha global de qualquer médico (patient_id null, doctor_id preenchido) satisfaz a primeira condição. O ramo local (2502-2504) repete o problema com `!item.patient_id || ...` e atinge inclusive a chamada (null, null) do admin, enquanto o ramo remoto equivalente filtra corretamente `.is('doctor_id', null)` (2533) — a inconsistência confirma que o comportamento não é intencional. Impacto é exposição comercial, não dado clínico.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0416 · MÉDIO · `CONFIRMADO`

**Chave de localStorage inexistente 'irec_local_wound_entries' zera métricas de triagem**

**Onde:** `src/services/supabaseService.js:2661`

**O defeito:** getAdminStats (2661), getAdminWoundEntries (2734) e getDoctorPatientsWoundEntries (2754) leem a chave 'irec_local_wound_entries', mas as entradas de ferida são gravadas por saveLocalEntries em chaves por paciente: `irec_entries_${userId}` (linha 77). Nenhum trecho do projeto escreve em 'irec_local_wound_entries' (verificado por grep). Os três leitores retornam sempre [].

**Como falha:** Modo contingência: 30 triagens de ferida foram registradas por pacientes. O admin abre 'admin-metrics' e vê 'Triagens: 0'; o médico abre 'doctor-analytics' e vê 0 casos clínicos, 0% de retorno de paciente e nenhum gráfico de evolução, embora os dados existam em irec_entries_<id>.

**Código atual:**

```jsx
const triages = JSON.parse(localStorage.getItem('irec_local_wound_entries') || '[]');
```

**Correção sugerida:** Agregar as entradas varrendo as chaves `irec_entries_*` do localStorage em vez de ler a chave inexistente.

<details><summary>Verificação feita contra o código</summary>

Grep em todo src/ mostra `irec_local_wound_entries` apenas em três leituras (2661, 2734, 2754) e em nenhuma escrita. As entradas de ferida são gravadas por saveLocalEntries em `irec_entries_${userId}` (linha 77). Os três leitores retornam [] sempre. Rebaixo para médio: são painéis de métricas/analytics, não perda de dado clínico — os registros continuam íntegros em irec_entries_<id>.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0417 · MÉDIO · `CONFIRMADO`

**getAdminStats conta role 'nurse', papel que o cadastro nunca cria**

**Onde:** `src/services/supabaseService.js:2677`

**O defeito:** getAdminStats conta enfermeiros por role='nurse' (linhas 2666 e 2677), mas o cadastro grava enfermeiros com role='doctor' e apenas muda a especialidade (Login.jsx linhas 620-623 mantêm role 'doctor' e ajustam clinicianType). Coerentemente, getAllNurses (linha 1266) busca role='doctor' filtrando a especialidade por palavras-chave. As duas leituras usam critérios incompatíveis para a mesma entidade.

**Como falha:** Existem 8 enfermeiros estomaterapeutas cadastrados e listados no diretório de enfermeiros. O admin abre 'admin-metrics' e vê 'Enfermeiros: 0' e 'Médicos: 8', porque a contagem por role nunca encontra 'nurse'. Qualquer usuário que venha a ser gravado com role='nurse' fica invisível em getAllNurses, getAllDoctors e getAllClinicians simultaneamente.

**Código atual:**

```jsx
supabase.from('clinical_profile').select('id', { count: 'exact', head: true }).eq('role', 'nurse'),
```

**Correção sugerida:** Contar enfermeiros pelo mesmo critério de getAllNurses (role='doctor' + especialidade de enfermagem) ou passar a gravar role='nurse' de forma consistente em todo o serviço.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas duas pontas: getAdminStats conta `u.role === 'nurse'` (2666) e `.eq('role','nurse')` (2677), enquanto getAllNurses busca `role='doctor'` filtrando a especialidade por palavras-chave (1259, 1267 + isNurseSpecialty 1253-1256). Grep em src/ não encontra nenhuma atribuição `role: 'nurse'`; Login.jsx usa a variável `clinicianType` ('doctor'/'nurse', linhas 81, 605, 620) apenas para rótulos e especialidades, mantendo role 'doctor'. Contagem sempre 0.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0418 · MÉDIO · `CONFIRMADO`

**Chave de localStorage inexistente 'irec_local_assignments' quebra vínculos médico-paciente no admin e nas analytics**

**Onde:** `src/services/supabaseService.js:2717`

**O defeito:** getAdminAssignments (2717) e getDoctorPatientsWoundEntries (2752) leem 'irec_local_assignments', mas followPatient grava via saveLocalAssignments na chave 'irec_assignments' (linha 81). Chaves de escrita e leitura divergem, então o retorno é sempre [].

**Como falha:** Modo contingência: o médico segue 5 pacientes (gravados em irec_assignments). O painel admin-metrics mostra 'Vínculos: 0' e o cálculo de pacientes por médico fica vazio; em doctor-analytics a lista de feridas dos pacientes acompanhados também retorna vazia porque docPatientIds fica [].

**Código atual:**

```jsx
return JSON.parse(localStorage.getItem('irec_local_assignments') || '[]');
```

**Correção sugerida:** Trocar a chave lida para 'irec_assignments' nas linhas 2717 e 2752.

<details><summary>Verificação feita contra o código</summary>

Grep confirma `irec_local_assignments` apenas nas leituras 2717 e 2752, sem nenhuma escrita; saveLocalAssignments grava em `irec_assignments` (linha 81) e followPatient usa esse helper (1591-1594). Retorno sempre []. Rebaixo para médio pelo mesmo motivo do item 220: afeta contadores e analytics, não o vínculo em si.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0419 · MÉDIO · `CONFIRMAR-SCHEMA`

**getDoctorTelemedicineCalls filtra por snake_case dados gravados em camelCase (sempre vazio no modo local)**

**Onde:** `src/services/supabaseService.js:2789`

**O defeito:** O fallback local filtra c.caller_id / c.receiver_id, mas placeTelemedicineCall grava em irec_local_calls objetos com as chaves callerId e receiverId (linhas 2208-2213). O filtro nunca casa e o array retornado é sempre vazio.

**Como falha:** No modo contingência, o médico realiza 10 teleconsultas e abre 'doctor-analytics'. DoctorDashboardAnalytics recebe calls=[] e exibe 'Atendimentos Realizados: 0' e 'Duração média: 0 min', embora as chamadas estejam gravadas em irec_local_calls.

**Código atual:**

```jsx
const allCalls = JSON.parse(localStorage.getItem('irec_local_calls') || '[]');
    return allCalls.filter(c => c.caller_id === doctorId || c.receiver_id === doctorId);
```

**Correção sugerida:** Filtrar aceitando as duas convenções: `(c.callerId || c.caller_id) === doctorId || (c.receiverId || c.receiver_id) === doctorId`.

<details><summary>Verificação feita contra o código</summary>

Linha 2789 filtra `c.caller_id === doctorId || c.receiver_id === doctorId`, enquanto placeTelemedicineCall grava em irec_local_calls o objeto com as chaves camelCase `callerId`/`receiverId` (2210-2211). As chaves nunca coincidem, logo o retorno é sempre []. Rebaixo de alto para médio: o impacto é restrito a métricas de analytics no modo contingência, sem perda de dado clínico nem risco de segurança.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "supabaseService.js"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
