import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createPgliteDb } from '../src/db-pglite.js';
import { migrate } from '../src/migrate.js';

process.env.NODE_ENV = 'test';

const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function setup() {
  const db = createPgliteDb();
  await migrate(db);
  return buildApp(db);
}

describe('Frota API', () => {
  let app: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    app = await setup();
  });

  const criaVeiculo = (placa = 'ABC1D23', venc = dias(100)) =>
    app.inject({ method: 'POST', url: '/vehicles', payload: { placa, modelo: 'Hilux', crlv_vencimento: venc } });

  it('cria e busca veículo', async () => {
    const res = await criaVeiculo();
    expect(res.statusCode).toBe(201);
    const get = await app.inject({ url: `/vehicles/${res.json().id}` });
    expect(get.json().placa).toBe('ABC1D23');
  });

  it('rejeita placa inválida (400) e duplicada (409)', async () => {
    expect((await criaVeiculo('INVALIDA')).statusCode).toBe(400);
    await criaVeiculo();
    expect((await criaVeiculo()).statusCode).toBe(409);
  });

  it('404 para veículo inexistente', async () => {
    expect((await app.inject({ url: '/vehicles/999' })).statusCode).toBe(404);
  });

  it('multa exige veículo existente (422) e muda de status', async () => {
    const ruim = await app.inject({
      method: 'POST',
      url: '/fines',
      payload: { vehicle_id: 99, descricao: 'Excesso de velocidade', valor: 130.16, data_infracao: dias(-5) },
    });
    expect(ruim.statusCode).toBe(422);

    const v = (await criaVeiculo()).json();
    const f = await app.inject({
      method: 'POST',
      url: '/fines',
      payload: { vehicle_id: v.id, descricao: 'Excesso de velocidade', valor: 130.16, data_infracao: dias(-5) },
    });
    expect(f.statusCode).toBe(201);
    expect(f.json().status).toBe('aberta');

    const paga = await app.inject({ method: 'PATCH', url: `/fines/${f.json().id}/status`, payload: { status: 'paga' } });
    expect(paga.json().status).toBe('paga');

    const resumo = await app.inject({ url: '/fines/summary' });
    expect(resumo.json()).toEqual([{ status: 'paga', quantidade: 1, total: 130.16 }]);
  });

  it('lista vencimentos dentro da janela, incluindo vencidos', async () => {
    await criaVeiculo('AAA1A11', dias(10));
    await criaVeiculo('BBB2B22', dias(-3));
    await criaVeiculo('CCC3C33', dias(200));
    await app.inject({
      method: 'POST',
      url: '/drivers',
      payload: { nome: 'Joao', cnh_numero: '12345678901', cnh_vencimento: dias(20) },
    });

    const res = await app.inject({ url: '/vencimentos?dias=30' });
    const refs = res.json().map((r: { referencia: string }) => r.referencia);
    expect(refs).toEqual(['BBB2B22', 'AAA1A11', 'Joao']);
    expect(res.json()[0].dias_restantes).toBe(-3);
  });

  it('pagina listagens com limit/offset e X-Total-Count', async () => {
    for (const p of ['AAA1A11', 'BBB2B22', 'CCC3C33']) await criaVeiculo(p);
    const res = await app.inject({ url: '/vehicles?limit=2&offset=1' });
    expect(res.headers['x-total-count']).toBe('3');
    expect(res.json().map((v: { placa: string }) => v.placa)).toEqual(['BBB2B22', 'CCC3C33']);
    expect((await app.inject({ url: '/vehicles?limit=0' })).statusCode).toBe(400);
    expect((await app.inject({ url: '/drivers?limit=5' })).headers['x-total-count']).toBe('0');
    expect((await app.inject({ url: '/fines?limit=5' })).headers['x-total-count']).toBe('0');
  });

  it('expõe OpenAPI', async () => {
    const res = await app.inject({ url: '/docs/json' });
    expect(res.json().paths['/vencimentos']).toBeDefined();
  });
});
