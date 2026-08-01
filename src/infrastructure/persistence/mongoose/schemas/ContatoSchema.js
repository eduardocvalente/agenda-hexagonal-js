'use strict';

const mongoose = require('mongoose');
const { LIMITES } = require('../../../../shared/constants');

/**
 * Schema de persistência do contato.
 *
 * `user` é `required` no banco além de invariante na entidade: a defesa em
 * profundidade cobre gravações que não passem pela aplicação (script de
 * manutenção, importação manual). O domínio garante a regra para o código; o
 * banco garante para todo o resto.
 */
const ContatoSchema = new mongoose.Schema(
  {
    // Sem `index: true` aqui: o índice composto abaixo tem `user` como prefixo
    // e já atende as consultas por dono. Um índice extra só custaria escrita.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    nome: { type: String, required: true, trim: true, maxlength: LIMITES.NOME_MAX },
    sobrenome: { type: String, default: '', trim: true, maxlength: LIMITES.SOBRENOME_MAX },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: LIMITES.EMAIL_MAX },
    telefone: { type: String, default: '', trim: true, maxlength: LIMITES.TELEFONE_MAX },
    etiquetas: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: LIMITES.ETIQUETA_MAX }],
      default: [],
      validate: {
        // Limite também no banco: o VO garante para o código; isto garante para
        // scripts de manutenção e importações que não passem pela aplicação.
        validator: (valores) => valores.length <= LIMITES.ETIQUETAS_POR_CONTATO_MAX,
        message: 'Número máximo de etiquetas excedido.',
      },
    },
    favorito: { type: Boolean, default: false },
    criadoEm: { type: Date, default: Date.now },
    atualizadoEm: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'contatos' }
);

// Cobre exatamente a query da listagem: igualdade em `user`, ordenação por
// `criadoEm` (regra ESR do MongoDB). Sem ele, cada carregamento da home vira
// varredura completa mais ordenação em memória.
ContatoSchema.index({ user: 1, criadoEm: -1 }, { name: 'user_criadoEm' });

// Índice multikey para o filtro por etiqueta, com a mesma ordenação da
// listagem. Fica DEPOIS do índice principal: consultas sem etiqueta continuam
// usando `user_criadoEm`, mais enxuto.
ContatoSchema.index({ user: 1, etiquetas: 1, criadoEm: -1 }, { name: 'user_etiquetas_criadoEm' });

module.exports = { ContatoSchema };
