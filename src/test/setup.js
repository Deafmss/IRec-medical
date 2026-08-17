import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Desmonta os componentes entre testes — sem isso um teste
// enxerga o DOM deixado pelo anterior e passa/falha por engano.
afterEach(() => {
  cleanup()
})
