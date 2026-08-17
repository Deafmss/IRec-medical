import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    // e2e fica com o Playwright — teste unitário não roda navegador.
    exclude: ['node_modules', 'dist', 'tests', 'e2e', 'playwright'],
  },
})
