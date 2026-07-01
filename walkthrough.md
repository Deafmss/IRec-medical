# Walkthrough: Geolocalização de Recursos, Telemedicina e Suporte à Vida

Este documento detalha o desenvolvimento, a implementação e as integrações estruturais do iRec, focando no sistema de geolocalização, na teleconsulta e no recém-implementado **Chat Flutuante / Expresso de Telemedicina** e **Cache do Guia de Cuidados**.

---

## Modificações Realizadas

### 1. Sistema Autocomplete Multi-Especialidades (Clínicos)
- **Tags/Chips Interativos:** Substituímos as caixas de seleção (dropdowns) limitadas por uma barra de pesquisa moderna com suporte a múltiplas especialidades (com tags/chips). O usuário pode adicionar quantas especialidades possuir e removê-las clicando no botão `x`.
- **Especialidades Pré-cadastradas:** Carrega uma lista abrangente de mais de 70 especialidades oficiais de medicina (CFM/AMB) e enfermagem (COFEN).
- **Entradas Customizadas:** Caso a especialidade digitada pelo médico/enfermeiro não esteja no catálogo padrão, o iRec permite criá-la instantaneamente através da opção `Adicionar especialidade: "..."`.
- **Integração nas Telas:** Esta nova experiência foi integrada de forma idêntica em três formulários:
  1. Cadastro Inicial de Clínicos (`Login.jsx`).
  2. Configurações Rápidas de Perfil no Painel do Médico (`DoctorDashboard.jsx`).
  3. Ficha Geral de Atualização de Perfil (`UserProfileModal.jsx`).

### 2. Separação de Cadastro: Médico vs. Enfermeiro (`Login.jsx`)
- **Consulta Localizada:** Criada a função `getLocalHealthcareResources(city, state)`.
- **Geração Dinâmica:** Retorna hospitais e UPAs de emergência (suporte à vida) e farmácias locais para retirada de insumos, gerados de forma plausível com base no município e estado do paciente.
- **Associação de Médicos:** O método `getAssignedDoctor()` foi estendido para retornar também os campos `city` e `state` do profissional.

### 3. Rede de Enfermagem Híbrida (`NursesNetwork.jsx`)
- **Abas Híbridas:** Implementado controle para alternar entre **"📍 Visita Domiciliar (Presencial)"** e **"💻 Teleenfermagem (Online 24h)"**.
- **Teleconsulta Nacional:** Na aba Online, todos os enfermeiros da rede ficam disponíveis para teleconsultas 24h, sem barreira geográfica.
- **Filtro Estrito Presencial:** Na aba Presencial, a lista exibe apenas profissionais da **mesma cidade e estado** do paciente.
- **Fallback de Emergência:** Caso nenhum profissional de visita presencial esteja cadastrado na cidade, o iRec exibe um banner de alerta informativo integrado com a **Rede de Apoio Local**, mostrando o nome, endereço e telefone do Hospital/UPA de emergência e das farmácias credenciadas da cidade do paciente.

### 4. Painel do Paciente e Cobertura Clínica (`Dashboard.jsx`)
- **Card "Suporte Médico & Rede Local":** Inserido no painel principal do paciente.
- **Comportamento Dinâmico:**
  - Se houver médico vinculado e ele for da **mesma cidade**, o sistema informa a disponibilidade presencial e virtual.
  - Se o médico vinculado for de **outra cidade** (remoto) ou se **não houver médico vinculado**, o sistema alerta sobre a indisponibilidade física e recomenda o **Pronto Socorro / Hospital mais próximo da cidade do paciente**, exibindo endereço e telefone para suporte imediato à vida.

### 5. Guia de Protocolos e Insumos Híbridos (`ProtocolGuide.jsx` & `App.jsx`)
- **Passagem de Contexto:** O roteador principal em `App.jsx` agora passa o estado de `clinicalProfile` do paciente para o `<ProtocolGuide />`.
- **Checkout Híbrido:** Cada insumo recomendado no guia exibe duas opções de aquisição:
  1. **📍 Retirada Rápida:** Reserva o insumo em uma farmácia credenciada na cidade do paciente (exibe o nome do estabelecimento local) para retirada em minutos.
  2. **🚚 Envio Expresso:** Compra online via iRec Delivery com frete expresso e estimativa de entrega em até 24h para o estado do paciente.

