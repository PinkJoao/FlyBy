// =============================================================================
// eslint.config: configuração do ESLint (flat config)
// =============================================================================
// O QUE FAZ
//   Regras recomendadas do JS, dos hooks do React e do react-refresh (Vite) para
//   todo .js/.jsx, com os globais do navegador e JSX ligado.
//
// DECISÕES E ARMADILHAS
//   - 'DnD Source Material' fica fora do lint: é o snapshot in-repo do 5etools
//     (DDL-0037), com eslint.config próprio e dependências ausentes; não é código
//     nosso.
// -----------------------------------------------------------------------------

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'DnD Source Material']),
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
])
