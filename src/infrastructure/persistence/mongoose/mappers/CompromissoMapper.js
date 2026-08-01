'use strict';

const { Compromisso } = require('../../../../domain/entities/Compromisso');
const {
  CompromissoId,
  UsuarioId,
  ContatoId,
} = require('../../../../domain/value-objects/Identificador');
const { TituloDeCompromisso } = require('../../../../domain/value-objects/TituloDeCompromisso');
const { DataHoraDeCompromisso } = require('../../../../domain/value-objects/DataHoraDeCompromisso');
const { Etiquetas } = require('../../../../domain/value-objects/Etiquetas');

class CompromissoMapper {
  static paraDominio(documento) {
    if (!documento) return null;

    return Compromisso.reconstituir({
      id: CompromissoId.deConfianca(documento._id),
      proprietarioId: UsuarioId.deConfianca(documento.user),
      titulo: TituloDeCompromisso.deConfianca(documento.titulo),
      inicioEm: DataHoraDeCompromisso.deConfianca(documento.inicioEm),
      notas: documento.notas ? documento.notas : null,
      contatoId: documento.contato ? ContatoId.deConfianca(documento.contato) : null,
      etiquetas: Etiquetas.deConfianca(documento.etiquetas ?? []),
      criadoEm: documento.criadoEm,
      atualizadoEm: documento.atualizadoEm,
    });
  }

  static paraPersistencia(compromisso) {
    return {
      _id: compromisso.id.valor,
      user: compromisso.proprietarioId.valor,
      titulo: compromisso.titulo.valor,
      inicioEm: compromisso.inicioEm.valor,
      notas: compromisso.notas ?? '',
      contato: compromisso.contatoId?.valor ?? null,
      etiquetas: compromisso.etiquetas.toJSON(),
      criadoEm: compromisso.criadoEm,
      atualizadoEm: compromisso.atualizadoEm,
    };
  }

  static paraListaDeDominio(documentos) {
    return documentos.map(CompromissoMapper.paraDominio);
  }
}

module.exports = { CompromissoMapper };
