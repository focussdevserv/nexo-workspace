type ClicksignResource = { id?: string; attributes?: Record<string, unknown> };
type ClicksignResponse = { data?: ClicksignResource };

export function clicksignBaseUrl(raw = 'https://sandbox.clicksign.com') {
  const baseUrl = raw.replace(/\/$/, '');
  let origin = '';
  try { origin = new URL(baseUrl).origin; } catch { throw new Error('clicksign_invalid_base_url'); }
  if (!['https://sandbox.clicksign.com', 'https://app.clicksign.com'].includes(origin) || origin !== baseUrl) throw new Error('clicksign_invalid_base_url');
  return baseUrl;
}

async function request(baseUrl: string, token: string, path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${baseUrl}/api/v3${path}`, {
    method,
    headers: { Authorization: token, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw Object.assign(new Error(`clicksign_http_${response.status}`), { statusCode: response.status });
  return response.status === 204 ? {} : await response.json() as ClicksignResponse;
}

function resourceId(response: ClicksignResponse, label: string) {
  const id = response.data?.id;
  if (!id || typeof id !== 'string') throw new Error(`clicksign_${label}_id_missing`);
  return id;
}

export async function createClicksignEnvelope(input: {
  baseUrl: string; token: string; name: string; filename: string; text: string; signerName: string; signerEmail: string;
}) {
  const envelopeBase = clicksignBaseUrl(input.baseUrl);
  const envelope = await request(envelopeBase, input.token, '/envelopes', 'POST', { data: { type: 'envelopes', attributes: { name: input.name, locale: 'pt-BR', auto_close: true, remind_interval: '3' } } });
  const envelopeId = resourceId(envelope, 'envelope');
  const document = await request(envelopeBase, input.token, `/envelopes/${encodeURIComponent(envelopeId)}/documents`, 'POST', { data: { type: 'documents', attributes: { filename: input.filename, content_base64: `data:text/plain;base64,${Buffer.from(input.text, 'utf8').toString('base64')}` } } });
  const documentId = resourceId(document, 'document');
  const signer = await request(envelopeBase, input.token, `/envelopes/${encodeURIComponent(envelopeId)}/signers`, 'POST', { data: { type: 'signers', attributes: { name: input.signerName, email: input.signerEmail, communicate_events: { signature_request: 'email', signature_reminder: 'email', document_signed: 'email' } } } });
  const signerId = resourceId(signer, 'signer');
  const relationship = { document: { data: { type: 'documents', id: documentId } }, signer: { data: { type: 'signers', id: signerId } } };
  await request(envelopeBase, input.token, `/envelopes/${encodeURIComponent(envelopeId)}/requirements`, 'POST', { data: { type: 'requirements', attributes: { action: 'agree', role: 'sign' }, relationships: relationship } });
  await request(envelopeBase, input.token, `/envelopes/${encodeURIComponent(envelopeId)}/requirements`, 'POST', { data: { type: 'requirements', attributes: { action: 'provide_evidence', auth: 'email' }, relationships: relationship } });
  await request(envelopeBase, input.token, `/envelopes/${encodeURIComponent(envelopeId)}`, 'PATCH', { data: { id: envelopeId, type: 'envelopes', attributes: { status: 'running' } } });
  return { envelopeId, documentId, signerId };
}

export async function notifyClicksignEnvelope(baseUrl: string, token: string, envelopeId: string) {
  await request(clicksignBaseUrl(baseUrl), token, `/envelopes/${encodeURIComponent(envelopeId)}/notifications`, 'POST', { data: { type: 'notifications', attributes: {} } });
}

export async function getClicksignEnvelope(baseUrl: string, token: string, envelopeId: string) {
  const response = await request(clicksignBaseUrl(baseUrl), token, `/envelopes/${encodeURIComponent(envelopeId)}`);
  return { id: resourceId(response, 'envelope'), status: String(response.data?.attributes?.status || '') };
}
