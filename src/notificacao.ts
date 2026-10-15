import type { Db } from './db.js';
import type { Mailer } from './mailer.js';
import { buscaVencimentos, type Vencimento } from './vencimentos.js';

/** Devolve a quantidade de itens notificados (0 = nada a avisar, nenhum e-mail enviado). */
export type Notificador = (dias: number) => Promise<number>;

const situacao = (d: number) => (d < 0 ? `VENCIDO há ${-d} dia(s)` : d === 0 ? 'vence HOJE' : `vence em ${d} dia(s)`);

export function montaResumo(itens: Vencimento[], dias: number) {
  const linhas = itens.map((i) => `- ${i.documento} ${i.referencia}: ${i.vencimento} (${situacao(i.dias_restantes)})`);
  const vencidos = itens.filter((i) => i.dias_restantes < 0).length;
  const sufixo = vencidos ? ` (${vencidos} já vencido(s))` : '';
  return {
    assunto: `Frota: ${itens.length} documento(s) vencido(s) ou a vencer em ${dias} dias${sufixo}`,
    texto: `Documentos vencidos ou a vencer em até ${dias} dias:\n\n${linhas.join('\n')}\n`,
  };
}

export const criaNotificador =
  (db: Db, mailer: Mailer, para: string): Notificador =>
  async (dias) => {
    const itens = await buscaVencimentos(db, dias);
    if (!itens.length) return 0;
    const { assunto, texto } = montaResumo(itens, dias);
    await mailer.send(para, assunto, texto);
    return itens.length;
  };

/** Envia no máximo uma vez por dia, a partir da hora configurada (hora local do servidor). */
export const deveEnviar = (agora: Date, hora: number, ultimoEnvio: string | undefined) =>
  agora.getHours() >= hora && ultimoEnvio !== agora.toDateString();

export function iniciaAgendador(
  notificar: Notificador,
  opts: { dias: number; hora: number; log: (msg: string) => void },
) {
  let ultimo: string | undefined;
  const tick = async () => {
    const agora = new Date();
    if (!deveEnviar(agora, opts.hora, ultimo)) return;
    try {
      const n = await notificar(opts.dias);
      ultimo = agora.toDateString(); // só marca após sucesso: em falha tenta de novo no próximo ciclo
      opts.log(`Notificação de vencimentos: ${n} item(ns)`);
    } catch (err) {
      opts.log(`Falha ao enviar notificação: ${(err as Error).message}`);
    }
  };
  void tick();
  return setInterval(tick, 10 * 60 * 1000).unref();
}
