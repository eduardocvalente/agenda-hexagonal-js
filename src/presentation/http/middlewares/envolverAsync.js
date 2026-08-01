'use strict';

/**
 * Encaminha rejeições de handlers `async` para o tratamento de erros.
 *
 * O Express 4 não aguarda o retorno do handler: uma promise rejeitada não vira
 * erro HTTP, vira `unhandledRejection` — e desde o Node 15 isso derruba o
 * processo. Uma única requisição com id malformado bastava para tirar a
 * aplicação do ar (achado ACH-004).
 *
 * Todo handler assíncrono passa por aqui. O `Express 5` já faz isso nativamente;
 * quando a atualização acontecer, este wrapper vira no-op e pode sair.
 */
function envolverAsync(handler) {
  return function handlerEnvolvido(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { envolverAsync };
