# 8. Documentos do paciente

**11 defeitos** — 1 crítico · 2 alto · 7 médio · 1 baixo

Arquivos tocados por este módulo:

- `src/components/PatientDocuments.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0017 · CRÍTICO · `CONFIRMADO`

**Documento impresso pelo paciente afirma assinatura digital ICP-Brasil mesmo quando não foi assinado**

**Onde:** `src/components/PatientDocuments.jsx:288`

**O defeito:** O bloco de selo do rodapé é renderizado sem qualquer condicional, afirmando literalmente 'ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)' e que o documento 'foi assinado eletronicamente ... utilizando infraestrutura de chaves públicas credenciada pela Medida Provisória nº 2.200-2/2001'. O conteúdo do documento carrega a flag content.isSigned (gravada em DoctorDashboard.jsx:456 e 485) e a própria tela do médico respeita essa flag: em DoctorDashboard.jsx:3485-3502 há um ramo alternativo que imprime 'DOCUMENTO EMITIDO SEM ASSINATURA DIGITAL'. A cópia do paciente ignora isSigned por completo e sempre afirma o oposto. Somado ao selo 'Especialidade Validada' (linha 228) e ao rodapé 'Documento oficial nos termos da Resolução CFM nº 2.299/2021' (linha 321), o app emite declaração falsa de conformidade legal.

**Como falha:** O médico emite uma receita SEM assinar digitalmente (isSigned = false). Na tela do médico o PDF sai marcado em vermelho como 'DOCUMENTO EMITIDO SEM ASSINATURA DIGITAL'. O paciente abre 'Minhas Receitas e Atestados', clica em 'Visualizar / Imprimir' e recebe o MESMO documento estampado em verde com 'ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)' e menção à MP 2.200-2/2001. O paciente apresenta esse papel na farmácia ou no RH como receita/atestado assinado digitalmente, sem que exista qualquer certificado.

**Código atual:**

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#166534', fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>
  <span>🛡️</span> ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)
</div>
Este documento foi assinado eletronicamente por <strong>Dr(a). {activePrintDoc.content.doctorName}</strong> utilizando infraestrutura de chaves públicas credenciada pela Medida Provisória nº 2.200-2/2001.
```

**Correção sugerida:** Espelhar o condicional de DoctorDashboard.jsx:3485 aqui: renderizar o selo ICP-Brasil só quando activePrintDoc.content?.isSigned e, caso contrário, imprimir o aviso 'DOCUMENTO EMITIDO SEM ASSINATURA DIGITAL'.

<details><summary>Verificação feita contra o código</summary>

Li o bloco das linhas 285-294: o selo 'ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)' e o texto da MP 2.200-2/2001 são renderizados incondicionalmente, sem qualquer referência a content.isSigned. A flag existe e é gravada em DoctorDashboard.jsx:456/485 (isSigned: !!isSigned) e a tela do médico a respeita em DoctorDashboard.jsx:3485 com o ramo alternativo 'DOCUMENTO EMITIDO SEM ASSINATURA DIGITAL' (linha 3498). O médico pode emitir sem assinar (handleIssueDocument só exige certificado quando shouldDigitallySign), logo o cenário é plenamente alcançável. Declaração falsa de conformidade legal na cópia do paciente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0120 · ALTO · `CONFIRMADO`

**Botão 'Visualizar / Imprimir' não faz nada no app Android/iOS (window.print no WebView)**

**Onde:** `src/components/PatientDocuments.jsx:54`

**O defeito:** A única forma de o paciente obter a receita/atestado é window.print(). O projeto é empacotado com Capacitor 8 para Android e iOS (package.json: @capacitor/android ^8.4.2, @capacitor/ios ^8.4.2) e não há nenhum plugin de impressão/compartilhamento instalado. No WebView do Android window.print() não é implementado (não abre diálogo algum) e no WKWebView o comportamento é inconsistente. Não existe try/catch, verificação de disponibilidade, fallback (share sheet, geração de blob) nem qualquer mensagem ao usuário.

**Como falha:** Paciente instala o app iRec no celular Android, entra em 'Minhas Receitas e Atestados' e toca em 'Visualizar / Imprimir'. Nada acontece: nenhum diálogo, nenhum arquivo, nenhuma mensagem de erro. O paciente não tem nenhuma maneira de obter sua receita pelo aplicativo — que é a plataforma principal do produto.

