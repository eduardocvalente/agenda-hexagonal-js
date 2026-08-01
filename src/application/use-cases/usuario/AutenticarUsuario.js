'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { UnauthorizedError } = require('../../../shared/errors');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { Email } = require('../../../domain/value-objects/Email');
const { SenhaEmTexto } = require('../../../domain/value-objects/SenhaEmTexto');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');

/** Mensagem única para toda falha de autenticação — ver comentário abaixo. */
const FALHA_GENERICA = 'E-mail ou senha inválidos.';

/**
 * Autenticação.
 *
 * Duas defesas contra enumeração de contas, e as duas são necessárias:
 *
 *  1. **Mesma mensagem** para e-mail inexistente e senha errada. Sozinha,
 *     é insuficiente.
 *  2. **Mesmo tempo de resposta.** Quando o e-mail não existe não há hash para
 *     comparar, e a resposta voltaria ~100 ms mais cedo — a diferença de
 *     latência revela a existência da conta mesmo com mensagens idênticas.
 *     `consumirTempoEquivalente` fecha esse canal.
 *
 * O caso de uso não sabe que o algoritmo é bcrypt; pede à porta que gaste o
 * tempo equivalente. Trocar por argon2 não muda uma linha aqui.
 */
class AutenticarUsuario extends UseCase {
  constructor({ usuarioRepository, servicoDeHash, auditor, logger }) {
    super({ logger });
    this.usuarioRepository = usuarioRepository;
    this.servicoDeHash = servicoDeHash;
    this.auditor = auditor;
  }

  async executar({ email, senha }, { signal } = {}) {
    const emailResult = Email.criar(email);
    const senhaResult = SenhaEmTexto.paraVerificacao(senha);

    // Entrada malformada também recebe a resposta genérica: dizer "e-mail
    // inválido" versus "credenciais inválidas" é mais um bit de informação.
    if (emailResult.isFailure || senhaResult.isFailure) {
      return this.#falhar({ motivo: 'entrada_invalida' });
    }

    throwIfAborted(signal, { casoDeUso: 'AutenticarUsuario', etapa: 'antes-da-busca' });

    const usuario = await this.usuarioRepository.buscarPorEmail(emailResult.value, signal);

    if (!usuario) {
      await this.servicoDeHash.consumirTempoEquivalente(senhaResult.value, signal);
      // Sem registro de auditoria de propósito: não há usuário a quem a trilha
      // pertença, e gravar o e-mail tentado construiria uma base de "endereços
      // que alguém tentou" — um artefato sensível criado pela própria defesa.
      // Ver ADR-0010.
      return this.#falhar({ motivo: 'usuario_inexistente' });
    }

    const confere = await this.servicoDeHash.verificar(
      senhaResult.value,
      usuario.credencial,
      signal
    );

    if (!confere) {
      // Aqui SIM há registro: a conta existe, e "alguém tentou entrar na sua
      // conta e errou a senha" é exatamente o que o dono precisa ver na trilha.
      await this.auditor.registrarFalha({
        acao: ACOES.AUTENTICACAO_RECUSADA,
        usuarioId: usuario.id.valor,
        recurso: 'usuario',
        recursoId: usuario.id.valor,
        detalhes: { motivo: 'senha_incorreta' },
      });
      return this.#falhar({ motivo: 'senha_incorreta', usuarioId: usuario.id.valor });
    }

    await this.#reforcarHashSeNecessario(usuario, senhaResult.value, signal);

    this.logger.info(
      { evento: EVENTOS_LOG.USUARIO_AUTENTICADO, usuarioId: usuario.id.valor },
      'Login efetuado'
    );

    await this.auditor.registrar({
      acao: ACOES.USUARIO_AUTENTICADO,
      usuarioId: usuario.id.valor,
      recurso: 'usuario',
      recursoId: usuario.id.valor,
    });

    return Result.ok(usuario.paraSessao());
  }

  /**
   * Rehash transparente: quando o custo configurado sobe, a senha do usuário é
   * reprotegida no próximo login, sem que ele precise trocá-la.
   *
   * Falha aqui não impede o login — o usuário já provou quem é. Registrar e
   * seguir é a decisão correta; abortar transformaria uma melhoria de segurança
   * em indisponibilidade.
   */
  async #reforcarHashSeNecessario(usuario, senhaEmTexto, signal) {
    if (!this.servicoDeHash.precisaRehash(usuario.credencial)) return;

    try {
      const novoHash = await this.servicoDeHash.gerarHash(senhaEmTexto, signal);
      usuario.substituirCredencial(novoHash);
      await this.usuarioRepository.atualizarCredencial(usuario.id, novoHash, signal);
      this.logger.info(
        { evento: 'usuario.hash_reforcado', usuarioId: usuario.id.valor },
        'Hash de senha atualizado para o custo atual'
      );
    } catch (erro) {
      this.logger.warn(
        { evento: 'usuario.hash_reforco_falhou', usuarioId: usuario.id.valor, err: erro },
        'Falha ao reforçar hash — login mantido'
      );
    }
  }

  #falhar(contexto) {
    this.logger.warn(
      { evento: EVENTOS_LOG.AUTENTICACAO_FALHOU, ...contexto },
      'Falha de autenticação'
    );
    return Result.fail(new UnauthorizedError(FALHA_GENERICA, { code: 'CREDENCIAIS_INVALIDAS' }));
  }
}

module.exports = { AutenticarUsuario, FALHA_GENERICA };
