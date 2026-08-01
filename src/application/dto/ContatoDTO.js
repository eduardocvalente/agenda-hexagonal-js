'use strict';

/**
 * DTO de saída para contato.
 *
 * A entidade de domínio nunca atravessa a fronteira da apresentação. Sem esta
 * conversão, a view acessaria Value Objects (`contato.nome.completo`) e passaria
 * a depender da estrutura interna do domínio — qualquer refatoração no VO
 * quebraria templates.
 *
 * É também onde se decide o que é público: o `proprietarioId` fica de fora,
 * porque a view não tem uso para ele e um id a menos exposto é um id a menos
 * disponível para quem inspeciona o HTML.
 */
class ContatoDTO {
  static deEntidade(contato) {
    return Object.freeze({
      id: contato.id.valor,
      nome: contato.nome.nome,
      sobrenome: contato.nome.sobrenome,
      nomeCompleto: contato.nome.completo,
      email: contato.email?.valor ?? '',
      telefone: contato.telefone?.valor ?? '',
      etiquetas: contato.etiquetas.toJSON(),
      // O formulário edita etiquetas como texto ("trabalho, família") — a
      // serialização mora aqui para a view não conhecer o VO.
      etiquetasTexto: contato.etiquetas.texto,
      favorito: contato.favorito,
      criadoEm: contato.criadoEm,
    });
  }

  static deLista(contatos) {
    return contatos.map(ContatoDTO.deEntidade);
  }

  /** Formato vazio para o formulário de criação — evita `undefined` na view. */
  static vazio() {
    return Object.freeze({
      id: null,
      nome: '',
      sobrenome: '',
      nomeCompleto: '',
      email: '',
      telefone: '',
      etiquetas: [],
      etiquetasTexto: '',
      favorito: false,
      criadoEm: null,
    });
  }
}

module.exports = { ContatoDTO };
