'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, signUpAndLogin, extractCsrf } = require('../helpers/test-app');
const { ACOES } = require('../../src/domain/value-objects/AcaoAuditada');

const SENHA = 'senha-de-teste-123';

describe('Trilha de auditoria', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  const trilhaDe = async (email) => {
    const usuario = await ctx.models.LoginModel.findOne({ email });
    return ctx.models.AuditoriaModel.find({ usuario: usuario._id }).sort({ ocorridoEm: 1 }).lean();
  };

  test('cadastro e login geram registros na trilha', async () => {
    await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });

    const registros = await trilhaDe('dono@example.com');
    const acoes = registros.map((r) => r.acao);

    assert.ok(acoes.includes(ACOES.USUARIO_CADASTRADO));
    assert.ok(acoes.includes(ACOES.USUARIO_AUTENTICADO));
  });

  test('o ciclo completo de um contato aparece na trilha', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });

    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Fulano', telefone: '62999990000' })
      .expect(302);

    const contato = await ctx.models.ContatoModel.findOne({ nome: 'Fulano' });

    await agent
      .post(`/contato/edit/${contato._id}`)
      .type('form')
      .send({ _csrf: csrf, nome: 'Beltrano', telefone: '62999990000' })
      .expect(302);

    await agent
      .post(`/contato/delete/${contato._id}`)
      .type('form')
      .send({ _csrf: csrf })
      .expect(302);

    const acoes = (await trilhaDe('dono@example.com')).map((r) => r.acao);
    assert.ok(acoes.includes(ACOES.CONTATO_CRIADO));
    assert.ok(acoes.includes(ACOES.CONTATO_EDITADO));
    assert.ok(acoes.includes(ACOES.CONTATO_REMOVIDO));
  });

  test('a edição registra o valor anterior e o novo', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });

    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Antes', telefone: '62999990000' })
      .expect(302);

    const contato = await ctx.models.ContatoModel.findOne({ nome: 'Antes' });
    await agent
      .post(`/contato/edit/${contato._id}`)
      .type('form')
      .send({ _csrf: csrf, nome: 'Depois', telefone: '62999990000' })
      .expect(302);

    const edicao = (await trilhaDe('dono@example.com')).find(
      (r) => r.acao === ACOES.CONTATO_EDITADO
    );
    assert.equal(edicao.detalhes.de, 'Antes');
    assert.equal(edicao.detalhes.para, 'Depois');
  });

  test('a remoção guarda o nome, já que o contato deixa de existir', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });

    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Some Depois', telefone: '62999990000' })
      .expect(302);

    const contato = await ctx.models.ContatoModel.findOne({ nome: 'Some Depois' });
    await agent
      .post(`/contato/delete/${contato._id}`)
      .type('form')
      .send({ _csrf: csrf })
      .expect(302);

    const remocao = (await trilhaDe('dono@example.com')).find(
      (r) => r.acao === ACOES.CONTATO_REMOVIDO
    );
    assert.equal(remocao.detalhes.nome, 'Some Depois');
  });

  test('o contexto da requisição chega ao registro (requestId e IP)', async () => {
    await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });

    const registro = (await trilhaDe('dono@example.com'))[0];
    assert.ok(registro.requestId, 'requestId deveria vir do contexto de execução');
    assert.ok(registro.ip, 'ip deveria vir do contexto de execução');
  });

  test('senha em texto puro nunca chega à trilha', async () => {
    await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });

    const registros = await ctx.models.AuditoriaModel.find({}).lean();
    const serializado = JSON.stringify(registros);

    assert.ok(!serializado.includes(SENHA), 'a senha vazou para a trilha de auditoria');
    assert.ok(!/\$2[aby]\$/.test(serializado), 'o hash da senha vazou para a trilha');
  });

  // Tentativa contra conta existente É registrada: o dono precisa saber.
  test('senha errada em conta existente vira registro de falha', async () => {
    const agente = request.agent(ctx.app);
    const pagina = await agente.get('/login/index').expect(200);
    const csrf = extractCsrf(pagina.text);

    await agente
      .post('/login/register')
      .type('form')
      .send({ _csrf: csrf, email: 'vitima@example.com', password: SENHA })
      .expect(302);

    await agente
      .post('/login/login')
      .type('form')
      .send({ _csrf: csrf, email: 'vitima@example.com', password: 'senha-errada-mas-longa' })
      .expect(302);

    const recusa = (await trilhaDe('vitima@example.com')).find(
      (r) => r.acao === ACOES.AUTENTICACAO_RECUSADA
    );
    assert.ok(recusa, 'tentativa contra conta existente deve ser registrada');
    assert.equal(recusa.resultado, 'falha');
  });

  // E-mail inexistente NÃO é registrado: guardar os endereços tentados
  // construiria um artefato sensível criado pela própria defesa (ADR-0010).
  test('tentativa com e-mail inexistente não cria registro algum', async () => {
    const agente = request.agent(ctx.app);
    const pagina = await agente.get('/login/index').expect(200);
    const csrf = extractCsrf(pagina.text);

    await agente
      .post('/login/login')
      .type('form')
      .send({ _csrf: csrf, email: 'nao-existe@example.com', password: 'qualquer-senha-123' })
      .expect(302);

    assert.equal(await ctx.models.AuditoriaModel.countDocuments({}), 0);
  });

  test('logout é registrado antes de a sessão ser destruída', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });

    await agent.post('/login/logout').type('form').send({ _csrf: csrf }).expect(302);

    const acoes = (await trilhaDe('dono@example.com')).map((r) => r.acao);
    assert.ok(acoes.includes(ACOES.USUARIO_DESCONECTADO));
  });

  // --- Autorização ---
  // Um único `startTestApp` por arquivo: `config` é congelado no primeiro
  // require de env.js, então uma segunda instância tentaria conectar na URI do
  // MongoDB anterior, já encerrado.

  test('a página mostra apenas as atividades do próprio usuário', async () => {
    const dono = await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });
    await dono.agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: dono.csrf, nome: 'Contato do dono', telefone: '62999990000' })
      .expect(302);

    const intruso = await signUpAndLogin(request, ctx.app, { email: 'intruso@example.com' });
    const resposta = await intruso.agent.get('/auditoria').expect(200);

    assert.ok(!resposta.text.includes('Contato do dono'));
    assert.ok(resposta.text.includes('Conta criada'));
  });

  test('a trilha exige autenticação', async () => {
    await request(ctx.app).get('/auditoria').expect(302).expect('location', '/login/index');
  });

  test('o filtro por ação funciona e ignora valor inválido', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, { email: 'dono@example.com' });
    await agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, nome: 'Visível', telefone: '62999990000' })
      .expect(302);

    // A asserção olha só o corpo da tabela: as descrições de todas as ações
    // também aparecem nas opções do <select> de filtro, então verificar a
    // página inteira daria falso positivo.
    const corpoDaTabela = (html) => html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';

    const filtrado = corpoDaTabela(
      (await agent.get(`/auditoria?acao=${ACOES.CONTATO_CRIADO}`).expect(200)).text
    );
    assert.ok(filtrado.includes('Visível'));
    assert.ok(!filtrado.includes('Login efetuado'));

    // Filtro inválido não quebra a página: apenas não filtra.
    const semFiltro = corpoDaTabela(
      (await agent.get('/auditoria?acao=acao--inventada').expect(200)).text
    );
    assert.ok(semFiltro.includes('Login efetuado'));
  });
});
