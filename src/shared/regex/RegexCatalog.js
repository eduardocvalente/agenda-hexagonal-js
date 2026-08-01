'use strict';

/**
 * Catálogo de expressões regulares pré-compiladas.
 *
 * Por que centralizar e pré-compilar:
 *  - um literal `/.../` dentro de função é recompilado pelo motor a cada
 *    chamada em alguns caminhos; aqui cada padrão é instanciado uma única vez
 *    no carregamento do módulo;
 *  - revisar segurança de regex fica viável quando todas estão em um arquivo:
 *    é onde se procura backtracking catastrófico (ReDoS);
 *  - flag `g` é proibida neste catálogo. Regex com `g` carrega `lastIndex`
 *    mutável, e um objeto compartilhado com estado produz resultados que
 *    dependem da chamada anterior — bug clássico e difícil de reproduzir.
 */

const PADROES = Object.freeze({
  /** Dígitos, espaço, parênteses, hífen e `+` — formatos de telefone brasileiros. */
  TELEFONE: /^\+?[\d\s()-]{8,30}$/,

  /**
   * Etiqueta de contato: letras (com acento), dígitos, espaço e hífen.
   * `\p{L}`/`\p{N}` cobrem o alfabeto completo sem enumerar acentos à mão.
   */
  ETIQUETA: /^[\p{L}\p{N}][\p{L}\p{N} -]*$/u,

  /** Detecta uma senha composta só de repetições do mesmo caractere. */
  CARACTERE_REPETIDO: /^(.)\1+$/,

  /** Só dígitos — usado para recusar senha puramente numérica. */
  SOMENTE_DIGITOS: /^\d+$/,

  /** Presença de qualquer dígito — nomes de pessoa não carregam números. */
  CONTEM_DIGITO: /\d/,

  /** ObjectId do MongoDB em forma hexadecimal de 24 caracteres. */
  OBJECT_ID: /^[a-f\d]{24}$/i,

  /** Espaços consecutivos, para normalizar nomes digitados. */
  ESPACOS_MULTIPLOS: / {2,}/g,

  /** Prefixo de hash bcrypt — usado só em teste, para provar que houve hashing. */
  HASH_BCRYPT: /^\$2[aby]\$\d{2}\$/,
});

// A validação de e-mail NÃO está aqui de propósito: RFC 5322 por regex é uma
// fonte conhecida de ReDoS e de falsos negativos. O projeto usa `validator.isEmail`,
// que é um parser, não uma expressão regular.

class RegexCatalog {
  static get(nome) {
    const padrao = PADROES[nome];
    if (!padrao) throw new TypeError(`Padrão de regex desconhecido: ${nome}`);
    return padrao;
  }

  /**
   * Testa sem carregar estado. Para padrões com flag `g` (só ESPACOS_MULTIPLOS),
   * zera `lastIndex` antes — é a armadilha que a proibição acima previne.
   */
  static testa(nome, valor) {
    const padrao = RegexCatalog.get(nome);
    if (padrao.global) padrao.lastIndex = 0;
    return padrao.test(valor);
  }

  static get padroes() {
    return PADROES;
  }

  /**
   * Escapa metacaracteres para embutir texto do usuário em um RegExp.
   *
   * É o que torna a busca livre segura: sem isto, `?q=a+` viraria um
   * quantificador e um padrão hostil poderia custar backtracking (ReDoS).
   * Escapado, o texto casa somente consigo mesmo.
   */
  static escapar(texto) {
    return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { RegexCatalog, PADROES };
