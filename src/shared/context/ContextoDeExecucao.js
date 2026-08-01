'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * Contexto ambiente por requisição, via AsyncLocalStorage.
 *
 * O problema que resolve: `requestId`, `usuarioId` e IP são necessários no
 * registro de auditoria e nos logs, mas o domínio não tem nada a ver com eles.
 * A alternativa seria passá-los como parâmetro por toda a cadeia —
 * controller → caso de uso → serviço → repositório —, poluindo assinaturas com
 * dados que só a borda e a auditoria consomem.
 *
 * O AsyncLocalStorage mantém esses valores acessíveis ao longo de toda a cadeia
 * assíncrona da requisição, sem variável global e sem vazamento entre
 * requisições concorrentes: cada `executarCom` cria um escopo isolado.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * REGRA DE USO, e ela não é negociável:
 *
 *   Use para METADADOS TRANSVERSAIS (quem, quando, de onde, correlação).
 *   NUNCA para dado de negócio.
 *
 * Um caso de uso que leia o `proprietarioId` daqui em vez de recebê-lo como
 * parâmetro fica impossível de testar sem montar o contexto, e a dependência
 * some da assinatura — vira um parâmetro invisível. É por isso que
 * `CriarContato` continua recebendo `proprietarioId` explicitamente, mesmo
 * existindo no contexto: ali ele é dado de negócio, não metadado.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Limitações honestas:
 *  - custo real, ainda que pequeno, em cada salto assíncrono;
 *  - o contexto se perde se alguma biblioteca quebrar a cadeia async (pools de
 *    callback antigos fazem isso). Por isso todo consumidor trata `undefined`
 *    como caso normal, e não como erro.
 */
const armazenamento = new AsyncLocalStorage();

const CONTEXTO_VAZIO = Object.freeze({});

class ContextoDeExecucao {
  /**
   * Executa `callback` dentro de um escopo isolado.
   * @param {{requestId?: string, usuarioId?: string, ip?: string, userAgent?: string}} contexto
   */
  static executarCom(contexto, callback) {
    return armazenamento.run(Object.freeze({ ...contexto }), callback);
  }

  /** Contexto atual. Devolve objeto vazio se não houver — nunca lança. */
  static atual() {
    return armazenamento.getStore() ?? CONTEXTO_VAZIO;
  }

  static get requestId() {
    return ContextoDeExecucao.atual().requestId;
  }

  static get usuarioId() {
    return ContextoDeExecucao.atual().usuarioId;
  }

  static get ip() {
    return ContextoDeExecucao.atual().ip;
  }

  static get userAgent() {
    return ContextoDeExecucao.atual().userAgent;
  }

  /**
   * Acrescenta campos ao contexto do escopo atual.
   *
   * Necessário porque o `usuarioId` só existe DEPOIS do login: o contexto é
   * criado no início da requisição, quando ainda não se sabe quem é. Cria um
   * novo escopo em vez de mutar o existente — o contexto permanece imutável.
   */
  static enriquecerCom(campos, callback) {
    return ContextoDeExecucao.executarCom({ ...ContextoDeExecucao.atual(), ...campos }, callback);
  }
}

module.exports = { ContextoDeExecucao };
