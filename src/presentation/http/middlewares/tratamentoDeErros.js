'use strict';

const mongoose = require('mongoose');

const config = require('../../../infrastructure/config/env');
const pino = require('../../../infrastructure/config/logger');
const { ApplicationError } = require('../../../shared/errors/ApplicationError');
const {
  NotFoundError,
  ValidationError,
  ConflictError,
  InternalServerError,
  CancelledError,
  BadRequestError,
} = require('../../../shared/errors');

const MENSAGENS_POR_TIPO = Object.freeze({
  'entity.too.large': 'O conteúdo enviado excede o limite permitido.',
  'entity.parse.failed': 'Corpo da requisição malformado.',
  'entity.verify.failed': 'Não foi possível validar o corpo da requisição.',
  'charset.unsupported': 'Codificação de caracteres não suportada.',
  'encoding.unsupported': 'Codificação de conteúdo não suportada.',
});

/** 404 real: nenhuma rota casou. Precisa vir depois de todas as rotas. */
function rotaNaoEncontrada(req, res, next) {
  next(new NotFoundError('Página não encontrada.'));
}

/**
 * Anti-corruption layer para erros: converte qualquer coisa que chegue aqui em
 * `ApplicationError`.
 *
 * A camada HTTP não deve conhecer `CastError` do Mongoose nem o código 11000 do
 * MongoDB. Essa tradução acontece nos adaptadores, e esta função é a rede de
 * segurança para o que escapar.
 */
function normalizar(erro) {
  if (erro instanceof ApplicationError) return erro;

  if (erro instanceof mongoose.Error.CastError) {
    return new ValidationError('Identificador inválido.', { cause: erro });
  }
  if (erro instanceof mongoose.Error.ValidationError) {
    return new ValidationError('Dados inválidos.', { cause: erro });
  }
  if (erro?.code === 11000) {
    return new ConflictError('Registro já existente.', { cause: erro });
  }
  if (erro?.name === 'AbortError' || erro?.name === 'TimeoutError') {
    return new CancelledError('Operação cancelada.', { cause: erro });
  }

  // body-parser e bibliotecas baseadas em http-errors já classificam o erro
  // (413 entity.too.large, 400 entity.parse.failed). Rebaixar isso a 500
  // esconderia erro do cliente como falha do servidor e poluiria o SLO.
  const status = erro?.status ?? erro?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    const mensagem = MENSAGENS_POR_TIPO[erro.type] || 'Requisição inválida.';
    const Classe = status === 404 ? NotFoundError : BadRequestError;
    const instancia = new Classe(mensagem, { cause: erro });
    // Preserva o status original (413, 415…) mesmo usando a classe genérica.
    Object.defineProperty(instancia, 'status', { value: status, enumerable: true });
    return instancia;
  }

  return new InternalServerError('Erro interno.', { cause: erro });
}

// eslint-disable-next-line no-unused-vars -- Express reconhece error handler pela aridade 4
function tratamentoDeErros(erro, req, res, next) {
  const appError = normalizar(erro);
  // `req.log` é o logger filho do pino-http, já com o requestId embutido.
  const log = req.log ?? pino;

  // Cancelamento não é falha do servidor: registrar como erro faria o alarme de
  // 5xx disparar toda vez que um usuário fechasse a aba.
  const nivel =
    appError instanceof CancelledError ? 'debug' : appError.status >= 500 ? 'error' : 'warn';

  log[nivel](
    {
      evento: 'http.erro',
      requestId: req.id,
      metodo: req.method,
      path: req.originalUrl,
      usuarioId: req.session?.user?.id,
      erro: appError.toJSON(),
      ...(config.isProduction ? {} : { stack: appError.stack }),
    },
    appError.message
  );

  if (res.headersSent) return next(erro);

  // Cliente já foi embora: não há a quem responder, e tentar renderizar
  // desperdiça CPU em uma conexão morta.
  if (appError instanceof CancelledError && !res.writableEnded) {
    return res.end();
  }

  res.status(appError.status);

  const querJson = req.accepts(['html', 'json']) === 'json' || req.originalUrl.startsWith('/api');

  if (querJson) {
    // RFC 7807 — Problem Details
    return res.type('application/problem+json').json({
      type: 'about:blank',
      title: appError.publicMessage,
      status: appError.status,
      code: appError.code,
      instance: req.originalUrl,
      requestId: req.id,
      ...(config.isProduction ? {} : { detail: appError.rootCause?.message }),
    });
  }

  return res.render('error', {
    status: appError.status,
    message: appError.publicMessage,
    requestId: req.id,
  });
}

module.exports = { rotaNaoEncontrada, tratamentoDeErros, normalizar };
