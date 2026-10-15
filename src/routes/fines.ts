import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Db } from '../db.js';

const Status = Type.Union([Type.Literal('aberta'), Type.Literal('paga'), Type.Literal('recorrida')]);
const Fine = Type.Object({
  vehicle_id: Type.Integer({ minimum: 1 }),
  driver_id: Type.Optional(Type.Integer({ minimum: 1 })),
  descricao: Type.String({ minLength: 1 }),
  valor: Type.Number({ exclusiveMinimum: 0 }),
  data_infracao: Type.String({ format: 'date' }),
});
const Id = Type.Object({ id: Type.Integer({ minimum: 1 }) });
const cols = `id, vehicle_id, driver_id, descricao, valor::float8 AS valor,
  to_char(data_infracao,'YYYY-MM-DD') AS data_infracao, status`;

export const fineRoutes = (db: Db): FastifyPluginAsyncTypebox => async (app) => {
  app.get(
    '/fines',
    {
      schema: {
        tags: ['fines'],
        querystring: Type.Object({ status: Type.Optional(Status), vehicle_id: Type.Optional(Type.Integer()) }),
      },
    },
    (req) =>
      db.query(
        `SELECT ${cols} FROM fines
         WHERE ($1::text IS NULL OR status=$1) AND ($2::int IS NULL OR vehicle_id=$2)
         ORDER BY data_infracao DESC`,
        [req.query.status ?? null, req.query.vehicle_id ?? null],
      ),
  );

  app.get('/fines/summary', { schema: { tags: ['fines'] } }, () =>
    db.query(
      `SELECT status, COUNT(*)::int AS quantidade, COALESCE(SUM(valor),0)::float8 AS total
       FROM fines GROUP BY status ORDER BY status`,
    ),
  );

  app.post('/fines', { schema: { tags: ['fines'], body: Fine } }, async (req, reply) => {
    const b = req.body;
    const [row] = await db.query(
      `INSERT INTO fines (vehicle_id, driver_id, descricao, valor, data_infracao)
       VALUES ($1,$2,$3,$4,$5) RETURNING ${cols}`,
      [b.vehicle_id, b.driver_id ?? null, b.descricao, b.valor, b.data_infracao],
    );
    return reply.code(201).send(row);
  });

  app.patch(
    '/fines/:id/status',
    { schema: { tags: ['fines'], params: Id, body: Type.Object({ status: Status }) } },
    async (req, reply) => {
      const [row] = await db.query(`UPDATE fines SET status=$1 WHERE id=$2 RETURNING ${cols}`, [
        req.body.status,
        req.params.id,
      ]);
      return row ?? reply.code(404).send({ error: 'Multa não encontrada' });
    },
  );
};
