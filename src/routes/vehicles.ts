import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Db } from '../db.js';
import { PageQuery, page } from '../pagination.js';

const Vehicle = Type.Object({
  placa: Type.String({ pattern: '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$', description: 'Placa antiga ou Mercosul' }),
  modelo: Type.String({ minLength: 1 }),
  crlv_vencimento: Type.String({ format: 'date' }),
});
const Id = Type.Object({ id: Type.Integer({ minimum: 1 }) });
const cols = `id, placa, modelo, to_char(crlv_vencimento,'YYYY-MM-DD') AS crlv_vencimento`;

export const vehicleRoutes = (db: Db): FastifyPluginAsyncTypebox => async (app) => {
  app.get('/vehicles', { schema: { tags: ['vehicles'], querystring: Type.Object(PageQuery) } }, async (req, reply) => {
    const [cont] = await db.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM vehicles');
    reply.header('X-Total-Count', cont?.total ?? 0);
    return db.query(`SELECT ${cols} FROM vehicles ORDER BY placa, id LIMIT $1 OFFSET $2`, page(req.query));
  });

  app.get('/vehicles/:id', { schema: { tags: ['vehicles'], params: Id } }, async (req, reply) => {
    const [row] = await db.query(`SELECT ${cols} FROM vehicles WHERE id=$1`, [req.params.id]);
    return row ?? reply.code(404).send({ error: 'Veículo não encontrado' });
  });

  app.post('/vehicles', { schema: { tags: ['vehicles'], body: Vehicle } }, async (req, reply) => {
    const b = req.body;
    const [row] = await db.query(
      `INSERT INTO vehicles (placa, modelo, crlv_vencimento) VALUES ($1,$2,$3) RETURNING ${cols}`,
      [b.placa, b.modelo, b.crlv_vencimento],
    );
    return reply.code(201).send(row);
  });

  app.put('/vehicles/:id', { schema: { tags: ['vehicles'], params: Id, body: Vehicle } }, async (req, reply) => {
    const b = req.body;
    const [row] = await db.query(
      `UPDATE vehicles SET placa=$1, modelo=$2, crlv_vencimento=$3 WHERE id=$4 RETURNING ${cols}`,
      [b.placa, b.modelo, b.crlv_vencimento, req.params.id],
    );
    return row ?? reply.code(404).send({ error: 'Veículo não encontrado' });
  });

  app.delete('/vehicles/:id', { schema: { tags: ['vehicles'], params: Id } }, async (req, reply) => {
    const rows = await db.query('DELETE FROM vehicles WHERE id=$1 RETURNING id', [req.params.id]);
    return rows.length ? reply.code(204).send() : reply.code(404).send({ error: 'Veículo não encontrado' });
  });
};
