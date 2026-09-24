import { randomUUID } from 'node:crypto';

export function buildGoogleRawMessage(input: { to: string; subject: string; html: string; text: string }) {
  const encodedSubject = Buffer.from(input.subject, 'utf8').toString('base64');
  const boundary = `nexo_${randomUUID().replaceAll('-', '')}`;
  const encodeBody = (value: string) => Buffer.from(value, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n').trim();
  const raw = [
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
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
