import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Db } from '../db.js';

const Driver = Type.Object({
  nome: Type.String({ minLength: 1 }),
  cnh_numero: Type.String({ pattern: '^[0-9]{11}$', description: '11 dígitos' }),
  cnh_vencimento: Type.String({ format: 'date' }),
});
const Id = Type.Object({ id: Type.Integer({ minimum: 1 }) });
const cols = `id, nome, cnh_numero, to_char(cnh_vencimento,'YYYY-MM-DD') AS cnh_vencimento`;

export const driverRoutes = (db: Db): FastifyPluginAsyncTypebox => async (app) => {
  app.get('/drivers', { schema: { tags: ['drivers'] } }, () => db.query(`SELECT ${cols} FROM drivers ORDER BY nome`));

  app.get('/drivers/:id', { schema: { tags: ['drivers'], params: Id } }, async (req, reply) => {
    const [row] = await db.query(`SELECT ${cols} FROM drivers WHERE id=$1`, [req.params.id]);
    return row ?? reply.code(404).send({ error: 'Motorista não encontrado' });
  });

  app.post('/drivers', { schema: { tags: ['drivers'], body: Driver } }, async (req, reply) => {
    const b = req.body;
    const [row] = await db.query(
      `INSERT INTO drivers (nome, cnh_numero, cnh_vencimento) VALUES ($1,$2,$3) RETURNING ${cols}`,
      [b.nome, b.cnh_numero, b.cnh_vencimento],
    );
    return reply.code(201).send(row);
  });

  app.delete('/drivers/:id', { schema: { tags: ['drivers'], params: Id } }, async (req, reply) => {
    const rows = await db.query('DELETE FROM drivers WHERE id=$1 RETURNING id', [req.params.id]);
    return rows.length ? reply.code(204).send() : reply.code(404).send({ error: 'Motorista não encontrado' });
  });
};
