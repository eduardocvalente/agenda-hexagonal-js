'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, signUpAndLogin } = require('../helpers/test-app');

/**
 * Etiquetas, favoritos, busca e filtros — o fluxo completo pela borda HTTP.
 *
 * Usa os adaptadores reais (Mongo em memória): o objetivo é provar que a
 * normalização do domínio, o schema e a consulta filtrada concordam entre si.
 */
describe('Contatos — etiquetas, favoritos e busca', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  async function criarContato(agent, csrf, dados) {
    return agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: csrf, ...dados })
      .expect(302);
  }

  test('cria contato com etiquetas normalizadas e exibe as badges na agenda', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'etiquetas@example.com',
    });

    await criarContato(agent, csrf, {
      nome: 'Ana',
      telefone: '62999990000',
      etiquetas: 'Trabalho ,  família, trabalho',
    });

    const doc = await ctx.models.ContatoModel.findOne({ nome: 'Ana' }).lean();
    assert.deepEqual(doc.etiquetas, ['trabalho', 'família'], 'duplicata e caixa normalizadas');
    assert.equal(doc.favorito, false, 'contato nasce sem favorito');

    const home = await agent.get('/').expect(200);
    assert.ok(home.text.includes('badge-etiqueta'));
    assert.ok(home.text.includes('trabalho'));
  });

  test('recusa etiquetas inválidas sem perder o restante do formulário', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'etiquetas-invalidas@example.com',
    });

    await criarContato(agent, csrf, {
      nome: 'Bia',
      telefone: '62999990000',
      etiquetas: '<script>alert(1)</script>',
    });

    const total = await ctx.models.ContatoModel.countDocuments({});
    assert.equal(total, 0, 'nada pode ter sido salvo com etiqueta inválida');
  });

  test('alterna favorito via POST e registra na auditoria', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'favorito@example.com',
    });

    await criarContato(agent, csrf, { nome: 'Carlos', telefone: '62999990000' });
    const doc = await ctx.models.ContatoModel.findOne({ nome: 'Carlos' }).lean();

    await agent.post(`/contato/favorito/${doc._id}`).type('form').send({ _csrf: csrf }).expect(302);

    const depois = await ctx.models.ContatoModel.findById(doc._id).lean();
    assert.equal(depois.favorito, true);

    const trilha = await ctx.models.AuditoriaModel.findOne({ acao: 'contato.favoritado' }).lean();
    assert.ok(trilha, 'a promoção a favorito precisa estar na trilha');

    // Alterna de volta.
    await agent.post(`/contato/favorito/${doc._id}`).type('form').send({ _csrf: csrf }).expect(302);
    const final = await ctx.models.ContatoModel.findById(doc._id).lean();
    assert.equal(final.favorito, false);
  });

  test('favoritar contato de outro usuário responde 404, sem revelar existência', async () => {
    const dona = await signUpAndLogin(request, ctx.app, { email: 'dona@example.com' });
    await criarContato(dona.agent, dona.csrf, { nome: 'Privado', telefone: '62999990000' });
    const doc = await ctx.models.ContatoModel.findOne({ nome: 'Privado' }).lean();

    const intruso = await signUpAndLogin(request, ctx.app, { email: 'intruso@example.com' });
    await intruso.agent
      .post(`/contato/favorito/${doc._id}`)
      .type('form')
      .send({ _csrf: intruso.csrf })
      .expect(404);

    const depois = await ctx.models.ContatoModel.findById(doc._id).lean();
    assert.equal(depois.favorito, false, 'o estado do contato alheio não pode mudar');
  });

  test('busca por texto encontra por nome e por e-mail, sem vazar entre donos', async () => {
    const alice = await signUpAndLogin(request, ctx.app, { email: 'alice@example.com' });
    await criarContato(alice.agent, alice.csrf, {
      nome: 'Ricardo',
      email: 'ricardo@empresa.com',
    });
    await criarContato(alice.agent, alice.csrf, { nome: 'Paula', telefone: '62988880000' });

    const bruno = await signUpAndLogin(request, ctx.app, { email: 'bruno@example.com' });
    await criarContato(bruno.agent, bruno.csrf, { nome: 'Ricardo', telefone: '62977770000' });

    // Por nome, caixa-insensível.
    const porNome = await alice.agent.get('/?q=ricar').expect(200);
    assert.ok(porNome.text.includes('Ricardo'));
    assert.ok(!porNome.text.includes('Paula'));

    // Por e-mail.
    const porEmail = await alice.agent.get('/?q=empresa.com').expect(200);
    assert.ok(porEmail.text.includes('Ricardo'));

    // Sem resultado: estado dedicado, não a agenda vazia genérica.
    const semResultado = await alice.agent.get('/?q=inexistente').expect(200);
    assert.ok(semResultado.text.includes('Nenhum contato encontrado'));

    // A contagem é do dono da sessão: o Ricardo do Bruno não entra na busca da Alice.
    const doAlice = await alice.agent.get('/?q=Ricardo').expect(200);
    const ocorrencias = doAlice.text.match(/<td>\s*Ricardo/g) ?? [];
    assert.equal(ocorrencias.length, 1);
  });

  test('metacaracteres de regex na busca são tratados como texto', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'regex@example.com',
    });
    await criarContato(agent, csrf, { nome: 'Davi', telefone: '62999990000' });

    // `.*` casaria com tudo se não houvesse escape; escapado, não casa com nada.
    const res = await agent.get('/?q=.*').expect(200);
    assert.ok(res.text.includes('Nenhum contato encontrado'));
  });

  test('filtro por etiqueta e por favoritos restringe a listagem', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'filtros@example.com',
    });

    await criarContato(agent, csrf, {
      nome: 'Elisa',
      telefone: '62999990000',
      etiquetas: 'trabalho',
    });
    await criarContato(agent, csrf, {
      nome: 'Fernando',
      telefone: '62988880000',
      etiquetas: 'casa',
    });

    const porEtiqueta = await agent.get('/?etiqueta=trabalho').expect(200);
    assert.ok(porEtiqueta.text.includes('Elisa'));
    assert.ok(!porEtiqueta.text.includes('Fernando'));

    // Favorita a Elisa e filtra por favoritos.
    const docElisa = await ctx.models.ContatoModel.findOne({ nome: 'Elisa' }).lean();
    await agent
      .post(`/contato/favorito/${docElisa._id}`)
      .type('form')
      .send({ _csrf: csrf })
      .expect(302);

    const favoritos = await agent.get('/?favoritos=1').expect(200);
    assert.ok(favoritos.text.includes('Elisa'));
    assert.ok(!favoritos.text.includes('Fernando'));
  });

  test('editar contato preserva etiquetas enviadas e o favorito', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'editar-etiquetas@example.com',
    });

    await criarContato(agent, csrf, {
      nome: 'Gabriela',
      telefone: '62999990000',
      etiquetas: 'antiga',
    });
    const doc = await ctx.models.ContatoModel.findOne({ nome: 'Gabriela' }).lean();

    await agent.post(`/contato/favorito/${doc._id}`).type('form').send({ _csrf: csrf }).expect(302);

    await agent
      .post(`/contato/edit/${doc._id}`)
      .type('form')
      .send({ _csrf: csrf, nome: 'Gabriela', telefone: '62999990000', etiquetas: 'nova' })
      .expect(302);

    const depois = await ctx.models.ContatoModel.findById(doc._id).lean();
    assert.deepEqual(depois.etiquetas, ['nova']);
    assert.equal(depois.favorito, true, 'a edição de dados não pode desfavoritar');
  });
});
