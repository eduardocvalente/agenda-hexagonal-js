'use strict';

const { RespostaHttp } = require('../presenters/RespostaHttp');
const { ContatoCSV } = require('../presenters/ContatoCSV');
const { ContatoDTO } = require('../../../application/dto/ContatoDTO');
const { UsuarioId } = require('../../../domain/value-objects/Identificador');

/**
 * Controller de contatos.
 *
 * Responsabilidade única e literal: extrair dados do HTTP, chamar o caso de
 * uso, entregar o Result ao presenter. Não há `if` de regra de negócio, não há
 * acesso a banco, não há construção de entidade.
 *
 * O `proprietarioId` sai SEMPRE da sessão, nunca do corpo — é o que fecha a
 * porta ao mass assignment que permitiria escrever na agenda de outra pessoa.
 */
class ContatoController {
  #casosDeUso;

  constructor({
    criarContato,
    editarContato,
    removerContato,
    obterContato,
    alternarFavorito,
    exportarContatos,
    listarEtiquetasDoUsuario,
  }) {
    this.#casosDeUso = {
      criarContato,
      editarContato,
      removerContato,
      obterContato,
      alternarFavorito,
      exportarContatos,
      listarEtiquetasDoUsuario,
    };

    // Preserva o `this` ao passar os métodos direto para o router do Express.
    this.formularioNovo = this.formularioNovo.bind(this);
    this.criar = this.criar.bind(this);
    this.formularioEdicao = this.formularioEdicao.bind(this);
    this.editar = this.editar.bind(this);
    this.remover = this.remover.bind(this);
    this.favoritar = this.favoritar.bind(this);
    this.exportar = this.exportar.bind(this);
  }

  async formularioNovo(req, res, next) {
    return this.#renderizarFormulario(req, res, next, ContatoDTO.vazio());
  }

  /** O formulário recebe as etiquetas já usadas — sugestões do seletor. */
  async #renderizarFormulario(req, res, next, contato) {
    const etiquetasResult = await this.#casosDeUso.listarEtiquetasDoUsuario.run(
      { proprietarioId: UsuarioId.deConfianca(req.session.user.id) },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(etiquetasResult, {
      req,
      res,
      next,
      aoSucesso: (etiquetasDisponiveis) => res.render('contato', { contato, etiquetasDisponiveis }),
    });
  }

  async criar(req, res, next) {
    const result = await this.#casosDeUso.criarContato.run(
      {
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
        dados: req.body,
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      destinoDeFalha: '/contato/index',
      aoSucesso: (contato) =>
        RespostaHttp.sucesso(req, res, {
          mensagem: 'Contato registrado com sucesso.',
          destino: `/contato/index/${contato.id.valor}`,
        }),
    });
  }

  async formularioEdicao(req, res, next) {
    const result = await this.#casosDeUso.obterContato.run(
      {
        contatoId: req.params.id,
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: (contato) =>
        this.#renderizarFormulario(req, res, next, ContatoDTO.deEntidade(contato)),
    });
  }

  async editar(req, res, next) {
    const result = await this.#casosDeUso.editarContato.run(
      {
        contatoId: req.params.id,
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
        dados: req.body,
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      destinoDeFalha: '/contato/index',
      // Editar um contato inexistente ou de outro dono devolve o usuário ao
      // formulário com o aviso, e não uma página 404 — comportamento preservado
      // da versão anterior.
      statusParaFormulario: RespostaHttp.STATUS_DE_FORMULARIO_COM_AUSENCIA,
      aoSucesso: (contato) =>
        RespostaHttp.sucesso(req, res, {
          mensagem: 'Contato editado com sucesso.',
          destino: `/contato/index/${contato.id.valor}`,
        }),
    });
  }

  async exportar(req, res, next) {
    const result = await this.#casosDeUso.exportarContatos.run(
      { proprietarioId: UsuarioId.deConfianca(req.session.user.id) },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: (contatos) => {
        // Download nunca deve ficar em cache compartilhado: é dado pessoal.
        res.setHeader('Cache-Control', 'private, no-store');

        if (req.query.formato === 'json') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="contatos.json"');
          return res.send(JSON.stringify(ContatoDTO.deLista(contatos), null, 2));
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="contatos.csv"');
        return res.send(ContatoCSV.gerar(contatos));
      },
    });
  }

  async favoritar(req, res, next) {
    const result = await this.#casosDeUso.alternarFavorito.run(
      {
        contatoId: req.params.id,
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: (contato) =>
        RespostaHttp.sucesso(req, res, {
          mensagem: contato.favorito
            ? 'Contato marcado como favorito.'
            : 'Contato removido dos favoritos.',
          destino: '/',
        }),
    });
  }

  async remover(req, res, next) {
    const result = await this.#casosDeUso.removerContato.run(
      {
        contatoId: req.params.id,
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: () =>
        RespostaHttp.sucesso(req, res, {
          mensagem: 'Contato apagado com sucesso.',
          destino: '/',
        }),
    });
  }
}

module.exports = { ContatoController };
