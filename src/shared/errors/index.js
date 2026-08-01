'use strict';

const { ApplicationError } = require('./ApplicationError');

/** Entrada malformada — o dado não passa nem na checagem estrutural. */
class ValidationError extends ApplicationError {
  constructor(message, { context, cause, code = 'VALIDATION_ERROR' } = {}) {
    super({ code, message, status: 400, expose: true, context, cause });
  }
}

/**
 * Entrada estruturalmente válida, mas uma regra de negócio a impede.
 * 422 e não 400: o servidor entendeu a requisição, o domínio é que recusou.
 */
class BusinessRuleError extends ApplicationError {
  constructor(message, { context, cause, code = 'BUSINESS_RULE_VIOLATION' } = {}) {
    super({ code, message, status: 422, expose: true, context, cause });
  }
}

class BadRequestError extends ApplicationError {
  constructor(message = 'Requisição inválida.', { context, cause, code = 'BAD_REQUEST' } = {}) {
    super({ code, message, status: 400, expose: true, context, cause });
  }
}

class UnauthorizedError extends ApplicationError {
  constructor(
    message = 'Autenticação necessária.',
    { context, cause, code = 'UNAUTHORIZED' } = {}
  ) {
    super({ code, message, status: 401, expose: true, context, cause });
  }
}

class ForbiddenError extends ApplicationError {
  constructor(message = 'Acesso negado.', { context, cause, code = 'FORBIDDEN' } = {}) {
    super({ code, message, status: 403, expose: true, context, cause });
  }
}

/**
 * Usado tanto para "não existe" quanto para "existe mas não é seu".
 * Responder 403 no segundo caso confirmaria ao atacante que o id é válido —
 * o 404 uniforme é uma decisão de segurança, não descuido.
 */
class NotFoundError extends ApplicationError {
  constructor(message = 'Recurso não encontrado.', { context, cause, code = 'NOT_FOUND' } = {}) {
    super({ code, message, status: 404, expose: true, context, cause });
  }
}

class ConflictError extends ApplicationError {
  constructor(message = 'Conflito de estado.', { context, cause, code = 'CONFLICT' } = {}) {
    super({ code, message, status: 409, expose: true, context, cause });
  }
}

class TimeoutError extends ApplicationError {
  constructor(
    message = 'A operação excedeu o tempo limite.',
    { context, cause, code = 'TIMEOUT' } = {}
  ) {
    super({ code, message, status: 504, expose: true, context, cause });
  }
}

/**
 * Cancelamento cooperativo. Status 499 (convenção do nginx para "client closed
 * request"): não é erro do servidor nem do cliente no sentido usual, e separá-lo
 * evita que desistência de usuário polua a métrica de 5xx e consuma error budget.
 */
class CancelledError extends ApplicationError {
  constructor(message = 'Operação cancelada.', { context, cause, code = 'CANCELLED' } = {}) {
    super({ code, message, status: 499, expose: false, context, cause });
  }
}

/** Falha em adaptador de saída (banco, disco, cache). `expose: false`. */
class InfrastructureError extends ApplicationError {
  constructor(
    message = 'Falha de infraestrutura.',
    { context, cause, code = 'INFRASTRUCTURE_ERROR' } = {}
  ) {
    super({ code, message, status: 500, expose: false, context, cause });
  }
}

class ExternalServiceError extends ApplicationError {
  constructor(
    message = 'Serviço externo indisponível.',
    { context, cause, code = 'EXTERNAL_SERVICE_ERROR' } = {}
  ) {
    super({ code, message, status: 502, expose: false, context, cause });
  }
}

class InternalServerError extends ApplicationError {
  constructor(message = 'Erro interno.', { context, cause, code = 'INTERNAL_ERROR' } = {}) {
    super({ code, message, status: 500, expose: false, context, cause });
  }
}

module.exports = {
  ApplicationError,
  ValidationError,
  BusinessRuleError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TimeoutError,
  CancelledError,
  InfrastructureError,
  ExternalServiceError,
  InternalServerError,
};
