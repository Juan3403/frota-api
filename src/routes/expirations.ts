import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Db } from '../db.js';

// Documentos vencidos ou que vencem nos próximos N dias (CRLV de veículos e CNH de motoristas).
export const expirationRoutes = (db: Db): FastifyPluginAsyncTypebox => async (app) => {
  app.get(
    '/vencimentos',
    {
      schema: {
        tags: ['vencimentos'],
        description: 'Lista documentos vencidos ou a vencer em até `dias` dias',
        querystring: Type.Object({ dias: Type.Integer({ minimum: 0, maximum: 365, default: 30 }) }),
      },
    },
    (req) =>
      db.query(
        `SELECT * FROM (
           SELECT 'CRLV' AS documento, placa AS referencia, to_char(crlv_vencimento,'YYYY-MM-DD') AS vencimento,
                  (crlv_vencimento - CURRENT_DATE)::int AS dias_restantes FROM vehicles
           UNION ALL
           SELECT 'CNH', nome, to_char(cnh_vencimento,'YYYY-MM-DD'),
                  (cnh_vencimento - CURRENT_DATE)::int FROM drivers
         ) t
         WHERE dias_restantes <= $1
         ORDER BY dias_restantes`,
        [req.query.dias],
      ),
  );
};
