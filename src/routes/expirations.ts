import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Db } from '../db.js';
import type { Notificador } from '../notificacao.js';
import { buscaVencimentos } from '../vencimentos.js';

const Dias = Type.Integer({ minimum: 0, maximum: 365, default: 30 });

export const expirationRoutes = (db: Db, notificador?: Notificador): FastifyPluginAsyncTypebox => async (app) => {
  app.get(
    '/vencimentos',
    {
      schema: {
        tags: ['vencimentos'],
        description: 'Lista documentos vencidos ou a vencer em até `dias` dias',
        querystring: Type.Object({ dias: Dias }),
      },
    },
    (req) => buscaVencimentos(db, req.query.dias),
  );

  app.post(
    '/vencimentos/notificar',
    {
      schema: {
        tags: ['vencimentos'],
        description: 'Envia agora o resumo de vencimentos por e-mail ao destinatário configurado (NOTIFY_TO)',
        querystring: Type.Object({ dias: Dias }),
      },
    },
    async (req, reply) => {
      if (!notificador) return reply.code(503).send({ error: 'Notificação por e-mail não configurada' });
      const enviados = await notificador(req.query.dias);
      return { enviados };
    },
  );
};
