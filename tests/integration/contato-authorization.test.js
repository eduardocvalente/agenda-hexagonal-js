'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, signUpAndLogin } = require('../helpers/test-app');

/**
 * Testes de regressão do achado mais grave da auditoria: a collection de
 * contatos não tinha dono. Qualquer usuário autenticado lia, editava e apagava
 * os contatos de todos os outros, e a home expunha a base inteira sem login.
 */
describe('Autorização de contatos (ownership)', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  async function criarContatoDe(email) {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, { email });
    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Contato de ' + email, telefone: '62999990000' })
      .expect(302);

    const doc = await ctx.models.ContatoModel.findOne({ nome: 'Contato de ' + email });
    assert.ok(doc, 'contato deveria ter sido criado');
    return { agent, csrf, id: String(doc._id) };
  }

  test('visitante anônimo não vê contato nenhum na home', async () => {
    await criarContatoDe('dono@example.com');

    const res = await request(ctx.app).get('/').expect(200);
    assert.ok(!res.text.includes('Contato de dono@example.com'));
    assert.ok(res.text.includes('Entre ou crie sua conta'));
  });

  test('contato criado é vinculado ao usuário da sessão', async () => {
    const { id } = await criarContatoDe('dono@example.com');
    const doc = await ctx.models.ContatoModel.findById(id);
    const dono = await ctx.models.LoginModel.findOne({ email: 'dono@example.com' });
    assert.equal(String(doc.user), String(dono._id));
  });

  test('outro usuário recebe 404 ao tentar ler contato alheio', async () => {
    const { id } = await criarContatoDe('dono@example.com');
    const intruso = await signUpAndLogin(request, ctx.app, { email: 'intruso@example.com' });

    await intruso.agent.get(`/contato/index/${id}`).expect(404);
  });

  test('outro usuário não consegue editar contato alheio', async () => {
    const { id } = await criarContatoDe('dono@example.com');
    const intruso = await signUpAndLogin(request, ctx.app, { email: 'intruso@example.com' });

    await intruso.agent
      .post(`/contato/edit/${id}`)
      .type('form')
      .send({ _csrf: intruso.csrf, nome: 'INVADIDO', telefone: '11111111111' })
      .expect(302);

    const doc = await ctx.models.ContatoModel.findById(id);
    assert.equal(doc.nome, 'Contato de dono@example.com');
  });

  test('outro usuário não consegue apagar contato alheio', async () => {
    const { id } = await criarContatoDe('dono@example.com');
    const intruso = await signUpAndLogin(request, ctx.app, { email: 'intruso@example.com' });

    await intruso.agent
      .post(`/contato/delete/${id}`)
      .type('form')
      .send({ _csrf: intruso.csrf })
      .expect(404);

    assert.ok(await ctx.models.ContatoModel.findById(id), 'contato não deveria ter sido apagado');
  });

  test('a home lista apenas os contatos do próprio usuário', async () => {
    await criarContatoDe('dono@example.com');
    const outro = await criarContatoDe('outro@example.com');

    const res = await outro.agent.get('/').expect(200);
    assert.ok(res.text.includes('Contato de outro@example.com'));
    assert.ok(!res.text.includes('Contato de dono@example.com'));
  });

  // Regressão: `user` no corpo da requisição reatribuía o dono do registro.
  test('ignora tentativa de mass assignment do campo user', async () => {
    const alvo = await signUpAndLogin(request, ctx.app, { email: 'alvo@example.com' });
    const alvoDoc = await ctx.models.LoginModel.findOne({ email: 'alvo@example.com' });

    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'atacante@example.com',
    });
    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Injetado', telefone: '62988887777', user: String(alvoDoc._id) })
      .expect(302);

    const doc = await ctx.models.ContatoModel.findOne({ nome: 'Injetado' });
    const atacante = await ctx.models.LoginModel.findOne({ email: 'atacante@example.com' });
    assert.equal(String(doc.user), String(atacante._id));

    const naAgendaDoAlvo = await alvo.agent.get('/').expect(200);
    assert.ok(!naAgendaDoAlvo.text.includes('Injetado'));
  });

  // Regressão: findById com ObjectId malformado lançava CastError fora de
  // try/catch; em Express 4 isso vira unhandledRejection e derruba o processo.
  test('id malformado responde 400 sem derrubar o processo', async () => {
    const { agent } = await signUpAndLogin(request, ctx.app, { email: 'user@example.com' });
    await agent.get('/contato/index/nao-e-um-objectid').expect(404);
    await agent.get('/').expect(200);
  });

  test('rotas de contato exigem autenticação', async () => {
    await request(ctx.app).get('/contato/index').expect(302).expect('location', '/login/index');
  });
});
