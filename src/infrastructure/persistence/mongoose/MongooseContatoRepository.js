'use strict';

const mongoose = require('mongoose');

const { ContatoRepository } = require('../../../domain/repositories/ContatoRepository');
const { ContatoId } = require('../../../domain/value-objects/Identificador');
const { ContatoSchema } = require('./schemas/ContatoSchema');
const { ContatoMapper } = require('./mappers/ContatoMapper');
const { Result } = require('../../../shared/result/Result');
const { InfrastructureError } = require('../../../shared/errors');
const { runCancellable, throwIfAborted } = require('../../../shared/cancellation');
const { RegexCatalog } = require('../../../shared/regex/RegexCatalog');
const { TEMPOS } = require('../../../shared/constants');

/**
 * Adaptador de saída para contatos.
 *
 * Todo método de leitura e remoção filtra por `user`. Isso é redundante com a
 * verificação na entidade, e a redundância é intencional: se um caso de uso
 * futuro esquecer de checar o dono, a consulta ainda não devolve dado alheio.
 * Segurança que depende de um único ponto falha quando esse ponto falha.
 */
class MongooseContatoRepository extends ContatoRepository {
  #model;

  constructor({ connection = mongoose } = {}) {
    super();
    this.#model = connection.models.Contato || connection.model('Contato', ContatoSchema);
  }

  proximoId() {
    return ContatoId.deConfianca(new mongoose.Types.ObjectId().toString());
  }

  async buscarPorIdDoProprietario(id, proprietarioId, signal) {
    throwIfAborted(signal, { repositorio: 'Contato', operacao: 'buscarPorId' });

    const documento = await runCancellable(
      this.#model
        .findOne({ _id: id.valor, user: proprietarioId.valor })
        .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
        .lean()
        .exec(),
      signal,
      { repositorio: 'Contato', operacao: 'buscarPorId' }
    );

    return ContatoMapper.paraDominio(documento);
  }

  async listarDoProprietario(proprietarioId, { pagina, tamanho, filtros = {} }, signal) {
    throwIfAborted(signal, { repositorio: 'Contato', operacao: 'listar' });

    const filtro = { user: proprietarioId.valor };

    // Igualdade exata: usa o índice multikey `user_etiquetas_criadoEm`.
    if (filtros.etiqueta) filtro.etiquetas = filtros.etiqueta;
    if (filtros.favoritos) filtro.favorito = true;

    // Busca por substring, sem âncora — não aproveita índice além do prefixo
    // `user`, e isso é aceitável: a agenda é pessoal, o conjunto filtrado por
    // dono é pequeno. O escape elimina metacaracteres (ReDoS) e o caso de uso
    // já limitou o tamanho da entrada.
    if (filtros.busca) {
      const padrao = new RegExp(RegexCatalog.escapar(filtros.busca), 'i');
      filtro.$or = [
        { nome: padrao },
        { sobrenome: padrao },
        { email: padrao },
        { telefone: padrao },
      ];
    }

    // Duas consultas independentes: paralelizar corta a latência pela metade.
    // `allSettled` não serve aqui — se a contagem falhar, a paginação estaria
    // errada, e devolver dado errado é pior que devolver erro.
    const [documentos, total] = await runCancellable(
      Promise.all([
        this.#model
          .find(filtro)
          .sort({ criadoEm: -1 })
          .skip((pagina - 1) * tamanho)
          .limit(tamanho)
          .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
          .lean()
          .exec(),
        this.#model.countDocuments(filtro).maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS).exec(),
      ]),
      signal,
      { repositorio: 'Contato', operacao: 'listar' }
    );

    return { itens: ContatoMapper.paraListaDeDominio(documentos), total };
  }

  async salvar(contato, signal) {
    throwIfAborted(signal, { repositorio: 'Contato', operacao: 'salvar' });

    try {
      await runCancellable(
        this.#model.create([ContatoMapper.paraPersistencia(contato)], { ordered: true }),
        signal,
        { repositorio: 'Contato', operacao: 'salvar' }
      );
      return Result.ok(contato);
    } catch (erro) {
      if (erro?.name === 'CancelledError' || erro?.name === 'TimeoutError') throw erro;
      return Result.fail(new InfrastructureError('Falha ao persistir contato.', { cause: erro }));
    }
  }

