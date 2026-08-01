'use strict';

const { Logger } = require('../../application/ports/Logger');

/**
 * Adaptador de logging sobre pino.
 *
 * Implementa a porta `Logger` para que casos de uso e domínio nunca importem
 * pino diretamente. O ganho concreto: nos testes, o duplo de teste é um objeto
 * com cinco funções vazias — sem transporte, sem serialização, sem I/O.
 *
 * `comContexto` devolve um logger filho com campos fixos (requestId, userId),
 * o que faz a correlação acontecer sem que cada chamada precise repeti-la.
 */
class PinoLogger extends Logger {
  #pino;

  constructor(instanciaPino) {
    super();
    this.#pino = instanciaPino;
  }

  debug(dados, mensagem) {
    this.#pino.debug(dados, mensagem);
  }

  info(dados, mensagem) {
    this.#pino.info(dados, mensagem);
  }

  warn(dados, mensagem) {
    this.#pino.warn(dados, mensagem);
  }

  error(dados, mensagem) {
    this.#pino.error(dados, mensagem);
  }

  fatal(dados, mensagem) {
    this.#pino.fatal(dados, mensagem);
  }

  comContexto(contexto) {
    return new PinoLogger(this.#pino.child(contexto));
  }
}

module.exports = { PinoLogger };
