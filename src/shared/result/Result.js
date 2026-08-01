'use strict';

/**
 * Result — retorno explícito de sucesso ou falha.
 *
 * Regra de uso adotada no projeto: falha ESPERADA (validação, regra de negócio,
 * recurso inexistente) é valor de retorno; falha INESPERADA (banco fora, bug)
 * continua sendo exceção. Exceção como controle de fluxo de regra de negócio
 * torna o caminho de erro invisível na assinatura e caro no runtime.
 *
 * A construção é feita por `Result.ok` / `Result.fail`; o construtor é privado
 * na prática (Success e Failure são as únicas subclasses).
 */
class Result {
  /** @returns {Result} sucesso carregando `value` */
  static ok(value) {
    return new Success(value);
  }

  /** @returns {Result} falha carregando um ApplicationError */
  static fail(error) {
    return new Failure(error);
  }

  /**
   * Agrega vários Results. Devolve o primeiro erro encontrado, ou um sucesso
   * com o array de valores. Usado para validar campos independentes sem
   * interromper no primeiro erro quando `collectAll` é preferível.
   */
  static combine(results) {
    const falhas = results.filter((r) => r.isFailure);
    if (falhas.length > 0) return Result.fail(falhas[0].error);
    return Result.ok(results.map((r) => r.value));
  }

  /**
   * Como `combine`, mas acumula TODOS os erros — é o que permite devolver ao
   * usuário a lista completa de problemas do formulário em vez de um por vez.
   */
  static collectAll(results) {
    const erros = results.filter((r) => r.isFailure).map((r) => r.error);
    if (erros.length > 0) return { erros, valores: [] };
    return { erros: [], valores: results.map((r) => r.value) };
  }

  get isSuccess() {
    return this instanceof Success;
  }

  get isFailure() {
    return this instanceof Failure;
  }

  /** Aplica `fn` ao valor de sucesso; propaga a falha intacta. */
  map(fn) {
    return this.isSuccess ? Result.ok(fn(this.value)) : this;
  }

  /** Encadeia outra operação que também devolve Result (bind monádico). */
  flatMap(fn) {
    return this.isSuccess ? fn(this.value) : this;
  }

  mapError(fn) {
    return this.isFailure ? Result.fail(fn(this.error)) : this;
  }

  /** Desestrutura os dois caminhos de uma vez — evita `if (r.isSuccess)` espalhado. */
  match({ onSuccess, onFailure }) {
    return this.isSuccess ? onSuccess(this.value) : onFailure(this.error);
  }

  getOrElse(fallback) {
    return this.isSuccess ? this.value : fallback;
  }
}

class Success extends Result {
  #value;

  constructor(value) {
    super();
    this.#value = value;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get error() {
    throw new TypeError('Result de sucesso não possui erro.');
  }
}

class Failure extends Result {
  #error;

  constructor(error) {
    super();
    this.#error = error;
    Object.freeze(this);
  }

  get value() {
    throw new TypeError(`Result de falha não possui valor: ${this.#error?.message}`);
  }

  get error() {
    return this.#error;
  }
}

module.exports = { Result, Success, Failure };
