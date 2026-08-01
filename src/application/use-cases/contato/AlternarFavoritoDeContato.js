'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { NotFoundError } = require('../../../shared/errors');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { ContatoId } = require('../../../domain/value-objects/Identificador');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');

/**
 * Alterna o favorito de um contato.
 *
 * Caso de uso separado da edição de propósito: favoritar é um gesto de um
 * clique, sem formulário, e misturá-lo com `EditarContato` obrigaria o toggle
 * a reenviar todos os campos — qualquer divergência entre o HTML e o banco
 * sobrescreveria dados silenciosamente.
 *
 * Mesma política de privacidade da edição: id alheio ou inexistente respondem
 * o MESMO 404, para não confirmar a existência do registro.
 */
class AlternarFavoritoDeContato extends UseCase {
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

    throwIfAborted(signal, { casoDeUso: 'AlternarFavoritoDeContato', etapa: 'antes-da-busca' });

    const contato = await this.contatoRepository.buscarPorIdDoProprietario(
      idResult.value,
      proprietarioId,
      signal
    );
    if (!contato) {
      return Result.fail(new NotFoundError('Contato não encontrado.'));
    }

    const alternado = contato.alternarFavorito({ alteradoPor: proprietarioId });
    if (alternado.isFailure) {
      return Result.fail(new NotFoundError('Contato não encontrado.', { cause: alternado.error }));
    }

    throwIfAborted(signal, { casoDeUso: 'AlternarFavoritoDeContato', etapa: 'antes-de-gravar' });

    const persistencia = await this.contatoRepository.atualizar(contato, signal);
    if (persistencia.isFailure) return persistencia;

    this.logger.info(
      {
        evento: EVENTOS_LOG.CONTATO_FAVORITO_ALTERNADO,
        contatoId: contato.id.valor,
        usuarioId: proprietarioId.valor,
        favorito: contato.favorito,
      },
      'Favorito de contato alternado'
    );

    await this.auditor.registrar({
      acao: contato.favorito ? ACOES.CONTATO_FAVORITADO : ACOES.CONTATO_DESFAVORITADO,
      usuarioId: proprietarioId.valor,
      recurso: 'contato',
      recursoId: contato.id.valor,
      detalhes: { nome: contato.nome.completo },
    });

    return Result.ok(contato);
  }
}

module.exports = { AlternarFavoritoDeContato };
