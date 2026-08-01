'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');

/**
 * Ação registrável na trilha de auditoria.
 *
 * Conjunto fechado, e de propósito: uma string livre transformaria a trilha em
 * texto não consultável, com `contato.criado`, `CONTATO_CRIADO` e
 * `criou contato` convivendo na mesma collection. Com um VO fechado, agregar
 * por ação é uma query, não uma heurística de normalização.
 *
 * `RESULTADO` separa tentativa de sucesso — auditar apenas o que deu certo
 * esconde exatamente o que mais interessa em investigação de incidente.
 */
const ACOES = Object.freeze({
  USUARIO_CADASTRADO: 'usuario.cadastrado',
  USUARIO_AUTENTICADO: 'usuario.autenticado',
  AUTENTICACAO_RECUSADA: 'usuario.autenticacao_recusada',
  USUARIO_DESCONECTADO: 'usuario.desconectado',
  SENHA_REFORCADA: 'usuario.senha_reforcada',
  CONTATO_CRIADO: 'contato.criado',
  CONTATO_EDITADO: 'contato.editado',
  CONTATO_REMOVIDO: 'contato.removido',
  CONTATO_FAVORITADO: 'contato.favoritado',
  CONTATO_DESFAVORITADO: 'contato.desfavoritado',
  CONTATOS_EXPORTADOS: 'contato.exportados',
  COMPROMISSO_CRIADO: 'compromisso.criado',
  COMPROMISSO_EDITADO: 'compromisso.editado',
  COMPROMISSO_REMOVIDO: 'compromisso.removido',
});

const RESULTADOS = Object.freeze({ SUCESSO: 'sucesso', FALHA: 'falha' });

/** Rótulos legíveis para a tela de atividades do usuário. */
const DESCRICOES = Object.freeze({
  [ACOES.USUARIO_CADASTRADO]: 'Conta criada',
  [ACOES.USUARIO_AUTENTICADO]: 'Login efetuado',
  [ACOES.AUTENTICACAO_RECUSADA]: 'Tentativa de login recusada',
  [ACOES.USUARIO_DESCONECTADO]: 'Logout efetuado',
  [ACOES.SENHA_REFORCADA]: 'Proteção da senha atualizada',
  [ACOES.CONTATO_CRIADO]: 'Contato criado',
  [ACOES.CONTATO_EDITADO]: 'Contato editado',
  [ACOES.CONTATO_REMOVIDO]: 'Contato removido',
  [ACOES.CONTATO_FAVORITADO]: 'Contato marcado como favorito',
  [ACOES.CONTATO_DESFAVORITADO]: 'Contato removido dos favoritos',
  [ACOES.CONTATOS_EXPORTADOS]: 'Agenda exportada em CSV',
  [ACOES.COMPROMISSO_CRIADO]: 'Compromisso criado',
  [ACOES.COMPROMISSO_EDITADO]: 'Compromisso editado',
  [ACOES.COMPROMISSO_REMOVIDO]: 'Compromisso removido',
});

const VALORES = new Set(Object.values(ACOES));

class AcaoAuditada extends ValueObject {
  static criar(valor) {
    if (!VALORES.has(valor)) {
      return Result.fail(
        new ValidationError(`Ação de auditoria desconhecida: "${valor}".`, {
          code: 'ACAO_AUDITADA_INVALIDA',
          context: { valor },
        })
      );
    }
    return Result.ok(new AcaoAuditada({ valor }));
  }

  static deConfianca(valor) {
    return new AcaoAuditada({ valor: String(valor) });
  }

  get valor() {
    return this.props.valor;
  }

  /** Categoria (`usuario`, `contato`) — permite filtrar sem enumerar as ações. */
  get categoria() {
    return this.props.valor.split('.')[0];
  }

  get descricao() {
    return DESCRICOES[this.props.valor] ?? this.props.valor;
  }

  toString() {
    return this.props.valor;
  }

  toJSON() {
    return this.props.valor;
  }
}

module.exports = { AcaoAuditada, ACOES, RESULTADOS, DESCRICOES };
