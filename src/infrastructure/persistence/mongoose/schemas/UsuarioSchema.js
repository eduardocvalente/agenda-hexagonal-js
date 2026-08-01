'use strict';

const mongoose = require('mongoose');
const { LIMITES } = require('../../../../shared/constants');

/**
 * Schema de persistência do usuário.
 *
 * É um detalhe de infraestrutura, não o modelo de domínio. A entidade `Usuario`
 * não conhece este arquivo; o mapeamento entre os dois é feito pelo mapper.
 * Essa separação é o que permite trocar Mongoose por outro ORM sem tocar em
 * nenhuma regra de negócio.
 *
 * A coleção continua se chamando `logins` para manter compatibilidade com os
 * dados já existentes — renomear exigiria migração sem nenhum ganho.
 */
const UsuarioSchema = new mongoose.Schema(
  {
    // A unicidade é declarada UMA vez, no índice nomeado abaixo. Declará-la
    // também no campo faria o Mongoose criar um segundo índice (`email_1`) que
    // colide com `uniq_email` — e o erro só aparece na criação, em produção.
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: LIMITES.EMAIL_MAX,
    },
    // select:false — o hash não sai do banco sem pedido explícito, então um
    // `findOne` distraído nunca o traz para dentro da aplicação.
    password: { type: String, required: true, select: false },
    criadoEm: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'logins' }
);

UsuarioSchema.index({ email: 1 }, { unique: true, name: 'uniq_email' });

module.exports = { UsuarioSchema };
