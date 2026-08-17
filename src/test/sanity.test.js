import { it, expect } from 'vitest'

// Teste de sanidade da infraestrutura. Nao remova.
// Comprova que o runner esta ativo e que `npm test` de fato roda.
// A prova negativa (trocar 2 por 3 e ver reprovar) foi executada no setup.
it('a rede de seguranca esta ativa', () => {
  expect(1 + 1).toBe(2)
})
