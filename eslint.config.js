// ESLint flat config — tuned for this vanilla-JS browser SPA.
// Goal: catch real bugs (undefined vars, unreachable code, bad syntax)
// without fighting the existing code style.
import globals from 'globals';

export default [
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Cross-module window-scoped hooks used intentionally by the app
        gtag: 'readonly',
      },
    },
    rules: {
      // Real-bug catchers
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-self-assign': 'error',
      'no-compare-neg-zero': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      'no-async-promise-executor': 'error',

      // Warnings — useful signal, not blockers
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // Intentional patterns in this codebase — off
      'no-console': 'off',
      'no-prototype-builtins': 'off',
    },
  },
  {
    files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**', 'assets/**'],
  },
];
