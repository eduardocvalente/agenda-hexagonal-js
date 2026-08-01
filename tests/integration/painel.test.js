'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, signUpAndLogin } = require('../helpers/test-app');

describe('Painel — visão geral da conta', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  test('exige autenticação', async () => {
    await request(ctx.app).get('/painel').expect(302).expect('location', '/login/index');
  });

  test('mostra totais, etiquetas e atividade recente do próprio usuário', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'painel@example.com',
    });

    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Helena', telefone: '62999990000', etiquetas: 'trabalho' })
      .expect(302);
    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Igor', telefone: '62988880000', etiquetas: 'trabalho, casa' })
      .expect(302);

    const doc = await ctx.models.ContatoModel.findOne({ nome: 'Helena' }).lean();
    await agent.post(`/contato/favorito/${doc._id}`).type('form').send({ _csrf: csrf }).expect(302);

    const res = await agent.get('/painel').expect(200);

    assert.ok(res.text.includes('Visão geral'));
    // Barras por etiqueta: "trabalho" aparece com 2 contatos.
    assert.ok(res.text.includes('badge-etiqueta'));
    assert.ok(res.text.includes('trabalho'));
    // Recentes listam os dois contatos.
    assert.ok(res.text.includes('Helena'));
    assert.ok(res.text.includes('Igor'));
    // Atividade recente inclui a promoção a favorito.
    assert.ok(res.text.includes('Contato marcado como favorito'));
  });

  test('o painel de um usuário não vê números de outro', async () => {
    const alice = await signUpAndLogin(request, ctx.app, { email: 'alice-painel@example.com' });
    await alice.agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: alice.csrf, nome: 'Exclusivo', telefone: '62999990000' })
      .expect(302);

    const bruno = await signUpAndLogin(request, ctx.app, { email: 'bruno-painel@example.com' });
    const res = await bruno.agent.get('/painel').expect(200);

    assert.ok(!res.text.includes('Exclusivo'), 'contato alheio não pode aparecer no painel');
  });
});
