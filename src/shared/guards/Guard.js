'use strict';

const { Result } = require('../result/Result');
const { ValidationError } = require('../errors');

/**
 * Checagens de pré-condição reutilizáveis, devolvendo Result.
 *
 * Existe para eliminar a duplicação de `if (typeof x !== 'string') ...` que
 * aparecia em cada model. As mensagens ficam em um lugar só, então mudam juntas.
 */
class Guard {
  static naoVazio(valor, campo) {
    if (typeof valor !== 'string' || valor.trim().length === 0) {
      return Result.fail(new ValidationError(`${campo} é obrigatório.`, { context: { campo } }));
    }
    return Result.ok(valor.trim());
  }

  static comprimentoEntre(valor, campo, min, max) {
    const texto = typeof valor === 'string' ? valor : '';
    if (texto.length < min || texto.length > max) {
      return Result.fail(
        new ValidationError(`${campo} deve ter entre ${min} e ${max} caracteres.`, {
          context: { campo, min, max, comprimento: texto.length },
        })
      );
    }
    return Result.ok(texto);
  }

  static comprimentoMaximo(valor, campo, max) {
    const texto = typeof valor === 'string' ? valor : '';
    if (texto.length > max) {
      return Result.fail(
        new ValidationError(`${campo} deve ter no máximo ${max} caracteres.`, {
          context: { campo, max, comprimento: texto.length },
        })
      );
    }
    return Result.ok(texto);
  }

  /**
   * Converte qualquer entrada não-string em string vazia.
   *
   * É a barreira contra NoSQL injection: `email[$ne]=` chega do `qs` do Express
   * como objeto e, sem esta normalização, viraria operador de query no driver.
   * Nunca falha — normalizar é o comportamento correto aqui, não rejeitar.
   */
  static textoSeguro(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  static ehInstanciaDe(valor, Classe, campo) {
    if (!(valor instanceof Classe)) {
      return Result.fail(
        new ValidationError(`${campo} deve ser uma instância de ${Classe.name}.`, {
          context: { campo, recebido: typeof valor },
        })
      );
    }
    return Result.ok(valor);
  }
}

module.exports = { Guard };
