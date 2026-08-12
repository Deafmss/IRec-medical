#!/usr/bin/env node
/**
 * Portão de lint do CI — iRec
 *
 * O projeto tem centenas de avisos de ESLint acumulados (variáveis não usadas,
 * dependências de hooks, etc). Quebrar o CI em todos eles deixaria o pipeline
 * permanentemente vermelho, e um CI sempre vermelho é um CI ignorado.
 *
 * Este portão falha apenas nas regras que indicam DEFEITO GARANTIDO em runtime
 * — código que vai lançar exceção ou nunca executar. O build do Vite não pega
 * nenhuma delas, porque ele não resolve identificadores em tempo de compilação.
 *
 * Contexto: em 11/08/2026 uma auditoria encontrou 3 ReferenceError e 1 `case`
 * duplicado que estavam em produção justamente porque o CI só rodava `vite build`.
 * Ver `.agents/bugs/INDEX.md`.
 *
 * Para rodar localmente:  npm run lint:ci
 */

import { ESLint } from 'eslint';

/** Regras que reprovam o build. Cada uma significa "isto é um bug", não estilo. */
const REGRAS_FATAIS = new Set([
  'no-undef',                  // ReferenceError garantido em runtime
  'no-duplicate-case',         // ramo do switch inalcançável
  'no-unreachable',            // código morto após return/throw
  'no-func-assign',            // reatribuição de declaração de função
  'no-dupe-keys',              // chave duplicada em objeto literal
  'no-dupe-args',              // parâmetro duplicado
  'no-dupe-else-if',           // condição repetida na cadeia else-if
  'no-cond-assign',            // atribuição onde se esperava comparação
  'no-self-compare',           // comparação de uma variável consigo mesma
  'no-sparse-arrays',          // vírgula sobrando criando buraco no array
  'valid-typeof',              // comparação de typeof com string inválida
  'getter-return',             // getter sem return
  'no-obj-calls',              // chamada de objeto global não invocável
  'no-import-assign',          // atribuição a binding de import
  'no-const-assign',           // atribuição a const
  'no-class-assign',           // atribuição a declaração de classe
  'no-setter-return',          // return com valor dentro de setter
  'no-unsafe-negation',        // `!a in b` em vez de `!(a in b)`
  'no-unsafe-optional-chaining',
  'react-hooks/rules-of-hooks', // hook condicional quebra a ordem dos hooks
]);

const eslint = new ESLint();
const resultados = await eslint.lintFiles(['.']);

const fatais = [];
for (const arquivo of resultados) {
  for (const msg of arquivo.messages) {
    if (msg.ruleId && REGRAS_FATAIS.has(msg.ruleId)) {
      fatais.push({
        arquivo: arquivo.filePath.replace(process.cwd(), '').replace(/^[\\/]/, '').replace(/\\/g, '/'),
        linha: msg.line,
        regra: msg.ruleId,
        mensagem: msg.message,
      });
    }
  }
}

if (fatais.length === 0) {
  console.log('OK — nenhum erro de runtime detectado pelo ESLint.');
  process.exit(0);
}

console.error(`\nReprovado: ${fatais.length} erro(s) que quebram em runtime.\n`);
for (const f of fatais) {
  console.error(`  ${f.arquivo}:${f.linha}  [${f.regra}]  ${f.mensagem}`);
}
console.error(`\nEstas regras indicam defeito, não estilo. Corrija antes de fazer merge.`);
console.error(`Os defeitos conhecidos estão catalogados em .agents/bugs/INDEX.md\n`);
process.exit(1);
