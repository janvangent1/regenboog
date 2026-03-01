const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'venv/**', 'deploy/**', 'scripts/**'],
  },
  // Browser files (public/js/)
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        io: 'readonly',
        escapeHtml: 'readonly',
        playSound: 'readonly',
        RegenboogCore: 'readonly',
        LeaderboardUI: 'readonly',
        RegenboogAnalytics: 'readonly',
        AnimalIcons: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'eqeqeq': ['warn', 'smart'],
      'no-extra-semi': 'warn',
      'no-unreachable': 'error',
      'no-duplicate-case': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },
  // Server files (server/)
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'eqeqeq': ['warn', 'smart'],
      'no-extra-semi': 'warn',
      'no-unreachable': 'error',
      'no-duplicate-case': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },
];
