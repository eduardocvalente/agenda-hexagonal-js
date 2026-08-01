'use strict';

const mongoose = require('mongoose');
const config = require('../../config/env');
const logger = require('../../config/logger');

// Falha rápido em queries com campos fora do schema em vez de gravar lixo silenciosamente.
mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

let connectPromise = null;

function attachConnectionEvents() {
  const { connection } = mongoose;
  connection.on('disconnected', () =>
    logger.warn({ event: 'mongo.disconnected' }, 'MongoDB desconectado')
  );
  connection.on('reconnected', () =>
    logger.info({ event: 'mongo.reconnected' }, 'MongoDB reconectado')
  );
  connection.on('error', (err) =>
    logger.error({ event: 'mongo.error', err }, 'Erro de conexão com o MongoDB')
  );
}

/**
 * Conecta ao MongoDB com retry exponencial + jitter.
 * O driver já reconecta sozinho após a primeira conexão; o retry aqui cobre
 * o cenário de boot com o banco ainda indisponível (ordem de start em compose/ECS).
 */
async function connectWithRetry(retries, baseDelayMs) {
  attachConnectionEvents();

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      // Sequencial por natureza: cada tentativa depende do fracasso da anterior.
      // eslint-disable-next-line no-await-in-loop
      await mongoose.connect(config.mongo.uri, {
        serverSelectionTimeoutMS: config.mongo.serverSelectionTimeoutMs,
        maxPoolSize: config.mongo.maxPoolSize,
        minPoolSize: config.mongo.minPoolSize,
      });
      logger.info({ event: 'mongo.connected', attempt }, 'Conectado ao MongoDB');
      return mongoose.connection;
    } catch (err) {
      if (attempt === retries) {
        logger.fatal(
          { event: 'mongo.connect_failed', attempt, err },
          'Falha definitiva ao conectar no MongoDB'
        );
        throw err;
      }
      const jitter = Math.floor(Math.random() * baseDelayMs);
      const delay = baseDelayMs * 2 ** (attempt - 1) + jitter;
      logger.warn(
        { event: 'mongo.connect_retry', attempt, retries, delayMs: delay, err: err.message },
        'Falha ao conectar no MongoDB, tentando novamente'
      );
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return mongoose.connection;
}

function connect({ retries = 5, baseDelayMs = 500 } = {}) {
  // Memoiza a promise em vez do resultado: chamadas concorrentes compartilham a
  // mesma tentativa, e uma falha limpa o cache para permitir nova tentativa.
  if (!connectPromise) {
    connectPromise = connectWithRetry(retries, baseDelayMs).catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

async function disconnect() {
  connectPromise = null;
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info({ event: 'mongo.disconnected_graceful' }, 'Conexão com o MongoDB encerrada');
}

/** readyState 1 = connected. Usado pelo readiness probe. */
function isHealthy() {
  return mongoose.connection.readyState === 1;
}

async function ping() {
  if (!isHealthy()) return false;
  await mongoose.connection.db.admin().command({ ping: 1 });
  return true;
}

module.exports = { connect, disconnect, isHealthy, ping, mongoose };
