'use strict';

const { Entity } = require('../../shared/domain/Entity');
const { Result } = require('../../shared/result/Result');
const { BusinessRuleError, ForbiddenError } = require('../../shared/errors');
const { Etiquetas } = require('../value-objects/Etiquetas');

/**
 * Contato da agenda — a raiz de agregado do domínio.
 *
 * Duas invariantes vivem aqui, e nenhuma delas pode ser burlada por caminho
 * algum de código:
 *
 *  1. **Todo contato tem um dono.** O construtor exige `proprietarioId`. Não
 *     existe estado válido sem dono, o que corrige na estrutura o achado
 *     ACH-001 da auditoria — antes a coluna simplesmente não existia e a
 *     agenda era compartilhada entre todos os usuários.
 *
 *  2. **Ao menos uma forma de contato.** Um registro sem e-mail e sem telefone
 *     não cumpre a função de uma agenda; é regra de negócio, não de formulário,
 *     e por isso é verificada aqui e não na camada HTTP.
 *
 * `pertenceA` transforma autorização em pergunta feita ao próprio domínio.
 * Continua havendo o filtro por dono na consulta (defesa em profundidade), mas
 * agora a regra tem um lugar único onde é expressa.
 */
class Contato extends Entity {
  #proprietarioId;
  #nome;
  #email;
  #telefone;
  #etiquetas;
  #favorito;
  #criadoEm;
  #atualizadoEm;

  constructor({
    id,
    proprietarioId,
    nome,
    email,
    telefone,
    etiquetas,
    favorito,
    criadoEm,
    atualizadoEm,
  }) {
    super(id);
    if (!proprietarioId) {
      throw new TypeError('Contato exige um proprietário — invariante do agregado.');
    }
    this.#proprietarioId = proprietarioId;
    this.#nome = nome;
    this.#email = email ?? null;
    this.#telefone = telefone ?? null;
    this.#etiquetas = etiquetas ?? Etiquetas.vazia();
    this.#favorito = favorito === true;
    this.#criadoEm = criadoEm ?? new Date();
    this.#atualizadoEm = atualizadoEm ?? this.#criadoEm;
  }

  static criar({ id, proprietarioId, nome, email, telefone, etiquetas, criadoEm }) {
    const invariante = Contato.#verificarFormaDeContato(email, telefone);
    if (invariante.isFailure) return invariante;

    // `favorito` não entra na criação de propósito: contato nasce comum e é
    // promovido depois, por gesto explícito — nunca por mass assignment.
    return Result.ok(
      new Contato({ id, proprietarioId, nome, email, telefone, etiquetas, criadoEm })
    );
  }

  static reconstituir(props) {
    return new Contato(props);
  }

  static #verificarFormaDeContato(email, telefone) {
    if (!email && !telefone) {
      return Result.fail(
        new BusinessRuleError('Pelo menos um contato precisa ser cadastrado: e-mail ou telefone.', {
          code: 'CONTATO_SEM_FORMA_DE_CONTATO',
        })
      );
    }
    return Result.ok(true);
  }

  /** A pergunta de autorização, feita ao domínio. */
  pertenceA(usuarioId) {
    return this.#proprietarioId.equals(usuarioId);
  }

  /**
   * Altera os dados mantendo as invariantes.
   *
   * Recebe o `usuarioId` de quem está editando e recusa se não for o dono —
   * mesmo que a consulta que trouxe a entidade tivesse falhado em filtrar.
   * A entidade não confia em quem a carregou.
   */
  alterarDados({ nome, email, telefone, etiquetas, editadoPor }) {
    if (!this.pertenceA(editadoPor)) {
      return Result.fail(
        new ForbiddenError('Contato não encontrado.', { code: 'CONTATO_DE_OUTRO_PROPRIETARIO' })
      );
    }

    const invariante = Contato.#verificarFormaDeContato(email, telefone);
    if (invariante.isFailure) return invariante;

    this.#nome = nome;
    this.#email = email ?? null;
    this.#telefone = telefone ?? null;
    this.#etiquetas = etiquetas ?? Etiquetas.vazia();
    // `favorito` não é tocado aqui: editar dados e favoritar são gestos
    // distintos, com rotas distintas — juntá-los criaria o caminho para um
    // formulário adulterado desfavoritar sem o usuário perceber.
    this.#atualizadoEm = new Date();

    return Result.ok(this);
  }

  /**
   * Alterna o estado de favorito.
   *
   * Mesma disciplina de autorização de `alterarDados`: a entidade não confia
   * em quem a carregou, mesmo que a consulta já tenha filtrado por dono.
   */
  alternarFavorito({ alteradoPor }) {
    if (!this.pertenceA(alteradoPor)) {
      return Result.fail(
        new ForbiddenError('Contato não encontrado.', { code: 'CONTATO_DE_OUTRO_PROPRIETARIO' })
      );
    }

    this.#favorito = !this.#favorito;
    this.#atualizadoEm = new Date();

    return Result.ok(this);
  }

  get proprietarioId() {
    return this.#proprietarioId;
  }

  get nome() {
    return this.#nome;
  }

  get email() {
    return this.#email;
  }

  get telefone() {
    return this.#telefone;
  }

  get etiquetas() {
    return this.#etiquetas;
  }

  get favorito() {
    return this.#favorito;
  }

  get criadoEm() {
    return this.#criadoEm;
  }

  get atualizadoEm() {
    return this.#atualizadoEm;
  }

  toJSON() {
    return {
      id: this.id.valor,
      nome: this.#nome.nome,
      sobrenome: this.#nome.sobrenome,
      email: this.#email?.valor ?? '',
      telefone: this.#telefone?.valor ?? '',
      etiquetas: this.#etiquetas.toJSON(),
      favorito: this.#favorito,
      criadoEm: this.#criadoEm,
    };
  }
}

module.exports = { Contato };
