'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { startTestApp, signUpAndLogin } = require('../helpers/test-app');

describe('Compromissos e calendário', () => {
  let ctx;

  before(async () => {
    ctx = await startTestApp();
  });
  after(async () => ctx.stop());
  beforeEach(async () => ctx.reset());

  async function criarCompromisso(agent, csrf, dados) {
    return agent
      .post('/compromisso/register')
      .type('form')
      .send({ _csrf: csrf, ...dados })
      .expect(302);
  }

  test('rotas exigem autenticação', async () => {
    await request(ctx.app).get('/calendario').expect(302).expect('location', '/login/index');
    await request(ctx.app).get('/compromisso/index').expect(302).expect('location', '/login/index');
  });

  test('cria compromisso e exibe no calendário do mês e nos próximos', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'calendario@example.com',
    });

    // Um compromisso no futuro distante garante presença em "próximos".
    await criarCompromisso(agent, csrf, {
      titulo: 'Dentista',
      inicioEm: '2030-08-15T14:30',
      notas: 'Levar exames',
    });

    const doc = await ctx.models.CompromissoModel.findOne({ titulo: 'Dentista' }).lean();
    assert.ok(doc, 'compromisso persistido');
    // 14:30 SP = 17:30 UTC.
    assert.equal(new Date(doc.inicioEm).toISOString(), '2030-08-15T17:30:00.000Z');

    const calendario = await agent.get('/calendario?mes=2030-08').expect(200);
    assert.ok(calendario.text.includes('Dentista'));
    assert.ok(calendario.text.includes('14:30'), 'hora exibida no fuso de SP');
    assert.ok(calendario.text.includes('Agosto de 2030'));

    // Fora do mês, não aparece na grade — mas segue nos próximos.
    const outroMes = await agent.get('/calendario?mes=2030-09').expect(200);
    assert.ok(outroMes.text.includes('Próximos compromissos'));
  });

  test('valida título e data, sem persistir nada', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'valida-compromisso@example.com',
    });

    await criarCompromisso(agent, csrf, { titulo: '', inicioEm: '2026-02-31T10:00' });

    const total = await ctx.models.CompromissoModel.countDocuments({});
    assert.equal(total, 0, 'data deslizante (31/02) e título vazio não podem passar');
  });

  test('vincula contato próprio e recusa contato de outro dono', async () => {
    const dona = await signUpAndLogin(request, ctx.app, { email: 'dona-comp@example.com' });
    await dona.agent
      .post('/contato/register')
      .type('form')
      .send({ _csrf: dona.csrf, nome: 'Cliente', telefone: '62999990000' })
      .expect(302);
    const contatoDaDona = await ctx.models.ContatoModel.findOne({ nome: 'Cliente' }).lean();

    // Vínculo legítimo funciona.
    await criarCompromisso(dona.agent, dona.csrf, {
      titulo: 'Reunião',
      inicioEm: '2030-05-10T09:00',
      contatoId: String(contatoDaDona._id),
    });
    const legitimo = await ctx.models.CompromissoModel.findOne({ titulo: 'Reunião' }).lean();
    assert.equal(String(legitimo.contato), String(contatoDaDona._id));

    // Outro usuário tentando vincular o contato da dona: recusado.
    const intruso = await signUpAndLogin(request, ctx.app, { email: 'intruso-comp@example.com' });
    await criarCompromisso(intruso.agent, intruso.csrf, {
      titulo: 'Golpe',
      inicioEm: '2030-05-10T09:00',
      contatoId: String(contatoDaDona._id),
    });
    const golpe = await ctx.models.CompromissoModel.findOne({ titulo: 'Golpe' }).lean();
    assert.equal(golpe, null, 'compromisso com contato alheio não pode ser criado');
  });

  test('edição e remoção respeitam o dono', async () => {
    const alice = await signUpAndLogin(request, ctx.app, { email: 'alice-comp@example.com' });
    await criarCompromisso(alice.agent, alice.csrf, {
      titulo: 'Original',
      inicioEm: '2030-03-01T10:00',
    });
    const doc = await ctx.models.CompromissoModel.findOne({ titulo: 'Original' }).lean();

    // Dono edita.
    await alice.agent
      .post(`/compromisso/edit/${doc._id}`)
      .type('form')
      .send({ _csrf: alice.csrf, titulo: 'Alterado', inicioEm: '2030-03-02T11:00' })
      .expect(302);
    const editado = await ctx.models.CompromissoModel.findById(doc._id).lean();
    assert.equal(editado.titulo, 'Alterado');

    // Intruso não remove.
    const bruno = await signUpAndLogin(request, ctx.app, { email: 'bruno-comp@example.com' });
    await bruno.agent
      .post(`/compromisso/delete/${doc._id}`)
      .type('form')
      .send({ _csrf: bruno.csrf })
      .expect(404);
    assert.ok(await ctx.models.CompromissoModel.findById(doc._id).lean());

    // Dono remove, e a remoção vai para a trilha.
    await alice.agent
      .post(`/compromisso/delete/${doc._id}`)
      .type('form')
      .send({ _csrf: alice.csrf })
      .expect(302);
    assert.equal(await ctx.models.CompromissoModel.findById(doc._id).lean(), null);

    const trilha = await ctx.models.AuditoriaModel.findOne({
      acao: 'compromisso.removido',
    }).lean();
    assert.ok(trilha);
    assert.equal(trilha.detalhes.nome, 'Alterado');
  });

  test('o calendário de um usuário não exibe compromissos de outro', async () => {
    const alice = await signUpAndLogin(request, ctx.app, { email: 'alice-cal@example.com' });
    await criarCompromisso(alice.agent, alice.csrf, {
      titulo: 'Sigiloso',
      inicioEm: '2030-06-10T15:00',
    });

    const bruno = await signUpAndLogin(request, ctx.app, { email: 'bruno-cal@example.com' });
    const res = await bruno.agent.get('/calendario?mes=2030-06').expect(200);
    assert.ok(!res.text.includes('Sigiloso'));
  });

  test('compromisso à meia-noite pertence ao mês em que o usuário o vê', async () => {
    const { agent, csrf } = await signUpAndLogin(request, ctx.app, {
      email: 'fuso@example.com',
    });

    // 31/07 às 23:30 em SP é 01/08 02:30 em UTC — a grade de julho precisa
    // exibi-lo; a de agosto, não. Data no PASSADO de propósito: um evento
    // futuro apareceria também na seção "Próximos" de qualquer mês e o
    // teste deixaria de isolar a grade.
    await criarCompromisso(agent, csrf, { titulo: 'Virada', inicioEm: '2025-07-31T23:30' });

    const julho = await agent.get('/calendario?mes=2025-07').expect(200);
    assert.ok(julho.text.includes('Virada'), 'pertence a julho no fuso do produto');

    const agosto = await agent.get('/calendario?mes=2025-08').expect(200);
    assert.ok(!agosto.text.includes('Virada'));
  });
});
