'use strict';

const { ContextoDeExecucao } = require('../../../shared/context/ContextoDeExecucao');

const MAX_USER_AGENT = 256;

/**
 * Abre o escopo do contexto de execução para a requisição.
 *
 * Precisa vir DEPOIS do `registroDeRequisicoes` (que gera o `requestId`) e
 * DEPOIS da sessão (que traz o `usuarioId`) — do contrário os dois chegariam
 * indefinidos ao contexto. A ordem está fixada em `aplicacao.js`.
 *
 * O `next()` roda dentro de `executarCom`, então tudo que acontece depois —
 * incluindo cadeias assíncronas dentro dos casos de uso — enxerga o contexto.
 *
 * Se um dia a autenticação virar JWT, muda só esta função: o `usuarioId`
 * passaria a vir da claim do token em vez da sessão. Nada além daqui sabe de
 * onde o valor veio.
 */
function contextoDeExecucao(req, res, next) {
  const contexto = {
    requestId: req.id,
    usuarioId: req.session?.user?.id,
    // `req.ip` só é confiável com `trust proxy` configurado — atrás de um ALB
    // sem isso, todo mundo teria o IP do balanceador registrado na trilha.
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, MAX_USER_AGENT),
  };

  ContextoDeExecucao.executarCom(contexto, () => next());
}

/**
 * Reabre o escopo com o `usuarioId` recém-descoberto.
 *
 * O contexto é criado no início da requisição, quando o login ainda não
 * aconteceu — durante `POST /login/login` o `usuarioId` é indefinido. Sem esta
 * função, o registro de "usuário autenticado" sairia sem dono.
 *
 * Cria um escopo novo em vez de mutar o atual: o contexto continua imutável.
 */
function comUsuarioAutenticado(usuarioId, callback) {
  return ContextoDeExecucao.enriquecerCom({ usuarioId }, callback);
}

module.exports = { contextoDeExecucao, comUsuarioAutenticado };
