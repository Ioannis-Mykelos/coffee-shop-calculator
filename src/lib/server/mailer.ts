import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import type { SendMail } from './accounts';

// Account emails over SMTP (EMAIL_SERVER_* in .env.local). Without SMTP settings, in development, the email is
// printed to the terminal instead, so the confirmation link can be opened from there.

let transport: Transporter | undefined;

export const sendMail: SendMail = async ({ to, subject, text, html }) => {
  const host = process.env.EMAIL_SERVER_HOST;
  if (!host) {
    if (process.env.NODE_ENV === 'production') throw new Error('EMAIL_SERVER_HOST is not set: account emails cannot be sent.');
    console.info(`\n[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}\n`);
    return;
  }
  const port = Number(process.env.EMAIL_SERVER_PORT ?? 587);
  transport ??= nodemailer.createTransport({
    host,
    port,
    // Port 465 speaks TLS from the start; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD },
  });
  await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html });
};
