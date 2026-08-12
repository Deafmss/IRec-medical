# 0. URGENTE — Cota do Gemini e modelo descontinuado

> **Leia este arquivo antes de qualquer outro módulo.** Ele não é uma lista nova de defeitos: é o contexto que muda a prioridade de três defeitos já catalogados. Sem ele, eles parecem irrelevantes.

## O fato que muda tudo: a cota real é de 20 requisições por dia

Verificado em 11/08/2026 no painel do AI Studio, projeto `IRec`, nível gratuito:

| Modelo | RPM | TPM | RPD |
|---|---|---|---|
| **Gemini 2.5 Flash** | **5** | 250.000 | **20** |
| Gemini Embedding 1 | 100 | 30.000 | 1.000 |

O projeto possui **8 chaves em 8 projetos distintos** do Google Cloud. Como o limite do Gemini é aplicado **por projeto, não por chave**, o rodízio implementado em `geminiService.js` é legítimo e soma:

- **160 requisições por dia** no total
- **5 requisições por minuto** dentro de cada projeto

Cada triagem de ferida com foto consome uma requisição. **160/dia é o teto de toda a inteligência do aplicativo.** Nenhuma conta tem forma de pagamento configurada, então estourar a cota devolve `429` — não gera fatura.

Fontes: [documentação oficial de limites](https://ai.google.dev/gemini-api/docs/rate-limits) · painel do projeto em [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit)

---

## A-1 · CRÍTICO · CONFIRMADO — O modelo chamado pelo front não existe mais

**Onde:** `src/services/geminiService.js` — 8 ocorrências de `gemini-1.5-flash`

**Confirmado pelo usuário em 11/08/2026: `gemini-1.5-flash` foi retirado e a IA do aplicativo está fora do ar.** Toda chamada retorna `404`.

O painel do AI Studio deste projeto lista Gemini 2.5 Flash, não o 1.5. A página oficial de descontinuações cobre as famílias 3, 2.5 e 2.0 — a 1.5 não aparece, por já ter sido removida. O gráfico de uso registra pico de apenas 3 RPD, compatível com chamadas que morrem no início.

**Agravante:** o defeito `IREC-0171` faz um `404` remover permanentemente todas as chaves do rodízio. Ou seja, a primeira chamada derruba o pool inteiro de 8 chaves até o app reiniciar.

**Inconsistência:** a Edge Function em `supabase/functions/gemini-analysis/index.ts` usa `gemini-2.5-flash`, enquanto o front usa `gemini-1.5-flash`. Os dois caminhos precisam usar a mesma fonte de verdade.

---

### A-2 · A correção pedida: selecionar sempre o melhor modelo disponível

O usuário pediu que o app deixe de ter modelo fixo e passe a usar sempre a versão mais recente disponível. **Não implemente isso com o alias `-latest`.**

**Por que não o alias:** a documentação do Google diz que aliases como `gemini-flash-latest` podem apontar para versões *preview* ou *experimentais*, com breaking changes e limites de taxa mais restritos. Num app clínico, o modelo trocar sozinho pode alterar o resultado de uma triagem sem ninguém perceber — exatamente o tipo de falha silenciosa que o `.agents/AGENTS.md` deste repositório proíbe.

**Implemente descoberta dinâmica com lista de preferência de versões estáveis.** Assim o app nunca mais quebra por modelo retirado, e ainda assim só usa versões estáveis.

#### Desenho

1. **Lista de preferência**, da melhor para a mais antiga, somente IDs estáveis:
   ```js
   const MODELOS_PREFERIDOS = [
     'gemini-3.6-flash',
     'gemini-3.5-flash',
     'gemini-2.5-flash',
   ];
   ```

2. **Descobrir o que existe**, uma vez por sessão, via `ListModels`:
   ```
   GET https://generativelanguage.googleapis.com/v1beta/models?key=<chave>
   ```
   Filtrar por modelos que suportem `generateContent` e escolher o primeiro da lista de preferência que apareça no retorno.

3. **Cachear a escolha** em memória e em `localStorage` com validade de 24 h. A descoberta deve custar **uma** requisição por sessão, não uma por chamada — o orçamento é de 20 RPD por projeto.

4. **Cadeia de fallback**, nesta ordem: modelo descoberto → último modelo bom em cache → `gemini-2.5-flash` fixo. O app nunca deve ficar sem modelo por falha de descoberta.

5. **Registrar quando a escolha mudar.** Se o modelo selecionado hoje for diferente do de ontem, gravar no console e no log de auditoria. Mudança de modelo em app clínico não pode ser silenciosa.

6. **Usar a mesma lógica na Edge Function** `supabase/functions/gemini-analysis/index.ts`, para que front e servidor nunca divirjam de novo.

#### Por que descoberta é melhor que fixar o 3.6

O painel deste projeto mostra apenas Gemini 2.5 Flash. As famílias 3.5 e 3.6 existem, mas podem não estar liberadas para este projeto no nível gratuito. Fixar `gemini-3.6-flash` no código quebraria tudo de novo, do mesmo jeito. A descoberta faz o app usar o melhor modelo **que este projeto realmente tem acesso**, sem ninguém precisar saber qual é.

#### Verificação manual (o usuário roda, a chave não passa por chat)

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE" \
  | grep -o '"name": "models/gemini[^"]*"'
```

**Feito quando:**
- Uma triagem com foto retorna análise real e o painel do AI Studio registra a requisição
- Desligar a rede e religar não deixa o app sem modelo (o cache assume)
- Nenhuma string `gemini-1.5` permanece no código: `grep -rn "gemini-1\.5" src/ supabase/` não retorna nada

---

## Três defeitos já catalogados que sobem de prioridade

Estes já estão no relatório. O que muda é a urgência, agora que se sabe que o orçamento é de 160 requisições por dia.

### `IREC-0171` · `src/services/geminiService.js:151` — **eleve para CRÍTICO**

Um erro `404` remove **permanentemente todas as chaves válidas** do rodízio. Uma única chamada a um modelo inexistente zera o pool inteiro de 8 chaves até o app ser reiniciado.

Combinado com **A-1**, este é provavelmente o motivo de a IA não estar funcionando. Corrija os dois juntos: primeiro o modelo, depois esta rotina, para que um `404` futuro nunca mais derrube o pool.

> Módulo 4 · `04-assistente-de-ia.md`

### `IREC-0401` · `src/services/geminiService.js:428` — **eleve para ALTO**

A mensagem do usuário é enviada **duas vezes ao modelo a cada turno do chat**. Com cota de 1.500/dia isso seria desperdício; com 160/dia, é **metade do orçamento diário jogado fora**.

É a correção de maior retorno por linha alterada de todo o relatório.

> Módulo 4 · `04-assistente-de-ia.md`

### `IREC-0031` · `src/services/geminiService.js:3` — mantém CRÍTICO

As 8 chaves são embutidas no bundle público via `import.meta.env.VITE_*`. Verificado: elas aparecem em texto claro em `dist/assets/index-*.js` e nas cópias em `android/` e `ios/`.

**Situação atual:** ambiente de teste controlado, app nunca publicado, nenhum APK distribuído. **Não há vazamento — há o risco de haver no primeiro deploy.**

**Correção estrutural:** mover o rodízio para a Edge Function `supabase/functions/gemini-analysis/`, que já existe. As chaves passam a viver nos secrets do Supabase (`supabase secrets set`) e somem do `.env`. O front chama a Edge Function em vez de chamar o Google direto.

Isso também permite cache no servidor — que, com 160 requisições por dia, economiza mais cota do que o rodízio.

**Prazo:** obrigatório antes do primeiro deploy público. As chaves não estão no histórico do git (`dist/` e os assets do Android estão no `.gitignore`), então o repositório está limpo.

> Módulo 4 · `04-assistente-de-ia.md`

---

## Ordem sugerida

1. **A-1 + A-2** — implementar a seleção dinâmica de modelo, no front e na Edge Function. Isso devolve a IA ao ar e impede que uma futura retirada de modelo derrube o app de novo.
2. **IREC-0171** — parar de destruir o pool de chaves em erro `404`. Sem isso, qualquer 404 futuro volta a zerar as 8 chaves.
3. **IREC-0401** — parar de enviar a mensagem duas vezes. Dobra a cota útil de 160 para o equivalente a 320 interações.
4. **IREC-0031** — mover as chaves para a Edge Function. Obrigatório antes do primeiro deploy público; não precisa ser hoje.

Os itens 1 a 3 são poucas linhas e, juntos, devolvem a IA ao ar e dobram o orçamento diário.

> **Nota para quem for implementar:** os itens 1 e 2 são complementares e devem ir juntos. A seleção dinâmica evita o `404`; a correção do `IREC-0171` garante que, se um `404` acontecer mesmo assim, o app degrade em vez de perder todas as chaves.
