'use strict';

/**
 * Porta de saída para persistência de usuários.
 *
 * JavaScript não tem interfaces, então o contrato é expresso como classe
 * abstrata que lança ao ser chamada sem implementação. A alternativa (só
 * documentar em JSDoc) falha silenciosamente quando um adaptador esquece um
 * método; assim, o erro aparece na primeira chamada, com o nome do método.
 *
 * **Todo método recebe `signal`** como último parâmetro. Cancelamento não é
 * opcional na assinatura: se a porta não o previsse, nenhum adaptador poderia
 * oferecê-lo sem quebrar o contrato, e a propagação morreria na fronteira.
 */
class UsuarioRepository {
  /**
   * @param {import('../value-objects/Email').Email} email
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('../entities/Usuario').Usuario|null>}
   */
  async buscarPorEmail(email, signal) {
    throw new Error(`${this.constructor.name} não implementa buscarPorEmail.`);
  }

  /**
   * @param {import('../entities/Usuario').Usuario} usuario
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('../../shared/result/Result').Result>}
   */
  async salvar(usuario, signal) {
    throw new Error(`${this.constructor.name} não implementa salvar.`);
  }

  /** Atualiza apenas a credencial — usado no rehash transparente. */
  async atualizarCredencial(usuarioId, senhaComHash, signal) {
    throw new Error(`${this.constructor.name} não implementa atualizarCredencial.`);
  }

  /** Gera um identificador novo sem ida ao banco. */
  proximoId() {
    throw new Error(`${this.constructor.name} não implementa proximoId.`);
  }
}

module.exports = { UsuarioRepository };
