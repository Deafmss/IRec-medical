# 4. Assistente de IA

**39 defeitos** — 5 crítico · 11 alto · 16 médio · 7 baixo

Arquivos tocados por este módulo:

- `src/components/AIChatAssistant.jsx`
- `src/services/geminiService.js`
- `supabase/functions/gemini-analysis/index.ts`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0031 · CRÍTICO · `CONFIRMADO`

> **Correção do número:** são **8** chaves reais, não 20. O código declara 20 slots (`VITE_GEMINI_API_KEY` até `_20`), mas apenas 8 têm valor no `.env`; o `.filter(Boolean)` da linha 23 descarta o resto. Verificado no bundle: 8 chaves em texto claro. Ver [`00-URGENTE-cota-e-modelo-gemini.md`](00-URGENTE-cota-e-modelo-gemini.md) para o prazo (antes do primeiro deploy público).

**8 chaves de API do Gemini sao embutidas no bundle publico via VITE_***

**Onde:** `src/services/geminiService.js:3`

**O defeito:** As chaves sao lidas de import.meta.env.VITE_GEMINI_API_KEY..._20 e usadas direto na URL (linha 138: '?key=${apiKey}'). O Vite substitui qualquer VITE_* por literal no bundle. Confirmei que as chaves reais do .env do projeto ja estao no build: 'grep -o "AQ.Ab8" dist/assets/index-DpAjXvMY.js' retorna 8 ocorrencias, ou seja 8 chaves em texto claro no JS servido ao navegador.

**Como falha:** Qualquer visitante abre o DevTools > Sources (ou baixa dist/assets/index-*.js), procura por 'generativelanguage.googleapis.com' e copia as 8 chaves. Ele passa a usar a cota paga do projeto iRec para qualquer finalidade, e/ou esgota a cota, derrubando a triagem e o chat de todos os pacientes. O rodizio de chaves nao mitiga nada: todas estao no mesmo arquivo.

**Código atual:**

```jsx
const GEMINI_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY,
  import.meta.env.VITE_GEMINI_API_KEY_2,
...
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelAndAction}?key=${apiKey}`;
```

**Correção sugerida:** Remover as chaves do cliente e roteartodas as chamadas Gemini pela Edge Function (que já usa Deno.env.get('GEMINI_API_KEY')), revogando as chaves expostas.

<details><summary>Verificação feita contra o código</summary>

Verifiquei por ferramenta: `.env` (912 bytes) tem 8 entradas VITE_GEMINI_* e `grep -o 'AQ.Ab8' dist/assets/index-DpAjXvMY.js` retorna 8 ocorrências — as chaves reais estão em texto claro no JS servido. O código lê import.meta.env.VITE_GEMINI_API_KEY..._20 (linhas 3-22) e concatena direto na URL pública (linha 138 `?key=${apiKey}`). Vite substitui VITE_* por literal no build, sem qualquer proxy. O rodízio não mitiga: as 8 chaves estão no mesmo arquivo. Extração é trivial via DevTools.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0032 · CRÍTICO · `CONFIRMADO`

**chatWithDoctorCopilot usa o objeto Response como se fosse JSON e falha sempre**

**Onde:** `src/services/geminiService.js:609`

**O defeito:** fetchGeminiWithRotation retorna o objeto Response do fetch (linha 172), e todas as outras funcoes fazem 'await response.json()'. Em chatWithDoctorCopilot falta o .json(): a linha 602 guarda o Response em 'responseData' e a linha 609 testa 'responseData.candidates', que nunca existe num Response. O if entra sempre e lanca 'Falha no chat do Copiloto Gemini', o catch retorna null. O Copiloto Medico e a formatacao SOAP nunca funcionam, mesmo com chave valida.

**Como falha:** Medico abre o prontuario de um paciente em DoctorDashboard, seleciona uma triagem e clica em 'Sugerir evolucao com IA' (handleSuggestAISummary, DoctorDashboard.jsx:391). A chamada gasta a cota do Gemini, recebe a resposta correta do Google, joga fora e retorna null; o medico ve o alert 'Nao foi possivel gerar a sugestao no momento. Tente novamente.' em toda tentativa. Mesmo efeito no chat do copiloto (DoctorDashboard.jsx:755).

**Código atual:**

```jsx
    const responseData = await fetchGeminiWithRotation('gemini-1.5-flash:generateContent', {...});

    if (!responseData || !responseData.candidates || !responseData.candidates[0]) {
      throw new Error(`Falha no chat do Copiloto Gemini`);
    }
