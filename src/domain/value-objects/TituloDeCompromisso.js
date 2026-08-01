'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');
const { LIMITES } = require('../../shared/constants');

/**
 * Título de um compromisso.
 *
 * Texto livre curto: "Dentista", "Reunião com a Maria". A única regra além do
 * tamanho é a normalização de espaços — a mesma dos outros VOs de texto, para
 * que "Dentista " e "Dentista" sejam o MESMO título em qualquer comparação.
 */
class TituloDeCompromisso extends ValueObject {
  static criar(entrada) {
    const valor = typeof entrada === 'string' ? entrada.trim().replace(/\s+/g, ' ') : '';

    if (valor.length === 0) {
      return Result.fail(
        new ValidationError('Informe um título para o compromisso.', {
          code: 'COMPROMISSO_SEM_TITULO',
        })
      );
    }
    if (valor.length > LIMITES.TITULO_COMPROMISSO_MAX) {
      return Result.fail(
        new ValidationError(
          `O título deve ter no máximo ${LIMITES.TITULO_COMPROMISSO_MAX} caracteres.`,
          { code: 'COMPROMISSO_TITULO_MUITO_LONGO' }
        )
      );
    }

    return Result.ok(new TituloDeCompromisso({ valor }));
  }

  static deConfianca(valor) {
    return new TituloDeCompromisso({ valor: String(valor) });
  }

  get valor() {
    return this.props.valor;
  }

  toString() {
    return this.props.valor;
  }

  toJSON() {
    return this.props.valor;
  }
}

module.exports = { TituloDeCompromisso };
