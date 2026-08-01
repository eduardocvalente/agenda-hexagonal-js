'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');

/**
 * Visão geral da conta: números da agenda + atividade recente.
 *
 * É um caso de uso de leitura pura que compõe duas portas. A composição mora
 * AQUI, não no controller: o dia em que o painel ganhar uma terceira fonte
 * (compromissos, por exemplo), o controller não muda uma linha.
 */
class ObterPainelDoUsuario extends UseCase {
  static ATIVIDADES_NO_PAINEL = 6;
  static COMPROMISSOS_NO_PAINEL = 5;

  constructor({ contatoRepository, compromissoRepository, auditoriaRepository, logger }) {
    super({ logger });
    this.contatoRepository = contatoRepository;
    this.compromissoRepository = compromissoRepository;
    this.auditoriaRepository = auditoriaRepository;
  }

  async executar({ proprietarioId, agora }, { signal } = {}) {
    const referencia = agora instanceof Date ? agora : new Date();

    const [resumo, atividade, compromissosFuturos, proximosCompromissos] = await Promise.all([
      this.contatoRepository.resumirDoProprietario(proprietarioId, signal),
      this.auditoriaRepository.listarDoUsuario(
        proprietarioId,
        { pagina: 1, tamanho: ObterPainelDoUsuario.ATIVIDADES_NO_PAINEL },
        signal
      ),
      this.compromissoRepository.contarAPartirDe(proprietarioId, referencia, signal),
      this.compromissoRepository.listarProximosDoProprietario(
        proprietarioId,
        { aPartirDe: referencia, limite: ObterPainelDoUsuario.COMPROMISSOS_NO_PAINEL },
        signal
      ),
    ]);

    return Result.ok({
      totalDeContatos: resumo.totalDeContatos,
      totalDeFavoritos: resumo.totalDeFavoritos,
      porEtiqueta: resumo.porEtiqueta,
      recentes: resumo.recentes,
      atividadeRecente: atividade.itens,
      compromissosFuturos,
      proximosCompromissos,
    });
  }
}

module.exports = { ObterPainelDoUsuario };
