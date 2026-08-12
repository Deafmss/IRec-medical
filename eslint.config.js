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
])
