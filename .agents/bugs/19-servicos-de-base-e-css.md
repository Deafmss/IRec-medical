# 19. Serviços de base e CSS

**37 defeitos** — 0 crítico · 9 alto · 15 médio · 13 baixo

Arquivos tocados por este módulo:

- `src/components/IRecConceptDesign.jsx`
- `src/index.css`
- `src/services/auditLogger.js`
- `src/services/fhirService.js`
- `src/utils/speechUtils.js`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0162 · ALTO · `CONFIRMAR-SCHEMA`

**outline: none global sem nenhum estilo de foco: teclado fica sem indicador visível em todo o app**

**Onde:** `src/index.css:125`

**O defeito:** A regra base remove o outline de input, button, textarea e select em todo o app, e não existe nenhuma regra :focus ou :focus-visible no arquivo (grep por ':focus' em src/index.css retorna zero ocorrências). Como o app não usa router e toda a navegação é feita por <button>, um usuário de teclado perde completamente a referência de onde está. O problema é agravado por `.premium-checkbox-input { appearance: none; outline: none; }` (linhas 763-776), que remove também o checkbox nativo sem substituto de foco.

**Como falha:** Paciente com deficiência motora que usa teclado/switch abre o formulário de triagem clínica, pressiona Tab várias vezes e não vê nada mudar na tela. Ele não consegue saber em qual campo (dor, exsudato, odor) está e preenche o prontuário com dados no campo errado, ou desiste.

**Código atual:**

```jsx
input, button, textarea, select {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  outline: none;
}
```

**Correção sugerida:** Adicionar `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }` para inputs, botões, selects e para .premium-checkbox-input.

<details><summary>Verificação feita contra o código</summary>

index.css:121-126 confirma a regra `input, button, textarea, select { ... outline: none; }` sem seletor de estado. Grep por ':focus' em src/index.css retorna ZERO ocorrências — não há :focus, :focus-visible nem :focus-within em nenhum lugar do arquivo. Como toda a navegação do app é feita por <button> (não há router), o usuário de teclado/switch perde completamente a referência de posição. Nenhuma guarda: não há box-shadow de foco substituto.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0163 · ALTO · `CONFIRMAR-SCHEMA`

**@media print não isola o conteúdo do modal: impressão da receita inclui o dashboard e o prontuário de fundo**

**Onde:** `src/index.css:837`

**O defeito:** PrescriptionGeneratorModal.jsx:84 e ReportPDFGenerator.jsx:47 chamam window.print() enquanto o documento é renderizado dentro de um overlay position:fixed (PrescriptionGeneratorModal.jsx:520-538). O bloco @media print esconde apenas sidebar, navs, .btn, .badge, .no-print, select e input[type=range]; nada esconde o conteúdo do `main`/`.main-content` que está atrás do modal, e não há @page nem uma classe de área imprimível. Elementos fixed são impressos só na primeira página, enquanto o conteúdo de fluxo continua nas páginas seguintes.

**Como falha:** Médico está com o prontuário do paciente A aberto no dashboard e emite uma receita no modal. Ao imprimir, a página 1 sai com a receita sobreposta ao dashboard e as páginas 2, 3... saem com o histórico de lesões, fotos e dados clínicos do paciente. Esse material é entregue impresso ao paciente ou à farmácia, expondo dados clínicos que não deveriam constar na receita.

**Código atual:**

```jsx
@media print {
  ...
  .sidebar, .bottom-nav, .mobile-header, .btn, .badge, .no-print, select, input[type="range"], .sidebar-logo { display: none !important; }
  /* nenhuma regra esconde o conteúdo de .main-content atrás do modal fixed */
```

**Correção sugerida:** Adicionar no @media print `body > *:not(.print-area) { display: none !important; }` (ou visibility/position estático em uma classe .print-area) para imprimir apenas o conteúdo do documento.

<details><summary>Verificação feita contra o código</summary>

index.css:837-865 confirma que o bloco @media print esconde apenas .sidebar, .bottom-nav, .mobile-header, .btn, .badge, .no-print, select, input[type=range] e .sidebar-logo. Não há @page, não há classe de área imprimível, nem regra que esconda .main-content ou o conteúdo de fundo. Confirmei que PrescriptionGeneratorModal.jsx:84 chama window.print() com o modal renderizado dentro de um overlay `position: fixed` com zIndex 999999 (linhas ~519-537), e ReportPDFGenerator.jsx:47 faz o mesmo. Elementos fixed imprimem só na primeira página enquanto o conteúdo em fluxo atrás continua nas seguintes, então o material clínico de fundo realmente sai impresso junto com a receita.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0164 · ALTO · `CONFIRMADO`

**@media print não zera o padding-left de 260px do .app-container: documento impresso sai deslocado e cortado**

**Onde:** `src/index.css:856`

**O defeito:** Em telas/páginas com largura >= 768px vale `.app-container { padding-left: 260px }` (linha 260). Uma media query sem tipo de mídia também vale para print, e a página A4 tem ~794px CSS, portanto a regra continua ativa na impressão. O bloco @media print esconde a `.sidebar` e força `.app-container { display: block; min-height: auto }` (linhas 856-859), mas nunca redefine padding-left. Todo o conteúdo impresso permanece empurrado 260px (~6,9cm) para a direita.

**Como falha:** Médico gera uma receita/relatório no desktop e clica em imprimir. A pré-visualização mostra o texto deslocado para a direita, com a margem direita cortando o CRM, a assinatura e o final das prescrições. A receita entregue ao paciente sai truncada.

**Código atual:**

```jsx
  .app-container {
    display: block !important;
    min-height: auto !important;
  }   /* falta: padding-left: 0 !important; — definido como 260px na linha 260 */
```

**Correção sugerida:** Acrescentar `padding-left: 0 !important;` (e `padding-right: 0 !important`) à regra .app-container dentro do bloco @media print.

<details><summary>Verificação feita contra o código</summary>

Confirmei as duas pontas. index.css:256-262: `@media (min-width: 768px) { .app-container { padding-left: 260px; } }` — media query sem tipo, portanto também vale para print, e a página A4 tem ~794px CSS. index.css:856-859: o bloco @media print redefine apenas `display: block !important` e `min-height: auto !important` no .app-container; `.main-content` zera o próprio padding (861-865) mas nada zera o padding-left do container pai. Não há regra posterior que corrija. Todo o conteúdo impresso permanece deslocado 260px.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0165 · ALTO · `CONFIRMADO`

**Duas barras de navegação inferiores renderizam juntas; a de paciente cobre a de médico/admin no celular**

**Onde:** `src/index.css:1013`

**O defeito:** App.jsx renderiza DOIS rodapés de navegação: `.mobile-bottom-nav` (linha 1617, sempre, com itens fixos de paciente: Início / Nova Foto / Histórico / Mais) e `.bottom-nav` (linha 1740, com os itens corretos por papel: Admin, Meu Painel, Pacientes...). No CSS, `.bottom-nav` só é escondida em min-width:768px (linha 269), portanto no celular ela existe em bottom:0 com 70px e z-index 1000; `.mobile-bottom-nav` também fica em bottom:0 com 62px, fundo opaco e z-index 99999 (linha 1026). O resultado é a barra de paciente sobreposta e opaca em cima da barra correta do papel, deixando visíveis apenas ~8px da barra de baixo.

**Como falha:** Médico faz login no celular. Ele vê apenas "Início / Nova Foto / Histórico / Mais" (navegação de paciente) e não consegue tocar em "Meu Painel" nem em "Pacientes", que estão soterrados sob a barra opaca de z-index 99999. Além disso, no Modo Fácil (acessível) o App.jsx esconde propositalmente a `.bottom-nav` (condição da linha 1739) mas a `.mobile-bottom-nav` continua aparecendo, quebrando a intenção declarada de tela simplificada para o idoso.

**Código atual:**

```jsx
@media (max-width: 768px) { .mobile-bottom-nav { position: fixed !important; bottom: 0 !important; height: 62px !important; background-color: var(--bg-secondary) !important; display: flex !important; z-index: 99999 !important; } }   /* e .bottom-nav { position: fixed; bottom: 0; height: 70px; z-index: 1000; } na linha 190 */
```

**Correção sugerida:** Renderizar apenas uma barra inferior — condicionar a .mobile-bottom-nav a currentUser.role === 'patient' e ao mesmo `!(uiMode === 'accessible')` usado pela .bottom-nav.

<details><summary>Verificação feita contra o código</summary>

Verifiquei os dois arquivos. App.jsx:1617 renderiza `<div className="mobile-bottom-nav no-print">` SEM nenhuma condição de papel ou de modo, com itens fixos de paciente (Início/Nova Foto/Histórico/Mais). App.jsx:1739-1740 renderiza `<nav className="bottom-nav no-print">` com os itens corretos por papel (isAdmin / doctor / patient), condicionada apenas ao Modo Fácil. No CSS, .bottom-nav é fixed bottom:0, height 70px, z-index 1000 (linha 190-203) e só recebe display:none em @media (min-width:768px) (linha 269). .mobile-bottom-nav é fixed bottom:0, height 62px, background-color opaco var(--bg-secondary), display:flex, z-index 99999, tudo com !important (linhas 1014-1031). Logo, em telas < 768px as duas coexistem e a de paciente cobre a de papel. A observação sobre o Modo Fácil também procede: a condição da linha 1739 esconde só a .bottom-nav. Rebaixo de crítico para alto por não ter verificado se existe outro ponto de navegação no mobile-header.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0166 · ALTO · `CONFIRMADO`

**Barra de navegação mobile (z-index 99999) fica acima de todos os modais e bloqueia seus controles**

**Onde:** `src/index.css:1026`

