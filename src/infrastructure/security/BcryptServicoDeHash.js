'use strict';

const bcryptjs = require('bcryptjs');

const { ServicoDeHash } = require('../../domain/ports/ServicoDeHash');
const { SenhaComHash } = require('../../domain/value-objects/SenhaComHash');
const { runCancellable } = require('../../shared/cancellation');

/**
 * Adaptador de hashing sobre bcryptjs.
 *
 * **Limite honesto do cancelamento:** `bcryptjs` é JavaScript puro e roda até o
 * fim. O `runCancellable` libera a requisição quando o cliente desiste, mas o
 * cálculo continua consumindo CPU. Cancelar de verdade exigiria mover o hash
 * para um worker thread e derrubá-lo — registrado no roadmap, não implementado.
 * Dizer que "toda operação aceita cancelamento" seria falso aqui, e a diferença
 * importa: é justamente esta operação que satura a event loop sob ataque.
 *
 * As APIs usadas são as assíncronas (`hash`/`compare`), não as `*Sync`. As
 * síncronas bloqueiam a event loop por ~250 ms com custo 12 — dez logins por
 * segundo derrubariam todas as outras requisições do processo.
 */
class BcryptServicoDeHash extends ServicoDeHash {
  #custo;
  #hashDescartavel;

  constructor({ custo }) {
    super();
    this.#custo = custo;
    // Hash calculado uma única vez no boot. Usado para gastar tempo equivalente
    // quando o e-mail não existe, fechando o canal lateral de temporização.
    this.#hashDescartavel = bcryptjs.hashSync('equalizacao-de-tempo-de-resposta', custo);
  }

  async gerarHash(senha, signal) {
    const hash = await runCancellable(bcryptjs.hash(senha.revelar(), this.#custo), signal, {
      adaptador: 'BcryptServicoDeHash',
      operacao: 'gerarHash',
    });
    return SenhaComHash.deConfianca(hash);
  }

  async verificar(senha, senhaComHash, signal) {
    if (!senhaComHash) return false;
    return runCancellable(bcryptjs.compare(senha.revelar(), senhaComHash.revelar()), signal, {
      adaptador: 'BcryptServicoDeHash',
      operacao: 'verificar',
    });
  }

  async consumirTempoEquivalente(senha, signal) {
    await runCancellable(bcryptjs.compare(senha.revelar(), this.#hashDescartavel), signal, {
      adaptador: 'BcryptServicoDeHash',
      operacao: 'consumirTempoEquivalente',
    });
    return false;
  }

  precisaRehash(senhaComHash) {
    if (!senhaComHash) return false;
    try {
      return bcryptjs.getRounds(senhaComHash.revelar()) < this.#custo;
    } catch {
      // Hash em formato desconhecido: não tenta reprocessar, apenas segue.
      return false;
    }
  }
}

module.exports = { BcryptServicoDeHash };