**Código atual:**

```jsx
const handlePrintDocument = (doc) => {
    setActivePrintDoc(doc);
    setTimeout(() => {
      window.print();
    }, 250);
  };
```

**Correção sugerida:** Detectar Capacitor (Capacitor.isNativePlatform()) e, no nativo, gerar PDF/blob e acionar Share/Filesystem em vez de window.print(), com mensagem de erro se indisponível.

<details><summary>Verificação feita contra o código</summary>

handlePrintDocument (linhas 51-56) usa exclusivamente window.print(), sem try/catch, sem detecção de plataforma e sem fallback. Confirmei em package.json a presença de @capacitor/android e @capacitor/ios ^8.4.2 e a ausência de qualquer plugin de impressão/compartilhamento. No WebView do Android window.print() é no-op (a impressão exige PrintManager nativo), então o único caminho do paciente para obter receita/atestado no app móvel falha em silêncio. Na versão web de desktop funciona, o que limita o alcance, mas o app é a plataforma principal.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0121 · ALTO · `CONFIRMADO`

**Atestado de 'Comparecimento' e de 'Aptidão Física' imprime texto de afastamento total do trabalho**

**Onde:** `src/components/PatientDocuments.jsx:262`

**O defeito:** O corpo do atestado é um texto fixo que sempre declara repouso e 'afastamento total de suas atividades habituais, laborais e acadêmicas' por content.days dias, independentemente de content.atestadoType. O seletor em DoctorDashboard.jsx:2792-2795 oferece três tipos distintos: 'Afastamento', 'Comparecimento' (Declaração de Comparecimento) e 'Aptidão' (Aptidão Física). Só o primeiro corresponde ao texto impresso. O título na linha 259 muda corretamente para 'Declaração de Atestado Clínico (Comparecimento)', mas o parágrafo abaixo continua concedendo afastamento.

**Como falha:** O médico emite uma 'Declaração de Comparecimento' (o paciente apenas compareceu à consulta) com o campo de dias no default '3' (DoctorDashboard.jsx:528). O paciente imprime o documento e ele diz: 'recomendo o seu repouso e afastamento total de suas atividades habituais, laborais e acadêmicas pelo período de 3 dia(s)'. O paciente entrega ao empregador um atestado de 3 dias de afastamento que o médico nunca concedeu. O mesmo ocorre com 'Aptidão Física', que passa a atestar incapacidade.

**Código atual:**

```jsx
Atesto para os devidos fins regulamentares que o(a) paciente acima identificado(a) esteve sob meus cuidados clínicos na data de hoje e <strong>{activePrintDoc.content.reason}</strong>. Em decorrência do quadro, recomendo o seu repouso e afastamento total de suas atividades habituais, laborais e acadêmicas pelo período de <strong>{activePrintDoc.content.days} dia(s)</strong>, contados a partir desta data.
```

**Correção sugerida:** Selecionar o texto do corpo por content.atestadoType (afastamento / comparecimento com horário / aptidão), nunca imprimir afastamento em declaração de comparecimento.

<details><summary>Verificação feita contra o código</summary>

A linha 262 é um parágrafo fixo que sempre declara 'repouso e afastamento total de suas atividades habituais, laborais e acadêmicas pelo período de {content.days} dia(s)', sem nenhuma ramificação por content.atestadoType. Confirmei que o seletor realmente oferece os três tipos (DoctorDashboard.jsx:2793 'Comparecimento' e 2794 'Aptidão'), que atestadoType é gravado no content (DoctorDashboard.jsx:480) e que o título na linha 259 muda mas o corpo não. Também confirmei o default '3' dias (DoctorDashboard.jsx:528). Documento legal com conteúdo contrário ao que o médico emitiu.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0325 · MÉDIO · `CONFIRMAR-SCHEMA`

**Documentos médicos ficam em localStorage após logout (chave irec_medical_documents não é limpa)**

**Onde:** `src/components/PatientDocuments.jsx:13`