**O defeito:** `.mobile-bottom-nav` usa z-index 99999 !important e é opaca. Vários overlays fixos do app usam z-index muito menor: WoundEvolutionComparator.jsx:373 (1500), AIChatAssistant.jsx:987 (1100), DateRangePicker.jsx:233 (1050), NursesNetwork.jsx:330 (1000), PatientAppointmentsCalendar.jsx:757 (1000), SpecialistDirectory.jsx:335 (1000), DoctorDashboard.jsx:3275 (9999) e o drawer do histórico de chat (index.css:939, z-index 1200). Todos ficam por baixo dos 62px inferiores da barra. O drawer do chat, que usa bottom:0, tem seu último item permanentemente coberto.

**Como falha:** Paciente abre o comparador de evolução da ferida no celular (overlay fixo, z-index 1500, centralizado com padding de 16px). Os 62px inferiores do modal – onde ficam os controles e o botão de fechar em telas pequenas – estão sob a barra de navegação opaca. Os toques do paciente ativam os botões da navegação (ele é levado para outra aba) em vez de agir no modal.

**Código atual:**

```jsx
z-index: 99999 !important;   /* vs. WoundEvolutionComparator.jsx:373 -> zIndex: 1500 e index.css:939 -> z-index: 1200 (.chat-history-sidebar) */
```

**Correção sugerida:** Baixar a .mobile-bottom-nav para um z-index de camada de navegação (ex.: 900) e padronizar os overlays acima dela.

<details><summary>Verificação feita contra o código</summary>

index.css:1026 confirma `z-index: 99999 !important` com background-color opaco (linha 1021) e height 62px em bottom:0. Confirmei por grep os z-index dos overlays citados: WoundEvolutionComparator.jsx:373 = 1500, AIChatAssistant.jsx:987 = 1100, DateRangePicker.jsx:233 = 1050, NursesNetwork.jsx:330 = 1000. Todos ficam abaixo da barra, que além de tapar os 62px inferiores intercepta os toques. Ressalva que reduz o alcance: PrescriptionGeneratorModal usa zIndex 999999 e DoctorDashboard:3275 usa 9999, ambos acima da barra — logo o problema não atinge 'todos os modais', mas atinge os quatro overlays verificados.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0167 · ALTO · `CONFIRMAR-SCHEMA`

**Dois createAuditLog com assinaturas e destinos diferentes; os eventos LGPD nunca chegam à tela admin-logs**

**Onde:** `src/services/auditLogger.js:8`

**O defeito:** Existem duas funções com o mesmo nome: auditLogger.createAuditLog(actionType, clinician, patient, details) grava em localStorage; supabaseService.createAuditLog(action, targetId, details) grava na tabela audit_logs do Supabase (supabaseService.js:333). A tela de logs do admin lê apenas getAuditLogs() do Supabase (AdminDashboard.jsx:51 / supabaseService.js:2595). Portanto tudo que passa pelo auditLogger (leitura de prontuário em ClinicalHistory.jsx:130, exportação em PDF em ClinicalHistory.jsx:165, agendamento em BookingModal.jsx:82) é invisível na auditoria oficial. Pior, as assinaturas são incompatíveis: se algum arquivo trocar o import, o segundo argumento passa a ser um objeto de usuário onde se espera um targetId (uuid), gravando lixo na coluna target_id.

**Como falha:** Admin abre a aba admin-logs para investigar quem leu o prontuário de um paciente após uma reclamação de privacidade. A tela lista apenas os eventos vindos do Supabase e nada dos eventos 'Leitura de Prontuário' registrados pelo auditLogger, levando à conclusão errada de que nenhum acesso ocorreu.

**Código atual:**

```jsx
export const createAuditLog = async (actionType, clinician, patient, details = '') => {   // auditLogger.js:8
export const createAuditLog = async (action, targetId = null, details = {}) => {          // supabaseService.js:333
```

**Correção sugerida:** Renomear a função do auditLogger (ex.: recordLocalAccessLog) e fazê-la delegar ao supabaseService.createAuditLog para que os eventos apareçam em admin-logs.

<details><summary>Verificação feita contra o código</summary>

Confirmei as duas assinaturas: auditLogger.js:8 `createAuditLog(actionType, clinician, patient, details)` gravando em localStorage, e o uso incompatível em DoctorDashboard.jsx:594 e :311 `createAuditLog('EXPORT_FHIR_JSON', selectedPatient.id, { ... })` — três argumentos com um id no segundo, que é a assinatura do supabaseService. Confirmei também que AdminDashboard.jsx importa getAuditLogs do supabaseService (linha 2) e o chama na linha 51, ou seja, a tela de logs lê exclusivamente a tabela audit_logs do Supabase. Tudo que passa pelo auditLogger (ClinicalHistory.jsx:129 e :164) é invisível na auditoria oficial. A colisão de nomes é uma armadilha real de manutenção.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0168 · ALTO · `CONFIRMADO`

**Trilha de auditoria LGPD gravada só em localStorage e declarada "imutável"**

**Onde:** `src/services/auditLogger.js:25`

**O defeito:** O docblock da linha 6 afirma "Registra um evento imutável de acesso, alteração ou exportação de prontuário", mas o único destino é localStorage no próprio dispositivo do usuário auditado. Qualquer pessoa com acesso ao navegador pode alterar ou apagar toda a trilha com uma linha no console (localStorage.removeItem('irec_log_acessos_prontuario')), limpar os dados do site, ou usar aba privada para não gerar log nenhum. Não há envio ao servidor nem hash/assinatura.

**Como falha:** Profissional acessa indevidamente o prontuário de um paciente que não é dele. Depois abre o DevTools e executa localStorage.removeItem('irec_log_acessos_prontuario'). A trilha exigida pela LGPD para comprovar o acesso desaparece e não existe cópia no servidor.

**Código atual:**

```jsx
localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updatedLogs));   // AUDIT_STORAGE_KEY = 'irec_log_acessos_prontuario' (linha 3), nenhum envio a servidor no arquivo
```

**Correção sugerida:** Persistir os eventos na tabela audit_logs do Supabase (via supabaseService.createAuditLog) com o localStorage apenas como fila de reenvio offline.

<details><summary>Verificação feita contra o código</summary>

Li o arquivo inteiro (47 linhas). O docblock da linha 6 diz 'Registra um evento imutável de acesso, alteração ou exportação de prontuário', mas o único destino é localStorage.setItem(AUDIT_STORAGE_KEY, ...) na linha 25. Não há nenhuma chamada de rede, nenhum hash, nenhuma assinatura e nenhuma referência ao Supabase no módulo. Qualquer pessoa com acesso ao navegador apaga tudo com localStorage.removeItem('irec_log_acessos_prontuario'), e aba anônima não gera trilha alguma. A afirmação de imutabilidade no comentário é o agravante, porque induz confiança em um controle que não existe.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0169 · ALTO · `CONFIRMADO`

**Bundle FHIR exportado omite CPF, alergias e medicamentos em uso**

**Onde:** `src/services/fhirService.js:28`

**O defeito:** O recurso Patient montado não tem nenhum `identifier`, apesar de profile.cpf existir e ser preenchido no cadastro (supabaseService.js:595, Login.jsx:131). O bundle também não gera AllergyIntolerance nem MedicationStatement, apesar de profile.allergies e profile.medications existirem (supabaseService.js:591-592). Só três extensions booleanas (diabetes, hipertensão, tabagismo) são exportadas. Mesmo assim, o app avisa ao médico que o "Prontuário" foi exportado com sucesso (DoctorDashboard.jsx:312).

**Como falha:** Paciente alérgico a sulfa é encaminhado a outro serviço. O médico exporta o bundle FHIR e o envia. O serviço receptor importa um Patient sem CPF (impossível reconciliar com o cadastro existente) e sem nenhuma informação de alergia, e prescreve um antimicrobiano ao qual o paciente é alérgico.

**Código atual:**

```jsx
const fhirPatient = { resourceType: "Patient", id: profile.id, active: true, name: [...], gender: fhirGender, birthDate: ..., telecom: ..., address: ..., extension: [ has-diabetes, has-hypertension, is-smoker ] };   // sem identifier (CPF), sem allergies, sem medications
```

**Correção sugerida:** Adicionar `identifier: [{ system: 'urn:oid:2.16.840.1.113883.13.237', value: profile.cpf }]` ao Patient e gerar recursos AllergyIntolerance/MedicationStatement a partir de profile.allergies e profile.medications.

<details><summary>Verificação feita contra o código</summary>

Li o recurso Patient inteiro (fhirService.js:28-81): não há nenhum campo `identifier`, e as únicas informações clínicas são três extensions booleanas (has-diabetes, has-hypertension, is-smoker). exportFHIRBundle (250-273) monta o bundle só com o Patient e as Observations de ferida — nenhum AllergyIntolerance ou MedicationStatement. Confirmei por grep que profile.cpf, profile.allergies e profile.medications existem e são persistidos (supabaseService.js:591-592, 595, 685-686, 692). Mesmo com essa omissão, DoctorDashboard.jsx:312 exibe 'Prontuário exportado no padrão HL7 FHIR JSON com sucesso!'. A alergia ausente em um documento chamado de 'prontuário' é o ponto grave.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0170 · ALTO · `CONFIRMADO`

**Medidas de ferida não medidas são exportadas como 0 cm / 0 cm² com status "final" no bundle FHIR**

**Onde:** `src/services/fhirService.js:191`

**O defeito:** Quando a IA não conseguiu medir a lesão, ClinicalTriage.jsx:498-500 grava explicitamente aiAreaCm2/aiLengthCm/aiWidthCm como null. No exportObservationToFHIR, Number(null) || 0 produz 0, e a Observation é emitida com status: "final". O bundle passa a afirmar, como medição definitiva, que a ferida tem 0 cm de comprimento, 0 cm de largura e 0 cm² de área. O próprio geminiService trata o mesmo null corretamente (geminiService.js:530 usa `entry.aiAreaCm2 ? ... : 'N/A'`), o que confirma que null significa "não medido", não "zero". Number() também devolve NaN (-> 0) se a IA retornar string com vírgula decimal ou unidade ("12,5", "12.5 cm").

