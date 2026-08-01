'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');
const { RegexCatalog } = require('../../shared/regex/RegexCatalog');
const { LIMITES } = require('../../shared/constants');

/**
 * Coleção de etiquetas de um contato.
 *
 * É um VO de coleção, não um array solto: a normalização (minúsculas, espaços
 * colapsados, duplicatas removidas) acontece uma única vez, aqui, e todo o
 * resto do sistema pode confiar que duas etiquetas iguais são a MESMA string.
 * Sem isso, "Trabalho" e "trabalho " viram duas etiquetas diferentes no filtro
 * e o agrupamento do dashboard conta errado.
 *
 * A entrada aceita o formato do formulário ("trabalho, família") ou um array —
 * o parse pertence ao domínio porque a regra ("o que é uma etiqueta válida")
 * é de negócio, não de apresentação.
 */
class Etiquetas extends ValueObject {
  static vazia() {
    return new Etiquetas({ valores: Object.freeze([]) });
  }

  static criarOpcional(entrada) {
    const brutos = Array.isArray(entrada)
      ? entrada
      : typeof entrada === 'string'
        ? entrada.split(',')
        : [];

    // Normaliza antes de validar: o usuário digita "Trabalho ,  família" e a
    // intenção é óbvia — recusar por espaço extra seria pedantismo.
    const normalizadas = [];
    for (const bruto of brutos) {
      const valor = String(bruto).trim().replace(/\s+/g, ' ').toLowerCase();
      if (valor.length === 0) continue;
      if (!normalizadas.includes(valor)) normalizadas.push(valor);
    }

    if (normalizadas.length === 0) return Result.ok(Etiquetas.vazia());

    if (normalizadas.length > LIMITES.ETIQUETAS_POR_CONTATO_MAX) {
      return Result.fail(
        new ValidationError(
          `Use no máximo ${LIMITES.ETIQUETAS_POR_CONTATO_MAX} etiquetas por contato.`,
          { code: 'ETIQUETAS_DEMAIS' }
        )
      );
    }

    for (const valor of normalizadas) {
      if (valor.length > LIMITES.ETIQUETA_MAX) {
        return Result.fail(
          new ValidationError(
            `Cada etiqueta deve ter no máximo ${LIMITES.ETIQUETA_MAX} caracteres.`,
            { code: 'ETIQUETA_MUITO_LONGA' }
          )
        );
      }
      if (!RegexCatalog.testa('ETIQUETA', valor)) {
        return Result.fail(
          new ValidationError('Etiquetas aceitam apenas letras, números, espaço e hífen.', {
            code: 'ETIQUETA_INVALIDA',
          })
        );
      }
    }

    return Result.ok(new Etiquetas({ valores: Object.freeze(normalizadas) }));
  }

  static deConfianca(valores) {
    return new Etiquetas({ valores: Object.freeze((valores ?? []).map(String)) });
  }

  get valores() {
    return this.props.valores;
  }

  get vazio() {
    return this.props.valores.length === 0;
  }

  /** Formato do formulário — o inverso exato do parse de `criarOpcional`. */
  get texto() {
    return this.props.valores.join(', ');
  }

  contem(etiqueta) {
    return this.props.valores.includes(String(etiqueta).trim().toLowerCase());
  }

  toJSON() {
    return [...this.props.valores];
  }
}

module.exports = { Etiquetas };
