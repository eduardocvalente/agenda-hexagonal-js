'use strict';

require('dotenv').config();

const { createHash } = require('node:crypto');

const VALID_ENVS = ['development', 'test', 'staging', 'production'];

function fail(messages) {
  const list = messages.map((m) => `  - ${m}`).join('\n');
  throw new Error(`Configuração inválida. Corrija as variáveis de ambiente:\n${list}`);
}

function readInt(name, fallback, { min, max } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed))
    return { __invalid: `${name} deve ser um inteiro (recebido: "${raw}")` };
  if (min !== undefined && parsed < min) return { __invalid: `${name} deve ser >= ${min}` };
  if (max !== undefined && parsed > max) return { __invalid: `${name} deve ser <= ${max}` };
  return parsed;
}

function readBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const errors = [];
const collect = (value, label) => {
  if (value && typeof value === 'object' && value.__invalid) {
    errors.push(value.__invalid);
    return undefined;
  }
  if (label && (value === undefined || value === '')) errors.push(label);
  return value;
};

const nodeEnv = process.env.NODE_ENV || 'development';
if (!VALID_ENVS.includes(nodeEnv)) {
  errors.push(`NODE_ENV deve ser um de: ${VALID_ENVS.join(', ')} (recebido: "${nodeEnv}")`);
}

const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

// CONNECTIONSTRING mantido como alias para compatibilidade com a versão anterior.
const mongoUri = collect(
  process.env.MONGODB_URI || process.env.CONNECTIONSTRING,
  'MONGODB_URI é obrigatória (string de conexão do MongoDB)'
);

const sessionSecret = collect(
  process.env.SESSION_SECRET,
  'SESSION_SECRET é obrigatória (gere com: openssl rand -hex 32)'
);

if (sessionSecret && sessionSecret.length < 32) {
  errors.push('SESSION_SECRET deve ter no mínimo 32 caracteres');
}

/**
 * Segredos recusados, identificados por hash SHA-256.
 *
 * A lista guarda hashes, não os valores em claro: um deles é o segredo que
 * esteve em uso numa versão antiga deste projeto, e repeti-lo aqui em texto
 * seria publicá-lo de novo a cada leitura do código. O hash cumpre a mesma
 * função — reconhecer o valor — sem revelá-lo.
 */
const WEAK_SECRET_HASHES = new Set([
  // 'secret'
  '2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b',
  // 'changeme'
  '057ba03d6c44104863dc7361fe4578965d1887360f90a0895882e58a6248fc86',
  // Segredo comprometido de uma versão anterior deste projeto.
  '9626695e70d8ab37c7cb3fed85999399b33fd5649ef042dca6c3deb046daaf7f',
]);
if (sessionSecret) {
  const hash = createHash('sha256').update(sessionSecret).digest('hex');
  if (WEAK_SECRET_HASHES.has(hash)) {
    errors.push('SESSION_SECRET usa um valor conhecido/comprometido — gere um novo segredo');
  }
}

const port = collect(readInt('PORT', 3000, { min: 1, max: 65535 }));
const bcryptRounds = collect(readInt('BCRYPT_ROUNDS', isTest ? 4 : 12, { min: 4, max: 15 }));
const sessionMaxAgeMs = collect(
  readInt('SESSION_MAX_AGE_MS', 1000 * 60 * 60 * 12, { min: 60_000 })
);
const shutdownTimeoutMs = collect(readInt('SHUTDOWN_TIMEOUT_MS', 10_000, { min: 1_000 }));
const rateLimitWindowMs = collect(readInt('RATE_LIMIT_WINDOW_MS', 60_000, { min: 1_000 }));
const rateLimitMax = collect(readInt('RATE_LIMIT_MAX', 300, { min: 1 }));
const authRateLimitMax = collect(readInt('AUTH_RATE_LIMIT_MAX', 10, { min: 1 }));
const trustProxyHops = collect(
  readInt('TRUST_PROXY_HOPS', isProduction ? 1 : 0, { min: 0, max: 10 })
);
// Retenção da trilha de auditoria. Guardar dado pessoal além da finalidade é
// irregular pela LGPD, e a collection cresce sem parar — o teto é obrigatório.
const auditoriaRetencaoDias = collect(
  readInt('AUDITORIA_RETENCAO_DIAS', 180, { min: 1, max: 3_650 })
);

const cookieSecure = readBool('COOKIE_SECURE', isProduction);
if (isProduction && !cookieSecure) {
  errors.push('COOKIE_SECURE não pode ser desativado em produção (cookies de sessão sem TLS)');
}

if (errors.length > 0) fail(errors);

const config = Object.freeze({
  nodeEnv,
  isProduction,
  isTest,
  isDevelopment: nodeEnv === 'development',
  port,
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  trustProxyHops,
  shutdownTimeoutMs,
  mongo: Object.freeze({
    uri: mongoUri,
    serverSelectionTimeoutMs: 5_000,
    maxPoolSize: collect(readInt('MONGO_MAX_POOL_SIZE', 10, { min: 1 })) || 10,
    minPoolSize: collect(readInt('MONGO_MIN_POOL_SIZE', 0, { min: 0 })) || 0,
  }),
  session: Object.freeze({
    secret: sessionSecret,
    name: process.env.SESSION_COOKIE_NAME || 'sid',
    maxAgeMs: sessionMaxAgeMs,
    secure: cookieSecure,
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
  }),
  security: Object.freeze({
    bcryptRounds,
    rateLimitWindowMs,
    rateLimitMax,
    authRateLimitMax,
    cdnHosts: Object.freeze(['https://cdn.jsdelivr.net', 'https://code.jquery.com']),
  }),
  auditoria: Object.freeze({
    retencaoDias: auditoriaRetencaoDias,
  }),
});

module.exports = config;
