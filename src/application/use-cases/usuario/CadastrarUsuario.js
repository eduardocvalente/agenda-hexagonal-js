'use strict';

const { UseCase } = require('../UseCase');
const { Result } = require('../../../shared/result/Result');
const { throwIfAborted } = require('../../../shared/cancellation');
const { ConflictError } = require('../../../shared/errors');
const { EVENTOS_LOG } = require('../../../shared/constants');
const { ACOES } = require('../../../domain/value-objects/AcaoAuditada');
const { Email } = require('../../../domain/value-objects/Email');
const { SenhaEmTexto } = require('../../../domain/value-objects/SenhaEmTexto');
const { Usuario } = require('../../../domain/entities/Usuario');

/**
 * Cadastro de usuário.
 *
 * A unicidade do e-mail NÃO é decidida por um `buscarPorEmail` seguido de
 * `salvar`: entre as duas chamadas cabe outra requisição, e o resultado são
 * duas contas com o mesmo endereço (o defeito TOCTOU do achado ACH-011). Quem
 * garante unicidade é o índice único no banco; este caso de uso apenas traduz
 * a violação do índice em `ConflictError`.
 */
class CadastrarUsuario extends UseCase {
  constructor({ usuarioRepository, servicoDeHash, auditor, logger }) {
    super({ logger });
    this.usuarioRepository = usuarioRepository;
    this.servicoDeHash = servicoDeHash;
    this.auditor = auditor;
  }

  /**
   * @param {{email: string, senha: string}} entrada
   * @param {{signal?: AbortSignal}} contexto
   */
  async executar({ email, senha }, { signal } = {}) {
    const emailResult = Email.criar(email);
    if (emailResult.isFailure) return emailResult;

    const senhaResult = SenhaEmTexto.criar(senha);
    if (senhaResult.isFailure) return senhaResult;

    throwIfAborted(signal, { casoDeUso: 'CadastrarUsuario', etapa: 'antes-do-hash' });

    const senhaComHash = await this.servicoDeHash.gerarHash(senhaResult.value, signal);

    const usuarioResult = Usuario.criar({
      id: this.usuarioRepository.proximoId(),
      email: emailResult.value,
      senhaComHash,
    });
    if (usuarioResult.isFailure) return usuarioResult;

    throwIfAborted(signal, { casoDeUso: 'CadastrarUsuario', etapa: 'antes-de-salvar' });

    const persistencia = await this.usuarioRepository.salvar(usuarioResult.value, signal);
    if (persistencia.isFailure) {
      // Mensagem genérica de propósito: confirmar "este e-mail já existe"
      // permitiria enumerar contas pelo formulário de cadastro.
      if (persistencia.error instanceof ConflictError) {
        this.logger.warn(
          { evento: 'usuario.cadastro_duplicado' },
          'Tentativa de cadastro com e-mail já existente'
        );
        return Result.fail(
          new ConflictError('Não foi possível concluir o cadastro com esses dados.', {
            code: 'CADASTRO_NAO_CONCLUIDO',
          })
        );
      }
      return persistencia;
    }

    const usuario = usuarioResult.value;
    this.logger.info(
      { evento: EVENTOS_LOG.USUARIO_CADASTRADO, usuarioId: usuario.id.valor },
      'Usuário criado'
    );

    // `usuarioId` explícito: a conta acabou de nascer e ainda não está no
    // contexto da requisição, que foi aberto antes de ela existir.
    await this.auditor.registrar({
      acao: ACOES.USUARIO_CADASTRADO,
      usuarioId: usuario.id.valor,
      recurso: 'usuario',
      recursoId: usuario.id.valor,
    });

    return Result.ok(usuario.paraSessao());
  }
}

module.exports = { CadastrarUsuario };
