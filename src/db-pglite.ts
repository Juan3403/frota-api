import { PGlite } from '@electric-sql/pglite';
import type { Db } from './db.js';

// PostgreSQL em WASM: usado nos testes, sem precisar de Docker.
export function createPgliteDb(): Db {
  const db = new PGlite();
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await db.query(sql, params);
      return res.rows as T[];
    },
  };
}
