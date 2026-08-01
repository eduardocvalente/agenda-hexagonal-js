'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');
const { RegexCatalog } = require('../../shared/regex/RegexCatalog');
const { LIMITES } = require('../../shared/constants');

/**
 * Nome de pessoa: nome obrigatório, sobrenome opcional.
 *
 * Modelado como um VO único porque nome e sobrenome sempre andam juntos no
 * domínio — nunca se edita um sem considerar o outro, e a formatação do nome
 * completo é responsabilidade de quem os possui, não de quem os exibe.
 *
 * Deliberadamente NÃO há allowlist de caracteres. Nomes reais têm acentos,
 * hífens, apóstrofos, partículas e caracteres não latinos; qualquer lista de
 * permitidos exclui pessoas de verdade. A única recusa pontual é DÍGITO:
 * número dentro de nome é, na prática, um telefone colado no campo errado —
 * recusar cedo devolve o erro para quem pode corrigi-lo. O escape contra XSS
 * continua na renderização, onde pertence.
 */
class NomePessoa extends ValueObject {
  static criar(nome, sobrenome = '') {
    const nomeLimpo = NomePessoa.#normalizar(nome);
    const sobrenomeLimpo = NomePessoa.#normalizar(sobrenome);

    if (nomeLimpo.length === 0) {
      return Result.fail(
        new ValidationError('Nome é um campo obrigatório.', { code: 'NOME_OBRIGATORIO' })
      );
    }
    if (nomeLimpo.length > LIMITES.NOME_MAX) {
      return Result.fail(
        new ValidationError(`Nome deve ter no máximo ${LIMITES.NOME_MAX} caracteres.`, {
          code: 'NOME_MUITO_LONGO',
        })
      );
    }
    if (sobrenomeLimpo.length > LIMITES.SOBRENOME_MAX) {
      return Result.fail(
        new ValidationError(`Sobrenome deve ter no máximo ${LIMITES.SOBRENOME_MAX} caracteres.`, {
          code: 'SOBRENOME_MUITO_LONGO',
        })
      );
    }
    if (RegexCatalog.testa('CONTEM_DIGITO', nomeLimpo)) {
      return Result.fail(
        new ValidationError('Nome não pode conter números.', { code: 'NOME_COM_NUMERO' })
      );
    }
    if (RegexCatalog.testa('CONTEM_DIGITO', sobrenomeLimpo)) {
      return Result.fail(
        new ValidationError('Sobrenome não pode conter números.', { code: 'SOBRENOME_COM_NUMERO' })
      );
    }

    return Result.ok(new NomePessoa({ nome: nomeLimpo, sobrenome: sobrenomeLimpo }));
  }

  static deConfianca(nome, sobrenome = '') {
    return new NomePessoa({ nome: String(nome ?? ''), sobrenome: String(sobrenome ?? '') });
  }

  static #normalizar(valor) {
    if (typeof valor !== 'string') return '';
    return valor.trim().replace(RegexCatalog.get('ESPACOS_MULTIPLOS'), ' ');
  }

  get nome() {
    return this.props.nome;
  }

  get sobrenome() {
    return this.props.sobrenome;
  }

  get completo() {
    return this.props.sobrenome ? `${this.props.nome} ${this.props.sobrenome}` : this.props.nome;
  }

  toString() {
    return this.completo;
  }
}

module.exports = { NomePessoa };
