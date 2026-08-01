'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, extractCsrf } = require('../helpers/test-app');

describe('Autenticação', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  const novoAgente = async () => {
    const agent = request.agent(ctx.app);
    const page = await agent.get('/login/index').expect(200);
    return { agent, csrf: extractCsrf(page.text) };
  };

  test('rejeita POST sem token CSRF', async () => {
    await request(ctx.app)
      .post('/login/register')
      .type('form')
      .send({ email: 'a@example.com', password: 'senha-de-teste-123' })
      .expect(403);
  });

  test('rejeita token CSRF de outra sessão', async () => {
    const { csrf } = await novoAgente();
    const { agent: outro } = await novoAgente();

    await outro
      .post('/login/register')
      .type('form')
      .send({ _csrf: csrf, email: 'b@example.com', password: 'senha-de-teste-123' })
      .expect(403);
  });

  test('cadastra usuário e nunca armazena a senha em texto puro', async () => {
    const { agent, csrf } = await novoAgente();

    await agent
      .post('/login/register')
      .type('form')
      .send({ _csrf: csrf, email: 'Novo@Example.com', password: 'senha-de-teste-123' })
      .expect(302);

    const doc = await ctx.models.LoginModel.findOne({ email: 'novo@example.com' }).select(
      '+password'
    );
    assert.ok(doc, 'e-mail deve ser normalizado para minúsculas');
    assert.notEqual(doc.password, 'senha-de-teste-123');
    assert.match(doc.password, /^\$2[aby]\$/, 'senha deve estar em hash bcrypt');
  });

  test('recusa senha abaixo do mínimo', async () => {
    const { agent, csrf } = await novoAgente();

    await agent
      .post('/login/register')
      .type('form')
      .send({ _csrf: csrf, email: 'curta@example.com', password: '123' })
      .expect(302);

    assert.equal(await ctx.models.LoginModel.countDocuments({ email: 'curta@example.com' }), 0);
  });

  test('recusa cadastro quando a confirmação de senha diverge', async () => {
    const { agent, csrf } = await novoAgente();

    const res = await agent
      .post('/login/register')
      .type('form')
      .send({
        _csrf: csrf,
        email: 'confirma@example.com',
        password: 'senha-de-teste-123',
        confirmarSenha: 'senha-DIFERENTE-123',
      })
      .expect(302);

    assert.equal(res.headers.location, '/cadastro', 'falha volta para a tela de cadastro');
    assert.equal(await ctx.models.LoginModel.countDocuments({ email: 'confirma@example.com' }), 0);

    // Com a confirmação correta, o cadastro passa.
    await agent
      .post('/login/register')
      .type('form')
      .send({
        _csrf: csrf,
        email: 'confirma@example.com',
        password: 'senha-de-teste-123',
        confirmarSenha: 'senha-de-teste-123',
      })
      .expect(302);
    assert.equal(await ctx.models.LoginModel.countDocuments({ email: 'confirma@example.com' }), 1);
  });

  test('impede cadastro duplicado mesmo variando a caixa do e-mail', async () => {
    const a = await novoAgente();
    await a.agent
      .post('/login/register')
      .type('form')
      .send({ _csrf: a.csrf, email: 'dup@example.com', password: 'senha-de-teste-123' })
      .expect(302);

    const b = await novoAgente();
    await b.agent
      .post('/login/register')
      .type('form')
      .send({ _csrf: b.csrf, email: 'DUP@example.com', password: 'senha-de-teste-123' })
      .expect(302);

    assert.equal(await ctx.models.LoginModel.countDocuments({ email: 'dup@example.com' }), 1);
  });

  // Regressão: as mensagens "Usuário não existe" e "Senha inválida" permitiam
  // enumerar quais e-mails estavam cadastrados.
  test('não distingue e-mail inexistente de senha errada', async () => {
    const a = await novoAgente();
    await a.agent
      .post('/login/register')
      .type('form')
      .send({ _csrf: a.csrf, email: 'existe@example.com', password: 'senha-de-teste-123' })
      .expect(302);

    const inexistente = await novoAgente();
    await inexistente.agent
      .post('/login/login')
      .type('form')
      .send({ _csrf: inexistente.csrf, email: 'naoexiste@example.com', password: 'errada-123456' })
      .expect(302);
    const msgInexistente = (await inexistente.agent.get('/login/index')).text;

    const senhaErrada = await novoAgente();
    await senhaErrada.agent
      .post('/login/login')
      .type('form')
      .send({ _csrf: senhaErrada.csrf, email: 'existe@example.com', password: 'errada-123456' })
      .expect(302);
    const msgSenhaErrada = (await senhaErrada.agent.get('/login/index')).text;

    assert.ok(msgInexistente.includes('E-mail ou senha inválidos'));
    assert.ok(msgSenhaErrada.includes('E-mail ou senha inválidos'));
  });

  // Regressão: sem regenerate, um id de sessão fixado antes do login continuava
  // válido depois dele (session fixation).
  test('regenera o id de sessão após o login', async () => {
    const { agent, csrf } = await novoAgente();
    await agent
      .post('/login/register')
      .type('form')
      .send({ _csrf: csrf, email: 'fix@example.com', password: 'senha-de-teste-123' })
      .expect(302);

    const antes = await agent.get('/login/index');
    const cookieAntes = antes.headers['set-cookie'];

    const login = await agent
      .post('/login/login')
      .type('form')
      .send({ _csrf: csrf, email: 'fix@example.com', password: 'senha-de-teste-123' })
      .expect(302);

    const cookieDepois = login.headers['set-cookie'];
    assert.ok(cookieDepois, 'login deve emitir um novo cookie de sessão');
    assert.notDeepEqual(cookieDepois, cookieAntes);
  });

  test('cookie de sessão é httpOnly e sameSite', async () => {
    const res = await request(ctx.app).get('/login/index').expect(200);
    // A sessão só é criada quando há algo a guardar (saveUninitialized:false);
    // o token CSRF já força isso.
    const cookie = (res.headers['set-cookie'] || []).join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  });

  test('logout via GET não é aceito', async () => {
    await request(ctx.app).get('/login/logout').expect(404);
  });
});