**Como falha:** Enfermeira registra a ferida sem foto analisável, então aiAreaCm2 = null. O médico clica em "Exportar FHIR" e envia o JSON para outro serviço. O especialista que recebe lê valueQuantity 0 cm² em uma Observation com status "final" e conclui que a lesão está fechada/cicatrizada, quando na verdade nunca foi medida.

**Código atual:**

```jsx
valueQuantity: { value: Number(entry.aiAreaCm2) || 0, unit: "cm2", ... }   // ClinicalTriage.jsx:498 -> aiAreaCm2: finalResult.aiAreaCm2 || null
```

**Correção sugerida:** Omitir cada componente de medida quando o valor for null/NaN (ou emitir dataAbsentReason: 'not-measured') em vez de aplicar `|| 0`.

<details><summary>Verificação feita contra o código</summary>

Confirmei os dois lados. fhirService.js:155/173/191 usa Number(entry.aiLengthCm) || 0, Number(entry.aiWidthCm) || 0 e Number(entry.aiAreaCm2) || 0 dentro de uma Observation com status: "final" (linha 114). ClinicalTriage.jsx:498-500 grava explicitamente aiAreaCm2/aiLengthCm/aiWidthCm como `finalResult.X || null`, ou seja, null significa 'não medido'. Number(null) === 0, então o bundle afirma como medição definitiva 0 cm / 0 cm². Não existe nenhuma guarda: o componente é sempre emitido, mesmo sem valor. Number('12,5') retorna NaN e o || 0 também mascara isso. Rebaixo para 'alto' porque o dano só se materializa no fluxo manual de exportação FHIR (DoctorDashboard.handleExportFHIR), não em toda a tela.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0387 · MÉDIO · `CONFIRMADO`

**Colisão de breakpoint em exatamente 768px: sidebar desktop e barra mobile ativas ao mesmo tempo**

**Onde:** `src/index.css:1013`

**O defeito:** O layout desktop usa @media (min-width: 768px) (linha 256) e a barra inferior usa @media (max-width: 768px) (linha 1013). Ambas as condições são verdadeiras em exatamente 768px de largura de viewport — a largura CSS do iPad em retrato. Nessa largura aparecem simultaneamente a sidebar fixa de 260px e a barra inferior de 62px, e o `.main-content` desktop (linha 446) usa `padding: 40px 48px`, sem nenhum espaço inferior reservado para a barra.

**Como falha:** Enfermeira usa o app no iPad em retrato (768px). A tela mostra a sidebar lateral e, ao mesmo tempo, a barra de navegação inferior de paciente cobrindo os últimos 62px do conteúdo. O botão de salvar no fim do formulário de registro da lesão fica embaixo da barra e não pode ser tocado; ela toca e é levada para outra aba, perdendo o formulário.

**Código atual:**

```jsx
@media (min-width: 768px) { .app-container { padding-left: 260px; } ... }   /* linha 256 */
@media (max-width: 768px) { .mobile-bottom-nav { ... display: flex !important; } }   /* linha 1013 */
```

**Correção sugerida:** Trocar `@media (max-width: 768px)` da linha 1013 por `@media (max-width: 767px)`, alinhando com o restante do arquivo.

<details><summary>Verificação feita contra o código</summary>

Confirmei os dois breakpoints no arquivo: `@media (min-width: 768px)` na linha 256 (aplica padding-left: 260px e mostra a sidebar) e `@media (max-width: 768px)` na linha 1013 (mostra a .mobile-bottom-nav com display: flex !important). Ambas as condições são verdadeiras em exatamente 768px, largura CSS do iPad em retrato. Note que o app é coerente no outro breakpoint (o chat usa max-width: 767px na linha 976), o que evidencia que o 768 da linha 1013 é um descuido. O conteúdo desktop não reserva espaço inferior para a barra, então os últimos 62px ficam cobertos.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0388 · MÉDIO · `CONFIRMADO`

**Classe .no-print é derrotada por !important declarado depois no arquivo**

**Onde:** `src/index.css:1023`

**O defeito:** A barra é marcada como não imprimível no JSX (App.jsx:1617 usa className="mobile-bottom-nav no-print") e o bloco @media print declara `.no-print { display: none !important }` na linha 849. Porém a linha 1023 declara `.mobile-bottom-nav { display: flex !important }`, com a mesma especificidade (0,1,0), também !important e depois no arquivo — logo vence o empate. Quando as duas media queries batem simultaneamente (impressão/PDF com largura de página <= 768px, caso do fluxo de imprimir/salvar em PDF pelo celular), a barra de navegação é impressa.

**Como falha:** Paciente usa o app no celular, abre o relatório evolutivo e escolhe imprimir/salvar em PDF. O PDF entregue à equipe de saúde sai com a barra de navegação (Início / Nova Foto / Histórico / Mais) impressa dentro do documento clínico.

**Código atual:**

```jsx
@media (max-width: 768px) { .mobile-bottom-nav { ... display: flex !important; ... } }   /* linha 1023, depois de .no-print { display: none !important } da linha 849 */
```

**Correção sugerida:** Adicionar `.mobile-bottom-nav { display: none !important; }` ao bloco @media print (ou movê-lo para o fim do arquivo).

<details><summary>Verificação feita contra o código</summary>

Confirmei a cascata: App.jsx:1617 aplica className="mobile-bottom-nav no-print"; index.css:849-854 declara `.no-print { display: none !important }` dentro de @media print; index.css:1023 declara `display: flex !important` para .mobile-bottom-nav dentro de @media (max-width: 768px). As duas regras têm a mesma especificidade (uma classe) e ambas são !important, então vence a que aparece por último no arquivo — a linha 1023. Quando as duas media queries batem ao mesmo tempo (imprimir/salvar em PDF com largura de página <= 768px), a barra de navegação é impressa dentro do documento clínico.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0390 · MÉDIO · `CONFIRMAR-SCHEMA`

**Logs de auditoria com nomes de pacientes não são apagados no logout (vazamento em dispositivo compartilhado)**

**Onde:** `src/services/auditLogger.js:3`

**O defeito:** A rotina de logout do App.jsx (linhas 654-667) remove irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab, e signOutUser (supabaseService.js:299) remove irec_active_user. Nenhuma delas remove irec_log_acessos_prontuario, que guarda até 200 registros com patientName, clinicianName e a descrição do acesso.

**Como falha:** Tablet compartilhado de uma unidade de saúde: a enfermeira A atende 30 pacientes, registra a leitura dos prontuários e faz logout. A enfermeira B entra com a própria conta, abre o DevTools (ou qualquer script na página) e lê a lista completa de nomes de pacientes atendidos pela colega, com data, hora e tipo de acesso.

**Código atual:**

```jsx
const AUDIT_STORAGE_KEY = 'irec_log_acessos_prontuario';   // App.jsx:661-667 remove 7 chaves no logout, nenhuma delas é esta
```

**Correção sugerida:** Incluir `localStorage.removeItem('irec_log_acessos_prontuario')` na rotina de logout do App.jsx (após a sincronização dos logs com o servidor).

<details><summary>Verificação feita contra o código</summary>

Confirmei App.jsx:652-668: handleLogout remove exatamente irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab — sete chaves, nenhuma delas irec_log_acessos_prontuario (auditLogger.js:3). Os registros guardam patientName, clinicianName e a descrição do acesso (linhas 15-19), até 200 deles, e sobrevivem à troca de usuário no mesmo dispositivo. Rebaixo de alto para médio porque a leitura exige DevTools/console ou script na página — nenhuma tela do app expõe esses dados (ver item 50237).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0391 · MÉDIO · `CONFIRMAR-SCHEMA`

**Nome de paciente gravado pelo log de auditoria não é limpo no logout (vazamento entre usuários do mesmo dispositivo)**

**Onde:** `src/services/auditLogger.js:25`

**O defeito:** Ao abrir o histórico, ClinicalHistory grava em `localStorage['irec_log_acessos_prontuario']` um registro com `patientName` e `patientId`. O `handleLogout` de App.jsx (linhas 661-667) remove `irec_active_user`, `irec_active_tab`, `irec_selected_patient`, `irec_doctor_active_tab`, `irec_doctor_sub_tab`, `irec_doctor_doc_tab` e `irec_patient_sub_tab`, mas NÃO remove a chave de auditoria — confirmei por grep que nada no projeto a apaga.

**Como falha:** Em um tablet compartilhado de uma unidade de saúde, o paciente A abre seu histórico e faz logout. O próximo usuário (paciente B ou um visitante) abre o DevTools ou qualquer código no mesmo origin e lê no localStorage o nome completo e o id do paciente A, com data e hora do acesso. Os dados persistem indefinidamente (até 200 registros).

**Código atual:**

```jsx
localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updatedLogs));
```

**Correção sugerida:** Adicionar `localStorage.removeItem('irec_log_acessos_prontuario')` ao handleLogout (ou persistir a trilha no backend em vez do localStorage).

<details><summary>Verificação feita contra o código</summary>

Verifiquei o `handleLogout` (App.jsx:652-668): ele remove irec_active_user, irec_active_tab, irec_selected_patient, irec_doctor_active_tab, irec_doctor_sub_tab, irec_doctor_doc_tab e irec_patient_sub_tab — e nada mais. Grep por `irec_log_acessos_prontuario` em src/ retorna um único hit (auditLogger.js:3), ou seja, nenhum removeItem/clear atinge essa chave em nenhum lugar do projeto. O registro gravado na linha 25 contém patientName e patientId (linhas 17-18) e é mantido com `.slice(0, 200)`, persistindo indefinidamente no dispositivo. Agravante que reforça o achado: `getPatientAuditLogs` (linha 37) não é chamado por nenhum componente — a trilha é write-only, então os dados ficam guardados sem sequer servir ao propósito de auditoria. Mitigante: o conteúdo é o nome/id do próprio usuário que estava logado e o acesso exige posse física do dispositivo/DevTools, o que não sustenta severidade alta.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0392 · MÉDIO · `CONFIRMADO`

