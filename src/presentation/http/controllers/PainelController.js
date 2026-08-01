'use strict';

const { RespostaHttp } = require('../presenters/RespostaHttp');
const { ContatoDTO } = require('../../../application/dto/ContatoDTO');
const { CompromissoDTO } = require('../../../application/dto/CompromissoDTO');
const { RegistroDeAuditoriaDTO } = require('../../../application/dto/RegistroDeAuditoriaDTO');
const { UsuarioId } = require('../../../domain/value-objects/Identificador');

/**
 * Painel "Visão geral" — números da agenda e atividade recente.
 *
 * Como em todo o sistema, o dono sai da sessão; não existe parâmetro que
 * permita ver o painel de outra conta.
 */
class PainelController {
  #obterPainel;

  constructor({ obterPainelDoUsuario }) {
    this.#obterPainel = obterPainelDoUsuario;
    this.index = this.index.bind(this);
  }

  async index(req, res, next) {
    const result = await this.#obterPainel.run(
      { proprietarioId: UsuarioId.deConfianca(req.session.user.id) },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: (painel) => {
        const maiorTotalDeEtiqueta = painel.porEtiqueta.reduce(
          (maior, grupo) => Math.max(maior, grupo.total),
          0
        );

        return res.render('painel', {
          totais: {
            contatos: painel.totalDeContatos,
            favoritos: painel.totalDeFavoritos,
            etiquetas: painel.porEtiqueta.length,
            compromissos: painel.compromissosFuturos,
          },
          porEtiqueta: painel.porEtiqueta,
          // Pré-calculado para a view desenhar barras proporcionais sem regra.
          maiorTotalDeEtiqueta,
          recentes: ContatoDTO.deLista(painel.recentes),
          proximosCompromissos: CompromissoDTO.deLista(painel.proximosCompromissos),
          atividadeRecente: RegistroDeAuditoriaDTO.deLista(painel.atividadeRecente),
        });
      },
    });
  }
}

module.exports = { PainelController };
