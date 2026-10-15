import type { Db } from './db.js';

const migrations: { id: number; statements: string[] }[] = [
  {
    id: 1,
    statements: [
      `CREATE TABLE vehicles (
        id SERIAL PRIMARY KEY,
        placa TEXT NOT NULL UNIQUE,
        modelo TEXT NOT NULL,
        crlv_vencimento DATE NOT NULL
      )`,
      `CREATE TABLE drivers (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        cnh_numero TEXT NOT NULL UNIQUE,
        cnh_vencimento DATE NOT NULL
      )`,
      `CREATE TABLE fines (
        id SERIAL PRIMARY KEY,
        vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        driver_id INT REFERENCES drivers(id) ON DELETE SET NULL,
        descricao TEXT NOT NULL,
        valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
        data_infracao DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','paga','recorrida'))
      )`,
      `CREATE INDEX fines_vehicle_idx ON fines(vehicle_id)`,
    ],
  },
  {
    id: 2,
    statements: [
      `CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL,
        papel TEXT NOT NULL CHECK (papel IN ('admin','leitor'))
      )`,
    ],
  },
];

export async function migrate(db: Db): Promise<void> {
  await db.query('CREATE TABLE IF NOT EXISTS migrations (id INT PRIMARY KEY)');
  const done = new Set((await db.query<{ id: number }>('SELECT id FROM migrations')).map((r) => r.id));
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    for (const stmt of m.statements) await db.query(stmt);
    await db.query('INSERT INTO migrations (id) VALUES ($1)', [m.id]);
  }
}
