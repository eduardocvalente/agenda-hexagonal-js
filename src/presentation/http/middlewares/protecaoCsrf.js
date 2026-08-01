'use strict';

const { randomBytes, timingSafeEqual } = require('node:crypto');
const { ForbiddenError } = require('../../../shared/errors');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TAMANHO_TOKEN = 32;

/**
 * Synchronizer Token Pattern sobre a sessão.
 *
 * Substitui o `csurf`, descontinuado pelo time do Express em set/2022. São
 * ~40 linhas auditáveis por inteiro, sem dependência sem manutenção no caminho
 * de segurança. Decisão registrada no ADR-0003.
 */
function emitirToken(sessao) {
  if (!sessao.csrfToken) {
    sessao.csrfToken = randomBytes(TAMANHO_TOKEN).toString('base64url');
  }
  return sessao.csrfToken;
}

/** Rotaciona o token — obrigatório em toda elevação de privilégio. */
function rotacionarToken(sessao) {
  sessao.csrfToken = randomBytes(TAMANHO_TOKEN).toString('base64url');
  return sessao.csrfToken;
}

/**
 * Comparação em tempo constante.
 *
 * `===` em string encerra no primeiro byte diferente, e a diferença de tempo é
 * mensurável pela rede — permitiria descobrir o token byte a byte.
 */
function comparacaoSegura(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function protecaoCsrf(req, res, next) {
  if (!req.session) {
    return next(new Error('protecaoCsrf exige express-session registrado antes dele.'));
  }

  const token = emitirToken(req.session);
  res.locals.csrfToken = token;

  if (METODOS_SEGUROS.has(req.method)) return next();

  const enviado =
    (req.body && req.body._csrf) || req.get('x-csrf-token') || req.get('x-xsrf-token');

  if (!enviado || !comparacaoSegura(enviado, token)) {
    return next(
      new ForbiddenError('Token CSRF inválido ou ausente.', { code: 'CSRF_TOKEN_INVALIDO' })
    );
  }

  return next();
}

module.exports = { protecaoCsrf, rotacionarToken, emitirToken };
