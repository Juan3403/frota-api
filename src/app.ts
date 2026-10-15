import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Db } from './db.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { driverRoutes } from './routes/drivers.js';
import { fineRoutes } from './routes/fines.js';
import { expirationRoutes } from './routes/expirations.js';
import { authRoutes } from './routes/auth.js';
import type { Notificador } from './notificacao.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; papel: 'admin' | 'leitor' };
    user: { sub: string; papel: 'admin' | 'leitor' };
  }
}

const PUBLICAS = ['/health', '/auth/login'];
const LEITURA = ['GET', 'HEAD'];

export async function buildApp(db: Db, opts: { jwtSecret: string; notificador?: Notificador }) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' }).withTypeProvider<TypeBoxTypeProvider>();

  app.setErrorHandler((err: any, _req, reply) => {
    if (err.code === '23505') return reply.code(409).send({ error: 'Registro duplicado' });
    if (err.code === '23503') return reply.code(422).send({ error: 'Referência inexistente' });
    if (err.statusCode === 401 || err.code?.startsWith('FST_JWT_')) return reply.code(401).send({ error: 'Não autenticado' });
    if (err.validation) return reply.code(400).send({ error: err.message });
    app.log.error(err);
    return reply.code(500).send({ error: 'Erro interno' });
  });

  await app.register(swagger, {
    openapi: {
      info: { title: 'Frota API', version: '0.1.0', description: 'Multas e vencimentos de CNH/CRLV' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security: [{ bearer: [] }],
    },
  });
  await app.register(jwt, { secret: opts.jwtSecret });

  // Tudo exige token, exceto saúde, login e a documentação. Escrita só para admin.
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0] ?? '';
    if (PUBLICAS.includes(path) || path === '/docs' || path.startsWith('/docs/')) return;
    await req.jwtVerify();
    if (!LEITURA.includes(req.method) && req.user.papel !== 'admin') {
      return reply.code(403).send({ error: 'Permissão insuficiente' });
    }
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(authRoutes(db));
  await app.register(vehicleRoutes(db));
  await app.register(driverRoutes(db));
  await app.register(fineRoutes(db));
  await app.register(expirationRoutes(db, opts.notificador));

  return app;
}
