'use strict';

/**
 * Traduz `Result` da aplicação em resposta HTTP.
 *
 * Concentrar isso aqui é o que mantém os controllers finos: sem este presenter,
 * cada handler repetiria o mesmo `if (result.isFailure) { flash; redirect }`,
 * e cada repetição é uma chance de divergir — na versão anterior, um dos
 * caminhos de sucesso esqueceu de aguardar `session.save()` e perdia a
 * mensagem flash de forma intermitente.
 *
 * O padrão POST/Redirect/GET é preservado: toda mutação bem-sucedida termina em
 * redirect, para que atualizar a página não reenvie o formulário.
 */
class RespostaHttp {
  /** Falhas de validação e de regra de negócio: pertencem ao formulário. */
  static STATUS_DE_FORMULARIO = Object.freeze(new Set([400, 401, 403, 409, 422]));

  /** Submissão de formulário: inclui 404 ("o registro sumiu enquanto você editava"). */
  static STATUS_DE_FORMULARIO_COM_AUSENCIA = Object.freeze(new Set([400, 401, 403, 404, 409, 422]));

  /**
   * Grava mensagens flash e redireciona, aguardando a persistência da sessão.
   *
   * O `session.save()` explícito não é decorativo: sem ele há corrida entre a
   * gravação da sessão e o redirect, e a mensagem se perde de vez em quando —
   * o tipo de bug que não reproduz em desenvolvimento.
   */
  static redirecionarComMensagem(req, res, { tipo, mensagens, destino }) {
    req.flash(tipo, mensagens);
    req.session.save(() => res.redirect(destino));
  }

  static sucesso(req, res, { mensagem, destino }) {
    RespostaHttp.redirecionarComMensagem(req, res, {
      tipo: 'success',
      mensagens: mensagem,
      destino,
    });
  }

  static falha(req, res, { erro, destino }) {
    RespostaHttp.redirecionarComMensagem(req, res, {
      tipo: 'errors',
      mensagens: erro.publicMessage,
      destino,
    });
  }

  /**
   * Despacha um Result para os caminhos de sucesso e falha.
   *
   * `statusParaFormulario` define quais falhas viram mensagem no formulário
   * (redirect + flash) e quais sobem para o tratamento global de erros.
   *
   * O padrão exclui 404 — uma navegação para um recurso inexistente deve
   * responder 404 de fato, não redirecionar. A submissão de formulário é a
   * exceção: ali o 404 significa "o registro sumiu enquanto você editava", e o
   * usuário precisa ver a mensagem no contexto do formulário, não uma página de
   * erro. Cada rota declara o que faz sentido para ela.
   */
  static despachar(
    result,
    {
      req,
      res,
      next,
      aoSucesso,
      destinoDeFalha,
      statusParaFormulario = RespostaHttp.STATUS_DE_FORMULARIO,
    }
  ) {
    return result.match({
      onSuccess: (valor) => aoSucesso(valor),
      onFailure: (erro) => {
        if (!destinoDeFalha || !statusParaFormulario.has(erro.status)) {
          return next(erro);
        }
        return RespostaHttp.falha(req, res, { erro, destino: destinoDeFalha });
      },
    });
  }
}

module.exports = { RespostaHttp };
