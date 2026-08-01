'use strict';

const { RespostaHttp } = require('../presenters/RespostaHttp');
const { rotacionarToken } = require('../middlewares/protecaoCsrf');
const { comUsuarioAutenticado } = require('../middlewares/contextoDeExecucao');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');

/**
 * Controller de autenticação.
 *
 * Regenerar a sessão e limpar o cookie são responsabilidades de transporte, não
 * de domínio — por isso vivem aqui e não no caso de uso. O caso de uso responde
 * "estas credenciais conferem?"; o que fazer com a sessão HTTP depois disso é
 * assunto da camada HTTP.
 */
class AutenticacaoController {
  #casosDeUso;
  #logger;

  #auditor;

  constructor({ cadastrarUsuario, autenticarUsuario, auditor, logger }) {
    this.#casosDeUso = { cadastrarUsuario, autenticarUsuario };
    this.#auditor = auditor;
    this.#logger = logger;

    this.index = this.index.bind(this);
    this.formularioDeCadastro = this.formularioDeCadastro.bind(this);
    this.cadastrar = this.cadastrar.bind(this);
    this.autenticar = this.autenticar.bind(this);
    this.encerrarSessao = this.encerrarSessao.bind(this);
  }

  index(req, res) {
    if (req.session.user) return res.render('login-logado');
    return res.render('login');
  }

  formularioDeCadastro(req, res) {
    if (req.session.user) return res.render('login-logado');
    return res.render('cadastro');
  }

  async cadastrar(req, res, next) {
    // Confirmação de senha é proteção de UX contra erro de digitação, não
    // regra de domínio — por isso vive na borda HTTP e só quando o campo
    // veio no formulário (clientes de API/testes não são obrigados a enviá-lo;
    // errar a própria confirmação não é vetor de ataque).
    const { password, confirmarSenha } = req.body ?? {};
    if (typeof confirmarSenha === 'string' && confirmarSenha !== password) {
      return RespostaHttp.redirecionarComMensagem(req, res, {
        tipo: 'errors',
        mensagens: ['As senhas não conferem. Digite a mesma senha nos dois campos.'],
        destino: '/cadastro',
      });
    }

    const result = await this.#casosDeUso.cadastrarUsuario.run(
      { email: req.body?.email, senha: req.body?.password },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      // Falha volta para a tela de cadastro — é lá que está o formulário.
      destinoDeFalha: '/cadastro',
      aoSucesso: () =>
        RespostaHttp.sucesso(req, res, {
          mensagem: 'Seu usuário foi criado com sucesso. Agora é só entrar.',
          destino: '/login/index',
        }),
    });
  }

  async autenticar(req, res, next) {
    const result = await this.#casosDeUso.autenticarUsuario.run(
      { email: req.body?.email, senha: req.body?.password },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      destinoDeFalha: '/login/index',
      aoSucesso: (usuarioDeSessao) => this.#estabelecerSessao(req, res, next, usuarioDeSessao),
    });
  }

  /**
   * Elevação de privilégio: emite um id de sessão novo.
   *
   * Sem `regenerate`, um id de sessão fixado antes do login continuaria válido
   * depois dele — session fixation. O token CSRF também é rotacionado, porque
   * ele estava atrelado à sessão anterior.
   */
  #estabelecerSessao(req, res, next, usuarioDeSessao) {
    return req.session.regenerate((erro) => {
      if (erro) return next(erro);

      req.session.user = usuarioDeSessao;
      rotacionarToken(req.session);

      // O contexto foi aberto no início da requisição, quando ainda não havia
      // usuário. Reabrir com o `usuarioId` faz com que qualquer log ou erro do
      // restante desta requisição saia atribuído a quem acabou de entrar.
      return comUsuarioAutenticado(usuarioDeSessao.id, () =>
        RespostaHttp.sucesso(req, res, {
          mensagem: 'Você entrou no sistema.',
          destino: '/',
        })
      );
    });
  }

  /**
   * Logout.
   *
   * A auditoria é registrada ANTES de destruir a sessão: depois disso o
   * contexto perde o `usuarioId` e o registro ficaria sem dono. O `await` é
   * necessário pelo mesmo motivo — disparar sem esperar correria com o
   * `destroy`.
   */
  async encerrarSessao(req, res, next) {
    const usuarioId = req.session.user?.id;

    if (usuarioId) {
      await this.#auditor.registrar({
        acao: ACOES.USUARIO_DESCONECTADO,
        usuarioId,
        recurso: 'usuario',
        recursoId: usuarioId,
      });
    }

    req.session.destroy((erro) => {
      if (erro) return next(erro);

      // Sem `clearCookie` o navegador continua enviando um id de sessão morto
      // em toda requisição seguinte.
      res.clearCookie(req.app.get('sessionCookieName'));
      this.#logger.info({ evento: EVENTOS_LOG.USUARIO_DESCONECTADO, usuarioId }, 'Logout efetuado');
      return res.redirect('/');
    });
  }
}

module.exports = { AutenticacaoController };
