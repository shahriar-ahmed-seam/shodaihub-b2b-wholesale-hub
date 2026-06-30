/**
 * Shared `pg` connection pool for the Auth Service.
 *
 * A single lazily-created pool is reused across repositories. Connection details come from
 * `AUTH_DB_URL` (Req 20.4).
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(databaseUrl: string): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl, max: 10 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type { Pool } from 'pg';
