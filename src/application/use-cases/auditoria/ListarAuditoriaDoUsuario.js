'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { LIMITES } = require('../../../shared/constants');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');

const ACOES_VALIDAS = new Set(Object.values(ACOES));

/**
 * Trilha de atividades do próprio usuário.
 *
 * A mesma regra de propriedade que vale para contatos vale aqui: o
 * `usuarioId` vem da sessão e o repositório filtra por ele. Um usuário jamais
 * vê a trilha de outro — e a assinatura da porta não permite consulta sem
 * escopo de dono.
 *
 * Um painel administrativo com visão de toda a trilha exigiria um caso de uso
 * separado, com verificação de papel explícita. Não existe hoje, e é melhor que
 * não exista do que exista mal feito.
 */
class ListarAuditoriaDoUsuario extends UseCase {
  constructor({ auditoriaRepository, logger }) {
    super({ logger });
    this.auditoriaRepository = auditoriaRepository;
  }

  async executar({ usuarioId, pagina, tamanho, acao }, { signal } = {}) {
    // Ação desconhecida é ignorada em vez de virar erro: um filtro inválido na
    // query string não deve quebrar a página, apenas não filtrar.
    const acaoFiltrada = ACOES_VALIDAS.has(acao) ? acao : undefined;

    const paginaSegura = ListarAuditoriaDoUsuario.#normalizarPagina(pagina);
    const tamanhoSeguro = ListarAuditoriaDoUsuario.#normalizarTamanho(tamanho);

    const { itens, total } = await this.auditoriaRepository.listarDoUsuario(
      usuarioId,
      { pagina: paginaSegura, tamanho: tamanhoSeguro, acao: acaoFiltrada },
      signal
    );

    return Result.ok({
      itens,
      total,
      pagina: paginaSegura,
      tamanho: tamanhoSeguro,
      totalDePaginas: Math.max(Math.ceil(total / tamanhoSeguro), 1),
      acaoFiltrada: acaoFiltrada ?? null,
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
}

module.exports = { ListarAuditoriaDoUsuario };