  async atualizar(contato, signal) {
    throwIfAborted(signal, { repositorio: 'Contato', operacao: 'atualizar' });

    try {
      const dados = ContatoMapper.paraPersistencia(contato);
      delete dados._id;

      const resultado = await runCancellable(
        this.#model
          .updateOne(
            { _id: contato.id.valor, user: contato.proprietarioId.valor },
            { $set: dados },
            { runValidators: true }
          )
          .maxTimeMS(TEMPOS.TIMEOUT_ESCRITA_MS)
          .exec(),
        signal,
        { repositorio: 'Contato', operacao: 'atualizar' }
      );

      if (resultado.matchedCount === 0) {
        return Result.fail(
          new InfrastructureError('Contato não encontrado para atualização.', {
            code: 'CONTATO_NAO_ATUALIZADO',
          })
        );
      }
      return Result.ok(contato);
    } catch (erro) {
      if (erro?.name === 'CancelledError' || erro?.name === 'TimeoutError') throw erro;
      return Result.fail(new InfrastructureError('Falha ao atualizar contato.', { cause: erro }));
    }
  }

  async removerDoProprietario(id, proprietarioId, signal) {
    throwIfAborted(signal, { repositorio: 'Contato', operacao: 'remover' });

    // Filtro e remoção em uma operação atômica: buscar para conferir o dono e
    // remover em seguida abriria uma janela entre as duas chamadas.
    const documento = await runCancellable(
      this.#model
        .findOneAndDelete({ _id: id.valor, user: proprietarioId.valor })
        .maxTimeMS(TEMPOS.TIMEOUT_ESCRITA_MS)
        .lean()
        .exec(),
      signal,
      { repositorio: 'Contato', operacao: 'remover' }
    );

    return ContatoMapper.paraDominio(documento);
  }

  async listarEtiquetasDoProprietario(proprietarioId, signal) {
    throwIfAborted(signal, { repositorio: 'Contato', operacao: 'listarEtiquetas' });

    const etiquetas = await runCancellable(
      this.#model.distinct('etiquetas', { user: proprietarioId.valor }).exec(),
      signal,
      { repositorio: 'Contato', operacao: 'listarEtiquetas' }
    );

    return etiquetas.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async listarTodosDoProprietario(proprietarioId, signal) {
    throwIfAborted(signal, { repositorio: 'Contato', operacao: 'listarTodos' });

    // Exportação carrega a agenda inteira — com teto. 10.000 contatos cobrem
    // qualquer agenda pessoal real; sem o limit, um registro em massa vira
    // um vetor de exaustão de memória.
    const documentos = await runCancellable(
      this.#model
        .find({ user: proprietarioId.valor })
        .sort({ criadoEm: -1 })
        .limit(10_000)
        .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
        .lean()
        .exec(),
      signal,
      { repositorio: 'Contato', operacao: 'listarTodos' }
    );

    return ContatoMapper.paraListaDeDominio(documentos);
  }

  async resumirDoProprietario(proprietarioId, signal) {
    throwIfAborted(signal, { repositorio: 'Contato', operacao: 'resumir' });

    // O $match do aggregate NÃO passa pelo cast do Mongoose: o ObjectId
    // precisa ser construído à mão, senão a comparação é string × ObjectId e
    // o resultado é silenciosamente vazio.
    const dono = new mongoose.Types.ObjectId(proprietarioId.valor);

    const [totalDeContatos, totalDeFavoritos, porEtiqueta, recentes] = await runCancellable(
      Promise.all([
        this.#model.countDocuments({ user: dono }).maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS).exec(),
        this.#model
          .countDocuments({ user: dono, favorito: true })
          .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
          .exec(),
        this.#model
          .aggregate([
            { $match: { user: dono } },
            { $unwind: '$etiquetas' },
            { $group: { _id: '$etiquetas', total: { $sum: 1 } } },
            { $sort: { total: -1, _id: 1 } },
            { $limit: 8 },
          ])
          .option({ maxTimeMS: TEMPOS.TIMEOUT_CONSULTA_MS })
          .exec(),
        this.#model
          .find({ user: dono })
          .sort({ criadoEm: -1 })
          .limit(5)
          .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
          .lean()
          .exec(),
      ]),
      signal,
      { repositorio: 'Contato', operacao: 'resumir' }
    );

    return {
      totalDeContatos,
      totalDeFavoritos,
      porEtiqueta: porEtiqueta.map((grupo) => ({ etiqueta: grupo._id, total: grupo.total })),
      recentes: ContatoMapper.paraListaDeDominio(recentes),
    };
  }

  async garantirIndices() {
    await this.#model.init();
  }

  get model() {
    return this.#model;
  }
}

module.exports = { MongooseContatoRepository };