**Nome do paciente é impresso no console a cada abertura do prontuário (PII em log)**

**Onde:** `src/services/auditLogger.js:26`

**O defeito:** O `createAuditLog` chamado por ClinicalHistory.jsx:130 e :165 executa um `console.log` que interpola o nome do paciente. O projeto usa Sentry, que por padrão captura console como breadcrumb, então o nome do paciente pode ser enviado a um serviço externo junto de qualquer exceção. ClinicalHistory ainda reforça isso ao colocar o nome no `details` (linha 134: `...histórico clínico do paciente ${clinicalProfile.name}`).

**Como falha:** Paciente abre 'Histórico': o console do navegador (e o breadcrumb do Sentry) registra '[iRec AuditLog] Evento registrado: Leitura de Prontuário por Profissional Autorizado no prontuário de Maria da Silva'. Como o efeito refira a cada 30 s, o nome é repetido indefinidamente. Qualquer erro subsequente capturado pelo Sentry carrega essa PII.

**Código atual:**

```jsx
console.log(`[iRec AuditLog] Evento registrado: ${actionType} por ${newLog.clinicianName} no prontuário de ${newLog.patientName}`);
```

**Correção sugerida:** Remover o nome do paciente do console.log (logar apenas actionType e patientId, ou condicionar o log a import.meta.env.DEV).

<details><summary>Verificação feita contra o código</summary>

A linha 26 existe exatamente como descrito e interpola `newLog.patientName`, que vem de `patient?.name` (linha 18). ClinicalHistory.jsx:129-135 chama `createAuditLog('Leitura de Prontuário', ..., clinicalProfile, ...)` sempre que `clinicalProfile` é truthy, e o `details` (linha 134) repete o nome. O `useEffect` tem deps `[clinicalProfile]` e o polling de App.jsx:687-724 executa `setClinicalProfile(profile)` com um objeto NOVO a cada 30 s (interval em 722), então o efeito realmente refira e o nome é reimpresso indefinidamente — a parte do cenário sobre os 30 s se sustenta. A ressalva: o envio a serviço externo NÃO é automático — main.jsx:8-16 só inicializa o Sentry se `import.meta.env.PROD || VITE_SENTRY_DSN`, e o DSN padrão é o placeholder `https://placeholder@sentry.io/123456`, que não entrega eventos. Com um DSN real configurado, os breadcrumbs de console (integração default, não desabilitada) carregam a PII. Defeito confirmado, mas o dano depende de configuração — por isso reduzo de alto para médio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0393 · MÉDIO · `CONFIRMADO`

**Nome do paciente escrito em console.log vira breadcrumb do Sentry e sai do dispositivo**

**Onde:** `src/services/auditLogger.js:26`

**O defeito:** Cada evento de auditoria imprime no console o nome do paciente e do profissional. O @sentry/react é inicializado em main.jsx:9 sem desabilitar a integração de breadcrumbs, que por padrão captura chamadas de console. Assim, o nome do paciente é anexado a qualquer evento de erro enviado ao Sentry. Como o DSN cai no placeholder (main.jsx:10), o destino desse envio é um projeto desconhecido.

**Como falha:** Paciente abre o próprio histórico (dispara o log com o nome dele no console) e, na tela seguinte, um erro de JavaScript qualquer é capturado pelo Sentry. O evento enviado carrega o breadcrumb "[iRec AuditLog] Evento registrado: Leitura de Prontuário por Profissional Autorizado no prontuário de Maria Silva Santos" para um DSN de terceiro não controlado pela organização.

**Código atual:**

```jsx
console.log(`[iRec AuditLog] Evento registrado: ${actionType} por ${newLog.clinicianName} no prontuário de ${newLog.patientName}`);
```

**Correção sugerida:** Remover o nome do paciente do console.log (logar apenas o id do evento) e configurar `beforeBreadcrumb` no Sentry para descartar breadcrumbs de console.

<details><summary>Verificação feita contra o código</summary>

auditLogger.js:26 confirma `console.log(\`[iRec AuditLog] Evento registrado: ${actionType} por ${newLog.clinicianName} no prontuário de ${newLog.patientName}\`)`. main.jsx:9-15 confirma Sentry.init com `integrations: [Sentry.browserTracingIntegration()]` — como não há defaultIntegrations: false, as integrações padrão (incluindo Breadcrumbs, que captura console) continuam ativas, então o nome do paciente é anexado a qualquer evento de erro. Rebaixo para médio por uma ressalva material: o DSN placeholder aponta para o projeto 123456 com chave pública 'placeholder', que quase certamente é rejeitado pelo ingest do sentry.io — o dado é anexado ao evento, mas a entrega efetiva a terceiro não é comprovável.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0394 · MÉDIO · `CONFIRMADO`

**Falha na gravação da auditoria é silenciosa: acesso ao prontuário prossegue sem registro**

**Onde:** `src/services/auditLogger.js:28`

**O defeito:** Se localStorage.setItem lançar (QuotaExceededError, modo privado do Safari, storage bloqueado por política do navegador), o catch apenas emite console.warn e devolve null. A função resolve com sucesso, então nenhum chamador percebe. Em ClinicalHistory.jsx:136 o .catch cobre apenas a falha do import() dinâmico, não o retorno null. O comportamento é fail-open: o prontuário é exibido mesmo quando a auditoria obrigatória não foi gravada.

**Como falha:** Profissional usa um tablet com o localStorage já cheio (fotos base64 do modo contingência local ocupam a cota). Ele abre 40 prontuários no dia; todas as gravações de auditoria falham em silêncio e ele continua vendo os dados clínicos normalmente. Não existe nenhum registro de nenhum desses 40 acessos.

**Código atual:**

```jsx
} catch (err) {
    console.warn('[iRec AuditLog] Erro ao gravar log de auditoria:', err);
    return null;
  }
```

**Correção sugerida:** Propagar a falha (rejeitar a promise ou retornar um flag de erro) e exibir aviso ao usuário quando o registro obrigatório de acesso não puder ser gravado.

<details><summary>Verificação feita contra o código</summary>

auditLogger.js:28-31 confirma o catch que apenas emite console.warn e retorna null, e como a função é async ela resolve com sucesso — nenhum chamador distingue null de log gravado. ClinicalHistory.jsx:136 confirma que o `.catch` cobre apenas a falha do import() dinâmico, não o retorno null, e o prontuário é renderizado independentemente. O comportamento é fail-open e o cenário (localStorage cheio, por causa das fotos base64 do modo contingência local) é realista.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0395 · MÉDIO · `CONFIRMADO`

**Trilha de auditoria é write-only: getPatientAuditLogs nunca é chamada em nenhum lugar**

**Onde:** `src/services/auditLogger.js:37`

**O defeito:** Grep em todo o src por getPatientAuditLogs retorna apenas a própria definição. Não existe nenhuma tela, modal ou relatório que leia irec_log_acessos_prontuario (a única outra ocorrência da chave é a escrita na linha 25). A tela admin-logs consome getAuditLogs() do Supabase. O código escreve logs que nenhum papel do sistema consegue ler pela interface.

**Como falha:** Paciente exerce o direito da LGPD e solicita o relatório de quem acessou seu prontuário. Nem o admin nem o médico têm qualquer tela que exiba esses registros; a informação existe apenas dentro do localStorage do navegador de quem acessou e é inacessível pela UI.

**Código atual:**

```jsx
export const getPatientAuditLogs = (patientId) => { ... }   // nenhuma importação/chamada em src/ (apenas a definição)
```

**Correção sugerida:** Expor os registros em uma tela (relatório de acessos ao prontuário) ou remover o módulo em favor do audit_logs do Supabase, que já tem tela.

<details><summary>Verificação feita contra o código</summary>

Grep por getPatientAuditLogs em todo o src retorna uma única linha: a própria definição em auditLogger.js:37. Nenhum componente importa a função. Confirmei também que a tela admin-logs consome getAuditLogs() do supabaseService (AdminDashboard.jsx:2 e :51), ou seja, os eventos gravados em irec_log_acessos_prontuario não têm nenhuma superfície de leitura na interface. O módulo escreve uma trilha LGPD que nenhum papel consegue consultar.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0396 · MÉDIO · `CONFIRMADO`

**Nome do paciente invertido no HumanName FHIR: prenome exportado como family (sobrenome)**

**Onde:** `src/services/fhirService.js:25`

**O defeito:** O código usa nameParts[0] como familyName e o restante como givenNames. Em FHIR, HumanName.family é o sobrenome e HumanName.given são os prenomes. Com nomes brasileiros a ordem é a inversa: para "Maria Silva Santos" o export gera family: "Maria" e given: ["Silva", "Santos"]. Além disso, `profile.name.trim().split(' ')` não filtra vazios, então nome digitado com espaço duplo gera entradas "" dentro de given.

**Como falha:** Médico exporta o bundle FHIR de "Maria Silva Santos" e envia ao sistema do hospital. O sistema receptor indexa e busca pacientes por family name e passa a procurar o sobrenome "Maria"; o paciente não é encontrado na base, ou é criado um cadastro duplicado com identidade trocada.

**Código atual:**

```jsx
const nameParts = profile.name ? profile.name.trim().split(' ') : ['Paciente'];
const givenNames = nameParts.slice(1);
const familyName = nameParts[0];
```

**Correção sugerida:** Usar `const parts = profile.name.trim().split(/\s+/); const familyName = parts[parts.length - 1]; const givenNames = parts.slice(0, -1);`.

<details><summary>Verificação feita contra o código</summary>

