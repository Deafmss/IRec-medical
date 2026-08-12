# 10. Modo Fácil (acessível)

**15 defeitos** — 2 crítico · 2 alto · 8 médio · 3 baixo

Arquivos tocados por este módulo:

- `src/components/AccessibleDashboard.jsx`
- `src/components/AccessibleSubViews.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0002 · CRÍTICO · `CONFIRMADO`

**Foto da ferida no modo acessível é descartada, mas o app afirma que a enfermagem recebeu a imagem**

**Onde:** `src/components/AccessibleSubViews.jsx:154`

**O defeito:** AccessibleUploadView declara a prop `onPhotoTaken` (linha 140) mas NUNCA a chama; o `reader.onloadend` ignora `reader.result`, exibe um alert de sucesso e navega para o dashboard. Além disso App.jsx:782 renderiza `<AccessibleUploadView setActiveTab={setActiveTab} />` sem passar `onPhotoTaken`, logo não existe nem destino para a imagem. Nenhuma chamada a addWoundEntry/supabaseService acontece.

**Como falha:** Paciente no modo acessível fotografa a ferida infectada, vê o alerta 'Foto capturada com sucesso! Nossa equipe de enfermagem receberá sua imagem' e volta para a tela inicial confiando que foi avaliado. A imagem nunca sai do navegador: não vai para o Supabase, não entra em `entries`, não aparece no prontuário e nenhum profissional é notificado. Perda silenciosa de dado clínico com confirmação falsa ao usuário.

**Código atual:**

```jsx
      const reader = new FileReader();
      reader.onloadend = () => {
        alert("Foto capturada com sucesso! Nossa equipe de enfermagem receberá sua imagem.");
        setActiveTab('dashboard');
      };
```

**Correção sugerida:** Chamar `onPhotoTaken?.(reader.result)` dentro de onloadend e passar a prop com uma função que persista via addWoundEntry em App.jsx:782.

<details><summary>Verificação feita contra o código</summary>

Verifiquei o corpo inteiro de `handleFileSelect` (linhas 149-160): o `reader.onloadend` ignora `reader.result`, dispara o alert 'Nossa equipe de enfermagem receberá sua imagem' e navega para o dashboard. A prop `onPhotoTaken` é declarada na assinatura (linha 140) e nunca é invocada em nenhum ponto do componente. Grep em App.jsx confirma que a linha 782 renderiza `<AccessibleUploadView setActiveTab={setActiveTab} />`, sem passar `onPhotoTaken` — ou seja, mesmo que a chamada existisse não haveria destino. Não há qualquer chamada a addWoundEntry/supabaseService. É perda silenciosa de dado clínico com confirmação falsa ao usuário, defeito mesmo tendo sido escrito de propósito. Severidade 'critico' mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0003 · CRÍTICO · `CONFIRMADO`

**speakText não existe neste arquivo: botão de áudio do Modo Fácil quebra**

**Onde:** `src/components/AccessibleSubViews.jsx:198`

**O defeito:** O arquivo importa speakNaturalText de utils/speechUtils, mas o handler chama speakText — nome que só existe dentro de AccessibleDashboard.jsx e SOSEmergencyModal.jsx, em outro escopo. Confirmado pelo ESLint (no-undef).

**Como falha:** Paciente idoso no Modo Fácil abre 'Nova Foto' e toca em 'OUVIR INSTRUÇÃO EM ÁUDIO' para entender o que fazer. Nenhum som toca; o console registra 'speakText is not defined'. O recurso de áudio, que é a razão de existir do Modo Fácil, não funciona nessa tela.

**Código atual:**

```jsx
import { speakNaturalText } from '../utils/speechUtils';
...
onClick={() => speakText("Aperte no botão roxo grande para abrir a câmera...")}
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0043 · ALTO · `CONFIRMADO`

**Catch da triagem por voz devolve orientação tranquilizadora 'Verde' para qualquer sintoma, inclusive graves**

**Onde:** `src/components/AccessibleDashboard.jsx:196`

**O defeito:** O bloco catch ignora completamente o conteúdo do relato (`cleanText`) e força `triageRiskLevel = 'Verde'` com um texto que afirma explicitamente não ser necessário procurar o pronto-socorro. A verificação de gravidade por palavras-chave existe apenas no caminho de resolução (linhas 155-165), nunca no caminho de exceção. Qualquer erro depois da chamada da IA (por exemplo falha em speakText/setState, ou rejeição não tratada) cai aqui.

