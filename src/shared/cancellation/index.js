'use strict';

const { CancelledError, TimeoutError } = require('../errors');

/**
 * Cancelamento cooperativo.
 *
 * "Cooperativo" é literal e a distinção importa: em Node não existe forma de
 * interromper uma computação em andamento de fora. O que se pode fazer é
 *   (a) checar o sinal em pontos definidos e desistir cedo, e
 *   (b) abandonar a espera por um resultado que já não interessa.
 *
 * O que ESTE projeto consegue cancelar de verdade:
 *   - qualquer trecho entre dois `throwIfAborted` (loops, pipelines);
 *   - a ESPERA por uma query do MongoDB (`runCancellable`) e, com `maxTimeMS`,
 *     a execução no servidor do banco também é abortada;
 *   - timers e delays.
 *
 * O que NÃO consegue, e por quê:
 *   - `bcryptjs` é JavaScript puro e roda até o fim; o `runCancellable` libera a
 *     requisição, mas o hash continua consumindo CPU até terminar. Cancelar de
 *     verdade exigiria mover o hash para um worker thread e derrubá-lo — o que
 *     está registrado como melhoria futura, não como feito.
 */

/** Lança CancelledError se o sinal já foi abortado. Ponto de checagem barato. */
function throwIfAborted(signal, contexto = {}) {
  if (signal?.aborted) {
    throw new CancelledError('Operação cancelada pelo chamador.', { context: contexto });
  }
}

/**
 * Combina sinais: o resultado aborta quando qualquer um dos entrantes abortar.
 * Usado para somar "cliente desconectou" + "estourou o timeout da operação".
 */
function combinarSinais(...sinais) {
  const validos = sinais.filter(Boolean);
  if (validos.length === 0) return undefined;
  if (validos.length === 1) return validos[0];
  return AbortSignal.any(validos);
}

/** Sinal que aborta após `ms`. Combina com o sinal do chamador, se houver. */
function comTimeout(signal, ms) {
  return combinarSinais(signal, AbortSignal.timeout(ms));
}

/**
 * Abandona a espera por uma promise quando o sinal aborta.
 *
 * A promise original NÃO é interrompida — continua até terminar e seu resultado
 * é descartado. Isso é o máximo que se pode fazer sem cooperação de quem a
 * criou, e é o motivo de os adaptadores também passarem `maxTimeMS` ao banco.
 */
function runCancellable(promise, signal, contexto = {}) {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(
      new CancelledError('Operação cancelada antes de iniciar.', { context: contexto })
    );
  }

  return new Promise((resolve, reject) => {
    const aoAbortar = () => {
      const motivo = signal.reason;
      // AbortSignal.timeout aborta com TimeoutError do DOM; distinguir os dois
      // separa "cliente desistiu" de "dependência demorou demais".
      if (motivo?.name === 'TimeoutError') {
        reject(
          new TimeoutError('A operação excedeu o tempo limite.', {
            context: contexto,
            cause: motivo,
          })
        );
      } else {
        reject(
          new CancelledError('Operação cancelada pelo chamador.', {
            context: contexto,
            cause: motivo,
          })
        );
      }
    };

    signal.addEventListener('abort', aoAbortar, { once: true });

    promise.then(
      (valor) => {
        signal.removeEventListener('abort', aoAbortar);
        resolve(valor);
      },
      (erro) => {
        signal.removeEventListener('abort', aoAbortar);
        reject(erro);
      }
    );
  });
}

/** `setTimeout` que respeita cancelamento — sem ele, um delay segura o shutdown. */
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CancelledError('Espera cancelada.'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', aoAbortar);
      resolve();
    }, ms);

    function aoAbortar() {
      clearTimeout(timer);
      reject(new CancelledError('Espera cancelada.'));
    }

    signal?.addEventListener('abort', aoAbortar, { once: true });
  });
}

module.exports = { throwIfAborted, combinarSinais, comTimeout, runCancellable, delay };
