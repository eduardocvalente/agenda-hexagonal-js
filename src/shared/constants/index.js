'use strict';

/**
 * Constantes de domínio e de protocolo em um só lugar.
 *
 * Números soltos no código ("magic numbers") escondem decisões: `12` no meio de
 * uma chamada de bcrypt não diz que é um parâmetro de segurança revisável.
 */

const LIMITES = Object.freeze({
  EMAIL_MAX: 254, // RFC 5321: comprimento máximo de um endereço de e-mail
  SENHA_MIN: 12,
  SENHA_MAX: 128, // acima disso o bcrypt trunca; recusar é melhor que truncar em silêncio
  NOME_MAX: 120,
  SOBRENOME_MAX: 120,
  TELEFONE_MAX: 30,
  ETIQUETA_MAX: 30,
  ETIQUETAS_POR_CONTATO_MAX: 10,
  BUSCA_MAX: 120,
  TITULO_COMPROMISSO_MAX: 120,
  NOTAS_COMPROMISSO_MAX: 500,
  PAGINA_TAMANHO_PADRAO: 20,
  PAGINA_TAMANHO_MAX: 100,
});

const TEMPOS = Object.freeze({
  TIMEOUT_CONSULTA_MS: 5_000,
  TIMEOUT_ESCRITA_MS: 10_000,
  TIMEOUT_REQUISICAO_MS: 30_000,
});

const EVENTOS_LOG = Object.freeze({
  USUARIO_CADASTRADO: 'usuario.cadastrado',
  USUARIO_AUTENTICADO: 'usuario.autenticado',
  AUTENTICACAO_FALHOU: 'usuario.autenticacao_falhou',
  USUARIO_DESCONECTADO: 'usuario.desconectado',
  CONTATO_CRIADO: 'contato.criado',
  CONTATO_EDITADO: 'contato.editado',
  CONTATO_REMOVIDO: 'contato.removido',
  CONTATO_FAVORITO_ALTERNADO: 'contato.favorito_alternado',
  COMPROMISSO_CRIADO: 'compromisso.criado',
  COMPROMISSO_EDITADO: 'compromisso.editado',
  COMPROMISSO_REMOVIDO: 'compromisso.removido',
  REQUISICAO_CANCELADA: 'requisicao.cancelada',
});

module.exports = { LIMITES, TEMPOS, EVENTOS_LOG };
