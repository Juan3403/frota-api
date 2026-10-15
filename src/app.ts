import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Db } from './db.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { driverRoutes } from './routes/drivers.js';
import { fineRoutes } from './routes/fines.js';
import { expirationRoutes } from './routes/expirations.js';

export async function buildApp(db: Db) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' }).withTypeProvider<TypeBoxTypeProvider>();

  app.setErrorHandler((err: any, _req, reply) => {
    if (err.code === '23505') return reply.code(409).send({ error: 'Registro duplicado' });
    if (err.code === '23503') return reply.code(422).send({ error: 'Referência inexistente' });
    if (err.validation) return reply.code(400).send({ error: err.message });
    app.log.error(err);
    return reply.code(500).send({ error: 'Erro interno' });
  });

  await app.register(swagger, {
    openapi: { info: { title: 'Frota API', version: '0.1.0', description: 'Multas e vencimentos de CNH/CRLV' } },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(vehicleRoutes(db));
  await app.register(driverRoutes(db));
  await app.register(fineRoutes(db));
  await app.register(expirationRoutes(db));

  return app;
}
