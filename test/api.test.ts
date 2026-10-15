import type { InjectOptions } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createPgliteDb } from '../src/db-pglite.js';
import { migrate } from '../src/migrate.js';
import { criaAdminInicial } from '../src/routes/auth.js';
import { criaNotificador, deveEnviar } from '../src/notificacao.js';
import type { Mailer } from '../src/mailer.js';

process.env.NODE_ENV = 'test';

const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const SENHA = 'senha-forte-123';

const enviados: { to: string; subject: string; text: string }[] = [];
const mailerFalso: Mailer = { send: async (to, subject, text) => void enviados.push({ to, subject, text }) };

async function setup(comEmail = true) {
  const db = createPgliteDb();
  await migrate(db);
  await criaAdminInicial(db, 'admin@frota.test', SENHA);
  const notificador = comEmail ? criaNotificador(db, mailerFalso, 'gestor@frota.test') : undefined;
  return buildApp(db, { jwtSecret: 'x'.repeat(32), notificador });
}

describe('Frota API', () => {
  let app: Awaited<ReturnType<typeof setup>>;
  let token: string;
  const login = async (email: string, senha: string) => app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha } });
  // Requisição autenticada como admin, salvo se `headers` trouxer outro Authorization.
  const api = (o: InjectOptions) =>
    app.inject({ ...o, headers: { authorization: `Bearer ${token}`, ...o.headers } });

  beforeEach(async () => {
    enviados.length = 0;
    app = await setup();
    token = (await login('admin@frota.test', SENHA)).json().token;
  });

  const criaVeiculo = (placa = 'ABC1D23', venc = dias(100)) =>
    api({ method: 'POST', url: '/vehicles', payload: { placa, modelo: 'Hilux', crlv_vencimento: venc } });

  it('cria e busca veículo', async () => {
    const res = await criaVeiculo();
    expect(res.statusCode).toBe(201);
    const get = await api({ url: `/vehicles/${res.json().id}` });
    expect(get.json().placa).toBe('ABC1D23');
  });

  it('rejeita placa inválida (400) e duplicada (409)', async () => {
    expect((await criaVeiculo('INVALIDA')).statusCode).toBe(400);
    await criaVeiculo();
    expect((await criaVeiculo()).statusCode).toBe(409);
  });

  it('404 para veículo inexistente', async () => {
    expect((await api({ url: '/vehicles/999' })).statusCode).toBe(404);
  });

  it('multa exige veículo existente (422) e muda de status', async () => {
    const ruim = await api({
      method: 'POST',
      url: '/fines',
      payload: { vehicle_id: 99, descricao: 'Excesso de velocidade', valor: 130.16, data_infracao: dias(-5) },
    });
    expect(ruim.statusCode).toBe(422);

    const v = (await criaVeiculo()).json();
    const f = await api({
      method: 'POST',
      url: '/fines',
      payload: { vehicle_id: v.id, descricao: 'Excesso de velocidade', valor: 130.16, data_infracao: dias(-5) },
    });
    expect(f.statusCode).toBe(201);
    expect(f.json().status).toBe('aberta');

    const paga = await api({ method: 'PATCH', url: `/fines/${f.json().id}/status`, payload: { status: 'paga' } });
    expect(paga.json().status).toBe('paga');

    const resumo = await api({ url: '/fines/summary' });
    expect(resumo.json()).toEqual([{ status: 'paga', quantidade: 1, total: 130.16 }]);
  });

  it('lista vencimentos dentro da janela, incluindo vencidos', async () => {
    await criaVeiculo('AAA1A11', dias(10));
    await criaVeiculo('BBB2B22', dias(-3));
    await criaVeiculo('CCC3C33', dias(200));
    await api({
      method: 'POST',
      url: '/drivers',
      payload: { nome: 'Joao', cnh_numero: '12345678901', cnh_vencimento: dias(20) },
    });

    const res = await api({ url: '/vencimentos?dias=30' });
    const refs = res.json().map((r: { referencia: string }) => r.referencia);
    expect(refs).toEqual(['BBB2B22', 'AAA1A11', 'Joao']);
    expect(res.json()[0].dias_restantes).toBe(-3);
  });

  it('pagina listagens com limit/offset e X-Total-Count', async () => {
    for (const p of ['AAA1A11', 'BBB2B22', 'CCC3C33']) await criaVeiculo(p);
    const res = await api({ url: '/vehicles?limit=2&offset=1' });
    expect(res.headers['x-total-count']).toBe('3');
    expect(res.json().map((v: { placa: string }) => v.placa)).toEqual(['BBB2B22', 'CCC3C33']);
    expect((await api({ url: '/vehicles?limit=0' })).statusCode).toBe(400);
    expect((await api({ url: '/drivers?limit=5' })).headers['x-total-count']).toBe('0');
    expect((await api({ url: '/fines?limit=5' })).headers['x-total-count']).toBe('0');
  });

  it('exige token, mas libera /health e /docs', async () => {
    expect((await app.inject({ url: '/vehicles' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/vehicles', headers: { authorization: 'Bearer lixo' } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/docs/json' })).statusCode).toBe(200);
  });

  it('login rejeita senha errada e e-mail inexistente com a mesma resposta', async () => {
    const errada = await login('admin@frota.test', 'senha-errada-123');
    const inexistente = await login('ninguem@frota.test', SENHA);
    expect(errada.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    expect(inexistente.json()).toEqual(errada.json());
    expect((await login('admin@frota.test', 'curta')).statusCode).toBe(400);
  });

  it('leitor consulta mas não escreve; só admin cria usuários', async () => {
    const novo = await api({ method: 'POST', url: '/users', payload: { email: 'Leitor@Frota.test', senha: SENHA, papel: 'leitor' } });
    expect(novo.statusCode).toBe(201);
    expect(novo.json()).toEqual({ id: expect.any(Number), email: 'leitor@frota.test', papel: 'leitor' });
    expect((await api({ method: 'POST', url: '/users', payload: { email: 'leitor@frota.test', senha: SENHA, papel: 'admin' } })).statusCode).toBe(409);

    const t = (await login('leitor@frota.test', SENHA)).json().token;
    const como = { authorization: `Bearer ${t}` };
    expect((await api({ url: '/vehicles', headers: como })).statusCode).toBe(200);
    const escrita = await api({ method: 'POST', url: '/vehicles', headers: como, payload: { placa: 'ABC1D23', modelo: 'X', crlv_vencimento: dias(5) } });
    expect(escrita.statusCode).toBe(403);
    expect((await api({ method: 'POST', url: '/users', headers: como, payload: { email: 'a@b.co', senha: SENHA, papel: 'admin' } })).statusCode).toBe(403);
  });

  it('notifica vencimentos por e-mail só quando há itens', async () => {
    const vazio = await api({ method: 'POST', url: '/vencimentos/notificar?dias=30' });
    expect(vazio.json()).toEqual({ enviados: 0 });
    expect(enviados).toHaveLength(0);

    await criaVeiculo('AAA1A11', dias(10));
    await criaVeiculo('BBB2B22', dias(-3));
    const res = await api({ method: 'POST', url: '/vencimentos/notificar?dias=30' });
    expect(res.json()).toEqual({ enviados: 2 });
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.to).toBe('gestor@frota.test');
    expect(enviados[0]?.subject).toContain('2 documento(s)');
    expect(enviados[0]?.text).toContain('CRLV BBB2B22');
    expect(enviados[0]?.text).toContain('VENCIDO há 3 dia(s)');
  });

  it('notificar: 503 sem e-mail configurado e 403 para leitor', async () => {
    const sem = await setup(false);
    const t = (await sem.inject({ method: 'POST', url: '/auth/login', payload: { email: 'admin@frota.test', senha: SENHA } })).json().token;
    const r = await sem.inject({ method: 'POST', url: '/vencimentos/notificar', headers: { authorization: `Bearer ${t}` } });
    expect(r.statusCode).toBe(503);

    await api({ method: 'POST', url: '/users', payload: { email: 'l@frota.test', senha: SENHA, papel: 'leitor' } });
    const tl = (await login('l@frota.test', SENHA)).json().token;
    expect((await api({ method: 'POST', url: '/vencimentos/notificar', headers: { authorization: `Bearer ${tl}` } })).statusCode).toBe(403);
  });

  it('agendador envia uma vez por dia, depois da hora configurada', () => {
    const d = (h: number, dia = 15) => new Date(2026, 9, dia, h, 0);
    expect(deveEnviar(d(7), 8, undefined)).toBe(false);
    expect(deveEnviar(d(8), 8, undefined)).toBe(true);
    expect(deveEnviar(d(15), 8, d(8).toDateString())).toBe(false);
    expect(deveEnviar(d(8, 16), 8, d(8).toDateString())).toBe(true);
  });

  it('expõe OpenAPI', async () => {
    const res = await api({ url: '/docs/json' });
    expect(res.json().paths['/vencimentos']).toBeDefined();
  });
});
