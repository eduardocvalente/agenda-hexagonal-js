'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { Result } = require('../../../src/shared/result/Result');
const { ValidationError, NotFoundError } = require('../../../src/shared/errors');

describe('Result', () => {
  test('distingue sucesso de falha', () => {
    assert.equal(Result.ok(1).isSuccess, true);
    assert.equal(Result.ok(1).isFailure, false);
    assert.equal(Result.fail(new ValidationError('x')).isFailure, true);
  });

  test('acessar o valor de uma falha é erro de programação, não silêncio', () => {
    assert.throws(() => Result.fail(new ValidationError('x')).value, TypeError);
    assert.throws(() => Result.ok(1).error, TypeError);
  });

  test('map transforma o sucesso e preserva a falha', () => {
    assert.equal(Result.ok(2).map((n) => n * 3).value, 6);

    const erro = new ValidationError('x');
    assert.equal(Result.fail(erro).map(() => 'nunca').error, erro);
  });

  test('flatMap encadeia sem aninhar Results', () => {
    const dobrar = (n) => Result.ok(n * 2);
    assert.equal(Result.ok(2).flatMap(dobrar).flatMap(dobrar).value, 8);
  });

  test('flatMap curto-circuita na primeira falha', () => {
    let chamou = false;
    const resultado = Result.fail(new NotFoundError()).flatMap(() => {
      chamou = true;
      return Result.ok(1);
    });
    assert.equal(chamou, false);
    assert.equal(resultado.isFailure, true);
  });

  test('match desestrutura os dois caminhos', () => {
    assert.equal(
      Result.ok('ok').match({ onSuccess: (v) => `S:${v}`, onFailure: () => 'F' }),
      'S:ok'
    );
    assert.equal(
      Result.fail(new ValidationError('e')).match({
        onSuccess: () => 'S',
        onFailure: (e) => `F:${e.message}`,
      }),
      'F:e'
    );
  });

  // O comportamento que permite mostrar a lista completa de problemas do
  // formulário de uma vez, em vez de um erro por submissão.
  test('collectAll acumula todos os erros', () => {
    const { erros, valores } = Result.collectAll([
      Result.ok('a'),
      Result.fail(new ValidationError('erro 1')),
      Result.fail(new ValidationError('erro 2')),
    ]);
    assert.equal(erros.length, 2);
    assert.deepEqual(valores, []);
  });

  test('collectAll devolve todos os valores quando nada falha', () => {
    const { erros, valores } = Result.collectAll([Result.ok('a'), Result.ok('b')]);
    assert.equal(erros.length, 0);
    assert.deepEqual(valores, ['a', 'b']);
  });

  test('é imutável', () => {
    const resultado = Result.ok(1);
    assert.throws(() => {
      resultado.qualquerCoisa = true;
    }, TypeError);
  });
});