**O defeito:** getPatientDocuments cai para getLocalDocuments() (supabaseService.js:1850) que lê/grava a chave 'irec_medical_documents'. O handleLogout de App.jsx:652-668 remove apenas irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab. A chave dos documentos médicos (com CID-10, motivo do atestado, medicações prescritas, nome/CRM do médico) e também 'irec_appointments' permanecem no dispositivo indefinidamente, para qualquer usuário posterior do mesmo navegador.

**Como falha:** Em um tablet compartilhado de posto de saúde, o paciente A usa o app em modo contingência (Supabase indisponível), recebe receita e atestado com CID-10, e faz logout. Os dados clínicos dele continuam legíveis em localStorage['irec_medical_documents'] via DevTools, e nada os apaga — nem o logout, nem o login do paciente B.

**Código atual:**

```jsx
const docs = await getPatientDocuments(clinicalProfile.id);
// supabaseService.js:1850 -> const getLocalDocuments = () => JSON.parse(localStorage.getItem('irec_medical_documents') || '[]');
// App.jsx:661-667 -> nenhum removeItem('irec_medical_documents')
```

**Correção sugerida:** Incluir no handleLogout a limpeza das chaves clínicas locais (irec_medical_documents, irec_appointments, irec_entries_*) ou migrá-las para armazenamento por sessão criptografado.

<details><summary>Verificação feita contra o código</summary>

Li App.jsx:652-668: handleLogout remove apenas irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab. A chave 'irec_medical_documents' (supabaseService.js:1850/1851), que em modo contingência guarda CID-10, motivo do atestado, medicações, nome e CRM do médico, permanece no dispositivo, assim como os agendamentos locais. Em dispositivo compartilhado o dado clínico do paciente anterior fica legível para o próximo usuário.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0326 · MÉDIO · `CONFIRMADO`

**Spinner de carregamento pisca a cada 30s porque o efeito depende do objeto clinicalProfile inteiro**

**Onde:** `src/components/PatientDocuments.jsx:24`

**O defeito:** O primeiro efeito chama loadDocuments(true) — com spinner — e depende de [clinicalProfile], o objeto completo. App.jsx:687-724 mantém um setInterval de 30 segundos que executa getClinicalProfile(currentUser.id) e faz setClinicalProfile(profile) com um OBJETO NOVO a cada ciclo (supabaseService monta um literal novo no map). Como a identidade referencial muda sempre, o efeito re-executa a cada 30 s com showSpinner = true, e o segundo efeito (linha 27-36) destrói e recria o intervalo de 10 s no mesmo ritmo. A dependência correta seria clinicalProfile?.id.

**Como falha:** O paciente deixa a aba 'Minhas Receitas e Atestados' aberta lendo a tela. A cada 30 segundos, sem nenhuma ação dele, a lista de documentos é substituída pelo bloco 'Carregando seus documentos...' e volta em seguida. Se ele estiver com o diálogo de impressão pendente ou rolando a lista, perde a posição. O intervalo de polling de 10 s também é reiniciado a cada 30 s, tornando a frequência real de atualização imprevisível.

**Código atual:**

```jsx
useEffect(() => {
    loadDocuments(true);
  }, [clinicalProfile]);
```

**Correção sugerida:** Trocar as dependências dos dois efeitos para [clinicalProfile?.id].

<details><summary>Verificação feita contra o código</summary>

O efeito da linha 22-24 chama loadDocuments(true) (com spinner) e depende de [clinicalProfile]; o segundo efeito (27-36) também. Confirmei em App.jsx:687-724 o setInterval de 30 s que, para role 'patient', executa getClinicalProfile e faz setClinicalProfile(profile) — um objeto novo a cada ciclo (o serviço monta um literal no mapeamento), então a identidade referencial muda sempre e ambos os efeitos re-executam. O resultado é o bloco 'Carregando...' substituindo a lista a cada 30 s e o intervalo de 10 s sendo recriado no mesmo ritmo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0327 · MÉDIO · `CONFIRMADO`

**Polling de 10s zera a lista quando o Supabase falha: documentos do paciente desaparecem intermitentemente**

**Onde:** `src/components/PatientDocuments.jsx:32`

