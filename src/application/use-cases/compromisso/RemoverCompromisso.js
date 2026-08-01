'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { NotFoundError } = require('../../../shared/errors');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { CompromissoId } = require('../../../domain/value-objects/Identificador');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');

/**
 * Remoção de compromisso — filtro e remoção em uma operação atômica, como na
 * remoção de contato.
 */
class RemoverCompromisso extends UseCase {
  constructor({ compromissoRepository, auditor, logger }) {
    super({ logger });
    this.compromissoRepository = compromissoRepository;
    this.auditor = auditor;
  }

  async executar({ compromissoId, proprietarioId }, { signal } = {}) {
    const idResult = CompromissoId.criar(compromissoId);
    if (idResult.isFailure) {
      return Result.fail(new NotFoundError('Compromisso não encontrado.'));
    }

    throwIfAborted(signal, { casoDeUso: 'RemoverCompromisso', etapa: 'antes-de-remover' });

    const removido = await this.compromissoRepository.removerDoProprietario(
      idResult.value,
      proprietarioId,
      signal
    );

    if (!removido) {
      return Result.fail(new NotFoundError('Compromisso não encontrado.'));
    }

    this.logger.info(
      {
        evento: EVENTOS_LOG.COMPROMISSO_REMOVIDO,
        compromissoId: idResult.value.valor,
        usuarioId: proprietarioId.valor,
      },
      'Compromisso removido'
    );

    await this.auditor.registrar({
      acao: ACOES.COMPROMISSO_REMOVIDO,
      usuarioId: proprietarioId.valor,
      recurso: 'compromisso',
      recursoId: idResult.value.valor,
      detalhes: { nome: removido.titulo.valor },
    });

    return Result.ok({ id: idResult.value.valor });
  }
}

module.exports = { RemoverCompromisso };
