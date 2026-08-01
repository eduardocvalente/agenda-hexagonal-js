'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ContextoDeExecucao } = require('../../../src/shared/context/ContextoDeExecucao');

const proximoTick = () => new Promise((r) => setImmediate(r));

describe('ContextoDeExecucao', () => {
  test('fora de qualquer escopo, devolve vazio em vez de lançar', () => {
    assert.deepEqual(ContextoDeExecucao.atual(), {});
    assert.equal(ContextoDeExecucao.usuarioId, undefined);
    assert.equal(ContextoDeExecucao.requestId, undefined);
  });

  test('expõe os campos dentro do escopo', () => {
    ContextoDeExecucao.executarCom({ requestId: 'req-1', usuarioId: 'u-1', ip: '10.0.0.1' }, () => {
      assert.equal(ContextoDeExecucao.requestId, 'req-1');
      assert.equal(ContextoDeExecucao.usuarioId, 'u-1');
      assert.equal(ContextoDeExecucao.ip, '10.0.0.1');
    });
  });

  test('o contexto sobrevive a saltos assíncronos', async () => {
    await ContextoDeExecucao.executarCom({ requestId: 'req-async' }, async () => {
      await proximoTick();
      await Promise.resolve();
      assert.equal(ContextoDeExecucao.requestId, 'req-async');
    });
  });

  // A propriedade que torna o AsyncLocalStorage utilizável num servidor: sem
  // isolamento entre escopos concorrentes, a trilha de auditoria atribuiria
  // ações ao usuário errado sob carga.
  test('escopos concorrentes não vazam um para o outro', async () => {
    const observado = [];

    const requisicao = (id, atraso) =>
      ContextoDeExecucao.executarCom({ usuarioId: id }, async () => {
        await new Promise((r) => setTimeout(r, atraso));
        observado.push({ esperado: id, obtido: ContextoDeExecucao.usuarioId });
      });

    // Intercalados de propósito: o que começa primeiro termina por último.
    await Promise.all([
      requisicao('usuario-A', 30),
      requisicao('usuario-B', 5),
      requisicao('usuario-C', 15),
    ]);

    for (const { esperado, obtido } of observado) {
      assert.equal(obtido, esperado, `contexto vazou: esperava ${esperado}, obteve ${obtido}`);
    }
    assert.equal(observado.length, 3);
  });

  test('sai do escopo ao terminar', async () => {
    await ContextoDeExecucao.executarCom({ usuarioId: 'u-1' }, async () => {
      assert.equal(ContextoDeExecucao.usuarioId, 'u-1');
    });
    assert.equal(ContextoDeExecucao.usuarioId, undefined);
  });

  test('enriquecerCom acrescenta sem perder o que já existia', () => {
    ContextoDeExecucao.executarCom({ requestId: 'req-1' }, () => {
      ContextoDeExecucao.enriquecerCom({ usuarioId: 'u-9' }, () => {
        assert.equal(ContextoDeExecucao.requestId, 'req-1');
        assert.equal(ContextoDeExecucao.usuarioId, 'u-9');
      });
      // O escopo externo permanece intacto — o contexto é imutável.
      assert.equal(ContextoDeExecucao.usuarioId, undefined);
    });
  });

  test('o contexto é congelado', () => {
    ContextoDeExecucao.executarCom({ usuarioId: 'u-1' }, () => {
      assert.throws(() => {
        ContextoDeExecucao.atual().usuarioId = 'invasor';
      }, TypeError);
    });
  });
});