**Como falha:** Paciente toca o card 'DOR NO PEITO (URGÊNCIA)' ou fala 'estou com dor no peito e falta de ar'. Se ocorrer qualquer exceção no processamento, o app responde em voz alta: 'Para sintomas leves... Não há necessidade de correr para o pronto-socorro por sintomas simples', com a tarja verde 'Cuidados em Casa' e sem o botão de SOS. Orientação clinicamente perigosa em um quadro potencialmente infartante.

**Código atual:**

```jsx
      const fallback = "Para sintomas leves, o melhor procedimento é descansar em um ambiente calmo, tomar um bom copo de água fresca e repousar. Não há necessidade de correr para o pronto-socorro por sintomas simples.";
      setTriageRiskLevel('Verde');
```

**Correção sugerida:** No catch, reaproveitar a regex `isSevere` sobre `cleanText` e emitir risco 'Vermelho' com orientação de emergência quando houver correspondência.

<details><summary>Verificação feita contra o código</summary>

Li o bloco try/catch (linhas 144-202). O catch da linha 194 não inspeciona `cleanText` nem `categoryTitle`: força `setTriageRiskLevel('Verde')` e um texto que afirma explicitamente 'Não há necessidade de correr para o pronto-socorro'. A detecção de gravidade por regex `isSevere` existe apenas no ramo de fallback dentro do try (linhas 156-161), nunca no catch. O caminho é alcançável na prática: `getPatientFirstLineTriage` é awaited (rejeição de rede cai aqui) e `updateClinicalProfile` é chamado sem await dentro do try (linha 192), de modo que um throw síncrono ali sobrescreve um risco 'Vermelho' já calculado por 'Verde'. Como consequência o card perde a tarja vermelha e o botão de SOS (linha 482). Severidade 'alto' proporcional.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0044 · ALTO · `CONFIRMADO`

**Botão de áudio do modo acessível chama função inexistente (speakText) e quebra em runtime**

**Onde:** `src/components/AccessibleSubViews.jsx:198`

**O defeito:** O arquivo importa apenas `speakNaturalText` (linha 2), mas o handler do botão 'OUVIR INSTRUÇÃO EM ÁUDIO' de AccessibleUploadView chama `speakText(...)`, que não existe nesse módulo nem no escopo global (grep confirma que `speakText` só existe como função local dentro de AccessibleDashboard.jsx:50 e SOSEmergencyModal.jsx:151). O clique lança ReferenceError.

**Como falha:** Paciente idoso em uiMode='accessible' vai em 'Nova Foto' (aba upload) e toca em 'OUVIR INSTRUÇÃO EM ÁUDIO' para entender o que fazer -> nada é falado, nenhum som toca, o console registra 'Uncaught ReferenceError: speakText is not defined'. O recurso de áudio, que é justamente a razão de existir do modo acessível para analfabetos, fica morto nessa tela.

**Código atual:**

```jsx
onClick={() => speakText("Aperte no botão roxo grande para abrir a câmera e tirar a foto da ferida ou da pele.")}
```

**Correção sugerida:** Trocar `speakText(` por `speakNaturalText(` na linha 198.

<details><summary>Verificação feita contra o código</summary>

Li o arquivo: a linha 2 importa apenas `speakNaturalText` e não há nenhuma definição local de `speakText` em AccessibleSubViews.jsx. O handler da linha 198 (dentro de AccessibleUploadView) realmente chama `speakText(...)`, enquanto o botão equivalente de AccessibleTelemedicineView (linha 63) usa corretamente `speakNaturalText`. Isso confirma o erro como esquecimento na cópia do bloco. O clique lança ReferenceError; como o erro ocorre dentro do event handler, a tela não desmonta, mas o botão fica funcionalmente morto. Rebaixo de 'critico' para 'alto': o dano é a perda do recurso de áudio nessa tela (que já é narrada automaticamente no mount pela linha 141-143), não a queda do app.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0205 · MÉDIO · `CONFIRMADO`

**Sem cleanup de reconhecimento de voz e síntese de fala no unmount (áudio vaza entre telas e setState após unmount)**

**Onde:** `src/components/AccessibleDashboard.jsx:31`