**O defeito:** O polling silencioso chama loadDocuments(false), que faz setDocuments(docs) sem validar o resultado. getPatientDocuments (supabaseService.js:1923-1927) engole o erro do Supabase e cai para getLocalDocuments(), que lê a chave 'irec_medical_documents' (linha 1850) — vazia em produção, pois os documentos vivem no banco. O resultado é setDocuments([]) sobrescrevendo a lista boa a cada falha de rede, sem nenhuma sinalização ao usuário.

**Como falha:** O paciente está na tela de documentos com 4 receitas listadas. Ocorre uma oscilação de rede (túnel, elevador, sessão expirada). No próximo tick de 10 segundos a consulta falha, o fallback local retorna [] e a tela passa a exibir 'Nenhum documento médico foi emitido para você ainda.' O paciente conclui que suas receitas foram apagadas. Dez segundos depois elas reaparecem, sem explicação.

**Código atual:**

```jsx
const interval = setInterval(() => {
      console.log("[iRec] Polling patient documents in background...");
      loadDocuments(false);
    }, 10000);
```

**Correção sugerida:** Só substituir a lista quando a origem for confiável (ex.: sinalizar erro no serviço e, no polling, preservar o estado anterior + mostrar aviso de falha de sincronização).

<details><summary>Verificação feita contra o código</summary>

loadDocuments (linhas 9-20) faz setDocuments(docs) sem validar o resultado, e o polling de 10 s (linha 30-33) o chama com showSpinner=false. Verifiquei getPatientDocuments (supabaseService.js:1898-1928): o catch engole o erro do Supabase e retorna getLocalDocuments() filtrado — em produção com Supabase ativo essa chave ('irec_medical_documents', linha 1850) está vazia, logo o retorno é [] e a lista boa é sobrescrita por vazio, exibindo o estado 'nenhum documento' sem qualquer aviso. Volta ao normal no tick seguinte.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0328 · MÉDIO · `CONFIRMADO`

**calculateAge imprime 'NaN anos' no documento médico; try/catch nunca captura e Math.abs mascara data futura**

**Onde:** `src/components/PatientDocuments.jsx:44`

**O defeito:** new Date(stringInvalida) não lança exceção — retorna Invalid Date. Logo o try/catch das linhas 40-48 é inalcançável e o caminho de erro 'Idade inválida' nunca executa. Com data inválida, diff = NaN, new Date(NaN).getUTCFullYear() = NaN e Math.abs(NaN - 1970) = NaN, resultando na string 'NaN anos'. Além disso Math.abs converte data de nascimento futura (erro de digitação, ex.: 2062) em idade positiva plausível, em vez de sinalizar o erro. Há ainda deslocamento de fuso: 'yyyy-mm-dd' é parseado como meia-noite UTC, o que pode gerar erro de 1 ano na data do aniversário em UTC-3.

**Como falha:** O perfil do paciente tem birthDate gravado em formato brasileiro ('15/03/1980', vindo de importação ou preenchimento manual) ou qualquer string não-ISO. O paciente imprime sua receita e o campo de identificação sai como 'Idade: NaN anos' em um documento médico oficial que segue afirmando estar validado por certificação ICP-Brasil.

**Código atual:**

```jsx
const birth = new Date(birthDateString);
      const diff = Date.now() - birth.getTime();
      const ageDate = new Date(diff);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return `${age} anos`;
```

**Correção sugerida:** Validar com isNaN(birth.getTime()) e calcular a idade por diferença de ano/mês/dia em hora local, retornando 'Idade não informada' quando inválida.

<details><summary>Verificação feita contra o código</summary>

Linhas 38-49 conferem exatamente com a descrição. new Date('15/03/1980') retorna Invalid Date sem lançar, então o catch da linha 46 é inalcançável e 'Idade inválida' nunca é impresso; diff = NaN propaga até `${age} anos` = 'NaN anos'. Math.abs realmente converte data de nascimento futura em idade positiva plausível, e o parse de 'yyyy-mm-dd' como meia-noite UTC gera erro de 1 ano perto do aniversário em UTC-3. A única guarda existente é a de string vazia (linha 39).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0329 · MÉDIO · `CONFIRMADO`

