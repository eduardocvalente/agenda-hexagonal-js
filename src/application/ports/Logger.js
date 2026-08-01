'use strict';

/**
 * Porta de logging para a camada de aplicação.
 *
 * Está em `application/ports` e não em `domain`: o domínio puro não registra
 * log — ele devolve Result e quem orquestra decide o que observar. Casos de uso,
 * por outro lado, são o ponto natural para registrar eventos de negócio
 * ("usuário autenticado"), e por isso precisam da porta.
 *
 * `comContexto` devolve um logger filho com campos fixos (requestId, userId),
 * evitando repetir a correlação em cada chamada.
 */
class Logger {
  debug(dados, mensagem) {
    throw new Error(`${this.constructor.name} não implementa debug.`);
  }

  info(dados, mensagem) {
    throw new Error(`${this.constructor.name} não implementa info.`);
  }

  warn(dados, mensagem) {
    throw new Error(`${this.constructor.name} não implementa warn.`);
  }

  error(dados, mensagem) {
    throw new Error(`${this.constructor.name} não implementa error.`);
  }

  fatal(dados, mensagem) {
    throw new Error(`${this.constructor.name} não implementa fatal.`);
  }

  /** @returns {Logger} */
  comContexto(contexto) {
    throw new Error(`${this.constructor.name} não implementa comContexto.`);
  }
}

module.exports = { Logger };
