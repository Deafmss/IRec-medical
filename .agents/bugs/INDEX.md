# Relatório de defeitos do iRec — instruções de trabalho

Auditoria página a página de 50 arquivos-fonte (~35.000 linhas). **588 defeitos** catalogados, 559 verificados contra o código por revisão adversarial (10 achados foram descartados nesse processo).

| Severidade | Qtd |
|---|---|
| CRÍTICO | 36 |
| ALTO | 164 |
| MÉDIO | 223 |
| BAIXO | 165 |

---

## Como trabalhar este relatório

1. **Um módulo por sessão.** Não abra dois arquivos de módulo ao mesmo tempo. São 19 módulos; a ordem abaixo é proposital.
2. **Um commit por defeito**, com o ID na mensagem: `fix(IREC-0042): agenda do médico não carregava por import faltante`. Isso permite reverter um defeito sem desfazer os outros.
3. **Não refatore de carona.** Corrija exatamente o defeito descrito. Melhoria de estilo, renomeação e reorganização ficam para outro momento — elas escondem regressão no diff.
4. **Ao fim de cada módulo**, rode a verificação do rodapé do arquivo. O build precisa passar e o ESLint não pode ter ganho erro novo.
5. **Marque em `STATUS.md`** só o que você verificou. Cole a saída do comando. "Parece correto" não conta como feito.
6. **Se discordar de uma correção sugerida, discorde.** Você conhece o projeto; eu li o código de fora. Se sua solução for melhor ou mais robusta, aplique a sua e anote o motivo no commit.

## Etiquetas de confiança

| Etiqueta | Qtd | O que significa |
|---|---|---|
| `CONFIRMADO` | 447 | Defeito e correção verificados contra o código. Pode aplicar. |
| `CONFIRMAR-SCHEMA` | 112 | O defeito é real, mas a correção depende do nome de campo/coluna no Supabase. **Confira o schema antes de aplicar.** |
| `VERIFICAR` | 29 | Provável, mas não foi possível confirmar sem acesso ao ambiente. Valide antes de mexer. |

## Ordem de execução

**Antes de tudo:** leia [`00-URGENTE-cota-e-modelo-gemini.md`](00-URGENTE-cota-e-modelo-gemini.md). A cota real do Gemini neste projeto é de **20 requisições por dia por projeto** (160 no total, somando as 8 chaves), e há forte suspeita de que o modelo chamado pelo front (`gemini-1.5-flash`) tenha sido descontinuado — o que derrubaria toda a IA do aplicativo. São 4 correções curtas que provavelmente devolvem a IA ao ar.

| # | Módulo | Defeitos | Críticos | Arquivo |
|---|---|---|---|---|
| 0 | **URGENTE — cota e modelo do Gemini** | 1 + 3 reclassificados | — | [`00-URGENTE-cota-e-modelo-gemini.md`](00-URGENTE-cota-e-modelo-gemini.md) |
| 1 | Shell, build e navegação | 17 | 2 | [`01-shell-build-e-navegacao.md`](01-shell-build-e-navegacao.md) |
| 2 | Telemedicina e chat | 37 | 4 | [`02-telemedicina-e-chat.md`](02-telemedicina-e-chat.md) |
| 3 | Protocolos, receitas e laudos | 46 | 8 | [`03-protocolos-receitas-e-laudos.md`](03-protocolos-receitas-e-laudos.md) |
| 4 | Assistente de IA | 39 | 5 | [`04-assistente-de-ia.md`](04-assistente-de-ia.md) |
| 5 | Painel do médico | 40 | 4 | [`05-painel-do-medico.md`](05-painel-do-medico.md) |
| 6 | Triagem clínica | 31 | 2 | [`06-triagem-clinica.md`](06-triagem-clinica.md) |
| 7 | Histórico e evolução | 47 | 1 | [`07-historico-e-evolucao.md`](07-historico-e-evolucao.md) |
| 8 | Documentos do paciente | 11 | 1 | [`08-documentos-do-paciente.md`](08-documentos-do-paciente.md) |
| 9 | Dashboard do paciente | 20 | 1 | [`09-dashboard-do-paciente.md`](09-dashboard-do-paciente.md) |
| 10 | Modo Fácil (acessível) | 15 | 2 | [`10-modo-facil-acessivel.md`](10-modo-facil-acessivel.md) |
| 11 | Agendamento e consultas | 39 | 2 | [`11-agendamento-e-consultas.md`](11-agendamento-e-consultas.md) |
| 12 | Agenda e analytics do médico | 30 | 1 | [`12-agenda-e-analytics-do-medico.md`](12-agenda-e-analytics-do-medico.md) |
| 13 | Perfil do usuário | 28 | 1 | [`13-perfil-do-usuario.md`](13-perfil-do-usuario.md) |
| 14 | Área administrativa | 37 | 1 | [`14-area-administrativa.md`](14-area-administrativa.md) |
| 15 | Login e cadastro | 26 | 1 | [`15-login-e-cadastro.md`](15-login-e-cadastro.md) |
| 16 | Camada de dados (Supabase) | 33 | 0 | [`16-camada-de-dados-supabase.md`](16-camada-de-dados-supabase.md) |
| 17 | SOS e emergência | 30 | 0 | [`17-sos-e-emergencia.md`](17-sos-e-emergencia.md) |
| 18 | Rede de profissionais | 25 | 0 | [`18-rede-de-profissionais.md`](18-rede-de-profissionais.md) |
| 19 | Serviços de base e CSS | 37 | 0 | [`19-servicos-de-base-e-css.md`](19-servicos-de-base-e-css.md) |

**Por que esta ordem:** o módulo 1 contém os erros de execução que derrubam funcionalidades inteiras e a correção do CI — resolvê-lo primeiro faz o próprio pipeline passar a barrar regressão. Telemedicina e Protocolos vêm em seguida por concentrarem o risco clínico. Acessibilidade e CSS ficam no fim porque não afetam correção de dado.

## Regra clínica do projeto

O `.agents/AGENTS.md` deste repositório já proíbe exibir dado clínico simulado sem aviso, e determina que, com a IA offline, o app mostre erro em vez de renderizar laudo falso. **Cerca de 99 defeitos deste relatório são violações diretas dessa regra** — em todos eles, a decisão já está tomada: remover o dado inventado ou marcá-lo visivelmente como simulado. Não é necessário consultar o usuário item a item.

## Por que estes defeitos passaram

O `.github/workflows/main.yml` roda `npm ci`, `npm run build` e `ls dist/` — **não roda `npm run lint` nem testes**. Os 607 erros de ESLint, incluindo 3 `ReferenceError` garantidos em runtime, passam com o CI verde porque o Vite compila sem reclamar de variável não definida. A correção do CI está no módulo 1 e deve ser feita primeiro.
