'use strict';

const { Result } = require('../../../shared/result/Result');
const { ValidationError } = require('../../../shared/errors');
const { NomePessoa } = require('../../../domain/value-objects/NomePessoa');
const { Email } = require('../../../domain/value-objects/Email');
const { Telefone } = require('../../../domain/value-objects/Telefone');
const { Etiquetas } = require('../../../domain/value-objects/Etiquetas');

/**
 * Constrói os Value Objects de um contato a partir de entrada crua.
 *
 * Extraído porque criar e editar precisam exatamente da mesma conversão (DRY),
 * e duplicá-la significaria que uma validação nova entra em um caminho e não no
 * outro — a origem clássica de inconsistência entre criar e editar.
 *
 * Acumula TODOS os erros em vez de parar no primeiro: o usuário corrige o
 * formulário de uma vez, em vez de descobrir um problema por submissão.
 */
function montarDadosDeContato(dados = {}) {
  const nomeResult = NomePessoa.criar(dados.nome, dados.sobrenome);
  const emailResult = Email.criarOpcional(dados.email);
  const telefoneResult = Telefone.criarOpcional(dados.telefone);
  const etiquetasResult = Etiquetas.criarOpcional(dados.etiquetas);

  const { erros } = Result.collectAll([nomeResult, emailResult, telefoneResult, etiquetasResult]);
  if (erros.length > 0) {
    return Result.fail(
      new ValidationError(erros.map((e) => e.message).join(' '), {
        code: 'CONTATO_DADOS_INVALIDOS',
        context: { violacoes: erros.map((e) => e.code) },
      })
    );
  }

  return Result.ok({
    nome: nomeResult.value,
    email: emailResult.value,
    telefone: telefoneResult.value,
    etiquetas: etiquetasResult.value,
  });
}

module.exports = { montarDadosDeContato };
