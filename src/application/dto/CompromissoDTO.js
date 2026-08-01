'use strict';

const { DataHoraDeCompromisso } = require('../../domain/value-objects/DataHoraDeCompromisso');

const FUSO = 'America/Sao_Paulo';

/**
 * DTO de saída para compromisso.
 *
 * Toda a formatação de data/hora sai daqui, em um lugar só: a view não
 * conhece fuso nem formato, e os três formatos derivam do MESMO instante —
 * quando divergirem entre telas, o defeito estará em uma única classe.
 */
class CompromissoDTO {
  static deEntidade(compromisso) {
    const inicio = compromisso.inicioEm.valor;

    return Object.freeze({
      id: compromisso.id.valor,
      titulo: compromisso.titulo.valor,
      notas: compromisso.notas ?? '',
      contatoId: compromisso.contatoId?.valor ?? '',
      etiquetas: compromisso.etiquetas.toJSON(),
      etiquetasTexto: compromisso.etiquetas.texto,
      inicioEm: inicio,
      // "2026-08-15" — agrupa por dia no calendário.
      diaChave: inicio.toLocaleDateString('en-CA', { timeZone: FUSO }),
      // "15/08/2026 14:30" — listas.
      inicioFormatado: inicio.toLocaleString('pt-BR', {
        timeZone: FUSO,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      // "14:30" — células do calendário, onde o dia já está implícito.
      horaFormatada: inicio.toLocaleTimeString('pt-BR', {
        timeZone: FUSO,
        hour: '2-digit',
        minute: '2-digit',
      }),
      // Valor de <input type="datetime-local"> — formulário de edição.
      inicioParaFormulario: DataHoraDeCompromisso.paraCampoDeFormulario(inicio),
    });
  }

  static deLista(compromissos) {
    return compromissos.map(CompromissoDTO.deEntidade);
  }

  /** Formato vazio para o formulário de criação. */
  static vazio() {
    return Object.freeze({
      id: null,
      titulo: '',
      notas: '',
      contatoId: '',
      etiquetas: [],
      etiquetasTexto: '',
      inicioEm: null,
      diaChave: '',
      inicioFormatado: '',
      horaFormatada: '',
      inicioParaFormulario: '',
    });
  }
}

module.exports = { CompromissoDTO };