**O defeito:** O componente não possui nenhum useEffect com função de limpeza que chame `window.speechSynthesis.cancel()` ou `recognition.abort()`. O único useEffect (linhas 31-35) apenas lê a permissão de notificação. `speakText` e o SpeechRecognition continuam ativos após a desmontagem, e os callbacks `onresult`/`onerror` executam setVoiceQuery/setAiResponse/setTriageRiskLevel em um componente já desmontado.

**Como falha:** Paciente recebe a orientação em áudio e imediatamente toca 'ENVIAR FOTO DA FERIDA' (setActiveTab('upload')). O Dashboard acessível desmonta, mas a locução médica continua tocando por cima da narração da nova tela (que também fala no mount, AccessibleSubViews.jsx:141-143), gerando duas vozes simultâneas e confundindo o usuário com deficiência visual. Se a fala tinha sido iniciada por voz, o microfone segue aberto e chama setState em componente desmontado.

**Código atual:**

```jsx
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
    }
  }, []);
```

**Correção sugerida:** Adicionar `useEffect(() => () => { window.speechSynthesis.cancel(); recognitionRef.current?.abort(); }, [])`.

<details><summary>Verificação feita contra o código</summary>

O único useEffect do componente é o das linhas 31-35 (leitura de Notification.permission) e não retorna função de limpeza; não há nenhum outro useEffect no arquivo. `stopAudioSpeech` (linha 44) existe e chama `speechSynthesis.cancel()`, mas só é acionado por interações do usuário, nunca no unmount. Confirmei também que AccessibleSubViews fala no mount (linhas 6 e 142), então o áudio da tela anterior de fato se sobrepõe ao da nova. Ressalva que reduz o peso do item: em React 18+ setState em componente desmontado é no-op silencioso, sem warning nem vazamento — o dano real é apenas a sobreposição de locuções e o microfone que segue aberto. Mantenho 'medio' pelo impacto em usuários com deficiência visual, que dependem exclusivamente do áudio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0206 · MÉDIO · `VERIFICAR`

**Ids de tarefa baseados no índice do medicamento marcam a tarefa errada quando a lista é editada**

**Onde:** `src/components/AccessibleDashboard.jsx:53`

**O defeito:** Em src/components/Dashboard.jsx (linhas 51-58) os ids das tarefas de medicação são gerados como `real_med_${idx}` a partir da posição no split de `profile.medications`, e esses ids são persistidos no localStorage do checklist. Qualquer reordenação, remoção ou inserção de medicamento remapeia os ids para medicamentos diferentes. O mesmo vale para `prescribed_plan_${idx}`.

**Como falha:** Perfil com medications = 'Insulina NPH, Losartana'. Paciente marca 'Tomar medicamento de uso contínuo prescrito: Insulina NPH' (id real_med_0). O enfermeiro edita a ficha para 'Losartana, Insulina NPH'. Ao reabrir o diário no mesmo dia, a Losartana aparece marcada como tomada e a Insulina como pendente — registro de adesão medicamentosa invertido.

**Código atual:**

