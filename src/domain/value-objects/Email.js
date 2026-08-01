'use strict';

const validator = require('validator');

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');
const { LIMITES } = require('../../shared/constants');

/**
 * Endereço de e-mail — sempre normalizado para minúsculas e sem espaços.
 *
 * A normalização mora AQUI, não no repositório, e é o que fecha o defeito
 * ACH-011 da auditoria: com `Joao@x.com` e `joao@x.com` produzindo o mesmo VO,
 * é impossível criar duas contas para o mesmo endereço, independentemente de
 * qual caminho de código chamou.
 *
 * A validação usa `validator.isEmail` (um parser), não regex: expressões
 * regulares para RFC 5322 são fonte conhecida de ReDoS e de falsos negativos.
 */
class Email extends ValueObject {
  static criar(entrada) {
    const bruto = typeof entrada === 'string' ? entrada.trim().toLowerCase() : '';

    if (bruto.length === 0) {
      return Result.fail(
        new ValidationError('E-mail é obrigatório.', { code: 'EMAIL_OBRIGATORIO' })
      );
    }
    if (bruto.length > LIMITES.EMAIL_MAX) {
      return Result.fail(
        new ValidationError('E-mail inválido.', {
          code: 'EMAIL_MUITO_LONGO',
          context: { comprimento: bruto.length, max: LIMITES.EMAIL_MAX },
        })
      );
    }
    if (!validator.isEmail(bruto)) {
      return Result.fail(new ValidationError('E-mail inválido.', { code: 'EMAIL_INVALIDO' }));
    }

    return Result.ok(new Email({ valor: bruto }));
  }

  /** Variante opcional: ausência é válida, presença precisa ser um e-mail. */
  static criarOpcional(entrada) {
    const bruto = typeof entrada === 'string' ? entrada.trim() : '';
    if (bruto.length === 0) return Result.ok(null);
    return Email.criar(bruto);
  }

  static deConfianca(valor) {
    return new Email({ valor: String(valor) });
  }

  get valor() {
    return this.props.valor;
  }

  get dominio() {
    return this.props.valor.split('@')[1];
  }

  toString() {
    return this.props.valor;
  }

  toJSON() {
    return this.props.valor;
  }
}

module.exports = { Email };
