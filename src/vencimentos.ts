import type { Db } from './db.js';

export type Vencimento = { documento: 'CRLV' | 'CNH'; referencia: string; vencimento: string; dias_restantes: number };

// Documentos vencidos ou que vencem nos próximos N dias (CRLV de veículos e CNH de motoristas).
export const buscaVencimentos = (db: Db, dias: number) =>
  db.query<Vencimento>(
    `SELECT * FROM (
       SELECT 'CRLV' AS documento, placa AS referencia, to_char(crlv_vencimento,'YYYY-MM-DD') AS vencimento,
              (crlv_vencimento - CURRENT_DATE)::int AS dias_restantes FROM vehicles
       UNION ALL
       SELECT 'CNH', nome, to_char(cnh_vencimento,'YYYY-MM-DD'),
              (cnh_vencimento - CURRENT_DATE)::int FROM drivers
     ) t
     WHERE dias_restantes <= $1
     ORDER BY dias_restantes`,
    [dias],
  );
