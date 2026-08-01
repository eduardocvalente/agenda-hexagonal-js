'use strict';

/**
 * Composition Root — o único lugar do sistema que sabe qual implementação
 * concreta satisfaz cada porta.
 *
 * **Por que injeção manual e não um framework (Awilix, InversifyJS, tsyringe):**
 * o grafo tem ~12 nós e é estático. Um contêiner com auto-resolução por nome ou
 * por decorator trocaria um arquivo explícito e depurável por resolução em
 * runtime — quando ela falha, o erro aparece longe da causa. YAGNI aplicado à
 * própria infraestrutura: a dependência só se paga quando o grafo fica grande o
 * bastante para o cabeamento manual doer, e não é o caso.
 *
 * Registro preguiçoso (`lazy`): a fábrica só roda na primeira resolução. Isso
 * permite que os testes substituam qualquer porta antes de o grafo ser montado.
 */
class Container {
  #fabricas = new Map();
  #instancias = new Map();

  /** Registra um singleton — instância única, criada na primeira resolução. */
  registrarSingleton(nome, fabrica) {
    this.#fabricas.set(nome, { fabrica, singleton: true });
    return this;
  }

  /** Registra uma fábrica — instância nova a cada resolução. */
  registrarTransiente(nome, fabrica) {
    this.#fabricas.set(nome, { fabrica, singleton: false });
    return this;
  }

  /** Registra um valor já construído (config, conexão aberta). */
  registrarValor(nome, valor) {
    this.#instancias.set(nome, valor);
    return this;
  }

  resolver(nome) {
    if (this.#instancias.has(nome)) return this.#instancias.get(nome);

    const registro = this.#fabricas.get(nome);
    if (!registro) {
      throw new Error(
        `Dependência não registrada: "${nome}". Registradas: ${[...this.#fabricas.keys()].join(', ')}`
      );
    }

    const instancia = registro.fabrica(this);
    if (registro.singleton) this.#instancias.set(nome, instancia);
    return instancia;
  }

  /** Substitui um registro. Uso previsto: testes trocando adaptador por duplo. */
  substituir(nome, valor) {
    this.#instancias.set(nome, valor);
    return this;
  }

  temRegistro(nome) {
    return this.#instancias.has(nome) || this.#fabricas.has(nome);
  }
}

module.exports = { Container };
