'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { NotFoundError, ValidationError } = require('../../../shared/errors');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { CompromissoId } = require('../../../domain/value-objects/Identificador');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');
const { montarDadosDeCompromisso } = require('./montarDadosDeCompromisso');

/**
 * Edição de compromisso — mesma dupla verificação de dono da edição de
 * contato, e a mesma resposta uniforme: id alheio ou inexistente é 404.
 */
class EditarCompromisso extends UseCase {
  constructor({ compromissoRepository, contatoRepository, auditor, logger }) {
    super({ logger });
    this.compromissoRepository = compromissoRepository;
    this.contatoRepository = contatoRepository;
    this.auditor = auditor;
  }

  async executar({ compromissoId, proprietarioId, dados }, { signal } = {}) {
    const idResult = CompromissoId.criar(compromissoId);
    if (idResult.isFailure) {
      return Result.fail(new NotFoundError('Compromisso não encontrado.'));
    }

    const camposResult = montarDadosDeCompromisso(dados);
    if (camposResult.isFailure) return camposResult;

    throwIfAborted(signal, { casoDeUso: 'EditarCompromisso', etapa: 'antes-da-busca' });

    const compromisso = await this.compromissoRepository.buscarPorIdDoProprietario(
      idResult.value,
      proprietarioId,
      signal
    );
    if (!compromisso) {
      return Result.fail(new NotFoundError('Compromisso não encontrado.'));
    }

    const { titulo, inicioEm, notas, contatoId, etiquetas } = camposResult.value;

    if (contatoId) {
      const contato = await this.contatoRepository.buscarPorIdDoProprietario(
        contatoId,
        proprietarioId,
        signal
      );
      if (!contato) {
        return Result.fail(
          new ValidationError('Contato vinculado inválido.', {
            code: 'COMPROMISSO_CONTATO_INVALIDO',
          })
        );
      }
    }

    const tituloAnterior = compromisso.titulo.valor;

    const alteracao = compromisso.alterarDados({
      titulo,
      inicioEm,
      notas,
      contatoId,
      etiquetas,
      editadoPor: proprietarioId,
    });
    if (alteracao.isFailure) {
      return Result.fail(
        new NotFoundError('Compromisso não encontrado.', { cause: alteracao.error })
      );
    }

    throwIfAborted(signal, { casoDeUso: 'EditarCompromisso', etapa: 'antes-de-gravar' });

    const persistencia = await this.compromissoRepository.atualizar(compromisso, signal);
    if (persistencia.isFailure) return persistencia;

    this.logger.info(
      {
        evento: EVENTOS_LOG.COMPROMISSO_EDITADO,
        compromissoId: compromisso.id.valor,
        usuarioId: proprietarioId.valor,
      },
      'Compromisso editado'
    );

    await this.auditor.registrar({
      acao: ACOES.COMPROMISSO_EDITADO,
      usuarioId: proprietarioId.valor,
      recurso: 'compromisso',
      recursoId: compromisso.id.valor,
      detalhes: { de: tituloAnterior, para: compromisso.titulo.valor },
    });

    return Result.ok(compromisso);
  }
}

module.exports = { EditarCompromisso };
