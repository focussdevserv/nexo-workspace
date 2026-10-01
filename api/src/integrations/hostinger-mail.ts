import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

export type HostingerCredentials = { email: string; password: string };

export function normalizeHostingerCredentials(input: unknown): HostingerCredentials {
  if (!input || typeof input !== 'object') throw new Error('hostinger_credentials_invalid');
  const value = input as Record<string, unknown>;
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  const password = typeof value.password === 'string' ? value.password : '';
  if (!/^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email) || email.length > 254) throw new Error('hostinger_email_invalid');
  if (!password || password.length > 256 || /[\r\n\0]/.test(password)) throw new Error('hostinger_password_invalid');
  return { email, password };
}

export async function verifyHostingerMailbox(credentials: HostingerCredentials) {
  const imap = new ImapFlow({
    host: 'imap.hostinger.com', port: 993, secure: true,
    auth: { user: credentials.email, pass: credentials.password },
    logger: false, connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 8_000,
  });
  try {
    await imap.connect();
    await imap.logout();
  } finally {
    if (!imap.usable) imap.close();
  }

  const smtp = nodemailer.createTransport({
    host: 'smtp.hostinger.com', port: 465, secure: true,
    auth: { user: credentials.email, pass: credentials.password },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 8_000,
  });
  try { await smtp.verify(); }
  finally { smtp.close(); }
}
