'use strict';

const mongoose = require('mongoose');
const { LIMITES } = require('../../../../shared/constants');

/**
 * Schema de persistência do compromisso.
 *
 * `user` é `required` no banco além de invariante na entidade — a mesma
 * defesa em profundidade do schema de contatos.
 *
 * `contato` é referência FRACA (sem FK real no Mongo): apagar o contato não
 * apaga nem trava o compromisso; o mapper devolve o vínculo e a view decide o
 * que mostrar quando ele aponta para algo que já não existe.
 */
const CompromissoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    titulo: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITES.TITULO_COMPROMISSO_MAX,
    },
    inicioEm: { type: Date, required: true },
    notas: { type: String, default: '', trim: true, maxlength: LIMITES.NOTAS_COMPROMISSO_MAX },
    contato: { type: mongoose.Schema.Types.ObjectId, ref: 'Contato', default: null },
    etiquetas: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: LIMITES.ETIQUETA_MAX }],
      default: [],
      validate: {
        validator: (valores) => valores.length <= LIMITES.ETIQUETAS_POR_CONTATO_MAX,
        message: 'Número máximo de etiquetas excedido.',
      },
    },
    criadoEm: { type: Date, default: Date.now },
    atualizadoEm: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'compromissos' }
);

// Uma consulta, duas formas: janela do calendário (range em `inicioEm`) e
// próximos compromissos (range aberto + sort) — ambas cobertas por este
// índice composto com `user` como prefixo de igualdade (regra ESR).
CompromissoSchema.index({ user: 1, inicioEm: 1 }, { name: 'user_inicioEm' });

module.exports = { CompromissoSchema };
