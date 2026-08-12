# 2. Telemedicina e chat

**37 defeitos** — 4 crítico · 15 alto · 9 médio · 9 baixo

Arquivos tocados por este módulo:

- `src/components/Telemedicine.jsx`
- `src/components/telemedicine/TelemedicineClinicalCopilot.jsx`
- `src/components/telemedicine/TelemedicineContactsList.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0026 · CRÍTICO · `CONFIRMADO`

**Efeito recria a RTCPeerConnection e vaza a anterior a cada mudança do objeto activeCall**

**Onde:** `src/components/Telemedicine.jsx:592`

**O defeito:** O efeito depende de [callState, activeCall]. activeCall é um objeto substituído por identidade a cada atualização vinda de activeCallSession. Com callState já 'active', qualquer nova identidade dispara initializeWebRTC de novo, sobrescrevendo peerConnectionRef.current sem fechar a conexão anterior. O efeito também não tem função de cleanup.

**Como falha:** Durante a chamada chega qualquer UPDATE em telemedicine_calls (o próprio App.jsx reescreve activeCallSession no realtime). Uma segunda RTCPeerConnection é criada no mesmo callId; as duas passam a trocar offer/candidate. A primeira nunca é fechada e sua inscrição de sinalização nunca é cancelada — a mídia trava e o consumo de rede dobra.

**Código atual:**

```jsx
useEffect(() => {
  if (callState === 'active' && activeCall) {
    const isCaller = activeCall.callerId === currentUser.id;
    initializeWebRTC(activeCall.id, isCaller);   // sem fechar a pc anterior
  } else if (callState === 'idle') {
    endMediaStream();
  }
}, [callState, activeCall]);   // sem cleanup
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0027 · CRÍTICO · `CONFIRMADO`

**Porta do servidor STUN errada (19002 em vez de 19302): videochamada não conecta fora da mesma rede**

**Onde:** `src/components/Telemedicine.jsx:799`

**O defeito:** Os dois servidores STUN do Google estão configurados na porta 19002. A porta correta é 19302. Sem STUN funcionando, o navegador não obtém candidatos server-reflexive e só consegue negociar com pares na mesma rede local.

**Como falha:** Médico em casa e paciente no celular (4G) iniciam a teleconsulta. A chamada entra em estado 'ativa', o cronômetro começa a contar, mas o vídeo remoto nunca aparece: o ICE fica em checking e depois failed. Os dois desligam achando que é problema de internet.

**Código atual:**

```jsx
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19002' },
    { urls: 'stun:stun1.l.google.com:19002' }
  ]
};
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0028 · CRÍTICO · `CONFIRMADO`

**Relatório clínico inventado pela IA é gravado no prontuário real do paciente**

**Onde:** `src/components/Telemedicine.jsx:1056`

**O defeito:** endCall chama analyzeTelemedicineTranscript e trata o retorno como análise real da consulta. Com o .env vazio (isGeminiConfigured === false), geminiService.js:774-788 devolve um objeto FIXO e inventado: executiveSummary 'Paciente relata dor controlada e melhora gradual, mas com secreção leve', symptoms [Dor, Secreção], suggestedPrescriptions [Soro Fisiológico 0.9%, Hidrogel Amorfo] e riskLevel 'Risco Moderado'. Esse conteúdo é exibido no modal 'Evolução Clínica & Triagem: <nome do paciente>' (L3249) e, ao confirmar, é persistido no perfil clínico (updateClinicalProfile, L1123) e enviado ao paciente pelo chat como '📋 Evolução de Telemedicina (Síntese Clínica)' (L1127-1129). Nada na tela indica que a IA não está configurada.

**Como falha:** Médico atende a paciente Maria por vídeo, fala qualquer coisa, encerra a consulta. O modal mostra 'dor controlada, melhora gradual, secreção leve' e sugere Soro Fisiológico + Hidrogel Amorfo — nada disso foi dito. O médico clica 'Confirmar e Gravar Prontuário': o campo medications de Maria passa a conter 'Soro Fisiológico 0.9% (Limpeza diária), Hidrogel Amorfo (...)' e ela recebe no chat uma evolução clínica falsa com 'Risco Estimado: Risco Moderado'.

**Código atual:**

```jsx
const report = await analyzeTelemedicineTranscript(transcriptText, patientProfile || {});
setAiReport(report);
// geminiService.js:775  if (!isGeminiConfigured) { return { executiveSummary: "Consulta por telemedicina realizada com sucesso. Paciente relata dor controlada...", suggestedPrescriptions: [{ name: "Soro Fisiológico 0.9%", ... }] } }
```

**Correção sugerida:** Retornar null quando !isGeminiConfigured (ou marcar report.isMock) e bloquear o modal/gravação exibindo aviso de que a análise por IA não está disponível.

<details><summary>Verificação feita contra o código</summary>

Verifiquei geminiService.js:772-788: com isGeminiConfigured false (env vazio hoje) analyzeTelemedicineTranscript retorna um objeto FIXO ('dor controlada e melhora gradual, mas com secreção leve', Soro Fisiológico 0.9% + Hidrogel Amorfo, riskLevel 'Risco Moderado'). endCall (L1056) trata esse retorno como análise real, o modal (L3229-3250) o exibe como 'Evolução Clínica & Triagem: <paciente>' sem qualquer aviso de IA indisponível, e saveClinicalSummary grava em updateClinicalProfile (L1123) e envia ao paciente pelo chat (L1127-1129). Nao ha nenhuma guarda de fallback na UI.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0029 · CRÍTICO · `CONFIRMAR-SCHEMA`

**Sintomas e prescrições marcados nunca são gravados se o médico não abrir as abas do modal**

**Onde:** `src/components/Telemedicine.jsx:1094`

**O defeito:** saveClinicalSummary lê o estado das checkboxes por document.getElementById(`presc-${idx}`) e `symp-${idx}`. Esses inputs só existem no DOM quando activeTabReports === 'prescription' / 'symptoms' (renderização condicional em L3347 e L3379). O modal abre sempre na aba 'summary' (estado inicial em L192). Logo, getElementById devolve null, o optional chaining transforma em undefined, o filter descarta tudo e nenhum sintoma/prescrição é salvo — embora todos estejam defaultChecked={true} (L3363, L3395) e as abas anunciem 'Sintomas (3)' / 'Prescrição (2)'.

**Como falha:** Médico encerra a teleconsulta, lê o resumo na primeira aba, clica direto em 'Confirmar e Gravar Prontuário'. O alerta 'Resumo gravado com sucesso no prontuário e enviado ao histórico!' aparece, mas medications e otherConditions do paciente ficam inalterados: os 2 sintomas e as 3 prescrições que a tela mostrava como selecionados foram silenciosamente descartados.

**Código atual:**

```jsx
const selectedPrescriptions = aiReport.suggestedPrescriptions
  ?.filter((_, idx) => document.getElementById(`presc-${idx}`)?.checked)
  .map(p => `${p.name} (${p.dosage})`) || [];
