# Cobertura de ferida, consumo e custo — especificação

**Data:** 2026-08-21
**Projeto:** A (de quatro; ver *Fora de escopo*)
**Estado:** aprovado, aguardando plano de implementação

---

## Problema

O iRec registra evolução de ferida mas não ajuda a decidir **o que usar**, **quanto usar** nem **quanto custa**.

Três lacunas concretas, verificadas no código e no banco de produção:

1. **A indicação de cobertura existe mas não é acionável.** `ProtocolGuide.jsx` já tem lógica clínica boa (necrose → desbridamento autolítico, fibrina → alginato por nível de exsudato, insuficiência venosa → compressão com bloqueio se houver DAP). Mas devolve texto corrido, sem quantidade, sem apresentação e sem preço. O campo `price` da lista de materiais guarda a string `"Uso Tópico • Troca 24h a 48h"` — não é preço.

2. **Os campos de consumo existem e estão vazios.** `wound_entries` tem `applied_dressing`, `dressing_quantity`, `dressing_frequency` e `performed_procedures`. Em produção: **0 de 5 registros com `applied_dressing` preenchido.** Preencher é trabalho manual sem retorno visível, então ninguém preenche. Sem esses dados, o gasto do que **foi feito** é incalculável.

3. **A medida da ferida não é confiável.** `ai_area_cm2` está preenchido em 4 de 5 registros, estimado pelo Gemini a partir de uma foto reduzida a 1024 px e convertida para tons de cinza, **sem marcador de escala**. Escala absoluta não é recuperável de uma imagem única não calibrada — o número é adivinhação. Foi o item 54 da auditoria de 2026-08-21.

## Objetivo

Dado o estado do leito da ferida, indicar a cobertura apropriada com justificativa auditável, calcular quanto de cada material separar, quanto custa por troca e por tratamento, e comparar alternativas por **custo até cicatrizar** — não por preço unitário.

E, ao fazer isso, **preencher automaticamente os campos de consumo** que hoje ficam vazios, para que o custo retrospectivo passe a ser possível.

## Não-objetivos

- Não prescreve. Sugere, mostra a conta, e quem decide e assina é o profissional.
- Não substitui avaliação clínica presencial.
- Não usa `ai_area_cm2`. O motor lê apenas medida informada por pessoa ou por sensor.

---

## Arquitetura

Três camadas, com uma regra: **a camada clínica não conhece preço, e a camada de custo não conhece clínica.**

```
src/services/woundCare/
  catalog.js       Produtos: apresentações, intervalo de troca, se exige secundária
  matrix.js        Matriz de indicação: tecido × exsudato × infecção → cobertura
  contraindications.js  Bloqueios duros (DAP, infecção em oclusivo, alergia)
  quantity.js      Área + margem → apresentação escolhida, unidades, sobra
  cost.js          Quantidade × preço → custo por troca e por período
  compare.js       Duas ou mais opções lado a lado
  index.js         Fachada: buildCarePlan(avaliação, precos) -> plano
```

`catalog.js`, `matrix.js` e `contraindications.js` são **dados versionados no repositório**, com a diretriz citada em cada entrada. Indicação de cobertura errada é dano ao paciente, não bug de tela: precisa passar por revisão de código, não por formulário de admin.

`quantity.js` e `cost.js` são aritmética pura, sem dependência de React, Supabase ou rede.

### Por que motor isolado

Toda a lógica clínica e toda a aritmética ficam testáveis sem montar componente. É onde está o risco do projeto — uma placa a menos separada é um curativo interrompido no meio, uma contraindicação ignorada é dano.

---

## Modelo de dados

### Catálogo (código)

Cada produto:

```js
{
  id: 'alginato-calcio',
  nome: 'Alginato de cálcio',
  classe: 'absorvente',
  apresentacoes: [
    { id: 'placa-10x10', tipo: 'placa', larguraCm: 10, alturaCm: 10 },
    { id: 'placa-5x5',   tipo: 'placa', larguraCm: 5,  alturaCm: 5 },
    { id: 'fita-30cm',   tipo: 'fita',  comprimentoCm: 30 }
  ],
  exigeSecundaria: true,
  intervaloTrocaHoras: { exsudatoAlto: 24, exsudatoModerado: 48, exsudatoBaixo: 72 },
  referencia: 'Consenso WUWHS — Manejo de exsudato (2019)'
}
```

