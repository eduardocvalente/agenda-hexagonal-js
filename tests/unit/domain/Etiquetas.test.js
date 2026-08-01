'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { Etiquetas } = require('../../../src/domain/value-objects/Etiquetas');
const { LIMITES } = require('../../../src/shared/constants');

describe('Etiquetas — normalização', () => {
  test('faz o parse do formato do formulário', () => {
    const resultado = Etiquetas.criarOpcional('trabalho, família');
    assert.equal(resultado.isSuccess, true);
    assert.deepEqual(resultado.value.valores, ['trabalho', 'família']);
  });

  test('normaliza caixa, espaços e duplicatas', () => {
    const resultado = Etiquetas.criarOpcional('Trabalho ,  FAMÍLIA, trabalho,  ');
    assert.deepEqual(resultado.value.valores, ['trabalho', 'família']);
  });

  test('colapsa espaços internos', () => {
    const resultado = Etiquetas.criarOpcional('melhores   amigos');
    assert.deepEqual(resultado.value.valores, ['melhores amigos']);
  });

  test('entrada vazia produz coleção vazia, não erro', () => {
    for (const entrada of ['', '  ', ',,,', undefined, null]) {
      const resultado = Etiquetas.criarOpcional(entrada);
      assert.equal(resultado.isSuccess, true, `entrada: ${JSON.stringify(entrada)}`);
      assert.equal(resultado.value.vazio, true);
    }
  });

  test('aceita array além de string', () => {
    const resultado = Etiquetas.criarOpcional(['Casa', 'casa', 'Escola']);
    assert.deepEqual(resultado.value.valores, ['casa', 'escola']);
  });

  test('o texto é o inverso do parse — o formulário reabre igual', () => {
    const resultado = Etiquetas.criarOpcional('trabalho, família');
    assert.equal(resultado.value.texto, 'trabalho, família');
  });
});

describe('Etiquetas — limites e validação', () => {
  test('recusa mais etiquetas que o limite', () => {
    const entrada = Array.from(
      { length: LIMITES.ETIQUETAS_POR_CONTATO_MAX + 1 },
      (_, i) => `t${i}`
    );
    const resultado = Etiquetas.criarOpcional(entrada);
    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error.code, 'ETIQUETAS_DEMAIS');
  });

  test('recusa etiqueta acima do tamanho máximo', () => {
    const resultado = Etiquetas.criarOpcional('a'.repeat(LIMITES.ETIQUETA_MAX + 1));
    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error.code, 'ETIQUETA_MUITO_LONGA');
  });

  test('recusa caracteres fora do alfabeto permitido', () => {
    for (const hostil of ['<script>', 'a;b', 'x$y', '{$ne: 1}']) {
      const resultado = Etiquetas.criarOpcional(hostil);
      assert.equal(resultado.isFailure, true, `entrada: ${hostil}`);
      assert.equal(resultado.error.code, 'ETIQUETA_INVALIDA');
    }
  });

  test('aceita acentos, números e hífen', () => {
    const resultado = Etiquetas.criarOpcional('médicos, plano-b, turma 2026');
    assert.equal(resultado.isSuccess, true);
    assert.deepEqual(resultado.value.valores, ['médicos', 'plano-b', 'turma 2026']);
  });
});

describe('Etiquetas — consulta', () => {
  test('contem ignora caixa e espaços da pergunta', () => {
    const etiquetas = Etiquetas.criarOpcional('trabalho').value;
    assert.equal(etiquetas.contem(' Trabalho '), true);
    assert.equal(etiquetas.contem('lazer'), false);
  });

  test('a coleção interna é imutável', () => {
    const etiquetas = Etiquetas.criarOpcional('a, b').value;
    assert.throws(() => etiquetas.valores.push('c'), TypeError);
    // toJSON devolve cópia: mutá-la não afeta o VO.
    const copia = etiquetas.toJSON();
    copia.push('c');
    assert.deepEqual(etiquetas.valores, ['a', 'b']);
  });
});
