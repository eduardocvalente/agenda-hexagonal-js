'use strict';

/**
 * Índices em produção.
 *
 * `background: true` evita travar a collection durante a criação — em MongoDB
 * 4.2+ o comportamento já é o padrão, mas a flag mantém compatibilidade com
 * clusters mais antigos.
 *
 * O índice único em `logins.email` pode falhar se já existirem duplicatas por
 * diferença de caixa (a versão anterior não normalizava e-mails). A migration
 * detecta e aborta com a lista, em vez de apagar contas silenciosamente.
 */
module.exports = {
  name: '0002-indexes',

  async up(db) {
    const logins = db.collection('logins');

    const duplicatas = await logins
      .aggregate([
        { $group: { _id: { $toLower: '$email' }, ids: { $push: '$_id' }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray();

    if (duplicatas.length > 0) {
      throw new Error(
        'E-mails duplicados (diferindo apenas por maiúsculas/minúsculas) impedem o índice único. ' +
          `Resolva manualmente antes de reexecutar: ${JSON.stringify(duplicatas)}`
      );
    }

    // Normaliza antes de criar o índice, senão "A@x.com" e "a@x.com" continuam coexistindo.
    await logins.updateMany({}, [{ $set: { email: { $toLower: '$email' } } }]);
    await logins.createIndex({ email: 1 }, { unique: true, background: true, name: 'uniq_email' });

    await db
      .collection('contatos')
      .createIndex({ user: 1, criadoEm: -1 }, { background: true, name: 'user_criadoEm' });

    return { indices: ['logins.uniq_email', 'contatos.user_criadoEm'] };
  },
};