```jsx
        list.push({
          id: `real_med_${idx}`,
          text: `Tomar medicamento de uso contínuo prescrito: ${med}`,
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0207 · MÉDIO · `CONFIRMADO`

**Gravação da triagem usa snapshot obsoleto do perfil e pode perder alertas / ser sobrescrita pelo polling**

**Onde:** `src/components/AccessibleDashboard.jsx:183`

**O defeito:** `updatedProfile` é montado a partir do prop `clinicalProfile` capturado no closure do render, e `updateClinicalProfile(clinicalProfile.id, updatedProfile)` é chamado sem await e sem catch. Duas execuções iniciadas antes de um re-render partem da mesma lista `triageAlerts`, e a segunda gravação sobrescreve a primeira. Além disso o polling do App (App.jsx:690-701) refaz getClinicalProfile a cada 30 s e chama setClinicalProfile com a versão do servidor, que pode ainda não conter o alerta gravado.

**Como falha:** Paciente toca 'FEBRE OU CALAFRIO' e, em seguida, ainda no mesmo ciclo de render, toca 'DOR NO PEITO'. Os dois saves partem do mesmo array de triageAlerts, então apenas o último alerta persiste — o registro da febre desaparece do prontuário. Em outro cenário, o alerta acabou de ser salvo localmente e o polling de 30 s traz o perfil do servidor sem ele, fazendo o alerta sumir da tela apesar da mensagem '✓ Registrado automaticamente na ficha médica'.

**Código atual:**

```jsx
        const updatedAlerts = [newAlert, ...(clinicalProfile.triageAlerts || [])].slice(0, 20);
        const updatedProfile = { 
          ...clinicalProfile, 
          triageAlerts: updatedAlerts,
```

**Correção sugerida:** Usar `setClinicalProfile(prev => ...)` para montar os alertas e `await updateClinicalProfile(...)` dentro de try/catch com feedback ao usuário em caso de falha.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 173-193: `updatedAlerts` parte de `clinicalProfile.triageAlerts` capturado no closure do render, e `updateClinicalProfile(clinicalProfile.id, updatedProfile)` (linha 192) roda sem await, sem .catch e sem forma funcional de setState — duas triagens iniciadas antes de um re-render partem do mesmo array e a segunda sobrescreve a primeira. Confirmei também o polling em App.jsx:687-705, que chama `getClinicalProfile` e `setClinicalProfile(profile)` incondicionalmente com a versão do servidor. A falha silenciosa de escrita (promise rejeitada sem catch) é certa por leitura de código; a corrida específica com o polling depende de latência real do backend, mas o padrão de escrita é inequivocamente inseguro. Severidade 'medio' adequada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0208 · MÉDIO · `CONFIRMADO`

**Parar a gravação de voz não interrompe o reconhecimento: a triagem dispara sozinha depois**

**Onde:** `src/components/AccessibleDashboard.jsx:225`

**O defeito:** A instância `recognition` é criada como variável local dentro do bloco else (linha 228) e nunca guardada em useRef. Quando `isRecording` é true, o segundo toque apenas faz `setIsRecording(false)` — não chama `recognition.stop()` nem `.abort()`. O microfone continua ativo e `onresult` ainda executa `processSymptomQuery(transcript)`.

**Como falha:** Paciente aperta o botão gigante, percebe que falou errado e aperta de novo para cancelar. A UI volta para 'APERTE AQUI E FALE...', mas segundos depois o app começa a falar sozinho uma orientação médica baseada no relato que o paciente quis descartar, e grava um alerta de triagem indesejado no prontuário (linhas 173-193).

**Código atual:**

```jsx
    if (isRecording) {
      setIsRecording(false);
    } else {
      const recognition = new SpeechRecognition();
```

**Correção sugerida:** Guardar a instância em `recognitionRef` e chamar `recognitionRef.current?.abort()` no ramo `if (isRecording)`.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 212-256: `const recognition = new SpeechRecognition()` (linha 228) é variável local do bloco else, não guardada em ref. O ramo `if (isRecording) { setIsRecording(false); }` (linhas 225-226) não chama `.stop()` nem `.abort()`, e não existe nenhuma outra referência à instância fora desse escopo. O handler `onresult` (linha 236) segue vivo e executa `processSymptomQuery(transcript)` incondicionalmente, sem checar se o usuário cancelou — o que dispara fala automática e a gravação do alerta no prontuário (linhas 173-193). Cenário totalmente alcançável por um usuário real que toca duas vezes no botão. Severidade 'medio' adequada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0209 · MÉDIO · `CONFIRMADO`

**Botão principal de voz é uma div clicável, sem foco, role ou nome acessível**

**Onde:** `src/components/AccessibleDashboard.jsx:351`

**O defeito:** O controle mais importante da tela acessível é um `<div>` com `onClick` e `cursor: pointer`, sem `role="button"`, `tabIndex={0}`, handler de teclado (Enter/Espaço) ou aria-label. Não é focável nem anunciado como botão. Os demais controles da tela são `<button>` corretos, o que evidencia a inconsistência.

**Como falha:** Paciente com deficiência visual navegando por leitor de tela (TalkBack/NVDA) percorre a página por Tab: o controle 'APERTE AQUI E FALE O QUE ESTÁ SENTINDO' nunca recebe foco e não é anunciado, tornando a triagem por voz — o recurso central do modo acessível — inalcançável sem toque preciso na tela.

**Código atual:**

```jsx
      }}
      onClick={handleVoiceRecord}
      >
        <span style={{ fontSize: '52px' }}>{isRecording ? '🎙️🔴' : '🎙️'}</span>
