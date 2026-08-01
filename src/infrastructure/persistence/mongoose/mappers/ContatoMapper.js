'use strict';

const { Contato } = require('../../../../domain/entities/Contato');
const { ContatoId, UsuarioId } = require('../../../../domain/value-objects/Identificador');
const { NomePessoa } = require('../../../../domain/value-objects/NomePessoa');
const { Email } = require('../../../../domain/value-objects/Email');
const { Telefone } = require('../../../../domain/value-objects/Telefone');
const { Etiquetas } = require('../../../../domain/value-objects/Etiquetas');

class ContatoMapper {
  static paraDominio(documento) {
    if (!documento) return null;

    return Contato.reconstituir({
      id: ContatoId.deConfianca(documento._id),
      proprietarioId: UsuarioId.deConfianca(documento.user),
      nome: NomePessoa.deConfianca(documento.nome, documento.sobrenome),
      // Campos opcionais viram `null` quando vazios — a entidade distingue
      // "sem telefone" de "telefone vazio", e a string vazia é representação
      // do banco, não do domínio.
      email: documento.email ? Email.deConfianca(documento.email) : null,
      telefone: documento.telefone ? Telefone.deConfianca(documento.telefone) : null,
      // `?? []` cobre documentos anteriores à existência do campo — migração
      // preguiçosa: nenhum script de backfill, o mapper absorve a ausência.
      etiquetas: Etiquetas.deConfianca(documento.etiquetas ?? []),
      favorito: documento.favorito === true,
      criadoEm: documento.criadoEm,
      atualizadoEm: documento.atualizadoEm,
    });
  }

  static paraPersistencia(contato) {
    return {
      _id: contato.id.valor,
      user: contato.proprietarioId.valor,
      nome: contato.nome.nome,
      sobrenome: contato.nome.sobrenome,
      email: contato.email?.valor ?? '',
      telefone: contato.telefone?.valor ?? '',
      etiquetas: contato.etiquetas.toJSON(),
      favorito: contato.favorito,
      criadoEm: contato.criadoEm,
      atualizadoEm: contato.atualizadoEm,
    };
  }

  static paraListaDeDominio(documentos) {
    return documentos.map(ContatoMapper.paraDominio);
  }
}

module.exports = { ContatoMapper };
