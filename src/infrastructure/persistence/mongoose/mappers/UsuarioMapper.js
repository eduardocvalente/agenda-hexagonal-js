'use strict';

const { Usuario } = require('../../../../domain/entities/Usuario');
const { UsuarioId } = require('../../../../domain/value-objects/Identificador');
const { Email } = require('../../../../domain/value-objects/Email');
const { SenhaComHash } = require('../../../../domain/value-objects/SenhaComHash');

/**
 * Tradutor entre documento persistido e entidade de domínio.
 *
 * Reconstitui com as fábricas `deConfianca`, que não revalidam: o dado veio do
 * próprio banco e já passou pela validação quando foi gravado. Revalidar aqui
 * custaria CPU em todo carregamento e, pior, faria a aplicação recusar dados
 * legítimos sempre que uma regra ficasse mais rígida — registros antigos
 * deixariam de carregar.
 */
class UsuarioMapper {
  static paraDominio(documento) {
    if (!documento) return null;

    return Usuario.reconstituir({
      id: UsuarioId.deConfianca(documento._id),
      email: Email.deConfianca(documento.email),
      senhaComHash: documento.password ? SenhaComHash.deConfianca(documento.password) : null,
      criadoEm: documento.criadoEm,
    });
  }

  static paraPersistencia(usuario) {
    return {
      _id: usuario.id.valor,
      email: usuario.email.valor,
      password: usuario.credencial.revelar(),
      criadoEm: usuario.criadoEm,
    };
  }
}

module.exports = { UsuarioMapper };
