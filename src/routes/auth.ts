import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { Db } from '../db.js';
import { confereSenha, hashSenha } from '../password.js';

const Papel = Type.Union([Type.Literal('admin'), Type.Literal('leitor')]);
const Credenciais = Type.Object({
  email: Type.String({ format: 'email' }),
  senha: Type.String({ minLength: 8 }),
});

type UserRow = { id: number; email: string; senha_hash: string; papel: 'admin' | 'leitor' };

// Hash fixo para que e-mail inexistente gaste o mesmo tempo que senha errada.
const hashFalso = await hashSenha('senha-inexistente');

export const authRoutes = (db: Db): FastifyPluginAsyncTypebox => async (app) => {
  app.post(
    '/auth/login',
    { schema: { tags: ['auth'], security: [], body: Credenciais } },
    async (req, reply) => {
      const [user] = await db.query<UserRow>('SELECT id, email, senha_hash, papel FROM users WHERE email=$1', [
        req.body.email.toLowerCase(),
      ]);
      const ok = await confereSenha(req.body.senha, user?.senha_hash ?? hashFalso);
      if (!user || !ok) return reply.code(401).send({ error: 'Credenciais inválidas' });
      const token = app.jwt.sign({ sub: String(user.id), papel: user.papel }, { expiresIn: '8h' });
      return { token };
    },
  );

  app.post(
    '/users',
    { schema: { tags: ['auth'], body: Type.Object({ ...Credenciais.properties, papel: Papel }) } },
    async (req, reply) => {
      const [row] = await db.query(
        'INSERT INTO users (email, senha_hash, papel) VALUES ($1,$2,$3) RETURNING id, email, papel',
        [req.body.email.toLowerCase(), await hashSenha(req.body.senha), req.body.papel],
      );
      return reply.code(201).send(row);
    },
  );
};

/** Cria o primeiro admin a partir do ambiente quando ainda não há usuários. */
export async function criaAdminInicial(db: Db, email?: string, senha?: string): Promise<boolean> {
  if (!email || !senha) return false;
  const [n] = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM users');
  if (n?.n) return false;
  await db.query('INSERT INTO users (email, senha_hash, papel) VALUES ($1,$2,$3)', [
    email.toLowerCase(),
    await hashSenha(senha),
    'admin',
  ]);
  return true;
}