```

**Correção sugerida:** Trocar a div por `<button type="button">` (ou adicionar role="button", tabIndex={0}, onKeyDown para Enter/Espaço e aria-label descritivo).

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 351-373: o controle é um `<div>` com `onClick={handleVoiceRecord}` e `cursor: 'pointer'`, sem `role="button"`, `tabIndex`, `onKeyDown` ou `aria-label`. Não há elemento focável interno (apenas `<span>`), logo o controle é de fato inalcançável por teclado e não é anunciado como botão por leitores de tela. O contraste com o resto do arquivo é evidente: o botão de notificação (linha 328), os cards de sintoma (linha 526) e os botões de ação (linhas 459, 483) são todos `<button>` reais. Sendo o recurso central do modo acessível, o impacto é desproporcional ao tamanho do erro. Severidade 'medio' adequada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0210 · MÉDIO · `CONFIRMADO`

**Card afirma 'Registrado automaticamente na ficha médica' mesmo quando nada foi salvo**

**Onde:** `src/components/AccessibleDashboard.jsx:453`

**O defeito:** O selo de confirmação é renderizado incondicionalmente sempre que existe `aiResponse`, mas a gravação só ocorre dentro do `if (clinicalProfile && clinicalProfile.id)` (linha 173). Quando o perfil ainda não carregou (o App preenche clinicalProfile de forma assíncrona) ou o app está em contingência local, nenhum dado chega aos profissionais.

**Como falha:** Paciente abre o app no modo acessível e relata dor no peito antes do perfil terminar de carregar (clinicalProfile ainda null). A resposta é exibida com o selo verde '✓ Registrado automaticamente na ficha médica para acompanhamento dos doutores', mas nenhum alerta de triagem foi criado; nenhum médico verá o episódio. O paciente confia que a equipe foi avisada.

**Código atual:**

```jsx
              ✓ Registrado automaticamente na ficha médica para acompanhamento dos doutores.
```

**Correção sugerida:** Controlar o selo por um estado `savedToRecord` definido só após o sucesso de updateClinicalProfile, com mensagem alternativa quando não gravou.

<details><summary>Verificação feita contra o código</summary>

O selo das linhas 451-455 está dentro do bloco `{aiResponse && !loadingAi && (...)}` (linha 398), sem qualquer condicional ligada ao sucesso da gravação, enquanto a persistência ocorre apenas dentro de `if (clinicalProfile && clinicalProfile.id)` (linha 173). O cenário é ainda mais alcançável do que o auditor descreveu: App.jsx:426-440 inicializa `clinicalProfile` como um objeto literal SEM campo `id`, preenchido só depois em App.jsx:554-556. Logo, qualquer triagem feita antes do carregamento do perfil — inclusive o primeiro relato após abrir o app — exibe o selo verde sem gravar nada. Somando-se ao item 157 (escrita sem catch), o selo também mente quando o save falha. Severidade 'medio' adequada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0211 · MÉDIO · `CONFIRMADO`

**Texto invisível no tema claro: var(--text-primary) sobre fundo escuro fixo #1e293b**

**Onde:** `src/components/AccessibleDashboard.jsx:519`

**O defeito:** O container da linha 511-518 fixa `backgroundColor: '#1e293b'` (azul-escuro), mas o título usa `color: 'var(--text-primary, #ffffff)'`. No tema claro `--text-primary` é `#0f172a` (src/index.css:14), praticamente a mesma cor do fundo — contraste próximo de 1:1. O fallback #ffffff só se aplica se a variável não estiver definida, o que nunca acontece.

**Como falha:** Paciente idoso com baixa visão usa o app no tema claro (padrão). A instrução principal '👉 Ou toque na imagem do sintoma para consultar o Assistente Clínico:' fica ilegível (texto azul-escuro sobre caixa azul-escura), justamente na tela desenhada para acessibilidade.

**Código atual:**

```jsx
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary, #ffffff)', margin: 0 }}>
```

**Correção sugerida:** Trocar `color: 'var(--text-primary, #ffffff)'` por `color: '#ffffff'` na linha 519, alinhando com os demais textos sobre #1e293b.

<details><summary>Verificação feita contra o código</summary>

