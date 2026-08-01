'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { NotFoundError } = require('../../../shared/errors');
const { ContatoId } = require('../../../domain/value-objects/Identificador');

/**
 * Obtém um contato do usuário para edição.
 *
 * Identificador malformado e contato de outro dono produzem exatamente a mesma
 * resposta: `NotFoundError`. Distingui-los daria a um atacante um oráculo para
 * descobrir quais ids existem.
 */
class ObterContato extends UseCase {
  constructor({ contatoRepository, logger }) {
    super({ logger });
    this.contatoRepository = contatoRepository;
  }

  async executar({ contatoId, proprietarioId }, { signal } = {}) {
    const idResult = ContatoId.criar(contatoId);
    if (idResult.isFailure) {
      return Result.fail(new NotFoundError('Contato não encontrado.'));
    }

    throwIfAborted(signal, { casoDeUso: 'ObterContato' });

    const contato = await this.contatoRepository.buscarPorIdDoProprietario(
      idResult.value,
      proprietarioId,
      signal
    );

    if (!contato) {
      return Result.fail(new NotFoundError('Contato não encontrado.'));
    }

    return Result.ok(contato);
  }
}

module.exports = { ObterContato };
