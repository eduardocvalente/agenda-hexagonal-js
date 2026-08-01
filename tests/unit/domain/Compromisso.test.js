'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { Compromisso } = require('../../../src/domain/entities/Compromisso');
const {
  CompromissoId,
  UsuarioId,
  ContatoId,
} = require('../../../src/domain/value-objects/Identificador');
const { TituloDeCompromisso } = require('../../../src/domain/value-objects/TituloDeCompromisso');
const {
  DataHoraDeCompromisso,
} = require('../../../src/domain/value-objects/DataHoraDeCompromisso');

const DONO = UsuarioId.deConfianca('507f1f77bcf86cd799439011');
const INTRUSO = UsuarioId.deConfianca('507f1f77bcf86cd799439099');
const ID = CompromissoId.deConfianca('507f191e810c19729de860ea');

const titulo = (t = 'Dentista') => TituloDeCompromisso.criar(t).value;
const inicio = (v = '2026-08-15T14:30') => DataHoraDeCompromisso.criar(v).value;

const criar = (props = {}) =>
  Compromisso.criar({
    id: ID,
    proprietarioId: DONO,
    titulo: titulo(),
    inicioEm: inicio(),
    ...props,
  });

describe('Compromisso — invariantes', () => {
  test('não é possível construir um compromisso sem dono', () => {
    assert.throws(
      () => new Compromisso({ id: ID, proprietarioId: null, titulo: titulo(), inicioEm: inicio() }),
      TypeError
    );
  });

  test('nasce sem notas e sem contato quando não informados', () => {
    const compromisso = criar().value;
    assert.equal(compromisso.notas, null);
    assert.equal(compromisso.contatoId, null);
  });
});

describe('Compromisso — autorização', () => {
  test('recusa alteração feita por quem não é o dono', () => {
    const compromisso = criar().value;

    const resultado = compromisso.alterarDados({
      titulo: titulo('INVADIDO'),
      inicioEm: inicio('2026-09-01T08:00'),
      editadoPor: INTRUSO,
    });

    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error.code, 'COMPROMISSO_DE_OUTRO_PROPRIETARIO');
    assert.equal(compromisso.titulo.valor, 'Dentista', 'o estado não pode ter sido tocado');
  });

  test('o dono altera título, data, notas e vínculo', () => {
    const compromisso = criar().value;
    const contatoId = ContatoId.deConfianca('507f191e810c19729de860eb');

    const resultado = compromisso.alterarDados({
      titulo: titulo('Reunião'),
      inicioEm: inicio('2026-09-01T08:00'),
      notas: 'Levar documentos',
      contatoId,
      editadoPor: DONO,
    });

    assert.equal(resultado.isSuccess, true);
    assert.equal(compromisso.titulo.valor, 'Reunião');
    assert.equal(compromisso.notas, 'Levar documentos');
    assert.equal(compromisso.contatoId.valor, contatoId.valor);
  });
});

describe('TituloDeCompromisso', () => {
  test('normaliza espaços', () => {
    assert.equal(TituloDeCompromisso.criar('  Reunião   mensal ').value.valor, 'Reunião mensal');
  });

  test('recusa vazio e comprimento excessivo', () => {
    assert.equal(TituloDeCompromisso.criar('   ').error.code, 'COMPROMISSO_SEM_TITULO');
    assert.equal(
      TituloDeCompromisso.criar('a'.repeat(121)).error.code,
      'COMPROMISSO_TITULO_MUITO_LONGO'
    );
  });
});

describe('DataHoraDeCompromisso', () => {
  test('interpreta o datetime-local no fuso de São Paulo', () => {
    const resultado = DataHoraDeCompromisso.criar('2026-08-15T14:30');
    assert.equal(resultado.isSuccess, true);
    // 14:30 em SP (UTC-3) = 17:30 UTC.
    assert.equal(resultado.value.valor.toISOString(), '2026-08-15T17:30:00.000Z');
  });

  test('o formato de formulário é o inverso exato do parse', () => {
    const data = DataHoraDeCompromisso.criar('2026-12-31T23:45').value.valor;
    assert.equal(DataHoraDeCompromisso.paraCampoDeFormulario(data), '2026-12-31T23:45');
  });

  test('recusa formatos inválidos e datas que deslizam', () => {
    for (const invalida of ['', 'amanhã', '2026-08-15', '2026-02-31T10:00', '15/08/2026 14:30']) {
      const resultado = DataHoraDeCompromisso.criar(invalida);
      assert.equal(resultado.isFailure, true, `entrada: ${invalida}`);
    }
  });

  test('recusa anos fora do intervalo suportado', () => {
    assert.equal(
      DataHoraDeCompromisso.criar('1999-12-31T23:59').error.code,
      'COMPROMISSO_DATA_FORA_DO_INTERVALO'
    );
  });
});
