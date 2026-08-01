'use strict';

const { Entity } = require('../../shared/domain/Entity');
const { Result } = require('../../shared/result/Result');
const { UsuarioId } = require('../value-objects/Identificador');

/**
 * Usuário autenticável.
 *
 * A entidade é deliberadamente magra: o domínio deste sistema tem pouca regra
 * em torno do usuário. Inflá-la com comportamento inventado seria pior que
 * mantê-la enxuta — a crítica a "entidade anêmica" vale quando existe regra
 * sendo empurrada para serviços, não quando a regra simplesmente não existe.
 *
 * O que ela garante e que antes não existia: o hash da senha é privado e sai
 * apenas por `credencial`, que os adaptadores usam. Não há caminho para o hash
 * chegar acidentalmente à sessão ou à view (achado ACH-005).
 */
class Usuario extends Entity {
  #email;
  #senha;
  #criadoEm;

  constructor({ id, email, senha, criadoEm }) {
    super(id);
    this.#email = email;
    this.#senha = senha;
    this.#criadoEm = criadoEm ?? new Date();
  }

  /** Fábrica para um usuário novo: exige id gerado e senha já hasheada. */
  static criar({ id, email, senhaComHash, criadoEm }) {
    return Result.ok(new Usuario({ id, email, senha: senhaComHash, criadoEm }));
  }

  /** Reconstitui a partir da persistência, sem revalidar. */
  static reconstituir({ id, email, senhaComHash, criadoEm }) {
    return new Usuario({ id, email, senha: senhaComHash, criadoEm });
  }

  get email() {
    return this.#email;
  }

  get criadoEm() {
    return this.#criadoEm;
  }

  /** Acesso controlado ao hash — só o verificador de senha deve chamar. */
  get credencial() {
    return this.#senha;
  }

  /** Troca de hash após o custo do algoritmo ser elevado (rehash transparente). */
  substituirCredencial(novaSenhaComHash) {
    this.#senha = novaSenhaComHash;
  }

  /**
   * Projeção para a sessão. Contém o mínimo necessário para identificar o
   * usuário logado — nunca o hash, nunca o documento inteiro.
   */
  paraSessao() {
    return Object.freeze({ id: this.id.valor, email: this.#email.valor });
  }

  /** Impede que `JSON.stringify(usuario)` vaze a credencial. */
  toJSON() {
    return { id: this.id.valor, email: this.#email.valor, criadoEm: this.#criadoEm };
  }
}

module.exports = { Usuario, UsuarioId };
