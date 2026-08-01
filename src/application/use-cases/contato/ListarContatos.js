'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { LIMITES } = require('../../../shared/constants');

/**
 * Listagem paginada dos contatos do usuário, com busca e filtros.
 *
 * A paginação é obrigatória, não opcional: sem ela a consulta cresce com a base
 * (achado ACH-014). O tamanho de página é limitado no servidor — aceitar
 * `?pageSize=100000` do cliente devolveria o controle do custo da query a quem
 * faz a requisição.
 *
 * Os filtros são normalizados AQUI, não no controller nem no repositório:
 * o controller não deve conhecer regra ("busca tem tamanho máximo") e o
 * repositório não deve receber entrada crua do usuário.
 */
class ListarContatos extends UseCase {
  constructor({ contatoRepository, logger }) {
    super({ logger });
    this.contatoRepository = contatoRepository;
  }

  async executar({ proprietarioId, pagina, tamanho, filtros }, { signal } = {}) {
    const paginaSegura = ListarContatos.#normalizarPagina(pagina);
    const tamanhoSeguro = ListarContatos.#normalizarTamanho(tamanho);
    const filtrosSeguros = ListarContatos.#normalizarFiltros(filtros);

    const { itens, total } = await this.contatoRepository.listarDoProprietario(
      proprietarioId,
      { pagina: paginaSegura, tamanho: tamanhoSeguro, filtros: filtrosSeguros },
      signal
    );

    return Result.ok({
      itens,
      total,
      pagina: paginaSegura,
      tamanho: tamanhoSeguro,
      totalDePaginas: Math.max(Math.ceil(total / tamanhoSeguro), 1),
      filtros: filtrosSeguros,
    });
  }

  static #normalizarPagina(valor) {
    const numero = Number.parseInt(valor, 10);
    return Number.isNaN(numero) || numero < 1 ? 1 : numero;
  }

  static #normalizarTamanho(valor) {
    const numero = Number.parseInt(valor, 10);
    if (Number.isNaN(numero)) return LIMITES.PAGINA_TAMANHO_PADRAO;
    return Math.min(Math.max(numero, 1), LIMITES.PAGINA_TAMANHO_MAX);
  }

  static #normalizarFiltros(filtros = {}) {
    const busca =
      typeof filtros.busca === 'string' ? filtros.busca.trim().slice(0, LIMITES.BUSCA_MAX) : '';

    // Mesma normalização do VO Etiquetas: sem ela, clicar numa etiqueta
    // "família" filtraria por uma string que nunca casa com o que foi salvo.
    const etiqueta =
      typeof filtros.etiqueta === 'string'
        ? filtros.etiqueta.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, LIMITES.ETIQUETA_MAX)
        : '';

    const favoritos =
      filtros.favoritos === true || filtros.favoritos === '1' || filtros.favoritos === 'on';

    return Object.freeze({
      busca,
      etiqueta,
      favoritos,
      ativos: Boolean(busca || etiqueta || favoritos),
    });
  }
}

module.exports = { ListarContatos };