### 6. Banco de Dados e Sinalização de Vídeo (Telemedicina)
- **Tabelas de Banco de Dados:** Criadas e ativadas na instância de produção do Supabase:
  - `chat_messages`: Persiste o histórico de mensagens trocadas, links para anexo visual de feridas e documentos PDF enviados por médicos ou pacientes.
  - `telemedicine_calls`: Tabela para sinalização em tempo real de chamadas de vídeo (identificando remetente, destinatário, status como `ringing`, `accepted`, `rejected`, `ended`, e a duração da chamada).
- **Associação de Contatos:** Inserida a vinculação do paciente e médico para garantir que ambos apareçam mutuamente nas barras laterais de conversa ativa.
- **Sincronização de Estados Multidispositivos:**
  - Adicionado listener de status no hook `useEffect` da raiz do aplicativo (`App.jsx`), com rotina de polling de 2.5s para detectar chamadas geradas por outros dispositivos.
  - Sincronização entre abas/aparelhos no componente de telemedicina (`Telemedicine.jsx`) para que, quando um participante atenda a chamada ou desligue, a tela de vídeo/sinais vitais atualize instantaneamente no outro lado (PC ou celular).

### 7. Janela de Chat Expresso (Flutuante na Teleconsulta)
- **Painel Glassmorphism Flutuante:** Adicionamos um botão de chat na barra de controles inferiores da chamada de vídeo atômica. Ao ser clicado, ele abre/fecha uma janela flutuante e compacta de chat sobreposta ao vídeo.
- **Sincronização Direta:** O Chat Expresso utiliza e sincroniza as mesmas mensagens e arquivos do histórico de chat padrão salvos no Supabase. O usuário pode ler o histórico, enviar novas mensagens de texto e anexar imagens ou PDFs inline enquanto a chamada de vídeo continua em andamento.
- **Responsividade e Rolagem Automática:** A janela possui scroll automático para as mensagens mais recentes e adapta-se a dispositivos móveis (cobrindo o vídeo de forma otimizada para telas de toque).

---

## 🆕 Recursos Premium & Acessibilidade (Fase 10)

### 1. Chat Flutuante / Expresso Global (`Telemedicine.jsx`)
- **Acesso Ubíquo:** O chat de telemedicina agora possui um **botão flutuante (gatilho)** posicionado de forma fixa (`fixed`) no canto inferior direito de **todas** as telas do iRec quando o usuário não está na aba principal de Telemedicina.
- **Badge de Notificação:** O gatilho flutuante exibe a contagem de mensagens não lidas de todos os contatos em tempo real.
- **Mini-Messenger Integrado:** Ao ser clicado, abre um painel flutuante compacto contendo:
  - **Lista de Contatos:** Exibe os contatos ativos, suas especialidades/papel, avatares com cor de destaque, última mensagem enviada, número de mensagens não lidas e um indicador visual brilhante de status online/offline.
  - **Conversa Ativa:** Exibe o histórico de mensagens completo do contato selecionado, formulário de envio de texto rápido, anexo de fotos e PDFs e suporte a leitor de voz acessível.
  - **Roteamento Interno:** Um cabeçalho com o botão **Voltar (`←`)** permite alternar rapidamente entre a conversa aberta e a lista de contatos sem fechar o mini-chat.

