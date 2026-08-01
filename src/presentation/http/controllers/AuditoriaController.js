'use strict';

const { RespostaHttp } = require('../presenters/RespostaHttp');
const { RegistroDeAuditoriaDTO } = require('../../../application/dto/RegistroDeAuditoriaDTO');
const { UsuarioId } = require('../../../domain/value-objects/Identificador');
const { DESCRICOES } = require('../../../domain/value-objects/AcaoAuditada');

/**
 * Trilha de atividades do próprio usuário.
 *
 * `proprietarioId` sai da sessão, como em todo o resto do sistema — não há
 * parâmetro de rota nem de query que permita consultar a trilha de outra
 * pessoa.
 */
class AuditoriaController {
  #listarAuditoria;

  constructor({ listarAuditoriaDoUsuario }) {
    this.#listarAuditoria = listarAuditoriaDoUsuario;
    this.index = this.index.bind(this);
  }

  async index(req, res, next) {
    const result = await this.#listarAuditoria.run(
      {
        usuarioId: UsuarioId.deConfianca(req.session.user.id),
        pagina: req.query.page,
        acao: req.query.acao,
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: ({ itens, pagina, totalDePaginas, total, acaoFiltrada }) =>
        res.render('auditoria', {
          registros: RegistroDeAuditoriaDTO.deLista(itens),
          paginacao: { page: pagina, totalPages: totalDePaginas, total },
          acaoFiltrada,
          acoesDisponiveis: DESCRICOES,
        }),
    });
  }
}

module.exports = { AuditoriaController };
