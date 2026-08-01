'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, signUpAndLogin } = require('../helpers/test-app');
const { NomePessoa } = require('../../src/domain/value-objects/NomePessoa');

describe('Validações de entrada — nomes sem números e etiquetas em compromissos', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  test('NomePessoa recusa dígitos, mas aceita nomes reais complexos', () => {
    assert.equal(NomePessoa.criar('João 62999').error.code, 'NOME_COM_NUMERO');
    assert.equal(NomePessoa.criar('Ana', 'Silva 2').error.code, 'SOBRENOME_COM_NUMERO');

    for (const nomeReal of ["D'Ávila", 'María-José', 'Nguyễn', 'Müller']) {
      assert.equal(NomePessoa.criar(nomeReal).isSuccess, true, `nome real: ${nomeReal}`);
    }
  });

  test('contato com número no nome é recusado pela borda HTTP', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'nome-numero@example.com',
    });

    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Carlos 998', telefone: '62999990000' })
      .expect(302);

    assert.equal(await ctx.models.ContatoModel.countDocuments({}), 0);
  });

  test('compromisso aceita etiquetas com a mesma normalização dos contatos', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'etiqueta-compromisso@example.com',
    });

    await agent
      .post('/compromisso/register')
      .type('form')
      .send({
        _csrf: csrf,
        titulo: 'Reunião',
        inicioEm: '2030-04-10T10:00',
        etiquetas: 'Trabalho , trabalho, Projeto-Alfa',
      })
      .expect(302);

    const doc = await ctx.models.CompromissoModel.findOne({ titulo: 'Reunião' }).lean();
    assert.deepEqual(doc.etiquetas, ['trabalho', 'projeto-alfa']);
  });

  test('as sugestões do formulário unificam etiquetas de contatos e compromissos', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'sugestoes@example.com',
    });

    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Bia', telefone: '62999990000', etiquetas: 'família' })
      .expect(302);
    await agent
      .post('/compromisso/register')
      .type('form')
      .send({ _csrf: csrf, titulo: 'Médico', inicioEm: '2030-04-10T10:00', etiquetas: 'saúde' })
      .expect(302);

    // As sugestões visíveis do formulário de contato precisam oferecer as duas.
    const form = await agent.get('/contato/index').expect(200);
    assert.ok(form.text.includes('data-sugestao-etiqueta'));
    assert.ok(form.text.includes('família'));
    assert.ok(form.text.includes('saúde'));
  });

  test('o painel mostra o total de compromissos futuros', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'painel-compromissos@example.com',
    });

    await agent
      .post('/compromisso/register')
      .type('form')
      .send({ _csrf: csrf, titulo: 'Futuro', inicioEm: '2030-04-10T10:00' })
      .expect(302);

    const painel = await agent.get('/painel').expect(200);
    assert.ok(painel.text.includes('Compromisso'));
    assert.ok(painel.text.includes('Futuro'), 'próximo compromisso listado no painel');
  });
});