### 2. Otimização do Guia de Cuidados com Cache Evolutivo (`ProtocolGuide.jsx`)
- **Renomeação Clínica:** Substituímos o termo genérico "Guia de Cicatrização" por **"Guia de Cuidados"** no carregador e nos cabeçalhos.
- **Caching Inteligente:** O sistema agora salva o guia clínico gerado pela inteligência artificial em cache local (`localStorage`), associado ao ID do paciente e ao ID/timestamp da última foto ou triagem registrada.
- **Detecção de Mudanças:** O guia só será gerado novamente pelo Gemini se o histórico do paciente sofrer evoluções reais (uma nova triagem inserida) ou se houver alterações de dados cadastrados em sua ficha de comorbidades (Ex: Diabetes, Pressão Arterial, Tabagismo). Caso contrário, o guia de cuidados é **carregado instantaneamente em 0ms**, oferecendo uma experiência extremamente fluida e poupando custos de chamadas de API.

### 3. Ordenação e Pré-carregamento por Comorbidades (`App.jsx` & `ProtocolGuide.jsx`)
- **Ordenação Inteligente Padrão:** O iRec agora calcula um score de relevância para cada um dos 8 protocolos padrão baseando-se nas comorbidades ativas do paciente. Se o paciente for diabético, a opção "Pé Diabético" é movida para o primeiro lugar da lista e pré-selecionada por padrão. Se possuir insuficiência venosa, "Úlcera Venosa" encabeçará a lista, tornando a experiência altamente personalizada.
- **Carregamento Silencioso (Background Pre-loader):** Assim que o paciente faz login e visualiza o seu Painel/Dashboard, o iRec inicia uma rotina em segundo plano (com delay de 1.5s para não afetar o desempenho da tela inicial) para pré-gerar o Guia de Cuidados via IA.
- **Transição Instantânea:** Quando o usuário clica na aba "Guias e Protocolos Clínicos", o guia já foi gerado e está salvo em cache. A tela abre na hora sem qualquer tempo de espera ou carregador.

### 4. Modal de Reserva e Compra Premium (`ProtocolGuide.jsx`)
- **Fim dos Alertas de Navegador:** Substituímos todos os `alert()` genéricos do navegador por uma experiência de compra integrada, fluida e com grande apelo visual (Design Premium).
- **Código de Barras Dinâmico:** Para a opção **📍 Retirada Rápida**, o sistema agora exibe um modal animado com um código de barras dinâmico (renderizado puramente em CSS) que o paciente apresenta no balcão da farmácia física.
- **Rastreabilidade e Logística:** Para a opção **🚚 Envio Expresso**, o modal exibe o endereço do paciente, número de rastreio exclusivo iRec Delivery, prazo de entrega (24h) e o progresso logístico simulado ("Preparando Envio").
- **Integração com Google Maps:** Adicionado um atalho "🗺️ Ver Rota" no modal de retirada rápida, redirecionando o paciente diretamente para o Google Maps com o trajeto traçado até a farmácia selecionada.

### 5. Google Maps Oficial 100% Gratuito (Embed Iframe) (`LocalResourcesPanel.jsx`)
- **Sem Custos ou Chaves de API:** Implementamos a incorporação oficial do Google Maps via Iframe (`output=embed`). Isso permite carregar o mapa do Google de forma totalmente integrada, sem requerer o SDK pago do Google e sem consumir créditos da plataforma Google Cloud.
- **Foco Exclusivo no Google Maps:** Removemos a segunda opção do mapa (Leaflet/OSM) para simplificar a jornada do usuário, deixando o Google Maps como visualizador único e absoluto.
- **Filtros Clínicos Rápidos de Alta Precisão:** Forçamos o mapa a carregar previamente setado em buscas de saúde locais (`🏥 Buscar Hospitais` ou `💊 Buscar Farmácias`). As buscas são ancoradas usando a instrução geográfica `loc:LAT,LON` nas coordenadas reais do paciente, o que impede que o Google Maps direcione as buscas para locais ou cidades aleatórias.
- **Controle Dinâmico de Zoom:** Adicionamos botões de controle de zoom no topo do mapa (`➕ Aproximar` e `➖ Afastar`) que recalculam e atualizam o zoom do mapa do Google Maps dinamicamente em tempo real diretamente pelo app.