**Impressão disparada por setTimeout fixo de 250ms; QR Code externo não chega a carregar**

**Onde:** `src/components/PatientDocuments.jsx:53`

**O defeito:** handlePrintDocument chama setActivePrintDoc e agenda window.print() em 250 ms fixos, sem esperar o commit do React nem o carregamento do <img> do QR Code, que vem de um host externo (linha 279, api.qrserver.com). Não há onLoad, Promise, requestAnimationFrame nem verificação de img.complete. Em conexão móvel, 250 ms é insuficiente para uma requisição HTTPS externa.

**Como falha:** Paciente em rede 3G/4G lenta clica em 'Visualizar / Imprimir'. O diálogo de impressão abre em 250 ms, antes de o QR Code chegar; o documento é impresso com um retângulo vazio de 80x80 no lugar do 'QR Code de Autenticidade', embora o mesmo documento afirme (linha 290) que 'a integridade e autenticidade ... podem ser verificadas via QR Code'. Em dispositivos lentos, o diálogo pode abrir antes mesmo de o layout A4 ser comitado, gerando página em branco.

**Código atual:**

```jsx
setActivePrintDoc(doc);
    setTimeout(() => {
      window.print();
    }, 250);
```

**Correção sugerida:** Disparar window.print() no onLoad/onError do <img> do QR (ou após pré-carregar a imagem via Promise), em vez de um setTimeout fixo.

<details><summary>Verificação feita contra o código</summary>

Linhas 51-56: setActivePrintDoc(doc) seguido de window.print() em setTimeout de 250 ms fixos. Não há onLoad no <img> (linha 278-282), nem img.complete, nem requestAnimationFrame. A imagem vem de host externo (api.qrserver.com), então em rede móvel 250 ms é frequentemente insuficiente e o documento sai sem o QR, enquanto o texto da linha 290 afirma que a autenticidade pode ser verificada por ele. O risco de página em branco por commit do React é bem menor (250 ms costuma bastar), mas o do QR é real.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0330 · MÉDIO · `CONFIRMADO`

**QR Code de autenticidade de documento médico é gerado por serviço de terceiros, com vazamento do ID e falha offline**

**Onde:** `src/components/PatientDocuments.jsx:279`

**O defeito:** O 'QR Code de Autenticidade' do documento clínico é montado por requisição a api.qrserver.com (host de terceiros), enviando na query string o identificador do documento médico do paciente. Isso (a) expõe a terceiros o identificador do prontuário/documento e o padrão de acesso (IP, horário, User-Agent do paciente) sem base legal declarada, contrariando o discurso LGPD do app, (b) torna a autenticidade do documento dependente da disponibilidade de um serviço externo gratuito, e (c) quebra totalmente sem internet, situação normal ao imprimir em consultório. Além disso, o app roda com Service Worker/PWA e a imagem não é cacheada.

**Como falha:** Paciente sem internet (ou com o serviço api.qrserver.com fora do ar / bloqueado por proxy corporativo) imprime seu atestado: o documento sai sem QR Code, mas com o texto afirmando que a autenticidade pode ser verificada por ele. Em paralelo, todo acesso de impressão de documento médico é registrado nos logs do terceiro com o ID do documento.

**Código atual:**

```jsx
src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://irec.com.br/validar?code=validation_${activePrintDoc.id}`)}`}
```

**Correção sugerida:** Gerar o QR localmente (biblioteca client-side embarcada, ex.: qrcode) em vez de requisitar api.qrserver.com.

<details><summary>Verificação feita contra o código</summary>

A linha 279 monta o src apontando para https://api.qrserver.com com o identificador do documento médico na query string. Isso é factual: o ID do documento clínico e o padrão de acesso (IP, horário) trafegam para um terceiro sem base legal declarada, a geração do 'selo de autenticidade' depende de serviço externo gratuito e falha sem internet, deixando o documento com o texto da linha 290 afirmando validação por QR que não existe. Mantida a severidade média: não há dado clínico no payload, apenas o identificador.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0331 · MÉDIO · `CONFIRMADO`

**Template literal não interpolado: documento impresso mostra o texto cru '${activePrintDoc.id}'**

**Onde:** `src/components/PatientDocuments.jsx:292`