```

**Correção sugerida:** Manter a seleção em estado React (ex.: selectedSymptomIdx/selectedPrescIdx inicializados como todos marcados) em vez de ler o DOM com getElementById.

<details><summary>Verificação feita contra o código</summary>

Confirmado: activeTabReports inicia em 'summary' (L192) e as checkboxes id={`symp-${idx}`}/{`presc-${idx}`} só são montadas dentro de {activeTabReports === 'symptoms'} (L3347-3377) e {activeTabReports === 'prescription'} (L3379-3414), ambas com defaultChecked={true}. saveClinicalSummary (L1093-1107) lê o DOM via document.getElementById(...)?.checked; com as abas fechadas o retorno é undefined, o filter descarta tudo e medications/otherConditions não mudam, mesmo com o alerta de sucesso em L1137.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0139 · ALTO · `CONFIRMADO`

**Nenhuma limpeza de câmera, microfone, peer connection e toque no desmonte do componente**

**Onde:** `src/components/Telemedicine.jsx:139`

**O defeito:** O único efeito com cleanup de ciclo de vida do componente cancela apenas o speechSynthesis. Não existe nenhum `useEffect(() => () => endMediaStream(), [])`. endMediaStream (L884) só é chamado a partir de transições de callState, que não ocorrem no desmonte. Assim, localStream (câmera/microfone), peerConnectionRef, ringIntervalRef e o AudioContext sobrevivem ao desmonte da árvore.

**Como falha:** Durante uma teleconsulta ativa o usuário clica em 'Sair' (logout) ou o app troca para a UI acessível (App.jsx:1603 deixa de renderizar Telemedicine). O componente é desmontado com a chamada em curso: o LED da webcam permanece aceso, o microfone continua capturando e o RTCPeerConnection continua transmitindo áudio e vídeo para o outro lado, que continua vendo e ouvindo o consultório mesmo após o logout.

**Código atual:**

```jsx
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);
```

**Correção sugerida:** Adicionar useEffect(() => () => { endMediaStream(); stopRingtone(); }, []) usando refs para o stream atual.

<details><summary>Verificação feita contra o código</summary>

O único cleanup de ciclo de vida é o de speechSynthesis (L139-143). O grep por endMediaStream mostra chamadas apenas em L272, L296, L457, L599 e L1043 — todas dentro de transições de callState, nenhuma em função de retorno de efeito com deps []. Assim, um desmonte (logout ou App.jsx:1603 deixando de renderizar Telemedicine no modo acessível) mantém localStream, peerConnectionRef, ringIntervalRef e o AudioContext vivos.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0140 · ALTO · `CONFIRMADO`

**Consentimento TCLE é global do dispositivo e vaza entre contas**

**Onde:** `src/components/Telemedicine.jsx:171`

**O defeito:** consentGiven é inicializado a partir da chave localStorage global 'irec_telemedicine_consent_accepted' e o onAccept grava a mesma chave global (L3473), sem qualquer vínculo com currentUser.id. Ironicamente, o modal grava a chave correta por usuário — `irec_tcle_accepted_${currentUser.id}` (TCLETelemedicineModal.jsx:13) — mas ela nunca é lida em lugar nenhum. Além disso o estado só é lido uma vez na montagem: trocar de usuário sem recarregar a página mantém o consentimento do usuário anterior.

**Como falha:** No tablet compartilhado da unidade de saúde, o paciente João aceita o TCLE. Depois a paciente Ana faz login no mesmo navegador e recebe uma teleconsulta: o botão 'Atender' já pula o termo, ela nunca lê nem assina o TCLE, e o audit_log só contém o aceite de João. Do ponto de vista da CFM 2.314/2022 a consulta de Ana ocorreu sem consentimento registrado.

**Código atual:**

```jsx
const [consentGiven, setConsentGiven] = useState(() => {
    return localStorage.getItem('irec_telemedicine_consent_accepted') === 'true';
  });
