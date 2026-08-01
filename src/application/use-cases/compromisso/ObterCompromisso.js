'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { NotFoundError } = require('../../../shared/errors');
const { CompromissoId } = require('../../../domain/value-objects/Identificador');

/** Leitura de um compromisso do próprio dono, para o formulário de edição. */
class ObterCompromisso extends UseCase {
  constructor({ compromissoRepository, logger }) {
    super({ logger });
    this.compromissoRepository = compromissoRepository;
  }

  async executar({ compromissoId, proprietarioId }, { signal } = {}) {
    const idResult = CompromissoId.criar(compromissoId);
    if (idResult.isFailure) {
      return Result.fail(new NotFoundError('Compromisso não encontrado.'));
    }

    const compromisso = await this.compromissoRepository.buscarPorIdDoProprietario(
      idResult.value,
      proprietarioId,
      signal
    );
    if (!compromisso) {
      return Result.fail(new NotFoundError('Compromisso não encontrado.'));
    }

    return Result.ok(compromisso);
  }
}

module.exports = { ObterCompromisso };
