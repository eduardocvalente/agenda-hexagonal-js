'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');

/**
 * Exportação da agenda completa do usuário.
 *
 * A exportação é auditada: baixar a base inteira de uma vez é exatamente o
 * tipo de evento que uma investigação de conta comprometida quer encontrar
 * na trilha.
 */
class ExportarContatos extends UseCase {
  constructor({ contatoRepository, auditor, logger }) {
    super({ logger });
    this.contatoRepository = contatoRepository;
    this.auditor = auditor;
  }

  async executar({ proprietarioId }, { signal } = {}) {
    throwIfAborted(signal, { casoDeUso: 'ExportarContatos', etapa: 'antes-da-busca' });

    const contatos = await this.contatoRepository.listarTodosDoProprietario(proprietarioId, signal);

    await this.auditor.registrar({
      acao: ACOES.CONTATOS_EXPORTADOS,
      usuarioId: proprietarioId.valor,
      recurso: 'contato',
      detalhes: { total: contatos.length },
    });

    return Result.ok(contatos);
  }
}

module.exports = { ExportarContatos };
