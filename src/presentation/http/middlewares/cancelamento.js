'use strict';

const { TEMPOS } = require('../../../shared/constants');
const { combinarSinais } = require('../../../shared/cancellation');
const { EVENTOS_LOG } = require('../../../shared/constants');

/**
 * Origem do cancelamento cooperativo: cria um `AbortController` por requisição
 * e o aborta quando o cliente desconecta.
 *
 * A partir daqui, `req.signal` desce por controller → caso de uso → repositório
 * → driver do MongoDB. Sem este ponto de origem, o resto da cadeia teria a
 * assinatura preparada para cancelamento e nada para propagar.
 *
 * Dois gatilhos, somados por `AbortSignal.any`:
 *  - `res.on('close')` antes de a resposta terminar: o usuário fechou a aba,
 *    cancelou a navegação ou a conexão caiu;
 *  - timeout absoluto: protege contra requisição que fica pendurada porque uma
 *    dependência nunca responde.
 *
 * Sem isso, uma requisição abandonada continua consumindo banco e CPU até o
 * fim — sob carga, é trabalho que ninguém vai receber.
 */
function cancelamentoPorRequisicao({ timeoutMs = TEMPOS.TIMEOUT_REQUISICAO_MS } = {}) {
  return function middlewareCancelamento(req, res, next) {
    const controller = new AbortController();

    const aoFechar = () => {
      // `res.writableEnded` distingue "resposta concluída" de "cliente sumiu".
      // Sem essa checagem, toda requisição bem-sucedida seria contada como
      // cancelada no fechamento normal da conexão.
      if (!res.writableEnded) {
        controller.abort(new Error('Cliente encerrou a conexão'));
        req.log?.debug?.(
          { evento: EVENTOS_LOG.REQUISICAO_CANCELADA, path: req.originalUrl },
          'Requisição abandonada pelo cliente'
        );
      }
    };

    res.on('close', aoFechar);
    res.on('finish', () => res.removeListener('close', aoFechar));

    req.abortController = controller;
    req.signal = combinarSinais(controller.signal, AbortSignal.timeout(timeoutMs));

    next();
  };
}

module.exports = { cancelamentoPorRequisicao };
