'use strict';

/**
 * Porta de saída para persistência de contatos.
 *
 * O `proprietarioId` é parâmetro obrigatório em toda leitura e remoção — a
 * assinatura torna impossível escrever uma consulta sem escopo de dono. É a
 * mesma decisão do ADR-0002, agora imposta pelo contrato: um adaptador novo não
 * consegue "esquecer" o filtro porque não existe método que não o receba.
 */
class ContatoRepository {
  /**
   * @param {import('../value-objects/Identificador').ContatoId} id
   * @param {import('../value-objects/Identificador').UsuarioId} proprietarioId
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('../entities/Contato').Contato|null>}
   */
  async buscarPorIdDoProprietario(id, proprietarioId, signal) {
    throw new Error(`${this.constructor.name} não implementa buscarPorIdDoProprietario.`);
  }

  /**
   * @param {import('../value-objects/Identificador').UsuarioId} proprietarioId
   * @param {{pagina: number, tamanho: number,
   *          filtros?: {busca?: string, etiqueta?: string, favoritos?: boolean}}} consulta
   * @param {AbortSignal} [signal]
   * @returns {Promise<{itens: Array, total: number}>}
   */
  async listarDoProprietario(proprietarioId, { pagina, tamanho, filtros }, signal) {
    throw new Error(`${this.constructor.name} não implementa listarDoProprietario.`);
  }

  async salvar(contato, signal) {
    throw new Error(`${this.constructor.name} não implementa salvar.`);
  }

  async atualizar(contato, signal) {
    throw new Error(`${this.constructor.name} não implementa atualizar.`);
  }

  async removerDoProprietario(id, proprietarioId, signal) {
    throw new Error(`${this.constructor.name} não implementa removerDoProprietario.`);
  }

  /**
   * Etiquetas distintas já usadas pelo dono — sugestões do seletor.
   *
   * @param {import('../value-objects/Identificador').UsuarioId} proprietarioId
   * @param {AbortSignal} [signal]
   * @returns {Promise<string[]>}
   */
  async listarEtiquetasDoProprietario(proprietarioId, signal) {
    throw new Error(`${this.constructor.name} não implementa listarEtiquetasDoProprietario.`);
  }

  /**
   * Todos os contatos de um dono, para exportação.
   *
   * @param {import('../value-objects/Identificador').UsuarioId} proprietarioId
   * @param {AbortSignal} [signal]
   * @returns {Promise<Array>}
   */
  async listarTodosDoProprietario(proprietarioId, signal) {
    throw new Error(`${this.constructor.name} não implementa listarTodosDoProprietario.`);
  }

  /**
   * Números agregados da agenda de um dono, para o painel.
   *
   * @param {import('../value-objects/Identificador').UsuarioId} proprietarioId
   * @param {AbortSignal} [signal]
   * @returns {Promise<{totalDeContatos: number, totalDeFavoritos: number,
   *           porEtiqueta: Array<{etiqueta: string, total: number}>,
   *           recentes: Array}>}
   */
  async resumirDoProprietario(proprietarioId, signal) {
    throw new Error(`${this.constructor.name} não implementa resumirDoProprietario.`);
  }

  proximoId() {
    throw new Error(`${this.constructor.name} não implementa proximoId.`);
  }
}

module.exports = { ContatoRepository };
