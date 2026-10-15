import pg from 'pg';
import type { Db } from './db.js';

export function createPgDb(connectionString: string): Db & { close(): Promise<void> } {
  const pool = new pg.Pool({ connectionString });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params);
      return res.rows as T[];
    },
    close: () => pool.end(),
  };
}
