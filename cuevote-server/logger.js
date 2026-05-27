// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redaction paths cover top-level fields AND one nested layer deep,
  // because the previous top-level-only config would not catch the
  // common pattern logger.info({ user: { email } }, "..."). Pino paths
  // are exact-or-wildcard — there is no recursive catch-all, so the
  // common containers (user.*, payload.*) are listed explicitly.
  redact: {
    paths: [
      // top-level
      'token', 'password', 'sessionToken', 'email',
      // one level deep, any key
      '*.token', '*.password', '*.sessionToken', '*.email',
      // common containers used in ws.send / logger calls
      'user.email', 'user.token',
      'payload.token', 'payload.password', 'payload.sessionToken',
      'payload.user.email', 'payload.user.token',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