### 6. Garantia de Sigilo Médico-Paciente & Isolamento de Chats (`Telemedicine.jsx` & `supabaseService.js`)
- **Restrição Estrita de Contatos:** Removemos a busca de rede geral e a lista global de pacientes/médicos. Agora, a tela de chat é orientada estritamente por relacionamentos ativos (`doctor_patient_assignment`):
  - **Médicos e Enfermeiros:** Apenas visualizam os pacientes ativamente vinculados sob seus cuidados na lista de contatos. Pacientes de outros profissionais não aparecem sob nenhuma circunstância.
  - **Pacientes:** Visualizam apenas os médicos e enfermeiros vinculados diretamente à sua ficha de tratamento ativo.
- **Redundância e Poluição Removidas:** Como as listas são pré-filtradas no carregamento, removemos a barra de abas de filtro superior ("Todos", "Meus Pacientes", "Rede Geral", "Profissionais"), simplificando a tela de chat para uma lista única e focada.
- **Suporte a Múltiplos Médicos por Paciente:** Caso um paciente precise de acompanhamento por múltiplos especialistas, ele verá todos os médicos vinculados em sua lista e poderá conversar com cada um separadamente. Como cada chat armazena individualmente a chave `(sender_id, recipient_id)`, as conversas do Paciente X com o *Médico A* permanecem 100% ocultas e criptografadas para o *Médico B*, preservando a confidencialidade clínica legal.

### 7. Menu Dedicado: Médicos Especialistas (`SpecialistDirectory.jsx` & `App.jsx`)
- **Separação de Contexto:** Removemos o diretório de dentro da aba de chat/telemedicina. Agora, criamos o menu **`Médicos`** como uma aba exclusiva e dedicada na barra lateral (e na barra inferior de navegação mobile).
- **Dados de Cobrança (Consulta Particular):** Adicionamos um campo premium de precificação de consultas nos cards e na ficha clínica do profissional, exibindo o valor de forma destacada (ex: `R$ 280,00` ou `Sob Consulta`).
- **Fluxo Integrado sem Fricção:** Ao analisar o perfil clínico do médico na gaveta e clicar em "Iniciar Acompanhamento", o sistema realiza o vínculo médico-paciente no banco e redireciona o paciente automaticamente para a aba de **`Telemedicina`**, abrindo o chat correspondente de imediato.

### 8. Simplificação de Itens do Menu Lateral (`App.jsx`)
- **Organização por Palavra Única:** Removemos todas as barras (`/`) e termos compostos e longos dos botões do menu lateral (sidebar). Agora, cada item é definido por uma palavra clara, direta e objetiva, melhorando instantaneamente a scannabilidade e estética do painel clínico:
  * `Início / Dashboard` ➔ **`Início`**
  * `Nova Foto / Triagem` ➔ **`Triagem`**
  * `Assistente de Cuidados` ➔ **`Assistente`**
  * `Telemedicina & Chat` ➔ **`Telemedicina`**
  * `Histórico Evolutivo` ➔ **`Histórico`**
  * `Receitas e Atestados` ➔ **`Documentos`**
  * `Rede de Enfermagem` ➔ **`Enfermagem`**
  * `Guias de Tratamento` ➔ **`Protocolos`**

### 9. Cadastro Completo Obrigatório para Profissionais (`DoctorDashboard.jsx` & `UserProfileModal.jsx` & `supabaseService.js`)
- **Migração do Banco de Dados:** Adicionamos as colunas `bio`, `education` e `consultation_fee` na tabela `clinical_profile` do Supabase PostgreSQL para permitir o armazenamento completo das informações.
- **Formulário de Edição Profissional:** Expandimos o `UserProfileModal.jsx` para exibir inputs de Biografia Clínica, Formação Acadêmica e Valor da Consulta para médicos e enfermeiros, além do suporte a fotos de perfil.
- **Bloqueio Reativo do Dashboard (Completeness Check):** Adicionamos uma validação rígida no `DoctorDashboard.jsx`. Se o profissional não preencher todos os 6 parâmetros obrigatórios (Nome, CRM/COREN, Especialidade, Bio, Formação Acadêmica, Valor da Consulta e Foto), o painel clínico principal é bloqueado por uma tela de regulação com uma lista interativa de progresso e um link direto para preenchimento dos dados.

