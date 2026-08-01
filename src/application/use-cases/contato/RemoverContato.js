'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { NotFoundError } = require('../../../shared/errors');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { ContatoId } = require('../../../domain/value-objects/Identificador');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');

/**
 * Remoção de contato.
 *
 * O `removerDoProprietario` do repositório é atômico: filtra e remove em uma
 * operação só. Buscar para conferir o dono e remover em seguida abriria uma
 * janela entre as duas chamadas — pequena, mas real, e desnecessária quando o
 * banco resolve as duas coisas de uma vez.
 */
class RemoverContato extends UseCase {
  constructor({ contatoRepository, auditor, logger }) {
    super({ logger });
    this.contatoRepository = contatoRepository;
    this.auditor = auditor;
  }

  async executar({ contatoId, proprietarioId }, { signal } = {}) {
    const idResult = ContatoId.criar(contatoId);
    if (idResult.isFailure) {
      return Result.fail(new NotFoundError('Contato não encontrado.'));
    }

    throwIfAborted(signal, { casoDeUso: 'RemoverContato', etapa: 'antes-de-remover' });

    const removido = await this.contatoRepository.removerDoProprietario(
      idResult.value,
      proprietarioId,
      signal
    );

    if (!removido) {
      return Result.fail(new NotFoundError('Contato não encontrado.'));
    }

    this.logger.info(
      {
        evento: EVENTOS_LOG.CONTATO_REMOVIDO,
        contatoId: idResult.value.valor,
        usuarioId: proprietarioId.valor,
      },
      'Contato removido'
    );

    // O registro guarda o nome porque o contato deixou de existir: sem isso, a
    // trilha diria apenas "removeu o id X", que não significa nada para quem lê.
    await this.auditor.registrar({
      acao: ACOES.CONTATO_REMOVIDO,
      usuarioId: proprietarioId.valor,
      recurso: 'contato',
      recursoId: idResult.value.valor,
      detalhes: { nome: removido.nome.completo },
    });

    return Result.ok({ id: idResult.value.valor });
  }
}

module.exports = { RemoverContato };
