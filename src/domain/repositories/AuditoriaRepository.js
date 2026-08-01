'use strict';

/**
 * Porta de persistência da trilha de auditoria.
 *
 * **Note o que NÃO existe nesta interface:** não há `atualizar`, não há
 * `remover`, não há `salvarEmLote` com upsert. A ausência é o contrato — uma
 * trilha append-only é garantida pela forma da porta, não por disciplina de
 * quem escreve o adaptador. Um adaptador não consegue oferecer edição sem
 * inventar um método fora do contrato, e isso aparece em revisão.
 *
 * A expiração de registros antigos existe, mas é política de retenção aplicada
 * pelo banco (índice TTL), não uma operação que a aplicação possa invocar.
 */
class AuditoriaRepository {
  /**
   * @param {import('../entities/RegistroDeAuditoria').RegistroDeAuditoria} registro
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('../../shared/result/Result').Result>}
   */
  async registrar(registro, signal) {
    throw new Error(`${this.constructor.name} não implementa registrar.`);
  }

  /**
   * Trilha de um usuário, da mais recente para a mais antiga.
   * `usuarioId` é obrigatório: não existe consulta sem escopo de dono.
   * @returns {Promise<{itens: Array, total: number}>}
   */
  async listarDoUsuario(usuarioId, { pagina, tamanho, acao }, signal) {
    throw new Error(`${this.constructor.name} não implementa listarDoUsuario.`);
  }

  proximoId() {
    throw new Error(`${this.constructor.name} não implementa proximoId.`);
  }
}

module.exports = { AuditoriaRepository };
