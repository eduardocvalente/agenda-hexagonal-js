'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');
const { RegexCatalog } = require('../../shared/regex/RegexCatalog');
const { LIMITES } = require('../../shared/constants');

/**
 * Senha em texto puro, no curto intervalo entre chegar do formulário e virar
 * hash. É aqui que a política de senha vive — uma regra de domínio, não de
 * infraestrutura: quem decide o que é senha aceitável é o negócio, e quem
 * decide o algoritmo de hash é a infraestrutura.
 *
 * `toString` e `toJSON` são deliberadamente sobrescritos para nunca revelarem
 * o valor. Sem isso, um `logger.info({ senha })` ou um `${senha}` acidental em
 * mensagem de erro grava a senha do usuário em texto puro no CloudWatch — um
 * dos vazamentos mais comuns e mais silenciosos que existem.
 */
class SenhaEmTexto extends ValueObject {
  static criar(entrada) {
    const bruto = typeof entrada === 'string' ? entrada : '';

    if (bruto.length < LIMITES.SENHA_MIN || bruto.length > LIMITES.SENHA_MAX) {
      return Result.fail(
        new ValidationError(
          `A senha deve ter entre ${LIMITES.SENHA_MIN} e ${LIMITES.SENHA_MAX} caracteres.`,
          { code: 'SENHA_COMPRIMENTO_INVALIDO' }
        )
      );
    }

    if (
      RegexCatalog.testa('SOMENTE_DIGITOS', bruto) ||
      RegexCatalog.testa('CARACTERE_REPETIDO', bruto)
    ) {
      return Result.fail(
        new ValidationError(
          'A senha é fraca demais: evite apenas números ou caracteres repetidos.',
          {
            code: 'SENHA_FRACA',
          }
        )
      );
    }

    return Result.ok(new SenhaEmTexto({ valor: bruto }));
  }

  /**
   * Aceita qualquer string, sem aplicar a política.
   *
   * Necessário no login: uma senha cadastrada sob uma política antiga precisa
   * poder ser conferida. Aplicar a política nova aqui trancaria para fora
   * usuários legítimos toda vez que a regra ficasse mais rígida.
   */
  static paraVerificacao(entrada) {
    const bruto = typeof entrada === 'string' ? entrada : '';
    if (bruto.length === 0 || bruto.length > LIMITES.SENHA_MAX) {
      return Result.fail(
        new ValidationError('Credenciais inválidas.', { code: 'CREDENCIAIS_INVALIDAS' })
      );
    }
    return Result.ok(new SenhaEmTexto({ valor: bruto }));
  }

  /** Uso restrito ao adaptador de hashing. */
  revelar() {
    return this.props.valor;
  }

  toString() {
    return '[SenhaEmTexto]';
  }

  toJSON() {
    return '[REDACTED]';
  }

  /** Também cobre `console.log` e o inspetor do Node. */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return '[SenhaEmTexto]';
  }
}

module.exports = { SenhaEmTexto };