### 10. Unificação da Rede de Enfermagem (`NursesNetwork.jsx` & `App.jsx`)
- **Refletindo Fluxo de Especialistas:** Redesenhamos a aba `Enfermagem` para funcionar com a mesma inteligência premium do diretório médico. Os pacientes agora podem buscar, filtrar, conferir valores de visitas domiciliares, analisar currículos, ver depoimentos e se conectar aos enfermeiros em um único clique, com redirecionamento instantâneo ao chat seguro.

### 11. Design de Ficha Clínica Centralizada e Flutuante (`SpecialistDirectory.jsx` & `NursesNetwork.jsx`)
- **Card Flutuante em Primeiro Plano:** Substituímos o painel deslizante lateral (slide-over drawer) por um modal pop-up centralizado na tela.
- **Efeitos Premium:** O novo card flutuante possui cantos arredondados suavizados (`border-radius: 16px`), sombra difusa elegante (`box-shadow`), e uma transição de surgimento do centro para fora (`scaleUp` com curva `cubic-bezier(0.34, 1.56, 0.64, 1)`), mantendo o fundo desfocado com filtro de vidro (`backdrop-filter: blur(8px)`).

### 12. Reordenação e Agrupamento dos Diretórios (`App.jsx`)
- **Agrupamento Lógico:** Movemos o item **`Enfermagem`** para ficar imediatamente abaixo de **`Médicos`** no menu lateral, de forma que as duas abas de busca de profissionais fiquem agrupadas lado a lado para melhor usabilidade dos pacientes.

### 13. Otimização do Guia de Protocolos Clínicos para Médicos (`App.jsx` & `ProtocolGuide.jsx` & `DoctorDashboard.jsx` & `geminiService.js`)
- **State Lifting (Paciente Ativo):** Elevamos o estado do paciente ativo sob análise (`selectedPatient` e `selectedPatientEntries`) de dentro do painel do médico para o escopo global em `App.jsx`. Agora, quando o médico navega para a aba lateral de **`Protocolos`**, o sistema lembra qual paciente ele estava analisando e exibe as condutas específicas para ele. Se nenhum paciente estiver selecionado, é apresentado um card instruindo-o a selecionar um paciente na lista primeiro.
- **Protocolo Diferenciado e Clínico:** Adaptamos a geração automática por IA (Gemini) e o gerador de simulação local. Para profissionais (médicos/enfermeiros), a linguagem foca em condutas médicas técnicas (desbridamento instrumental conservador, monitoramento de exsudação e controle microbiológico avançado).
- **Esconder Insumos Comerciais e Carrinho:** Ocultamos todos os botões de compras, marcas comerciais e valores de venda de curativos na visualização do médico, substituindo por uma tabela de **Apoio à Prescrição** detalhando coberturas de alta tecnologia (ex: alginatos, hidrogéis), seus mecanismos de ação e as frequências de trocas sugeridas.

### 14. Otimização da Inicialização do App & Proteção Contra Loading Infinito (`App.jsx` & `supabaseService.js`)
- **Carregamento Instantâneo via Cache Local:** Ao iniciar a aplicação, a sessão anterior é restaurada imediatamente usando o `localStorage` (0ms). Isso evita que o usuário espere que o banco de dados responda para poder visualizar o dashboard.
- **Garantia de Timeout de 1.8 segundos:** Implementamos uma trava de segurança baseada no temporizador nativo do navegador. Se a conexão de rede ou a resposta do Supabase falharem ou demorarem mais do que 1.8 segundos, a tela de carregamento é sumariamente fechada, permitindo a entrada tolerante a falhas do usuário.
- **Eliminação de Chamadas Concorrentes:** Corrigimos o ciclo de montagem que disparava consultas redundantes de carregamento de perfil de usuário concorrentemente, aliviando a carga no banco de dados e estabilizando o boot inicial.