fhirService.js:24-26 confirma literalmente `const givenNames = nameParts.slice(1); const familyName = nameParts[0];`, aplicados em family/given nas linhas 36-37. Em FHIR, family é o sobrenome e given são os prenomes, então 'Maria Silva Santos' vira family: 'Maria', given: ['Silva','Santos'] — invertido. O split(' ') sem filtro de vazios também procede: nome com espaço duplo injeta '' em given. Rebaixo de alto para médio porque `text: profile.name` (linha 35) carrega o nome completo correto, o que atenua parcialmente a reconciliação no sistema receptor.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0397 · MÉDIO · `CONFIRMADO`

**Arrays vazios e fullUrl relativo tornam o bundle inválido para servidores FHIR conformes**

**Onde:** `src/services/fhirService.js:48`

**O defeito:** Quando o paciente não tem telefone, telecom recebe [] (linha 48); sem CEP, address recebe [] (linha 66); sem observação médica, note recebe [] (linha 238). A especificação FHIR proíbe arrays vazios em elementos repetíveis (o elemento deve ser omitido), e validadores rejeitam com "Array cannot be empty". Além disso Bundle.entry.fullUrl deve ser uma URL absoluta, mas é gerado como referência relativa ('Patient/<id>', linhas 262 e 266). Por último, `neighborhood` (linha 60) não é um elemento de Address em FHIR — o correto é `district` — então o bairro é descartado no import.

**Como falha:** Médico exporta o prontuário de um paciente sem telefone cadastrado e envia o JSON para o servidor FHIR do hospital. O POST é rejeitado com erro de validação de array vazio / fullUrl inválido, sem nenhuma mensagem útil no iRec (o app só mostrou "exportado com sucesso").

**Código atual:**

```jsx
telecom: profile.phone ? [ ... ] : [],
...
address: profile.cep ? [ { ... neighborhood: profile.neighborhood || undefined, ... } ] : [],
...
fullUrl: `Patient/${profile.id}`,
```

**Correção sugerida:** Omitir as propriedades quando vazias (spread condicional em vez de `: []`), trocar `neighborhood` por `district` e gerar fullUrl absoluto com `urn:uuid:` ou uma base URL.

<details><summary>Verificação feita contra o código</summary>

Confirmei todos os quatro pontos no código: telecom recebe [] quando não há phone (linha 42-48), address recebe [] quando não há cep (49-66), note recebe [] quando não há doctorNotes (234-238), fullUrl é gerado como referência relativa `Patient/${profile.id}` e `${obs.resourceType}/${obs.id}` (linhas 262 e 266), e `neighborhood` (linha 60) de fato não é um elemento de Address em FHIR — o correto é `district`. A especificação proíbe elementos repetíveis com zero itens e exige fullUrl absoluto, então validadores conformes rejeitam. Mantenho médio: quebra de interoperabilidade sem risco clínico direto, e o cenário depende do servidor receptor validar estritamente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0398 · MÉDIO · `CONFIRMAR-SCHEMA`

**effectiveDateTime da avaliação sai um dia antes por parse de data em UTC**

**Onde:** `src/services/fhirService.js:102`

**O defeito:** Datas no formato ISO puro (YYYY-MM-DD) são interpretadas por new Date() como meia-noite UTC. No modo Supabase entry.date vem da coluna date como 'YYYY-MM-DD' (supabaseService.js:869) e cai no else da linha 104; no modo local, entry.date vem como '10/08/2026' (ClinicalTriage.jsx:482) e a linha 102 monta a mesma string ISO. Em ambos os casos toISOString() gera '...T00:00:00.000Z'. Pior: se a data vier sem zero à esquerda ('5/8/2026' -> '2026-8-5'), a string deixa de ser ISO e o V8 passa a interpretá-la como hora LOCAL, produzindo um instante diferente para a mesma data nominal. O mesmo arquivo trata a data de nascimento sem nenhuma normalização (linha 41).

**Como falha:** Avaliação registrada em 10/08/2026 no Brasil (UTC-3) é exportada como effectiveDateTime 2026-08-10T00:00:00.000Z. O sistema que importa o bundle e renderiza em horário local mostra a avaliação em 09/08/2026 às 21:00. A linha do tempo de evolução da ferida fica deslocada um dia e a ordem de dois registros feitos no mesmo dia pode inverter.

**Código atual:**

```jsx
effectiveDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
} else {
  effectiveDate = new Date(entry.date).toISOString();
```

**Correção sugerida:** Montar a data com hora local explícita (`new Date(ano, mes-1, dia, 12, 0, 0)`) ou emitir effectiveDateTime como string 'YYYY-MM-DD' sem conversão para UTC.

<details><summary>Verificação feita contra o código</summary>

fhirService.js:99-108 confirma o parser. Confirmei também as duas origens: modo local, ClinicalTriage.jsx:482 grava `date: new Date().toLocaleDateString('pt-BR')` → '10/08/2026', que cai no ramo de 3 partes e monta '2026-08-10'; modo Supabase, supabaseService.js:869 mapeia `date: item.date` direto da coluna date ('YYYY-MM-DD'), que cai no else da linha 104. Nos dois casos new Date() de string ISO-date pura é meia-noite UTC e toISOString() produz T00:00:00.000Z, exibido como o dia anterior às 21:00 em UTC-3. Não há normalização de fuso em lugar nenhum do arquivo (birthDate na linha 41 também passa cru). Rebaixo para médio: é deslocamento de linha do tempo, não fabricação de dado clínico. Observação: o subcaso de data sem zero à esquerda não ocorre, pois toLocaleDateString('pt-BR') sempre zero-preenche.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0399 · MÉDIO · `CONFIRMAR-SCHEMA`

**Dor não informada é exportada como 0/10 e valor string quebra o valueInteger do FHIR**

**Onde:** `src/services/fhirService.js:201`

**O defeito:** `entry.pain || 0` transforma null/undefined/'' em 0, que em uma escala de dor significa "sem dor" — uma afirmação clínica que ninguém fez. Além disso não há coerção numérica: o valor vem de finalResult.painLevel, extraído do JSON devolvido pela IA (ClinicalTriage.jsx:487), portanto pode chegar como string. Nesse caso o JSON exportado terá "valueInteger": "7", que é inválido no schema FHIR e faz servidores conformes (HAPI/Firely) rejeitarem o recurso.

**Como falha:** Entrada importada sem o campo de dor preenchido é exportada como Intensidade da Dor = 0. O médico do outro serviço lê "dor 0/10" e desconsidera analgesia para uma paciente que na verdade nunca foi questionada sobre dor. Em outro registro, a IA devolve painLevel: "8" e o servidor FHIR de destino recusa o bundle inteiro com erro de tipo.

**Código atual:**

```jsx
{
  code: { text: "Intensidade da Dor" },
  valueInteger: entry.pain || 0
},
```

**Correção sugerida:** Trocar por `...(entry.pain != null ? { valueInteger: Number(entry.pain) } : {})`, omitindo o componente quando a dor não foi informada.

<details><summary>Verificação feita contra o código</summary>

fhirService.js:197-202 confirma `valueInteger: entry.pain || 0` sem coerção. A primeira metade é certa: null/undefined/'' viram 0, e 0 em escala de dor é a afirmação clínica 'sem dor', que ninguém fez — mesmo padrão de fabricação do item 50216. supabaseService.js:874 mapeia `pain: item.pain` sem default, então null chega intacto. A segunda metade é apenas provável: ClinicalTriage.jsx:487 usa `finalResult.painLevel !== undefined ? finalResult.painLevel : pain`, e finalResult vem do JSON da IA, então uma string '7' passaria sem conversão, mas não consegui confirmar o tipo devolvido pelo modelo.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0420 · MÉDIO · `CONFIRMADO`

**Nenhuma função de cancelamento é exportada e a fala do mount continua depois de sair da tela**

**Onde:** `src/utils/speechUtils.js:19`

**O defeito:** O módulo exporta somente speakNaturalText; não há stopSpeech/cancelSpeech. Por isso os componentes que falam no mount não têm o que chamar no cleanup: AccessibleSubViews.jsx:5-7 e :142 usam useEffect(..., []) sem função de retorno. Como speechSynthesis é global e sobrevive ao unmount, o texto continua sendo falado após a navegação. AccessibleDashboard.jsx:44 precisou reimplementar o cancelamento por conta própria (stopAudioSpeech), evidenciando a lacuna da API.

**Como falha:** Paciente entra na tela de telemedicina em Modo Fácil, a instrução longa começa a ser lida e ele toca em VOLTAR AO INÍCIO. O componente desmonta, mas a locução continua até o fim sobre a tela inicial, e se sobrepõe a qualquer nova locução daquela tela.

**Código atual:**

```jsx
export const speakNaturalText = (text, rate = 0.95, pitch = 1.0) => { ... }   // único export do módulo; AccessibleSubViews.jsx:5-7 -> useEffect(() => { speakNaturalText("..."); }, []);  sem cleanup
```

**Correção sugerida:** Exportar `export const stopSpeech = () => window.speechSynthesis.cancel();` e chamá-la no cleanup dos useEffect de AccessibleSubViews.

<details><summary>Verificação feita contra o código</summary>

speechUtils.js tem um único export: speakNaturalText (linha 19); não há stopSpeech/cancelSpeech no módulo. Confirmei em AccessibleSubViews.jsx que AccessibleTelemedicineView e AccessibleUploadView chamam `useEffect(() => { speakNaturalText("..."); }, [])` sem função de retorno de cleanup. Como window.speechSynthesis é global e sobrevive à desmontagem do componente, a locução continua após a navegação e se sobrepõe à fala da tela seguinte. AccessibleDashboard precisou reimplementar stopAudioSpeech por conta própria, o que confirma a lacuna da API.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0421 · MÉDIO · `CONFIRMADO`

