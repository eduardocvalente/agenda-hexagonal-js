'use strict';

/**
 * Base de Entidade.
 *
 * Diferença essencial em relação a ValueObject: identidade. Dois contatos com
 * exatamente os mesmos dados são registros distintos se têm ids distintos, e o
 * mesmo contato continua sendo ele mesmo depois de ter o telefone alterado.
 *
 * A entidade NÃO é congelada — ela evolui —, mas o estado interno é privado e
 * só muda por métodos que representam operações do domínio. É o que impede a
 * entidade anêmica: nada de `contato.nome = x` vindo de fora.
 */
class Entity {
  #id;

  constructor(id) {
    if (id === undefined || id === null) {
      throw new TypeError(`${new.target.name} exige um identificador.`);
    }
    this.#id = id;
  }

  get id() {
    return this.#id;
  }

  equals(outra) {
    if (outra === null || outra === undefined) return false;
    if (this === outra) return true;
    if (!(outra instanceof Entity)) return false;
    return this.#id.equals ? this.#id.equals(outra.id) : this.#id === outra.id;
  }
}

module.exports = { Entity };
