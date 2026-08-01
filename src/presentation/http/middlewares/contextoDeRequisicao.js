'use strict';

const { randomUUID } = require('node:crypto');
const pinoHttp = require('pino-http');
const logger = require('../../../infrastructure/config/logger');

/**
 * Correlation ID e log de acesso.
 *
 * Honra o cabeçalho vindo do balanceador quando existe, senão gera um. O id é
 * ecoado na resposta e exibido na página de erro, para que o usuário possa
 * citá-lo em um chamado e o operador achar exatamente aquela requisição.
 */
const registroDeRequisicoes = pinoHttp({
  logger,
  genReqId(req, res) {
    const recebido = req.headers['x-request-id'] || req.headers['x-amzn-trace-id'];
    const id = typeof recebido === 'string' && recebido.length <= 200 ? recebido : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    // Probes rodam a cada poucos segundos: registrá-los inundaria o log e
    // aumentaria o custo de ingestão sem nenhuma informação útil.
    if (req.url === '/healthz' || req.url === '/readyz') return 'silent';
    return 'info';
  },
  customProps: (req) => ({ usuarioId: req.session?.user?.id }),
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = { registroDeRequisicoes };
