'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { ValidationError } = require('../../../shared/errors');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { Compromisso } = require('../../../domain/entities/Compromisso');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');
const { montarDadosDeCompromisso } = require('./montarDadosDeCompromisso');

/**
 * Criação de compromisso.
 *
 * Quando há contato vinculado, a POSSE do contato é verificada aqui: sem essa
 * checagem, um id de contato alheio no corpo do formulário vincularia o
 * compromisso a dados de outra pessoa — o mesmo mass assignment que o resto
 * do sistema fecha, só que pela porta lateral do vínculo.
 */
class CriarCompromisso extends UseCase {
  constructor({ compromissoRepository, contatoRepository, auditor, logger }) {
    super({ logger });
    this.compromissoRepository = compromissoRepository;
    this.contatoRepository = contatoRepository;
    this.auditor = auditor;
  }

  async executar({ proprietarioId, dados }, { signal } = {}) {
    const camposResult = montarDadosDeCompromisso(dados);
    if (camposResult.isFailure) return camposResult;

    const { titulo, inicioEm, notas, contatoId, etiquetas } = camposResult.value;

    if (contatoId) {
      const contato = await this.contatoRepository.buscarPorIdDoProprietario(
        contatoId,
        proprietarioId,
        signal
      );
      if (!contato) {
        // Mesma mensagem para "não existe" e "é de outro dono".
        return Result.fail(
          new ValidationError('Contato vinculado inválido.', {
            code: 'COMPROMISSO_CONTATO_INVALIDO',
          })
        );
      }
    }

    const compromissoResult = Compromisso.criar({
      id: this.compromissoRepository.proximoId(),
      proprietarioId,
      titulo,
      inicioEm,
      notas,
      contatoId,
      etiquetas,
    });
    if (compromissoResult.isFailure) return compromissoResult;

    throwIfAborted(signal, { casoDeUso: 'CriarCompromisso', etapa: 'antes-de-salvar' });

    const persistencia = await this.compromissoRepository.salvar(compromissoResult.value, signal);
    if (persistencia.isFailure) return persistencia;

    const compromisso = compromissoResult.value;
    this.logger.info(
      {
        evento: EVENTOS_LOG.COMPROMISSO_CRIADO,
        compromissoId: compromisso.id.valor,
        usuarioId: proprietarioId.valor,
      },
      'Compromisso criado'
    );

    await this.auditor.registrar({
      acao: ACOES.COMPROMISSO_CRIADO,
      usuarioId: proprietarioId.valor,
      recurso: 'compromisso',
      recursoId: compromisso.id.valor,
      detalhes: { nome: compromisso.titulo.valor },
    });

    return Result.ok(compromisso);
  }
}

module.exports = { CriarCompromisso };
