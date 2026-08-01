'use strict';

/**
 * Porta de saída para persistência de compromissos.
 *
 * Como na porta de contatos, o `proprietarioId` é obrigatório em toda leitura
 * e remoção: a assinatura impede consulta sem escopo de dono.
 */
class CompromissoRepository {
  /**
   * @param {import('../value-objects/Identificador').CompromissoId} id
   * @param {import('../value-objects/Identificador').UsuarioId} proprietarioId
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('../entities/Compromisso').Compromisso|null>}
   */
  async buscarPorIdDoProprietario(id, proprietarioId, signal) {
    throw new Error(`${this.constructor.name} não implementa buscarPorIdDoProprietario.`);
  }

  /**
   * Compromissos do dono dentro de uma janela [inicio, fim) — a consulta do
   * calendário mensal.
   *
   * @param {import('../value-objects/Identificador').UsuarioId} proprietarioId
   * @param {{inicio: Date, fim: Date}} janela
   * @param {AbortSignal} [signal]
   * @returns {Promise<Array>}
   */
  async listarDoProprietarioEntre(proprietarioId, { inicio, fim }, signal) {
    throw new Error(`${this.constructor.name} não implementa listarDoProprietarioEntre.`);
  }

  /**
   * Próximos compromissos a partir de um instante, mais antigos primeiro.
   *
   * @param {import('../value-objects/Identificador').UsuarioId} proprietarioId
   * @param {{aPartirDe: Date, limite: number}} consulta
   * @param {AbortSignal} [signal]
   * @returns {Promise<Array>}
   */
  async listarProximosDoProprietario(proprietarioId, { aPartirDe, limite }, signal) {
    throw new Error(`${this.constructor.name} não implementa listarProximosDoProprietario.`);
  }

  /** Etiquetas distintas já usadas pelo dono em compromissos. */
  async listarEtiquetasDoProprietario(proprietarioId, signal) {
    throw new Error(`${this.constructor.name} não implementa listarEtiquetasDoProprietario.`);
  }

  /** Total de compromissos a partir de um instante — número do painel. */
  async contarAPartirDe(proprietarioId, aPartirDe, signal) {
    throw new Error(`${this.constructor.name} não implementa contarAPartirDe.`);
  }

  async salvar(compromisso, signal) {
    throw new Error(`${this.constructor.name} não implementa salvar.`);
  }

  async atualizar(compromisso, signal) {
    throw new Error(`${this.constructor.name} não implementa atualizar.`);
  }

  async removerDoProprietario(id, proprietarioId, signal) {
    throw new Error(`${this.constructor.name} não implementa removerDoProprietario.`);
  }

  proximoId() {
    throw new Error(`${this.constructor.name} não implementa proximoId.`);
  }
}

module.exports = { CompromissoRepository };
