'use strict';

/**
 * Raiz da hierarquia de erros. Nada no projeto lança `new Error(...)` direto:
 * um Error cru não carrega código, status HTTP nem contexto, e obriga quem
 * captura a inspecionar a mensagem — acoplamento pela string.
 *
 *   ApplicationError
 *   ├── ValidationError        400  entrada malformada
 *   ├── BusinessRuleError      422  entrada válida, regra impede
 *   ├── BadRequestError        400  requisição malformada (protocolo)
 *   ├── UnauthorizedError      401  não autenticado
 *   ├── ForbiddenError         403  autenticado, sem permissão
 *   ├── NotFoundError          404  recurso inexistente OU não pertencente
 *   ├── ConflictError          409  colisão de estado
 *   ├── TimeoutError           504  dependência não respondeu a tempo
 *   ├── CancelledError         499  cliente desistiu
 *   ├── InfrastructureError    500  falha em adaptador (banco, disco)
 *   ├── ExternalServiceError   502  falha em serviço de terceiro
 *   └── InternalServerError    500  não classificado
 */
class ApplicationError extends Error {
  /**
   * @param {object} params
   * @param {string} params.code      identificador estável, usado em log e métrica
   * @param {string} params.message   mensagem legível
   * @param {number} params.status    status HTTP correspondente
   * @param {boolean} params.expose   se a mensagem pode ir para o usuário final
   * @param {object} [params.context] dados estruturados para o log (nunca segredo)
   * @param {Error}  [params.cause]   erro original — preserva a cadeia de causa raiz
   */
  constructor({ code, message, status, expose, context = {}, cause }) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.expose = expose;
    this.context = Object.freeze({ ...context });
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, new.target);
  }

  /** Percorre a cadeia de `cause` até o erro de origem. */
  get rootCause() {
    let atual = this;
    while (atual.cause instanceof Error) atual = atual.cause;
    return atual === this ? null : atual;
  }

  /** Forma serializável para o logger estruturado. */
  toJSON() {
    const raiz = this.rootCause;
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      context: this.context,
      timestamp: this.timestamp,
      ...(raiz ? { rootCause: { name: raiz.name, message: raiz.message } } : {}),
    };
  }

  /** Mensagem segura para o usuário final. */
  get publicMessage() {
    return this.expose ? this.message : 'Erro interno. Tente novamente mais tarde.';
  }
}

module.exports = { ApplicationError };
