'use strict';

const { ValueObject } = require('../../shared/domain/ValueObject');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');

/**
 * Data e hora de um compromisso.
 *
 * A entrada vem de um `<input type="datetime-local">`: "2026-08-15T14:30",
 * sem fuso. O produto é brasileiro e o fuso de referência é America/Sao_Paulo,
 * fixo em UTC-3 desde a abolição do horário de verão (2019) — por isso o
 * offset pode ser literal, sem tabela de DST. Internamente o valor vive como
 * `Date` UTC; a conversão para exibição acontece na view, com
 * `toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })`.
 *
 * Compromissos no passado são permitidos de propósito: a agenda também é
 * registro do que aconteceu, não só do que vai acontecer.
 */
const FORMATO_DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// O piso em 2020 não é arbitrário: o offset fixo -03:00 só é verdadeiro após
// a abolição do horário de verão (2019). Datas anteriores exigiriam a tabela
// histórica de DST — complexidade que uma agenda pessoal não justifica.
const ANO_MIN = 2020;
const ANO_MAX = 2100;

class DataHoraDeCompromisso extends ValueObject {
  static criar(entrada) {
    const texto = typeof entrada === 'string' ? entrada.trim() : '';
    if (!FORMATO_DATETIME_LOCAL.test(texto)) {
      return Result.fail(
        new ValidationError('Informe data e hora válidas para o compromisso.', {
          code: 'COMPROMISSO_DATA_INVALIDA',
        })
      );
    }

    // Intervalo verificado ANTES do parse: fora dele a premissa do offset
    // fixo não vale e a mensagem precisa dizer o motivo real.
    const ano = Number(texto.slice(0, 4));
    if (ano < ANO_MIN || ano > ANO_MAX) {
      return Result.fail(
        new ValidationError(`A data deve estar entre ${ANO_MIN} e ${ANO_MAX}.`, {
          code: 'COMPROMISSO_DATA_FORA_DO_INTERVALO',
        })
      );
    }

    const valor = new Date(`${texto}:00-03:00`);

    // `new Date` aceita "2026-02-31" deslizando para março — getTime vira
    // número válido. A checagem de ida-e-volta pega o deslize: refaz o texto
    // no mesmo fuso e compara com a entrada.
    if (Number.isNaN(valor.getTime()) || !DataHoraDeCompromisso.#confereIdaEVolta(texto, valor)) {
      return Result.fail(
        new ValidationError('Informe data e hora válidas para o compromisso.', {
          code: 'COMPROMISSO_DATA_INVALIDA',
        })
      );
    }

    return Result.ok(new DataHoraDeCompromisso({ valor }));
  }

  static #confereIdaEVolta(entrada, data) {
    return DataHoraDeCompromisso.paraCampoDeFormulario(data) === entrada.trim();
  }

  static deConfianca(valor) {
    return new DataHoraDeCompromisso({ valor: new Date(valor) });
  }

  /** Formata um Date de volta para o valor de um datetime-local em SP. */
  static paraCampoDeFormulario(data) {
    // en-CA produz YYYY-MM-DD; a hora sai em 24h. É o inverso exato do parse.
    const dia = data.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const hora = data.toLocaleTimeString('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dia}T${hora}`;
  }

  /** @returns {Date} */
  get valor() {
    return new Date(this.props.valor);
  }

  toJSON() {
    return this.props.valor.toISOString();
  }
}

module.exports = { DataHoraDeCompromisso };
