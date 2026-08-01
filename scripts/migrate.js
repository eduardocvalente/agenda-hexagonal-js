'use strict';

/**
 * Runner de migrations idempotente.
 *
 * Cada migration registra sua execução na collection `_migrations`, então rodar
 * o script duas vezes não reexecuta nada. Migrations são aplicadas em ordem
 * lexicográfica do nome.
 *
 * Uso:
 *   npm run migrate            aplica as pendentes
 *   npm run migrate -- --dry   apenas lista o que seria aplicado
 */

const mongoose = require('mongoose');
const config = require('../src/infrastructure/config/env');
const migrations = require('./migrations');

const DRY_RUN = process.argv.includes('--dry');

async function main() {
  await mongoose.connect(config.mongo.uri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  const registry = db.collection('_migrations');
  await registry.createIndex({ name: 1 }, { unique: true });

  const applied = new Set((await registry.find({}).toArray()).map((d) => d.name));
  const pending = migrations.filter((m) => !applied.has(m.name));

  if (pending.length === 0) {
    console.log('Nenhuma migration pendente.');
    return;
  }

  console.log(`Pendentes: ${pending.map((m) => m.name).join(', ')}`);
  if (DRY_RUN) {
    console.log('--dry: nada foi aplicado.');
    return;
  }

  for (const migration of pending) {
    const startedAt = Date.now();
    console.log(`> aplicando ${migration.name}...`);
    // Sequencial de propósito: migrations têm ordem e não podem correr em paralelo.
    // eslint-disable-next-line no-await-in-loop
    const result = await migration.up(db);
    // eslint-disable-next-line no-await-in-loop
    await registry.insertOne({
      name: migration.name,
      appliedAt: new Date(),
      durationMs: Date.now() - startedAt,
      result: result ?? null,
    });
    console.log(`  ok (${Date.now() - startedAt}ms)`, result ?? '');
  }
}

main()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Falha na migration:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