Arsenal mínimo desta entrega — 18 coberturas, que cobrem úlcera venosa, pé diabético e lesão por pressão:

hidrogel amorfo · hidrogel em placa · alginato de cálcio · hidrofibra (CMC) · espuma de poliuretano · espuma com prata · alginato com prata · hidrocoloide · hidrocoloide extrafino · filme transparente · carvão ativado · carvão ativado com prata · colagenase · AGE (ácidos graxos essenciais) · gaze não aderente · creme barreira perilesional · bandagem compressiva de curta elasticidade · gaze estéril 7,5×7,5.

Mais 4 consumíveis de procedimento: soro fisiológico 0,9%, luva de procedimento, luva estéril e fita micropore. Total de 22 itens no catálogo.

### Preço (banco)

Tabela nova, uma linha por apresentação por dono:

```sql
CREATE TABLE material_prices (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id      uuid NOT NULL REFERENCES clinical_profile(id) ON DELETE CASCADE,
  catalog_item  text NOT NULL,   -- 'alginato-calcio'
  presentation  text NOT NULL,   -- 'placa-10x10'
  unit_price    numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  source        text,            -- 'licitacao 2026/01', 'farmacia X'
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (owner_id, catalog_item, presentation)
);
```

`owner_id` é o profissional ou o admin que cadastrou. RLS: cada um vê e edita o seu.

**Sem preço cadastrado, o consumo aparece e o valor fica em branco.** Nunca zero, nunca estimado.

### Medida (colunas novas em `wound_entries`)

```sql
ALTER TABLE wound_entries
  ADD COLUMN IF NOT EXISTS measured_length_cm numeric(5,1)
    CHECK (measured_length_cm IS NULL OR measured_length_cm BETWEEN 0.1 AND 100),
  ADD COLUMN IF NOT EXISTS measured_width_cm numeric(5,1)
    CHECK (measured_width_cm IS NULL OR measured_width_cm BETWEEN 0.1 AND 100),
  ADD COLUMN IF NOT EXISTS measured_depth_cm numeric(5,1)
    CHECK (measured_depth_cm IS NULL OR measured_depth_cm BETWEEN 0 AND 30),
  ADD COLUMN IF NOT EXISTS measurement_method text NOT NULL DEFAULT 'none'
    CHECK (measurement_method IN ('none', 'manual', 'depth_sensor'));
```

As colunas `ai_length_cm`, `ai_width_cm` e `ai_area_cm2` ficam como estão — são histórico. O motor **não as lê**.

---

## Matriz de indicação

Dimensões de entrada: tecido predominante no leito · nível de exsudato · sinal de infecção · odor · cavidade.

### De onde vem cada entrada

Isto era ambíguo na primeira versão desta especificação e precisa ser explícito, porque decide quanto do resultado depende de julgamento humano.

| Entrada | Origem | Quem decide |
|---|---|---|
| Tecido predominante | Seleção do profissional entre necrose seca, fibrina/esfacelo, granulação e epitelização. `ai_tissue_analysis` aparece como **sugestão inicial**, marcada como tal | Profissional |
| Nível de exsudato | Campo `exudate` já existente, normalizado para `ausente` · `baixo` · `moderado` · `alto` | Profissional |
| Sinal de infecção | Campo `infection_signs` já existente, normalizado para `ausente` · `local` · `sistêmico` | Profissional |
| Odor | Campo `odor` (booleano) já existente | Profissional |
| Cavidade | Campo novo, booleano, com profundidade em `measured_depth_cm` | Profissional |
| Doença arterial periférica | `hasPeripheralArterialDisease` do perfil clínico | Cadastro |

Composição tecidual estimada por imagem é julgamento **proporcional** ("70% fibrina"), não medição absoluta, e por isso é defensável de outra forma que a área — mas continua sendo estimativa de máquina. A escolha final é do profissional, e o registro guarda qual foi a origem.

**Não existe campo de ITB no sistema.** A contraindicação de compressão usa `hasPeripheralArterialDisease`. Quando esse campo está vazio, a compressão aparece **condicionada**, com a exigência de confirmar que a avaliação arterial foi feita — nunca liberada por omissão. Ausência de diagnóstico não é ausência de doença.

