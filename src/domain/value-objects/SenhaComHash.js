'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');

/**
 * Senha já hasheada. O domínio trata como opaca: não sabe qual algoritmo
 * produziu o valor, apenas que ele nunca deve ser exibido.
 *
 * Separar `SenhaEmTexto` de `SenhaComHash` como tipos distintos torna
 * impossível gravar uma no lugar da outra — o erro que produz "senha em texto
 * puro no banco" deixa de ser possível por construção, não por disciplina.
 */
class SenhaComHash extends ValueObject {
  static criar(hash) {
    if (typeof hash !== 'string' || hash.length === 0) {
      return Result.fail(new ValidationError('Hash de senha inválido.', { code: 'HASH_INVALIDO' }));
    }
    return Result.ok(new SenhaComHash({ valor: hash }));
  }

  static deConfianca(hash) {
    return new SenhaComHash({ valor: String(hash) });
  }

  /** Uso restrito ao adaptador de hashing, que precisa do valor para comparar. */
  revelar() {
    return this.props.valor;
  }

  toString() {
    return '[SenhaComHash]';
  }

  toJSON() {
    return '[REDACTED]';
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return '[SenhaComHash]';
  }
}

module.exports = { SenhaComHash };
