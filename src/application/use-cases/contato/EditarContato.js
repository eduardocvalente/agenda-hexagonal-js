'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { NotFoundError } = require('../../../shared/errors');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { ContatoId } = require('../../../domain/value-objects/Identificador');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');
const { montarDadosDeContato } = require('./montarDadosDeContato');

/**
 * Edição de contato.
 *
 * A autorização é verificada duas vezes, de propósito (defesa em profundidade):
 *  - o repositório busca filtrando por dono, então um id alheio não retorna nada;
 *  - a entidade recusa `alterarDados` se quem edita não for o proprietário.
 *
 * A redundância protege contra o caso em que um adaptador futuro esqueça o
 * filtro. E ambas respondem 404, não 403: um 403 confirmaria ao atacante que o
 * id existe e pertence a outra pessoa.
 */
class EditarContato extends UseCase {
  constructor({ contatoRepository, auditor, logger }) {
    super({ logger });
    this.contatoRepository = contatoRepository;
    this.auditor = auditor;
  }

  async executar({ contatoId, proprietarioId, dados }, { signal } = {}) {
    const idResult = ContatoId.criar(contatoId);
    if (idResult.isFailure) {
      return Result.fail(new NotFoundError('Contato não encontrado.'));
    }

    const camposResult = montarDadosDeContato(dados);
    if (camposResult.isFailure) return camposResult;

    throwIfAborted(signal, { casoDeUso: 'EditarContato', etapa: 'antes-da-busca' });

    const contato = await this.contatoRepository.buscarPorIdDoProprietario(
      idResult.value,
      proprietarioId,
      signal
    );
    if (!contato) {
      return Result.fail(new NotFoundError('Contato não encontrado.'));
    }

    // Capturado ANTES da alteração: uma trilha que só registra o estado final
    // responde "o que ficou", nunca "o que mudou".
    const nomeAnterior = contato.nome.completo;

    const { nome, email, telefone, etiquetas } = camposResult.value;
    const alteracao = contato.alterarDados({
      nome,
      email,
      telefone,
      etiquetas,
      editadoPor: proprietarioId,
    });
    if (alteracao.isFailure) {
      // A entidade devolve Forbidden quando o dono não confere; a fronteira
      // converte para 404 para não revelar a existência do registro.
      return Result.fail(new NotFoundError('Contato não encontrado.', { cause: alteracao.error }));
    }

    throwIfAborted(signal, { casoDeUso: 'EditarContato', etapa: 'antes-de-gravar' });

    const persistencia = await this.contatoRepository.atualizar(contato, signal);
    if (persistencia.isFailure) return persistencia;

    this.logger.info(
      {
        evento: EVENTOS_LOG.CONTATO_EDITADO,
        contatoId: contato.id.valor,
        usuarioId: proprietarioId.valor,
      },
      'Contato editado'
    );

    await this.auditor.registrar({
      acao: ACOES.CONTATO_EDITADO,
      usuarioId: proprietarioId.valor,
      recurso: 'contato',
      recursoId: contato.id.valor,
      detalhes: { de: nomeAnterior, para: contato.nome.completo },
    });

    return Result.ok(contato);
  }
}

module.exports = { EditarContato };
