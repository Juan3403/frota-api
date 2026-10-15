import { buildApp } from './app.js';
import { createPgDb } from './db-pg.js';
import { migrate } from './migrate.js';
import { criaAdminInicial } from './routes/auth.js';
import { createSmtpMailer } from './mailer.js';
import { criaNotificador, iniciaAgendador } from './notificacao.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Defina DATABASE_URL (veja .env.example)');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error('Defina JWT_SECRET com pelo menos 32 caracteres (veja .env.example)');

const db = createPgDb(url);
await migrate(db);
if (await criaAdminInicial(db, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)) {
  console.log(`Admin inicial criado: ${process.env.ADMIN_EMAIL}`);
}
const mailer = createSmtpMailer(process.env);
const para = process.env.NOTIFY_TO;
const notificador = mailer && para ? criaNotificador(db, mailer, para) : undefined;
const app = await buildApp(db, { jwtSecret, notificador });
await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });

if (notificador) {
  iniciaAgendador(notificador, {
    dias: Number(process.env.NOTIFY_DAYS ?? 30),
    hora: Number(process.env.NOTIFY_HOUR ?? 8),
    log: (msg) => app.log.info(msg),
  });
} else {
  app.log.info('Notificação por e-mail desativada (defina SMTP_HOST, SMTP_FROM e NOTIFY_TO)');
}