```

**Correção sugerida:** Inserir `const responseData = await rawResponse.json();` após a chamada, mantendo o Response numa variável separada.

<details><summary>Verificação feita contra o código</summary>

fetchGeminiWithRotation retorna `response` (objeto Response, linha 172). Em chatWithDoctorCopilot a linha 602 guarda esse Response em `responseData` e a linha 609 testa `responseData.candidates`, que é sempre undefined num Response — não há `await responseData.json()` em lugar nenhum da função (todas as outras funções fazem: linhas 294, 440, 700, 763, 1006). Portanto o if entra sempre, lança 'Falha no chat do Copiloto Gemini' e o catch da linha 614 retorna null. Copiloto (DoctorDashboard.jsx:755) e sugestão SOAP via copiloto (DoctorDashboard.jsx:391) nunca funcionam, mesmo consumindo a cota da API.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0033 · CRÍTICO · `CONFIRMADO`

**Variavel inexistente 'comorbididades' quebra toda a triagem por voz do paciente**

**Onde:** `src/services/geminiService.js:962`

**O defeito:** Na linha 949 a variavel e declarada como 'comorbidities', mas o template string da linha 962 interpola 'comorbididades' (com erro de digitacao). Isso lanca 'ReferenceError: comorbididades is not defined' antes de qualquer chamada de rede. O erro cai no catch da linha 1014 e a funcao retorna null sempre, em 100% das execucoes, mesmo com chave Gemini valida.

**Como falha:** Paciente idoso no modo acessivel (uiMode 'accessible') aperta o botao de voz em AccessibleDashboard e diz 'fui atropelado, minha perna esta quebrada'. getPatientFirstLineTriage lanca ReferenceError, retorna null, e AccessibleDashboard.jsx:154 cai no fallback por regex. A triagem clinica real da IA NUNCA e executada para nenhum paciente: qualquer relato que nao case com a regex de gravidade da linha 157 (ex.: 'estou vomitando sangue', 'nao consigo urinar ha dois dias') recebe a resposta 'Verde' fixa de baixo risco recomendando repouso e hidratacao.

**Código atual:**

```jsx
    const comorbidities = [
      patientProfile?.hasDiabetes ? 'Diabetes' : null,
...
- Comorbidades Conhecidas: ${comorbididades}
```

**Correção sugerida:** Trocar `${comorbididades}` por `${comorbidities}` na linha 962.

<details><summary>Verificação feita contra o código</summary>

Li o trecho: linha 949 declara `const comorbidities = [...]` e a linha 962 interpola `${comorbididades}`. Não existe nenhuma outra declaração desse identificador no escopo (ESLint já acusa no-undef nessa linha). A avaliação do template literal ocorre dentro do try (linha 947), lança ReferenceError antes de qualquer fetch, cai no catch da linha 1014 e retorna null em 100% das execuções. Confirmei também que .env tem 8 chaves VITE_GEMINI e que elas estão no bundle, ou seja isGeminiConfigured é true e o early-return da linha 943 não protege. Em AccessibleDashboard.jsx:151 o null cai no fallback por regex (linhas 156-165) que só produz 'Vermelho' ou 'Verde'.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0034 · CRÍTICO · `CONFIRMADO`

**Variável inexistente 'comorbididades' derruba a triagem por voz: a IA nunca responde no modo acessível**

**Onde:** `src/services/geminiService.js:962`

**O defeito:** O template literal usa `${comorbididades}` (com erro de digitação), mas a variável declarada na linha 949 é `comorbidities`. A avaliação do template lança ReferenceError, que é engolido pelo try/catch da própria função (linhas 1014-1017), fazendo `getPatientFirstLineTriage` retornar SEMPRE null. Consequência direta em AccessibleDashboard.jsx:151: `aiTriageResult` é sempre null e o fluxo cai sempre no fallback local por palavra-chave (linhas 155-165), que só produz 'Vermelho' ou 'Verde'. Portanto o nível 'Amarelo' e o botão 'AGENDAR CONSULTA POR VÍDEO NO APP' (AccessibleDashboard.jsx:458-479) são código inalcançável.

**Como falha:** Paciente no modo acessível fala 'estou com febre há cinco dias e a ferida está piorando'. A IA nunca é consultada de fato; o regex local não casa nenhuma palavra grave, então o app responde 'Verde - repouse e hidrate-se' e nunca oferece a teleconsulta (Amarelo). O texto da tela ainda promete 'análise 100% dinâmica' feita pelo Assistente Clínico.

**Código atual:**

```jsx
- Comorbidades Conhecidas: ${comorbididades}
```

**Correção sugerida:** Corrigir o identificador para `${comorbidities}` na linha 962 (item duplicado do 98 — uma única correção resolve ambos).

<details><summary>Verificação feita contra o código</summary>

Mesmo defeito do item 98, com a consequência adicional verificada em AccessibleDashboard.jsx:144-170: como getPatientFirstLineTriage sempre retorna null, o `if (aiTriageResult && aiTriageResult.advice)` da linha 151 nunca é satisfeito e o fluxo cai no else, cujo regex da linha 157 só produz 'Vermelho' (linha 160) ou 'Verde' (linha 163) — o nível 'Amarelo' é de fato inalcançável por esse caminho, e o relato de risco moderado ('febre há cinco dias') recebe o texto fixo de repouso e hidratação da linha 164, gravado ainda como aiTriageReply no prontuário (linhas 174-183).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0035 · CRÍTICO · `CONFIRMADO`

**Variável 'comorbididades' (erro de digitação) não existe: derruba a triagem por voz**

**Onde:** `src/services/geminiService.js:962`

**O defeito:** A linha 949 declara `comorbidities` e a 962 usa `comorbididades`. Confirmado pelo ESLint (no-undef).

**Como falha:** Paciente no Modo Fácil aperta o botão de voz e relata um sintoma. getPatientFirstLineTriage lança ReferenceError e retorna null; o AccessibleDashboard cai no fallback por expressão regular. A triagem por IA nunca roda, mas a tela continua prometendo 'análise inteligente'.

**Código atual:**

```jsx
// linha 949
const comorbidities = [...];
// linha 962
... ${comorbididades} ...   // <- variável inexistente
```

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0058 · ALTO · `CONFIRMAR-SCHEMA`

**Conversa clinica gravada na chave 'guest' do localStorage e nunca limpa no logout**

**Onde:** `src/components/AIChatAssistant.jsx:142`

**O defeito:** userId = clinicalProfile?.id || 'guest'. O clinicalProfile inicial do App.jsx (linha 426) nao tem 'id' - ele so ganha id quando getClinicalProfile resolve de forma assincrona (App.jsx:554-556). Se a aba 'chat' e restaurada de irec_active_tab, o componente monta com userId='guest' e persiste mensagens em 'irec_chat_threads_guest'. O handleLogout do App.jsx (linhas 652-667) remove irec_active_user, irec_active_tab, irec_selected_patient etc., mas nenhuma chave 'irec_chat_threads_*'.

**Como falha:** Paciente A abre o app num tablet compartilhado da unidade de saude com a aba chat restaurada, digita 'minha ferida no pe diabetico esta com pus e cheiro forte' antes do perfil carregar (a mensagem vai para irec_chat_threads_guest e depois desaparece da tela quando o useEffect [userId] recarrega pela chave real). Ele faz logout. Paciente B entra no mesmo tablet, o perfil dele demora a carregar, o chat monta com userId='guest' e o relato clinico do Paciente A aparece no historico de conversas do Paciente B.

**Código atual:**

```jsx
  const userId = clinicalProfile?.id || 'guest';
...
    localStorage.setItem(`irec_chat_threads_${userId}`, JSON.stringify(updatedThreads));
```

**Correção sugerida:** Nao montar/persistir o chat enquanto clinicalProfile?.id for indefinido (early return com loading) e remover todas as chaves irec_chat_* no handleLogout.

<details><summary>Verificação feita contra o código</summary>

Verifiquei os tres elos. (1) App.jsx:426-439 inicializa clinicalProfile sem campo id, entao no primeiro render userId e literalmente 'guest' e o useState inicializador (linha 145) e o saveThreads (linha 430) usam a chave irec_chat_threads_guest. (2) O id so chega depois, de forma assincrona (App.jsx:556), e o useEffect [userId] entao recarrega pela chave real, descartando da tela o que foi digitado - mas o conteudo permanece gravado em ...guest. (3) handleLogout (App.jsx:652-668) remove seis chaves de navegacao e nenhuma irec_chat_threads_*, e nao reseta clinicalProfile. Logo, o relato clinico do paciente A escrito na janela guest fica no aparelho e reaparece para o paciente B na mesma janela.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0059 · ALTO · `CONFIRMADO`

**streamResponse quebra em loop infinito quando a resposta da IA vem sem texto**

**Onde:** `src/components/AIChatAssistant.jsx:519`

**O defeito:** O setInterval acessa 'responseText.length' sem qualquer guarda. Se responseText for undefined (JSON da IA sem campo 'reply', ou guardrail atribuindo safeAlternative undefined em geminiService.js:491), o callback lanca TypeError a cada 8 ms. Como o clearInterval so ocorre no ramo else, o intervalo nunca e limpo, setIsTyping(false) nunca roda e o log de auditoria nunca e gravado.

**Como falha:** Paciente pergunta algo que o guardrail classifica como inseguro (isSafe:false) e o modelo devolve safeAlternative vazio/ausente. resultObj.reply passa a ser undefined, streamResponse(undefined,...) e chamado; o indicador 'digitando...' fica girando para sempre, o input e o botao enviar ficam desabilitados (disabled={isTyping}) e o console acumula milhares de erros por segundo. O paciente precisa recarregar a pagina e a resposta de seguranca nunca aparece.

**Código atual:**

```jsx
    const interval = setInterval(() => {
      if (index < responseText.length) {
        currentText += responseText[index];
```

**Correção sugerida:** No inicio de streamResponse, fazer 'const safeText = typeof responseText === string ? responseText : (responseText ? String(responseText) : mensagem de erro padrao)' e usar safeText no loop.

<details><summary>Verificação feita contra o código</summary>

Linhas 498-560 confirmadas: streamResponse nao valida responseText, e o callback do setInterval acessa responseText.length na primeira instrucao (linha 519). Um TypeError lancado dentro do callback nao interrompe o setInterval, e o clearInterval so existe no ramo else (linha 532), portanto o intervalo roda para sempre a cada 8 ms, setIsTyping(false) nunca executa e o input fica travado. O chamador so verifica 'realResponse && typeof realResponse === object' (linha 847), nunca realResponse.reply. O caminho de origem existe: geminiService.js:491 faz 'resultObj.reply = validationResult.safeAlternative' sem checar se o campo veio no JSON do validador. Severidade rebaixada para alto porque depende de uma resposta malformada da IA, nao de acao direta do usuario.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0060 · ALTO · `VERIFICAR`

**applyProfileUpdates grava null no clinicalProfile global quando o save falha**

**Onde:** `src/components/AIChatAssistant.jsx:613`

**O defeito:** updateClinicalProfile retorna null quando nao consegue resolver o userId (supabaseService.js:656 'if (!userId) return null;'). O codigo chama setClinicalProfile(savedProfile) sem verificar, propagando null para o estado compartilhado do App. Como userId no componente e derivado de clinicalProfile?.id (linha 142), ele passa de <id-do-paciente> para 'guest', disparando o useEffect [userId] e trocando todo o historico de conversas.

**Como falha:** Paciente sem sessao Supabase ativa (modo contingencia com irec_active_user perdido) menciona 'sou diabetico' no chat. applyProfileUpdates chama updateClinicalProfile, recebe null e faz setClinicalProfile(null). Imediatamente: (1) o historico de conversas do paciente desaparece e e substituido pelo do usuario 'guest'; (2) a proxima mensagem quebra em 'Cannot read properties of null (reading "hasDiabetes")' na linha 880; (3) App.jsx:601 (clinicalProfile.name) tambem passa a lancar TypeError ao gerar protocolos.

**Código atual:**

```jsx
        const savedProfile = await updateClinicalProfile(updatedProfile);
        if (setClinicalProfile) {
          setClinicalProfile(savedProfile);
        }
```

**Correção sugerida:** Trocar por 'if (savedProfile && setClinicalProfile) setClinicalProfile(savedProfile);' e logar/avisar quando o retorno for null.

<details><summary>Verificação feita contra o código</summary>

Confirmei os dois lados do defeito: supabaseService.js:653-656 realmente retorna null quando nao consegue resolver userId (nem profile.id nem getActiveUserId), e AIChatAssistant.jsx:613-616 chama setClinicalProfile(savedProfile) sem qualquer verificacao de null, dentro do try (o catch so pega excecao, e retorno null nao lanca). Como userId do componente e clinicalProfile?.id || guest (linha 142), um null realmente trocaria a chave de threads para guest. Fica PLAUSIVEL e nao CONFIRMADO porque o retorno null exige que o perfil nao tenha id E que getActiveUserId falhe (sessao Supabase expirada ou irec_active_user removido) - nao consegui confirmar a frequencia real desse estado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0171 · CRÍTICO · `CONFIRMADO`

> **Severidade elevada de ALTO para CRÍTICO.** Ver [`00-URGENTE-cota-e-modelo-gemini.md`](00-URGENTE-cota-e-modelo-gemini.md): a cota real é de 20 requisições/dia por projeto, e o modelo chamado pelo front foi descontinuado. Este defeito transforma esse 404 na perda das 8 chaves de uma vez. Corrija junto com A-1/A-2 do módulo 0.

**Erro 404 de modelo remove permanentemente todas as chaves validas do rodizio**

**Onde:** `src/services/geminiService.js:151`

**O defeito:** O tratamento agrupa 401, 403 e 404 como 'chave invalida' e faz GEMINI_KEYS.splice(currentKeyIndex, 1), mutando o array de modulo. Mas 404 no endpoint generativelanguage significa 'modelo nao encontrado', nao 'chave invalida'. Como o loop faz 'continue' sem incrementar attempts, ele repete o splice ate esvaziar o array. E isGeminiConfigured (linha 27) e um const calculado no load do modulo e continua true, entao todas as funcoes seguem entrando no try e falhando com 'Nenhuma chave de API do Gemini valida disponivel.'

**Como falha:** O Google descontinua 'gemini-1.5-flash' (ou o embedding 'gemini-embedding-001' nao esta habilitado no projeto) e passa a responder 404. Na primeira mensagem do chat, as 20 chaves validas sao removidas do pool em sequencia. A partir desse momento, e pelo resto da sessao do navegador, TODA a IA do app (triagem de ferida, chat, protocolos, SOAP, copiloto, triagem por voz) retorna null e cai nos textos simulados, sem nenhuma mensagem ao usuario. So um F5 restaura o pool.

**Código atual:**

```jsx
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        console.error(`[Gemini API] Key index ${currentKeyIndex} is invalid/unauthorized...`);
        GEMINI_KEYS.splice(currentKeyIndex, 1);
```

**Correção sugerida:** Remover 404 da lista de 'chave inválida' (tratar como erro de modelo, abortando o rodízio) e incrementar `attempts` antes do `continue`.

<details><summary>Verificação feita contra o código</summary>

Linhas 151-157: 401, 403 e 404 são tratados juntos como chave inválida, com `GEMINI_KEYS.splice(currentKeyIndex, 1)` mutando o array de módulo, e `continue` SEM `attempts++` — confirmado que o incremento só existe nos ramos 429 (linha 164) e catch (linha 179). Logo o laço repete o splice até `GEMINI_KEYS.length === 0` e então lança na linha 129. Como 404 em generativelanguage significa modelo inexistente (afeta todas as chaves igualmente), um único 404 esvazia o pool. E `isGeminiConfigured` (linha 27) é const avaliado no load do módulo, permanecendo true, então todas as funções continuam entrando no try e retornando null até um reload.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0172 · ALTO · `CONFIRMADO`

**Prompt de triagem corrompido: campo de Alergias foi fundido com o cabeçalho e ha bloco JSON duplicado**

**Onde:** `src/services/geminiService.js:244`

**O defeito:** A linha 244 deveria ser '- Alergias Conhecidas: ${profile.allergies}' seguida de linha em branco e do titulo 'DIRETRIZES GERAIS...'. O texto foi colado errado e virou '- Alergias CDIRETRIZES GERAIS DE TRIAGEM E RECOMENDACAO:'. Resultado: as alergias do paciente NUNCA sao enviadas ao modelo na chamada direta ao Gemini. Alem disso as linhas 278-280 contem restos de um bloco anterior ('}endacao clinica detalhada...' e uma segunda chave de fechamento), corrompendo o esquema JSON de exemplo apresentado ao modelo.

**Como falha:** Paciente com 'Dipirona, Sulfadiazina de Prata' no campo allergies faz uma triagem de ferida em ClinicalTriage sem Supabase configurado (caminho cliente direto). O prompt informa comorbidades mas omite as alergias, e o modelo pode recomendar Sulfadiazina de Prata em aiRecommendation/treatmentPlan. O texto e salvo no prontuario em ClinicalTriage.jsx:502 e exibido ao paciente como conduta.

**Código atual:**

```jsx
- Alergias CDIRETRIZES GERAIS DE TRIAGEM E RECOMENDAÇÃO:
0. VALIDAÇÃO RIGOROSA DA IMAGEM: ...
...
}endação clínica detalhada e indicação de condutas de enfermagem ou suporte médico baseado nos sintomas informados.",
```

**Correção sugerida:** Restaurar `- Alergias Conhecidas: ${profile.allergies || 'Nenhuma'}` seguido do cabeçalho de diretrizes e apagar o bloco residual das linhas 278-280.

<details><summary>Verificação feita contra o código</summary>

A linha 244 é literalmente `- Alergias CDIRETRIZES GERAIS DE TRIAGEM E RECOMENDAÇÃO:` — o campo `profile.allergies` não é interpolado em lugar nenhum do systemPrompt de analyzeWoundWithAI (comparar com a Edge Function, index.ts:42, que envia '- Alergias Conhecidas' corretamente, e com formatSOAPNote linha 742). As alergias realmente nunca chegam ao modelo no caminho cliente-direto. Confirmei também a corrupção do esquema: o objeto JSON de exemplo fecha na linha 277-278 com `}` e imediatamente vem o fragmento `}endação clínica detalhada ... "clinicalEvolution": "Estável" ... }` (linhas 278-280), ou seja há texto solto e uma segunda chave de fechamento após o JSON de exemplo, degradando a instrução de formato.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0173 · ALTO · `CONFIRMADO`

**Resposta bloqueada pelo filtro de seguranca do Gemini derruba o chat para respostas prontas sem avisar**

**Onde:** `src/services/geminiService.js:441`

**O defeito:** Ao contrario de analyzeWoundWithAI (que valida result.candidates e result.promptFeedback?.blockReason nas linhas 295-298), chatWithAI acessa 'result.candidates[0].content.parts[0].text' direto. Quando o Gemini bloqueia o prompt (safety filter) ou devolve MAX_TOKENS sem parts, 'candidates' e undefined e o TypeError e engolido pelo catch da linha 501, que retorna null. O componente interpreta null como 'Gemini nao configurado' e responde com o banco estatico AI_RESPONSES.

**Como falha:** Paciente descreve automutilacao ou um quadro que aciona o filtro de seguranca do Google. A IA real e descartada silenciosamente e o paciente recebe a resposta generica da linha 947 ('Entendi a sua duvida sobre ...: 1. Para sintomas leves, repouse e hidrate-se'), rotulada como '[Orientacoes iRec] Resposta de assistencia clinica'. Nem o paciente nem o log sabem que a IA foi bloqueada.

**Código atual:**

```jsx
    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;
    const resultObj = JSON.parse(jsonText.trim());
