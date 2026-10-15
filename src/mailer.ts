import nodemailer from 'nodemailer';

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** Retorna undefined quando o SMTP não está configurado (notificação fica desativada). */
export function createSmtpMailer(env: NodeJS.ProcessEnv): Mailer | undefined {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = env;
  if (!SMTP_HOST || !SMTP_FROM) return undefined;
  const port = Number(SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from: SMTP_FROM, to, subject, text });
    },
  };
}
