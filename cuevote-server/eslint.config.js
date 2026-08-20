// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'backups/**', 'logs/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        // Node 18+ exposes fetch globally; index.js checks for it at startup.
        fetch: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Unused function arguments are common in Node callbacks (err, req, res).
      // Flag unused variables, but allow deliberately-ignored args and catches.
      'no-unused-vars': ['error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        // `const { voters, suggestedBy, ...rest } = track` is how PII is
        // stripped before anything is sent to a client. The named siblings are
        // meant to be dropped, not read — that is the whole point.
        ignoreRestSiblings: true,
      }],
      // Defensive initialisers (`let scoreChange = 0`) are wanted here: if a
      // later branch forgets to assign, 0 keeps arithmetic sane where
      // `undefined` would silently poison a score with NaN.
      'no-useless-assignment': 'off',
      // A no-op catch is a decision, not an accident — but it must be marked.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
