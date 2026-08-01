'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('node:util');

const { Email } = require('../../../src/domain/value-objects/Email');
const { SenhaEmTexto } = require('../../../src/domain/value-objects/SenhaEmTexto');
const { SenhaComHash } = require('../../../src/domain/value-objects/SenhaComHash');
const { NomePessoa } = require('../../../src/domain/value-objects/NomePessoa');
const { Telefone } = require('../../../src/domain/value-objects/Telefone');
const { ContatoId, UsuarioId } = require('../../../src/domain/value-objects/Identificador');

describe('Email', () => {
  test('normaliza caixa e espaços na construção', () => {
    const resultado = Email.criar('  JOAO@Example.COM  ');
    assert.equal(resultado.isSuccess, true);
    assert.equal(resultado.value.valor, 'joao@example.com');
  });

  // Regressão do achado ACH-011: com a normalização no VO, é impossível criar
  // duas contas para o mesmo endereço variando a caixa.
  test('duas grafias do mesmo endereço produzem VOs iguais', () => {
    const a = Email.criar('Joao@Example.com').value;
    const b = Email.criar('joao@example.com').value;
    assert.equal(a.equals(b), true);
  });

  test('rejeita endereço malformado', () => {
    for (const invalido of ['sem-arroba', '@sem-local', 'a@b', '', null, 42, { $ne: null }]) {
      assert.equal(Email.criar(invalido).isFailure, true, `deveria rejeitar ${inspect(invalido)}`);
    }
  });

  test('rejeita endereço acima do limite da RFC', () => {
    const gigante = `${'a'.repeat(250)}@example.com`;
    assert.equal(Email.criar(gigante).error.code, 'EMAIL_MUITO_LONGO');
  });

  test('variante opcional aceita ausência', () => {
    assert.equal(Email.criarOpcional('').value, null);
    assert.equal(Email.criarOpcional(undefined).value, null);
    assert.equal(Email.criarOpcional('a@b.com').value.valor, 'a@b.com');
  });

  test('é imutável', () => {
    const email = Email.criar('a@b.com').value;
    assert.throws(() => {
      email.props = { valor: 'outro@b.com' };
    }, TypeError);
  });
});

describe('SenhaEmTexto', () => {
  test('aplica a política de comprimento mínimo', () => {
    assert.equal(SenhaEmTexto.criar('curta').error.code, 'SENHA_COMPRIMENTO_INVALIDO');
    assert.equal(SenhaEmTexto.criar('senha-longa-o-suficiente').isSuccess, true);
  });

  test('recusa senha puramente numérica ou repetida', () => {
    assert.equal(SenhaEmTexto.criar('123456789012').error.code, 'SENHA_FRACA');
    assert.equal(SenhaEmTexto.criar('aaaaaaaaaaaa').error.code, 'SENHA_FRACA');
  });

  // A política nova não pode trancar para fora quem cadastrou sob a antiga.
  test('a variante de verificação ignora a política', () => {
    assert.equal(SenhaEmTexto.paraVerificacao('123').isSuccess, true);
    assert.equal(SenhaEmTexto.paraVerificacao('').isFailure, true);
  });

  // Sem isso, um `logger.info({ senha })` grava a senha do usuário em texto puro.
  test('nunca revela o valor em serialização, interpolação ou inspeção', () => {
    const senha = SenhaEmTexto.criar('senha-secreta-real').value;

    assert.equal(JSON.stringify({ senha }), '{"senha":"[REDACTED]"}');
    assert.equal(`${senha}`, '[SenhaEmTexto]');
    assert.ok(!inspect(senha).includes('senha-secreta-real'));
    assert.equal(senha.revelar(), 'senha-secreta-real');
  });
});

describe('SenhaComHash', () => {
  test('também não revela o valor sem pedido explícito', () => {
    const hash = SenhaComHash.deConfianca('$2b$12$abcdefghijklmnopqrstuv');
    assert.equal(JSON.stringify({ hash }), '{"hash":"[REDACTED]"}');
    assert.ok(!inspect(hash).includes('abcdefghij'));
    assert.equal(hash.revelar(), '$2b$12$abcdefghijklmnopqrstuv');
  });

  test('rejeita hash vazio', () => {
    assert.equal(SenhaComHash.criar('').isFailure, true);
    assert.equal(SenhaComHash.criar(null).isFailure, true);
  });
});

describe('NomePessoa', () => {
  test('exige nome e normaliza espaços', () => {
    assert.equal(NomePessoa.criar('   ').error.code, 'NOME_OBRIGATORIO');

    const nome = NomePessoa.criar('  João   Carlos ', ' da  Silva ').value;
    assert.equal(nome.nome, 'João Carlos');
    assert.equal(nome.sobrenome, 'da Silva');
    assert.equal(nome.completo, 'João Carlos da Silva');
  });

  test('aceita acentos, hífens e apóstrofos', () => {
    for (const valido of ['José', "D'Ávila", 'Ana-Maria', '李雷']) {
      assert.equal(NomePessoa.criar(valido).isSuccess, true, `deveria aceitar "${valido}"`);
    }
  });

  test('sobrenome ausente não quebra o nome completo', () => {
    assert.equal(NomePessoa.criar('Madonna').value.completo, 'Madonna');
  });
});

describe('Telefone', () => {
  test('preserva a formatação digitada pelo usuário', () => {
    const telefone = Telefone.criarOpcional('(62) 98195-2093').value;
    assert.equal(telefone.valor, '(62) 98195-2093');
    assert.equal(telefone.somenteDigitos, '62981952093');
  });

  test('ausência é válida', () => {
    assert.equal(Telefone.criarOpcional('').value, null);
  });

  test('rejeita conteúdo que claramente não é telefone', () => {
    assert.equal(Telefone.criarOpcional('não é telefone').isFailure, true);
  });
});

describe('Identificador', () => {
  test('aceita apenas ObjectId em formato hexadecimal de 24 caracteres', () => {
    assert.equal(ContatoId.criar('507f1f77bcf86cd799439011').isSuccess, true);
    assert.equal(ContatoId.criar('nao-e-um-id').isFailure, true);
    assert.equal(ContatoId.criar(undefined).isFailure, true);
    assert.equal(ContatoId.criar({ $ne: null }).isFailure, true);
  });

  // A tipagem é o ponto: com dois `string`, trocar os argumentos de
  // `buscarPorId(id, usuarioId)` passa despercebido.
  test('tipos distintos não são iguais mesmo com o mesmo valor', () => {
    const valor = '507f1f77bcf86cd799439011';
    assert.equal(ContatoId.criar(valor).value.equals(UsuarioId.criar(valor).value), false);
    assert.equal(ContatoId.criar(valor).value.equals(ContatoId.criar(valor).value), true);
  });
});
