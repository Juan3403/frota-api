import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

const derive = (senha: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(senha, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await derive(senha, salt)).toString('hex')}`;
}

export async function confereSenha(senha: string, armazenado: string): Promise<boolean> {
  const [salt, hash] = armazenado.split(':');
  if (!salt || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const obtido = await derive(senha, Buffer.from(salt, 'hex'));
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}