```

**Correção sugerida:** Ler e gravar `irec_tcle_accepted_${currentUser.id}` e reavaliar consentGiven em um useEffect com dependência [currentUser.id].

<details><summary>Verificação feita contra o código</summary>

L171-173 lê a chave global 'irec_telemedicine_consent_accepted' e o onAccept do modal (L3472-3473) grava a mesma chave global; o grep mostra que a chave por usuário `irec_tcle_accepted_${currentUser.id}` (TCLETelemedicineModal.jsx:13) não é lida em nenhum lugar do projeto. Como o estado é inicializado apenas na montagem, qualquer usuário seguinte no mesmo navegador herda o consentimento do anterior.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0141 · ALTO · `CONFIRMADO`

**Aceitar a chamada pelo banner global não interrompe o toque**

**Onde:** `src/components/Telemedicine.jsx:279`

**O defeito:** O efeito que sincroniza com activeCallSession trata a transição para 'accepted' apenas com setCallState('active') e não chama stopRingtone(). Todos os outros caminhos de saída do estado 'incoming' chamam stopRingtone (acceptCall L1020, rejectCall L1030, handler de status L443/456). Como o App.jsx tem seu próprio banner de chamada recebida que faz updateCallStatus + setActiveCallSession sem passar por acceptCall, e o BroadcastChannel não entrega eventos dentro da mesma aba, esse é o caminho normal quando o usuário está em outra aba do app.

**Como falha:** Paciente está na aba 'Meus Registros' quando o médico liga. Ele atende pelo banner global do App. A tela de vídeo abre corretamente, mas o bipe de toque continua tocando a cada 1,5 segundo durante toda a consulta, atrapalhando o áudio da chamada.

**Código atual:**

```jsx
      setActiveCall(activeCallSession);
      if (activeCallSession.status === 'accepted') {
        if (callState !== 'active') {
          setCallState('active');
        }
      } else if (activeCallSession.status === 'ringing') {
```

**Correção sugerida:** Chamar stopRingtone() nos ramos 'accepted' e 'ended'/'rejected' do efeito de sincronização com activeCallSession.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois lados: o ramo 'accepted' do efeito de sincronização (L279-282) só faz setCallState('active'), sem stopRingtone — diferente de acceptCall (L1020), rejectCall (L1030) e do handler de status (L443/448/456). E o banner do App.jsx (L2043-2049) aceita com updateCallStatus + setActiveCallSession + setActiveTab, sem passar por acceptCall. Como o toque foi iniciado pelo próprio efeito em L287, o bipe de 1,5s continua durante toda a chamada (o ramo 'ended' em L294-301 também não chama stopRingtone).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0142 · ALTO · `CONFIRMADO`

**Efeito de sincronização de chamada lê callState fora das dependências: câmera pode continuar ligada**

**Onde:** `src/components/Telemedicine.jsx:303`

**O defeito:** O corpo do efeito compara callState e chama endMediaStream(), mas o array de dependências contém apenas [activeCallSession]. O efeito captura o callState do render em que foi criado. Confirmado pelo ESLint (exhaustive-deps: faltam callState, currentUser.id e endMediaStream).

**Como falha:** A chamada termina e activeCallSession vira null. Se o callState capturado no closure ainda for 'idle' (valor antigo), a guarda `if (callState !== 'idle')` é falsa e endMediaStream() não roda: a luz da câmera e o microfone do paciente continuam ativos depois do fim da consulta.

**Código atual:**

```jsx
useEffect(() => {
  if (!activeCallSession) {
    if (callState !== 'idle') { endMediaStream(); ... }
  } else { ... }
}, [activeCallSession]);   // callState e endMediaStream ausentes
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0143 · ALTO · `CONFIRMAR-SCHEMA`

**Mensagens do contato selecionado são marcadas como lidas mesmo com o app em outra tela**

**Onde:** `src/components/Telemedicine.jsx:352`

**O defeito:** O polling de não lidas roda sempre (o componente fica montado em todas as abas, App.jsx:1604) e marca como lida qualquer mensagem cujo senderId seja igual ao do selectedContact, sem verificar isAppActiveTab, showExpressChat ou visibilidade da janela. Como selectedContact persiste depois que o usuário sai da aba de telemedicina, todo o tráfego daquele contato é zerado a cada 15s.

**Como falha:** Médico conversa com o paciente Carlos, depois vai para a aba 'Meus Pacientes' e passa a tarde ali. Carlos envia 6 mensagens relatando piora da ferida. Nenhum badge aparece na navegação (newTotal continua 0) e o contador global do App (onUnreadCountChange) permanece zerado — o médico nunca fica sabendo.

**Código atual:**

```jsx
          if (selectedContact && msg.senderId === selectedContact.id) {
            readTimes[msg.senderId] = new Date().toISOString();
            readTimesUpdated = true;
            return;
          }
```

**Correção sugerida:** Condicionar a marcação automática a (isAppActiveTab || showExpressChat) && document.visibilityState === 'visible'.

<details><summary>Verificação feita contra o código</summary>

O componente fica montado em todas as abas (App.jsx:1603-1613, isAppActiveTab é só uma prop) e o polling de 15s (L341-391) marca readTimes e retorna cedo para toda mensagem com msg.senderId === selectedContact.id (L352-356), sem checar isAppActiveTab, showExpressChat ou document.visibilityState. Como selectedContact persiste após sair da aba, essas mensagens nunca entram em counts nem no onUnreadCountChange.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0144 · ALTO · `CONFIRMADO`

**Vídeo e áudio do interlocutor não voltam depois de esconder/reexibir (srcObject nunca é rebindado)**

**Onde:** `src/components/Telemedicine.jsx:584`

**O defeito:** O efeito que atribui remoteVideoRef.current.srcObject depende apenas de [remoteStream, callState]. Como o elemento <video ref={remoteVideoRef}> é desmontado quando hideVideo é true (L2591) e quando a chamada vai para o modo PiP (L1161-1271, que não tem elemento de vídeo remoto), ao remontá-lo o ref aponta para um elemento novo com srcObject null e nenhum efeito reexecuta. Como o áudio remoto também sai por esse elemento, o interlocutor fica mudo e invisível pelo resto da chamada.

**Como falha:** Durante a consulta o médico clica na aba 'Painel' para consultar a ficha (isAppActiveTab vira false → renderiza o PiP sem vídeo remoto) e volta para 'Telemedicina'. A partir daí a tela mostra 'Aguardando transmissão de vídeo...'/tela preta e ele não ouve mais nada do paciente, embora a conexão WebRTC continue estabelecida. Mesmo efeito ao alternar o botão de câmera duas vezes.

**Código atual:**

```jsx
useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.volume = 1.0;
      ...
  }, [remoteStream, callState]);
```

**Correção sugerida:** Usar callback ref (ex.: ref={el => { if (el && remoteStream) el.srcObject = remoteStream; }}) ou incluir hideVideo/isAppActiveTab nas dependências do efeito.

<details><summary>Verificação feita contra o código</summary>

O efeito de bind (L584-590) depende apenas de [remoteStream, callState], e o elemento <video ref={remoteVideoRef}> é desmontado tanto pelo ternário de hideVideo (L2591) quanto pela troca para o layout PiP quando isAppActiveTab vira false (L1161+). Ao remontar, o ref aponta para um elemento novo com srcObject null e nenhuma das dependências mudou, então o efeito não reexecuta — vídeo e áudio remotos ficam mudos até o fim da chamada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0145 · ALTO · `CONFIRMADO`

**Transcrição e alertas clínicos só funcionam entre abas do mesmo navegador**

**Onde:** `src/components/Telemedicine.jsx:646`

**O defeito:** sendTranscriptChunk (supabaseService.js:2405) apenas faz chatChannel.postMessage em um BroadcastChannel local — não existe caminho remoto nem com Supabase configurado. Portanto o callback de chunk remoto (L467) nunca é acionado entre dois dispositivos, e os alertas clínicos, que só são gerados quando senderRole === 'patient' (L476), nunca disparam em uma consulta real. Além disso, um BroadcastChannel não entrega mensagens ao próprio objeto que postou, e App.jsx e Telemedicine.jsx compartilham a mesma instância de módulo — logo, dentro da mesma aba, nada trafega.

**Como falha:** Médico em São Paulo e paciente no interior. O painel 'Assistente Clínico & Transcrição' do médico só mostra as falas dele próprio, rotuladas 'Médico (Você)'; nenhuma fala do paciente aparece e nenhum alerta de 'pus'/'febre'/'dor no peito' é gerado. O texto enviado à IA (L1054) é metade do diálogo, mas o prontuário resultante é apresentado como síntese da consulta.

**Código atual:**

```jsx
      // Broadcast chunk to peer
      sendTranscriptChunk(senderRole, transcriptText);
// supabaseService.js:2405  export const sendTranscriptChunk = (senderRole, text) => { if (chatChannel) { chatChannel.postMessage({ type: 'TRANSCRIPT_CHUNK', senderRole, text }); } };
```

**Correção sugerida:** Persistir/propagar os chunks por Supabase Realtime (ou por um data channel do RTCPeerConnection) em vez de BroadcastChannel local.

<details><summary>Verificação feita contra o código</summary>

supabaseService.js:2405-2413 mostra que sendTranscriptChunk só faz chatChannel.postMessage no BroadcastChannel 'irec_telemedicine_signaling' (L2013), sem nenhum caminho Supabase/remoto — nem sequer há tabela envolvida. Logo o callback de chunk remoto (L467-505) nunca dispara entre dispositivos e os alertas, restritos a senderRole === 'patient' (L476), nunca são gerados numa consulta real. Como o BroadcastChannel não entrega ao próprio objeto que postou e o módulo é único por aba, dentro da mesma aba também nada trafega. O texto enviado à IA (L1054) fica com apenas metade do diálogo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0146 · ALTO · `CONFIRMADO`

**Permissão de câmera/microfone negada falha em silêncio e a chamada segue sem mídia**

**Onde:** `src/components/Telemedicine.jsx:778`

**O defeito:** startMediaStream captura o erro do getUserMedia e devolve null; initializeWebRTC apenas escreve um aviso no console e retorna. Nenhum estado de erro é exposto na interface.

**Como falha:** Paciente nega (ou já negou antes) a permissão de câmera. A chamada é aceita, o cronômetro roda, mas nenhum vídeo ou áudio é transmitido. Nem ele nem o médico recebem qualquer aviso — os dois ficam esperando o outro aparecer.

**Código atual:**

```jsx
} catch (err) {
  console.warn('Câmera ou Microfone não disponíveis:', err);
  return null;
}
...
const stream = await startMediaStream();
if (!stream) {
  console.warn("Nenhum stream de áudio/vídeo disponível para WebRTC");
  return;   // sem setState de erro, sem alerta
}
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0147 · ALTO · `CONFIRMADO`

**Nenhum servidor TURN configurado: chamadas falham atrás de NAT simétrico**

**Onde:** `src/components/Telemedicine.jsx:797`

**O defeito:** A configuração de iceServers só tem STUN. Operadoras móveis e redes corporativas usam NAT simétrico, onde o STUN sozinho não estabelece o caminho P2P.

**Como falha:** Paciente em rede 4G de operadora tenta a teleconsulta. Mesmo com a porta do STUN corrigida, o ICE não encontra par válido e a chamada nunca conecta. Não há fallback nem mensagem explicando o motivo.

**Código atual:**

```jsx
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19002' },
    { urls: 'stun:stun1.l.google.com:19002' }
  ]
};   // nenhum { urls: 'turn:...', username, credential }
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0148 · ALTO · `CONFIRMADO`

**startCall trava permanentemente em 'chamando...' quando a criação da chamada falha**

**Onde:** `src/components/Telemedicine.jsx:1008`

**O defeito:** O estado é posto em 'outgoing' antes do await. Se placeTelemedicineCall devolver null ou lançar, activeCall vira null mas callState continua 'outgoing', e não há tratamento de erro nem timeout.

**Como falha:** O médico clica em ligar com a rede instável. A tela fica na animação de 'chamando...' para sempre; o botão de desligar depende de activeCall (`if (!activeCall) return`), então nem encerrar é possível. Só recarregando a página.

**Código atual:**

