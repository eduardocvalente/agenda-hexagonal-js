'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');

const config = require('../../infrastructure/config/env');
const { mongoose } = require('../../infrastructure/persistence/mongoose/connection');
const { construirContainer } = require('../../infrastructure/container/composicao');

const { cabecalhosDeSeguranca } = require('./middlewares/cabecalhosDeSeguranca');
const { registroDeRequisicoes } = require('./middlewares/contextoDeRequisicao');
const { cancelamentoPorRequisicao } = require('./middlewares/cancelamento');
const { limiteGlobal } = require('./middlewares/limiteDeRequisicoes');
const { protecaoCsrf } = require('./middlewares/protecaoCsrf');
const { contextoDeExecucao } = require('./middlewares/contextoDeExecucao');
const { contextoDeView } = require('./middlewares/sessao');
const { rotaNaoEncontrada, tratamentoDeErros } = require('./middlewares/tratamentoDeErros');
const rotasDeSaude = require('./routes/health');
const { construirRotas } = require('./routes');

/**
 * Adaptador de entrada HTTP.
 *
 * Monta a aplicação Express sem abrir sockets nem conectar ao banco — essa
 * separação entre "montar" e "servir" é o que permite testar por supertest sem
 * subir porta e sem depender de ordem de boot.
 *
 * A ordem dos middlewares não é arbitrária; cada posição está comentada onde
 * a troca causaria defeito.
 */
function criarAplicacao({ container = construirContainer() } = {}) {
  // O store de sessão reaproveita o cliente já conectado do Mongoose. Passar
  // `mongoUrl` faria o connect-mongo abrir um SEGUNDO pool que nenhum caminho
  // de código fecha — dobrando conexões e impedindo o processo de encerrar.
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      'criarAplicacao() exige uma conexão ativa com o MongoDB: chame connection.connect() antes.'
    );
  }

  const app = express();

  // Atrás de ALB/Ingress, sem isso `req.ip` é o IP do proxy: o rate limit vira
  // global (todos os usuários no mesmo contador) e o cookie `secure` não
  // reconhece a terminação TLS na borda.
  app.set('trust proxy', config.trustProxyHops);
  app.set('sessionCookieName', config.session.name);
  app.disable('x-powered-by');
  app.set('views', path.resolve(__dirname, 'views'));
  app.set('view engine', 'ejs');

  app.use(registroDeRequisicoes);
  app.use(cancelamentoPorRequisicao());
  app.use(cabecalhosDeSeguranca);

  // Probes antes de sessão, rate limit e CSRF: precisam responder mesmo com o
  // store de sessão degradado, e não devem criar uma sessão a cada checagem.
  app.use(rotasDeSaude);

  app.use(limiteGlobal);
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '100kb' }));

  app.use(
    express.static(path.resolve(__dirname, '..', '..', '..', 'public'), {
      maxAge: config.isProduction ? '7d' : 0,
      etag: true,
      index: false,
      dotfiles: 'ignore',
    })
  );

  app.use(
    session({
      name: config.session.name,
      secret: config.session.secret,
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        ttl: Math.floor(config.session.maxAgeMs / 1000),
        touchAfter: 24 * 3600,
        crypto: { secret: config.session.secret },
      }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: config.session.maxAgeMs,
        httpOnly: true,
        secure: config.session.secure,
        sameSite: config.session.sameSite,
        path: '/',
      },
    })
  );

  app.use(flash());
  // DEPOIS da sessão (de onde vem o usuarioId) e do pino-http (de onde vem o
  // requestId): antes de qualquer um dos dois, o contexto nasceria vazio.
  app.use(contextoDeExecucao);
  app.use(protecaoCsrf);
  app.use(contextoDeView);
  app.use(construirRotas(container));

  app.use(rotaNaoEncontrada);
  app.use(tratamentoDeErros);

  return app;
}

module.exports = { criarAplicacao };