| Tecido | Exsudato | Infecção local | Primária indicada |
|---|---|---|---|
| Necrose seca (escara) | ausente / baixo | não | Hidrogel amorfo |
| Necrose seca | ausente / baixo | sim | Hidrogel + prata; avaliar desbridamento instrumental |
| Fibrina / esfacelo | baixo | não | Hidrogel amorfo **ou** colagenase |
| Fibrina / esfacelo | moderado / alto | não | Alginato de cálcio **ou** hidrofibra |
| Fibrina / esfacelo | moderado / alto | sim | Alginato com prata |
| Granulação | baixo | não | AGE **ou** hidrocoloide extrafino |
| Granulação | moderado / alto | não | Espuma de poliuretano **ou** hidrofibra |
| Granulação | qualquer | sim | Espuma com prata |
| Epitelização | ausente / baixo | não | Filme transparente **ou** hidrocoloide extrafino |
| Epitelização | moderado | não | Espuma fina |

Quando a linha oferece duas opções, as duas aparecem, comparadas por custo do tratamento.

### Modificadores

- **Odor presente** → substituir a primária por carvão ativado (ou carvão com prata, se houver infecção).
- **Cavidade ou túnel** → apresentação em fita, nunca placa. Preencher no máximo dois terços do volume estimado: material que expande dentro de cavidade fechada causa pressão.
- **Exsudato alto** → creme barreira perilesional sempre. Exsudato alto macera a borda.
- **Insuficiência venosa sem DAP** → adicionar bandagem compressiva de curta elasticidade.
- **Pé diabético** → adicionar orientação de descarga (offloading); não é material de curativo, mas entra no plano.

### Contraindicações — bloqueio, não sugestão

| Regra | Motivo |
|---|---|
| Hidrocoloide e filme transparente **não** em ferida com sinal de infecção | Oclusivos favorecem anaeróbio |
| Terapia compressiva **não** se `hasPeripheralArterialDisease` for verdadeiro. Se o campo estiver vazio, aparece condicionada à confirmação de avaliação arterial | Compressão em membro isquêmico causa necrose. Ausência de diagnóstico não é ausência de doença |
| Prata por no máximo 14 dias, com reavaliação obrigatória | Citotoxicidade e pressão de resistência |
| Produto que contenha item da alergia declarada | Filtro direto |
| **Sinal sistêmico de infecção** (febre, calafrio, confusão) | Não é decisão de cobertura. O motor **não recomenda** e escala para encaminhamento, cultura e antibiótico sistêmico |

Contraindicação aparece na tela **bloqueada com o motivo visível**, não escondida. O profissional precisa saber que a opção existe e por que não pode.

---

## Aritmética de quantidade

### Cobertura primária em placa

1. Área da lesão `A = C × L` cm². Se irregular, o profissional informa `A` direto.
2. Margem de segurança: a primária deve exceder a borda em **1,5 cm de cada lado**.
   Dimensão necessária: `(C + 3) × (L + 3)`.
3. Escolher a **menor apresentação** cujas duas dimensões cubram a necessária.
4. Se nenhuma cobre: múltiplas placas com sobreposição de 1 cm, ou apresentação em rolo.
5. Sobra = área da apresentação − área necessária. **Placa aberta não volta para a prateleira**, então a sobra é desperdício e é mostrada.

Exemplo do caso aprovado: lesão 6 × 4 cm → necessário 9 × 7 cm → placa de 10 × 10 (a de 5 × 5 não cobre) → 1 unidade, sobra 37 cm².

### Cavidade

`volume ≈ A × profundidade × 0,7` — o fator 0,7 é o limite de preenchimento. Apresentação em fita, quantidade em centímetros de fita.

### Consumíveis de procedimento

| Item | Regra |
|---|---|
| Soro fisiológico 0,9% | 100 mL por 10 cm² de lesão, arredondado para cima em frascos inteiros, mínimo 1 frasco de 250 mL |
| Gaze estéril 7,5×7,5 | 2 unidades por 10 cm² + 4 fixas, mínimo 6 |
| Luva de procedimento | 1 par para remover o curativo sujo |
| Luva estéril | 1 par para a técnica |
| Creme barreira | 1 g por 10 cm de perímetro perilesional |

---

## Aritmética de custo

```
custoPorTroca      = Σ (unidades × preçoUnitário da apresentação)
trocasNoPeríodo    = ceil(diasDoPeríodo / intervaloDeTrocaEmDias)
custoMaterialPeríodo = custoPorTroca × trocasNoPeríodo
tempoEnfermagemPeríodo = trocasNoPeríodo × minutosPorProcedimento
```