```jsx
const startCall = async () => {
  if (!selectedContact) return;
  setCallState('outgoing');
  const call = await placeTelemedicineCall(currentUser.id, selectedContact.id);
  setActiveCall(call);   // pode ser null, sem tratamento
  ...
};
// e o encerramento:
const endCall = async () => { if (!activeCall) return; ... }
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0149 · ALTO · `CONFIRMADO`

**Transcrição integral da consulta e ficha clínica enviadas a terceiro sem consentimento**

**Onde:** `src/components/Telemedicine.jsx:1054`

**O defeito:** O diálogo transcrito é concatenado e enviado, junto com o perfil clínico do paciente (nome, diabetes, hipertensão, insuficiência venosa, DAP), para a API do Google Gemini (geminiService.js:791-831, fetchGeminiWithRotation). O TCLE exibido ao paciente afirma o contrário: 'Todos os seus dados de saúde ... são criptografados de ponta a ponta' e 'Nenhuma gravação de áudio ou vídeo é armazenada sem autorização prévia expressa' (TCLETelemedicineModal.jsx:103). Não há nenhuma tela pedindo consentimento para o processamento por IA de terceiros, e a chave da API é embutida no bundle do cliente (VITE_).

**Como falha:** Paciente aceita o TCLE acreditando em sigilo ponta-a-ponta. Ao fim da consulta, a transcrição com nome, comorbidades e relatos íntimos sobre a lesão é enviada em texto puro para servidores do Google a partir do navegador do médico. Nenhum registro de consentimento específico é gerado.

**Código atual:**

```jsx
const transcriptText = transcripts.map(t => `${t.role === 'doctor' ? 'Médico' : 'Paciente'}: ${t.text}`).join('\n');
const report = await analyzeTelemedicineTranscript(transcriptText, patientProfile || {});
```

**Correção sugerida:** Adicionar consentimento explícito para processamento por IA de terceiros (com registro em audit log) e mover a chamada ao Gemini para backend/edge function, corrigindo o texto do TCLE.

<details><summary>Verificação feita contra o código</summary>

geminiService.js:791-831 monta o prompt com nome, diabetes, hipertensão, insuficiência venosa e DAP do paciente mais a transcrição integral e envia via fetchGeminiWithRotation; não há tela de consentimento específico para processamento por IA de terceiros. O TCLE realmente afirma o contrário (TCLETelemedicineModal.jsx:103, 'criptografados de ponta a ponta ... nenhuma gravação de áudio ou vídeo é armazenada sem autorização'). Ressalva: com o .env vazio (isGeminiConfigured false) nada é transmitido hoje — a rota de envio é incondicional assim que houver chave VITE_ no bundle, e a afirmação de sigilo ponta-a-ponta já é falsa no modo contingência (localStorage em texto puro).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0150 · ALTO · `CONFIRMAR-SCHEMA`

**Gravação do prontuário aborta em silêncio quando não há contato selecionado**

**Onde:** `src/components/Telemedicine.jsx:1087`

**O defeito:** saveClinicalSummary faz `if (!selectedContact || !aiReport) return;` dentro do try. O bloco finally (L1141-1150) executa mesmo assim: fecha o modal, zera aiReport e volta para idle. Não há alerta de erro nem log. selectedContact é null sempre que o profissional ATENDE uma chamada sem antes ter clicado no contato na lista (o fluxo de aceite global do App.jsx leva à aba de telemedicina, mas não seleciona o contato de forma garantida).

**Como falha:** Enfermeira/médico recebe uma chamada, atende pelo banner, conversa 20 minutos, encerra, revisa o resumo e clica em 'Confirmar e Gravar Prontuário'. O modal fecha, nada é gravado, nada é enviado ao chat e nenhuma mensagem de erro aparece. O resumo é irrecuperável — transcripts é zerado no próximo início de chamada (L615).

**Código atual:**

```jsx
const saveClinicalSummary = async () => {
    try {
      if (!selectedContact || !aiReport) return;
    ...
    } finally {
      setShowSummaryModal(false);
      setAiReport(null);
```

**Correção sugerida:** Trocar o early-return por um alert de erro que mantenha o modal aberto (e derivar selectedContact de activeCall.callerId/receiverId ao aceitar a chamada).

<details><summary>Verificação feita contra o código</summary>

L1086-1087 tem o early-return dentro do try e o finally (L1141-1150) fecha o modal, zera aiReport e volta para idle sem alerta nem log. A parte de aiReport null é inalcançável (o botão só renderiza no ramo aiReport truthy, L3229), mas selectedContact null é real: acceptCall (L1018-1026) não seleciona contato, e só o fluxo do banner do App.jsx (L2047 setTelemedicineContactId) alimenta o efeito de targetContactId (L256-266) — quem atende pela overlay da própria aba de telemedicina sem ter clicado no contato salva no vazio.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0151 · ALTO · `CONFIRMADO`

**Quem inicia a teleconsulta nunca vê o TCLE**

**Onde:** `src/components/Telemedicine.jsx:1951`

**O defeito:** O gate de consentimento só existe no botão 'Atender' da chamada recebida (L2516: `onClick={() => consentGiven ? acceptCall() : setShowConsentModal(true)}`). O botão 'Iniciar Teleconsulta por Vídeo' chama startCall diretamente, que muda o estado para 'outgoing', cria a chamada e, na aceitação, abre câmera e microfone via initializeWebRTC sem qualquer verificação de consentGiven.

**Como falha:** Paciente entra no chat com seu médico e clica em 'Iniciar Teleconsulta por Vídeo'. A chamada é criada, atendida e a câmera é aberta sem que o TCLE tenha sido exibido uma única vez. O registro de aceite (createAuditLog TCLE_ACCEPTED) nunca é criado para essa consulta.

**Código atual:**

```jsx
<button 
                  onClick={startCall}
                  ...
                  Iniciar Teleconsulta por Vídeo
                </button>
```

**Correção sugerida:** Trocar onClick={startCall} por onClick={() => consentGiven ? startCall() : setShowConsentModal(true)}.

<details><summary>Verificação feita contra o código</summary>

O botão 'Iniciar Teleconsulta por Vídeo' (L1950-1974) chama startCall diretamente e startCall (L1008-1016) não consulta consentGiven — apenas muda para 'outgoing' e cria a chamada; o initializeWebRTC é disparado pelo efeito de callState 'active' (L593-597), também sem checagem. O gate de consentimento existe só no botão 'Atender'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0152 · ALTO · `CONFIRMADO`

**Botão 'Desligar Câmera' não desliga a câmera e esconde o vídeo do interlocutor**

**Onde:** `src/components/Telemedicine.jsx:2591`

**O defeito:** hideVideo não desabilita a track de vídeo local (nenhum getVideoTracks()/enabled=false no arquivo); a webcam continua capturando e enviando. Pior: o que o hideVideo esconde é o painel do vídeo REMOTO — o bloco condicional em L2591 troca o <video ref={remoteVideoRef}> por 'Vídeo pausado pelo usuário'. O PiP local (L2671) continua exibindo a própria câmera funcionando.

**Como falha:** Paciente clica em 'Desligar Câmera' para se trocar/expor a lesão apenas quando quiser. A tela dele deixa de mostrar o médico (parece que a chamada caiu), mas o médico continua vendo a imagem da câmera do paciente normalmente, e o LED da webcam continua aceso.

**Código atual:**

```jsx
{hideVideo ? (
  <div style={{ textAlign: 'center', color: '#64748b' }}>
    Vídeo pausado pelo usuário
  </div>
) : ( ... <video ref={remoteVideoRef} ... /> ... )}
```

**Correção sugerida:** Aplicar localStream.getVideoTracks().forEach(t => t.enabled = !hideVideo) e mover a condicional para o PiP local, não para o painel remoto.

<details><summary>Verificação feita contra o código</summary>

Mesmo grep confirma que nenhuma track de vídeo é desabilitada. Em L2591-2655 o ternário de hideVideo substitui exatamente o painel que contém <video ref={remoteVideoRef}> (L2598) por 'Vídeo pausado pelo usuário', enquanto o PiP local com <video ref={localVideoRef}> (L2671) permanece renderizado fora do ternário. Ou seja: esconde o interlocutor e mantém a própria câmera capturando e transmitindo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0153 · ALTO · `CONFIRMADO`

**Botão 'Mutar Áudio' não muta o microfone — áudio continua sendo transmitido**

**Onde:** `src/components/Telemedicine.jsx:3066`

**O defeito:** O botão de mudo apenas alterna o estado muteAudio. Em nenhum lugar do arquivo existe track.enabled = false ou getAudioTracks(). O único uso funcional de muteAudio é o early-return de playNotificationSound (L739) e a cor de fundo do botão. A faixa de áudio adicionada ao RTCPeerConnection (L808-810) continua ativa e o interlocutor continua ouvindo tudo.

**Como falha:** Durante a teleconsulta o médico clica em 'Mutar Áudio' (o botão fica vermelho) para comentar o caso com um colega ao lado, ou o paciente se muta para falar com um familiar. O outro lado escuta a conversa inteira. Nenhum indicador contradiz a falsa sensação de privacidade.

**Código atual:**

```jsx
<button 
  onClick={() => setMuteAudio(prev => !prev)}
  ...
  title={muteAudio ? "Desmutar Áudio" : "Mutar Áudio"}
>
```

**Correção sugerida:** No toggle, aplicar localStream.getAudioTracks().forEach(t => t.enabled = !novoMuteAudio).

<details><summary>Verificação feita contra o código</summary>

Grep no arquivo inteiro por getAudioTracks|getVideoTracks|.enabled= não retornou nenhuma ocorrência; muteAudio só aparece em L162 (estado), L739 (early-return de playNotificationSound), L1291/1298/1300 e L3072/3080/3082 (cor e title do botão). A track de áudio adicionada ao RTCPeerConnection continua habilitada, então o interlocutor continua ouvindo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0355 · MÉDIO · `CONFIRMADO`

**Enfermeiro vinculado é apresentado ao paciente como médico**

**Onde:** `src/components/Telemedicine.jsx:215`

**O defeito:** Ao montar a lista de contatos do paciente, o papel real do profissional é sobrescrito por role: 'doctor' e chatType: 'assigned_doctor', independentemente do que veio no perfil (o serviço também força role:'doctor' em supabaseService.js:2445/2476). A UI então rotula esse contato como '👨‍⚕️ Médico' (L2363), 'Médico Assistente' (L1783) e o cabeçalho do chat mostra a especialidade como se fosse profissional médico (L1944).

**Como falha:** A enfermeira estomaterapeuta Ana está vinculada ao paciente José. Na tela de telemedicina do José, Ana aparece como '👨‍⚕️ Médico' / 'Médico Assistente'. José acredita estar recebendo conduta médica (e eventual prescrição) de uma enfermeira, o que é uma informação de papel profissional incorreta em contexto clínico.

**Código atual:**

```jsx
          const doctors = await getAssignedDoctors(currentUser.id);
          doctors.forEach(d => {
            list.push({ ...d, role: 'doctor', chatType: 'assigned_doctor' });
          });
```

**Correção sugerida:** Preservar o role real do perfil (profile.role) e usar apenas chatType para classificar o vínculo, ajustando os rótulos da UI.

<details><summary>Verificação feita contra o código</summary>

L213-216 sobrescreve o papel real com role: 'doctor' para todo contato retornado por getAssignedDoctors, e o próprio serviço já força role: 'doctor' nos dois modos (supabaseService.js:2445 e 2476), descartando o role original do perfil. A UI então rotula o contato como profissional médico (L1944 usa selectedContact.role === 'doctor' para exibir a especialidade; lista e cabeçalhos idem).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0356 · MÉDIO · `CONFIRMADO`

**Seis funções são referenciadas por efeitos antes de serem declaradas**

**Onde:** `src/components/Telemedicine.jsx:272`

**O defeito:** endMediaStream (L272), playRingtone (L287), scrollToBottom (L312), playNotificationSound (L325), stopRingtone (L443) e initializeWebRTC (L597) são const declaradas depois no arquivo. Não há erro de TDZ porque os efeitos rodam após o render, mas cada render recria as funções e os efeitos guardam a versão do render em que foram criados. Sinalizado pelo ESLint (react-hooks/immutability, 6 ocorrências).

**Como falha:** Combinado com os arrays de dependências incompletos, os efeitos passam a operar sobre versões antigas dessas funções, que por sua vez leem estados antigos — é a raiz dos problemas de encerramento de mídia e de toque do ringtone.

**Código atual:**

```jsx
// L272 usa endMediaStream, declarada só na L884
// L287 usa playRingtone, declarada só na L698
// L597 usa initializeWebRTC, declarada só na L785
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0357 · MÉDIO · `CONFIRMADO`

**Efeitos colaterais dentro do updater de setState duplicam o som de notificação**

**Onde:** `src/components/Telemedicine.jsx:321`

**O defeito:** O callback passado para setMessages dispara setTimeout(scrollToBottom) e playNotificationSound(). Updaters precisam ser puros; sob StrictMode o React os executa duas vezes.

**Como falha:** Em desenvolvimento, cada mensagem recebida toca o som de notificação duas vezes e a rolagem é agendada duas vezes. A pureza quebrada também torna o comportamento imprevisível se o React reexecutar o updater.

**Código atual:**

```jsx
setMessages(prev => {
  if (chatHistory.length !== prev.length || ...) {
    setTimeout(scrollToBottom, 100);      // efeito colateral
    if (chatHistory.length > prev.length) {
      ...
      playNotificationSound();            // efeito colateral
    }
    return chatHistory;
  }
  return prev;
});
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0358 · MÉDIO · `CONFIRMADO`

**Polling substitui a lista de mensagens e pode apagar mensagens recém-enviadas**

**Onde:** `src/components/Telemedicine.jsx:328`

**O defeito:** O updater devolve `chatHistory` inteiro sempre que o tamanho difere ou o último id difere, descartando qualquer estado local. Combinado com getChatMessages, que faz .order('created_at', ascending: true).limit(200) (supabaseService.js:2038-2039) — ou seja, devolve as 200 mensagens MAIS ANTIGAS, não as mais recentes — uma conversa que ultrapasse 200 mensagens passa a retornar sempre a mesma janela antiga, e cada ciclo do polling remove da tela as mensagens novas que foram inseridas otimisticamente por handleSendMessage (L935-938).

**Como falha:** Médico e paciente com histórico longo (mais de 200 mensagens). O médico envia 'Troque o curativo hoje'; a mensagem aparece, e até 15 segundos depois some da tela porque o polling devolve a janela das 200 primeiras mensagens da conversa. Ambos ficam sem ver as mensagens novas, embora elas estejam gravadas no banco.

**Código atual:**

```jsx
        if (chatHistory.length !== prev.length || (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].id !== prev[prev.length - 1]?.id)) {
          ...
          return chatHistory;
        }
```

**Correção sugerida:** Ordenar por created_at descendente com limit(200) e reverter no cliente, e mesclar por id em vez de substituir o array.

<details><summary>Verificação feita contra o código</summary>

L319-331 confirma que o updater devolve chatHistory inteiro sempre que o tamanho ou o último id divergem, descartando inserções otimistas; e getChatMessages usa .order('created_at', { ascending: true }).limit(200) (supabaseService.js:2038-2039), devolvendo as 200 mensagens mais antigas. Acima de 200 mensagens o polling passa a reescrever a lista com a janela antiga a cada 15s. Ressalva: vale para o modo Supabase (hoje inativo com o .env vazio); no modo local não há limite.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0359 · MÉDIO · `CONFIRMADO`

**Mensagens recebidas antes do primeiro carregamento nunca contam como não lidas**

**Onde:** `src/components/Telemedicine.jsx:359`

**O defeito:** Quando não há registro anterior em irec_chat_read_times para um remetente, o código grava o instante atual como 'última leitura' em vez de contar as mensagens pendentes.

**Como falha:** O médico manda três mensagens enquanto o paciente está deslogado. O paciente entra em outro dispositivo (ou depois de limpar o cache): o contador de não lidas mostra zero e nenhuma notificação aparece. Ele só descobre as mensagens se abrir a conversa por acaso.

**Código atual:**

```jsx
const lastRead = readTimes[msg.senderId];
if (lastRead === undefined) {
  // marca como lido em vez de contar
  readTimes[msg.senderId] = new Date().toISOString();
  readTimesUpdated = true;
} else if (msg.createdAt > lastRead) { counts[...]++; }
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0360 · MÉDIO · `CONFIRMADO`

**playRingtone empilha intervalos: o toque pode nunca mais parar**

**Onde:** `src/components/Telemedicine.jsx:724`

**O defeito:** playRingtone sobrescreve ringIntervalRef.current com um novo setInterval sem limpar o anterior e sem verificar se já existe um toque em andamento. Existem três caminhos que chamam playRingtone para a mesma chamada — o efeito de sincronização (L287), o callback de sinalização (L433) e o polling de chamadas recebidas (L520) — e eles não são mutuamente exclusivos porque leem callState de closures diferentes. stopRingtone (L730-735) só consegue limpar a última referência guardada; os intervalos anteriores ficam órfãos tocando o bipe a cada 1,5s para sempre.

**Como falha:** Paciente recebe uma chamada; a sinalização entre abas dispara playRingtone e, na sequência, o setActiveCallSession faz o efeito de sincronização disparar playRingtone de novo. Ele atende: stopRingtone limpa só um intervalo. O bipe de toque continua tocando por cima da consulta inteira e depois dela, e não há botão que o interrompa — só recarregar a página.

**Código atual:**

```jsx
      triggerTone();
      ringIntervalRef.current = setInterval(triggerTone, 1500);
```

**Correção sugerida:** Iniciar playRingtone com `if (ringIntervalRef.current) return;` (ou stopRingtone() antes do setInterval).

<details><summary>Verificação feita contra o código</summary>

L698-728 confirma que playRingtone sobrescreve ringIntervalRef.current sem clearInterval prévio nem guarda de reentrância, e stopRingtone (L730-735) só limpa a última referência. Os três chamadores (L287, L433, L520) são majoritariamente protegidos por checagens de callState com closures atualizadas, mas o polling de L515-524 é assíncrono (await checkIncomingCalls): se o banner do App.jsx marcar a sessão como 'ringing' durante o await, o callback em voo ainda enxerga callState 'idle' e dispara um segundo intervalo órfão. Cenário mais estreito do que o descrito, mas o defeito e o vazamento são reais.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0361 · MÉDIO · `CONFIRMADO`

**Encerrar a consulta como médico deixa o estado preso em 'active' com o microfone aberto**

**Onde:** `src/components/Telemedicine.jsx:1048`

**O defeito:** No ramo do médico com transcrição, endCall abre o modal de resumo mas NUNCA faz setCallState('idle'). Consequências: (a) o cronômetro de duração (L566-574) continua incrementando; (b) a overlay de chamada em tela cheia (L2547) permanece montada atrás do modal; (c) o efeito de SpeechRecognition (L604-679) só para quando callState !== 'active', então o microfone continua aberto transcrevendo tudo o que for dito depois do fim da consulta; (d) esses chunks continuam sendo transmitidos por sendTranscriptChunk (L646).

**Como falha:** Médico encerra a consulta da paciente A e passa 4 minutos revisando o resumo (ou esquece o modal aberto). Todo o áudio da sala nesse intervalo — inclusive comentários sobre outros pacientes — continua sendo capturado e adicionado a transcripts, e o cronômetro segue correndo. Só o clique em 'Descartar Resumo' ou 'Confirmar' encerra o estado.

**Código atual:**

```jsx
if (currentUser.role === 'doctor' && transcripts.length > 0) {
      setShowSummaryModal(true);
      setIsGeneratingSummary(true);
      ...
    } else {
      // Direct transition to idle for patients or if no speech was captured
      setCallState('idle');
```

**Correção sugerida:** Chamar setCallState('idle') (e limpar activeCall/callDuration) logo após updateCallStatus, mantendo apenas o modal de resumo aberto.

<details><summary>Verificação feita contra o código</summary>

O ramo do médico (L1048-1062) realmente não chama setCallState('idle') — só discardClinicalSummary (L1077) ou o finally de saveClinicalSummary (L1144) fazem isso. Com callState preso em 'active': o cronômetro (L566-574) segue contando, o efeito de SpeechRecognition (L604-679) não para e continua capturando/transmitindo chunks via sendTranscriptChunk (L646), e o polling de novas chamadas (L512-513, só roda com callState 'idle') fica desligado. Atenuante verificado: endMediaStream() é chamado em L1043, então a câmera/microfone do WebRTC são encerrados — o que continua aberto é o microfone do SpeechRecognition, que usa captura própria.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0362 · MÉDIO · `CONFIRMAR-SCHEMA`

**Badge de mensagens não lidas do chat flutuante é sempre zero**

**Onde:** `src/components/Telemedicine.jsx:1393`

**O defeito:** totalUnread é calculado somando c.unreadCount dos contatos, mas os contatos vêm de getAssignedPatients/getAssignedDoctors (supabaseService.js:1682 e 2473) e nenhum deles inclui o campo unreadCount. O contador real vive no estado unreadCounts (L109), indexado por id de contato, e nunca é usado aqui. O mesmo campo inexistente é lido na lista de contatos do chat expresso (L1847).

**Como falha:** Paciente está na aba 'Meus Registros' e o médico manda uma mensagem. O balão flutuante de chat no canto inferior direito nunca exibe o badge vermelho (totalUnread é sempre 0) e a lista de contatos dentro dele também não mostra contagem alguma, embora unreadCounts contenha o valor correto.

**Código atual:**

```jsx
const totalUnread = contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
```

**Correção sugerida:** Calcular totalUnread a partir de Object.values(unreadCounts).reduce(...) e usar unreadCounts[c.id] na lista do chat expresso.

<details><summary>Verificação feita contra o código</summary>

L1393 soma c.unreadCount, mas o grep em supabaseService.js não encontra nenhuma ocorrência de 'unreadCount' — getAssignedDoctors (L2433-2486) devolve apenas id, name, role, crm, specialty, city, state, e o mesmo vale para a lista de pacientes. O contador real está no estado unreadCounts (L109), que não é usado nesse cálculo.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0363 · MÉDIO · `CONFIRMADO`

**Anexos em PDF não abrem no modo contingência local (navegação para data: URL bloqueada)**

**Onde:** `src/components/Telemedicine.jsx:2033`

**O defeito:** Com isSupabaseConfigured false, sendChatMessage grava o arquivo como data URI base64 no campo fileUrl (supabaseService.js:2125-2126). O chat renderiza documentos não-imagem como <a href={m.fileUrl} target="_blank">, e navegadores baseados em Chromium bloqueiam a navegação de top-frame para URLs data: ('Not allowed to navigate top frame to data URL'). O clique simplesmente não faz nada e não há fallback de download (nenhum atributo download).

**Como falha:** Paciente anexa o laudo do doppler em PDF pelo chat. O médico vê o cartão '📄 laudo.pdf', clica e nada acontece — nenhuma aba abre, nenhum erro na tela, só uma mensagem no console. O documento clínico fica inacessível pela interface.

**Código atual:**

```jsx
<a 
                                  href={m.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  ...
                                  📄 {m.fileName || 'Documento clínico'}
```

**Correção sugerida:** Adicionar download={m.fileName} no link (ou converter o data URI em Blob URL antes de abrir).

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois lados: com !isSupabaseConfigured, sendChatMessage grava newMsg.fileUrl = base64 (data URI) em supabaseService.js:2122-2126, e o chat renderiza o documento como <a href={m.fileUrl} target="_blank"> sem atributo download (L2032-2044). Navegadores Chromium bloqueiam navegação de top-frame para URLs data:, então o clique não abre nada nem exibe erro na UI.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0541 · BAIXO · `CONFIRMADO`

**speakMessage: o onend da fala cancelada zera o estado da nova leitura**

**Onde:** `src/components/Telemedicine.jsx:121`

**O defeito:** Ao clicar para ouvir uma segunda mensagem, window.speechSynthesis.cancel() é chamado antes de setSpeakingMessageId(msgId). O cancelamento dispara de forma assíncrona o onend (ou onerror) da utterance anterior, que executa setSpeakingMessageId(null) — depois do setSpeakingMessageId(msgId) já ter sido aplicado. O ícone volta para 🔊 enquanto o áudio ainda está tocando e o botão perde a função de parar.

**Como falha:** Paciente com baixa visão clica em 🔊 na mensagem A e, em seguida, na mensagem B. O áudio de B toca, mas o ícone de B volta a 🔊; ao clicar novamente para interromper, o componente entra no ramo 'else' e inicia uma segunda leitura de B por cima da primeira.

**Código atual:**

```jsx
    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    } else {
      window.speechSynthesis.cancel();
```

**Correção sugerida:** Nos handlers, só zerar o estado se ainda for a utterance atual (ex.: setSpeakingMessageId(prev => prev === msgId ? null : prev)).

<details><summary>Verificação feita contra o código</summary>

L119-137 confirma a sequência: window.speechSynthesis.cancel() no ramo else, depois setSpeakingMessageId(msgId). O cancel dispara de forma assíncrona onend/onerror da utterance anterior (L128-133), que executa setSpeakingMessageId(null) após o novo id ter sido aplicado — o ícone volta a 🔊 durante a leitura e o botão perde a função de parar. Não há guarda de identidade da utterance.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0542 · BAIXO · `CONFIRMADO`

**Comentário promete sincronização de chat a cada 2 s, mas o intervalo real é de 15 s**

**Onde:** `src/components/Telemedicine.jsx:316`

**O defeito:** O comentário e o valor do setInterval divergem.

**Como falha:** Numa conversa clínica ao vivo, a mensagem do médico pode levar até 15 segundos para aparecer na tela do paciente, enquanto a documentação inline afirma 2 segundos.

**Código atual:**

```jsx
// Set up polling (2 seconds interval) for real-time chat sync across devices
const interval = setInterval(async () => { ... }, 15000);
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0543 · BAIXO · `CONFIRMAR-SCHEMA`

**Som de notificação toca para as próprias mensagens (comparação em snake_case)**

**Onde:** `src/components/Telemedicine.jsx:324`

**O defeito:** O polling de mensagens compara lastMsg.sender_id, mas o serviço devolve as mensagens sempre em camelCase — supabaseService.js:2048 (`senderId: item.sender_id`) e :2113 (`senderId`). O resto do componente usa corretamente m.senderId (L1557, L1993, L2763). Como sender_id é undefined, a condição `undefined !== currentUser.id` é sempre verdadeira e o som toca para qualquer mensagem nova, inclusive as enviadas pelo próprio usuário.

**Como falha:** Médico responde ao paciente pelo celular; ao voltar ao desktop, o polling detecta a mensagem nova e toca o 'ding' de mensagem recebida para a própria mensagem que ele acabou de enviar. Em uma sequência de envios pelo outro dispositivo, o som se repete a cada 15 segundos.

**Código atual:**

```jsx
            const lastMsg = chatHistory[chatHistory.length - 1];
            if (lastMsg && lastMsg.sender_id !== currentUser.id) {
              playNotificationSound();
            }
```

**Correção sugerida:** Trocar lastMsg.sender_id por lastMsg.senderId.

<details><summary>Verificação feita contra o código</summary>

L324 compara lastMsg.sender_id, mas getChatMessages mapeia senderId: item.sender_id (supabaseService.js:2048 e 2088) e o modo local monta newMsg com senderId (L2111-2119); o restante do componente usa m.senderId (L1993). Portanto a comparação é sempre undefined !== id e o som toca para qualquer mensagem nova, inclusive as próprias vindas de outro dispositivo. Impacto é apenas sonoro/UX, o que não sustenta severidade média.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0544 · BAIXO · `VERIFICAR`

**JSON.parse sem try/catch no corpo do efeito derruba a tela inteira**

**Onde:** `src/components/Telemedicine.jsx:398`

**O defeito:** O efeito que marca as mensagens do contato como lidas faz JSON.parse do localStorage sem proteção, direto no corpo do efeito. Se 'irec_chat_read_times' estiver corrompido (gravação interrompida, cota do localStorage estourada por anexos em base64 do modo contingência — sendChatMessage grava arquivos inteiros em base64 no localStorage, supabaseService.js:2126), o parse lança e o erro sobe pela árvore React, desmontando o app. O mesmo parse em L344 está dentro de try/catch, o que confirma que a proteção foi esquecida aqui.

**Como falha:** Paciente envia várias fotos da lesão em modo contingência até estourar a cota do localStorage; a chave irec_chat_read_times fica truncada. Na próxima vez que qualquer usuário clicar em um contato, o app fica em tela branca com 'Unexpected end of JSON input' no console, sem forma de recuperação pela UI.

**Código atual:**

```jsx
    const readTimes = JSON.parse(localStorage.getItem('irec_chat_read_times') || '{}');
    readTimes[selectedContact.id] = new Date().toISOString();
```

**Correção sugerida:** Envolver o parse em try/catch com fallback para {} (mesmo padrão de L344).

<details><summary>Verificação feita contra o código</summary>

O trecho existe como descrito: L398 faz JSON.parse direto no corpo do efeito, sem proteção, enquanto o parse equivalente em L344 está dentro de try/catch — e um throw em useEffect realmente propaga e desmonta a árvore. O que não confirmei é a alcançabilidade: escritas em localStorage são atômicas por chave, então o cenário de 'chave truncada por estouro de cota' não se sustenta (setItem lançaria QuotaExceededError, sem gravar parcialmente); a corrupção dependeria de adulteração externa/extensão.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0545 · BAIXO · `CONFIRMADO`

**Alerta clínico falso positivo: 'pus' casa com o verbo pôr**

**Onde:** `src/components/Telemedicine.jsx:483`

**O defeito:** Os red flags são detectados com lowerText.includes(flag.term) (L492), sem delimitação de palavra. O termo 'pus' aparece dentro de construções comuns em português ('eu pus o curativo', 'pus a pomada', 'campus'), e 'escuro'/'escura' aparecem em qualquer descrição de ambiente. O alerta gerado é apresentado ao médico no painel 'ALERTAS CLÍNICOS DISCRETOS' com texto afirmativo sobre a condição do paciente.

**Como falha:** Paciente diz 'ontem eu pus a pomada que a senhora indicou e o quarto estava escuro'. O painel do médico exibe 'Mencionou presença de pus ou secreção purulenta.' e 'Mencionou ferida "escura". Risco de necrose ou isquemia.' — dois alertas de gravidade alta que o paciente jamais relatou, podendo enviesar a conduta.

**Código atual:**

```jsx
{ term: 'pus', alertText: 'Mencionou presença de pus ou secreção purulenta.' },
...
              if (lowerText.includes(flag.term)) {
```

**Correção sugerida:** Usar regex com fronteira de palavra e contexto (ex.: /\bpus\b(?!\s+(a|o|um|uma|na|no))/) em vez de includes().

<details><summary>Verificação feita contra o código</summary>

L478-492 confirmam os termos 'pus', 'escuro' e 'escura' casados com lowerText.includes(flag.term), sem limite de palavra — 'eu pus a pomada' e 'o quarto estava escuro' geram os alertas afirmativos exibidos ao médico. Ressalva de alcançabilidade: esse bloco só roda para chunks remotos com senderRole 'patient', que (conforme item 70008) só chegam entre abas do mesmo navegador, nunca em consulta real entre dispositivos — o que reduz a severidade.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0546 · BAIXO · `CONFIRMAR-SCHEMA`

**Indicador de presença (online) nunca acende e usa três nomes de campo diferentes**

**Onde:** `src/components/Telemedicine.jsx:2291`

**O defeito:** A lista lateral calcula presença por c.lastSeenAt, mas getAssignedDoctors não retorna esse campo (supabaseService.js:2473-2481 mapeia apenas id, name, role, crm, specialty, city, state) — para o paciente o valor é sempre undefined e a função retorna false. O chat expresso usa um terceiro nome, c.online / selectedContact.online (L1515-1517, L1782), que não existe em nenhum retorno do serviço. Em modo contingência local, updateLastSeen (supabaseService.js:2417) retorna null sem gravar nada, então ninguém fica online nunca. O comentário em L202 afirma que o polling de 30s existe justamente para 'real-time presence/last_seen_at sync'.

**Como falha:** Paciente abre a telemedicina para ver se seu profissional está disponível antes de ligar. O médico está com o app aberto, mas a bolinha de presença nunca fica verde e o cabeçalho do chat expresso mostra 'Offline' permanentemente — o paciente desiste de chamar.

**Código atual:**

```jsx
const isOnline = (() => {
                  if (!c.lastSeenAt) return false;
                  ...
                    return (now - lastSeen) < 35000;
```

**Correção sugerida:** Incluir lastSeenAt no mapeamento de getAssignedDoctors e padronizar o componente para ler apenas c.lastSeenAt.

<details><summary>Verificação feita contra o código</summary>

L2291-2300 calcula presença por c.lastSeenAt, mas getAssignedDoctors não devolve esse campo em nenhum dos dois modos (supabaseService.js:2442-2450 e 2473-2481), então para o paciente isOnline é sempre false. O chat expresso usa outro nome, c.online (L1782), inexistente em qualquer retorno do serviço, e updateLastSeen retorna null sem gravar quando !isSupabaseConfigured (L2416-2417). Impacto é de indicador de UI, não clínico.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0547 · BAIXO · `CONFIRMADO`

**Risco 'Alto Risco' e 'Crítico' são exibidos com a mesma cor de 'Risco Moderado'**

**Onde:** `src/components/Telemedicine.jsx:3242`

**O defeito:** A estilização do selo de risco no cabeçalho do relatório só testa a igualdade com 'Leve'. Como a IA pode devolver 'Leve', 'Risco Moderado', 'Alto Risco' ou 'Crítico' (contrato definido em geminiService.js:823), os três níveis não-leves recebem exatamente o mesmo âmbar. Não há nenhum tratamento vermelho/crítico.

**Como falha:** A análise devolve riskLevel 'Crítico' para uma lesão com sinais de necrose. No modal, o selo aparece com o mesmo fundo âmbar de um caso 'Risco Moderado' — o médico que revisa rapidamente não percebe a diferença de gravidade antes de confirmar a evolução.

**Código atual:**

```jsx
backgroundColor: aiReport.riskLevel === 'Leve' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: aiReport.riskLevel === 'Leve' ? '#10b981' : '#f59e0b',
```

**Correção sugerida:** Mapear riskLevel para uma paleta por nível (verde/âmbar/laranja/vermelho) em vez do ternário binário.

<details><summary>Verificação feita contra o código</summary>

L3242-3244 realmente só testam igualdade com 'Leve', pintando de âmbar os três níveis restantes do contrato de geminiService.js:823 ('Risco Moderado', 'Alto Risco', 'Crítico'). Atenuante: o rótulo textual do nível continua visível dentro do selo (L3246), então o médico ainda lê 'Crítico' — a falha é de sinalização visual, não de ocultação da informação.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0548 · BAIXO · `CONFIRMADO`

**TelemedicineClinicalCopilot renderiza objeto como filho React e quebra a tela**

**Onde:** `src/components/telemedicine/TelemedicineClinicalCopilot.jsx:51`

**O defeito:** O componente renderiza cada item de safetyAlerts diretamente como texto. O único produtor de safetyAlerts no módulo é Telemedicine.jsx:495-499, que empilha objetos { id, text, type }. Renderizar um objeto como filho lança 'Objects are not valid as a React child (found: object with keys {id, text, type})', derrubando a árvore. O componente também não é importado em lugar nenhum do projeto (nem ele, nem TelemedicinePage.jsx, nem TelemedicineContactsList.jsx), então o defeito está latente aguardando a primeira integração.

**Como falha:** Ao plugar esse painel modular na tela de consulta passando o estado safetyAlerts já existente, o primeiro alerta detectado (ex.: 'febre') derruba a tela inteira da teleconsulta em andamento com erro de renderização.

**Código atual:**

```jsx
          {safetyAlerts.map((alert, idx) => (
            <div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              • {alert}
            </div>
          ))}
```

**Correção sugerida:** Renderizar {alert.text ?? alert} (usando alert.id como key).

<details><summary>Verificação feita contra o código</summary>

L49-53 renderiza {alert} diretamente e o único produtor do estado, Telemedicine.jsx:495-499, empilha objetos { id, text, type } — renderizar objeto como filho lança 'Objects are not valid as a React child'. O grep confirma que o componente não é importado em lugar nenhum (só a própria definição em L3), portanto é defeito latente, sem alcance atual, o que justifica manter severidade baixa.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0549 · BAIXO · `VERIFICAR`

**Filtros da lista modular de contatos nunca casam com os papéis reais**

**Onde:** `src/components/telemedicine/TelemedicineContactsList.jsx:17`

**O defeito:** Os filtros comparam c.role com 'patient'/'doctor'/'nurse', mas quem monta a lista de contatos (Telemedicine.jsx:210 e :215) sobrescreve role para 'patient' ou 'doctor' e usa chatType para a real classificação; getAssignedDoctors também força role:'doctor'. O filtro 'Profissionais' portanto nunca encontra um enfermeiro, e o indicador de presença lê contact.isOnline (L126), campo que nenhum retorno do serviço produz (o serviço expõe lastSeenAt).

**Como falha:** Ao integrar esse componente, o paciente clica no filtro 'Profissionais' esperando ver a enfermeira que o acompanha; ela aparece na aba errada e sem indicador de presença, porque seu role foi normalizado para 'doctor' e isOnline não existe.

**Código atual:**

```jsx
    if (activeFilter === 'patients') return c.role === 'patient';
    if (activeFilter === 'doctors') return c.role === 'doctor' || c.role === 'nurse';
```

**Correção sugerida:** Filtrar por chatType (não por role) e trocar contact.isOnline por um cálculo baseado em contact.lastSeenAt.

<details><summary>Verificação feita contra o código</summary>

Confirmei o que é verificável: L17-18 filtram por c.role e o produtor dos contatos normaliza role para 'patient'/'doctor' (Telemedicine.jsx:210/215; supabaseService.js:2445/2476), tornando o ramo c.role === 'nurse' código morto; e L126 lê contact.isOnline, campo que nenhum retorno do serviço produz (o serviço expõe lastSeenAt). Mas o cenário de falha descrito é impreciso: como a enfermeira é normalizada para 'doctor', ela APARECE no filtro 'Profissionais' — não vai para a aba errada. Resta o defeito do indicador de presença e do ramo morto, em componente que o grep mostra não ser importado por ninguém.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "Telemedicine.jsx|TelemedicineClinicalCopilot.jsx|TelemedicineContactsList.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
