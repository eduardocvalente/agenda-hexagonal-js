'use strict';

const { RespostaHttp } = require('../presenters/RespostaHttp');
const { CompromissoDTO } = require('../../../application/dto/CompromissoDTO');
const { ContatoDTO } = require('../../../application/dto/ContatoDTO');
const { UsuarioId } = require('../../../domain/value-objects/Identificador');

const FUSO = 'America/Sao_Paulo';
const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Controller de compromissos e do calendário.
 *
 * A grade mensal é montada AQUI, não na view: EJS com laço de datas vira
 * lógica ilegível dentro de template. O controller entrega `semanas` já no
 * formato exato de renderização (células com dia, compromissos e flag de
 * hoje), e a view apenas percorre.
 */
class CompromissoController {
  #casosDeUso;

  constructor({
    criarCompromisso,
    editarCompromisso,
    removerCompromisso,
    obterCompromisso,
    listarCalendarioDoUsuario,
    listarContatos,
    listarEtiquetasDoUsuario,
  }) {
    this.#casosDeUso = {
      criarCompromisso,
      editarCompromisso,
      removerCompromisso,
      obterCompromisso,
      listarCalendarioDoUsuario,
      listarContatos,
      listarEtiquetasDoUsuario,
    };

    this.calendario = this.calendario.bind(this);
    this.formularioNovo = this.formularioNovo.bind(this);
    this.criar = this.criar.bind(this);
    this.formularioEdicao = this.formularioEdicao.bind(this);
    this.editar = this.editar.bind(this);
    this.remover = this.remover.bind(this);
  }

  async calendario(req, res, next) {
    const result = await this.#casosDeUso.listarCalendarioDoUsuario.run(
      {
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
        mes: req.query.mes,
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: ({ ano, numeroDoMes, compromissos, proximos, mesAnterior, mesSeguinte }) => {
        const dtos = CompromissoDTO.deLista(compromissos);
        const hojeChave = new Date().toLocaleDateString('en-CA', { timeZone: FUSO });

        return res.render('calendario', {
          tituloDoMes: CompromissoController.#tituloDoMes(ano, numeroDoMes),
          semanas: CompromissoController.#montarSemanas(ano, numeroDoMes, dtos, hojeChave),
          diasDaSemana: DIAS_DA_SEMANA,
          totalNoMes: dtos.length,
          proximos: CompromissoDTO.deLista(proximos),
          mesAnterior,
          mesSeguinte,
        });
      },
    });
  }

  async formularioNovo(req, res, next) {
    return this.#renderizarFormulario(req, res, next, CompromissoDTO.vazio());
  }

  async criar(req, res, next) {
    const result = await this.#casosDeUso.criarCompromisso.run(
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
      destinoDeFalha: '/compromisso/index',
      aoSucesso: () =>
        RespostaHttp.sucesso(req, res, {
          mensagem: 'Compromisso registrado com sucesso.',
          destino: '/calendario',
        }),
    });
  }

  async formularioEdicao(req, res, next) {
    const result = await this.#casosDeUso.obterCompromisso.run(
      {
        compromissoId: req.params.id,
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      aoSucesso: (compromisso) =>
        this.#renderizarFormulario(req, res, next, CompromissoDTO.deEntidade(compromisso)),
    });
  }

  async editar(req, res, next) {
    const result = await this.#casosDeUso.editarCompromisso.run(
      {
        compromissoId: req.params.id,
        proprietarioId: UsuarioId.deConfianca(req.session.user.id),
        dados: req.body,
      },
      { signal: req.signal }
    );

    return RespostaHttp.despachar(result, {
      req,
      res,
      next,
      destinoDeFalha: '/compromisso/index',
      statusParaFormulario: RespostaHttp.STATUS_DE_FORMULARIO_COM_AUSENCIA,
      aoSucesso: () =>
        RespostaHttp.sucesso(req, res, {
          mensagem: 'Compromisso editado com sucesso.',
          destino: '/calendario',
        }),
    });
  }

  async remover(req, res, next) {
    const result = await this.#casosDeUso.removerCompromisso.run(
      {
        compromissoId: req.params.id,
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
          mensagem: 'Compromisso apagado com sucesso.',
          destino: '/calendario',
        }),
    });
  }

  /** Formulário precisa dos contatos (vínculo) e das etiquetas (sugestões). */
  async #renderizarFormulario(req, res, next, compromisso) {
    const proprietarioId = UsuarioId.deConfianca(req.session.user.id);

    const [contatosResult, etiquetasResult] = await Promise.all([
      this.#casosDeUso.listarContatos.run(
        { proprietarioId, pagina: 1, tamanho: 100 },
        { signal: req.signal }
      ),
      this.#casosDeUso.listarEtiquetasDoUsuario.run({ proprietarioId }, { signal: req.signal }),
    ]);

    return RespostaHttp.despachar(contatosResult, {
      req,
      res,
      next,
      aoSucesso: ({ itens }) =>
        res.render('compromisso', {
          compromisso,
          contatos: ContatoDTO.deLista(itens),
          etiquetasDisponiveis: etiquetasResult.isSuccess ? etiquetasResult.value : [],
        }),
    });
  }

  static #tituloDoMes(ano, numeroDoMes) {
    const rotulo = new Date(Date.UTC(ano, numeroDoMes - 1, 15)).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: FUSO,
    });
    return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
  }

  static #montarSemanas(ano, numeroDoMes, compromissos, hojeChave) {
    const mes = String(numeroDoMes).padStart(2, '0');

    const porDia = new Map();
    for (const compromisso of compromissos) {
      const dia = Number(compromisso.diaChave.split('-')[2]);
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia).push(compromisso);
    }

    // À meia-noite de SP são 03:00 UTC do MESMO dia — getUTCDay devolve o dia
    // da semana correto sem biblioteca de fuso.
    const primeiroDiaDaSemana = new Date(`${ano}-${mes}-01T00:00:00-03:00`).getUTCDay();
    const diasNoMes = new Date(Date.UTC(ano, numeroDoMes, 0)).getUTCDate();

    const celulas = [];
    for (let i = 0; i < primeiroDiaDaSemana; i += 1) celulas.push(null);
    for (let dia = 1; dia <= diasNoMes; dia += 1) {
      const chave = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
      celulas.push({
        dia,
        hoje: chave === hojeChave,
        compromissos: porDia.get(dia) ?? [],
      });
    }
    while (celulas.length % 7 !== 0) celulas.push(null);

    const semanas = [];
    for (let i = 0; i < celulas.length; i += 7) {
      semanas.push(celulas.slice(i, i + 7));
    }
    return semanas;
  }
}

module.exports = { CompromissoController };
