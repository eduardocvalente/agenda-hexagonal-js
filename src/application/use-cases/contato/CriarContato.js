'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { Contato } = require('../../../domain/entities/Contato');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');
const { montarDadosDeContato } = require('./montarDadosDeContato');

/**
 * Criação de contato.
 *
 * O `proprietarioId` vem do contexto de autenticação, nunca do corpo da
 * requisição — é o que impede o mass assignment que permitiria criar um
 * contato na agenda de outra pessoa.
 */
class CriarContato extends UseCase {
  constructor({ contatoRepository, auditor, logger }) {
    super({ logger });
    this.contatoRepository = contatoRepository;
    this.auditor = auditor;
  }

  /**
   * @param {{proprietarioId: import('../../../domain/value-objects/Identificador').UsuarioId,
   *          dados: {nome: string, sobrenome: string, email: string, telefone: string}}} entrada
   */
  async executar({ proprietarioId, dados }, { signal } = {}) {
    const camposResult = montarDadosDeContato(dados);
    if (camposResult.isFailure) return camposResult;

    const { nome, email, telefone, etiquetas } = camposResult.value;

    const contatoResult = Contato.criar({
      id: this.contatoRepository.proximoId(),
      proprietarioId,
      nome,
      email,
      telefone,
      etiquetas,
    });
    if (contatoResult.isFailure) return contatoResult;

    throwIfAborted(signal, { casoDeUso: 'CriarContato', etapa: 'antes-de-salvar' });

    const persistencia = await this.contatoRepository.salvar(contatoResult.value, signal);
    if (persistencia.isFailure) return persistencia;

    const contato = contatoResult.value;
    this.logger.info(
      {
        evento: EVENTOS_LOG.CONTATO_CRIADO,
        contatoId: contato.id.valor,
        usuarioId: proprietarioId.valor,
      },
      'Contato criado'
    );

    // `nome` nos detalhes torna a trilha legível ("Contato criado — João
    // Silva") sem precisar buscar um registro que pode já ter sido apagado.
    // É duplicação deliberada: a trilha precisa fazer sentido sozinha.
    await this.auditor.registrar({
      acao: ACOES.CONTATO_CRIADO,
      usuarioId: proprietarioId.valor,
      recurso: 'contato',
      recursoId: contato.id.valor,
      detalhes: { nome: contato.nome.completo },
    });

    return Result.ok(contato);
  }
}

module.exports = { CriarContato };
