'use strict';

const mongoose = require('mongoose');

const { CompromissoRepository } = require('../../../domain/repositories/CompromissoRepository');
const { CompromissoId } = require('../../../domain/value-objects/Identificador');
const { CompromissoSchema } = require('./schemas/CompromissoSchema');
const { CompromissoMapper } = require('./mappers/CompromissoMapper');
const { Result } = require('../../../shared/result/Result');
const { InfrastructureError } = require('../../../shared/errors');
const { runCancellable, throwIfAborted } = require('../../../shared/cancellation');
const { TEMPOS } = require('../../../shared/constants');

/**
 * Adaptador de saída para compromissos.
 *
 * Toda leitura e remoção filtra por `user` — redundante com a entidade, e
 * intencional, como no repositório de contatos.
 */
class MongooseCompromissoRepository extends CompromissoRepository {
  #model;

  constructor({ connection = mongoose } = {}) {
    super();
    this.#model =
      connection.models.Compromisso || connection.model('Compromisso', CompromissoSchema);
  }

  proximoId() {
    return CompromissoId.deConfianca(new mongoose.Types.ObjectId().toString());
  }

  async buscarPorIdDoProprietario(id, proprietarioId, signal) {
    throwIfAborted(signal, { repositorio: 'Compromisso', operacao: 'buscarPorId' });

    const documento = await runCancellable(
      this.#model
        .findOne({ _id: id.valor, user: proprietarioId.valor })
        .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
        .lean()
        .exec(),
      signal,
      { repositorio: 'Compromisso', operacao: 'buscarPorId' }
    );

    return CompromissoMapper.paraDominio(documento);
  }

  async listarDoProprietarioEntre(proprietarioId, { inicio, fim }, signal) {
    throwIfAborted(signal, { repositorio: 'Compromisso', operacao: 'listarEntre' });

    // Janela [inicio, fim): meio-aberta de propósito — um compromisso à
    // meia-noite exata do dia 1º pertence a UM mês, nunca aos dois.
    //
    // `mongoose.trusted`: o sanitizeFilter global trataria {$gte,$lt} como
    // VALOR (anti NoSQL injection) e a query quebraria. Aqui é seguro marcar
    // como confiável — as datas são construídas pelo servidor, nunca vêm da
    // requisição.
    const documentos = await runCancellable(
      this.#model
        .find({
          user: proprietarioId.valor,
          inicioEm: mongoose.trusted({ $gte: inicio, $lt: fim }),
        })
        .sort({ inicioEm: 1 })
        .limit(500)
        .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
        .lean()
        .exec(),
      signal,
      { repositorio: 'Compromisso', operacao: 'listarEntre' }
    );

    return CompromissoMapper.paraListaDeDominio(documentos);
  }

  async listarProximosDoProprietario(proprietarioId, { aPartirDe, limite }, signal) {
    throwIfAborted(signal, { repositorio: 'Compromisso', operacao: 'listarProximos' });

    const documentos = await runCancellable(
      this.#model
        .find({
          user: proprietarioId.valor,
          inicioEm: mongoose.trusted({ $gte: aPartirDe }),
        })
        .sort({ inicioEm: 1 })
        .limit(limite)
        .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
        .lean()
        .exec(),
      signal,
      { repositorio: 'Compromisso', operacao: 'listarProximos' }
    );

    return CompromissoMapper.paraListaDeDominio(documentos);
  }

  async listarEtiquetasDoProprietario(proprietarioId, signal) {
    throwIfAborted(signal, { repositorio: 'Compromisso', operacao: 'listarEtiquetas' });

    const etiquetas = await runCancellable(
      this.#model.distinct('etiquetas', { user: proprietarioId.valor }).exec(),
      signal,
      { repositorio: 'Compromisso', operacao: 'listarEtiquetas' }
    );

    return etiquetas.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async contarAPartirDe(proprietarioId, aPartirDe, signal) {
    throwIfAborted(signal, { repositorio: 'Compromisso', operacao: 'contarAPartirDe' });

    return runCancellable(
      this.#model
        .countDocuments({
          user: proprietarioId.valor,
          inicioEm: mongoose.trusted({ $gte: aPartirDe }),
        })
        .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
        .exec(),
      signal,
      { repositorio: 'Compromisso', operacao: 'contarAPartirDe' }
    );
  }

  async salvar(compromisso, signal) {
    throwIfAborted(signal, { repositorio: 'Compromisso', operacao: 'salvar' });

    try {
      await runCancellable(
        this.#model.create([CompromissoMapper.paraPersistencia(compromisso)], { ordered: true }),
        signal,
        { repositorio: 'Compromisso', operacao: 'salvar' }
      );
      return Result.ok(compromisso);
    } catch (erro) {
      if (erro?.name === 'CancelledError' || erro?.name === 'TimeoutError') throw erro;
      return Result.fail(
        new InfrastructureError('Falha ao persistir compromisso.', { cause: erro })
      );
    }
  }

  async atualizar(compromisso, signal) {
    throwIfAborted(signal, { repositorio: 'Compromisso', operacao: 'atualizar' });

    try {
      const dados = CompromissoMapper.paraPersistencia(compromisso);
      delete dados._id;

      const resultado = await runCancellable(
        this.#model
          .updateOne(
            { _id: compromisso.id.valor, user: compromisso.proprietarioId.valor },
            { $set: dados },
            { runValidators: true }
          )
          .maxTimeMS(TEMPOS.TIMEOUT_ESCRITA_MS)
          .exec(),
        signal,
        { repositorio: 'Compromisso', operacao: 'atualizar' }
      );

      if (resultado.matchedCount === 0) {
        return Result.fail(
          new InfrastructureError('Compromisso não encontrado para atualização.', {
            code: 'COMPROMISSO_NAO_ATUALIZADO',
          })
        );
      }
      return Result.ok(compromisso);
    } catch (erro) {
      if (erro?.name === 'CancelledError' || erro?.name === 'TimeoutError') throw erro;
      return Result.fail(
        new InfrastructureError('Falha ao atualizar compromisso.', { cause: erro })
      );
    }
  }

  async removerDoProprietario(id, proprietarioId, signal) {
    throwIfAborted(signal, { repositorio: 'Compromisso', operacao: 'remover' });

    const documento = await runCancellable(
      this.#model
        .findOneAndDelete({ _id: id.valor, user: proprietarioId.valor })
        .maxTimeMS(TEMPOS.TIMEOUT_ESCRITA_MS)
        .lean()
        .exec(),
      signal,
      { repositorio: 'Compromisso', operacao: 'remover' }
    );

    return CompromissoMapper.paraDominio(documento);
  }

  async garantirIndices() {
    await this.#model.init();
  }

  get model() {
    return this.#model;
  }
}

module.exports = { MongooseCompromissoRepository };
