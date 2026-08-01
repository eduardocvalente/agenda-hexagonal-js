'use strict';

const { Entity } = require('../../shared/domain/Entity');
const { Result } = require('../../shared/result/Result');
const { ForbiddenError } = require('../../shared/errors');
const { Etiquetas } = require('../value-objects/Etiquetas');

/**
 * Compromisso — o segundo agregado do domínio.
 *
 * Mesma disciplina do Contato:
 *
 *  1. **Todo compromisso tem um dono.** O construtor exige `proprietarioId`;
 *     não existe compromisso órfão nem compartilhado por acidente.
 *
 *  2. **A entidade não confia em quem a carregou.** `alterarDados` reverifica
 *     o dono mesmo que a consulta já tenha filtrado — defesa em profundidade.
 *
 * O vínculo com um contato é OPCIONAL e por id, não por referência de objeto:
 * agregados diferentes se conhecem por identidade (regra de DDD que aqui tem
 * efeito prático — apagar o contato não pode quebrar o compromisso, que
 * apenas perde o vínculo).
 */
class Compromisso extends Entity {
  #proprietarioId;
  #titulo;
  #inicioEm;
  #notas;
  #contatoId;
  #etiquetas;
  #criadoEm;
  #atualizadoEm;

  constructor({
    id,
    proprietarioId,
    titulo,
    inicioEm,
    notas,
    contatoId,
    etiquetas,
    criadoEm,
    atualizadoEm,
  }) {
    super(id);
    if (!proprietarioId) {
      throw new TypeError('Compromisso exige um proprietário — invariante do agregado.');
    }
    this.#proprietarioId = proprietarioId;
    this.#titulo = titulo;
    this.#inicioEm = inicioEm;
    this.#notas = notas ?? null;
    this.#contatoId = contatoId ?? null;
    this.#etiquetas = etiquetas ?? Etiquetas.vazia();
    this.#criadoEm = criadoEm ?? new Date();
    this.#atualizadoEm = atualizadoEm ?? this.#criadoEm;
  }

  static criar({ id, proprietarioId, titulo, inicioEm, notas, contatoId, etiquetas, criadoEm }) {
    return Result.ok(
      new Compromisso({
        id,
        proprietarioId,
        titulo,
        inicioEm,
        notas,
        contatoId,
        etiquetas,
        criadoEm,
      })
    );
  }

  static reconstituir(props) {
    return new Compromisso(props);
  }

  /** A pergunta de autorização, feita ao domínio. */
  pertenceA(usuarioId) {
    return this.#proprietarioId.equals(usuarioId);
  }

  alterarDados({ titulo, inicioEm, notas, contatoId, etiquetas, editadoPor }) {
    if (!this.pertenceA(editadoPor)) {
      return Result.fail(
        new ForbiddenError('Compromisso não encontrado.', {
          code: 'COMPROMISSO_DE_OUTRO_PROPRIETARIO',
        })
      );
    }

    this.#titulo = titulo;
    this.#inicioEm = inicioEm;
    this.#notas = notas ?? null;
    this.#contatoId = contatoId ?? null;
    this.#etiquetas = etiquetas ?? Etiquetas.vazia();
    this.#atualizadoEm = new Date();

    return Result.ok(this);
  }

  get proprietarioId() {
    return this.#proprietarioId;
  }

  get titulo() {
    return this.#titulo;
  }

  get inicioEm() {
    return this.#inicioEm;
  }

  get notas() {
    return this.#notas;
  }

  get contatoId() {
    return this.#contatoId;
  }

  get etiquetas() {
    return this.#etiquetas;
  }

  get criadoEm() {
    return this.#criadoEm;
  }

  get atualizadoEm() {
    return this.#atualizadoEm;
  }

  toJSON() {
    return {
      id: this.id.valor,
      titulo: this.#titulo.valor,
      inicioEm: this.#inicioEm.toJSON(),
      notas: this.#notas ?? '',
      contatoId: this.#contatoId?.valor ?? null,
      etiquetas: this.#etiquetas.toJSON(),
      criadoEm: this.#criadoEm,
    };
  }
}

module.exports = { Compromisso };
