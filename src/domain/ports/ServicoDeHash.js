'use strict';

/**
 * Porta para hashing de senha.
 *
 * O domínio decide QUE a senha precisa ser hasheada e verificada; o adaptador
 * decide COM QUÊ. Essa fronteira é o que permite trocar bcrypt por argon2 sem
 * tocar em nenhum caso de uso — e é também o que torna os testes de domínio
 * rápidos, já que o duplo de teste pode usar um hash trivial.
 */
class ServicoDeHash {
  /**
   * @param {import('../value-objects/SenhaEmTexto').SenhaEmTexto} senha
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('../value-objects/SenhaComHash').SenhaComHash>}
   */
  async gerarHash(senha, signal) {
    throw new Error(`${this.constructor.name} não implementa gerarHash.`);
  }

  /**
   * @returns {Promise<boolean>}
   */
  async verificar(senha, senhaComHash, signal) {
    throw new Error(`${this.constructor.name} não implementa verificar.`);
  }

  /**
   * Consome tempo equivalente a uma verificação real.
   *
   * Chamado quando o e-mail não existe, para que a latência da resposta não
   * revele quais contas estão cadastradas (achado ACH-007). Sem este método na
   * porta, a defesa dependeria de o caso de uso conhecer detalhes do algoritmo.
   */
  async consumirTempoEquivalente(senha, signal) {
    throw new Error(`${this.constructor.name} não implementa consumirTempoEquivalente.`);
  }

  /** Indica se o hash foi gerado com custo inferior ao configurado hoje. */
  precisaRehash(senhaComHash) {
    throw new Error(`${this.constructor.name} não implementa precisaRehash.`);
  }
}

module.exports = { ServicoDeHash };