```

**Correção sugerida:** Aplicar em chatWithAI a mesma validação de candidates/promptFeedback.blockReason usada nas linhas 295-298 e propagar um erro distinguível ao chamador.

<details><summary>Verificação feita contra o código</summary>

Confirmei o contraste: analyzeWoundWithAI valida `!result.candidates || result.candidates.length === 0 || result.promptFeedback?.blockReason` (linhas 295-298), mas chatWithAI faz `result.candidates[0].content.parts[0].text` direto na linha 441, sem nenhuma guarda nem optional chaining. Em bloqueio por safety filter ou finishReason MAX_TOKENS sem `parts`, é TypeError, engolido pelo catch da linha 501 que retorna null — indistinguível, para o chamador, do caso 'Gemini não configurado' (linha 311 também retorna null), levando ao banco estático de respostas.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0174 · ALTO · `CONFIRMADO`

**Guardrail clinico de seguranca falha em aberto e entrega a resposta nao validada**

**Onde:** `src/services/geminiService.js:496`

**O defeito:** O bloco 'GUARDRAIL CLINICO DE VALIDACAO DE SEGURANCA (DUAS VIAS)' inteiro esta dentro de um try cujo catch apenas faz console.error e segue. Qualquer falha na segunda chamada (429 em todas as chaves, JSON malformado, candidates ausente na linha 486) faz o resultado ORIGINAL, nao verificado, ser retornado como se tivesse passado pela revisao de seguranca.

**Como falha:** Paciente com 'alergia a Dipirona' no prontuario pergunta sobre dor de cabeca. A primeira chamada devolve uma resposta recomendando Dipirona. A segunda chamada (validacao) recebe 429 porque a primeira ja consumiu a cota do minuto; o catch registra no console e a resposta insegura recomendando Dipirona e transmitida ao paciente alergico, sem nenhum alerta em triageAlerts.

**Código atual:**

```jsx
    } catch (vErr) {
      console.error("Erro no guardrail de validação silenciosa:", vErr);
    }

    return resultObj;
