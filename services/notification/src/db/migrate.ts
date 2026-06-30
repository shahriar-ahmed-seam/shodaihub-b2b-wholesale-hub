/**
 * Minimal forward-only SQL migration runner (uses the `pg` driver).
 *
 * Applies every `*.sql` file under `migrations/` in lexicographic order, recording applied files
 * in `notifications.schema_migrations` so each runs at most once. Designed for `npm run migrate`
 * and for the service to self-migrate on boot in local/dev.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { loadConfig } from '../config.js';
import { closePool, getPool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

export async function runMigrations(pool: pg.Pool): Promise<string[]> {
  await pool.query('CREATE SCHEMA IF NOT EXISTS notifications');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications.schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const entries = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  const applied: string[] = [];
  for (const filename of entries) {
    const { rows } = await pool.query(
      'SELECT 1 FROM notifications.schema_migrations WHERE filename = $1',
      [filename],
    );
    if (rows.length > 0) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO notifications.schema_migrations (filename) VALUES ($1)', [
        filename,
      ]);
      await client.query('COMMIT');
      applied.push(filename);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return applied;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = getPool(config.databaseUrl);
  const applied = await runMigrations(pool);
  if (applied.length === 0) {
    console.log(JSON.stringify({ message: 'No pending migrations' }));
  } else {
    console.log(JSON.stringify({ message: 'Applied migrations', applied }));
  }
  await closePool();
}

// Run only when executed directly (not when imported).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(JSON.stringify({ message: 'Migration failed', error: String(err) }));
    process.exitCode = 1;
  });
}
