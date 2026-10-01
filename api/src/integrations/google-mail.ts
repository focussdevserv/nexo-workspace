import { randomUUID } from 'node:crypto';

export type GoogleMailAttachment = { filename: string; mimeType: string; data: Buffer };

export function googleMailAddresses(values: unknown[]) {
  const emails = values.flatMap((value) => typeof value === 'string'
    ? value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
    : []);
  return [...new Set(emails.map((email) => email.toLocaleLowerCase('en-US')))];
}

export function googleThreadBelongsToAllowedContacts(participants: string[], allowedEmails: Set<string>, accountEmail = '') {
  const account = accountEmail.toLocaleLowerCase('en-US');
  const unique = [...new Set(participants.map((email) => email.toLocaleLowerCase('en-US')))];
  return unique.some((email) => allowedEmails.has(email)) && unique.every((email) => email === account || allowedEmails.has(email));
}

const MAX_GOOGLE_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export function decodeGoogleMailAttachments(input: Array<{ filename: string; mimeType: string; contentBase64: string }> = [], maxBytes = MAX_GOOGLE_ATTACHMENT_BYTES): GoogleMailAttachment[] {
  if (input.length > 5) throw new Error('gmail_attachment_invalid');
  let totalBytes = 0;
  return input.map((attachment) => {
    if (!attachment.filename.trim() || attachment.filename.length > 255 || /[\r\n\0]/.test(attachment.filename)) throw new Error('gmail_attachment_invalid');
    const data = decodeGoogleDriveUpload(attachment.contentBase64, maxBytes);
    totalBytes += data.length;
    if (totalBytes > maxBytes) throw new Error('gmail_attachment_invalid');
    const mimeType = /^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(attachment.mimeType) ? attachment.mimeType.toLowerCase() : 'application/octet-stream';
    return { filename: attachment.filename, mimeType, data };
  });
}

export function buildGoogleRawMessage(input: { to: string; subject: string; html: string; text: string; inReplyTo?: string; references?: string; attachments?: GoogleMailAttachment[] }) {
  const encodedSubject = Buffer.from(input.subject, 'utf8').toString('base64');
  const boundary = `nexo_${randomUUID().replaceAll('-', '')}`;
  const encodeBody = (value: string) => Buffer.from(value, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n').trim();
  const alternatives = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(input.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBody(input.html),
    `--${boundary}--`,
  ].join('\r\n');
  const headers = [
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    ...(input.inReplyTo && !/[\r\n]/.test(input.inReplyTo) ? [`In-Reply-To: ${input.inReplyTo}`] : []),
    ...(input.references && !/[\r\n]/.test(input.references) ? [`References: ${input.references}`] : []),
    'MIME-Version: 1.0',
  ];
  const raw = input.attachments?.length ? [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}_mixed"`,
    '',
    `--${boundary}_mixed`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    alternatives,
    ...(input.attachments.flatMap((attachment) => {
      const filename = encodeURIComponent(attachment.filename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
      const mimeType = /^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(attachment.mimeType) ? attachment.mimeType : 'application/octet-stream';
      const data = attachment.data.toString('base64').replace(/.{1,76}/g, '$&\r\n').trim();
      return [`--${boundary}_mixed`, `Content-Type: ${mimeType}; name*=UTF-8''${filename}`, `Content-Disposition: attachment; filename*=UTF-8''${filename}`, 'Content-Transfer-Encoding: base64', '', data];
    })),
    `--${boundary}_mixed--`,
    '',
  ].join('\r\n') : [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    alternatives,
    '',
  ].join('\r\n');
  return Buffer.from(raw, 'utf8').toString('base64url');
}

export function decodeGoogleDriveUpload(base64: string, maxBytes = 8 * 1024 * 1024) {
  if (!base64 || base64.length > Math.ceil(maxBytes * 4 / 3) + 8 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error('drive_upload_invalid');
  }
  const data = Buffer.from(base64, 'base64');
  if (!data.length || data.length > maxBytes || data.toString('base64') !== base64) throw new Error('drive_upload_invalid');
  return data;
}

export type GoogleMailMessage = {
  id: string; threadId: string; messageId: string; references: string; from: string; to: string; subject: string;
  date: string; text: string; unread: boolean; side: 'received' | 'sent';
};

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailPayload = { mimeType?: string; headers?: Array<{ name?: string; value?: string }>; body?: { data?: string }; parts?: GmailPart[] };
type GmailApiMessage = { id?: string; threadId?: string; internalDate?: string; labelIds?: string[]; payload?: GmailPayload; snippet?: string };

function decodeHeader(value: string) {
  return value.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_match, charset: string, encoding: string, data: string) => {
    try {
      const bytes = encoding.toLowerCase() === 'b' ? Buffer.from(data, 'base64') : Buffer.from(data.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (_hex, pair: string) => String.fromCharCode(parseInt(pair, 16))), 'binary');
      return new TextDecoder(charset).decode(bytes);
    } catch { return data; }
  });
}

function decodePart(part: GmailPart): string {
  if (part.body?.data) return Buffer.from(part.body.data, 'base64url').toString('utf8');
  return (part.parts || []).map(decodePart).find(Boolean) || '';
}

function bodyText(payload: GmailPayload): string {
  const parts = payload.parts || [];
  const plain = parts.find((part) => part.mimeType === 'text/plain' && Boolean(part.body?.data));
  if (plain) return decodePart(plain).slice(0, 20_000);
  const html = parts.find((part) => part.mimeType === 'text/html' && Boolean(part.body?.data));
  const body = plain ? decodePart(plain) : html ? decodePart(html).replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&') : decodePart(payload);
  return (body || '').replace(/\r\n/g, '\n').trim().slice(0, 20_000);
}

export function mapGoogleMailMessage(message: GmailApiMessage, accountEmail: string): GoogleMailMessage {
  const headers = new Map((message.payload?.headers || []).map((header) => [String(header.name || '').toLowerCase(), decodeHeader(String(header.value || ''))]));
  const from = headers.get('from') || '';
  const sender = from.match(/<([^>]+)>/)?.[1] || from;
  return {
    id: String(message.id || ''), threadId: String(message.threadId || ''), messageId: headers.get('message-id') || '', references: headers.get('references') || '',
    from, to: headers.get('to') || '', subject: headers.get('subject') || '(sem assunto)',
    date: headers.get('date') || (message.internalDate ? new Date(Number(message.internalDate)).toISOString() : ''),
    text: bodyText(message.payload || {}), unread: Boolean(message.labelIds?.includes('UNREAD')),
    side: sender.trim().toLowerCase() === accountEmail.trim().toLowerCase() ? 'sent' : 'received',
  };
}
