import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // android/ e ios/ contêm o bundle já compilado copiado pelo Capacitor.
  // Sem ignorá-los, o ESLint analisa o JS minificado e reporta centenas de
  // erros que não existem no código-fonte.
  globalIgnores(['dist', 'android', 'ios']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // O service worker roda em ServiceWorkerGlobalScope, onde `clients`,
    // `self` e `registration` são globais legítimos.
    files: ['public/sw.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // Testes do Vitest e arquivos de configuração rodam em Node, não no
    // navegador: `process`, `__dirname` e afins são globais legítimos ali.
    // Sem isto, um teste que leia arquivo do disco reprova em `no-undef` — que
    // é uma das regras fatais do portão de CI (scripts/ci-lint-gate.mjs).
    files: ['src/test/**/*.{js,jsx}', 'tests/**/*.{js,jsx}', '*.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