```

**Correção sugerida:** No catch do guardrail, degradar com segurança: substituir a reply por orientação genérica de procurar profissional em vez de retornar a resposta não validada.

<details><summary>Verificação feita contra o código</summary>

O bloco do guardrail começa no try da linha 445 e vai até o catch da linha 496, que apenas faz console.error; a linha 500 então retorna `resultObj` — o objeto ORIGINAL, com `reply` não revisado. Qualquer falha da segunda chamada (429 em todas as chaves via fetchGeminiWithRotation, JSON malformado no JSON.parse da linha 487, ou `validationData.candidates` ausente na linha 486, que também não tem guarda) resulta em fail-open silencioso. O cenário de 429 é especialmente provável porque a validação dispara imediatamente após a primeira chamada, na mesma janela de minuto.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0175 · ALTO · `CONFIRMADO`

**analyzeTelemedicineTranscript devolve laudo clinico FALSO fixo quando o Gemini nao esta configurado**

**Onde:** `src/services/geminiService.js:775`

**O defeito:** Quando isGeminiConfigured e false a funcao nao retorna null (como as outras funcoes fazem para sinalizar fallback): ela retorna um objeto com sintomas, prescricoes e evolucao clinica inventados ('Paciente relata dor controlada e melhora gradual', 'Soro Fisiologico 0.9%', 'Hidrogel Amorfo', riskLevel 'Risco Moderado'). O chamador nao tem como distinguir isso de uma analise real.

**Como falha:** Medico encerra uma consulta de telemedicina (Telemedicine.jsx:1056) com o Gemini fora do ar/nao configurado. O modal de sintese exibe sintomas e prescricoes que NUNCA foram ditos na consulta. Ao clicar em salvar (saveClinicalSummary, Telemedicine.jsx:1093-1123), 'Soro Fisiologico 0.9% (Limpeza diaria)' e 'Hidrogel Amorfo' sao concatenados no campo medications do paciente no banco e a evolucao inventada e enviada como mensagem oficial de prontuario ao paciente.

**Código atual:**

```jsx
  if (!isGeminiConfigured) {
    return {
      executiveSummary: "Consulta por telemedicina realizada com sucesso. Paciente relata dor controlada e melhora gradual, mas com secreção leve...",
      suggestedPrescriptions: [
        { name: "Soro Fisiológico 0.9%", dosage: "Limpeza diária", category: "Insumo" },
```

**Correção sugerida:** Retornar null (ou um objeto com flag `isSimulated: true` tratada pela UI) em vez do laudo fictício.

<details><summary>Verificação feita contra o código</summary>

Trecho lido nas linhas 774-788: com isGeminiConfigured falso a função retorna um objeto completo com executiveSummary ('Paciente relata dor controlada e melhora gradual...'), symptoms Dor/Secreção, suggestedPrescriptions 'Soro Fisiológico 0.9%' e 'Hidrogel Amorfo', clinicalEvolution e riskLevel 'Risco Moderado' — todos hardcoded. Todas as demais funções do arquivo retornam null nesse mesmo cenário (linhas 216, 311, 510, 624, 712, 944), então o chamador não tem como distinguir simulação de análise real. Dado clínico inventado apresentado como resultado de IA e passível de ser gravado no prontuário é defeito mesmo sendo intencional. Alcançabilidade condicionada a deploy sem chaves (hoje o .env local tem chaves), o que reduz o alcance mas não descaracteriza o defeito.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0198 · ALTO · `CONFIRMADO`

**Edge Function com CORS aberto e sem checagem de autorizacao ou limite de uso**

**Onde:** `supabase/functions/gemini-analysis/index.ts:3`

**O defeito:** Access-Control-Allow-Origin: '*' e a funcao nao inspeciona o Authorization header, nao identifica o usuario, nao verifica papel e nao limita frequencia. Nao existe supabase/config.toml no repositorio (apenas supabase/functions), logo nao ha configuracao explicita de verificacao; e a anon key do projeto e publica (VITE_SUPABASE_ANON_KEY, embutida no bundle por src/supabaseClient.js), servindo como JWT valido.

**Como falha:** Terceiro extrai a URL do projeto e a anon key do bundle publicado e passa a fazer POST em /functions/v1/gemini-analysis de qualquer origem, com clinicalProfile e symptomsText arbitrarios, consumindo a GEMINI_API_KEY do backend do Supabase ate estourar a cota. A triagem por imagem de todos os pacientes reais para de funcionar e a fatura fica com o projeto.

**Código atual:**

```jsx
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

**Correção sugerida:** Validar o JWT do usuário (supabase.auth.getUser com o header Authorization), restringir a origem e aplicar rate limit por usuário.

<details><summary>Verificação feita contra o código</summary>

Linhas 3-6: Access-Control-Allow-Origin '*'. Li a função inteira (1-121): o header Authorization nunca é lido, não há identificação de usuário, verificação de papel, validação de tamanho do filePart nem rate limit; a única checagem é a existência de GEMINI_API_KEY. A anon key do Supabase é pública por natureza (vai no bundle via VITE_SUPABASE_ANON_KEY) e serve como JWT válido, então mesmo com verify_jwt padrão qualquer terceiro pode invocar em loop e consumir a GEMINI_API_KEY do backend.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0199 · ALTO · `CONFIRMADO`

**Guarda de imagem invalida (isValidWound) nao existe no caminho da Edge Function**

**Onde:** `supabase/functions/gemini-analysis/index.ts:51`

**O defeito:** O prompt e o esquema JSON da Edge Function nao contem os campos 'isValidWound' nem 'invalidReason' - eles existem apenas no prompt do cliente (geminiService.js:245 e 252). Como analyzeWoundWithAI tenta a Edge Function primeiro e retorna 'data' assim que ela responde (geminiService.js:205-209), o consumidor ClinicalTriage.jsx:461 avalia 'finalResult.isValidWound === false' contra undefined, que e falso, e a validacao e silenciosamente burlada em producao (Supabase configurado).

**Como falha:** Paciente, por engano, tira um print da tela do celular (ou fotografa um documento) e envia na triagem. Com Supabase ativo, a Edge Function responde sem isValidWound; o alerta 'A imagem enviada nao e uma foto de ferida' nunca aparece e o registro e gravado no prontuario com tipo/estagio/analise tecidual inventados pelo modelo a partir de um print, mais o alerta clinico correspondente.

**Código atual:**

```jsx
Sua tarefa é retornar ESTRITAMENTE um objeto JSON puro, correspondente a este formato exato:
{
  "type": "Tipo da Queixa ou Especialidade Principal ...",
  "lesionStage": ...,
  "severity": ...,
  "isRedirect": false,
```

**Correção sugerida:** Adicionar a diretriz de validação de imagem e os campos isValidWound/invalidReason ao prompt e ao esquema JSON da Edge Function.

<details><summary>Verificação feita contra o código</summary>

Li o prompt completo da Edge Function (linhas 26-78): não há diretriz de validação de imagem nem os campos isValidWound/invalidReason no esquema JSON (linhas 51-76). Grep em src confirma que 'isValidWound' só aparece em geminiService.js:245/252/253 (prompt cliente) e no consumidor ClinicalTriage.jsx:461 (`finalResult.isValidWound === false`). Como analyzeWoundWithAI retorna `data` da Edge Function imediatamente (linha 209) quando Supabase está ativo, o campo chega undefined, `undefined === false` é falso e a guarda é burlada em produção.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0200 · ALTO · `CONFIRMADO`

**Edge Function acessa result.candidates[0] sem validar bloqueio ou resposta vazia**

**Onde:** `supabase/functions/gemini-analysis/index.ts:109`

**O defeito:** Nao ha checagem de result.candidates, promptFeedback.blockReason ou content.parts. Quando o Gemini bloqueia o conteudo (comum em fotos de feridas expostas, que acionam filtros de conteudo grafico) a resposta tem apenas promptFeedback, e a linha 109 lanca TypeError. O catch da linha 115 devolve 500 com {error: 'Cannot read properties of undefined...'}.

**Como falha:** Paciente envia foto de uma ulcera extensa. O Gemini bloqueia por politica de conteudo; a Edge Function retorna 500; supabase.functions.invoke preenche 'error'; geminiService.js:208 lanca; o catch da linha 210 registra um warn e cai na chamada direta pelo cliente, que tambem sera bloqueada; analyzeWoundWithAI retorna null e ClinicalTriage grava a analise local simulada (generateLocalFallbackAnalysis) no prontuario como se fosse resultado de IA.

**Código atual:**

```jsx
    const result = await response.json();
    const jsonText = result.candidates[0].content.parts[0].text;
```

**Correção sugerida:** Validar `result.candidates?.[0]?.content?.parts?.[0]?.text` e `result.promptFeedback?.blockReason` antes de acessar, retornando erro estruturado.

<details><summary>Verificação feita contra o código</summary>

Linhas 104-119: há apenas o teste `!response.ok`; logo em seguida a linha 109 faz `result.candidates[0].content.parts[0].text` sem checar candidates, promptFeedback.blockReason nem content.parts. Bloqueio por política do Gemini retorna HTTP 200 com apenas promptFeedback, então o !response.ok não protege e a linha 109 lança TypeError, caindo no catch da linha 115 que devolve 500 com a mensagem crua. Em geminiService.js:208 o `throw error` leva ao catch da linha 210, que só faz console.warn e segue para a chamada cliente direta. A frequência do bloqueio em fotos de feridas é suposição do auditor, mas o defeito de código é objetivo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0223 · MÉDIO · `CONFIRMADO`

**Feature 'Leitor de Exames' prometida ao paciente nunca e executada no fallback**

**Onde:** `src/components/AIChatAssistant.jsx:49`

**O defeito:** O objeto EXAM_RESPONSES (interpretacoes de hemograma, doppler e glicose) e declarado e nunca referenciado em nenhum ponto do arquivo; o import de uploadExamFileAndTriage (linha 2) tambem nunca e chamado. Ainda assim a mensagem de boas-vindas (linha 132) e a resposta de AI_RESPONSES (linha 109) prometem explicitamente que anexar o exame gera 'uma explicacao clara dos termos medicos' e que os exames ficam anexados ao prontuario.

**Como falha:** Sem Gemini configurado (modo simulado), o paciente segue a instrucao da mensagem de boas-vindas, anexa a foto do hemograma e envia. O unico retorno e o texto fixo da linha 877: 'Recebi seu arquivo X... aguarde a validacao do seu medico responsavel no prontuario'. Nenhuma interpretacao e mostrada, o exame nao e enviado a uploadExamFileAndTriage e nao aparece em attachedExams do prontuario, ao contrario do que o app anunciou.

**Código atual:**

```jsx
import { uploadExamFileAndTriage, updateClinicalProfile, createAuditLog } from '../services/supabaseService';
...
const EXAM_RESPONSES = {
  'hemograma': `📄 **Leitor de Exames iRec - Interpretação Simplificada**
```

**Correção sugerida:** Chamar uploadExamFileAndTriage no envio com anexo (e usar EXAM_RESPONSES ou remove-lo) para que a promessa da mensagem de boas-vindas se cumpra.

<details><summary>Verificação feita contra o código</summary>

Grep no arquivo inteiro devolve uma unica ocorrencia de EXAM_RESPONSES (a declaracao, linha 49) e uma unica de uploadExamFileAndTriage (o import, linha 2): nem o dicionario de laudos nem a funcao de upload/triagem sao chamados em lugar algum. Enquanto isso o texto de boas-vindas (linha 132) e AI_RESPONSES (linhas 107-114) prometem explicitamente traducao de exames, e o unico retorno com arquivo no fallback e o texto fixo da linha 877. Consequencia adicional confirmada: como uploadExamFileAndTriage nunca roda, o anexo nao entra em attachedExams do prontuario em nenhum dos modos, contrariando tanto a mensagem de boas-vindas quanto a nota de exames anexados da linha 137.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0224 · MÉDIO · `CONFIRMADO`

**DEFAULT_WELCOME acessa clinicalProfile.attachedExams sem protecao de null**

**Onde:** `src/components/AIChatAssistant.jsx:135`

**O defeito:** Todo o resto do componente trata clinicalProfile como possivelmente ausente (linha 142 'clinicalProfile?.id', linha 161 'clinicalProfile?.name'), mas DEFAULT_WELCOME acessa 'clinicalProfile.attachedExams' direto. A funcao e chamada no inicializador do useState (linha 161), no useEffect (266), em handleNewThread (449) e em handleDeleteThread (476).

**Como falha:** Depois de qualquer caminho que zere o perfil (ver o bug de setClinicalProfile(null) na linha 613), o paciente clica em 'Nova Conversa'. handleNewThread chama DEFAULT_WELCOME e lanca 'TypeError: Cannot read properties of null (reading attachedExams)'; o clique nao cria conversa nenhuma e o erro sobe para o boundary/Sentry, deixando a tela do chat em branco.

**Código atual:**

```jsx
    if (clinicalProfile.attachedExams && clinicalProfile.attachedExams.length > 0) {
      const examNames = clinicalProfile.attachedExams.map(e => e.name).join(', ');
```

**Correção sugerida:** Usar 'const exams = clinicalProfile?.attachedExams || [];' e testar exams.length em vez de acessar a prop diretamente.

<details><summary>Verificação feita contra o código</summary>

Linha 135 acessa 'clinicalProfile.attachedExams' sem optional chaining, enquanto todo o entorno assume que a prop pode faltar (linha 142 clinicalProfile?.id, linhas 161/266/449/476 clinicalProfile?.name - e justamente essas quatro chamadas passam por DEFAULT_WELCOME). A assimetria e real e o crash ocorre com clinicalProfile null/undefined. Reduzo a severidade para medio porque o App.jsx sempre inicializa o estado com um objeto (linha 426); o unico caminho conhecido para null e o item 104, ou seja, e uma falha encadeada, nao independente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0225 · MÉDIO · `CONFIRMADO`

**Migracao 'legacy' copia o historico global de conversas para dentro do usuario logado**

**Onde:** `src/components/AIChatAssistant.jsx:184`

**O defeito:** Se o usuario atual nao tem chave propria, o codigo copia incondicionalmente 'irec_chat_threads' (chave global, sem sufixo de usuario) para 'irec_chat_threads_<id-do-usuario-atual>'. Nao ha nenhuma verificacao de a quem aquele historico pertencia, e a copia e persistida (setItem), tornando-a permanente.

**Como falha:** Num dispositivo que ja rodou a versao anterior do app (que usava a chave global), o Paciente A deixou conversas em 'irec_chat_threads'. O Paciente B faz o primeiro login nesse mesmo aparelho e abre o chat: como ele nao tem 'irec_chat_threads_<idB>', todo o historico clinico do Paciente A e copiado e gravado como historico do Paciente B, incluindo relatos de sintomas e nomes de exames.

**Código atual:**

```jsx
    if (!savedThreads && userId !== 'guest') {
      const legacyThreads = localStorage.getItem('irec_chat_threads');
...
      if (legacyThreads) {
        localStorage.setItem(threadKey, legacyThreads);
```

**Correção sugerida:** Remover a migracao ou condiciona-la a um marcador de dono (ex.: irec_chat_threads_owner === userId), apagando a chave global apos migrar.

<details><summary>Verificação feita contra o código</summary>

Linhas 184-195 confirmadas: basta nao existir irec_chat_threads_<id> para o codigo ler a chave global irec_chat_threads e grava-la (setItem, linha 188) sob o id do usuario atual, sem nenhuma verificacao de propriedade - a copia e permanente e o thread migrado passa pelo auto-reparo e e re-salvo na linha 244. A unica atenuante e que nenhum codigo atual escreve na chave global, entao o dado tem de vir de uma versao anterior instalada no mesmo aparelho; por isso mantenho o defeito, mas com severidade medio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0226 · MÉDIO · `CONFIRMADO`

**Playback de TTS antigo pode ressuscitar e tocar sobreposto ao novo**

**Onde:** `src/components/AIChatAssistant.jsx:379`

**O defeito:** audio.play() retorna Promise e o .catch chama playTTSQueue(remainingChunks) da fila ANTIGA. Quando o usuario troca de mensagem, speakMessage seta ttsStoppedRef=true, pausa, e depois seta ttsStoppedRef=false para a nova fila. Se a Promise da fila anterior rejeitar apos essa reativacao, a guarda 'if (ttsStoppedRef.current...)' ja voltou a false e a fila antiga retoma, sobrescrevendo activeAudioRef.current.

**Como falha:** Paciente com baixa visao clica em 🔊 na resposta A, o audio ainda esta carregando, e clica em 🔊 na resposta B. A Promise de play() de A rejeita (interrompida) e reinicia a fila de A; duas vozes tocam sobrepostas. Como activeAudioRef aponta para o chunk de A, o botao ⏹️ de B nao para nada e o paciente nao consegue interromper a leitura.

**Código atual:**

```jsx
    audio.play().catch((err) => {
      console.warn('[iRec TTS] Erro ao reproduzir:', err);
      playTTSQueue(remainingChunks);
    });
```

**Correção sugerida:** Capturar um token/id de sessao de fala no inicio de speakMessage e abortar em playTTSQueue quando o token da fila nao for mais o atual.

<details><summary>Verificação feita contra o código</summary>

A corrida existe como descrita: o unico portao e o teste 'if (ttsStoppedRef.current || chunks.length === 0)' no topo de playTTSQueue (linha 358), e speakMessage seta ttsStoppedRef = true (398), pausa o audio e depois reabre com ttsStoppedRef = false (415) para a nova fila. O .catch do play() da fila antiga (linhas 379-382) - que rejeita justamente quando o audio e interrompido por pause() - chama playTTSQueue(remainingChunks) da fila ANTIGA e, se rejeitar apos a reabertura, passa pelo portao e sobrescreve activeAudioRef.current (368), deixando o botao de parar da mensagem nova sem efeito. Cenario alcancavel com dois cliques rapidos em mensagens diferentes.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0227 · MÉDIO · `CONFIRMADO`

**Auto-scroll suave disparado a cada 8 ms durante o streaming trava a rolagem**

**Onde:** `src/components/AIChatAssistant.jsx:493`

**O defeito:** O useEffect depende de 'messages', que e uma nova referencia de array a cada tique de 8 ms do setInterval de streaming. Ele chama scrollIntoView({behavior:'smooth'}) centenas de vezes por segundo, empilhando animacoes de rolagem concorrentes.

**Como falha:** Paciente recebe uma resposta longa (laudo/protocolo) e tenta rolar para cima para reler a orientacao anterior enquanto o texto e digitado. A cada 8 ms a view e forcada de volta ao fim: no celular a area de mensagens fica efetivamente travada por todo o tempo do streaming (dezenas de segundos), impossibilitando a leitura.

**Código atual:**

```jsx
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);
```

**Correção sugerida:** Depender de messages.length (nao do array) e so auto-rolar quando o usuario ja estiver proximo do fim da lista.

<details><summary>Verificação feita contra o código</summary>

O useEffect das linhas 493-495 depende de 'messages', que e activeThread.messages (linha 425) - um array novo a cada tique do setInterval de 8 ms, porque o updater recria t.messages via .map (linha 523). Portanto scrollIntoView com behavior smooth e chamado ~125 vezes por segundo durante todo o streaming, empilhando animacoes concorrentes e impedindo o usuario de rolar para cima enquanto a resposta longa e digitada. Nao ha throttle, flag de 'usuario rolou' nem guarda alguma.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0228 · MÉDIO · `CONFIRMADO`

**streamResponse e handleSendMessage operam sobre um snapshot antigo de 'threads'**

**Onde:** `src/components/AIChatAssistant.jsx:513`

**O defeito:** streamResponse e chamada depois de varios await (chatWithAI, applyProfileUpdates) mas usa a variavel 'threads' capturada no render em que o handler foi criado, com threads.map/threads.find em vez de forma funcional de setState. O mesmo ocorre nas linhas 860-862 (que precisam re-anexar userMsg manualmente porque leem o array pre-save) e em 673.

**Como falha:** Paciente envia uma pergunta longa; enquanto espera a resposta (varios segundos de chamada ao Gemini mais o guardrail), clica em 'Nova Conversa' e escreve outra mensagem. Quando a primeira resposta chega, streamResponse faz saveThreads sobre o snapshot antigo: a conversa criada no meio do caminho, com a mensagem digitada, desaparece do estado e do localStorage.

**Código atual:**

```jsx
    const msgsBase = existingMessages || (threads.find(t => t.id === threadId) || threads[0]).messages;
...
    const threadsWithPlaceholder = threads.map(t => 
      t.id === threadId ? { ...t, messages: initialThreadMsg } : t
    );
```

**Correção sugerida:** Reescrever o placeholder e o save com setThreads(prev => ...) e persistir o localStorage dentro do updater, eliminando o uso da variavel threads da closure.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas tres ocorrencias citadas: streamResponse le threads.find (505) e threads.map (513) da closure e persiste esse array via saveThreads (516), sendo chamada apos os awaits de chatWithAI e applyProfileUpdates (linhas 846-865); as linhas 860-862 usam threads.find e ainda precisam re-anexar userMsg manualmente, evidencia de que o array lido e anterior ao save; e a linha 673 repete o padrao. Como saveThreads faz setThreads(arrayCompleto) e localStorage.setItem, uma thread criada durante a espera some do estado e do disco. Curiosamente o proprio ramo final ja usa a forma funcional (linhas 521 e 534), o que confirma que a forma nao funcional e o erro.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0229 · MÉDIO · `CONFIRMADO`

**Intervalo de streaming sem cleanup no unmount continua escrevendo no localStorage**

**Onde:** `src/components/AIChatAssistant.jsx:518`

**O defeito:** O setInterval criado em streamResponse nao e guardado em ref nem limpo em nenhum useEffect de cleanup. O unico cleanup do componente (linhas 312-320) trata apenas o audio de TTS. O intervalo chama setThreads e, ao terminar, localStorage.setItem, mesmo apos o componente ser desmontado.

**Como falha:** Paciente envia uma pergunta longa e, enquanto a resposta e digitada letra por letra (8 ms por caractere, ~16 s para 2000 caracteres), clica em 'Painel' na navegacao. O AIChatAssistant e desmontado mas o intervalo continua; ao terminar, ele grava em irec_chat_threads_<id> um snapshot antigo dos threads (capturado por closure). Se o paciente voltar ao chat antes disso, o novo mount le o localStorage e depois e sobrescrito pelo snapshot do mount anterior, perdendo mensagens enviadas nesse intervalo.

**Código atual:**

```jsx
    const interval = setInterval(() => {
...
          localStorage.setItem(`irec_chat_threads_${userId}`, JSON.stringify(finalThreads));
          return finalThreads;
```

**Correção sugerida:** Guardar o id em um streamIntervalRef e limpa-lo no cleanup do useEffect de unmount (clearInterval + flag para abortar o setItem final).

<details><summary>Verificação feita contra o código</summary>

O interval da linha 518 fica em variavel local, nao e guardado em ref e nao aparece em nenhum cleanup; o unico useEffect de desmontagem (linhas 312-320) trata somente ttsStoppedRef e activeAudioRef. Ao terminar, o ramo else executa localStorage.setItem na linha 556 com o resultado do setThreads da instancia ja desmontada, que carrega o estado congelado daquele mount. Uma remontagem posterior le a chave e pode ter suas mensagens novas sobrescritas por esse snapshot. Severidade medio: exige trocar de aba no meio de um streaming longo e voltar rapido.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0230 · MÉDIO · `CONFIRMADO`

**Editar/Reprocessar mensagem nao respeita a trava isSubmittingRef e permite streams concorrentes**

**Onde:** `src/components/AIChatAssistant.jsx:713`

**O defeito:** handleSendMessage protege contra envio duplo com 'if ((!hasText && !hasFile) || isSubmittingRef.current) return;' (linha 788), mas handleReprocessMessage e handleSaveEditMessage chamam handleSendMessageFromEditedHistory sem checar nem setar isSubmittingRef. Nada impede duas execucoes simultaneas, e cada uma cria seu proprio setInterval de streaming no mesmo thread.

**Como falha:** Paciente clica em '🔄 Reprocessar' duas vezes (comportamento comum quando a resposta demora). Duas chamadas ao Gemini partem; dois setInterval passam a escrever textos diferentes no mesmo thread. Cada um cria seu proprio placeholder, os intervalos se sobrepoem e o thread termina com duas respostas parcialmente escritas; o segundo clearInterval nunca desliga o primeiro intervalo.

**Código atual:**

```jsx
  const handleReprocessMessage = async (msgId) => {
    const currentActiveThread = threads.find(t => t.id === activeThreadId) || threads[0];
...
    setIsTyping(true);
    await handleSendMessageFromEditedHistory(targetMsgText, updatedMessages);
```

**Correção sugerida:** Checar e setar isSubmittingRef.current no inicio de handleReprocessMessage e handleSaveEditMessage, liberando em finally.

<details><summary>Verificação feita contra o código</summary>

handleSendMessage tem a trava na linha 788 ('|| isSubmittingRef.current'), mas handleReprocessMessage (713-728) e handleSaveEditMessage (689-711) nao leem nem setam isSubmittingRef antes de chamar handleSendMessageFromEditedHistory (625-679), que tampouco a seta - so a zera no final do fallback (linha 677). Nada impede dois cliques em Reprocessar dispararem duas chamadas ao Gemini e dois setInterval no mesmo thread, cada um com seu placeholder e seu clearInterval independente. O botao tambem nao e desabilitado por isTyping nesse fluxo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0231 · MÉDIO · `CONFIRMADO`

**Autocorrecao troca a preposicao 'com' por 'Como', corrompendo o relato do paciente**

**Onde:** `src/components/AIChatAssistant.jsx:747`

**O defeito:** O dicionario de correcoes inclui a entrada 'com': 'Como'. Como a correcao e aplicada por palavra inteira normalizada (linha 755), qualquer ocorrencia da preposicao mais comum do portugues e substituida. As entradas 'decente':'decente', 'copiloto':'copiloto' e 'trato':'trato' tambem sao no-ops que ainda assim incrementam correctedCount, disparando a atualizacao do input.

**Como falha:** Paciente digita 'minha ferida esta com pus e com cheiro forte' e clica no botao ✨ de correcao ortografica. O texto do input passa a ser 'minha ferida esta Como pus e Como cheiro forte' e e enviado assim para a IA e gravado no historico da conversa, distorcendo o relato clinico.

**Código atual:**

```jsx
      'pe': 'pé',
      'pomadas': 'pomada',
      'copiloto': 'copiloto',
      'com': 'Como',
      'trato': 'trato'
```

**Correção sugerida:** Remover a entrada 'com' (e as no-ops 'decente'/'copiloto'/'trato') do dicionario typoCorrections.

<details><summary>Verificação feita contra o código</summary>

A entrada 'com': 'Como' existe na linha 747 e a substituicao e por palavra inteira: o texto e dividido em tokens (linha 751), normalizado para minusculas sem pontuacao (755) e trocado integralmente pelo valor do dicionario (757-762). Toda ocorrencia da preposicao 'com' - a mais frequente do portugues - vira 'Como' no meio da frase, e o texto corrompido vai para a IA e para o historico. Confirmei tambem que 'decente', 'copiloto' e 'trato' mapeiam para si mesmos e ainda assim incrementam correctedCount, disparando setInputText a toa.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0232 · MÉDIO · `CONFIRMADO`

**IDs de mensagem gerados com Date.now() e Date.now()+1 podem colidir**

**Onde:** `src/components/AIChatAssistant.jsx:855`

**O defeito:** A mensagem de sincronizacao do prontuario usa 'Date.now() + 1' e, na sequencia imediata, streamResponse gera o placeholder da resposta com 'Date.now()' (linha 504). Se o relogio avancar 1 ms entre as duas linhas os IDs ficam iguais. O update do streaming usa 'msg.id === newMessageId' (linha 524) e atinge a primeira mensagem com aquele id.

**Como falha:** Paciente escreve 'sou diabetico e fumo'. applyProfileUpdates atualiza a ficha, a mensagem '[iRec Prontuario] Ficha clinica atualizada...' recebe id T+1 e, no mesmo tique, o placeholder da resposta recebe id T+1. Durante o streaming, o texto da resposta e escrito SOBRE a mensagem de confirmacao da ficha clinica: o paciente perde o aviso de que Diabetes e Tabagismo foram gravados e o React acusa keys duplicadas na lista.

**Código atual:**

```jsx
        const syncMsg = {
          id: Date.now() + 1,
...
    const newMessageId = Date.now();
```

**Correção sugerida:** Gerar ids com um helper unico (ex.: `${Date.now()}-${Math.random().toString(36).slice(2)}`) para syncMsg, userMsg e placeholder.

<details><summary>Verificação feita contra o código</summary>

Confirmado: o syncMsg recebe id Date.now()+1 (linha 854) e, em seguida, na mesma sequencia sincrona, streamResponse gera newMessageId = Date.now() (linha 504); entre as duas ha apenas a montagem de arrays e um saveThreads com JSON.stringify + localStorage.setItem, operacao que rotineiramente consome ~1 ms - basta o relogio avancar exatamente 1 ms para os ids coincidirem. Pior que o descrito: o updater da linha 523 usa .map, entao TODAS as mensagens com aquele id recebem o texto em streaming, sobrescrevendo a confirmacao de atualizacao da ficha clinica e gerando keys duplicadas no React.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0233 · MÉDIO · `CONFIRMADO`

**Nome do arquivo anexado com cor branca fixa fica invisivel no tema claro**

**Onde:** `src/components/AIChatAssistant.jsx:1312`

**O defeito:** O popover de previa do anexo usa backgroundColor 'var(--bg-secondary)' (que acompanha o tema) mas fixa color: '#ffffff' no nome do arquivo, ignorando as variaveis de tema usadas em todo o resto do componente (var(--text-primary)/var(--text-muted) na linha logo abaixo).

**Como falha:** Paciente usando o app no tema claro anexa um exame. O painel de confirmacao aparece com o tamanho em MB legivel, porem o nome do arquivo em branco sobre fundo claro fica ilegivel - o paciente nao consegue conferir se selecionou o arquivo correto antes de enviar dados clinicos.

**Código atual:**

```jsx
                <span style={{ fontSize: '12.5px', fontWeight: '750', color: '#ffffff' }}>
                  {selectedFile.name}
                </span>
```

**Correção sugerida:** Trocar color: '#ffffff' por color: 'var(--text-primary)' na linha 1312.

<details><summary>Verificação feita contra o código</summary>

Confirmado nos dois lados: o popover usa backgroundColor 'var(--bg-secondary)' (linha 1296) e o nome do arquivo fixa color '#ffffff' (linha 1312), enquanto o tamanho em MB logo abaixo usa var(--text-muted) (1315). Em src/index.css:13 o tema claro define --bg-secondary: #ffffff, ou seja, texto branco sobre fundo branco - contraste 1:1, nome do arquivo ilegivel exatamente na tela de conferencia antes do envio do exame.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0234 · MÉDIO · `VERIFICAR`

**Input aceita .doc/.docx/.txt que o modelo nao processa, e a falha e mascarada**

**Onde:** `src/components/AIChatAssistant.jsx:1369`

**O defeito:** O accept do input permite '.doc,.docx,.txt', e fileToGenerativePart (geminiService.js:105) envia o arquivo como inlineData com o mimeType original. O endpoint generativeLanguage rejeita mimeTypes de Word com 400; fetchGeminiWithRotation lanca, chatWithAI retorna null e o componente trata isso como 'Gemini nao configurado', caindo no texto estatico.

**Como falha:** Paciente anexa o laudo que recebeu em .docx e pergunta 'o que significa esse resultado?'. A chamada falha com 400, nenhuma mensagem de erro e exibida, e ele recebe a resposta pronta 'Recebi seu arquivo laudo.docx... aguarde a validacao do seu medico', acreditando que o documento foi analisado e enviado ao medico.

**Código atual:**

```jsx
            accept="image/*,application/pdf,.doc,.docx,.txt"
```

**Correção sugerida:** Restringir o accept a 'image/*,application/pdf,.txt' e exibir uma mensagem de erro explicita quando chatWithAI retornar null tendo havido anexo.

<details><summary>Verificação feita contra o código</summary>

Os elos internos estao confirmados: o accept da linha 1369 inclui .doc/.docx/.txt; fileToGenerativePart (geminiService.js:105-120) envia inlineData com o mimeType original, sem conversao; e o catch de chatWithAI (geminiService.js:501-504) devolve null diante de qualquer erro HTTP, o que o componente interpreta como 'Gemini nao configurado' e responde com o texto estatico da linha 877 dizendo que o medico validara o exame - nenhum aviso de erro chega ao paciente. O que nao consigo confirmar aqui e a resposta real da API para mimeTypes do Word (a rejeicao 400 e comportamento externo); note ainda que .txt (text/plain) e aceito pelo modelo, entao o problema cobre .doc/.docx, nao os tres.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0400 · MÉDIO · `CONFIRMADO`

**Rodizio de chaves em 429 pode manter o chat em 'digitando...' por dezenas de segundos**

**Onde:** `src/services/geminiService.js:160`

**O defeito:** A cada 429 o codigo espera 2000 ms fixos antes de tentar a chave seguinte, e maxRetries = GEMINI_KEYS.length (ate 20). Nao existe timeout global nem feedback ao usuario. Com N chaves saturadas, a espera minima e N*2 s antes de a funcao desistir e retornar null.

**Como falha:** Em horario de pico, com as 20 chaves no limite de requisicoes por minuto, o paciente envia uma pergunta: o indicador 'digitando...' fica ativo e o input desabilitado por cerca de 40 segundos (e o dobro quando o guardrail de validacao tambem tenta), ao fim dos quais ele recebe a resposta estatica generica de AI_RESPONSES em vez de uma resposta da IA.

**Código atual:**

```jsx
      if (response.status === 429) {
        console.warn(`[Gemini API] Key index ${currentKeyIndex} hit rate limit (429). Waiting 2 seconds and rotating key...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
```

**Correção sugerida:** Adicionar timeout global via AbortController e backoff curto com jitter, avisando a UI quando o rodízio começar.

<details><summary>Verificação feita contra o código</summary>

Linhas 160-165: espera fixa de 2000 ms a cada 429 antes de rotacionar, e a linha 124 confirma `maxRetries = GEMINI_KEYS.length`. Não há AbortController, timeout global nem callback de progresso em nenhum ponto de fetchGeminiWithRotation. Com o .env atual (8 chaves) a espera é ~16 s por chamada, e chatWithAI faz duas chamadas encadeadas (principal + guardrail da linha 475), dobrando o pior caso. Ajusto o alcance: o teto de 40 s citado pressupõe 20 chaves, não as 8 configuradas. Sem backoff exponencial nem jitter.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0401 · ALTO · `CONFIRMADO`

> **Severidade elevada de MÉDIO para ALTO.** Ver [`00-URGENTE-cota-e-modelo-gemini.md`](00-URGENTE-cota-e-modelo-gemini.md): o orçamento real é de 160 requisições/dia no total. Enviar a mensagem duas vezes consome metade disso. É a correção de maior retorno por linha alterada de todo o relatório.

**Mensagem do usuario e enviada duas vezes ao modelo em cada turno do chat**

**Onde:** `src/services/geminiService.js:428`

**O defeito:** AIChatAssistant chama chatWithAI(textToSend, updatedMessages, ...) onde updatedMessages JA contem a mensagem recem-digitada (AIChatAssistant.jsx:823 e 846). chatWithAI monta formattedHistory com os ultimos 6 itens desse array (incluindo a mensagem atual) e depois faz push de outra entrada role 'user' com o mesmo texto. O modelo recebe dois turnos 'user' consecutivos e identicos.

**Como falha:** Paciente escreve 'estou com febre de 39 graus ha dois dias'. O payload enviado contem esse texto duas vezes seguidas como turnos do usuario. O modelo trata como repeticao/insistencia e frequentemente responde reconhecendo duas queixas ou repetindo a orientacao; alem disso, com um anexo, o arquivo e associado a uma segunda copia da pergunta, desalinhando imagem e contexto.

**Código atual:**

```jsx
    const formattedHistory = chatHistory.slice(-6).map(msg => ({ ... }));
...
    formattedHistory.push({
      role: 'user',
      parts: userParts
    });
```

**Correção sugerida:** Usar `chatHistory.slice(0, -1).slice(-6)` (ou passar o histórico sem a mensagem atual) antes do push do turno corrente.

<details><summary>Verificação feita contra o código</summary>

Confirmei os dois lados: AIChatAssistant.jsx:823 monta `updatedMessages = [...currentActiveThread.messages, userMsg]` e a linha 846 chama `chatWithAI(textToSend, updatedMessages, clinicalProfile, fileObj)` — o histórico já inclui a mensagem recém-digitada (mesmo padrão na linha 628). Em geminiService.js:315 o histórico é mapeado com `slice(-6)` (incluindo essa mensagem) e na linha 428 há um push adicional de `{ role: 'user', parts: userParts }` com o mesmo texto (linha 411). O payload fica com dois turnos 'user' idênticos consecutivos; com anexo, o arquivo vai só na segunda cópia. A degradação exata da resposta é probabilística, mas a duplicação é determinística.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0402 · MÉDIO · `VERIFICAR`

**Guardrail substitui a resposta por safeAlternative sem verificar se ela existe**

**Onde:** `src/services/geminiService.js:491`

**O defeito:** Quando validationResult.isSafe === false, resultObj.reply e sobrescrito por validationResult.safeAlternative sem checar se o campo veio preenchido. Se o modelo revisor devolver isSafe:false com safeAlternative ausente ou string vazia, a resposta ao paciente vira undefined/'' e e propagada para streamResponse.

**Como falha:** O revisor detecta risco (ex.: terapia compressiva em paciente com doenca arterial periferica) e devolve {"isSafe": false, "justification": "...", "safeAlternative": ""}. resultObj.reply passa a ser string vazia/undefined; o paciente ve uma bolha de mensagem vazia (ou o chat trava em 'digitando...' para sempre, ver bug de AIChatAssistant.jsx:519) exatamente no caso em que uma orientacao corrigida de seguranca era obrigatoria.

**Código atual:**

```jsx
      if (validationResult && validationResult.isSafe === false) {
        console.warn("⚠️ [Safety Guardrail] Bloqueada resposta potencialmente insegura...");
        resultObj.reply = validationResult.safeAlternative;
```

**Correção sugerida:** Usar `resultObj.reply = validationResult.safeAlternative?.trim() || 'Não é seguro orientar sobre isso por aqui. Procure a equipe de saúde do iRec.'`.

<details><summary>Verificação feita contra o código</summary>

O defeito de código é real e verificado: a linha 489 testa apenas `validationResult.isSafe === false` e a linha 491 faz `resultObj.reply = validationResult.safeAlternative` sem checar preenchimento — nenhum fallback, nenhuma validação de string não vazia. Porém a falha só se materializa se o modelo revisor devolver isSafe:false com safeAlternative ausente/vazia, o que não posso confirmar sem executar contra a API real; é comportamento do modelo, não determinístico. O impacto declarado (bolha vazia / chat travado) também depende do streamResponse em AIChatAssistant, que não verifiquei.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0403 · MÉDIO · `CONFIRMADO`

**Texto do paciente interpolado direto no filtro .or() do PostgREST**

**Onde:** `src/services/geminiService.js:897`

**O defeito:** A busca hibrida monta a expressao de filtro concatenando a primeira palavra da pergunta do usuario: .or(`category.ilike.%${cleanWord}%,content.ilike.%${cleanWord}%`). Virgulas, parenteses e pontos digitados pelo paciente sao interpretados pelo PostgREST como separadores/operadores de filtro, quebrando ou alterando a consulta.

**Como falha:** Paciente digita 'curativo, o que fazer?'. cleanWord vira 'curativo,' e a expressao enviada e 'category.ilike.%curativo,%,content.ilike.%curativo,%', que o PostgREST parseia como tres filtros malformados: a query retorna erro, o catch da linha 911 devolve [] e a resposta do chat perde todo o contexto RAG dos videos de treinamento sem nenhum aviso.

**Código atual:**

```jsx
      const cleanWord = queryText.trim().split(" ")[0];
      const { data: textData, error: textError } = await supabase
        .from('training_knowledge')
        .select('video_title, category, content')
        .or(`category.ilike.%${cleanWord}%,content.ilike.%${cleanWord}%`)
```

**Correção sugerida:** Sanitizar com `cleanWord.replace(/[^\p{L}\p{N}]/gu, '')` (ou usar textSearch/rpc parametrizado) antes de montar o filtro.

<details><summary>Verificação feita contra o código</summary>

Linhas 891-898: `cleanWord = queryText.trim().split(" ")[0]` vem direto do texto do paciente e é concatenado em `.or(\`category.ilike.%${cleanWord}%,content.ilike.%${cleanWord}%\`)`, sem escape nem remoção de vírgula/parênteses/ponto — caracteres que o PostgREST usa como separador e delimitador de operador. Não há sanitização em nenhum ponto acima. Falha na consulta deixa `results` vazio (o if da linha 900 exige `!textError`) e a função retorna [] silenciosamente, perdendo o contexto RAG; o catch da linha 911 também retorna []. Caminho alcançável sempre que a busca vetorial não retorna nada e o Supabase está ativo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0442 · BAIXO · `VERIFICAR`

**Inicializador de estado faz JSON.parse do localStorage sem validar que e um array**

**Onde:** `src/components/AIChatAssistant.jsx:149`

**O defeito:** O inicializador do useState retorna 'JSON.parse(saved)' cru. O try/catch cobre apenas erro de sintaxe do JSON, nao o formato. Se o valor armazenado for um objeto, numero ou string valida em JSON, threads deixa de ser array e as chamadas subsequentes threads.find (linha 424) e threads.map (linha 1491) lancam TypeError. Note que o useEffect da linha 206 faz a validacao ('parsed && parsed.length > 0') que falta aqui, mas ele so roda depois do primeiro render.

**Como falha:** A chave irec_chat_threads_<id> e gravada com formato divergente por outra versao do app (ou pela migracao legada da linha 188, que copia conteudo de origem desconhecida). No primeiro render da aba Chat, 'threads.find is not a function' quebra o componente antes de o useEffect de reparo poder consertar - o paciente fica sem acesso ao assistente e nao ha caminho de recuperacao pela interface.

**Código atual:**

```jsx
    const saved = localStorage.getItem(`irec_chat_threads_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
```

**Correção sugerida:** Trocar por 'const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length) return parsed;' antes de cair no thread padrao.

<details><summary>Verificação feita contra o código</summary>

O inicializador (linhas 144-152) de fato retorna JSON.parse(saved) cru, e o try/catch cobre apenas erro de sintaxe; o useEffect da linha 206 tem a validacao 'parsed && parsed.length > 0' que falta aqui e so roda apos o primeiro render. Confirmei tambem que threads.find e usado logo no corpo do componente (linha 424), antes de qualquer reparo. O defeito de robustez e real, mas o crash exige que a chave contenha JSON valido nao-array, o que nenhum caminho do codigo atual produz (saveThreads sempre grava array) - dependeria de dado externo/legado. Dai PLAUSIVEL e severidade baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0443 · BAIXO · `CONFIRMADO`

**Estado showUploadMenu declarado e nunca lido nem atualizado**

**Onde:** `src/components/AIChatAssistant.jsx:286`

**O defeito:** O par [showUploadMenu, setShowUploadMenu] e criado mas nao aparece em nenhum outro ponto do arquivo (confirmado por busca: unica ocorrencia na linha 286). O menu de upload correspondente nao existe no JSX, restando apenas o clique direto no clipe.

**Como falha:** Resquicio de um menu de anexos removido: nao ha como escolher entre 'foto', 'documento' ou 'exame' como o estado sugere. O clique no clipe abre direto o seletor nativo, sem a etapa de escolha de tipo que classificaria o arquivo (e que alimentaria o fluxo de exames descrito na mensagem de boas-vindas).

**Código atual:**

```jsx
  const [showUploadMenu, setShowUploadMenu] = useState(false);
```

**Correção sugerida:** Remover a linha 286 (ou implementar o menu de tipo de anexo que ela pressupoe).

<details><summary>Verificação feita contra o código</summary>

Grep no arquivo confirma ocorrencia unica na linha 286: nem showUploadMenu nem setShowUploadMenu aparecem em qualquer outro ponto, e o clique no clipe (linha 1375) abre direto o seletor nativo. E codigo morto real, mas sem impacto funcional para o usuario - o app simplesmente nao tem a etapa de escolha de tipo; por isso mantenho severidade baixo (o problema clinico associado, o exame nunca ser triado, esta coberto pelo item 129).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0444 · BAIXO · `CONFIRMADO`

**Titulo da conversa e derivado da PRIMEIRA mensagem do usuario, nao da atual**

**Onde:** `src/components/AIChatAssistant.jsx:546`

**O defeito:** Array.prototype.find retorna a primeira ocorrencia, portanto userMsg e sempre a mensagem de usuario mais antiga do thread. O segundo operando do '||' ([...msgsBase].reverse().find(...)) so seria avaliado se o primeiro fosse undefined, ou seja, quando nao existe nenhuma mensagem de usuario - caso em que o reverse().find tambem retorna undefined: e um ramo inalcancavel. Alem disso essa renomeacao sobrescreve o titulo que handleSendMessage acabou de definir (linha 828).

**Como falha:** Paciente inicia a conversa perguntando sobre curativo (titulo passa a 'Cuidados com Curativos') e depois, no mesmo thread, pergunta sobre vitamina D. Ao final do streaming da segunda resposta, o titulo e recalculado a partir da primeira mensagem e volta para 'Cuidados com Curativos', ignorando o assunto atual - o paciente nao consegue localizar a conversa pelo assunto que acabou de tratar.

**Código atual:**

```jsx
            const userMsg = [...msgsBase].find(m => m.sender === 'user') || [...msgsBase].reverse().find(m => m.sender === 'user');
            const userText = userMsg ? userMsg.text : '';
            const detected = detectTopicFromText(userText, responseText);
```

**Correção sugerida:** Trocar por '[...msgsBase].reverse().find(m => m.sender === "user")' para titular pelo assunto mais recente.

<details><summary>Verificação feita contra o código</summary>

Linha 546 confirmada: Array.prototype.find retorna a primeira ocorrencia, entao userMsg e sempre a mensagem de usuario mais antiga de msgsBase; o fallback '|| [...msgsBase].reverse().find(...)' e mesmo inalcancavel, pois so seria avaliado quando nao ha nenhuma mensagem de usuario, caso em que o reverse().find tambem devolve undefined. A presenca desse fallback com reverse revela que a intencao era usar a ultima mensagem, logo e bug e nao estilo. O titulo tambem sobrescreve o definido em handleSendMessage (linha 828). Impacto e apenas de navegacao/organizacao do historico, por isso severidade baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0445 · BAIXO · `VERIFICAR`

**Renderizacao chama msg.text.startsWith sem verificar se text existe**

**Onde:** `src/components/AIChatAssistant.jsx:1072`

**O defeito:** O map de mensagens executa 'msg.text.startsWith(...)' duas vezes por item sem guarda. Mensagens gravadas com text undefined (resposta da IA sem 'reply', safeAlternative vazio, ou dados legados migrados da chave global) derrubam a arvore inteira do chat.

**Como falha:** Uma mensagem com text undefined e persistida no thread (pelo caminho do guardrail descrito em geminiService.js:491). Na proxima vez que o paciente abre a aba Chat, o render lanca 'Cannot read properties of undefined (reading startsWith)' e a tela do chat fica em branco permanentemente, pois o thread corrompido e recarregado do localStorage a cada mount.

**Código atual:**

```jsx
          {messages.map((msg) => {
            const isExamReport = msg.text.startsWith('📄 **Leitor de Exames');
            const isUserFile = msg.text.startsWith('📄 Documento Anexado');
```

**Correção sugerida:** Extrair 'const text = msg.text || ""' no inicio do map e usar essa variavel nos startsWith e na renderizacao.

<details><summary>Verificação feita contra o código</summary>

As duas chamadas sem guarda existem (linhas 1072-1073) e derrubariam toda a arvore do chat com text undefined. Porem o cenario citado esta errado: no caminho do guardrail o placeholder e criado com text: '' (linha 509) e persistido imediatamente (saveThreads, linha 516), ou seja, string vazia e nao undefined - o startsWith funciona. Fontes reais para text ausente restam apenas dados legados/corrompidos (a migracao da linha 188 ou o auto-reparo das linhas 212-236, que normaliza ids mas nunca o campo text). Por isso, PLAUSIVEL e severidade baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0446 · BAIXO · `CONFIRMAR-SCHEMA`

**Ramo de estilo isUserFile e inalcancavel: anexos nunca recebem o visual de documento**

**Onde:** `src/components/AIChatAssistant.jsx:1073`

**O defeito:** isUserFile testa se o texto comeca com '📄 Documento Anexado', mas handleSendMessage monta o rotulo do anexo como `${icon} ${selectedFile.name}` (linha 800), ou seja '📄 exame.pdf'. Nenhuma mensagem produzida pelo codigo comeca com essa string, logo isUserFile e sempre false e todos os tres ramos condicionais que dependem dele (background, cor de texto e borda tracejada) sao codigo morto.

**Como falha:** Paciente anexa 'hemograma.pdf'. A bolha da mensagem e renderizada com o estilo de mensagem de texto comum (fundo var(--primary) solido e texto branco) em vez do estilo de documento com borda tracejada previsto, tornando anexos visualmente indistinguiveis de perguntas digitadas no historico.

**Código atual:**

```jsx
            const isUserFile = msg.text.startsWith('📄 Documento Anexado');
...
                  backgroundColor: msg.sender === 'user' 
                    ? (isUserFile ? 'rgba(14, 165, 233, 0.08)' : 'var(--primary)')
```

**Correção sugerida:** Trocar a heuristica de texto por um sinal estrutural, ex.: 'const isUserFile = !!msg.fileName;' (campo ja gravado na linha 817).

<details><summary>Verificação feita contra o código</summary>

Comparei as duas pontas: handleSendMessage monta o rotulo como `${icon} ${selectedFile.name}` (linha 800), produzindo por exemplo '📄 hemograma.pdf', enquanto o render testa startsWith('📄 Documento Anexado') (linha 1073). Nenhuma mensagem gerada pelo codigo comeca com essa string, entao isUserFile e sempre false e os tres usos dependentes (fundo, cor do texto e borda tracejada, linhas 1087-1097) sao codigo morto; anexos ficam com o mesmo visual de uma pergunta digitada. Impacto puramente visual.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0578 · BAIXO · `CONFIRMADO`

**formatSOAPNote itera woundEntries e le patientProfile.name sem protecao**

**Onde:** `src/services/geminiService.js:716`

**O defeito:** Diferente de chatWithDoctorCopilot, que normaliza com Array.isArray (linhas 514-515), formatSOAPNote chama woundEntries.map direto e interpola '${patientProfile.name}' sem fallback (linha 732). Qualquer valor nao-array ou perfil sem name derruba a funcao ou injeta 'undefined' no prontuario.

**Como falha:** Medico dita a evolucao de um paciente cuja ficha ainda nao tem o nome preenchido e clica em 'Organizar em SOAP'. O prompt enviado contem '- Nome: undefined' e o documento SOAP devolvido, que sera gravado no campo de evolucao clinica, se refere ao paciente como 'undefined'. Se woundEntries chegar como null, a funcao lanca TypeError, retorna null e o medico ve apenas 'Nao foi possivel formatar a nota SOAP'.

**Código atual:**

```jsx
    const formattedWounds = woundEntries.map(entry => `
- Data: ${entry.date}
...
- Nome: ${patientProfile.name}
```

**Correção sugerida:** Usar `${patientProfile?.name || 'Paciente'}` e `const safeWounds = Array.isArray(woundEntries) ? woundEntries : []`.

<details><summary>Verificação feita contra o código</summary>

Confirmei a parte real: a linha 732 usa `${patientProfile.name}` sem fallback, ao contrário de todos os campos vizinhos (733-743) e de chatWithDoctorCopilot (linha 519, `patientProfile?.name || 'Paciente'`), então um paciente sem nome vira 'undefined' no prompt e potencialmente no texto SOAP gravado. Já a parte do `woundEntries.map` sem Array.isArray é praticamente inalcançável: o único chamador é DoctorDashboard.jsx:415 com `selectedPatientEntries`, prop que o mesmo componente já usa como array em .length/.map (linhas 2115, 2122, 2409) — se não fosse array a tela quebraria antes. Por isso mantenho a severidade baixa.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0587 · BAIXO · `CONFIRMADO`

**Edge Function nao valida o corpo e envia 'Nome: undefined' no prompt clinico**

**Onde:** `supabase/functions/gemini-analysis/index.ts:29`

**O defeito:** Diferente de todos os outros campos, 'name' e interpolado sem fallback ('${clinicalProfile.name}' em vez de "|| 'Paciente'"). Alem disso clinicalProfile nao e validado: analyzeWoundWithAI envia 'profile' que pode ser um objeto vazio ({} da linha 186), e se o body vier sem clinicalProfile a desestruturacao da linha 23 produz undefined e a linha 29 lanca TypeError, retornando 500.

**Como falha:** Paciente ainda sem ficha clinica preenchida (clinicalProfile sem name) faz a primeira triagem. O prompt enviado ao Gemini contem literalmente '- Nome: undefined', e o modelo passa a se referir ao paciente como 'undefined' no texto de medPalmDiagnosis/aiRecommendation que e salvo e exibido no prontuario.

**Código atual:**

```jsx
    const { clinicalProfile, symptomsText, filePart } = await req.json()
...
- Nome: ${clinicalProfile.name}
- Data de Nascimento: ${clinicalProfile.birthDate || 'Não informada'}
```

**Correção sugerida:** Trocar por `${clinicalProfile?.name || 'Paciente'}` e desestruturar com default `= {}`.

<details><summary>Verificação feita contra o código</summary>

Linha 29 é `- Nome: ${clinicalProfile.name}` — único campo do bloco sem fallback, enquanto todos os vizinhos (linhas 30-42) usam `|| '...'`. Se o perfil não tiver name, o prompt leva literalmente 'undefined'. Ajusto a severidade para baixo: o cenário de TypeError por clinicalProfile ausente não é alcançável pelo app, pois analyzeWoundWithAI sempre envia `profile = clinicalProfile || {}` (linha 186); só um chamador externo produziria isso, e o efeito seria apenas um 500 já tratado com fallback no cliente. O dano real é degradação do prompt, não crash.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "AIChatAssistant.jsx|geminiService.js"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
