# 7. Histórico e evolução

**47 defeitos** — 1 crítico · 7 alto · 17 médio · 22 baixo

Arquivos tocados por este módulo:

- `src/components/ClinicalHistory.jsx`
- `src/components/VitalsTelemetry.jsx`
- `src/components/WoundEvolutionComparator.jsx`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0006 · CRÍTICO · `CONFIRMADO`

**Prontuário exportado em PDF atribui responsabilidade a um médico fixo hardcoded (CRM inventado)**

**Onde:** `src/components/ClinicalHistory.jsx:175`

**O defeito:** `assignedDoctorName` e `assignedDoctorSpecialty` NUNCA existem no objeto de perfil. Confirmei por grep que `getClinicalProfile` (src/services/supabaseService.js:572-623) não mapeia nenhum campo `assignedDoctorName`/`assignedDoctorSpecialty`, e esses identificadores só aparecem neste arquivo. Existe a função `getAssignedDoctor(patientId)` (supabaseService.js:1735), mas ela nunca é usada aqui. Logo, o fallback é usado SEMPRE, para todos os pacientes.

**Como falha:** Qualquer paciente abre a aba 'Histórico' e clica em 'Exportar Prontuário Médico (PDF)'. O documento gerado traz, no cabeçalho (linha 215) e na linha de assinatura (linhas 600-601), 'Médico Responsável: Dr. Carlos Eduardo Santos (Médico Assistente (CRM-SP 148.920))' — um nome e CRM fixos de desenvolvimento, sem qualquer relação com o médico real do paciente. O PDF é um documento clínico que atribui responsabilidade profissional a alguém que não atendeu o paciente.

**Código atual:**

```jsx
const assignedDoctorName = clinicalProfile?.assignedDoctorName || 'Dr. Carlos Eduardo Santos';
  const assignedDoctorSpecialty = clinicalProfile?.assignedDoctorSpecialty || 'Médico Assistente (CRM-SP 148.920)';
```

**Correção sugerida:** Buscar o médico real via `getAssignedDoctor(patientId)` (supabaseService.js:1735) e, na ausência de vínculo, imprimir 'Profissional não vinculado' em vez de nome e CRM fictícios.

<details><summary>Verificação feita contra o código</summary>

Verifiquei por grep que `assignedDoctorName`/`assignedDoctorSpecialty` só existem neste arquivo (linhas 175, 176, 215, 600, 601) — nenhum serviço, mapeamento de perfil ou prop os produz. Como `clinicalProfile` nunca carrega essas chaves, o operador `||` cai SEMPRE no literal. Li o cabeçalho print-only (linha 215) e o bloco de assinatura (linhas 595-603): ambos imprimem 'Dr. Carlos Eduardo Santos (Médico Assistente (CRM-SP 148.920))' em um documento que se declara conforme CFM Res. 2.314/2022. Não há guarda alguma; qualquer paciente com perfil clínico gera esse PDF. Atribuir responsabilidade profissional e um CRM inexistente em documento clínico é o caso mais grave da lista.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0066 · ALTO · `CONFIRMADO`

**Log de acesso ao prontuário grava só em localStorage e usa o createAuditLog errado — nunca chega à tabela audit_logs**

**Onde:** `src/components/ClinicalHistory.jsx:129`

**O defeito:** Existem duas funções `createAuditLog` com assinaturas diferentes: src/services/auditLogger.js:8 `(actionType, clinician, patient, details)` que grava apenas em localStorage, e src/services/supabaseService.js:333 `(action, targetId, details)` que faz INSERT na tabela `audit_logs`. Todo o restante do app (Dashboard.jsx:3, DoctorDashboard.jsx:11, AIChatAssistant.jsx:2, TCLETelemedicineModal.jsx:2) usa a versão do supabaseService; só ClinicalHistory usa a de localStorage. Além disso, `getPatientAuditLogs` (auditLogger.js:37) não é chamado em nenhum lugar do projeto — confirmei por grep.

**Como falha:** Um profissional abre e exporta o prontuário de um paciente. O evento é gravado apenas na chave `irec_log_acessos_prontuario` do localStorage daquele navegador, nunca na tabela `audit_logs` do Supabase, e não é exibido em nenhuma tela (nem em admin-logs). Limpar o cache do navegador apaga a trilha. A promessa de auditoria LGPD do sistema não é cumprida para o evento mais sensível (leitura/exportação de prontuário).

**Código atual:**

```jsx
import('../services/auditLogger').then(({ createAuditLog }) => {
        createAuditLog(
          'Leitura de Prontuário', 
```

**Correção sugerida:** Usar `createAuditLog` de supabaseService (persistência em `audit_logs`) para leitura e exportação de prontuário, mantendo o localStorage apenas como fallback offline.

<details><summary>Verificação feita contra o código</summary>

Li auditLogger.js inteiro: `createAuditLog(actionType, clinician, patient, details)` grava apenas em `localStorage['irec_log_acessos_prontuario']` (linhas 22-25), sem qualquer chamada a Supabase. ClinicalHistory importa exatamente essa versão nas linhas 129 e 164, assinatura de 4 argumentos — incompatível com a de supabaseService (3 argumentos, INSERT em `audit_logs`). Confirmei ainda que `getPatientAuditLogs` (auditLogger.js:37) não é consumido em lugar nenhum, ou seja, a trilha gravada não é sequer exibida. Logo os dois eventos mais sensíveis (leitura e exportação de prontuário) ficam presos ao navegador e somem ao limpar o cache. Mantenho 'alto' porque a promessa de conformidade LGPD é explícita no comentário da linha 127.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0067 · ALTO · `CONFIRMADO`

**Log de auditoria LGPD registra identidade de clínico falsa e fixa em toda leitura de prontuário**

**Onde:** `src/components/ClinicalHistory.jsx:132`

**O defeito:** O objeto `clinician` passado ao `createAuditLog` é hardcoded como `{ id: 'clinician_active', name: 'Profissional Autorizado', role: 'Médico Assistente' }`. Nenhum dado do usuário logado (`currentUser`) é usado — o componente nem recebe essa prop (App.jsx:838 passa apenas `entries` e `clinicalProfile`). A trilha de auditoria, cuja finalidade declarada é conformidade LGPD, nunca registra quem realmente acessou.

**Como falha:** O próprio paciente abre sua aba 'Histórico'. É gravado no log de auditoria: 'Leitura de Prontuário' por 'Profissional Autorizado' com papel 'Médico Assistente'. O registro é falso em dois sentidos: não houve acesso de profissional algum, e o acessante real (o paciente) não foi identificado. Em uma auditoria LGPD, o log é inútil e enganoso.

**Código atual:**

```jsx
createAuditLog(
          'Leitura de Prontuário', 
          { id: 'clinician_active', name: 'Profissional Autorizado', role: 'Médico Assistente' }, 
          clinicalProfile, 
```

**Correção sugerida:** Passar `currentUser` como prop e registrar id, nome e papel reais do usuário logado no lugar do objeto fixo.

<details><summary>Verificação feita contra o código</summary>

Linhas 130-135 passam literalmente `{ id: 'clinician_active', name: 'Profissional Autorizado', role: 'Médico Assistente' }`, e o mesmo objeto reaparece em handlePrint (linha 167). Confirmei em App.jsx:838 que a única renderização é `<ClinicalHistory entries={entries} clinicalProfile={clinicalProfile} />` — o componente nem recebe `currentUser`, então não há como identificar o acessante. Em auditLogger.js:14-16 esses campos vão direto para `clinicianId`/`clinicianName`/`clinicianRole`. Como o `renderContent` de App.jsx serve a aba 'history' também ao próprio paciente, registra-se acesso de um 'Médico Assistente' que não existe. Log de auditoria com identidade fabricada é pior que ausência de log.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0068 · ALTO · `CONFIRMADO`

**Auditoria de leitura de prontuário registra um profissional FALSO hardcoded**

**Onde:** `src/components/ClinicalHistory.jsx:132`

**O defeito:** O useEffect que registra o acesso ao prontuário passa um objeto de clínico fixo no código: { id: 'clinician_active', name: 'Profissional Autorizado', role: 'Médico Assistente' }. O currentUser real nunca é usado (o componente só recebe entries, clinicalProfile e setActiveTab). O mesmo acontece em handlePrint (linha 167). Como o auditLogger apenas copia clinician?.id e clinician?.name (auditLogger.js:14-16), toda a trilha fica com o mesmo autor fictício. Além disso, o efeito dispara também quando é o PRÓPRIO PACIENTE olhando seu histórico, gerando um registro falso de que um "Médico Assistente" leu o prontuário.

**Como falha:** Três profissionais diferentes abrem o histórico do mesmo paciente ao longo do dia. A trilha de auditoria registra três acessos, todos atribuídos a clinicianId 'clinician_active' / 'Profissional Autorizado'. Em uma investigação de acesso indevido é impossível saber quem acessou. E, quando a própria paciente abre seu histórico no celular, é gerado um registro afirmando que um Médico Assistente leu o prontuário dela.

**Código atual:**

```jsx
createAuditLog(
  'Leitura de Prontuário', 
  { id: 'clinician_active', name: 'Profissional Autorizado', role: 'Médico Assistente' }, 
  clinicalProfile, 
  `Acesso de leitura ao histórico clínico do paciente ${clinicalProfile.name || ''}`
);
```

**Correção sugerida:** Passar currentUser como prop para ClinicalHistory e usar `{ id: currentUser.id, name: currentUser.name, role: currentUser.role }`, pulando o registro quando o leitor for o próprio paciente.

<details><summary>Verificação feita contra o código</summary>

ClinicalHistory.jsx:126-138 confirma o useEffect que chama createAuditLog com o literal `{ id: 'clinician_active', name: 'Profissional Autorizado', role: 'Médico Assistente' }`, e handlePrint repete o mesmo objeto na linha 167. A assinatura do componente (linha 123) é `{ entries, clinicalProfile, setActiveTab }` — não recebe currentUser, então não há como identificar o autor real. auditLogger.js:14-16 apenas copia clinician?.id/name/role, sem validação. A guarda existente (`if (clinicalProfile)`) não distingue papel, então o efeito também dispara quando é o próprio paciente vendo seu histórico, produzindo um registro falso de leitura por 'Médico Assistente'. Trilha de auditoria com autor fabricado é pior que ausência de trilha.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0069 · ALTO · `CONFIRMADO`

**Percentual de cicatrização soma granulação como tecido cicatrizado (ferida aberta marcada como 100%)**

**Onde:** `src/components/ClinicalHistory.jsx:143`

