'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, signUpAndLogin } = require('../helpers/test-app');
const { CancelledError } = require('../../src/shared/errors');
const { UsuarioId } = require('../../src/domain/value-objects/Identificador');

/**
 * Prova que o AbortSignal atravessa toda a cadeia:
 * controller → caso de uso → repositório → driver do MongoDB.
 *
 * Sem estes testes, a propagação seria só uma assinatura bonita — qualquer elo
 * que "esquecesse" de repassar o sinal passaria despercebido.
 */
describe('Cancelamento cooperativo', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  const abortado = () => {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  };

  test('caso de uso de leitura desiste antes de tocar no banco', async () => {
    const listar = ctx.container.resolver('listarContatos');

    const resultado = await listar.run(
      { proprietarioId: UsuarioId.deConfianca('507f1f77bcf86cd799439011') },
      { signal: abortado() }
    );

    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error instanceof CancelledError, true);
    assert.equal(resultado.error.status, 499);
  });

  test('caso de uso de escrita não persiste nada quando cancelado', async () => {
    const criar = ctx.container.resolver('criarContato');

    const resultado = await criar.run(
      {
        proprietarioId: UsuarioId.deConfianca('507f1f77bcf86cd799439011'),
        dados: { nome: 'Não deve existir', telefone: '62999990000' },
      },
      { signal: abortado() }
    );

    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error instanceof CancelledError, true);
    assert.equal(await ctx.models.ContatoModel.countDocuments({ nome: 'Não deve existir' }), 0);
  });

  test('autenticação cancelada não vaza exceção para fora do Result', async () => {
    const autenticar = ctx.container.resolver('autenticarUsuario');

    const resultado = await autenticar.run(
      { email: 'alguem@example.com', senha: 'senha-de-teste-123' },
      { signal: abortado() }
    );

    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error instanceof CancelledError, true);
  });

  // Um cancelamento vira 499, não 500: fechar a aba não pode consumir o error
  // budget nem disparar o alarme de 5xx.
  test('cancelamento é classificado como 499, fora da faixa de erro do servidor', async () => {
    const obter = ctx.container.resolver('obterContato');

    const resultado = await obter.run(
      {
        contatoId: '507f191e810c19729de860ea',
        proprietarioId: UsuarioId.deConfianca('507f1f77bcf86cd799439011'),
      },
      { signal: abortado() }
    );

    assert.equal(resultado.error.status, 499);
    assert.ok(resultado.error.status < 500, 'não pode contar como falha do servidor');
  });

  test('o repositório respeita o sinal mesmo com dados reais presentes', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });
    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Existente', telefone: '62999990000' })
      .expect(302);

    const repositorio = ctx.container.resolver('contatoRepository');
    const dono = await ctx.models.LoginModel.findOne({ email: 'dono@example.com' });

    await assert.rejects(
      repositorio.listarDoProprietario(
        UsuarioId.deConfianca(dono._id),
        { pagina: 1, tamanho: 20 },
        abortado()
      ),
      (erro) => erro instanceof CancelledError
    );
  });

  test('sem sinal, tudo funciona normalmente', async () => {
    const listar = ctx.container.resolver('listarContatos');
    const resultado = await listar.run({
      proprietarioId: UsuarioId.deConfianca('507f1f77bcf86cd799439011'),
    });

    assert.equal(resultado.isSuccess, true);
    assert.deepEqual(resultado.value.itens, []);
  });
});
