'use strict';

/**
 * Base de Value Object.
 *
 * Três propriedades definem um VO e todas são impostas aqui:
 *  1. imutabilidade — `Object.freeze` no construtor;
 *  2. igualdade estrutural — dois VOs com o mesmo conteúdo são iguais, ao
 *     contrário de entidades, que são iguais quando têm a mesma identidade;
 *  3. validade garantida na construção — se o objeto existe, é válido. Isso
 *     elimina a checagem defensiva repetida em cada método que o recebe.
 *
 * As subclasses expõem uma fábrica estática `criar()` que devolve `Result`, em
 * vez de lançar no construtor: erro de validação é previsto e pertence ao
 * retorno, não ao fluxo de exceção.
 */
class ValueObject {
  constructor(props) {
    this.props = Object.freeze({ ...props });
    Object.freeze(this);
  }

  equals(outro) {
    if (outro === null || outro === undefined) return false;
    if (this === outro) return true;
    if (outro.constructor !== this.constructor) return false;
    return JSON.stringify(this.props) === JSON.stringify(outro.props);
  }

  toJSON() {
    return this.props;
  }
}

module.exports = { ValueObject };
