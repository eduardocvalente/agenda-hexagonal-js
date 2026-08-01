'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, signUpAndLogin } = require('../helpers/test-app');

describe('Exportação de contatos', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  test('exige autenticação', async () => {
    await request(ctx.app).get('/contato/exportar').expect(302).expect('location', '/login/index');
  });

  test('CSV vem com BOM, cabeçalho e apenas os contatos do dono', async () => {
    const alice = await signUpAndLogin(request, ctx.app, { email: 'alice-csv@example.com' });
    await alice.agent
      .post('/contato/register')
      .type('form')
      .send({
        _csrf: alice.csrf,
        nome: 'Renata',
        telefone: '62999990000',
        etiquetas: 'trabalho',
      })
      .expect(302);

    const bruno = await signUpAndLogin(request, ctx.app, { email: 'bruno-csv@example.com' });
    await bruno.agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: bruno.csrf, nome: 'Alheio', telefone: '62988880000' })
      .expect(302);

    const res = await alice.agent
      .get('/contato/exportar')
      .expect(200)
      .expect('content-type', /text\/csv/)
      .expect('content-disposition', /attachment; filename="contatos\.csv"/);

    assert.equal(res.text.charCodeAt(0), 0xfeff, 'BOM UTF-8 para o Excel');
    assert.ok(res.text.includes('nome;sobrenome;email;telefone;etiquetas;favorito'));
    assert.ok(res.text.includes('Renata'));
    assert.ok(res.text.includes('trabalho'));
    assert.ok(!res.text.includes('Alheio'), 'contato de outro dono não pode vazar');
  });

  test('neutraliza CSV injection em células que começam com fórmula', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'injection@example.com',
    });

    // Fórmula SEM dígitos de propósito: números em nome/sobrenome são
    // recusados pelo domínio antes, e este teste é sobre a camada CSV.
    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Eva', sobrenome: '=HYPERLINK(A)', telefone: '62999990000' })
      .expect(302);

    const res = await agent.get('/contato/exportar').expect(200);

    assert.ok(
      res.text.includes(";'=HYPERLINK(A)"),
      'célula iniciada por = precisa ganhar apóstrofo'
    );
  });

  test('formato JSON entrega o DTO sem campos internos', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'json@example.com',
    });

    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Otávio', telefone: '62999990000', etiquetas: 'casa' })
      .expect(302);

    const res = await agent
      .get('/contato/exportar?formato=json')
      .expect(200)
      .expect('content-type', /application\/json/)
      .expect('content-disposition', /attachment; filename="contatos\.json"/);

    const dados = JSON.parse(res.text);
    assert.equal(dados.length, 1);
    assert.equal(dados[0].nome, 'Otávio');
    assert.deepEqual(dados[0].etiquetas, ['casa']);
    assert.ok(!('user' in dados[0]), 'id do dono não sai no export');
  });

  test('a exportação entra na trilha de auditoria', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'trilha-export@example.com',
    });
    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Pia', telefone: '62999990000' })
      .expect(302);

    await agent.get('/contato/exportar').expect(200);

    const registro = await ctx.models.AuditoriaModel.findOne({
      acao: 'contato.exportados',
    }).lean();
    assert.ok(registro, 'exportar a base é evento auditável');
    assert.equal(registro.detalhes.total, 1);
  });
});