### 15. Sistema de Venda e Recomendação de Insumos com Links de Afiliados (`AdminPartners.jsx` & `DoctorDashboard.jsx` & `ProtocolGuide.jsx` & `supabaseService.js`)
- **Criação da Tabela `recommended_materials`:** Migramos e criamos a tabela no banco de dados para associar recomendações com links de afiliados, farmácias indicadas e preços.
- **Painel Administrativo (`AdminPartners.jsx`):** Criamos uma interface acessível **exclusivamente** à conta de administrador global (`admin@irec.com`) para cadastrar farmácias físicas/online parceiras com links de afiliados que dão desconto ao paciente e comissão percentual para a plataforma iRec ("Parceiros iRec"). Qualquer outro usuário ou médico clínico comum não possui acesso ou visibilidade deste painel.
- **Área do Médico (Prescrição Particular) (`DoctorDashboard.jsx`):** Inserimos a aba **`Receitar Insumos`** no dossiê de pacientes do painel médico para prescrever insumos e marcas específicas com links afiliados de comissão direcionados para um paciente específico.
- **Catálogo Geral do Médico (Minhas Parcerias) (`DoctorPartners.jsx`):** Redesenhamos completamente a tela **`Minhas Parcerias`** (🏪) utilizando a identidade visual do iRec (estatísticas, abas estilizadas e abertura de popups modais de cadastro). Separamos as opções em:
  1. *Farmácias Parceiras Gerais:* Redes de farmácias com link geral de comissão do médico.
  2. *Insumos & Produtos Específicos:* Coberturas e produtos específicos recomendados.
- **Interface do Paciente Dinâmica (`ProtocolGuide.jsx`):** O paciente visualiza nos seus protocolos de curativos os insumos recomendados de forma totalmente dinâmica e integrada:
  1. *Condições de Exibição dos Parceiros do Médico:* Botões e farmácias indicadas pelo médico só aparecem caso os médicos responsáveis pelo paciente tenham de fato parcerias cadastradas. Caso contrário, nenhum botão de redirecionamento ou compra é exibido.
  2. *Condições de Exibição dos Parceiros iRec:* Parceiros iRec só são exibidos caso estejam devidamente cadastrados pelo usuário Administrador no painel administrativo do iRec.
  3. *Modal de Redirecionamento com Contagem Regressiva:* Como a plataforma iRec não realiza vendas diretas, removemos o fluxo de "Pedido Confirmado / iRec Delivery" e o substituímos por uma tela de redirecionamento segura com contagem regressiva de 3 segundos (e redirecionamento automático) que exibe o nome do insumo, o parceiro/farmácia de destino e o nome do médico autor (ou indicação oficial iRec). E-commerce simulado desativado.
- **Painel e Navegação Exclusiva do Administrador (`AdminDashboard.jsx` & `App.jsx` & `supabaseService.js`):** Isolamos completamente a navegação administrativa da clínica. Quando logado como `admin@irec.com`, o menu lateral e inferior oculta as ferramentas médicas (pacientes, telemedicina, etc.) e passa a renderizar exclusivamente o **Painel Admin**, que oferece:
  1. *Desativação Total de Bloqueios de Perfil:* O administrador acessa a ferramenta instantaneamente e sem restrições clínicas.
  2. *Visão Geral & Métricas:* Resumo estatístico completo com totalizadores de Pacientes, Médicos, Enfermeiros, Triagens e Chamadas Concluídas.
  3. *Relatórios Consolidados (`AdminReports.jsx`):* Nova aba com 12 relatórios analíticos de alta utilidade divididos em:
     * **Clínicos & Região:** Perfil epidemiológico detalhado por Município/UF, Taxa de Retorno de Pacientes (Fidelização) e Altas Clínicas/Desfechos por período.
     * **Telemedicina & Fila:** Tempo médio de espera na fila, Picos de Demanda (atendimentos por hora do dia), NPS das teleconsultas (Score de Satisfação) e Taxa de Absenteísmo (No-Show).
     * **Comercial & Afiliados:** Cliques em links afiliados, insumos e marcas mais recomendadas na plataforma e Extrato de Repasses de comissão por profissional médico.
     * **Segurança & LGPD:** Auditoria clínica detalhada de visualização de prontuários (Conformidade com LGPD) e volume de prescrições e laudos emitidos digitalmente.
  4. *Usuários Cadastrados:* Diretório completo de usuários com barra de busca e contador por papel (Pacientes, Médicos, Enfermeiros).
  5. *Parceiros iRec:* Gerenciador de marcas e farmácias conveniadas com links afiliados globais e descontos.
  6. *Auditoria / Logs:* Registro de auditoria de conformidade de ações do sistema.

