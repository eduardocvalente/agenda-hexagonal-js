'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  throwIfAborted,
  combinarSinais,
  comTimeout,
  runCancellable,
  delay,
} = require('../../../src/shared/cancellation');
const { CancelledError, TimeoutError } = require('../../../src/shared/errors');

describe('throwIfAborted', () => {
  test('não faz nada sem sinal ou com sinal ativo', () => {
    assert.doesNotThrow(() => throwIfAborted(undefined));
    assert.doesNotThrow(() => throwIfAborted(new AbortController().signal));
  });

  test('lança CancelledError com contexto quando já abortado', () => {
    const controller = new AbortController();
    controller.abort();

    assert.throws(
      () => throwIfAborted(controller.signal, { etapa: 'teste' }),
      (erro) => erro instanceof CancelledError && erro.context.etapa === 'teste'
    );
  });
});

describe('combinarSinais', () => {
  test('aborta quando qualquer um dos sinais aborta', () => {
    const a = new AbortController();
    const b = new AbortController();
    const combinado = combinarSinais(a.signal, b.signal);

    assert.equal(combinado.aborted, false);
    b.abort();
    assert.equal(combinado.aborted, true);
  });

  test('devolve o próprio sinal quando há apenas um', () => {
    const a = new AbortController();
    assert.equal(combinarSinais(a.signal, undefined), a.signal);
  });

  test('devolve undefined quando não há sinal algum', () => {
    assert.equal(combinarSinais(undefined, null), undefined);
  });
});

describe('runCancellable', () => {
  test('devolve o valor quando a promise resolve antes do cancelamento', async () => {
    const controller = new AbortController();
    assert.equal(await runCancellable(Promise.resolve('ok'), controller.signal), 'ok');
  });

  test('rejeita de imediato quando o sinal já está abortado', async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      runCancellable(new Promise(() => {}), controller.signal),
      (erro) => erro instanceof CancelledError
    );
  });

  test('abandona a espera quando o sinal aborta durante a operação', async () => {
    const controller = new AbortController();
    const eterna = new Promise(() => {});

    const emAndamento = runCancellable(eterna, controller.signal, { operacao: 'teste' });
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(emAndamento, (erro) => erro instanceof CancelledError);
  });

  // Distinguir os dois separa "cliente desistiu" (499) de "dependência não
  // respondeu" (504) — a segunda é problema do sistema, a primeira não.
  test('distingue timeout de cancelamento pelo chamador', async () => {
    const sinal = comTimeout(undefined, 20);

    await assert.rejects(
      runCancellable(new Promise(() => {}), sinal),
      (erro) => erro instanceof TimeoutError
    );
  });

  test('propaga o erro original da promise sem reembrulhar', async () => {
    const original = new Error('falha de verdade');
    await assert.rejects(
      runCancellable(Promise.reject(original), new AbortController().signal),
      (erro) => erro === original
    );
  });

  test('sem sinal, devolve a própria promise', async () => {
    const promise = Promise.resolve(1);
    assert.equal(runCancellable(promise, undefined), promise);
  });
});

describe('delay', () => {
  test('resolve após o tempo pedido', async () => {
    const inicio = Date.now();
    await delay(20);
    assert.ok(Date.now() - inicio >= 15);
  });

  // Sem isso, uma espera pendente segura o processo além do grace period do
  // orquestrador e vira SIGKILL no meio de uma requisição.
  test('cancela a espera e limpa o timer', async () => {
    const controller = new AbortController();
    const espera = delay(5_000, controller.signal);
    controller.abort();

    await assert.rejects(espera, (erro) => erro instanceof CancelledError);
  });
});
