'use strict';

const { RespostaHttp } = require('../presenters/RespostaHttp');
const { ContatoDTO } = require('../../../application/dto/ContatoDTO');
const { UsuarioId } = require('../../../domain/value-objects/Identificador');

/**
 * Página inicial — a agenda do usuário.
 *
 * Visitante anônimo não dispara consulta alguma: além de correto em segurança
 * (a versão anterior listava a base inteira para qualquer um), evita ida ao
 * banco no endpoint mais acessado do site.
 */
class AgendaController {
  #listarContatos;

  constructor({ listarContatos }) {
    this.#listarContatos = listarContatos;
    this.index = this.index.bind(this);
  }

  async index(req, res, next) {
    if (!req.session.user) {
      return res.render('index', {
        contatos: null,
        paginacao: null,
        filtros: null,
        sufixoDeQuery: '',
      });
    }

    const result = await this.#listarContatos.run(
      {
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
        pagina: req.query.page,
        filtros: {
          busca: req.query.q,
          etiqueta: req.query.etiqueta,
          favoritos: req.query.favoritos,
        },
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: ({ itens, pagina, totalDePaginas, total, filtros }) => {
        // Sufixo pronto para os links de paginação: trocar de página não pode
        // descartar a busca ativa. Montado aqui para a view não concatenar URL.
        const query = new URLSearchParams();
        if (filtros.busca) query.set('q', filtros.busca);
        if (filtros.etiqueta) query.set('etiqueta', filtros.etiqueta);
        if (filtros.favoritos) query.set('favoritos', '1');
        const sufixoDeQuery = query.toString() ? `&${query.toString()}` : '';

        return res.render('index', {
          contatos: ContatoDTO.deLista(itens),
          paginacao: { page: pagina, totalPages: totalDePaginas, total },
          filtros,
          sufixoDeQuery,
        });
      },
    });
  }
}

module.exports = { AgendaController };
