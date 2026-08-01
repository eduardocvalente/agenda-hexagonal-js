'use strict';

const mongoose = require('mongoose');

const { AuditoriaRepository } = require('../../../domain/repositories/AuditoriaRepository');
const { Identificador } = require('../../../domain/value-objects/Identificador');
const { RegistroDeAuditoriaSchema } = require('./schemas/RegistroDeAuditoriaSchema');
const { RegistroDeAuditoriaMapper } = require('./mappers/RegistroDeAuditoriaMapper');
const { Result } = require('../../../shared/result/Result');
const { InfrastructureError } = require('../../../shared/errors');
const { runCancellable } = require('../../../shared/cancellation');
const { TEMPOS } = require('../../../shared/constants');

/**
 * Adaptador de persistência da trilha de auditoria.
 *
 * Duas diferenças conscientes em relação aos outros repositórios:
 *
 *  1. **`registrar` não recebe `signal`** — ou melhor, recebe mas o ignora no
 *     `runCancellable`. A gravação da trilha não deve ser abortada porque o
 *     cliente fechou a aba: o evento aconteceu, e o registro de que aconteceu
 *     não depende de alguém estar esperando a resposta. Cancelar aqui criaria
 *     buracos na trilha justamente nas requisições interrompidas — que são as
 *     mais interessantes em uma investigação.
 *
 *  2. **A leitura respeita cancelamento normalmente**, porque é uma consulta
 *     como qualquer outra, feita para alguém que está esperando.
 */
class MongooseAuditoriaRepository extends AuditoriaRepository {
  #model;

  constructor({ connection = mongoose } = {}) {
    super();
    this.#model =
      connection.models.RegistroDeAuditoria ||
      connection.model('RegistroDeAuditoria', RegistroDeAuditoriaSchema);
  }

  proximoId() {
    return Identificador.deConfianca(new mongoose.Types.ObjectId().toString());
  }

  async registrar(registro) {
    try {
      await this.#model.create([RegistroDeAuditoriaMapper.paraPersistencia(registro)], {
        ordered: true,
      });
      return Result.ok(registro);
    } catch (erro) {
      return Result.fail(
        new InfrastructureError('Falha ao gravar registro de auditoria.', {
          code: 'AUDITORIA_NAO_GRAVADA',
          cause: erro,
          context: { acao: registro.acao.valor },
        })
      );
    }
  }

  async listarDoUsuario(usuarioId, { pagina, tamanho, acao }, signal) {
    const filtro = { usuario: usuarioId.valor };
    if (acao) filtro.acao = acao;

    const [documentos, total] = await runCancellable(
      Promise.all([
        this.#model
          .find(filtro)
          .sort({ ocorridoEm: -1 })
          .skip((pagina - 1) * tamanho)
          .limit(tamanho)
          .maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS)
          .lean()
          .exec(),
        this.#model.countDocuments(filtro).maxTimeMS(TEMPOS.TIMEOUT_CONSULTA_MS).exec(),
      ]),
      signal,
      { repositorio: 'Auditoria', operacao: 'listarDoUsuario' }
    );

    return { itens: RegistroDeAuditoriaMapper.paraListaDeDominio(documentos), total };
  }

  async garantirIndices() {
    await this.#model.init();
  }

  get model() {
    return this.#model;
  }
}

module.exports = { MongooseAuditoriaRepository };
