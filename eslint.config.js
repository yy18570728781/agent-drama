import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'out/**',
      'node_modules/**',
      'examples/**',
      'public/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'no-empty': 'warn',
      'no-redeclare': 'warn',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-unsafe-finally': 'warn',
      'no-useless-assignment': 'warn',
      'prefer-const': 'warn',
      'preserve-caught-error': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'vue/multi-word-component-names': 'off',
      'vue/no-mutating-props': 'warn',
      'vue/no-ref-as-operand': 'warn',
      'vue/no-reserved-component-names': 'warn',
      'vue/no-unused-components': 'warn',
      'vue/no-v-html': 'warn',
      'vue/require-toggle-inside-transition': 'warn',
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
)
