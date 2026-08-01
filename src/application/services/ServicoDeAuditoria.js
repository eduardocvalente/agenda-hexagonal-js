'use strict';

const { RegistroDeAuditoria } = require('../../domain/entities/RegistroDeAuditoria');
const { AcaoAuditada, RESULTADOS } = require('../../domain/value-objects/AcaoAuditada');
const { UsuarioId } = require('../../domain/value-objects/Identificador');
const { ContextoDeExecucao } = require('../../shared/context/ContextoDeExecucao');

/**
 * Emissor da trilha de auditoria.
 *
 * É aqui que a injeção de contexto se paga: `requestId`, `ip` e `userAgent`
 * vêm do `ContextoDeExecucao`, não de parâmetros. Um caso de uso que registra
 * uma ação escreve apenas o que é do negócio — quem, o quê, sobre qual recurso.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DECISÃO IMPORTANTE — falha de auditoria NÃO derruba a operação.
 *
 * `registrar` nunca lança e nunca devolve erro ao chamador. Se o banco recusar
 * a gravação, o evento é logado em nível `error` e a operação de negócio segue.
 *
 * É um trade-off explícito, não descuido:
 *   • a favor: um problema na collection de auditoria não pode impedir o
 *     usuário de criar um contato;
 *   • contra: em caso de falha, existe uma ação sem registro correspondente.
 *
 * Para auditoria de conformidade — em que a ausência de registro invalida a
 * operação — isso é insuficiente: seria preciso gravar na mesma transação ou
 * usar o padrão Outbox. Este sistema não tem esse requisito, e a escolha está
 * registrada no ADR-0010 para que possa ser revista quando tiver.
 * ────────────────────────────────────────────────────────────────────────────
 */
class ServicoDeAuditoria {
  #auditoriaRepository;
  #logger;

  constructor({ auditoriaRepository, logger }) {
    this.#auditoriaRepository = auditoriaRepository;
    this.#logger = logger;
  }

  /**
   * @param {object} params
   * @param {string} params.acao          valor de ACOES
   * @param {string} [params.usuarioId]   omitido, usa o do contexto
   * @param {string} [params.resultado]   'sucesso' | 'falha'
   * @param {string} [params.recurso]     tipo do recurso afetado ('contato')
   * @param {string} [params.recursoId]   identificador do recurso
   * @param {object} [params.detalhes]    dados extras — sanitizados na entidade
   */
  async registrar({
    acao,
    usuarioId,
    resultado = RESULTADOS.SUCESSO,
    recurso = null,
    recursoId = null,
    detalhes = {},
  }) {
    try {
      const contexto = ContextoDeExecucao.atual();
      const idDoUsuario = usuarioId ?? contexto.usuarioId;

      // Sem usuário identificado não há trilha a escrever: o registro não teria
      // dono, não poderia ser devolvido a ninguém e violaria a invariante da
      // entidade. Ver ADR-0010 para o caso do login com e-mail inexistente.
      if (!idDoUsuario) {
        this.#logger.debug(
          { evento: 'auditoria.sem_usuario', acao },
          'Ação sem usuário identificado — nada registrado na trilha'
        );
        return;
      }

      const acaoResult = AcaoAuditada.criar(acao);
      if (acaoResult.isFailure) {
        this.#logger.error(
          { evento: 'auditoria.acao_invalida', acao },
          'Tentativa de registrar ação desconhecida'
        );
        return;
      }

      const registroResult = RegistroDeAuditoria.criar({
        id: this.#auditoriaRepository.proximoId(),
        usuarioId: UsuarioId.deConfianca(idDoUsuario),
        acao: acaoResult.value,
        resultado,
        recurso,
        recursoId,
        detalhes,
        requestId: contexto.requestId ?? null,
        ip: contexto.ip ?? null,
        userAgent: contexto.userAgent ?? null,
      });

      if (registroResult.isFailure) {
        this.#logger.error(
          { evento: 'auditoria.registro_invalido', acao, err: registroResult.error },
          'Registro de auditoria inválido'
        );
        return;
      }

      const persistencia = await this.#auditoriaRepository.registrar(registroResult.value);
      if (persistencia.isFailure) {
        // `error`, não `warn`: perder trilha é problema operacional real e
        // precisa aparecer no alarme de erros da aplicação.
        this.#logger.error(
          { evento: 'auditoria.falha_ao_gravar', acao, err: persistencia.error },
          'Ação executada mas NÃO registrada na trilha de auditoria'
        );
      }
    } catch (erro) {
      // Rede de segurança final: nada que aconteça aqui pode escapar para o
      // caso de uso e transformar auditoria em causa de falha de negócio.
      this.#logger.error(
        { evento: 'auditoria.excecao', acao, err: erro },
        'Exceção inesperada ao auditar'
      );
    }
  }

  /** Atalho para o caminho de falha, que é o mais fácil de esquecer. */
  async registrarFalha({ acao, usuarioId, recurso, recursoId, detalhes }) {
    return this.registrar({
      acao,
      usuarioId,
      resultado: RESULTADOS.FALHA,
      recurso,
      recursoId,
      detalhes,
    });
  }
}

module.exports = { ServicoDeAuditoria };