**setTimeout de fallback da síntese de voz fica fora do try/catch e usa timeout fixo de 150ms**

**Onde:** `src/utils/speechUtils.js:95`

**O defeito:** O try/catch da função só protege a execução sincrônica. Quando getVoices() devolve lista vazia (situação normal no primeiro uso em Android/Chrome), doSpeak é agendado com setTimeout e executa depois que o try já terminou: qualquer exceção lá dentro (por exemplo `v.lang.startsWith('pt')` na linha 38 com uma voz sem lang) sobe como erro não tratado, aciona o Sentry e derruba a fala. Além disso, 150ms é insuficiente para o carregamento de vozes em Android; nesse caso ptVoices fica vazio, targetVoice fica null e o texto é lido pela voz padrão do sistema, que pode ser em inglês.

**Como falha:** Paciente idoso abre o Modo Fácil na tela de telemedicina no Android. A primeira instrução ("Para falar por vídeo com o seu profissional de saúde, aperte no botão verde grande na tela") é lida por uma voz padrão em inglês com pronúncia incompreensível, ou não é lida por causa de uma exceção não capturada dentro do timer.

**Código atual:**

```jsx
const currentVoices = window.speechSynthesis.getVoices();
if (currentVoices.length === 0) {
  setTimeout(doSpeak, 150);
} else {
  doSpeak();
}
```

**Correção sugerida:** Envolver o corpo de doSpeak em seu próprio try/catch e, em vez do timeout fixo, aguardar o evento voiceschanged com um limite de tentativas.

<details><summary>Verificação feita contra o código</summary>

Li speechUtils.js inteiro. O try da linha 22 termina na linha 99, e a linha 95 apenas AGENDA doSpeak — a execução acontece depois, num tick em que o try já saiu de escopo, então qualquer exceção dentro de doSpeak (por exemplo `v.lang.startsWith('pt')` na linha 38 com uma voz sem lang) é não tratada. O ramo é alcançado justamente na situação normal do primeiro uso em Android/Chrome (getVoices() vazio, linha 93-94). O timeout fixo de 150ms sem re-tentativa também procede: se as vozes não carregarem a tempo, ptVoices fica vazio, targetVoice fica null e o utterance usa a voz padrão do sistema.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0422 · MÉDIO · `CONFIRMADO`

**Chamadas em sequência com vozes não carregadas enfileiram falas sobrepostas (timers nunca cancelados)**

**Onde:** `src/utils/speechUtils.js:95`

**O defeito:** O módulo não guarda referência ao timer criado, portanto não há como cancelá-lo. O cancel() da linha 28 ocorre ANTES do agendamento, então uma segunda chamada não impede a primeira de falar 150ms depois. Duas ou mais chamadas em sequência resultam em várias utterances enfileiradas no speechSynthesis, faladas uma após a outra.

**Como falha:** No Modo Fácil, o paciente toca no botão de ajuda da tela de telemedicina e imediatamente navega para a tela de foto da ferida (que também fala no mount, AccessibleSubViews.jsx:142). Com as vozes ainda não carregadas, os dois timers disparam e o aparelho lê seguidamente a instrução da tela antiga e depois a da nova, confundindo o usuário que o recurso deveria ajudar.

**Código atual:**

```jsx
window.speechSynthesis.cancel();

const doSpeak = () => { ... window.speechSynthesis.speak(utterance); };
...
setTimeout(doSpeak, 150);   // nenhum clearTimeout, nenhum id armazenado
```

**Correção sugerida:** Guardar o id do timer em uma variável de módulo e chamar clearTimeout(pendingSpeakTimer) no início de speakNaturalText, junto com o cancel().

<details><summary>Verificação feita contra o código</summary>

Confirmado no arquivo: `window.speechSynthesis.cancel()` está na linha 28, ANTES do agendamento da linha 95, e o id do setTimeout não é armazenado em lugar nenhum do módulo — não há clearTimeout. Portanto uma segunda chamada cancela apenas o que já está falando, não o doSpeak pendente da primeira; os dois timers disparam e enfileiram duas utterances. Confirmei também que AccessibleSubViews.jsx tem `useEffect(() => { speakNaturalText(...) }, [])` em pelo menos dois componentes (AccessibleTelemedicineView e AccessibleUploadView), o que torna o cenário de navegação rápida realista.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0500 · BAIXO · `CONFIRMADO`

**Imports não utilizados no design conceitual alimentam os erros de ESLint**

**Onde:** `src/components/IRecConceptDesign.jsx:1`

**O defeito:** useState é importado e nunca usado; dos ícones importados, Calendar, Clock, Heart, User e CheckCircle também não são usados (apenas Video, Camera, MapPin, ChevronRight, PhoneCall e ShieldCheck aparecem no JSX). São seis violações de no-unused-vars neste único arquivo, contribuindo para os 607 erros de ESLint que hoje deixam `npm run lint` vermelho; como o script `build` do package.json não roda lint, nada disso bloqueia um deploy.

**Como falha:** Desenvolvedor roda npm run lint para validar uma correção e recebe 607 erros, entre eles seis deste arquivo morto. Com o gate de lint inutilizável, um erro real (por exemplo o no-undef 'comorbididades' em geminiService.js:962) passa despercebido e vai para produção.

**Código atual:**

```jsx
import React, { useState } from 'react';
import { 
  Video, Camera, MapPin, Calendar, Clock, ChevronRight, 
  PhoneCall, ShieldCheck, Heart, User, CheckCircle
} from 'lucide-react';
```

**Correção sugerida:** Remover os imports não usados (ou o arquivo inteiro) e adicionar `npm run lint` como etapa obrigatória antes do build.

<details><summary>Verificação feita contra o código</summary>

Grep no arquivo por Calendar, Clock, Heart, User, CheckCircle e useState retorna ocorrências apenas nas linhas 1, 3 e 4 — ou seja, exclusivamente na declaração de import; nenhum deles é usado no JSX. São seis violações de no-unused-vars neste arquivo. Confirmei também em package.json que `build` é apenas `vite build` (linha 8) e `lint` é um script separado (linha 9), portanto nada disso bloqueia o deploy. O ponto real do achado — o gate de lint inutilizável mascarando os no-undef verdadeiros — é válido, mas estas seis linhas são a menor parte dele.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0501 · BAIXO · `CONFIRMADO`

**Cores fixas e fonte não carregada no design conceitual quebram o tema**

**Onde:** `src/components/IRecConceptDesign.jsx:16`

**O defeito:** O componente ignora completamente os tokens do design system (var(--bg-primary), var(--text-primary), etc.) e fixa backgroundColor '#0B132B' com color '#F8FAFC', além de minHeight 100vh. No tema claro (padrão) isso cria um bloco escuro isolado dentro de uma interface clara. A fontFamily declarada, 'Plus Jakarta Sans', não é carregada em nenhum lugar: o index.html só importa Inter e Outfit (linha 18), então a tipografia pretendida nunca é aplicada.

**Como falha:** Usuário no tema claro abre esta tela e vê um painel escuro de altura total dentro do layout claro, com a sidebar e o header claros ao redor; a tipografia cai para system-ui, diferente de todas as outras telas.

**Código atual:**

```jsx
backgroundColor: '#0B132B',
color: '#F8FAFC',
fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
```

**Correção sugerida:** Trocar as cores literais por var(--bg-primary)/var(--text-primary) e usar a família já carregada ('Outfit'/'Inter') em vez de Plus Jakarta Sans.

<details><summary>Verificação feita contra o código</summary>

IRecConceptDesign.jsx:14-22 confirma minHeight '100vh', backgroundColor '#0B132B', color '#F8FAFC' e fontFamily "'Plus Jakarta Sans', system-ui, sans-serif" — nenhum token var(--bg-primary)/var(--text-primary). Confirmei em index.html:18 que o único link de fontes carrega Inter e Outfit; Plus Jakarta Sans não é importada em lugar nenhum, então a tipografia cai para system-ui. Como o tema claro é o :root padrão, o bloco ficaria escuro dentro de uma interface clara. Mantenho baixo: é estético e o componente é código morto.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0502 · BAIXO · `CONFIRMADO`

**Dados clínicos e de identificação fabricados hardcoded na tela do paciente**

**Onde:** `src/components/IRecConceptDesign.jsx:49`

**O defeito:** A tela apresenta como reais dados inteiramente escritos no código: nome da paciente "Maria Silva" e iniciais "MS" (linhas 45 e 49), status "● Tratamento Ativo" (linha 64), "Sua Próxima Consulta / Hoje às 14:30" (linhas 87 e 91), "Consulta de retorno por vídeo com Dr. Carlos Eduardo (Dermatologia)" (linha 95) e "Farmácia credenciada a 450m" (linha 230). Nenhum desses valores vem de props, estado ou serviço — o componente não recebe nenhuma prop.

**Como falha:** Se esta tela for ligada ao App.jsx, qualquer paciente que fizer login verá o nome "Maria Silva", um status de tratamento ativo que não é o dele e uma consulta "Hoje às 14:30" com um médico que não é o dele. Ele pode aguardar em casa por uma teleconsulta que não existe, ou se deslocar até uma farmácia inexistente a 450m.

**Código atual:**

```jsx
<h1 style={{ ... }}>Maria Silva</h1>
...
<h2 style={{ ... }}>Hoje às 14:30</h2>
<p ...>Consulta de retorno por vídeo com <strong>Dr. Carlos Eduardo</strong> (Dermatologia).</p>
...
<div style={{ ... }}>Farmácia credenciada a 450m</div>
```

**Correção sugerida:** Parametrizar o componente por props (paciente, próxima consulta, farmácia) e nunca ligá-lo a uma aba enquanto os dados forem literais.

<details><summary>Verificação feita contra o código</summary>

