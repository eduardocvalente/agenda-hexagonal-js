'use strict';

/**
 * Introduz `user` em `contatos`.
 *
 * Contexto: até esta versão a collection não tinha dono e a agenda inteira era
 * compartilhada entre todos os usuários (e visível para anônimos na home).
 * Depois da correção, todo documento sem `user` fica invisível — precisa ser
 * atribuído ou removido conscientemente.
 *
 * Estratégia (não destrutiva por padrão):
 *  - com CONTATO_OWNER_EMAIL definido, os órfãos vão para esse usuário;
 *  - sem a variável, os órfãos são movidos para `contatos_orfaos` e retirados da
 *    collection ativa. Nada é apagado: o restore continua possível.
 */
module.exports = {
  name: '0001-contato-owner',

  async up(db) {
    const contatos = db.collection('contatos');
    const orfaos = await contatos.countDocuments({ user: { $exists: false } });
    if (orfaos === 0) return { orfaos: 0, acao: 'nenhuma' };

    const ownerEmail = process.env.CONTATO_OWNER_EMAIL;

    if (ownerEmail) {
      const owner = await db.collection('logins').findOne({ email: ownerEmail.toLowerCase() });
      if (!owner) {
        throw new Error(
          `CONTATO_OWNER_EMAIL="${ownerEmail}" não corresponde a nenhum usuário cadastrado.`
        );
      }
      const res = await contatos.updateMany(
        { user: { $exists: false } },
        { $set: { user: owner._id } }
      );
      return { orfaos, acao: 'atribuidos', owner: ownerEmail, modificados: res.modifiedCount };
    }

    const docs = await contatos.find({ user: { $exists: false } }).toArray();
    await db.collection('contatos_orfaos').insertMany(docs);
    await contatos.deleteMany({ user: { $exists: false } });
    return { orfaos, acao: 'movidos_para_contatos_orfaos' };
  },
};
