'use strict';

const helmet = require('helmet');
const config = require('../../../infrastructure/config/env');

/**
 * Política de segurança de conteúdo explícita.
 *
 * A CSP padrão do helmet usa `script-src 'self'`, o que bloqueia jQuery, Popper
 * e Bootstrap servidos por CDN nas views — a navbar colapsável para de
 * funcionar sem nenhum erro no servidor. Declarar a política explicitamente é
 * o que impede a "correção" comum de simplesmente desligar a CSP inteira.
 */
const cdn = config.security.cdnHosts;

const cabecalhosDeSeguranca = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'font-src': ["'self'", 'https:', 'data:'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'img-src': ["'self'", 'data:'],
      'object-src': ["'none'"],
      'script-src': ["'self'", ...cdn],
      'script-src-attr': ["'none'"],
      'style-src': ["'self'", "'unsafe-inline'", ...cdn],
      // Os mesmos CDNs do script-src: com DevTools aberto o navegador busca
      // os source maps (.map) via fetch, e bloquear só gera ruído no console.
      'connect-src': ["'self'", ...cdn],
      ...(config.isProduction ? { 'upgrade-insecure-requests': [] } : {}),
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: config.isProduction
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
    : false,
  referrerPolicy: { policy: 'same-origin' },
});

module.exports = { cabecalhosDeSeguranca };
