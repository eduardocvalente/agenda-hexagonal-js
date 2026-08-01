'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');
const { RegexCatalog } = require('../../shared/regex/RegexCatalog');

/**
 * Identificador de entidade.
 *
 * O formato validado é o do ObjectId do MongoDB — uma concessão consciente:
 * o domínio conhece o formato do id, mas não o driver. A alternativa purista
 * (UUID gerado pelo domínio) trocaria o `_id` nativo do Mongo por um campo
 * indexado adicional, sem ganho real para este projeto. Está registrado como
 * trade-off no ADR-0006.
 *
 * O valor deste VO é tipagem: `buscarPorId(id, usuarioId)` com dois `string`
 * aceita os argumentos trocados sem reclamar; com `ContatoId` e `UsuarioId`,
 * a troca é um erro imediato.
 */
class Identificador extends ValueObject {
  static criar(valor) {
    if (typeof valor !== 'string' || !RegexCatalog.testa('OBJECT_ID', valor)) {
      return Result.fail(
        new ValidationError('Identificador inválido.', {
          code: 'IDENTIFICADOR_INVALIDO',
          context: { tipo: typeof valor },
        })
      );
    }
    return Result.ok(new this({ valor: valor.toLowerCase() }));
  }

  /**
   * Constrói sem validar. Uso exclusivo dos mappers de persistência, onde o
   * valor vem do próprio banco e já é confiável — revalidar ali seria custo
   * sem informação nova.
   */
  static deConfianca(valor) {
    return new this({ valor: String(valor) });
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

class UsuarioId extends Identificador {}
class ContatoId extends Identificador {}
class CompromissoId extends Identificador {}

module.exports = { Identificador, UsuarioId, ContatoId, CompromissoId };
