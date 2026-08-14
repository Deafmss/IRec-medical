# Plano de correção — estado real em 12/08/2026

Este documento substitui o `AUDITORIA-FINAL.md` como fonte de verdade sobre o que
ainda está aberto. O relatório anterior tem erros de contagem e veredictos errados
nos dois sentidos — está detalhado na seção "Ressalvas" no fim.

---

## 1. Onde o projeto está

Dos 588 defeitos catalogados, a correção avançou de forma muito desigual:

| Bloco | Módulos | Situação |
|---|---|---|
| **Corrigido e verificado** | 00 a 15 | Boa qualidade. Amostragem confirmou correções reais, com o ID do defeito citado no código. |
| **Praticamente intocado** | 16 a 19 | ~114 defeitos abertos. A correção parou aqui. |
| **Nunca auditado** | 02, 03, 04, 05, 17 | 31 itens que a auditoria do próprio agente pulou sem registrar. |

**Estimativa de defeitos ainda abertos: 150 a 160.** A imprecisão é real e está
explicada nas ressalvas — não invente um número exato a partir daqui.

### Exemplos de correção bem feita (para calibrar o padrão esperado)

- `ClinicalTriage.jsx:275` — `aiAreaCm2: null, // IREC-0007: Do not generate fake random measurements`
- `ClinicalHistory.jsx` — `getEntryProgress` agora usa só epitelização, com os IDs `IREC-0069` e `IREC-0247` citados
- `Dashboard.jsx:183` — `getLocalDateStr()` no lugar de `new Date().toISOString().split()`
- `geminiService.js` — seleção dinâmica de modelo com cache e fallback

---

## 2. O que está aberto

### 2.1 Verificável por script — rode `npm run verificar`

Dez checagens objetivas falham hoje. Estas não exigem julgamento: ou o padrão está
no código, ou não está.

| Item | O que falta |
|---|---|
| `IREC-0031/0036` | 21 referências a `VITE_GEMINI_API_KEY` em `src/` — chaves ainda vão para o bundle |
| `IREC-0204` | 5 componentes órfãos: `IRecConceptDesign`, `DoctorPatientsListView`, `TelemedicinePage`, `TelemedicineContactsList`, `TelemedicineClinicalCopilot` |
| `IREC-0423` | Suíte de testes não roda: sem `@playwright/test`, sem `playwright.config.js`, sem script `test` |
| `IREC-0202` | `isValidTabForRole` aceita 5 abas sem `case` no switch: `patient-records`, `clinical-guidelines`, `nurses-network`, `sos`, `accessible` |
| `FAB-2` | 12 `Math.random()` gerando valor clínico em `VitalsTelemetry.jsx` e no código de autenticidade da receita |
| `FAB-5` | Lista de estabelecimentos de saúde hardcoded em `supabaseService.js:1974` |
| `CTR-3` | `lastSeen` e `last_seen` misturados — o contador de online nunca acende |
| `STS-1` | Status de consulta em pt-BR e inglês misturados (`'Agendado'` vs `'confirmed'`) |
| `TZ-1` | 2 usos de `toISOString().split()` como data local, em `DoctorDashboard.jsx:127` |
| `SEC-2` | Nome de paciente em `console.log` no `auditLogger.js:26` |

### 2.2 Módulos 16 a 19 — o grosso do que sobrou

- **16 · Camada de dados (30 abertos)** — `getCurrentUser` ainda cai no `localStorage` no `catch`, o que mantém aberto o `IREC-0001` do módulo 1; falhas de gravação silenciadas; chaves de cache divergentes.
- **17 · SOS e emergência (26 abertos)** — recursos de saúde com nome, endereço e telefone hardcoded; cache de geocodificação sem expiração; efeitos sem cleanup.
- **18 · Rede de profissionais (23 abertos)** — preços, biografias e avaliações de demonstração exibidos como reais em `NursesNetwork.jsx` e `SpecialistDirectory.jsx`.
- **19 · Serviços de base e CSS (35 abertos)** — isolamento de impressão, colisão entre as barras de navegação, `auditLogger` gravando só em `localStorage`, exportação FHIR simplificada.

### 2.3 Itens confirmados abertos apesar de marcados como feitos

- `Login.jsx:160` — o papel `nurse` continua sem ser criado. A chamada é
  `signUpUser(email, password, name, role, additionalData)` e `role` vale sempre
  `'doctor'`; `clinicianType` só alimenta rótulos de interface. O módulo 15 está
  marcado como 100%.
- `IREC-0001` — corrigido no `App.jsx`, mas o buraco desceu para
  `supabaseService.js`, no `catch` de `getCurrentUser`.

### 2.4 Estruturais — não são defeitos, são lacunas

Continuam abertos e nenhuma correção de bug resolve:

- Assinatura ICP-Brasil não existe de verdade (`IREC-0020`, `IREC-0013`, `IREC-0100`)
- Sincronização com o PEP hospitalar é simulada (`IREC-0012`)
- Sem servidor TURN — chamadas falham atrás de NAT simétrico (`IREC-0147`)
- Trilha de auditoria LGPD grava em `localStorage`, não em banco
- Sem RLS nas tabelas — toda checagem de permissão é no cliente

---