**O defeito:** A linha está dentro de JSX como texto puro, não dentro de crases. Portanto `${activePrintDoc.id}` NÃO é interpolado — é impresso literalmente. Comparar com a linha 279, onde a mesma expressão está corretamente dentro de um template literal em src={`...`}, e com DoctorDashboard.jsx:3492, que usa a forma correta em JSX ({activePrintDoc.content.signatureDetails?.hash || `validation_${activePrintDoc.id}`}).

**Como falha:** O paciente clica em 'Visualizar / Imprimir' em qualquer receita ou atestado. No rodapé do documento A4 impresso aparece a string literal 'https://irec.com.br/validar (Código: validation_${activePrintDoc.id})' em vez do código real de validação. Quem receber o documento (farmácia, empregador, perícia) não tem como validar a autenticidade, e o papel oficial exibe código-fonte vazado.

**Código atual:**

```jsx
<div style={{ fontWeight: 'bold', color: '#1e3a8a', marginTop: '2px' }}>
  https://irec.com.br/validar (Código: validation_${activePrintDoc.id})
</div>
```

**Correção sugerida:** Trocar por JSX interpolado: {`https://irec.com.br/validar (Código: validation_${activePrintDoc.id})`}.

<details><summary>Verificação feita contra o código</summary>

A linha 292 está dentro de uma <div> como texto JSX puro, sem crases: 'https://irec.com.br/validar (Código: validation_${activePrintDoc.id})'. Em texto JSX, ${...} não é interpolado — sai literalmente no papel. A linha 279 usa a mesma expressão corretamente dentro de src={`...`}, o que confirma a intenção. Ajusto a severidade para médio: o QR Code (que é o meio efetivo de validação) é gerado corretamente, e o dano é o vazamento de código-fonte no rodapé do documento, não um erro clínico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0525 · BAIXO · `CONFIRMAR-SCHEMA`

**Acesso a doc.content sem guarda de null derruba toda a tela de documentos do paciente**

**Onde:** `src/components/PatientDocuments.jsx:171`

**O defeito:** Na listagem, doc.content.atestadoType (linha 171) e doc.content.doctorName (linha 174) são acessados sem optional chaining. content é a coluna jsonb medical_documents.content (supabaseService.js:1876, 1920) e pode chegar null (documento gravado por outra rota, migração, linha legada, ou o caso em que issueDocument recebe type diferente de 'receita'/'atestado' e content fica undefined — DoctorDashboard.jsx:470-499 só popula content nesses dois casos). No layout de impressão o problema se repete em activePrintDoc.content.doctorSpecialty/doctorCrm (linha 222) e content.reason/content.days (linha 262).

**Como falha:** Existe uma linha em medical_documents com content NULL para o paciente. Ele abre a aba 'Documentos': o map estoura com 'TypeError: Cannot read properties of null (reading "atestadoType")' durante o render, o componente inteiro quebra e o paciente perde acesso a TODOS os seus documentos, não apenas ao defeituoso. Na variante em que content existe mas sem doctorName, o cabeçalho exibe 'Dr(a). undefined' e o documento impresso é assinado por 'Dr(a). undefined'.

**Código atual:**

```jsx
{doc.type === 'receita' ? 'Receita Médica' : `Atestado de ${doc.content.atestadoType || 'Afastamento'}`}
```

**Correção sugerida:** Usar doc.content?.atestadoType / activePrintDoc.content?.doctorName etc. e pular (ou marcar como inválido) documentos sem content no map.

<details><summary>Verificação feita contra o código</summary>

Confirmei a ausência de optional chaining nas linhas 171, 174, 222 e 262. Porém o cenário descrito não é alcançável pelo app: o único gravador é issueDocument, chamado exclusivamente em DoctorDashboard.jsx:501 (grep confirma um único chamador), e ali content é inicializado como {} (linha 442) e preenchido nos ramos 'receita'/'atestado' — nunca undefined nem null. O crash exige uma linha em medical_documents com content NULL vinda de fora do app (migração/rota externa). A variante 'Dr(a). undefined' (doctorProfile.name ausente) é real mas cosmética. Falta de defesa legítima, com alcance menor do que o descrito.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "PatientDocuments.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