Li o trecho: o container das linhas 511-518 fixa `backgroundColor: '#1e293b'` e o h2 da linha 519 usa `color: 'var(--text-primary, #ffffff)'`. Grep em src/index.css confirma `--text-primary: #0f172a` no tema claro (linha 14) e `#f0fdf4` no escuro (linha 53). Como a variável está sempre definida, o fallback #ffffff nunca entra em jogo, e no tema claro o texto fica #0f172a sobre #1e293b — contraste em torno de 1.2:1, muito abaixo do mínimo WCAG. Todos os textos vizinhos do arquivo usam `#ffffff` literal, o que confirma que a variável aqui é um deslize. Defeito real de acessibilidade justamente na tela desenhada para baixa visão. Severidade 'medio' adequada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0212 · MÉDIO · `CONFIRMADO`

**Narração automática no mount sem cleanup: fala duplicada em StrictMode e áudio que não para ao sair da tela**

**Onde:** `src/components/AccessibleSubViews.jsx:5`

**O defeito:** Ambas as views (AccessibleTelemedicineView linhas 5-7 e AccessibleUploadView linhas 141-143) chamam `speakNaturalText` no mount sem retornar função de cleanup que cancele a síntese. O app roda em <StrictMode> (src/main.jsx:19), logo em desenvolvimento o efeito executa duas vezes; e `speakNaturalText` agenda `setTimeout(doSpeak, 150)` quando a lista de vozes ainda não carregou (src/utils/speechUtils.js:94-95), de modo que o `speechSynthesis.cancel()` da segunda execução não impede a fala agendada.

**Como falha:** Paciente abre a tela de teleconsulta acessível: a instrução é falada, ele volta imediatamente para o início e a voz continua narrando 'aperte no botão verde grande' enquanto o dashboard já está na tela. Se ele alternar rápido entre 'Nova Foto' e 'Teleconsulta', duas locuções diferentes se sobrepõem e nenhuma fica compreensível.

**Código atual:**

```jsx
  useEffect(() => {
    speakNaturalText("Para falar por vídeo com o seu profissional de saúde, aperte no botão verde grande na tela.");
  }, []);
```

**Correção sugerida:** Retornar `() => window.speechSynthesis.cancel()` nos useEffect das linhas 5-7 e 141-143.

<details><summary>Verificação feita contra o código</summary>

Verifiquei os dois efeitos (linhas 5-7 e 141-143): ambos chamam `speakNaturalText` e retornam undefined, sem cleanup. Confirmei `<StrictMode>` em src/main.jsx:19, e em speechUtils.js confirmei tanto o `window.speechSynthesis.cancel()` de abertura (linha 28) quanto o `setTimeout(doSpeak, 150)` do caminho em que `getVoices()` ainda está vazio (linhas 93-95) — como o cancel não limpa o timer pendente, a segunda montagem realmente não impede a primeira fala agendada. Duas ressalvas de proporção: a duplicação por StrictMode é exclusiva de desenvolvimento, e o `cancel()` interno de speakNaturalText já mitiga a sobreposição no caso comum (vozes carregadas). O defeito que sobra e atinge produção é o áudio que continua após o usuário sair da tela. Mantenho 'medio'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0426 · BAIXO · `CONFIRMADO`

**Permissão de notificação negada: botão permanece na tela e o clique não dá nenhum retorno ao usuário**

**Onde:** `src/components/AccessibleDashboard.jsx:78`

**O defeito:** A barra só é escondida quando `notificationStatus === 'granted'` (linha 327). Com permissão 'denied', `Notification.requestPermission()` resolve imediatamente como 'denied' sem exibir prompt, o `if (perm === 'granted')` não executa e não há ramo else — nenhum alerta, nenhuma orientação. Erros caem em `catch` que apenas faz console.error, sem feedback.

**Como falha:** Paciente já negou notificações antes. Ele toca 'ATIVAR ALERTA FIXO DE EMERGÊNCIA NA BARRA DO CELULAR' repetidamente: nada acontece, nenhum aviso explicando que precisa liberar nas configurações do navegador, e o botão continua ali sugerindo que ainda não foi ativado.

**Código atual:**

```jsx
    } catch (err) {
      console.error(err);
    }
```

**Correção sugerida:** Adicionar um else que alerte como reabilitar notificações nas configurações do navegador (e ocultar/desabilitar o botão quando o status for 'denied').

<details><summary>Verificação feita contra o código</summary>

