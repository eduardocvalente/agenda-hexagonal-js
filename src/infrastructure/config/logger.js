'use strict';

const pino = require('pino');
const config = require('./env');

/**
 * Logger estruturado (JSON em stdout) com redaction de campos sensíveis.
 * Nada de console.log na aplicação: logs precisam ser parseáveis pela plataforma
 * de observabilidade e correlacionáveis por requestId.
 */
const logger = pino({
  level: config.logLevel,
  base: {
    service: 'cadastro-usuario',
    env: config.nodeEnv,
    version: process.env.APP_VERSION || 'dev',
  },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      'body.password',
      'body._csrf',
      'user.password',
      'err.config.headers',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(config.isDevelopment && process.stdout.isTTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : {}),
});

module.exports = logger;