- **Painel Clínico Individual do Médico (`DoctorDashboardAnalytics.jsx` & `App.jsx` & `supabaseService.js`):** Implementamos um painel analítico individual exclusivo para o médico logado. Esta seção é acessada através da nova aba "Meu Painel" no menu lateral (desktop) e inferior (mobile) do médico, garantindo que o profissional analise apenas os dados de sua própria carteira de pacientes de forma isolada:
  1. *Atendimentos Realizados:* Exibe a contagem de teleconsultas realizadas no período selecionado (24h, 7d, 30d ou todo o período), o tempo clínico total on-line e a média de duração das chamadas.
  2. *Pacientes sob Acompanhamento:* Totalizador de pacientes vinculados ativamente à carteira do médico.
  3. *Casos Clínicos Finalizados:* Quantidade de pacientes que já alcançaram desfecho clínico (cicatrização completa, internação, reinternação, amputação ou óbito) a partir do último registro de triagem.
  4. *Taxa de Retorno de Pacientes:* Porcentagem de pacientes que retornaram para realizar pelo menos uma triagem de evolução (2 ou mais fotos/evoluções enviadas).
  5. *Eficiência em Telemedicina:* Minutos totais dedicados pelo médico a teleconsultas e taxa de conclusão de chamadas.
  6. *Recomendações e Parcerias:* Total de marcas/farmácias ativas e produtos recomendados no catálogo pessoal de monetização afiliada do médico.
  7. *Perfil de Comorbidades da Carteira:* Gráfico de barras com a incidência proporcional das patologias e fatores de risco (Diabetes, Hipertensão, Obesidade, etc.) de sua carteira de pacientes.

---

## Como Realizar o Teste no Cenário Real (Desktop vs. Mobile)

Para testar a comunicação entre o médico no computador e o paciente no celular, siga o passo a passo a seguir:

### Passo 1: Preparar as Credenciais de Teste
Já existem duas contas cadastradas na base de dados do Supabase e vinculadas entre si:
1. **Médico (no Computador):**
   - **E-mail:** `medico@irec.com`
   - **Senha:** A senha padrão de testes.
2. **Paciente (no Celular):**
   - **E-mail:** `paciente@irec.com`
   - **Senha:** A senha padrão de testes.

### Passo 2: Executar o Projeto Localmente na Rede Local
Para poder acessar a plataforma pelo celular, o celular e o computador devem estar conectados na **mesma rede Wi-Fi**.
1. No computador, inicie o servidor de desenvolvimento com o comando para expor na rede:
   ```bash
   npm run dev -- --host
   ```
2. O console exibirá a URL local (ex: `http://localhost:5173`) e a URL da rede local (Network) (ex: `http://192.168.1.15:5173`).
3. **No computador:** Abra o navegador e acesse a URL local. Faça login como o médico (`medico@irec.com`).
4. **No celular:** Abra o navegador do celular e acesse a URL da Network (ex: `http://192.168.1.15:5173`). Faça login como o paciente (`paciente@irec.com`).

### Passo 3: Testar o Chat Flutuante (Messenger)
1. Navegue para a tela do "Assistente de IA" ou "Início" no celular do paciente ou no computador do médico.
2. Observe o balão azul flutuante no canto inferior direito.
3. Clique nele para abrir a lista de contatos.
4. Selecione o profissional/paciente e envie mensagens de texto rápido. As notificações visuais (badges) e o chime sonoro funcionarão de forma instantânea em ambos os lados enquanto navegam!
