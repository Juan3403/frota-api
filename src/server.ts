import { buildApp } from './app.js';
import { createPgDb } from './db-pg.js';
import { migrate } from './migrate.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Defina DATABASE_URL (veja .env.example)');

const db = createPgDb(url);
await migrate(db);
const app = await buildApp(db);
await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