**O defeito:** `getEntryProgress` calcula progresso como `epitelizacao + granulacao`. Granulação é tecido de reparação em leito ainda ABERTO, não área cicatrizada. O valor alimenta o gráfico rotulado '📈 Evolução de Cicatrização (%)' (linha 276) e o texto 'Progresso Calculado' (linha 460). Note a contradição interna: o mesmo componente pinta granulação em VERMELHO (#ef4444, linha 528) na barra de composição tecidual e em `rgba(239, 68, 68, 0.75)` no gráfico de pizza (linha 30) — cor de alerta — mas a conta a trata como cicatrização completa.

**Como falha:** A IA analisa uma ferida recém-desbridada e retorna necrose 0, fibrina 0, granulação 100, epitelização 0. O prontuário exibe 'Progresso Calculado: 100%' e uma barra verde cheia no gráfico 'Evolução de Cicatrização (%)'. Paciente e profissional entendem que a ferida está cicatrizada, quando ela está totalmente aberta com leito de granulação.

**Código atual:**

```jsx
const epitelizacao = parseInt(entry.aiTissueAnalysis.epitelizacao) || 0;
      const granulacao = parseInt(entry.aiTissueAnalysis.granulacao) || 0;
      return Math.min(100, epitelizacao + granulacao);
```

**Correção sugerida:** Ponderar os tecidos (ex.: epitelização peso 1 e granulação peso 0,5) ou renomear a métrica para 'Tecido viável (%)', deixando de chamá-la cicatrização.

<details><summary>Verificação feita contra o código</summary>

Linhas 142-145 fazem exatamente `Math.min(100, epitelizacao + granulacao)`, sem ponderação. Esse valor é rotulado '📈 Evolução de Cicatrização (%)' (linha 275) e 'Progresso Calculado' (linha 460). A contradição interna apontada existe: o mesmo componente pinta granulação com `#ef4444` na barra (linha 528) e `rgba(239, 68, 68, 0.75)` na pizza (linha 30). O caso limite é indefensável — granulação 100 e epitelização 0 (leito totalmente aberto) exibe 100% de cicatrização e barra verde cheia. A mesma fórmula está replicada em Dashboard.jsx:261-268, então o número errado aparece em duas telas. Não há guarda nem legenda explicando que se trata de um proxy.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0070 · ALTO · `CONFIRMADO`

**Falha ao carregar a foto substitui a imagem da lesão por uma foto de banco de imagens (Unsplash) dentro do prontuário**

**Onde:** `src/components/ClinicalHistory.jsx:400`

**O defeito:** O `onError` do `<img>` troca o src por uma foto genérica de estoque. Como src/components/ClinicalTriage.jsx:497 grava `photo: ''` quando a imagem é um blob de câmera (`image.startsWith('blob:') ? '' : ...`), `<img src="">` resolve para a própria página, falha, dispara onError e carrega a foto de estoque. O mesmo ocorre quando uma URL assinada do Supabase Storage expira ou o app está offline (PWA/Capacitor).

**Como falha:** Paciente tira a foto da ferida pela câmera; a entrada é gravada com photo=''. Ao abrir 'Histórico', o card daquela avaliação exibe uma foto aleatória de banco de imagens como se fosse a lesão do paciente. Se o médico exportar o PDF, o prontuário sai com uma imagem clínica falsa.

**Código atual:**

```jsx
onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&auto=format&fit=crop&q=60';
                        }}
```

**Correção sugerida:** Trocar o fallback por um placeholder local neutro ('Imagem indisponível') e nunca por foto de banco de imagens dentro do prontuário.

<details><summary>Verificação feita contra o código</summary>

O onError das linhas 400-402 realmente troca o src por uma URL do Unsplash, sem qualquer condicional. Confirmei em ClinicalTriage.jsx:497 que `photo: image && image.startsWith('blob:') ? '' : (image || '')` grava string vazia para capturas de câmera, e `<img src="">` dispara o evento error nos navegadores modernos. O caminho Supabase (supabaseService.js:884 `photo: item.photo_url`) também produz o defeito quando a URL assinada expira ou não há rede. Além disso o `WoundTissueOverlay` (linha 404) desenha a pizza tecidual por cima da foto de estoque, reforçando a leitura de que é a lesão real. Rebaixo de crítico para alto porque a imagem de estoque é visivelmente clínica-genérica, não um pseudo-ferimento: engana, mas dificilmente é confundida com o leito da lesão por um profissional.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0160 · ALTO · `CONFIRMADO`

**Comparador exibe 3 lesões fictícias como se fossem do paciente quando ele tem menos de 2 registros**

**Onde:** `src/components/WoundEvolutionComparator.jsx:41`

**O defeito:** Se `entries` tiver 0 ou 1 item, o componente usa `defaultEntries` — três registros mock com fotos do Unsplash, datas fixas de 2026, áreas (14.5/8.2/3.1 cm²), níveis de dor e textos de evolução clínica inventados. Não há qualquer rótulo de 'demonstração' na tela. E o único registro real do paciente é descartado.

**Como falha:** Paciente novo com 1 única triagem abre o comparador. A tela mostra 'Comparador de Evolução de Lesão' com três fotos de feridas que não são dele, datas 15/06/2026, 01/07/2026 e 28/07/2026, e o laudo 'Epitelização em fases finais. Ótima evolução com terapia de curativo especial.' O registro verdadeiro do paciente nem aparece. Um enfermeiro/médico lê isso como o histórico real.

**Código atual:**

```jsx
const availableEntries = entries && entries.length >= 2 ? entries : defaultEntries;
```

**Correção sugerida:** Remover defaultEntries e, quando `entries.length < 2`, renderizar um estado vazio ('São necessárias ao menos duas avaliações com foto para comparar').

<details><summary>Verificação feita contra o código</summary>

Linha 41 é literalmente `const availableEntries = entries && entries.length >= 2 ? entries : defaultEntries;` e defaultEntries (linhas 5-39) são três mocks com fotos do Unsplash, datas 2026-06-15/07-01/07-28, áreas 14.5/8.2/3.1 e laudos redigidos ('Epitelização em fases finais...'). Li todo o JSX de saída: não há nenhum rótulo de demonstração associado a esse caminho — a única nota de contexto do arquivo é inexistente (a nota de transparência fica no VitalsTelemetry, outro componente). Com 1 registro real, ele é descartado sem aviso. Severidade reduzida de crítico para alto pelo mesmo motivo do item 245: o componente é inalcançável na interface atual.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0161 · ALTO · `CONFIRMAR-SCHEMA`

**Comparador fabrica áreas de lesão (14.5 cm² e 3.1 cm²) quando o registro não tem medição**

**Onde:** `src/components/WoundEvolutionComparator.jsx:51`

**O defeito:** Quando `aiAreaCm2`/`areaCm2` são nulos (coluna `ai_area_cm2 numeric` é opcional no schema e ClinicalTriage grava `aiAreaCm2: finalResult.aiAreaCm2 || null`), o código injeta silenciosamente 14.5 para a foto anterior e 3.1 para a atual. Todas as métricas abaixo (areaDiff, percentReduction, isHealing, status clínico) passam a ser derivadas desses números inventados.

**Como falha:** Paciente tem 2+ avaliações sem análise dimensional por IA (aiAreaCm2 null). O painel exibe 'REDUÇÃO DA ÁREA 🔻 78.6%', 'Diminuição de 11.4 cm²' e 'STATUS CLÍNICO: 🟢 Cicatrização Favorável' com borda verde — números que não vieram de nenhuma medição. Um profissional pode manter uma conduta inadequada baseado nessa falsa melhora. Pior: se apenas a foto B não tiver área, mistura-se área real (A) com área inventada (B=3.1).

**Código atual:**

```jsx
const areaA = parseFloat(entryA.aiAreaCm2 || entryA.areaCm2 || '14.5');
  const areaB = parseFloat(entryB.aiAreaCm2 || entryB.areaCm2 || '3.1');
```

**Correção sugerida:** Trocar os fallbacks por `const areaA = parseFloat(entryA.aiAreaCm2 ?? NaN)` e, se areaA ou areaB não forem finitos, exibir 'Área não medida' em vez de calcular redução/status.

<details><summary>Verificação feita contra o código</summary>

Linhas 51-52 contêm exatamente `parseFloat(entryA.aiAreaCm2 || entryA.areaCm2 || '14.5')` e `|| '3.1'`, sem nenhuma guarda anterior. Confirmei que a nulidade é real: ClinicalTriage.jsx:498 grava `aiAreaCm2: finalResult.aiAreaCm2 || null` e supabaseService.js:885 mapeia `aiAreaCm2: item.ai_area_cm2` sem default; além disso o campo `areaCm2` não existe em lugar nenhum do src (grep), então o segundo fallback nunca ajuda. Com área ausente, areaDiff, percentReduction, isHealing e o status clínico passam a derivar de 14.5/3.1 inventados, e o caso misto (só B nulo) mistura medida real com valor fictício. Severidade reduzida de crítico para alto porque o componente não é renderizado em lugar algum hoje (grep confirma zero imports), então nenhum usuário real alcança a tela.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0245 · MÉDIO · `CONFIRMAR-SCHEMA`

**Gráfico de pizza tecidual ignora epitelização e normaliza sobre 3 tecidos, superestimando tecido inviável**

**Onde:** `src/components/ClinicalHistory.jsx:17`

**O defeito:** O overlay só lê necrose, fibrina e granulação e usa `total = necrose + fibrina + granulacao` como 100% da pizza, embora a IA retorne também `epitelizacao` (confirmado em src/services/geminiService.js:271-274). O tooltip, por outro lado, mostra o valor bruto do tecido (linha 84), gerando dois números divergentes para a mesma fatia.

**Como falha:** IA retorna necrose 0, fibrina 10, granulação 20, epitelização 70. O overlay desenha uma pizza em que a fibrina ocupa 33% e a granulação 67% da área — visualmente uma ferida com um terço de esfacelo — mas o tooltip diz 'Esfacelo / Fibrina: 10%'. O profissional vê uma composição tecidual bem pior do que a real e o número exibido não bate com o desenho.

**Código atual:**

```jsx
const granulacao = parseFloat(entry.aiTissueAnalysis?.granulacao || 0);
    const total = necrose + fibrina + granulacao;
```

**Correção sugerida:** Incluir `epitelizacao` na lista de tecidos e usar `total = necrose + fibrina + granulacao + epitelizacao` (ou 100) como denominador.

<details><summary>Verificação feita contra o código</summary>

Linhas 14-17 leem apenas necrose, fibrina e granulação e definem `total` como a soma dos três; as fatias são calculadas em `(t.value / total) * 2 * Math.PI` (linha 34). Confirmei por grep que a IA devolve `epitelizacao` (geminiService.js:274, além dos prompts em 531, 643 e 721), e o próprio componente a consome na linha 143. O tooltip (linha 84) imprime `${t.value}%`, o valor bruto — então com necrose 0/fibrina 10/granulação 20/epitelização 70 a fatia de fibrina ocupa 33% do desenho enquanto o rótulo diz 10%. Divergência entre desenho e número confirmada, sem guarda.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0246 · MÉDIO · `CONFIRMADO`

**Efeito de auditoria re-executa a cada 30 segundos e satura o limite de 200 registros do log**

**Onde:** `src/components/ClinicalHistory.jsx:138`

**O defeito:** O useEffect depende de `[clinicalProfile]` (identidade de objeto). App.jsx tem um `setInterval(refreshData, 30000)` (App.jsx:722) que chama `setClinicalProfile(profile)` (App.jsx:696) com um objeto NOVO a cada ciclo. Logo o efeito refira a cada 30 s enquanto a aba estiver aberta, escrevendo um log a cada vez. O auditLogger corta em 200 registros (auditLogger.js:24 `.slice(0, 200)`), e como novos entram no início, os eventos antigos são descartados. Somado a isso, o StrictMode está ativo (src/main.jsx:19), então na montagem o efeito roda duas vezes em dev — o side-effect não é idempotente.

**Como falha:** Paciente deixa a aba 'Histórico' aberta por 100 minutos: são gravados ~200 logs idênticos de 'Leitura de Prontuário', que expulsam do armazenamento TODOS os outros eventos de auditoria reais (agendamentos, exportações, aceite de TCLE). A trilha de auditoria é destruída por ruído.

**Código atual:**

```jsx
      }).catch(err => console.warn('[iRec AuditLog] Falha ao registrar log:', err));
    }
  }, [clinicalProfile]);
```

**Correção sugerida:** Trocar a dependência para `[clinicalProfile?.id]` e proteger com um `useRef` que registre a leitura uma única vez por montagem/paciente.

<details><summary>Verificação feita contra o código</summary>

Verifiquei App.jsx:687-724: o `setInterval(refreshData, 30000)` chama `setClinicalProfile(profile)` (linha 696) com o objeto novo devolvido por `getClinicalProfile` a cada ciclo, para `currentUser.role === 'patient'`. O useEffect de ClinicalHistory depende de `[clinicalProfile]` (linha 138) e não tem guarda de idempotência, então dispara e grava um log a cada 30 s com a aba aberta. auditLogger.js:24 realmente faz `[newLog, ...existingLogs].slice(0, 200)`, com os novos no início, expulsando os antigos. StrictMode confirmado em main.jsx:19. Rebaixo de alto para médio porque a trilha em questão é apenas local e nunca é lida por nenhuma tela (ver item 248) — a poluição é real, mas o dano prático hoje é limitado a ruído e escrita repetida em localStorage.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0247 · MÉDIO · `CONFIRMADO`

**Registros sem análise de imagem aparecem como 'Progresso Calculado: 0%' no prontuário**

**Onde:** `src/components/ClinicalHistory.jsx:147`

**O defeito:** Quando a entrada não tem `progress` nem `aiTissueAnalysis`, a função retorna 0 — valor que é apresentado como se fosse uma medição. Note que a primeira condição (linha 141, `entry.progress`) nunca é satisfeita: nem `getWoundEntries` (supabaseService.js:866-898) nem `ClinicalTriage` (linha 481-504) produzem um campo `progress`. Não há distinção entre 'sem dado' e 'zero de progresso'.

**Como falha:** Paciente registra uma avaliação apenas de sintomas (sem foto/análise de IA). No card, aparece 'Progresso Calculado: 0%' em destaque azul, e no gráfico '📈 Evolução de Cicatrização (%)' surge uma barra rotulada '0%'. O paciente conclui que sua ferida não evoluiu nada, quando na verdade não houve medição alguma.

**Código atual:**

```jsx
    return 0;
  };
```

**Correção sugerida:** Retornar `null` quando não houver análise tecidual e renderizar '—' / 'sem medição' no lugar de 0%.

<details><summary>Verificação feita contra o código</summary>

Confirmei por grep que `progress` não é produzido em lugar algum do projeto (a única ocorrência é a variável local da linha 280), logo a condição da linha 141 é sempre falsa. E como `aiTissueAnalysis` chega sempre como objeto — `|| {}` em supabaseService.js:888 e ClinicalTriage.jsx:501 — o fluxo cai em `epitelizacao + granulacao = 0`. O resultado é apresentado como medição em 'Progresso Calculado: 0%' (linha 460) e como barra rotulada '0%' no gráfico de cicatrização (linha 284), sem distinguir 'sem dado' de 'zero de progresso'. Não há guarda de ausência de dado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0248 · MÉDIO · `CONFIRMADO`

**Código de 'Autenticação Digital' do prontuário é uma string fixa idêntica em todos os documentos**

**Onde:** `src/components/ClinicalHistory.jsx:195`

**O defeito:** O valor '#IRC-99218A-CFM' é um literal hardcoded, não derivado do paciente, da data, do conteúdo ou de qualquer assinatura. É apresentado como código de autenticação digital em um documento com pretensão de validade (o comentário na linha 182 cita CFM Res. 2.314/2022 e COFEN 0567/2018).

**Como falha:** Dois pacientes diferentes exportam seus prontuários em datas diferentes: ambos os PDFs trazem 'Autenticação Digital: #IRC-99218A-CFM'. O código não permite verificar nem distinguir documento algum, mas transmite ao leitor a falsa garantia de que o documento foi autenticado digitalmente.

**Código atual:**

```jsx
<p style={{ fontSize: '10px', color: '#666' }}>Autenticação Digital: #IRC-99218A-CFM</p>
```

**Correção sugerida:** Gerar o código a partir de dados reais do documento (ex.: hash de id do paciente + timestamp) ou remover a linha até haver assinatura digital de fato.

<details><summary>Verificação feita contra o código</summary>

A linha 195 contém o literal `Autenticação Digital: #IRC-99218A-CFM`, sem interpolação de paciente, data ou hash — a data ao lado (linha 194) é dinâmica, o que reforça que o código foi deixado fixo. Está no cabeçalho print-only, logo abaixo do comentário das linhas 181-183 que invoca CFM Res. 2.314/2022 e COFEN 0567/2018, transmitindo garantia de autenticação que não existe. Nenhuma guarda; todo PDF exportado sai idêntico. Mantenho médio: é uma afirmação falsa de validade, porém sem nome/CRM de terceiro envolvido (diferente do item 243).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0249 · MÉDIO · `CONFIRMAR-SCHEMA`

**Gráficos estouram o card com muitos registros: barras de largura fixa em linha sem scroll**

**Onde:** `src/components/ClinicalHistory.jsx:287`

**O defeito:** Cada coluna do gráfico é um flex item com `flex: 1`, mas contém uma barra de largura FIXA (24px no gráfico de cicatrização, 22px no gráfico de dor, linha 330). Como o min-width padrão dos flex items é `auto`, as colunas não encolhem abaixo do conteúdo, e o contêiner (`display:flex; justifyContent:'space-between'`) não tem `overflow-x`.

**Como falha:** Paciente em acompanhamento semanal acumula 25 avaliações. A linha de barras exige ~600px, estoura a largura do glass-card e, em telas de celular (~360px), as barras e os rótulos de data (10.5px) transbordam e se sobrepõem, tornando os dois gráficos ilegíveis e quebrando o layout da página.

**Código atual:**

```jsx
                          width: '24px', 
                          height: `${Math.max(8, progress * 0.85)}px`,
```

**Correção sugerida:** Adicionar `overflowX: 'auto'` e `minWidth: 0` nos contêineres dos gráficos, ou limitar a exibição às N avaliações mais recentes.

<details><summary>Verificação feita contra o código</summary>

Confirmei nas linhas 278-297 e 321-340: os contêineres são `display:flex; justifyContent:'space-between'` sem `overflow-x`, as colunas têm `flex: 1` (min-width auto por padrão) e as barras têm largura fixa `'24px'` (287) e `'22px'` (330). Com N avaliações o conteúdo exige ~24N+20 px e o item de grid (`minmax(280px, 1fr)`, linha 269) também tem min-width auto, então o estouro propaga para fora do glass-card. As faixas de datas (299-305 e 342-348) usam fonte 10.5px sem truncamento e se sobrepõem antes disso. Já com ~15 registros a tela de 360px quebra. Mantenho médio.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0250 · MÉDIO · `CONFIRMADO`

**Bloco 'Composição Tecidual' omite completamente a epitelização**

**Onde:** `src/components/ClinicalHistory.jsx:504`

**O defeito:** A lista de barras renderiza somente `necrose`, `fibrina` e `granulacao` (linhas 508, 516, 524). O campo `epitelizacao`, que a IA retorna (geminiService.js:274) e que o próprio componente usa para calcular progresso (linha 143), não tem barra nem rótulo.

**Como falha:** Uma lesão em fase final com epitelização 80% e granulação 20% mostra na composição tecidual apenas 'Granulação (20%)'. O dado mais relevante da fase de reparação — 80% de epitelização — não aparece em nenhum lugar da timeline, e o total exibido (20%) sugere ao leitor que 80% do leito é desconhecido.

**Código atual:**

```jsx
{entry.aiTissueAnalysis && Object.keys(entry.aiTissueAnalysis).length > 0 && (
```

**Correção sugerida:** Adicionar uma quarta barra para `entry.aiTissueAnalysis.epitelizacao`, seguindo o mesmo padrão das outras três.

<details><summary>Verificação feita contra o código</summary>

Li o bloco das linhas 504-533: há barras apenas para `necrose` (508), `fibrina` (516) e `granulacao` (524); não existe nenhum ramo para `epitelizacao`, embora o campo seja retornado pela IA e usado na linha 143 para o progresso. Comparando com DoctorDashboard.jsx:2184-2187 e 2613, que exibem a epitelização, a omissão é específica desta tela. Numa lesão em reparação (epitelização 80%, granulação 20%) a composição mostra só '20%', sugerindo leito desconhecido. Mantenho médio: é omissão de dado clínico relevante, sem falsificação.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0376 · MÉDIO · `CONFIRMADO`

**Componente VitalsTelemetry nunca é renderizado: a tela de sinais vitais é inalcançável no app**

**Onde:** `src/components/VitalsTelemetry.jsx:3`

**O defeito:** Grep por 'VitalsTelemetry' e 'Telemetry' em src/ retorna apenas o próprio arquivo. Não há import em App.jsx nem em nenhum outro componente, nem case correspondente no switch de activeTab. Nenhum botão ou menu abre a telemetria.

**Como falha:** Nem paciente nem médico conseguem acessar 'Telemetria de Saúde & Sinais Vitais IoT' por qualquer caminho da interface. Toda a funcionalidade de sinais vitais e de temperatura plantar do pé diabético está fora do alcance do usuário, embora o código seja empacotado no bundle.

**Código atual:**

```jsx
export default function VitalsTelemetry({ patientId, isDoctorView = false }) {
```

**Correção sugerida:** Ou montar VitalsTelemetry em uma aba/dashboard existente, ou remover o arquivo do repositório.

<details><summary>Verificação feita contra o código</summary>

Grep por `VitalsTelemetry` em todo o src/ retorna uma única linha: a declaração do próprio componente. Não há import, nem case no switch de activeTab de App.jsx, nem botão de acesso. O código é empacotado mas inacessível. Mantenho médio — é a causa raiz que atenua os itens 251-254, 279-286, 288 e 289.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0377 · MÉDIO · `CONFIRMADO`

**Alerta de assimetria térmica é código inalcançável: as temperaturas simuladas nunca atingem o limiar de 2°C**

**Onde:** `src/components/VitalsTelemetry.jsx:54`

**O defeito:** `hasCriticalAsymmetry` exige diferença >= 2.0°C. Os valores iniciais (linhas 17-24) dão diferenças de 0.2, 0.3 e 0.2°C. Depois do sync (linhas 39-46), as faixas são leftToe 31.0-31.5 vs rightToe 31.1-31.6 (dif. máxima 0.6), leftPlantar 32.0-32.5 vs rightPlantar 32.2-32.7 (máx. 0.7) e leftHeel 30.6-31.1 vs rightHeel 30.7-31.2 (máx. 0.6). Não existe nenhum outro caminho que altere `temperatures`. Portanto `hasCriticalAsymmetry` é sempre `false` e todo o bloco de alerta (linhas 191-204), assim como as marcações de cor de perigo nas linhas 243-253, jamais são renderizados.

**Como falha:** Usuário abre a aba '👣 Temperatura Local (Plantar)' e clica em 'Sincronizar' quantas vezes quiser: nunca verá o alerta '🚨 ALERTA CLÍNICO: Assimetria Térmica Detectada'. A funcionalidade de alerta de risco de ulceração em pé diabético — razão de existir da tela — está morta.

**Código atual:**

```jsx
const hasCriticalAsymmetry = parseFloat(diffToe) >= 2.0 || parseFloat(diffPlantar) >= 2.0 || parseFloat(diffHeel) >= 2.0;
```

**Correção sugerida:** Derivar as temperaturas simuladas de um cenário parametrizável (ou de dados reais do paciente) que possa cruzar o limiar de 2°C, em vez de faixas fixas de ±0.5°C.

<details><summary>Verificação feita contra o código</summary>

Verifiquei os dois únicos pontos que escrevem `temperatures`: o useState inicial (linhas 17-24 → diferenças 0.2, 0.3 e 0.2°C) e o setTemperatures do handleSync (linhas 39-46 → dedos 31.0-31.5 vs 31.1-31.6, plantar 32.0-32.5 vs 32.2-32.7, calcanhar 30.6-31.1 vs 30.7-31.2, ou seja máximos de 0.6, 0.7 e 0.6°C). Não há nenhuma outra atribuição no arquivo. Logo `hasCriticalAsymmetry` (linha 54, `>= 2.0`) é matematicamente sempre false, e o bloco de alerta (191-204) e as marcações de perigo (243-253) nunca renderizam. Severidade reduzida de alto para médio: é código morto dentro de um componente que, além disso, nunca é montado no app.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0378 · MÉDIO · `CONFIRMADO`

**Classificações clínicas ('Normal', 'Excelente', 'Estável') são literais fixos, não calculados a partir dos valores**

**Onde:** `src/components/VitalsTelemetry.jsx:150`

**O defeito:** Os cinco selos de status dos sinais vitais (linhas 150, 158, 166, 174 e 182) são strings fixas com cor de sucesso, sem nenhuma comparação com faixas de referência. Nenhum dos cinco cards avalia o valor exibido logo acima dele.

**Como falha:** Se `vitals` receber qualquer valor alterado — por exemplo bloodPressure '180/110', spo2 88 ou glucose 320 — o card continuará exibindo o selo verde 'Normal'/'Excelente'/'Estável' ao lado do número crítico. A tela nunca é capaz de sinalizar anormalidade, o que a torna inútil e potencialmente perigosa como painel de sinais vitais.

**Código atual:**

```jsx
<span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(72, 187, 120, 0.1)', color: 'var(--success)', fontWeight: '700' }}>Normal</span>
```

**Correção sugerida:** Calcular o selo por faixas de referência (ex.: `spo2 >= 95 ? 'Normal' : 'Baixa'`) e trocar a cor para --danger/--warning fora da faixa.

<details><summary>Verificação feita contra o código</summary>

Li os cinco cards (linhas 146-183): os selos das linhas 150, 158, 166, 174 e 182 são strings literais 'Normal'/'Normal'/'Excelente'/'Normal'/'Estável', todos com `color: 'var(--success)'` fixo e nenhuma expressão condicional sobre `vitals`. Não existe função de classificação no arquivo. É exatamente um valor apresentado como avaliação clínica sem base no dado exibido — defeito legítimo mesmo sendo intencional. Mantenho médio (a nota de transparência da linha 273 atenua parcialmente, e o componente não é alcançável).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0379 · MÉDIO · `CONFIRMADO`

**Mensagem do alerta térmico sempre culpa o pé direito, mesmo quando o pé esquerdo é o alterado**

**Onde:** `src/components/VitalsTelemetry.jsx:203`

**O defeito:** As diferenças são calculadas com `Math.abs(left - right)` (linhas 50-52), o que descarta o sinal e, portanto, qual pé está mais quente. Mesmo assim o texto do alerta afirma categoricamente 'risco de ulceração no pé direito'. Em pé diabético, a lateralidade é a informação clínica central para orientar alívio de pressão.

**Como falha:** Se o sensor registrar leftPlantar 34.5°C e rightPlantar 32.0°C (pé ESQUERDO inflamado), o alerta instrui o paciente a proteger o pé DIREITO, deixando o pé realmente em risco sem descarga de pressão.

**Código atual:**

```jsx
Há uma variação de <strong>{diffPlantar}°C</strong> na região plantar. Variações maiores que 2°C indicam risco de ulceração no pé direito. Evite caminhar excessivamente e consulte seu médico.
```

**Correção sugerida:** Calcular o lado mais quente (`leftPlantar > rightPlantar ? 'esquerdo' : 'direito'`) e interpolar essa palavra no texto do alerta.

<details><summary>Verificação feita contra o código</summary>

As três diferenças usam `Math.abs()` (linhas 50-52), descartando o sinal, e o texto da linha 203 afirma sem condicional 'risco de ulceração no pé direito'. Não há nenhuma comparação de qual lado está mais quente em todo o arquivo. O defeito de lateralidade é real e clinicamente relevante. Severidade reduzida de alto para médio porque a mensagem está dentro do ramo `hasCriticalAsymmetry`, que hoje é inalcançável (item 251), e o componente inteiro não é renderizado — o dano é latente, não atual.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0380 · MÉDIO · `CONFIRMADO`

**Alerta disparado por assimetria em dedos ou calcanhar exibe a diferença plantar (normal) no texto**

**Onde:** `src/components/VitalsTelemetry.jsx:203`

**O defeito:** `hasCriticalAsymmetry` é verdadeiro se QUALQUER das três regiões (diffToe, diffPlantar, diffHeel) atingir 2.0°C, mas o texto do alerta interpola apenas `diffPlantar` e afirma que a variação é 'na região plantar'. A região efetivamente alterada nunca é nomeada.

**Como falha:** Com diffToe = 2.4°C e diffPlantar = 0.2°C, o alerta vermelho aparece dizendo 'Há uma variação de 0.2°C na região plantar. Variações maiores que 2°C indicam risco de ulceração' — a própria mensagem se contradiz (0.2 não é maior que 2) e aponta a região errada, escondendo que o problema está nos dedos.

**Código atual:**

```jsx
Há uma variação de <strong>{diffPlantar}°C</strong> na região plantar. Variações maiores que 2°C indicam risco de ulceração no pé direito.
```

**Correção sugerida:** Montar a lista das regiões cuja diferença atingiu o limiar e interpolar região + valor correspondentes, em vez de fixar diffPlantar.

<details><summary>Verificação feita contra o código</summary>

`hasCriticalAsymmetry` (linha 54) é um OR entre diffToe, diffPlantar e diffHeel, mas o texto da linha 203 interpola apenas `{diffPlantar}` e afirma 'na região plantar'. Confirmei que não há nenhuma seleção da região efetivamente alterada no bloco 191-204. Com diffToe alto e diffPlantar normal, o alerta realmente se autocontradiz. Severidade reduzida de alto para médio pela mesma razão do item 252: ramo inalcançável hoje e componente não montado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0381 · MÉDIO · `CONFIRMADO`

**Componente WoundEvolutionComparator nunca é renderizado: o comparador de evolução é inalcançável no app**

**Onde:** `src/components/WoundEvolutionComparator.jsx:3`

**O defeito:** Grep por 'WoundEvolutionComparator', 'Comparator' e 'comparador' em src/ retorna apenas o próprio arquivo. Não há import em App.jsx nem em qualquer outro componente, não há case no switch de activeTab e nenhum botão que o abra. A prop `onClose` também nunca é fornecida por ninguém.

**Como falha:** Um profissional que precise comparar a evolução lado a lado não encontra nenhuma entrada para essa tela em toda a interface (nem na aba 'Histórico', nem no dashboard do médico). A funcionalidade existe no bundle (aumentando o tamanho do build) mas é inacessível a qualquer usuário.

**Código atual:**

```jsx
export default function WoundEvolutionComparator({ entries = [], onClose, embeddedMode = false }) {
```

**Correção sugerida:** Ou integrar o comparador (import + botão na aba Histórico/dashboard do médico), ou remover o arquivo do repositório.

<details><summary>Verificação feita contra o código</summary>

Grep por `WoundEvolutionComparator` em todo o src/ retorna uma única linha: a própria declaração `export default function` na linha 3 do arquivo. Não há import em App.jsx nem em nenhum outro componente, nenhum case no switch de activeTab e, consequentemente, ninguém fornece `entries` ou `onClose`. O componente é código morto empacotado no bundle. Mantenho médio — é a causa raiz que atenua todos os demais achados deste arquivo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0382 · MÉDIO · `CONFIRMAR-SCHEMA`

**Estado inicial de indexB é congelado e dessincroniza o <select> do painel exibido**

**Onde:** `src/components/WoundEvolutionComparator.jsx:44`

**O defeito:** `useState(availableEntries.length - 1)` só é avaliado na primeira renderização. `availableEntries` depende da prop `entries`, que em App.jsx é carregada de forma assíncrona (App.jsx:558-559) e re-buscada a cada 30 s (App.jsx:722). Não existe useEffect para reajustar indexB. Como `entryB` cai no fallback `availableEntries[availableEntries.length - 1]` (linha 48) quando o índice é inválido, o `<select value={indexB}>` fica apontando para um valor sem `<option>` correspondente.

**Como falha:** O comparador monta antes de `entries` chegar (usa os 3 mocks, indexB=2). Chegam então 2 registros reais: availableEntries.length = 2, mas indexB continua 2. O dropdown 'SELECIONE FOTO ATUAL' não tem opção com value=2, então o navegador exibe a PRIMEIRA opção selecionada, enquanto o painel da direita mostra o segundo registro. Usuário lê data/área de um registro no dropdown e vê outro na foto. Se chegarem 5 registros, indexB fica em 2 e a 'foto atual' não é a mais recente — a redução de área calculada ignora as duas últimas avaliações.

**Código atual:**

```jsx
const [indexB, setIndexB] = useState(availableEntries.length - 1); // Newer photo
```

**Correção sugerida:** Adicionar `useEffect(() => setIndexB(availableEntries.length - 1), [availableEntries.length])` (e clampar indexA) para reajustar os índices quando a lista muda.

<details><summary>Verificação feita contra o código</summary>

Linha 44 é `useState(availableEntries.length - 1)`, avaliado só na primeira renderização, e não há nenhum useEffect no arquivo que reajuste indexA/indexB quando `entries` muda (li o componente inteiro; só existem os três useState das linhas 43-45). A linha 48 confirma o fallback silencioso `availableEntries[indexB] || availableEntries[length-1]`, que é justamente o que produz o descasamento entre `<select value={indexB}>` e o painel exibido. Severidade reduzida de alto para médio: o cenário de corrida depende de um chamador que passe `entries` de forma assíncrona, e hoje não existe chamador algum (grep) — o defeito é real no código, mas latente.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0383 · MÉDIO · `CONFIRMAR-SCHEMA`

**Comparador não valida a ordem cronológica: inverter A e B transforma melhora em piora**

**Onde:** `src/components/WoundEvolutionComparator.jsx:55`

**O defeito:** Os dois selects listam todas as entradas sem restrição, e todo o cálculo assume que A é anterior a B (`(areaA - areaB) / areaA`). Não há comparação de datas nem verificação de `indexA < indexB`, apesar dos rótulos afirmarem 'PONTO DE PARTIDA' e 'REAVALIAÇÃO'.

**Como falha:** Usuário escolhe por engano a foto mais recente (área 3.1 cm²) como 'FOTO ANTERIOR' e a mais antiga (14.5 cm²) como 'FOTO ATUAL'. O painel calcula -367.7% e exibe borda vermelha com '🔴 Necessita Revisão de Conduta' e 'Aumento de 11.4 cm²' para uma ferida que na realidade regrediu 78%. O contrário também ocorre: uma piora real pode ser exibida como '🟢 Cicatrização Favorável'.

**Código atual:**

```jsx
const percentReduction = areaA > 0 ? (((areaA - areaB) / areaA) * 100).toFixed(1) : '0';
```

**Correção sugerida:** Ordenar as entradas por data e, ao selecionar, forçar A anterior a B (desabilitando opções inválidas ou trocando os índices automaticamente).

<details><summary>Verificação feita contra o código</summary>

Os dois `<select>` (linhas 115-134 e 141-160) renderizam `availableEntries.map` completo, sem filtro nem desabilitação, e todo o cálculo da linha 55 assume A anterior a B. Não há comparação de `e.date` nem verificação `indexA < indexB` em parte alguma do arquivo, embora os rótulos digam 'PONTO DE PARTIDA' e 'REAVALIAÇÃO'. A inversão realmente inverte o sinal de percentReduction, de isHealing e do status clínico. Mantenho médio: é um erro de usabilidade clínica real, mas requer ação equivocada do usuário e o componente ainda não está acessível.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0384 · MÉDIO · `CONFIRMADO`

**Imagens do comparador sem tratamento de erro: entradas com photo vazio mostram caixa preta quebrada**

**Onde:** `src/components/WoundEvolutionComparator.jsx:239`

**O defeito:** `entryA.photo || entryA.photoUrl` — não existe campo `photoUrl` no mapeamento de `getWoundEntries` (supabaseService.js:884 mapeia apenas `photo: item.photo_url`), então o segundo fallback nunca funciona. E `ClinicalTriage.jsx:497` grava `photo: ''` para capturas via blob. Não há `onError` nem estado de placeholder.

**Como falha:** Paciente com duas avaliações capturadas pela câmera (photo='') abre o comparador: os dois painéis mostram apenas retângulos preto de 280px de altura com o ícone de imagem quebrada, enquanto o banner acima continua exibindo métricas de área e o status '🟢 Cicatrização Favorável'. O usuário não recebe nenhuma indicação de que as fotos não existem.

**Código atual:**

```jsx
              src={entryA.photo || entryA.photoUrl}
              alt="Foto Anterior"
```

**Correção sugerida:** Adicionar `onError` e um estado de placeholder ('Foto indisponível para esta avaliação') quando `entryX.photo` for vazio, e remover o fallback inexistente `photoUrl`.

<details><summary>Verificação feita contra o código</summary>

Grep confirma que `photoUrl` não existe em nenhum mapeamento: supabaseService.js:884 produz apenas `photo: item.photo_url`, então o segundo fallback da linha 239 é sempre undefined. E ClinicalTriage.jsx:497 grava literalmente `photo: image && image.startsWith('blob:') ? '' : (image || '')`, ou seja, string vazia para capturas via blob. O `<img>` das linhas 238-248 não tem `onError` nem estado de placeholder, e o contêiner (linhas 227-237) tem `backgroundColor: '#000000'` com 280px de altura — exatamente a caixa preta descrita. Mantenho médio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0385 · MÉDIO · `CONFIRMAR-SCHEMA`

**Campo clinicalEvolution (enum 'Melhorou/Estável/Piorou') é exibido entre aspas como se fosse um laudo descritivo**

**Onde:** `src/components/WoundEvolutionComparator.jsx:254`

**O defeito:** Nas entradas reais, `clinicalEvolution` é um enum curto: o schema define `clinical_evolution text DEFAULT 'Estável'` e supabaseService.js:883 aplica `clinicalEvolution: item.clinical_evolution || 'Estável'`; ClinicalHistory.jsx:378 compara com 'Melhorou'/'Piorou'. Mas aqui o campo é renderizado em itálico entre aspas, no lugar onde os mocks colocam frases longas de evolução ('Ferida com presença de esfacelo e exsudato moderado...').

**Como falha:** Comparando duas avaliações reais, os painéis exibem, no rodapé de cada foto, apenas `"Estável"` e `"Estável"` em itálico e entre aspas, como se fossem observações clínicas transcritas. O espaço destinado ao laudo evolutivo fica sem informação útil e o formato sugere uma citação que não existe.

**Código atual:**

```jsx
{entryA.clinicalEvolution && (
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                <em>"{entryA.clinicalEvolution}"</em>
```

**Correção sugerida:** Rotular o campo como 'Evolução clínica: Estável' (sem aspas/itálico) e usar um campo descritivo separado, como `aiRecommendation`/observações, para o texto do laudo.

<details><summary>Verificação feita contra o código</summary>

Confirmei por grep que supabaseService.js:883 faz `clinicalEvolution: item.clinical_evolution || 'Estável'`, ou seja, um valor curto de enum com default 'Estável'. Nos mocks (linhas 15, 26, 37) o mesmo campo guarda frases longas de laudo. A renderização das linhas 254-258 (e a simétrica do painel B) põe o valor em `<em>"{...}"</em>`, formato de citação. Logo, com dados reais o rodapé mostra apenas "Estável" entre aspas no lugar reservado ao laudo evolutivo. Mantenho médio: é desalinhamento real entre modelo de dados e UI, ainda que em componente não montado.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0386 · MÉDIO · `CONFIRMADO`

**Modal do comparador pode travar o app: overlay fixo z-index 1500 sem fechar por ESC, sem clique no backdrop e com botão ✖ opcional**

**Onde:** `src/components/WoundEvolutionComparator.jsx:362`

**O defeito:** No modo não-embedado o componente renderiza um overlay `position: fixed` cobrindo toda a viewport com `zIndex: 1500`. Não há `onClick` no backdrop, não há listener de tecla Escape e o único botão de fechar está condicionado a `onClose &&` (linha 90). Como `onClose` não tem valor padrão nem é obrigatória, um chamador que renderize `<WoundEvolutionComparator entries={x} />` produz um overlay sem nenhum controle de saída.

**Como falha:** O comparador é aberto sem a prop onClose: o overlay escuro com blur cobre toda a interface, o botão ✖ não é renderizado, ESC não faz nada e clicar fora não faz nada. O usuário fica preso na tela e só sai recarregando o app (perdendo o estado de navegação).

**Código atual:**

```jsx
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
```

**Correção sugerida:** Fechar no clique do backdrop e no Escape, e sempre renderizar o botão ✖ (com `onClose` obrigatório ou default no-op que oculte o modal).

<details><summary>Verificação feita contra o código</summary>

Linhas 359-378: quando `embeddedMode` é false, o retorno é um `position: fixed` cobrindo top/left/right/bottom com zIndex 1500 e backdropFilter blur, sem `onClick` no container. O botão de fechar (linhas 90-97) está sob `{onClose && (...)}`, e `onClose` não tem default nem validação. Não há nenhum listener de teclado no arquivo. Portanto `<WoundEvolutionComparator entries={x} />` realmente gera um overlay sem saída. Severidade reduzida de alto para médio: exige um chamador que omita onClose, e hoje não há chamador nenhum.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0451 · BAIXO · `CONFIRMADO`

**Tooltip afirma 'Lesão Segmentada' em fotos sem nenhuma análise tecidual**

**Onde:** `src/components/ClinicalHistory.jsx:89`

**O defeito:** O `handleMouseMove` não replica a guarda `if (total === 0) return;` que existe no efeito de desenho (linha 19). Quando não há análise, `tissues` fica vazio, `found` permanece null e o fallback `'Lesão Segmentada'` é exibido de qualquer forma.

**Como falha:** Entrada criada sem análise de imagem (aiTissueAnalysis = {}, como grava ClinicalTriage.jsx:501 quando a IA não retorna tecidos). Nada é desenhado no canvas, mas ao passar o mouse sobre a foto aparece um selo escuro 'Lesão Segmentada', afirmando que houve segmentação por visão computacional que nunca ocorreu.

**Código atual:**

```jsx
setHoveredTissue(found || 'Lesão Segmentada');
```

**Correção sugerida:** Adicionar `if (total === 0) { setHoveredTissue(null); return; }` no início do bloco de hover e só exibir o fallback quando houver tecidos.

<details><summary>Verificação feita contra o código</summary>

O efeito de desenho tem `if (total === 0) return;` (linha 19), mas `handleMouseMove` não replica essa guarda: com `aiTissueAnalysis = {}` o array `tissues` fica vazio após o `.filter(t => t.value > 0)` (linha 78), o forEach não roda, `found` continua null e a linha 89 aplica o fallback `'Lesão Segmentada'` sempre que o cursor estiver dentro do raio 35. Confirmei em ClinicalTriage.jsx:501 que `aiTissueAnalysis: finalResult.aiTissueAnalysis || {}` produz esse estado, e supabaseService.js:888 faz o mesmo (`|| {}`). Rebaixo para baixo: o rótulo é enganoso, mas é um selo efêmero de hover, sem persistência no prontuário nem no PDF.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0452 · BAIXO · `VERIFICAR`

**Tooltip de segmentação tecidual é inacessível em dispositivos touch (app Android/iOS Capacitor)**

**Onde:** `src/components/ClinicalHistory.jsx:96`

**O defeito:** A única forma de descobrir o que cada fatia da pizza representa é o handler `onMouseMove`. Não há legenda estática, nem `onTouchStart`/`onTouchMove`, nem `onClick`. O projeto é empacotado com Capacitor 8 para Android/iOS, onde eventos de mouse não são emitidos de forma confiável.

**Como falha:** Paciente no aplicativo Android abre 'Histórico' e toca sobre a foto da lesão: nada acontece. As três fatias coloridas (preto/âmbar/vermelho) permanecem sem qualquer identificação, e o overlay semi-transparente ainda cobre a foto real da ferida. A informação de composição tecidual fica indisponível no principal dispositivo de uso.

**Código atual:**

```jsx
<div style={{ position: 'absolute', top: 0, left: 0, width: '120px', height: '120px', cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredTissue(null)}>
```

**Correção sugerida:** Adicionar uma legenda estática com as cores dos tecidos abaixo da foto, tornando o tooltip apenas um enriquecimento opcional.

<details><summary>Verificação feita contra o código</summary>

A linha 96 realmente registra somente `onMouseMove` e `onMouseLeave`, e não há legenda estática nem handlers de toque em todo o componente (verifiquei o corpo inteiro do WoundTissueOverlay, linhas 55-120). Porém não posso confirmar o cenário como descrito: WebViews Chrome/WKWebView emitem eventos de mouse de compatibilidade no toque, então um toque frequentemente dispara `mousemove` e o selo aparece — o problema real vira um tooltip que nunca é limpo (não há `mouseleave` no touch) e a ausência de legenda. Como o comportamento depende do WebView e eu não executei em dispositivo, marco PLAUSIVEL e rebaixo para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0453 · BAIXO · `CONFIRMADO`

**Overlay tecidual desalinhado da foto: 120x120 dentro de contêiner de 130x130 com centro fixo em (60,60)**

**Onde:** `src/components/ClinicalHistory.jsx:96`

**O defeito:** O contêiner da imagem tem 130x130px (linha 395), mas o overlay e o canvas têm 120x120 ancorados em top:0/left:0, e toda a matemática (centro 60,60 e raio 35 nas linhas 21-23 e 62-63) assume esse quadro. O overlay não é centralizado nem cobre a imagem inteira.

**Como falha:** Em qualquer card da timeline, o círculo de segmentação aparece deslocado 5px acima e à esquerda do centro da foto, e a faixa de 10px na borda direita/inferior da imagem não responde ao hover. A sobreposição não coincide com a lesão retratada.

**Código atual:**

```jsx
<div style={{ position: 'absolute', top: 0, left: 0, width: '120px', height: '120px', cursor: 'crosshair' }}
```

**Correção sugerida:** Usar `inset: 0` com canvas de 130x130 e derivar centro/raio do tamanho real do contêiner em vez de constantes 60/35.

<details><summary>Verificação feita contra o código</summary>

Confirmei o descasamento: o contêiner da foto tem 130x130 (linha 395) enquanto o overlay e o canvas são 120x120 ancorados em top:0/left:0 (linhas 96-97), com centro (60,60) e raio 35 tanto no desenho (21-23) quanto na detecção de hover (62-63). O círculo fica 5px acima e à esquerda do centro da imagem e a faixa de 10px à direita/abaixo não recebe hover. Rebaixo o impacto conceitual: como a pizza é um gráfico de proporções e não uma segmentação pixel a pixel da lesão, 'não coincide com a lesão retratada' já vale para qualquer posição — o defeito é apenas o descentramento visual. Baixo, como reportado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0454 · BAIXO · `CONFIRMADO`

**Falha ao registrar auditoria de exportação é silenciada com catch vazio e a impressão prossegue**

**Onde:** `src/components/ClinicalHistory.jsx:171`

**O defeito:** O `.catch(() => {})` engole qualquer erro de registro do log (import falho, localStorage cheio ou desabilitado em modo privado) e `window.print()` é executado em seguida de forma incondicional. Nem o usuário nem o console recebem qualquer sinal — diferente do efeito de leitura, que ao menos faz console.warn (linha 136).

**Como falha:** Navegador em modo privado com localStorage cheio (o log já tem 200 registros grandes com nomes): o `setItem` lança QuotaExceededError, o catch descarta o erro, e o prontuário completo com CPF, medicações e alergias é exportado sem nenhum registro de auditoria de exportação. Não há evidência de que o documento saiu.

**Código atual:**

```jsx
    }).catch(() => {});
    window.print();
```

**Correção sugerida:** Trocar `.catch(() => {})` por um `console.warn` e, idealmente, aguardar o registro (`await`) antes de chamar `window.print()`.

<details><summary>Verificação feita contra o código</summary>

Linhas 164-172: o `.catch(() => {})` é literalmente vazio e `window.print()` roda logo após, fora da promise — ou seja, a impressão nem sequer espera o log e prossegue incondicionalmente, mesmo em caso de falha. O contraste com o efeito de leitura, que ao menos faz `console.warn` (linha 136), é real. Observo, porém, que auditLogger.js:22-31 já envolve o `setItem` em try/catch e devolve `null` sem rejeitar, então o QuotaExceededError descrito no cenário é capturado lá dentro e apenas logado — o catch vazio pega falha de import/rede. Rebaixo para baixo: o log é local e não é consumido em nenhuma tela (item 248), então o dano prático é pequeno.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0455 · BAIXO · `CONFIRMAR-SCHEMA`

**Data de nascimento impressa no prontuário em formato ISO (aaaa-mm-dd) em documento brasileiro**

**Onde:** `src/components/ClinicalHistory.jsx:202`

**O defeito:** `clinicalProfile.birthDate` vem cru da coluna `birth_date` (supabaseService.js:580 `birthDate: data.birth_date || ''`), no formato ISO. O componente imprime o valor sem formatação, ao contrário de Dashboard.jsx:750, que faz `new Date(clinicalProfile.birthDate + 'T00:00:00').toLocaleDateString('pt-BR')`.

**Como falha:** Paciente nascido em 10/05/1980 exporta o prontuário: o cabeçalho oficial (padrão CFM citado no comentário da linha 182) sai com 'Nascimento: 1980-05-10'. Em um documento clínico brasileiro isso é ambíguo e inconsistente com o resto do app, que mostra a data em pt-BR.

**Código atual:**

```jsx
<p><strong>Nascimento:</strong> {clinicalProfile?.birthDate || 'Não informada'}</p>
```

**Correção sugerida:** Aplicar `new Date(clinicalProfile.birthDate + 'T00:00:00').toLocaleDateString('pt-BR')`, como já faz o Dashboard.

<details><summary>Verificação feita contra o código</summary>

A linha 202 imprime `{clinicalProfile?.birthDate || 'Não informada'}` sem formatação, dentro do cabeçalho print-only. Confirmei que o valor é ISO pelo tratamento em Dashboard.jsx:750, que precisa concatenar `'T00:00:00'` antes do `toLocaleDateString('pt-BR')` — o que só faz sentido para `aaaa-mm-dd`. A inconsistência com o resto do app é real. Rebaixo de médio para baixo: o formato ISO é internacionalmente não ambíguo, o dado está correto e o efeito é estético/padronização, não erro clínico.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0456 · BAIXO · `CONFIRMADO`

**Botão da tela vazia 'Fazer Primeira Triagem Agora' nunca é renderizado (prop setActiveTab nunca é passada)**

**Onde:** `src/components/ClinicalHistory.jsx:256`

**O defeito:** O CTA da tela vazia está condicionado a `setActiveTab &&`, mas App.jsx:838 renderiza `<ClinicalHistory entries={entries} clinicalProfile={clinicalProfile} />` sem `setActiveTab`. Confirmei por grep que esta é a única renderização do componente no projeto. O ramo é inalcançável.

**Como falha:** Paciente recém-cadastrado abre 'Histórico', lê 'Realize a sua primeira avaliação de pele ou sintomas...' e não recebe nenhum botão de ação — a tela é um beco sem saída, ele precisa descobrir sozinho onde fica a triagem no menu.

**Código atual:**

```jsx
          {setActiveTab && (
            <button
              onClick={() => setActiveTab('triage')}
```

**Correção sugerida:** Passar `setActiveTab={setActiveTab}` na renderização de App.jsx:838 (corrigindo junto o destino, ver item 261).

<details><summary>Verificação feita contra o código</summary>

A guarda `{setActiveTab && (` existe na linha 256 e o grep por `<ClinicalHistory` retornou uma única ocorrência, App.jsx:838, sem a prop. `setActiveTab` fica undefined, o ramo nunca renderiza e a tela vazia (linhas 244-265) termina no parágrafo da linha 253 sem ação. Rebaixo de médio para baixo: o impacto é uma affordance ausente numa tela de estado vazio — o usuário ainda tem a triagem disponível no menu lateral e na barra inferior (App.jsx:1270, 1629, 1829). É um beco sem saída de UX, não um defeito clínico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0457 · BAIXO · `CONFIRMADO`

**CTA da tela vazia navega para a aba inexistente 'triage' (tela em branco)**

**Onde:** `src/components/ClinicalHistory.jsx:258`

**O defeito:** O handler chama `setActiveTab('triage')`. 'triage' não é um dos cases do switch de App.jsx (as abas válidas são doctor-dashboard, dashboard, upload, telemedicine, chat, my-appointments, appointments, my_network, doctors_directory, documents, history, nurses, admin-*, doctor-*, protocols, prescriptions, profile). A tela de triagem é 'upload'.

**Como falha:** Se a prop setActiveTab passar a ser fornecida (ou em qualquer reuso do componente), clicar em '📷 Fazer Primeira Triagem Agora' muda activeTab para 'triage', o switch cai no default e o usuário fica em uma área de conteúdo em branco, sem forma óbvia de voltar.

**Código atual:**

```jsx
onClick={() => setActiveTab('triage')}
```

**Correção sugerida:** Trocar `setActiveTab('triage')` por `setActiveTab('upload')`.

<details><summary>Verificação feita contra o código</summary>

O handler da linha 258 chama `setActiveTab('triage')` e confirmei por grep em App.jsx que não existe `case 'triage'` no switch — a aba de triagem é `'upload'` (App.jsx:780, com os itens de navegação em 1270/1629/1829). O identificador está objetivamente errado. Rebaixo de médio para baixo porque, hoje, o ramo é inalcançável (item 260): é um bug latente que só se manifesta quando alguém adicionar a prop, e a correção é a mesma linha.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0458 · BAIXO · `CONFIRMADO`

**Listas da timeline usam key={index} sobre um array revertido e crescente, embaralhando o estado dos cards**

**Onde:** `src/components/ClinicalHistory.jsx:360`

**O defeito:** A timeline inverte a ordem (`entries.slice().reverse()`) e usa o índice como key. Como novas entradas são adicionadas ao FIM de `entries` (App.jsx:731 `setEntries((prev) => [...prev, newEntry])`), após a inversão o novo registro assume key=0 e todos os demais deslocam. Cada card contém um `WoundTissueOverlay` com estado local (`hoveredTissue`) e um `<canvas>` (DOM imperativo), que React reaproveita na posição errada.

**Como falha:** Paciente está com o mouse sobre a foto da avaliação mais recente (tooltip 'Necrose: 30%' visível) e, nesse instante, o polling de 30 s traz uma nova avaliação. Com as keys deslocadas, o tooltip e o canvas do card antigo passam a ser exibidos sobre o card da nova entrada, mostrando percentuais teciduais que pertencem a outra avaliação.

**Código atual:**

```jsx
{entries.slice().reverse().map((entry, idx) => (
              <div key={idx} className="glass-card glass-card-cyan-glow"
```

**Correção sugerida:** Usar `key={entry.id ?? entry.date + idx}` em vez do índice nas três listas mapeadas.

<details><summary>Verificação feita contra o código</summary>

A linha 360 faz `entries.slice().reverse().map((entry, idx) => ... key={idx}`, e confirmei que a ordem cresce no fim: supabaseService.js:862 ordena `.order('id', { ascending: true })` e App.jsx:731 faz `setEntries((prev) => [...prev, newEntry])`. Logo, uma entrada nova desloca todas as keys. Refuto, porém, a parte do canvas: `WoundTissueOverlay` redesenha em `useEffect(..., [entry])` (linha 53), então o desenho acompanha o novo prop corretamente. O que de fato vaza é o estado local `hoveredTissue` (linha 6), que permanece no card reaproveitado e exibe percentuais de outra avaliação. Efeito real, porém transitório e só durante o hover — daí médio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0459 · BAIXO · `VERIFICAR`

**onError da foto pode entrar em laço infinito de requisições quando a imagem de fallback também falha**

**Onde:** `src/components/ClinicalHistory.jsx:401`

**O defeito:** O handler reatribui `e.target.src` para uma URL remota sem nenhuma flag de guarda (ex.: `if (e.target.dataset.fallback) return;`). Se o fallback também falhar, o próprio `onError` dispara novamente e reatribui o mesmo src, reiniciando o carregamento.

**Como falha:** Paciente abre 'Histórico' offline (o app é PWA com service worker e roda em Capacitor): a foto local falha, o handler aponta para images.unsplash.com, que também falha por falta de rede, e o ciclo se repete indefinidamente para cada card da timeline. O resultado é consumo contínuo de CPU/rede e travamento perceptível da rolagem em prontuários com muitos registros.

**Código atual:**

```jsx
e.target.src = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&auto=format&fit=crop&q=60';
```

**Correção sugerida:** Guardar o estado antes de trocar: `if (e.target.dataset.fallbackApplied) return; e.target.dataset.fallbackApplied = '1';`.

<details><summary>Verificação feita contra o código</summary>

O handler das linhas 400-402 realmente reatribui `e.target.src` para a URL remota sem flag de guarda (nenhum `dataset`, `onError = null` ou comparação com o src atual), então uma nova falha volta a disparar o mesmo onError — a estrutura do laço existe e é indiscutível. O que não consigo confirmar sem executar é a severidade do ciclo: navegadores aplicam cache negativo e throttling em requisições que falham repetidamente para a mesma URL, e o algoritmo de atualização de imagem pode abortar quando a URL é idêntica, de modo que o 'consumo contínuo de CPU/rede e travamento da rolagem' descrito pode não se materializar. Marco PLAUSIVEL, severidade baixa.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0559 · BAIXO · `CONFIRMADO`

**Prop patientId é recebida e nunca usada: telemetria mostra os mesmos valores para qualquer paciente**

**Onde:** `src/components/VitalsTelemetry.jsx:3`

**O defeito:** O componente declara `patientId` na assinatura, mas confirmei por grep que o identificador não aparece mais nenhuma vez no arquivo. Não há fetch, nem filtro, nem chave de estado ligada ao paciente. Todos os valores vêm de `useState` com literais fixos (linhas 8-24) ou de `Math.random()` (linhas 31-46).

**Como falha:** Em uma visão de médico com dois pacientes (A e B), o componente é montado com patientId=A e depois patientId=B: os dois exibem exatamente 72 BPM, 120/80 mmHg, SpO2 98%, 36.6°C e glicemia 95 mg/dL. O médico interpreta dados de telemetria como se pertencessem ao paciente selecionado, quando não pertencem a ninguém.

**Código atual:**

```jsx
export default function VitalsTelemetry({ patientId, isDoctorView = false }) {
```

**Correção sugerida:** Remover a prop `patientId` da assinatura ou usá-la para buscar as leituras reais do paciente antes de renderizar valores.

<details><summary>Verificação feita contra o código</summary>

Grep por `patientId` no arquivo retorna uma única ocorrência: a própria assinatura na linha 3. Não há useEffect, fetch, filtro ou chave de estado ligada ao paciente; vitals e temperatures vêm de literais (linhas 8-24) e de Math.random() (31-46). O fato é exato. Porém o cenário descrito ('médico com dois pacientes A e B') é hoje inalcançável: grep confirma que VitalsTelemetry não é importado por nenhum arquivo, então nenhum chamador passa patientId. Severidade rebaixada de alto para baixo — é prop morta em componente morto, não um erro de dados exibido a alguém.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0560 · BAIXO · `CONFIRMADO`

**Prop isDoctorView é declarada e nunca utilizada: visão do médico é idêntica à do paciente**

**Onde:** `src/components/VitalsTelemetry.jsx:3`

**O defeito:** `isDoctorView` aparece somente na assinatura do componente (confirmado por leitura integral e grep no arquivo). Nenhuma renderização, permissão, texto ou ação é condicionada a ela. A intenção do chamador de diferenciar a visão clínica é silenciosamente ignorada.

**Como falha:** Um chamador renderiza `<VitalsTelemetry patientId={p.id} isDoctorView />` esperando uma visão clínica (por exemplo, sem a orientação de autocuidado 'Evite caminhar excessivamente e consulte seu médico', que é dirigida ao paciente). O médico recebe exatamente a mesma tela do paciente, incluindo essa orientação em primeira pessoa.

**Código atual:**

```jsx
export default function VitalsTelemetry({ patientId, isDoctorView = false }) {
```

**Correção sugerida:** Remover a prop ou condicionar a ela os textos de autocuidado dirigidos ao paciente.

<details><summary>Verificação feita contra o código</summary>

Grep por `isDoctorView` no arquivo retorna somente a linha 3 (a assinatura). Nenhuma renderização, texto ou permissão é condicionada a ela — inclusive a orientação em primeira pessoa 'Evite caminhar excessivamente e consulte seu médico' (linha 203) é incondicional. Fato correto. Mas o cenário exige um chamador que passe `isDoctorView`, e não existe chamador algum (o componente não é importado em lugar nenhum). Severidade reduzida de médio para baixo: prop morta em componente morto.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0561 · BAIXO · `CONFIRMADO`

**Valores iniciais hardcoded são apresentados como leitura atual antes de qualquer sincronização**

**Onde:** `src/components/VitalsTelemetry.jsx:8`

**O defeito:** O estado inicial contém valores clínicos plausíveis fixos (72 BPM, 120/80 mmHg, SpO2 98%, 36.6°C, glicemia 95 mg/dL) e temperaturas plantares fixas. Não há flag de 'nunca sincronizado', nem timestamp de coleta: a UI renderiza esses números exatamente como renderizaria uma medição real.

**Como falha:** Ao abrir a telemetria pela primeira vez, sem nunca clicar em 'Sincronizar', o paciente vê '❤️ Batimentos 72 BPM — Normal', '🩺 Pressão Arterial 120/80 mmHg — Normal' e 'Glicemia (Jejum) 95 mg/dL — Estável'. Nenhum desses valores foi medido; não há data/hora da coleta em nenhum card. Um paciente hipertenso pode concluir que sua pressão está controlada.

**Código atual:**

```jsx
  const [vitals, setVitals] = useState({
    heartRate: 72,
    bloodPressure: '120/80',
    spo2: 98,
```

**Correção sugerida:** Iniciar os cards com '--' e exigir uma sincronização antes de exibir qualquer número, mostrando o horário da coleta.

<details><summary>Verificação feita contra o código</summary>

O useState das linhas 8-14 traz 72 BPM, '120/80', 98%, 36.6°C e 95 mg/dL, e os cards das linhas 146-183 renderizam esses números sem nenhum indicador de 'nunca sincronizado' nem timestamp de coleta. O fato é exato. Porém existe uma guarda parcial que o auditor não ponderou: a nota de transparência da linha 273, no mesmo card, declara explicitamente que os valores vitais exibidos são simulações. Isso enfraquece o cenário do 'paciente hipertenso'. Somando à inalcançabilidade da tela, reduzo de médio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0562 · BAIXO · `CONFIRMADO`

**setTimeout do Sincronizar não tem cleanup: setState após desmontagem e timer não cancelável**

**Onde:** `src/components/VitalsTelemetry.jsx:28`

**O defeito:** `handleSync` cria um `setTimeout` de 1000ms que chama três setters de estado, sem guardar o id em ref e sem nenhum `useEffect` de cleanup que o cancele na desmontagem. Também não há como abortar a sincronização já iniciada.

**Como falha:** Usuário clica em 'Sincronizar' e imediatamente troca de aba/paciente, desmontando o componente. 1 segundo depois, `setSyncing(false)`, `setVitals(...)` e `setTemperatures(...)` executam sobre um componente desmontado. Ao remontar, o botão volta ao estado inicial e a leitura solicitada é perdida — o usuário fica sem saber se a sincronização ocorreu.

**Código atual:**

```jsx
  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
```

**Correção sugerida:** Guardar o id em `useRef` e limpá-lo em `useEffect(() => () => clearTimeout(ref.current), [])`.

<details><summary>Verificação feita contra o código</summary>

handleSync (linhas 26-48) cria um setTimeout de 1000ms que chama setSyncing/setVitals/setTemperatures, sem guardar o id em ref e sem nenhum useEffect de cleanup no arquivo (o único import de React é `useState`, linha 1). O fato é exato. Mas o impacto descrito é modesto: em React 18+ o setState em componente desmontado não gera warning nem vazamento além de 1 segundo, e o pior efeito real é a leitura solicitada se perder. Severidade reduzida de médio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0563 · BAIXO · `CONFIRMADO`

**Limiar clínico de 2.0°C é avaliado sobre valor arredondado, deslocando o gatilho para 1.95°C**

**Onde:** `src/components/VitalsTelemetry.jsx:50`

**O defeito:** As diferenças são convertidas em string com `toFixed(1)` antes de serem comparadas com 2.0 via `parseFloat`. O arredondamento a uma casa decimal faz com que 1.95-1.99 se tornem '2.0' e disparem o alerta, e que 2.00-2.04 também apareçam como '2.0'. A decisão clínica passa a depender do arredondamento de exibição, e não do valor medido.

**Como falha:** Sensor mede leftPlantar 32.00 e rightPlantar 33.96 (diferença real 1.96°C, abaixo do limiar): `toFixed(1)` produz '2.0', `parseFloat('2.0') >= 2.0` é verdadeiro e o alerta crítico de risco de ulceração é disparado indevidamente, com o texto afirmando 'variação de 2.0°C' — valor que nunca foi medido.

**Código atual:**

```jsx
const diffToe = Math.abs(temperatures.leftToe - temperatures.rightToe).toFixed(1);
  const diffPlantar = Math.abs(temperatures.leftPlantar - temperatures.rightPlantar).toFixed(1);
```

**Correção sugerida:** Guardar as diferenças como números (`const diffPlantarNum = Math.abs(...)`) para a comparação e usar `toFixed(1)` somente na exibição.

<details><summary>Verificação feita contra o código</summary>

As linhas 50-52 aplicam `.toFixed(1)` (produzindo string) e a linha 54 faz `parseFloat(...) >= 2.0`, ou seja, a decisão clínica é tomada sobre o valor de exibição arredondado — 1.95-1.99 viram '2.0' e disparam o alerta. A análise é tecnicamente correta. Severidade reduzida de médio para baixo: o erro é de meio décimo de grau, o ramo é inalcançável com os dados simulados atuais e o componente não é montado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0564 · BAIXO · `CONFIRMADO`

**Selo '● Dispositivos Pareados' é sempre exibido e contradiz a nota de transparência do próprio componente**

**Onde:** `src/components/VitalsTelemetry.jsx:85`

**O defeito:** O indicador verde de status é renderizado incondicionalmente, sem checar nenhum estado de dispositivo (não existe nenhuma variável de pareamento no componente). Ao mesmo tempo, a nota do rodapé (linha 273) afirma que 'não possui sensores de IoT ou eletrodos de ECG acoplados fisicamente neste dispositivo'.

**Como falha:** Qualquer usuário que abra a telemetria vê, no topo, um selo verde afirmando '● Dispositivos Pareados' junto de valores de batimentos e saturação. A informação de status é falsa e contradiz o aviso no rodapé da mesma caixa; o usuário tende a confiar no indicador visual e tratar os números como leituras reais do seu corpo.

**Código atual:**

```jsx
            ● Dispositivos Pareados
          </span>
```

**Correção sugerida:** Trocar o texto fixo por '● Modo demonstração (sem dispositivos)' ou condicionar o selo a um estado real de pareamento.

<details><summary>Verificação feita contra o código</summary>

O selo (linhas 76-86) é renderizado incondicionalmente, com cor de sucesso, e não existe nenhum estado de pareamento no componente (os únicos useState são activeSubTab, syncing, vitals e temperatures). A contradição com a nota da linha 273 ('não possui sensores de IoT... são simulações clínicas') é real. Severidade reduzida de médio para baixo: o desmentido está no mesmo card, poucos pixels abaixo, o que mitiga bastante o risco de interpretação, e a tela é inalcançável.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0565 · BAIXO · `CONFIRMADO`

**Spinner de 'Sincronizando...' não anima: a animação 'spin' não está declarada em escopo global**

**Onde:** `src/components/VitalsTelemetry.jsx:95`

**O defeito:** O elemento usa `animation: 'spin 0.8s linear infinite'`, mas não existe `@keyframes spin` em src/index.css (as keyframes globais são apenas sosPulseGlow, fadeIn, bounce e pulse-ring). A regra `@keyframes spin` só existe dentro de tags `<style>` locais de outros componentes: App.jsx:960 (dentro do early-return da tela de carregamento, que é desmontada assim que o app carrega), LocalResourcesPanel.jsx:301 e ProtocolGuide.jsx:1198. VitalsTelemetry não declara nenhuma.

**Como falha:** Usuário clica em 'Sincronizar': durante 1 segundo o botão mostra 'Sincronizando...' ao lado de um círculo parado (borda com topo transparente, sem rotação), a menos que por coincidência LocalResourcesPanel ou ProtocolGuide estejam montados na mesma página. O feedback de carregamento parece um defeito visual/travamento.

**Código atual:**

```jsx
<span className="spinner" style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '4px' }} />
```

**Correção sugerida:** Declarar `@keyframes spin` uma única vez em src/index.css (e remover as duplicatas locais).

<details><summary>Verificação feita contra o código</summary>

A linha 95 usa `animation: 'spin 0.8s linear infinite'`. Grep por `keyframes spin` em todo o src/ retorna apenas App.jsx:960, LocalResourcesPanel.jsx:301 e ProtocolGuide.jsx:1198 — nenhum em index.css e nenhum no próprio VitalsTelemetry. Como essas três declarações estão em `<style>` locais, a animação só existe enquanto um daqueles componentes estiver montado, o que não é garantido. Mantenho baixo: é puramente visual.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0566 · BAIXO · `CONFIRMAR-SCHEMA`

**Sub-abas da telemetria não são acessíveis: sem role de tab e sem estado anunciável**

**Onde:** `src/components/VitalsTelemetry.jsx:107`

**O defeito:** Os dois botões que alternam entre 'Sinais Vitais Gerais' e 'Temperatura Local (Plantar)' são `<button>` puros, sem `role="tab"`, `aria-selected` ou `aria-controls`, e os painéis condicionais (linhas 142 e 189) não têm `role="tabpanel"`. O único indicativo de qual aba está ativa é a cor de fundo (`backgroundColor: activeSubTab === 'vitals' ? 'var(--primary)' : 'transparent'`).

**Como falha:** Usuário de leitor de tela percorre os dois botões e ambos são anunciados apenas como 'botão', sem indicação de qual está selecionado. Após acionar um deles, nada é anunciado sobre a troca de conteúdo; o usuário não tem como saber se está vendo sinais vitais ou temperatura plantar.

**Código atual:**

```jsx
        <button
          onClick={() => setActiveSubTab('vitals')}
```

**Correção sugerida:** Envolver os botões em `role="tablist"` e adicionar `role="tab"`, `aria-selected` e `aria-controls`/`role="tabpanel"` nos painéis.

<details><summary>Verificação feita contra o código</summary>

Os botões das linhas 107-139 são `<button>` sem `role="tab"`, `aria-selected` ou `aria-controls`, e os painéis condicionais das linhas 142 e 189 não têm `role="tabpanel"`. A única distinção do estado ativo é `backgroundColor: activeSubTab === 'vitals' ? 'var(--primary)' : 'transparent'` (linha 116) — informação apenas visual. Severidade baixo está proporcional.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0567 · BAIXO · `CONFIRMADO`

**Mensagem de segurança térmica afirma limiar de 1.0°C enquanto o código usa 2.0°C**

**Onde:** `src/components/VitalsTelemetry.jsx:215`

**O defeito:** O ramo 'seguro' é exibido sempre que nenhuma diferença atinge 2.0°C (linha 54), porém o texto afirma que a diferença é menor que 1.0°C e chama isso de 'Limiar clínico seguro'. As duas informações são incompatíveis: existe toda a faixa 1.0-1.99°C em que a mensagem é factualmente falsa.

**Como falha:** Com diffPlantar = 1.8°C (assimetria clinicamente relevante e muito próxima do limiar de risco de ulceração), a tela exibe uma caixa verde afirmando 'Distribuição térmica equilibrada. Diferença térmica menor que 1.0°C (Limiar clínico seguro)'. O paciente diabético é tranquilizado com um dado falso justamente na faixa em que deveria procurar atendimento.

**Código atual:**

```jsx
✅ Distribuição térmica equilibrada. Diferença térmica menor que 1.0°C (Limiar clínico seguro).
```

**Correção sugerida:** Interpolar a maior diferença efetivamente calculada na frase, ou ajustar o texto para 'menor que 2.0°C (limiar clínico de alerta)'.

<details><summary>Verificação feita contra o código</summary>

O ramo verde (linhas 205-216) é o `else` de `hasCriticalAsymmetry`, que só é true a partir de 2.0°C (linha 54), mas o texto da linha 215 diz 'Diferença térmica menor que 1.0°C (Limiar clínico seguro)'. A incoerência textual existe. Contudo, com as faixas simuladas atuais a diferença máxima possível é 0.7°C (ver item 251), então a faixa 1.0-1.99°C em que a frase seria factualmente falsa é hoje inalcançável — a falha é uma inconsistência de texto, não um dado errado exibido. Severidade reduzida de médio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0568 · BAIXO · `CONFIRMADO`

**Nota de transparência usa cor fixa #f59e0b em 10px, com contraste insuficiente e sem adaptação ao tema**

**Onde:** `src/components/VitalsTelemetry.jsx:269`

**O defeito:** O aviso mais importante da tela (informar que os valores são simulados) usa `color: '#f59e0b'` hardcoded sobre `backgroundColor: 'rgba(245, 158, 11, 0.06)'` com `fontSize: '10px'`. Como o app tem tema claro e escuro (variáveis definidas em src/index.css:9-30 e :67-70), a cor fixa não se ajusta: sobre o fundo claro o âmbar #f59e0b fica com razão de contraste em torno de 2:1, muito abaixo do mínimo de 4.5:1 para texto pequeno.

**Como falha:** Usuário idoso (público-alvo do modo acessível do app) abre a telemetria no tema claro: o aviso de que os valores vitais são simulações fica praticamente ilegível em amarelo claro de 10px. Ele então interpreta os números de batimentos, pressão e glicemia como medições reais suas.

**Código atual:**

```jsx
        fontSize: '10px',
        color: '#f59e0b',
```

**Correção sugerida:** Usar `var(--warning)`/`var(--text-primary)` com pelo menos 12px, garantindo contraste ≥4.5:1 nos dois temas.

<details><summary>Verificação feita contra o código</summary>

As linhas 262-274 confirmam `fontSize: '10px'`, `color: '#f59e0b'` hardcoded e `backgroundColor: 'rgba(245, 158, 11, 0.06)'` — o único texto do arquivo que não usa variável de tema. Como o fundo efetivo é praticamente `var(--bg-secondary)` (o overlay âmbar tem apenas 6% de opacidade), no tema claro o âmbar #f59e0b sobre branco fica em torno de 2:1, abaixo dos 4.5:1 exigidos para texto pequeno. É justamente o aviso que informa que os valores são simulados. Mantenho baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0569 · BAIXO · `CONFIRMAR-SCHEMA`

**Selects de escolha de foto sem associação com o label e botão de fechar sem nome acessível**

**Onde:** `src/components/WoundEvolutionComparator.jsx:112`

**O defeito:** Os dois `<label>` (linhas 112 e 138) não têm `htmlFor` e os `<select>` (linhas 115 e 141) não têm `id` nem `aria-label`, e o label não envolve o campo. O botão de fechar (linha 91) tem como conteúdo apenas o glifo '✖', sem `aria-label`, e o overlay não tem `role="dialog"`/`aria-modal`.

**Como falha:** Usuário de leitor de tela navega pelo comparador: os dois combobox são anunciados apenas como 'caixa de combinação' sem indicar qual é a foto anterior e qual é a atual, e o botão de fechar é anunciado como 'botão' (ou pelo nome do emoji), impossibilitando saber que ele fecha o modal.

**Código atual:**

```jsx
<label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            📷 SELECIONE FOTO ANTERIOR (PONTO DE PARTIDA):
          </label>
          <select
            value={indexA}
```

**Correção sugerida:** Dar `id` aos dois selects com `htmlFor` correspondente nos labels, `aria-label="Fechar comparador"` no botão ✖ e `role="dialog" aria-modal="true"` no overlay.

<details><summary>Verificação feita contra o código</summary>

Li os trechos: os `<label>` das linhas 112 e 138 não têm `htmlFor` e não envolvem os campos; os `<select>` das linhas 115 e 141 não têm `id` nem `aria-label`; o botão das linhas 91-97 tem como único conteúdo o glifo '✖' sem `aria-label`; e o overlay das linhas 362-375 não declara `role="dialog"`/`aria-modal`. Todos os fatos batem. Severidade reduzida de médio para baixo: barreira de acessibilidade real, porém em tela que nenhum usuário consegue abrir hoje.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0570 · BAIXO · `CONFIRMAR-SCHEMA`

**Área inalterada é reportada como 'Aumento de 0 cm²' com status clínico vermelho**

**Onde:** `src/components/WoundEvolutionComparator.jsx:181`

**O defeito:** `areaDiff` é a string retornada por `toFixed(1)`. Quando a diferença é zero, o valor é '0.0'; a comparação `'0.0' > 0` é falsa, então o ramo de 'Aumento' é escolhido. Em paralelo, `isHealing = parseFloat(percentReduction) > 0` também é falso, pintando todo o banner de vermelho. Nada impede o usuário de selecionar a MESMA entrada nos dois selects (não há validação entre indexA e indexB).

**Como falha:** Usuário seleciona a mesma avaliação em 'FOTO ANTERIOR' e 'FOTO ATUAL' (ou compara duas avaliações com a mesma área). O painel exibe borda vermelha, '🔺 +0%', 'Aumento de 0 cm²' e 'STATUS CLÍNICO: 🔴 Necessita Revisão de Conduta' — um alerta clínico de piora onde não houve variação alguma.

**Código atual:**

```jsx
{areaDiff > 0 ? `Diminuição de ${areaDiff} cm²` : `Aumento de ${Math.abs(areaDiff)} cm²`}
```

**Correção sugerida:** Comparar numericamente (`const diffNum = areaA - areaB`) e tratar explicitamente o caso `diffNum === 0` como 'Área inalterada', com banner neutro.

<details><summary>Verificação feita contra o código</summary>

`areaDiff` é string (linha 54, `.toFixed(1)`). Para diferença nula vale '0.0'; a coerção em `'0.0' > 0` dá false (linha 181), caindo em `Aumento de ${Math.abs('0.0')}` = 'Aumento de 0 cm²'. Em paralelo, percentReduction = '0.0' e `isHealing = parseFloat('0.0') > 0` é false (linha 58), pintando o banner com borda #ef4444 e o status '🔴 Necessita Revisão de Conduta' (linhas 170-171, 197-198). Confirmei também que não há validação impedindo indexA === indexB (selects das linhas 115 e 141 listam todas as entradas sem restrição). Severidade reduzida de médio para baixo: é um caso de borda cosmético/textual em componente inalcançável.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0571 · BAIXO · `CONFIRMADO`

**Evolução da dor exibe '📉 -0 Níveis' em verde quando não houve mudança**

**Onde:** `src/components/WoundEvolutionComparator.jsx:188`

**O defeito:** A condição `painDiff >= 0` inclui o zero no ramo de melhora, e o texto é montado com o prefixo fixo '-'. Não há tratamento para diferença nula.

**Como falha:** Paciente relatou dor 5/10 nas duas avaliações comparadas. O painel mostra em verde '📉 -0 Níveis' e, abaixo, 'De 5/10 para 5/10'. O texto sugere redução da dor onde não houve nenhuma alteração.

**Código atual:**

```jsx
{painDiff >= 0 ? `📉 -${painDiff} Níveis` : `📈 +${Math.abs(painDiff)} Níveis`}
```

**Correção sugerida:** Adicionar um terceiro ramo para `painDiff === 0` exibindo 'Dor inalterada' em cor neutra.

<details><summary>Verificação feita contra o código</summary>

Linha 187 pinta de verde com `painDiff >= 0` e a linha 188 monta o texto com o prefixo literal '-': `📉 -${painDiff} Níveis`. Com painDiff = 0 sai '📉 -0 Níveis' em verde, seguido de 'De 5/10 para 5/10' (linha 191). Não há ramo para diferença nula. Fato exato; impacto textual pequeno. Baixo está proporcional.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "ClinicalHistory.jsx|VitalsTelemetry.jsx|WoundEvolutionComparator.jsx"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
