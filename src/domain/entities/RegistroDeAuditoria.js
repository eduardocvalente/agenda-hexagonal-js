'use strict';

const { Entity } = require('../../shared/domain/Entity');
const { Result } = require('../../shared/result/Result');
const { ValidationError } = require('../../shared/errors');
const { RESULTADOS } = require('../value-objects/AcaoAuditada');

/** Chaves que jamais podem entrar em `detalhes`, mesmo por descuido. */
const CHAVES_PROIBIDAS = new Set([
  'password',
  'senha',
  'senhaEmTexto',
  'hash',
  'token',
  '_csrf',
  'csrfToken',
  'authorization',
  'cookie',
  'secret',
]);

const MAX_DETALHES_CHARS = 2_000;

/**
 * Registro imutável da trilha de auditoria.
 *
 * Três propriedades definem o que é uma trilha de auditoria útil, e todas são
 * impostas aqui:
 *
 *  1. **Append-only.** Não há método que altere um registro depois de criado, e
 *     a porta do repositório não expõe update nem delete. Trilha que pode ser
 *     editada não serve como prova de nada.
 *
 *  2. **Nunca contém segredo.** `detalhes` passa por uma allow-list negativa: se
 *     uma chave proibida aparecer, ela é substituída por `[REDACTED]` em vez de
 *     o registro ser recusado. Recusar faria perder o evento inteiro por causa
 *     de um campo — perder o rastro é pior que registrá-lo parcialmente.
 *
 *  3. **Sempre tem dono.** Mesma invariante do `Contato`: sem `usuarioId` não há
 *     como devolver ao usuário a própria trilha nem escopar a consulta.
 *     A exceção deliberada é a tentativa de login recusada com e-mail
 *     inexistente — nesse caso não se cria registro algum (ver ADR-0010).
 */
class RegistroDeAuditoria extends Entity {
  #usuarioId;
  #acao;
  #resultado;
  #recurso;
  #recursoId;
  #detalhes;
  #requestId;
  #ip;
  #userAgent;
  #ocorridoEm;

  constructor(props) {
    super(props.id);
    if (!props.usuarioId) {
      throw new TypeError('RegistroDeAuditoria exige um usuário — invariante do agregado.');
    }
    this.#usuarioId = props.usuarioId;
    this.#acao = props.acao;
    this.#resultado = props.resultado ?? RESULTADOS.SUCESSO;
    this.#recurso = props.recurso ?? null;
    this.#recursoId = props.recursoId ?? null;
    this.#detalhes = Object.freeze(props.detalhes ?? {});
    this.#requestId = props.requestId ?? null;
    this.#ip = props.ip ?? null;
    this.#userAgent = props.userAgent ?? null;
    this.#ocorridoEm = props.ocorridoEm ?? new Date();
  }

  static criar({
    id,
    usuarioId,
    acao,
    resultado = RESULTADOS.SUCESSO,
    recurso = null,
    recursoId = null,
    detalhes = {},
    requestId = null,
    ip = null,
    userAgent = null,
    ocorridoEm,
  }) {
    if (!Object.values(RESULTADOS).includes(resultado)) {
      return Result.fail(
        new ValidationError(`Resultado de auditoria inválido: "${resultado}".`, {
          code: 'AUDITORIA_RESULTADO_INVALIDO',
        })
      );
    }

    return Result.ok(
      new RegistroDeAuditoria({
        id,
        usuarioId,
        acao,
        resultado,
        recurso,
        recursoId,
        detalhes: RegistroDeAuditoria.#sanitizar(detalhes),
        requestId,
        ip,
        userAgent,
        ocorridoEm,
      })
    );
  }

  static reconstituir(props) {
    return new RegistroDeAuditoria(props);
  }

  /**
   * Remove segredos e limita o tamanho.
   *
   * Recursivo porque `detalhes` pode conter objeto aninhado — uma verificação
   * só no primeiro nível deixaria `{ dados: { password: '...' } }` passar.
   */
  static #sanitizar(valor, profundidade = 0) {
    if (profundidade > 3 || valor === null || typeof valor !== 'object') {
      return RegistroDeAuditoria.#truncar(valor);
    }

    if (Array.isArray(valor)) {
      return valor
        .slice(0, 20)
        .map((item) => RegistroDeAuditoria.#sanitizar(item, profundidade + 1));
    }

    const saida = {};
    for (const [chave, conteudo] of Object.entries(valor)) {
      saida[chave] = CHAVES_PROIBIDAS.has(chave.toLowerCase())
        ? '[REDACTED]'
        : RegistroDeAuditoria.#sanitizar(conteudo, profundidade + 1);
    }
    return saida;
  }

  static #truncar(valor) {
    if (typeof valor !== 'string' || valor.length <= MAX_DETALHES_CHARS) return valor;
    return `${valor.slice(0, MAX_DETALHES_CHARS)}…[truncado]`;
  }

  /** Mesma pergunta de autorização do Contato: a trilha é do usuário. */
  pertenceA(usuarioId) {
    return this.#usuarioId.equals(usuarioId);
  }

  get usuarioId() {
    return this.#usuarioId;
  }

  get acao() {
    return this.#acao;
  }

  get resultado() {
    return this.#resultado;
  }

  get recurso() {
    return this.#recurso;
  }

  get recursoId() {
    return this.#recursoId;
  }

  get detalhes() {
    return this.#detalhes;
  }

  get requestId() {
    return this.#requestId;
  }

  get ip() {
    return this.#ip;
  }

  get userAgent() {
    return this.#userAgent;
  }

  get ocorridoEm() {
    return this.#ocorridoEm;
  }

  get houveFalha() {
    return this.#resultado === RESULTADOS.FALHA;
  }

  toJSON() {
    return {
      id: this.id.valor,
      acao: this.#acao.valor,
      descricao: this.#acao.descricao,
      resultado: this.#resultado,
      recurso: this.#recurso,
      recursoId: this.#recursoId,
      detalhes: this.#detalhes,
      requestId: this.#requestId,
      ocorridoEm: this.#ocorridoEm,
    };
  }
}

module.exports = { RegistroDeAuditoria, CHAVES_PROIBIDAS };
