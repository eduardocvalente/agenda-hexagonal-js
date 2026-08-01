'use strict';

const mongoose = require('mongoose');
const config = require('../../../config/env');

/**
 * Schema da trilha de auditoria.
 *
 * `strict: true` e `Mixed` em `detalhes`: o conteúdo varia por ação, mas o
 * envelope (quem, o quê, quando, resultado) é fixo e indexável.
 */
const RegistroDeAuditoriaSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    acao: { type: String, required: true },
    resultado: { type: String, required: true, enum: ['sucesso', 'falha'] },
    recurso: { type: String, default: null },
    recursoId: { type: String, default: null },
    detalhes: { type: mongoose.Schema.Types.Mixed, default: {} },
    requestId: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    ocorridoEm: { type: Date, required: true },
  },
  { versionKey: false, collection: 'auditoria' }
);

// Cobre a consulta da tela de atividades: igualdade em `usuario`, ordenação por
// data (regra ESR). Sem ele, a trilha de um usuário exige varredura completa —
// e esta é a collection que mais cresce no sistema.
RegistroDeAuditoriaSchema.index({ usuario: 1, ocorridoEm: -1 }, { name: 'usuario_ocorridoEm' });

// Filtro por tipo de ação dentro da trilha do usuário.
RegistroDeAuditoriaSchema.index(
  { usuario: 1, acao: 1, ocorridoEm: -1 },
  { name: 'usuario_acao_ocorridoEm' }
);

/**
 * Índice TTL: o MongoDB apaga registros vencidos sozinho.
 *
 * Auditoria é a collection que cresce sem parar — sem retenção, ela vira o
 * maior custo de armazenamento do sistema e, pela LGPD, guardar dado pessoal
 * além da finalidade é irregular. A retenção é configurável porque o prazo
 * adequado depende da natureza do sistema, não do código.
 */
RegistroDeAuditoriaSchema.index(
  { ocorridoEm: 1 },
  {
    name: 'ttl_retencao',
    expireAfterSeconds: config.auditoria.retencaoDias * 24 * 60 * 60,
  }
);

module.exports = { RegistroDeAuditoriaSchema };
