'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../../../infrastructure/config/env');
const logger = require('../../../infrastructure/config/logger');

const aoAtingirLimite = (rotulo) => (req, res, next, opcoes) => {
  logger.warn(
    { evento: 'ratelimit.bloqueado', rotulo, ip: req.ip, path: req.originalUrl, requestId: req.id },
    'Rate limit atingido'
  );
  req.flash?.('errors', 'Muitas requisições. Aguarde alguns instantes e tente novamente.');
  res.status(opcoes.statusCode);

  if (req.accepts(['html', 'json']) === 'json') {
    return res.json({ title: 'Too Many Requests', status: opcoes.statusCode });
  }
  return res.render('error', {
    status: opcoes.statusCode,
    message: 'Muitas requisições. Aguarde alguns instantes e tente novamente.',
    requestId: req.id,
  });
};

/** Limite amplo: contém varredura e flood genérico. */
const limiteGlobal = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/healthz' || req.path === '/readyz',
  handler: aoAtingirLimite('global'),
});

/**
 * Limite estreito para autenticação.
 *
 * Protege contra credential stuffing e, igualmente importante, contra DoS: o
 * bcrypt consome ~250 ms de CPU por tentativa, então poucas requisições por
 * segundo bastam para saturar o processo.
 */
const limiteDeAutenticacao = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.authRateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: aoAtingirLimite('autenticacao'),
});

module.exports = { limiteGlobal, limiteDeAutenticacao };