`minutosPorProcedimento` é **configurável pelo serviço**, com padrão de 20 minutos. Varia muito entre ambulatório e domicílio.

**Tempo é sempre mostrado em horas.** Custo de enfermagem em dinheiro só aparece se o serviço configurar custo por minuto — caso contrário, mostrar tempo monetizado seria inventar número.

Se faltar preço de qualquer item da opção, o custo de material da opção fica **em branco**, com a lista do que falta cadastrar. Não soma parcial: soma parcial parece total.

### Comparação

Para cada opção válida da matriz, mais o curativo convencional (gaze + soro) como linha de base, calcular: custo por troca, trocas no período, custo do período, tempo de enfermagem. Ordenar por custo do período quando houver preço; por número de trocas quando não houver.

O ganho central: o material mais barato por unidade costuma ser o mais caro por tratamento, porque exige o dobro de trocas — e, em exsudato alto, macera a borda. A comparação torna isso visível com a conta aberta.

---

## Telas

### 1. Plano de cobertura — nova, no prontuário do paciente

Entradas (lidas do último `wound_entries`, editáveis): medida, tecido predominante, exsudato, infecção, odor, cavidade.

Saídas: cobertura indicada com justificativa e referência · contraindicações bloqueadas com motivo · kit de preparo com quantidades · custo por troca e por 30 dias · comparação de opções.

### 2. Bloco na triagem — dentro de `ClinicalTriage`

Depois de o profissional informar medida, tecido e exsudato, aparece a recomendação resumida e **os campos `applied_dressing`, `dressing_quantity` e `dressing_frequency` vêm pré-preenchidos** com a opção recomendada. O profissional confirma ou altera.

É o gancho que faz os dados de consumo passarem a existir.

### 3. Cadastro de preço — nova, simples

Lista das apresentações do catálogo, campo de preço, campo de origem. Filtro por produto. Indica quantas apresentações ainda estão sem preço.

---

## Tratamento de erro

| Situação | Comportamento |
|---|---|
| Sem medida | Recomenda a cobertura (não depende de área) e informa que a quantidade exige a medida |
| Sem tecido ou sem exsudato | Não recomenda; lista o que falta preencher |
| Sem preço de algum item | Consumo aparece, valor da opção em branco, com a lista do que cadastrar |
| Sinal sistêmico de infecção | Não recomenda cobertura; escala para encaminhamento |
| Nenhuma opção sobra após contraindicações | Informa explicitamente e encaminha para avaliação especializada |
| Medida fora de faixa plausível | Recusa no formulário, com a faixa aceita |

---

## Testes

Toda a lógica clínica e toda a aritmética são funções puras, testadas sem React.

- **Matriz:** um teste por linha, verificando a primária indicada e a referência citada.
- **Contraindicações:** hidrocoloide em ferida infectada é bloqueado · compressão com DAP é bloqueada · produto com item da alergia é filtrado · prata além de 14 dias exige reavaliação · sinal sistêmico não devolve cobertura.
- **Escolha de apresentação:** menor placa que cobre com margem · lesão que exige múltiplas placas · cavidade recebe fita, não placa · preenchimento nunca passa de dois terços.
- **Sobra:** valor correto e coerente com a apresentação escolhida.
- **Custo:** troca de 24 h contra 48 h em 30 dias produz 30 e 15 trocas · falta de preço devolve `null`, nunca `0` · custo de enfermagem ausente quando não há custo por minuto configurado.
- **Comparação:** a opção mais barata por unidade e mais cara por tratamento aparece na posição correta da ordenação.
- **Pré-preenchimento:** os três campos de consumo saem preenchidos e coerentes com a opção recomendada.

---

## Fora de escopo

Projetos separados, cada um com seu ciclo:

- **B — Medição por sensor de profundidade.** ARKit/ARCore via plugin Capacitor. Não pode ser verificado sem aparelho real, então não entra numa entrega que precisa ser testável.
- **C — Almoxarifado e previsão de reposição.** Exige tabela de estoque com entrada, saída e saldo, que não existe. Sem saldo, "o que vai faltar" é só projeção de consumo.
- **D — Visões do paciente e do serviço.** O motor desta entrega já calcula os três casos; faltam as telas e a generalização do preço de profissional para organização.
