'use strict';

const { Result } = require('../../../shared/result/Result');
const { ValidationError } = require('../../../shared/errors');
const { LIMITES } = require('../../../shared/constants');
const { TituloDeCompromisso } = require('../../../domain/value-objects/TituloDeCompromisso');
const { Etiquetas } = require('../../../domain/value-objects/Etiquetas');
const { DataHoraDeCompromisso } = require('../../../domain/value-objects/DataHoraDeCompromisso');
const { ContatoId } = require('../../../domain/value-objects/Identificador');

/**
 * Constrói os Value Objects de um compromisso a partir de entrada crua.
 *
 * Mesmo papel do `montarDadosDeContato`: criar e editar compartilham a
 * conversão, e os erros são ACUMULADOS para o usuário corrigir o formulário
 * de uma vez.
 */
function montarDadosDeCompromisso(dados = {}) {
  const tituloResult = TituloDeCompromisso.criar(dados.titulo);
  const inicioResult = DataHoraDeCompromisso.criar(dados.inicioEm);
  const notasResult = montarNotas(dados.notas);
  const contatoIdResult = montarContatoId(dados.contatoId);
  const etiquetasResult = Etiquetas.criarOpcional(dados.etiquetas);

  const { erros } = Result.collectAll([
    tituloResult,
    inicioResult,
    notasResult,
    contatoIdResult,
    etiquetasResult,
  ]);
  if (erros.length > 0) {
    return Result.fail(
      new ValidationError(erros.map((e) => e.message).join(' '), {
        code: 'COMPROMISSO_DADOS_INVALIDOS',
        context: { violacoes: erros.map((e) => e.code) },
      })
    );
  }

  return Result.ok({
    titulo: tituloResult.value,
    inicioEm: inicioResult.value,
    notas: notasResult.value,
    contatoId: contatoIdResult.value,
    etiquetas: etiquetasResult.value,
  });
}

function montarNotas(entrada) {
  const valor = typeof entrada === 'string' ? entrada.trim() : '';
  if (valor.length === 0) return Result.ok(null);
  if (valor.length > LIMITES.NOTAS_COMPROMISSO_MAX) {
    return Result.fail(
      new ValidationError(
        `As notas devem ter no máximo ${LIMITES.NOTAS_COMPROMISSO_MAX} caracteres.`,
        { code: 'COMPROMISSO_NOTAS_MUITO_LONGAS' }
      )
    );
  }
  return Result.ok(valor);
}

function montarContatoId(entrada) {
  const valor = typeof entrada === 'string' ? entrada.trim() : '';
  if (valor.length === 0) return Result.ok(null);
  const resultado = ContatoId.criar(valor);
  if (resultado.isFailure) {
    return Result.fail(
      new ValidationError('Contato vinculado inválido.', { code: 'COMPROMISSO_CONTATO_INVALIDO' })
    );
  }
  return resultado;
}

module.exports = { montarDadosDeCompromisso };