Verifiquei os valores no código: iniciais 'MS' (linha 45), 'Maria Silva' (linha 50), 'Sua Próxima Consulta / Hoje às 14:30' (linhas 87 e 91), 'Consulta de retorno por vídeo com Dr. Carlos Eduardo (Dermatologia)' (linha 95) e 'Farmácia credenciada a 450m' (linha 229). A assinatura do componente é `IRecConceptDesign()` — sem nenhuma prop, sem estado e sem serviço, então tudo é literal. Dado clínico/de agenda fabricado é defeito mesmo sendo intencional, mas grep confirma que o componente não é importado em lugar algum, então o paciente não é exposto a isso hoje; por isso baixo em vez de médio.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0503 · BAIXO · `CONFIRMADO`

**Botões principais do design conceitual não têm handler ("Ligar Agora" da emergência inclusive)**

**Onde:** `src/components/IRecConceptDesign.jsx:98`

**O defeito:** O botão "Entrar na Consulta por Vídeo" (linha 98) e o botão de emergência "Ligar Agora" (linha 254) são <button> com estilo completo e cursor pointer, mas nenhum onClick, href, form ou type. Nada acontece ao clicar. O arquivo inteiro é, hoje, código morto: grep por IRecConceptDesign em todo o projeto só encontra a própria definição (linha 12) e a saída do graphify, ou seja, nunca é importado por App.jsx nem por outro componente — mas ele é apresentado como o design do app do paciente, e se for ligado a uma rota entrega uma tela inerte.

**Como falha:** Ao plugar esta tela no App.jsx (é o design conceitual do paciente), o paciente lê "Precisa de ajuda urgente? Fale com a enfermagem 24 horas", toca em "Ligar Agora" e absolutamente nada acontece — sem discagem, sem feedback, sem erro.

**Código atual:**

```jsx
<button style={{ backgroundColor: '#EF4444', ... cursor: 'pointer', ... }}>
  <PhoneCall style={{ width: 14, height: 14 }} />
  <span>Ligar Agora</span>
</button>   /* nenhum onClick */
```

**Correção sugerida:** Remover o arquivo enquanto for código morto, ou ligar os botões a handlers reais (tel: para a emergência) antes de plugá-lo em qualquer rota.

<details><summary>Verificação feita contra o código</summary>

Li os dois trechos: o botão 'Entrar na Consulta por Vídeo' (linhas 98-116) e o botão 'Ligar Agora' da seção de emergência (linhas 254-269) são <button> com estilo completo e cursor: 'pointer', sem onClick, href, type ou form — clicar não faz nada. Porém confirmei por grep em todo o src que IRecConceptDesign aparece apenas na própria definição (linha 12): o componente não é importado por App.jsx nem por nenhum outro arquivo. É código morto, inalcançável por qualquer usuário hoje, por isso rebaixo de médio para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0504 · BAIXO · `CONFIRMADO`

**Cards "clicáveis" são divs sem onClick, role ou tabIndex**

**Onde:** `src/components/IRecConceptDesign.jsx:129`

**O defeito:** Os três atalhos da seção "O que você precisa fazer agora?" (linhas 129, 165 e 201) são <div> com cursor: 'pointer' e um ícone de ChevronRight sugerindo navegação, mas sem onClick, sem role="button", sem tabIndex e sem onKeyDown. Não são alcançáveis por teclado nem anunciados como controles por leitor de tela, e não fazem nada com o mouse.

**Como falha:** Paciente com baixa visão usando leitor de tela percorre a tela por Tab e simplesmente não encontra as opções "Enviar Foto da Ferida", "Passo a Passo do Curativo" e "Retirar Remédios / Curativos" — os três elementos são pulados. Um paciente com mouse vê o cursor de mão, clica e nada acontece.

**Código atual:**

```jsx
<div style={{ backgroundColor: '#151D33', ... cursor: 'pointer' }}>
  ... <Camera style={{ width: 22, height: 22 }} /> ... Enviar Foto da Ferida ...
  <ChevronRight style={{ width: 20, height: 20, color: '#64748B' }} />
</div>   /* sem onClick, role, tabIndex ou onKeyDown */
```

**Correção sugerida:** Trocar as <div> por <button> (ou adicionar role="button", tabIndex={0}, onClick e onKeyDown) caso o componente venha a ser usado.

<details><summary>Verificação feita contra o código</summary>

Confirmei o padrão nos trechos lidos (linha 129 do atalho 'Enviar Foto da Ferida' e linha ~201 do 'Retirar Remédios / Curativos'): são <div> com cursor: 'pointer' e um ChevronRight sugerindo navegação, sem onClick, role="button", tabIndex ou onKeyDown — logo não são focáveis por teclado nem anunciados como controles. O defeito de acessibilidade é real, mas o arquivo é código morto (grep confirma que IRecConceptDesign nunca é importado), então nenhum usuário o encontra hoje; rebaixo para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0572 · BAIXO · `CONFIRMADO`

**Contraste insuficiente nos badges de comorbidade no tema claro**

**Onde:** `src/index.css:723`

**O defeito:** .badge-success usa color: var(--success-light) = hsl(142,71%,50%) sobre background var(--success-glow) = hsla(142,71%,40%,0.1), que sobre o fundo branco resulta em aproximadamente 2,2:1 de contraste; .badge-danger usa var(--danger) = hsl(350,89%,55%) sobre 15% de alfa, cerca de 3,4:1. O texto tem font-size 11px em uppercase (linhas 711-721), portanto exige 4,5:1 na WCAG AA. Esses badges carregam informação clínica: ProtocolGuide.jsx:654-659 os usa para Diabetes, Hipertensão, Doença Arterial, Fumante e Obesidade; a ocorrência da linha 694 não aplica cor inline de correção.

**Como falha:** Profissional consultando o protocolo de cuidado em um tablet no tema claro, sob a luz de um posto de saúde, não distingue os badges de comorbidade ("Diabetes", "Doença Arterial") do fundo branco e escolhe o protocolo de curativo sem considerar a comorbidade sinalizada.

**Código atual:**

```jsx
.badge-success {
  background-color: var(--success-glow);
  color: var(--success-light);
}
```

**Correção sugerida:** No tema claro, usar um tom mais escuro do texto do badge (ex.: hsl(142,71%,26%) e hsl(350,89%,36%)) para atingir 4,5:1.

<details><summary>Verificação feita contra o código</summary>

Confirmei que o tema claro é o :root base (linha 6) e o escuro é o override :root[data-theme='dark'] (linha 50), portanto os valores base valem no tema padrão. Confirmei --success-light: hsl(142,71%,50%) e --success-glow: hsla(142,71%,40%,0.1) (linhas 26-27) e --danger: hsl(350,89%,55%) sobre --danger-glow com 15% de alfa (linhas 30-31). Calculando a luminância do verde hsl(142,71%,50%) sobre o fundo composto (10% do tom sobre branco), o contraste fica em torno de 1,7:1 — abaixo até da estimativa do auditor. O .badge tem font-size 11px em uppercase (linhas 711-721), texto pequeno que exige 4,5:1 na WCAG AA. Mantenho baixo por ser um problema de legibilidade que não impede a leitura do rótulo em condições normais.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0573 · BAIXO · `VERIFICAR`

**Altura do chat mobile calculada com header fixo de 60px, mas o header mede ~71px**

**Onde:** `src/index.css:981`

**O defeito:** A regra usa `height: calc(100dvh - 60px)` com o comentário "Subtract mobile header height", porém `.mobile-header` (linha 168) tem padding 16px em cima e embaixo, uma borda inferior de 1px e conteúdo de 38px de altura (`.theme-toggle-btn`, linha 78), totalizando cerca de 71px. O container fica ~11px mais alto do que a área disponível, e a barra inferior de 62px também não é descontada (só compensada por padding no `.chat-layout-container`).

**Como falha:** Paciente abre o Assistente de Cuidados no celular e o campo de digitar a mensagem fica parcialmente cortado na parte de baixo da viewport; como o container tem overflow: hidden !important, não é possível rolar para alcançá-lo por completo.

**Código atual:**

```jsx
height: calc(100dvh - 60px) !important; /* Subtract mobile header height */
```

**Correção sugerida:** Substituir o 60px fixo por uma variável CSS (--mobile-header-height) definida junto com o .mobile-header e usada nos dois lugares.

<details><summary>Verificação feita contra o código</summary>

Confirmei a regra em index.css:981: `height: calc(100dvh - 60px) !important; /* Subtract mobile header height */` com overflow: hidden !important na linha 984, dentro de @media (max-width: 767px). Confirmei também que .chat-layout-container compensa a barra inferior só com padding (linha 988). O que não consegui verificar dentro do orçamento é a altura renderizada real do .mobile-header (a soma de padding 16px+16px, borda 1px e conteúdo de 38px depende de line-height e do conteúdo efetivo), então o desvio de ~11px é provável mas não medido. O padrão de valor mágico dessincronizado do componente é real.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0574 · BAIXO · `CONFIRMADO`

**Timestamps da auditoria vêm de três instantes diferentes e do fuso do dispositivo**

**Onde:** `src/services/auditLogger.js:11`

**O defeito:** O registro guarda timestamp (ISO/UTC) e formattedDate (local) construídos por três chamadas independentes a new Date() nas linhas 11 e 12. Além de poderem cair em segundos/datas diferentes na virada, formattedDate usa o relógio e o fuso do dispositivo do usuário auditado, sem nenhuma âncora de servidor. Quem audita não tem como saber se o horário é confiável.

**Como falha:** Acesso feito às 23:59:59.998 grava timestamp com a data de hoje e formattedDate com a data de amanhã (as chamadas caem em lados opostos da virada). Em uma auditoria, os dois campos do mesmo registro se contradizem. Pior: quem quiser mascarar o horário de um acesso só precisa mudar o relógio do celular antes de abrir o prontuário.

**Código atual:**

```jsx
timestamp: new Date().toISOString(),
formattedDate: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
```

