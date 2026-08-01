'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { Contato } = require('../../../src/domain/entities/Contato');
const { ContatoId, UsuarioId } = require('../../../src/domain/value-objects/Identificador');
const { NomePessoa } = require('../../../src/domain/value-objects/NomePessoa');
const { Email } = require('../../../src/domain/value-objects/Email');
const { Telefone } = require('../../../src/domain/value-objects/Telefone');

const DONO = UsuarioId.deConfianca('507f1f77bcf86cd799439011');
const INTRUSO = UsuarioId.deConfianca('507f1f77bcf86cd799439099');
const ID = ContatoId.deConfianca('507f191e810c19729de860ea');

const nome = (n = 'Fulano') => NomePessoa.criar(n).value;
const telefone = (t = '62999990000') => Telefone.criarOpcional(t).value;
const email = (e = 'fulano@example.com') => Email.criarOpcional(e).value;

const criar = (props = {}) =>
  Contato.criar({
    id: ID,
    proprietarioId: DONO,
    nome: nome(),
    email: null,
    telefone: telefone(),
    ...props,
  });

describe('Contato — invariantes do agregado', () => {
  // Achado ACH-001: a coluna de dono não existia e a agenda era compartilhada.
  test('não é possível construir um contato sem dono', () => {
    assert.throws(
      () => new Contato({ id: ID, proprietarioId: null, nome: nome(), telefone: telefone() }),
      TypeError
    );
  });

  test('exige ao menos e-mail ou telefone', () => {
    const resultado = criar({ email: null, telefone: null });
    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error.code, 'CONTATO_SEM_FORMA_DE_CONTATO');
  });

  test('aceita apenas e-mail', () => {
    assert.equal(criar({ email: email(), telefone: null }).isSuccess, true);
  });

  test('aceita apenas telefone', () => {
    assert.equal(criar({ email: null, telefone: telefone() }).isSuccess, true);
  });
});

describe('Contato — autorização', () => {
  test('pertenceA responde pela identidade do dono', () => {
    const contato = criar().value;
    assert.equal(contato.pertenceA(DONO), true);
    assert.equal(contato.pertenceA(INTRUSO), false);
  });

  // A entidade não confia em quem a carregou: mesmo que a consulta falhasse em
  // filtrar por dono, a alteração é recusada aqui.
  test('recusa alteração feita por quem não é o dono', () => {
    const contato = criar().value;

    const resultado = contato.alterarDados({
      nome: nome('INVADIDO'),
      email: null,
      telefone: telefone('11111111111'),
      editadoPor: INTRUSO,
    });

    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error.code, 'CONTATO_DE_OUTRO_PROPRIETARIO');
    assert.equal(contato.nome.nome, 'Fulano', 'o estado não pode ter sido tocado');
  });

  test('permite alteração feita pelo dono', () => {
    const contato = criar().value;
    const antes = contato.atualizadoEm;

    const resultado = contato.alterarDados({
      nome: nome('Beltrano'),
      email: email('beltrano@example.com'),
      telefone: null,
      editadoPor: DONO,
    });

    assert.equal(resultado.isSuccess, true);
    assert.equal(contato.nome.nome, 'Beltrano');
    assert.equal(contato.email.valor, 'beltrano@example.com');
    assert.equal(contato.telefone, null);
    assert.ok(contato.atualizadoEm >= antes);
  });

  test('a invariante continua valendo na edição', () => {
    const contato = criar().value;

    const resultado = contato.alterarDados({
      nome: nome(),
      email: null,
      telefone: null,
      editadoPor: DONO,
    });

    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error.code, 'CONTATO_SEM_FORMA_DE_CONTATO');
    assert.ok(contato.telefone, 'o contato original precisa continuar íntegro');
  });
});

describe('Contato — favorito', () => {
  test('contato nasce como não favorito, mesmo que a criação tente forçar', () => {
    const contato = criar({ favorito: true }).value;
    assert.equal(contato.favorito, false, 'favorito não entra por mass assignment na criação');
  });

  test('o dono alterna o favorito nos dois sentidos', () => {
    const contato = criar().value;

    assert.equal(contato.alternarFavorito({ alteradoPor: DONO }).isSuccess, true);
    assert.equal(contato.favorito, true);

    assert.equal(contato.alternarFavorito({ alteradoPor: DONO }).isSuccess, true);
    assert.equal(contato.favorito, false);
  });

  test('quem não é dono não alterna favorito', () => {
    const contato = criar().value;

    const resultado = contato.alternarFavorito({ alteradoPor: INTRUSO });

    assert.equal(resultado.isFailure, true);
    assert.equal(resultado.error.code, 'CONTATO_DE_OUTRO_PROPRIETARIO');
    assert.equal(contato.favorito, false, 'o estado não pode ter sido tocado');
  });

  test('editar dados não mexe no favorito', () => {
    const contato = criar().value;
    contato.alternarFavorito({ alteradoPor: DONO });

    contato.alterarDados({
      nome: nome('Beltrano'),
      email: null,
      telefone: telefone(),
      editadoPor: DONO,
    });

    assert.equal(contato.favorito, true, 'favoritar e editar são gestos independentes');
  });
});

describe('Contato — encapsulamento', () => {
  test('o estado não é alcançável de fora da entidade', () => {
    const contato = criar().value;
    // Campos privados (`#`) não aparecem em Object.keys nem podem ser atribuídos.
    assert.deepEqual(Object.keys(contato), []);
    assert.equal(contato.proprietarioId.equals(DONO), true);
  });

  test('a serialização não expõe o proprietário', () => {
    const json = criar().value.toJSON();
    assert.ok(!('proprietarioId' in json));
    assert.ok(!('user' in json));
  });
});
