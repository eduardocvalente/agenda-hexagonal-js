'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');
const { RegexCatalog } = require('../../shared/regex/RegexCatalog');
const { LIMITES } = require('../../shared/constants');

/**
 * Telefone de contato.
 *
 * Guarda o valor exatamente como o usuário digitou. Normalizar para E.164
 * exigiria inferir o país, e a inferência erra: um número internacional
 * colado sem `+` viraria um telefone brasileiro inválido. A agenda é pessoal —
 * o usuário sabe o que digitou, e reformatar o dado dele sem pedir é
 * comportamento que surpreende.
 *
 * A validação é intencionalmente permissiva: rejeita apenas o que claramente
 * não é telefone (letras, comprimento absurdo).
 */
class Telefone extends ValueObject {
  static criarOpcional(entrada) {
    const bruto = typeof entrada === 'string' ? entrada.trim() : '';
    if (bruto.length === 0) return Result.ok(null);

    if (bruto.length > LIMITES.TELEFONE_MAX) {
      return Result.fail(
        new ValidationError(`Telefone deve ter no máximo ${LIMITES.TELEFONE_MAX} caracteres.`, {
          code: 'TELEFONE_MUITO_LONGO',
        })
      );
    }
    if (!RegexCatalog.testa('TELEFONE', bruto)) {
      return Result.fail(new ValidationError('Telefone inválido.', { code: 'TELEFONE_INVALIDO' }));
    }

    return Result.ok(new Telefone({ valor: bruto }));
  }

  static deConfianca(valor) {
    return new Telefone({ valor: String(valor) });
  }

  /** Só os dígitos — útil para comparar dois números escritos de formas diferentes. */
  get somenteDigitos() {
    return this.props.valor.replace(/\D/g, '');
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

module.exports = { Telefone };
