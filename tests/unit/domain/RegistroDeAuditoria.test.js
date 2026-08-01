'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { RegistroDeAuditoria } = require('../../../src/domain/entities/RegistroDeAuditoria');
const {
  AcaoAuditada,
  ACOES,
  RESULTADOS,
} = require('../../../src/domain/value-objects/AcaoAuditada');
const { UsuarioId, Identificador } = require('../../../src/domain/value-objects/Identificador');

const DONO = UsuarioId.deConfianca('507f1f77bcf86cd799439011');
const OUTRO = UsuarioId.deConfianca('507f1f77bcf86cd799439099');
const ID = Identificador.deConfianca('507f191e810c19729de860ea');

const criar = (props = {}) =>
  RegistroDeAuditoria.criar({
    id: ID,
    usuarioId: DONO,
    acao: AcaoAuditada.deConfianca(ACOES.CONTATO_CRIADO),
    ...props,
  });

describe('AcaoAuditada', () => {
  test('aceita apenas ações do conjunto fechado', () => {
    assert.equal(AcaoAuditada.criar(ACOES.CONTATO_CRIADO).isSuccess, true);
    assert.equal(AcaoAuditada.criar('acao.inventada').isFailure, true);
    assert.equal(AcaoAuditada.criar(undefined).isFailure, true);
  });

  test('deriva categoria e descrição legível', () => {
    const acao = AcaoAuditada.deConfianca(ACOES.CONTATO_REMOVIDO);
    assert.equal(acao.categoria, 'contato');
    assert.equal(acao.descricao, 'Contato removido');
  });
});

describe('RegistroDeAuditoria — invariantes', () => {
  test('não é possível construir sem usuário', () => {
    assert.throws(
      () =>
        new RegistroDeAuditoria({
          id: ID,
          usuarioId: null,
          acao: AcaoAuditada.deConfianca(ACOES.CONTATO_CRIADO),
        }),
      TypeError
    );
  });

  test('recusa resultado fora do domínio', () => {
    assert.equal(criar({ resultado: 'talvez' }).isFailure, true);
  });

  test('pertenceA responde pela identidade do dono', () => {
    const registro = criar().value;
    assert.equal(registro.pertenceA(DONO), true);
    assert.equal(registro.pertenceA(OUTRO), false);
  });

  // Append-only: a entidade não expõe nenhum caminho de alteração.
  test('não há método que altere o registro depois de criado', () => {
    const registro = criar().value;
    const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(registro));
    const mutadores = metodos.filter((m) => /^(alterar|atualizar|editar|remover|definir)/.test(m));
    assert.deepEqual(mutadores, [], `entidade de auditoria não pode ter mutadores: ${mutadores}`);
  });

  test('detalhes são congelados', () => {
    const registro = criar({ detalhes: { nome: 'Fulano' } }).value;
    assert.throws(() => {
      registro.detalhes.nome = 'outro';
    }, TypeError);
  });
});

describe('RegistroDeAuditoria — sanitização de detalhes', () => {
  test('redige chaves sensíveis no primeiro nível', () => {
    const registro = criar({
      detalhes: { nome: 'Fulano', password: 'senha-real', token: 'abc123' },
    }).value;

    assert.equal(registro.detalhes.nome, 'Fulano');
    assert.equal(registro.detalhes.password, '[REDACTED]');
    assert.equal(registro.detalhes.token, '[REDACTED]');
  });

  // Uma verificação só no primeiro nível deixaria passar o caso mais provável:
  // alguém despejar o body inteiro dentro de um objeto `dados`.
  test('redige chaves sensíveis em objetos aninhados', () => {
    const registro = criar({
      detalhes: { dados: { interno: { senha: 'x', _csrf: 'y', ok: 'visível' } } },
    }).value;

    assert.equal(registro.detalhes.dados.interno.senha, '[REDACTED]');
    assert.equal(registro.detalhes.dados.interno._csrf, '[REDACTED]');
    assert.equal(registro.detalhes.dados.interno.ok, 'visível');
  });

  test('a redação ignora a caixa da chave', () => {
    const registro = criar({ detalhes: { PASSWORD: 'x', Token: 'y' } }).value;
    assert.equal(registro.detalhes.PASSWORD, '[REDACTED]');
    assert.equal(registro.detalhes.Token, '[REDACTED]');
  });

  test('trunca valores longos em vez de recusar o registro', () => {
    const registro = criar({ detalhes: { nota: 'a'.repeat(5_000) } }).value;
    assert.ok(registro.detalhes.nota.length < 5_000);
    assert.ok(registro.detalhes.nota.endsWith('[truncado]'));
  });

  test('limita arrays e profundidade sem quebrar', () => {
    const profundo = { a: { b: { c: { d: { e: 'muito fundo' } } } } };
    assert.doesNotThrow(() => criar({ detalhes: profundo }));
    assert.doesNotThrow(() => criar({ detalhes: { lista: new Array(100).fill('x') } }));
  });
});

describe('RegistroDeAuditoria — serialização', () => {
  test('não expõe o id do usuário nem o user agent', () => {
    const json = criar({ userAgent: 'Mozilla/5.0' }).value.toJSON();
    assert.ok(!('usuarioId' in json));
    assert.ok(!('userAgent' in json));
    assert.equal(json.descricao, 'Contato criado');
  });

  test('houveFalha reflete o resultado', () => {
    assert.equal(criar({ resultado: RESULTADOS.FALHA }).value.houveFalha, true);
    assert.equal(criar().value.houveFalha, false);
  });
});
