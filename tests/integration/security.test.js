'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, extractCsrf } = require('../helpers/test-app');

describe('Cabeçalhos, health checks e injeção', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  test('/healthz responde sem tocar no banco', async () => {
    const res = await request(ctx.app).get('/healthz').expect(200);
    assert.equal(res.body.status, 'ok');
  });

  test('/readyz confirma a dependência do MongoDB', async () => {
    const res = await request(ctx.app).get('/readyz').expect(200);
    assert.equal(res.body.checks.mongo, 'up');
  });

  test('envia cabeçalhos de segurança e não expõe o framework', async () => {
    const res = await request(ctx.app).get('/').expect(200);

    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(res.headers['content-security-policy']);
  });

  // Regressão: a CSP padrão do helmet usa script-src 'self' e bloqueia os
  // scripts de CDN das views sem gerar nenhum erro no servidor.
  test('a CSP libera os CDNs efetivamente usados pelas views', async () => {
    const res = await request(ctx.app).get('/').expect(200);
    const csp = res.headers['content-security-policy'];

    assert.match(csp, /script-src [^;]*cdn\.jsdelivr\.net/);
    assert.match(csp, /script-src [^;]*code\.jquery\.com/);
    assert.match(csp, /object-src 'none'/);
    assert.ok(!/script-src [^;]*unsafe-inline/.test(csp), 'script-src não pode ter unsafe-inline');
  });

  test('propaga correlation id na resposta', async () => {
    const res = await request(ctx.app).get('/').set('x-request-id', 'teste-123').expect(200);
    assert.equal(res.headers['x-request-id'], 'teste-123');
  });

  // Operadores do MongoDB enviados como objeto no corpo do formulário
  // (`email[$ne]=`) precisam ser descartados antes de virar filtro de query.
  test('neutraliza NoSQL injection no login', async () => {
    const agent = request.agent(ctx.app);
    const page = await agent.get('/login/index').expect(200);
    const csrf = extractCsrf(page.text);

    await agent
      .post('/login/register')
      .type('form')
      .send({ _csrf: csrf, email: 'vitima@example.com', password: 'senha-de-teste-123' })
      .expect(302);

    const atacante = request.agent(ctx.app);
    const p2 = await atacante.get('/login/index').expect(200);
    const csrf2 = extractCsrf(p2.text);

    await atacante
      .post('/login/login')
      .type('form')
      .send(`_csrf=${encodeURIComponent(csrf2)}&email[$ne]=null&password[$ne]=null`)
      .expect(302);

    // Continua deslogado: a home mostra o convite para entrar.
    const home = await atacante.get('/').expect(200);
    assert.ok(home.text.includes('Entre ou crie sua conta'));
  });

  test('rejeita corpo acima do limite configurado', async () => {
    await request(ctx.app)
      .post('/login/login')
      .type('form')
      .send(`email=${'a'.repeat(200_000)}`)
      .expect(413);
  });

  test('página inexistente responde 404 renderizado', async () => {
    const res = await request(ctx.app).get('/rota/que/nao/existe').expect(404);
    assert.ok(res.text.includes('404'));
  });
});