**Correção sugerida:** Capturar `const now = new Date()` uma única vez e reutilizá-la nos dois campos, gravando o horário autoritativo no servidor.

<details><summary>Verificação feita contra o código</summary>

auditLogger.js:11-12 confirma literalmente três chamadas independentes a new Date(): uma para timestamp (toISOString) e duas para formattedDate (toLocaleDateString + toLocaleTimeString). A contradição na virada do dia/segundo é possível, ainda que rara. O ponto mais forte é o segundo: formattedDate usa o relógio e o fuso do dispositivo do próprio usuário auditado, sem âncora de servidor — coerente com o item 50226 (a trilha inteira é local e manipulável). Mantenho baixo porque, dado que a trilha já não é confiável por construção, este é um agravante secundário.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0575 · BAIXO · `CONFIRMADO`

**Cap de 200 registros descarta silenciosamente a auditoria mais antiga**

**Onde:** `src/services/auditLogger.js:24`

**O defeito:** Cada gravação recorta a lista para os 200 registros mais recentes. Como o auditLogger registra leitura de prontuário a cada montagem de ClinicalHistory, impressões e agendamentos, o limite é atingido rapidamente em uso clínico real. Não há aviso, arquivamento nem envio ao servidor antes do descarte.

**Como falha:** Profissional que atende 25 pacientes por dia atinge 200 eventos em cerca de uma semana. A partir daí, cada novo acesso apaga o registro mais antigo. Uma auditoria feita 30 dias depois não encontra mais nenhum evento do período investigado.

**Código atual:**

```jsx
const updatedLogs = [newLog, ...existingLogs].slice(0, 200); // Guardar os últimos 200 registros de auditoria
```

**Correção sugerida:** Sincronizar os registros com o servidor antes de recortar a lista local, mantendo o cap apenas como limite de cache.

<details><summary>Verificação feita contra o código</summary>

auditLogger.js:24 confirma `[newLog, ...existingLogs].slice(0, 200)` sem aviso, arquivamento ou envio prévio ao servidor, e o volume descrito é plausível porque ClinicalHistory registra um evento a cada montagem (linha 126-138). Rebaixo de médio para baixo porque o dano é redundante com o item 50226: a trilha já é apenas local, apagável pelo próprio auditado e sem cópia no servidor, então o cap não é o que a torna inservível para auditoria.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0576 · BAIXO · `CONFIRMADO`

**Consulta da trilha de auditoria mistura patientId com patientName e agrupa pacientes sem id**

**Onde:** `src/services/auditLogger.js:41`

**O defeito:** O filtro compara o argumento contra dois campos semanticamente diferentes (log.patientId === patientId || log.patientName === patientId). Como createAuditLog usa o literal 'paciente' quando patient?.id é ausente (linha 17) e 'Paciente' quando patient?.name é ausente (linha 18), os registros de pacientes diferentes sem id colapsam na mesma chave. Uma consulta por 'paciente' devolve os acessos de todos eles. Homônimos também vazam entre si.

**Como falha:** Duas pacientes chamadas "Maria Silva" são atendidas. Ao consultar a trilha de uma delas pelo nome, retornam os acessos das duas, expondo a uma titular de dados os eventos de tratamento da outra — exatamente o oposto do objetivo do log LGPD.

**Código atual:**

```jsx
return logs.filter(log => log.patientId === patientId || log.patientName === patientId);   // linhas 17-18: patientId: patient?.id || 'paciente', patientName: patient?.name || 'Paciente'
```

**Correção sugerida:** Filtrar somente por `log.patientId === patientId` e deixar de gravar ids default; se o id faltar, registrar null em vez de 'paciente'.

<details><summary>Verificação feita contra o código</summary>

auditLogger.js:41 confirma `logs.filter(log => log.patientId === patientId || log.patientName === patientId)`, comparando o mesmo argumento contra dois campos semanticamente diferentes, e as linhas 17-18 confirmam os defaults literais 'paciente' e 'Paciente', que realmente colapsam pacientes distintos sem id na mesma chave. O código está errado como descrito. Porém rebaixo de médio para baixo por um fator decisivo: grep em todo o src mostra que getPatientAuditLogs nunca é chamada (só a definição na linha 37), então o cenário de vazamento entre homônimas não é alcançável por nenhum usuário hoje.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0577 · BAIXO · `CONFIRMADO`

**Texto "undefined" no code.text da Observation FHIR quando entry.type está vazio**

**Onde:** `src/services/fhirService.js:134`

**O defeito:** O campo entry.type é interpolado sem nenhum fallback, ao contrário de todos os outros campos vizinhos (anatomicalLocation, lesionStage, exudate, etc., que usam || 'Não especificado'). Em supabaseService.js:870 type é mapeado direto de item.type, sem default, e pode ser null/vazio.

**Como falha:** Registro salvo sem tipo de lesão definido (a IA não classificou e o campo ficou vazio). O bundle exportado traz code.text: "Avaliação de Lesão - undefined", e esse texto aparece literalmente na tela do sistema receptor e no relatório impresso do outro serviço.

**Código atual:**

```jsx
text: `Avaliação de Lesão - ${entry.type}`
```

**Correção sugerida:** Usar `${entry.type || 'Não especificado'}` nas linhas 134 e 141.

<details><summary>Verificação feita contra o código</summary>

fhirService.js:134 confirma `text: \`Avaliação de Lesão - ${entry.type}\`` sem fallback, e a linha 141 repete o problema em `valueString: \`Tipo: ${entry.type}, ...\`` — enquanto todos os campos vizinhos usam `|| 'Não especificado'`. supabaseService.js:870 mapeia `type: item.type` sem default (ao contrário das linhas 871-878, que usam `|| ''`), então null da coluna chega intacto. Rebaixo de médio para baixo: o efeito é texto cosmético 'undefined' no documento, sem alterar valor clínico, e ClinicalTriage.jsx:483 (`finalResult.type || woundType`) torna o campo vazio pouco frequente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0585 · BAIXO · `CONFIRMADO`

**onvoiceschanged global sobrescrito e v.lang usado sem verificação**

**Onde:** `src/utils/speechUtils.js:15`

**O defeito:** A linha 15 atribui diretamente window.speechSynthesis.onvoiceschanged (em vez de addEventListener), sobrescrevendo qualquer handler existente e impedindo que outro módulo registre o seu. A verificação da linha 14 (`!== undefined`) também não protege: em um SpeechSynthesis novo a propriedade vale null, não undefined. Nos filtros das linhas 38, 52, 67 e 81, v.lang e v.name são acessados sem guarda, e qualquer voz com lang/name ausente lança TypeError — que, no caminho do setTimeout da linha 95, não é capturado por nenhum try/catch.

**Como falha:** Em um motor de voz que exponha uma entrada com lang vazio (ocorre em algumas WebViews Android/Capacitor), `v.lang.startsWith('pt')` lança TypeError dentro do timer; nenhuma instrução é falada no Modo Fácil e o erro sobe como exceção não tratada para o Sentry.

**Código atual:**

```jsx
if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
...
const ptVoices = availableVoices.filter(v => v.lang === 'pt-BR' || v.lang === 'pt_BR' || v.lang.startsWith('pt'));
```

**Correção sugerida:** Usar addEventListener('voiceschanged', loadVoices) e filtrar com optional chaining: `(v.lang || '').startsWith('pt')` e `(v.name || '').toLowerCase()`.

<details><summary>Verificação feita contra o código</summary>

Confirmei as três partes no arquivo: linha 15 atribui `window.speechSynthesis.onvoiceschanged = loadVoices` diretamente, sobrescrevendo qualquer handler já registrado; a checagem da linha 14 (`!== undefined`) é inócua, já que a propriedade vale null quando não há handler; e a linha 38 acessa `v.lang.startsWith('pt')` sem guarda, assim como v.name.toLowerCase() nas linhas 48-52, 64-67, 72-76 e 81. Uma voz com lang/name ausente lança TypeError, e no caminho do setTimeout da linha 95 esse erro fica fora do try/catch (ver item 50240). Mantenho baixo por depender de um motor de voz que exponha entradas malformadas.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0586 · BAIXO · `CONFIRMADO`

**navigator.vibrate embutido no utilitário de fala dispara sem gesto do usuário**

**Onde:** `src/utils/speechUtils.js:24`

**O defeito:** Toda chamada de síntese de voz vibra o aparelho, inclusive as feitas em useEffect de montagem (AccessibleSubViews.jsx:6 e :142), sem qualquer interação do usuário. O Chrome bloqueia navigator.vibrate sem gesto prévio e emite aviso no console; onde funciona, o aparelho vibra a cada leitura automática, um efeito colateral que a função ("speakNaturalText") não anuncia e que o chamador não pode desligar.

**Como falha:** Paciente idoso no Modo Fácil navega entre três telas que falam no mount; o celular vibra em cada troca de tela, sem que ele tenha tocado em nada, o que é interpretado como notificação/alarme e o assusta.

**Código atual:**

```jsx
    // Vibrate device for tactile feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([60]);
    }
```

**Correção sugerida:** Remover navigator.vibrate de speakNaturalText e deixar a vibração a cargo dos handlers de toque (que já têm triggerVibration).

<details><summary>Verificação feita contra o código</summary>

speechUtils.js:23-26 confirma que toda chamada de síntese executa `navigator.vibrate([60])` antes de falar, sem parâmetro para desligar. Confirmei em AccessibleSubViews.jsx que a fala é disparada em `useEffect(..., [])` de montagem em pelo menos dois componentes (AccessibleTelemedicineView e AccessibleUploadView), ou seja, sem qualquer interação do usuário. O Chrome ignora vibrate sem gesto prévio e emite aviso no console; onde funciona, o aparelho vibra a cada troca de tela. Efeito colateral não anunciado pelo nome da função.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "IRecConceptDesign.jsx|auditLogger.js|fhirService.js|speechUtils.js"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
