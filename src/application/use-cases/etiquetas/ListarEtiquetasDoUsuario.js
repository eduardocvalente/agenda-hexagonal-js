'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');

/**
 * Etiquetas distintas do usuário, unificando contatos e compromissos.
 *
 * Alimenta as sugestões do seletor de etiquetas: quem etiquetou um contato
 * como "trabalho" vê a mesma sugestão ao etiquetar um compromisso — o
 * vocabulário é da PESSOA, não do tipo de registro.
 */
class ListarEtiquetasDoUsuario extends UseCase {
  constructor({ contatoRepository, compromissoRepository, logger }) {
    super({ logger });
    this.contatoRepository = contatoRepository;
    this.compromissoRepository = compromissoRepository;
  }

  async executar({ proprietarioId }, { signal } = {}) {
    const [deContatos, deCompromissos] = await Promise.all([
      this.contatoRepository.listarEtiquetasDoProprietario(proprietarioId, signal),
      this.compromissoRepository.listarEtiquetasDoProprietario(proprietarioId, signal),
    ]);

    const unicas = [...new Set([...deContatos, ...deCompromissos])].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );

    return Result.ok(unicas);
  }
}

module.exports = { ListarEtiquetasDoUsuario };
