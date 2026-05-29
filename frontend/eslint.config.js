import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Hook-ORDER violations are the white-screen class (a hook after an early
      // return). This stays a hard error — it's the guard that would have caught
      // the JobDetailModal crash. Do not downgrade.
      'react-hooks/rules-of-hooks': 'error',
      // React-Compiler-readiness and style rules: kept visible as warnings so they
      // don't block commits. Adopt as a deliberate cleanup later.
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
