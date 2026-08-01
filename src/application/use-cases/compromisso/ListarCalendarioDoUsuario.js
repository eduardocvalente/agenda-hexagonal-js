'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');

/**
 * Dados da tela de calendário: os compromissos do mês pedido e os próximos.
 *
 * O mês chega como "AAAA-MM" (query string); qualquer valor fora do formato
 * cai no mês corrente em vez de virar erro — um filtro inválido na URL não
 * deve quebrar a página, mesma política do filtro de auditoria.
 *
 * A janela do mês é calculada no fuso de referência do produto (UTC-3), o
 * mesmo usado no parse do formulário: um compromisso às 23h do dia 31 pertence
 * ao mês em que o usuário o vê, não ao mês seguinte em UTC.
 */
const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const PROXIMOS_NO_CALENDARIO = 8;

class ListarCalendarioDoUsuario extends UseCase {
  constructor({ compromissoRepository, logger }) {
    super({ logger });
    this.compromissoRepository = compromissoRepository;
  }

  async executar({ proprietarioId, mes, agora }, { signal } = {}) {
    const referencia = agora instanceof Date ? agora : new Date();
    const { ano, numeroDoMes } = ListarCalendarioDoUsuario.#normalizarMes(mes, referencia);

    const inicio = ListarCalendarioDoUsuario.#inicioDoMes(ano, numeroDoMes);
    const fim = ListarCalendarioDoUsuario.#inicioDoMes(
      numeroDoMes === 12 ? ano + 1 : ano,
      numeroDoMes === 12 ? 1 : numeroDoMes + 1
    );

    const [doMes, proximos] = await Promise.all([
      this.compromissoRepository.listarDoProprietarioEntre(proprietarioId, { inicio, fim }, signal),
      this.compromissoRepository.listarProximosDoProprietario(
        proprietarioId,
        { aPartirDe: referencia, limite: PROXIMOS_NO_CALENDARIO },
        signal
      ),
    ]);

    return Result.ok({
      ano,
      numeroDoMes,
      compromissos: doMes,
      proximos,
      mesAnterior: ListarCalendarioDoUsuario.#rotuloDeMes(ano, numeroDoMes, -1),
      mesSeguinte: ListarCalendarioDoUsuario.#rotuloDeMes(ano, numeroDoMes, +1),
    });
  }

  static #normalizarMes(mes, referencia) {
    if (typeof mes === 'string' && FORMATO_MES.test(mes.trim())) {
      const [ano, numeroDoMes] = mes.trim().split('-').map(Number);
      return { ano, numeroDoMes };
    }

    // Mês corrente no fuso do produto, não no do servidor (que roda em UTC).
    const chave = referencia.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const [ano, numeroDoMes] = chave.split('-').map(Number);
    return { ano, numeroDoMes };
  }

  static #inicioDoMes(ano, numeroDoMes) {
    const mes = String(numeroDoMes).padStart(2, '0');
    return new Date(`${ano}-${mes}-01T00:00:00-03:00`);
  }

  static #rotuloDeMes(ano, numeroDoMes, deslocamento) {
    const total = ano * 12 + (numeroDoMes - 1) + deslocamento;
    const anoNovo = Math.floor(total / 12);
    const mesNovo = (total % 12) + 1;
    return `${anoNovo}-${String(mesNovo).padStart(2, '0')}`;
  }
}

module.exports = { ListarCalendarioDoUsuario };