## 3. Plano de implementação

Cinco fases. A ordem é por dependência e por risco, não por quantidade.

### Fase 1 · Fechar o que o script já detecta (1 a 2 dias)

Os 10 itens da seção 2.1. São pontuais, o critério de aceite é objetivo e o
resultado é binário.

**Ordem sugerida dentro da fase:**
1. `SEC-2`, `TZ-1`, `IREC-0202` — poucas linhas cada
2. `CTR-3` e `STS-1` — escolher **uma** convenção e aplicar em todos os pontos de leitura e escrita. Não corrigir só um lado.
3. `IREC-0204` — decidir por componente: ligar à navegação ou apagar. Manter código morto é o pior dos dois.
4. `FAB-2` e `FAB-5` — remover o dado inventado ou marcá-lo visivelmente como simulado, conforme o `.agents/AGENTS.md`.

**Aceite:** `npm run verificar` sai com 25 de 25.

### Fase 2 · Rede de segurança (2 a 3 dias)

Sem isto, tudo que vier depois regride em silêncio — foi assim que o
`gemini-1.5-flash` morreu sem ninguém notar.

1. `IREC-0423` — instalar `@playwright/test`, criar `playwright.config.js`, adicionar o script `test`.
2. Escrever 60 a 80 testes a partir dos cenários "Como falha" do catálogo, priorizando o que quebra em silêncio: cálculo clínico (Braden, cicatrização, IMC), contrato de dados, datas, e consumo da IA.
3. Adicionar ao `.github/workflows/main.yml`, depois do `lint:ci`:
   ```yaml
   - name: Verificar catálogo de defeitos
     run: npm run verificar
   - name: Testes E2E
     run: npm test
   ```

**Aceite:** CI verde com lint, catálogo e testes. A partir daqui, regressão trava sozinha.

### Fase 3 · Camada de dados (módulo 16) — 1 semana

É o módulo que sustenta os outros: enquanto ele estiver errado, correção de tela
não se sustenta.

1. **Obter o schema real do Supabase.** `supabase db dump --schema-only` ou o painel. Os 112 itens marcados `CONFIRMAR-SCHEMA` no catálogo dependem disto — sem o schema, corrigir nome de campo é trocar um bug por outro.
2. Fechar o `IREC-0001` de verdade: remover o fallback para `localStorage` no `catch` de `getCurrentUser`.
3. Parar de silenciar falha de gravação. Erro de `insert`/`update` precisa chegar à interface.
4. Unificar as chaves de cache divergentes.

**Aceite:** nenhum caminho de gravação retorna sucesso sem confirmação do banco.

### Fase 4 · Módulos 17, 18 e 19 — 1 a 2 semanas

84 defeitos, quase todos da família "dado fabricado" e "CSS/acessibilidade".

Para os dados fabricados existe uma correção provisória que vale para todos e é
barata: **parar de exibir**. Trocar o valor inventado por "dado não disponível"
remove o risco clínico em dias, sem exigir decisão sobre construir a versão real.

**Aceite:** nenhuma tela exibe número, preço, avaliação ou estabelecimento que não
tenha vindo de fonte real.

### Fase 5 · Segurança antes do deploy — obrigatória, não opcional

Nada aqui pode ficar para depois do primeiro deploy público.

1. `IREC-0031/0036` — mover o rodízio de chaves para a Edge Function. Chaves nos secrets do Supabase, `VITE_GEMINI_API_KEY*` fora do `.env`.
2. Habilitar RLS nas tabelas do Supabase. Hoje toda permissão é checada no cliente, e o admin é identificado por comparação de e-mail.
3. Revogar e regerar as 8 chaves do Gemini.
4. Decidir sobre a assinatura ICP-Brasil: implementar de verdade ou **remover os selos e o QR**. Documento com selo de assinatura válida que não valida nada é o item de maior risco jurídico do projeto.

**Aceite:** nenhum segredo no bundle, RLS ativo, e nenhum documento afirmando validação que não ocorre.

---

## 4. Ressalvas sobre este documento

**A estimativa de 150 a 160 abertos não é exata.** As fontes divergem:

- O `AUDITORIA-FINAL.md` declara 590 defeitos e 156 não corrigidos. Somando as
  próprias colunas dele: 561 e 127. O catálogo real tem 588.
- Aquele relatório também errou veredictos nos dois sentidos: declarou
  `IREC-0039/0040` como não corrigido (está corrigido — `Telemedicine.jsx:143`
  registra `window.initiateTelemedicineCall` com `delete` no unmount), e declarou
  `IREC-0204` como corrigido (5 componentes seguem órfãos).
- Os módulos 06 a 15 foram verificados apenas por amostragem. A amostra veio boa,
  mas o `Login.jsx:160` mostra que "100%" não significa 100%.

**O que é confiável neste documento:** os 10 itens da seção 2.1, porque vêm de
verificação por script e podem ser reproduzidos com `npm run verificar`. O resto
é a melhor estimativa disponível.

**Como reduzir a incerteza sem custo:** ampliar o `scripts/verificar-catalogo.mjs`.
Cada defeito com critério objetivo vira ~6 linhas de checagem. Quanto mais do
catálogo estiver lá, menos depende de alguém ler e julgar.
