'use strict';

const { throwIfAborted } = require('../../shared/cancellation');
const { Result } = require('../../shared/result/Result');
const { CancelledError, InternalServerError } = require('../../shared/errors');
const { ApplicationError } = require('../../shared/errors/ApplicationError');

/**
 * Template Method para casos de uso.
 *
 * A classe base fixa o que TODO caso de uso precisa fazer e que ninguém deveria
 * ter de lembrar de repetir:
 *   1. checar cancelamento antes de começar (requisição já abandonada não gasta banco);
 *   2. executar a lógica específica (`executar`, implementado pela subclasse);
 *   3. converter exceção inesperada em Result de falha, sem deixar vazar
 *      stack trace de infraestrutura para a camada HTTP.
 *
 * O Template Method se justifica aqui porque a sequência é invariante e a
 * variação é um único passo. Um decorator daria a mesma coisa com mais peças;
 * herança de um nível, sem hierarquia profunda, é a solução mais simples que
 * funciona (KISS).
 */
class UseCase {
  /** @param {import('../ports/Logger').Logger} logger */
  constructor({ logger }) {
    this.logger = logger;
  }

  /**
   * Ponto de entrada. Não sobrescrever — sobrescreva `executar`.
   * @param {object} entrada
   * @param {{signal?: AbortSignal}} [contexto]
   * @returns {Promise<Result>}
   */
  async run(entrada, contexto = {}) {
    const { signal } = contexto;

    try {
      throwIfAborted(signal, { casoDeUso: this.constructor.name });
      return await this.executar(entrada, contexto);
    } catch (erro) {
      return this.#tratarExcecao(erro);
    }
  }

  /**
   * Lógica específica. Deve devolver `Result` e propagar `signal` para todas as
   * chamadas de porta que fizer.
   * @abstract
   */
  async executar() {
    throw new Error(`${this.constructor.name} não implementa executar.`);
  }

  #tratarExcecao(erro) {
    if (erro instanceof CancelledError) {
      this.logger?.debug(
        { evento: 'usecase.cancelado', casoDeUso: this.constructor.name },
        'Caso de uso cancelado'
      );
      return Result.fail(erro);
    }

    // Erros já classificados atravessam intactos: quem os lançou sabia o que
    // estava dizendo, e reembrulhar perderia código e status.
    if (erro instanceof ApplicationError) {
      return Result.fail(erro);
    }

    // Qualquer outra coisa é bug ou falha de infraestrutura não mapeada.
    // `cause` preserva a causa raiz para o log sem expor nada ao usuário.
    this.logger?.error(
      { evento: 'usecase.erro_inesperado', casoDeUso: this.constructor.name, err: erro },
      'Exceção não classificada em caso de uso'
    );
    return Result.fail(
      new InternalServerError('Erro interno.', {
        cause: erro,
        context: { casoDeUso: this.constructor.name },
      })
    );
  }
}

module.exports = { UseCase };
