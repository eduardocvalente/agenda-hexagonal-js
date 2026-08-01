'use strict';

const { RegistroDeAuditoria } = require('../../../../domain/entities/RegistroDeAuditoria');
const { AcaoAuditada } = require('../../../../domain/value-objects/AcaoAuditada');
const { UsuarioId, Identificador } = require('../../../../domain/value-objects/Identificador');

class RegistroDeAuditoriaMapper {
  static paraDominio(documento) {
    if (!documento) return null;

    return RegistroDeAuditoria.reconstituir({
      id: Identificador.deConfianca(documento._id),
      usuarioId: UsuarioId.deConfianca(documento.usuario),
      acao: AcaoAuditada.deConfianca(documento.acao),
      resultado: documento.resultado,
      recurso: documento.recurso,
      recursoId: documento.recursoId,
      detalhes: documento.detalhes ?? {},
      requestId: documento.requestId,
      ip: documento.ip,
      userAgent: documento.userAgent,
      ocorridoEm: documento.ocorridoEm,
    });
  }

  static paraPersistencia(registro) {
    return {
      _id: registro.id.valor,
      usuario: registro.usuarioId.valor,
      acao: registro.acao.valor,
      resultado: registro.resultado,
      recurso: registro.recurso,
      recursoId: registro.recursoId,
      detalhes: registro.detalhes,
      requestId: registro.requestId,
      ip: registro.ip,
      userAgent: registro.userAgent,
      ocorridoEm: registro.ocorridoEm,
    };
  }

  static paraListaDeDominio(documentos) {
    return documentos.map(RegistroDeAuditoriaMapper.paraDominio);
  }
}

module.exports = { RegistroDeAuditoriaMapper };
