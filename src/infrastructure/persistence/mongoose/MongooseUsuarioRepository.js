'use strict';

const mongoose = require('mongoose');

const { UsuarioRepository } = require('../../../domain/repositories/UsuarioRepository');
const { UsuarioId } = require('../../../domain/value-objects/Identificador');
const { UsuarioSchema } = require('./schemas/UsuarioSchema');
const { UsuarioMapper } = require('./mappers/UsuarioMapper');
const { Result } = require('../../../shared/result/Result');
const { ConflictError, InfrastructureError } = require('../../../shared/errors');
const { runCancellable, throwIfAborted } = require('../../../shared/cancellation');
const { TEMPOS } = require('../../../shared/constants');

/**
 * Adaptador de saída: implementa a porta `UsuarioRepository` sobre Mongoose.
 *
 * Cancelamento é tratado em duas frentes, porque uma sozinha não basta:
 *  - `runCancellable` abandona a ESPERA quando o cliente desiste, liberando a
 *    requisição imediatamente;
 *  - `maxTimeMS` faz o próprio servidor do MongoDB abortar a execução. Sem ele,
 *    a query continuaria consumindo o banco mesmo com ninguém esperando o
 *    resultado — que é o cenário que derruba um cluster sob carga.
 */
class MongooseUsuarioRepository extends UsuarioRepository {
  #model;

  constructor({ connection = mongoose } = {}) {
    super();
    this.#model = connection.models.Usuario || connection.model('Usuario', UsuarioSchema);
  }

  proximoId() {
    return UsuarioId.deConfianca(new mongoose.Types.ObjectId().toString());
  }

  async buscarPorEmail(email, signal) {
    throwIfAborted(signal, { repositorio: 'Usuario', operacao: 'buscarPorEmail' });

    const consulta = this.#model
      .findOne({ email: email.valor })
      .select('+password')
      .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
      .lean();

    const documento = await runCancellable(consulta.exec(), signal, {
      repositorio: 'Usuario',
      operacao: 'buscarPorEmail',
    });

    return UsuarioMapper.paraDominio(documento);
  }

  async salvar(usuario, signal) {
    throwIfAborted(signal, { repositorio: 'Usuario', operacao: 'salvar' });

    try {
      await runCancellable(
        this.#model.create([UsuarioMapper.paraPersistencia(usuario)], { ordered: true }),
        signal,
        { repositorio: 'Usuario', operacao: 'salvar' }
      );
      return Result.ok(usuario);
    } catch (erro) {
      // 11000 = violação de índice único. É a checagem de unicidade real —
      // qualquer verificação prévia em código estaria sujeita a corrida.
      if (erro?.code === 11000 || erro?.cause?.code === 11000) {
        return Result.fail(
          new ConflictError('Registro já existente.', {
            code: 'USUARIO_DUPLICADO',
            cause: erro,
          })
        );
      }
      if (erro?.name === 'CancelledError' || erro?.name === 'TimeoutError') throw erro;

      return Result.fail(
        new InfrastructureError('Falha ao persistir usuário.', {
          cause: erro,
          context: { repositorio: 'Usuario' },
        })
      );
    }
  }

  async atualizarCredencial(usuarioId, senhaComHash, signal) {
    throwIfAborted(signal, { repositorio: 'Usuario', operacao: 'atualizarCredencial' });

    await runCancellable(
      this.#model
        .updateOne({ _id: usuarioId.valor }, { $set: { password: senhaComHash.revelar() } })
        .maxTimeMS(TEMPOS.TIMEOUT_ESCRITA_MS)
        .exec(),
      signal,
      { repositorio: 'Usuario', operacao: 'atualizarCredencial' }
    );

    return Result.ok(true);
  }

  /** Exposto para os testes garantirem a criação dos índices antes de asserções. */
  async garantirIndices() {
    await this.#model.init();
  }

  get model() {
    return this.#model;
  }
}

module.exports = { MongooseUsuarioRepository };