Confirmado em `requestNotificationPermission` (linhas 54-81): há alert apenas para navegador sem suporte (linha 58) e para o caso 'granted' (linha 76); o `if (perm === 'granted')` não tem ramo else, e o catch da linha 78 só faz console.error. A barra é renderizada enquanto `notificationStatus !== 'granted'` (linha 327), então com permissão 'denied' o botão permanece visível e o clique é completamente mudo — `Notification.requestPermission()` resolve 'denied' sem prompt, conforme a especificação. Cenário alcançável por qualquer usuário que já negou a permissão. Severidade 'baixo' adequada: é frustração de UX, sem perda de dado clínico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0427 · BAIXO · `CONFIRMAR-SCHEMA`

**Estado selectedSymptomTitle é gravado mas nunca renderizado: o card de resposta não identifica o sintoma**

**Onde:** `src/components/AccessibleDashboard.jsx:141`

**O defeito:** `selectedSymptomTitle` é declarado (linha 29) e atualizado (linha 141), porém não aparece em nenhum ponto do JSX — grep no arquivo confirma apenas duas ocorrências, ambas de escrita. O cabeçalho do card mostra sempre o texto fixo 'Orientação Médica por Voz'.

**Como falha:** Paciente toca em 'FEBRE OU CALAFRIO' e depois em 'FERIDA OU CORTE NA PELE'. Em nenhum momento o card de resposta informa a qual queixa aquela orientação se refere; sem leitura fluente, o paciente não consegue distinguir se a orientação exibida é da febre ou da ferida.

**Código atual:**

```jsx
    setSelectedSymptomTitle(categoryTitle || 'Relato por Voz');
```

**Correção sugerida:** Renderizar `{selectedSymptomTitle}` no cabeçalho do card em vez do texto fixo 'Orientação Médica por Voz'.

<details><summary>Verificação feita contra o código</summary>

Grep por 'SymptomTitle' no arquivo retorna exatamente 2 ocorrências: a declaração do useState (linha 29) e a escrita na linha 141 — nenhuma leitura no JSX. Confirmei por leitura direta que o cabeçalho do card exibe o literal 'Orientação Médica por Voz' (linhas 422-424) e que o único eco do relato é `voiceQuery` (linha 377), que só é preenchido no fluxo por voz e no clique de card, não identificando a resposta exibida. É estado morto mais uma lacuna de UX real. Severidade 'baixo' adequada: nada quebra e nenhuma informação errada é apresentada, apenas falta contexto.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0428 · BAIXO · `CONFIRMADO`

**Botão 'AGENDAR CONSULTA POR VÍDEO NO APP' leva para a listagem de enfermeiros, não para agendamento**

**Onde:** `src/components/AccessibleDashboard.jsx:460`

**O defeito:** O handler navega para a aba 'nurses' (NursesNetwork), que é a rede/listagem de enfermeiros renderizada na UI padrão, e não para o fluxo de agendamento ('my-appointments'/'doctors_directory'). A ação prometida pelo rótulo não é executada, e o paciente do modo acessível é jogado numa tela densa sem os controles ampliados.

**Como falha:** Triagem classificada como 'Amarelo' oferece 'AGENDAR CONSULTA POR VÍDEO NO APP'. O paciente idoso toca e cai numa listagem de profissionais com texto pequeno, sem nenhum passo de agendamento iniciado nem botão de voltar em modo acessível — a consulta recomendada nunca é marcada.

**Código atual:**

```jsx
              onClick={() => { stopAudioSpeech(); triggerVibration(); setActiveTab('nurses'); }}
```

**Correção sugerida:** Ajustar o rótulo para 'FALAR COM UM PROFISSIONAL AGORA' ou apontar o clique para o fluxo real de agendamento.

<details><summary>Verificação feita contra o código</summary>

Confirmei o handler na linha 460 (`setActiveTab('nurses')`) e, em App.jsx, que o case 'nurses' (linha 839) renderiza `NursesNetwork`. Grep em NursesNetwork.jsx mostra que o componente não possui nenhum fluxo de agendamento — suas ações navegam para `setActiveTab('telemedicine')` (linhas 483 e 500), ou seja, chamada imediata, não marcação de horário. O rótulo 'AGENDAR' portanto não corresponde ao destino, e a tela alvo é a UI padrão, sem os controles ampliados do modo acessível. Atenuante em relação ao relato do auditor: não é beco sem saída, o paciente ainda consegue chegar à teleconsulta a partir dali. Mantenho 'baixo'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "AccessibleDashboard.jsx|AccessibleSubViews.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
