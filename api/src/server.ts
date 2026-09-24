import 'dotenv/config';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import argon2 from 'argon2';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db, pool } from './db/index.js';
import { activityEvents, billingOrders, billingSubscriptions, clients, organizations, users, workspaceRecords } from './db/schema.js';
import { isSafeWorkspaceData } from './security/workspace-data.js';
import { renderProposalEmail } from './email/proposal.js';
import { mapN8nCollections, n8nAutomationTemplates, buildN8nAutomationWorkflow, n8nApiKeyFailureMessage, n8nApiValidationMessage, type N8nAutomationTemplateId } from './integrations/n8n.js';

const env = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(32),
  OWNER_EMAIL: z.string().email().default('contato@focussdev.art').transform((value) => value.trim().toLowerCase()),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  WAHA_API_URL: z.string().url().optional(),
  WAHA_API_KEY: z.string().min(32).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
}).parse(process.env);

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024, trustProxy: process.env.TRUST_PROXY === 'true' });
await app.register(helmet);
await app.register(cookie);
await app.register(cors, { origin: env.APP_ORIGIN.split(',').map((origin) => z.string().url().parse(origin.trim())), credentials: true });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(jwt, { secret: env.JWT_SECRET, cookie: { cookieName: 'nexo_session', signed: false }, sign: { expiresIn: '8h' } });

const allowedOrigins = env.APP_ORIGIN.split(',').map((origin) => z.string().url().parse(origin.trim()));
let ownerAccountId: string | null = null;
app.addHook('onRequest', async (request, reply) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || request.url.startsWith('/api/integrations/mercadopago/webhook') || request.url === '/api/integrations/waha/webhook' || request.url === '/api/integrations/n8n/actions') return;
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return reply.code(403).send({ error: 'origin_forbidden', message: 'Origem da solicitacao nao autorizada.' });
});

app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify({ onlyCookie: true });
    if (request.user.purpose) return reply.code(401).send({ error: 'unauthorized', message: 'Sessao invalida ou expirada.' });
    const [owner] = await db.select({ id: users.id }).from(users).where(and(
      eq(users.id, request.user.sub), eq(users.id, ownerAccountId ?? '00000000-0000-0000-0000-000000000000'),
      eq(users.organizationId, request.user.organizationId), eq(users.active, true),
    )).limit(1);
    if (!owner) return reply.code(401).send({ error: 'unauthorized', message: 'Sessao invalida ou expirada.' });
  } catch { return reply.code(401).send({ error: 'unauthorized', message: 'Sessao invalida ou expirada.' }); }
});

const loginSchema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(1).max(128) });
const clientSchema = z.object({
  name: z.string().trim().min(2).max(180),
  legalName: z.string().trim().max(180).nullish(),
  contactName: z.string().trim().max(180).nullish(),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).nullish(),
  phone: z.string().trim().max(40).nullish(),
  document: z.string().trim().max(40).nullish(),
  status: z.enum(['active', 'inactive']).optional(),
  source: z.string().trim().max(100).nullish(),
  notes: z.string().trim().max(5000).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});
const workspaceResource = z.enum([
  'leads', 'clients', 'companies', 'contacts', 'proposals', 'services', 'contracts',
  'projects', 'tasks', 'events', 'approvals', 'files', 'hours', 'inbox',
  'tickets', 'site-assets', 'monitors', 'expenses', 'revenues', 'finance-accounts', 'finance-transactions',
  'goals', 'team', 'repositories', 'automations', 'settings',
]);
const workspaceDataSchema = z.record(z.string().trim().min(1).max(100), z.unknown()).refine(isSafeWorkspaceData,
  'O registro contém uma chave privada/insegura, é profundo demais ou excede o limite permitido.');
const paymentOrderSchema = z.object({
  clientId: z.string().uuid().optional(),
  clientName: z.string().trim().min(2).max(180),
  payerEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  description: z.string().trim().min(2).max(250),
  amount: z.coerce.number().positive().max(1000000),
  method: z.enum(['pix', 'boleto', 'credit_card', 'debit_card']),
  identificationType: z.string().trim().max(10).optional(),
  identificationNumber: z.string().trim().max(30).optional(),
  cardToken: z.string().trim().min(8).max(300).optional(),
  paymentMethodId: z.string().trim().max(40).optional(),
  installments: z.coerce.number().int().min(1).max(24).default(1),
  address: z.object({
    zipCode: z.string().trim().min(5).max(12), streetName: z.string().trim().min(2).max(120),
    streetNumber: z.string().trim().min(1).max(20), neighborhood: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100), state: z.string().trim().length(2),
  }).optional(),
}).superRefine((value, ctx) => {
  if (['credit_card', 'debit_card'].includes(value.method) && (!value.cardToken || !value.paymentMethodId)) ctx.addIssue({ code: 'custom', path: ['cardToken'], message: 'Dados seguros do cartão não foram enviados.' });
  if (value.method === 'boleto' && !value.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Endereço completo é obrigatório para emitir boleto.' });
  if (['credit_card', 'debit_card', 'boleto'].includes(value.method) && (!value.identificationType || !value.identificationNumber)) ctx.addIssue({ code: 'custom', path: ['identificationNumber'], message: 'CPF ou CNPJ do pagador é obrigatório.' });
});
const subscriptionSchema = z.object({
  clientId: z.string().uuid().optional(), clientName: z.string().trim().min(2).max(180),
  payerEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  description: z.string().trim().min(2).max(250), amount: z.coerce.number().positive().max(1000000),
  frequency: z.enum(['days', 'months']).default('months'),
  frequencyInterval: z.coerce.number().int().min(1).max(24).default(1),
  startAt: z.string().datetime().optional(), endAt: z.string().datetime().optional(),
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown, reply: FastifyReply): T | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) { reply.code(400).send({ error: 'validation_error', message: 'Confira os campos enviados.', details: parsed.error.flatten().fieldErrors }); return undefined; }
  return parsed.data;
}

async function mercadoPago<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) throw new Error('mercadopago_not_configured');
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    app.log.error({ statusCode: response.status, providerError: payload.error ?? payload.message ?? 'unknown' }, 'Mercado Pago request failed');
    throw Object.assign(new Error('mercadopago_request_failed'), { statusCode: response.status });
  }
  return payload as T;
}

async function wahaRequest<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.WAHA_API_URL || !env.WAHA_API_KEY) throw Object.assign(new Error('waha_not_configured'), { statusCode: 503 });
  const response = await fetch(`${env.WAHA_API_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: { 'X-Api-Key': env.WAHA_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const raw = await response.text();
  const payload = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : {};
  if (!response.ok) {
    app.log.warn({ statusCode: response.status, path }, 'WAHA request failed');
    throw Object.assign(new Error('waha_request_failed'), { statusCode: response.status === 404 ? 404 : 502 });
  }
  return payload as T;
}

const integrationProviders = ['mercadopago', 'evolution', 'waha', 'resend', 'google', 'github', 'n8n', 'sentry'] as const;
type IntegrationProvider = typeof integrationProviders[number];
type IntegrationControl = { provider?: string; enabled?: boolean; lastTestStatus?: string | null; lastTestMessage?: string | null; testedAt?: string | null };
type GoogleTokenSet = { accessToken: string; refreshToken: string; expiresAt: number; email: string };

const googleScopes = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
];
const googleRedirectUri = env.GOOGLE_REDIRECT_URI || new URL('/api/integrations/google/callback', allowedOrigins[0]).toString();
const googleTokenEncryptionKey = createHash('sha256').update('nexo-google-token-v1\0').update(env.JWT_SECRET).digest();

function sealGoogleTokens(tokens: GoogleTokenSet) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', googleTokenEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

function openGoogleTokens(sealed: string): GoogleTokenSet {
  const [iv, tag, encrypted] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted || iv.length !== 12 || tag.length !== 16) throw new Error('google_token_payload_invalid');
  const decipher = createDecipheriv('aes-256-gcm', googleTokenEncryptionKey, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')) as GoogleTokenSet;
}

async function findGoogleConnection(organizationId: string) {
  const [row] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'integration-secrets'),
    sql`${workspaceRecords.data}->>'provider' = 'google'`, isNull(workspaceRecords.archivedAt),
  )).limit(1);
  return row;
}

async function saveGoogleConnection(organizationId: string, userId: string, tokens: GoogleTokenSet) {
  const data = { provider: 'google', sealedTokens: sealGoogleTokens(tokens) };
  const current = await findGoogleConnection(organizationId);
  if (current) {
    await db.update(workspaceRecords).set({ data, updatedAt: new Date() }).where(eq(workspaceRecords.id, current.id));
  } else {
    await db.insert(workspaceRecords).values({ organizationId, resource: 'integration-secrets', data, createdBy: userId });
  }
}

async function getGoogleTokens(organizationId: string) {
  const row = await findGoogleConnection(organizationId);
  const sealed = typeof row?.data.sealedTokens === 'string' ? row.data.sealedTokens : '';
  return sealed ? openGoogleTokens(sealed) : null;
}

async function googleAccessToken(organizationId: string, userId: string) {
  const tokens = await getGoogleTokens(organizationId);
  if (!tokens) throw Object.assign(new Error('google_authorization_required'), { statusCode: 409 });
  if (tokens.expiresAt > Date.now() + 60_000) return tokens.accessToken;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw Object.assign(new Error('google_client_not_configured'), { statusCode: 503 });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: tokens.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw Object.assign(new Error('google_token_refresh_failed'), { statusCode: 502 });
  const refreshed = await response.json() as { access_token?: string; expires_in?: number };
  if (!refreshed.access_token || !refreshed.expires_in) throw Object.assign(new Error('google_token_refresh_invalid'), { statusCode: 502 });
  const next = { ...tokens, accessToken: refreshed.access_token, expiresAt: Date.now() + refreshed.expires_in * 1000 };
  await saveGoogleConnection(organizationId, userId, next);
  return next.accessToken;
}

function integrationConfigured(provider: IntegrationProvider) {
  return ({
    mercadopago: Boolean(env.MERCADOPAGO_ACCESS_TOKEN),
    evolution: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
    waha: Boolean(env.WAHA_API_URL && env.WAHA_API_KEY),
    resend: Boolean(process.env.RESEND_API_KEY),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_TOKEN),
    n8n: Boolean(process.env.N8N_BASE_URL && process.env.N8N_API_KEY),
    sentry: Boolean(process.env.SENTRY_DSN),
  })[provider];
}

async function findIntegrationControl(organizationId: string, provider: IntegrationProvider) {
  const [row] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'integration-controls'),
    sql`${workspaceRecords.data}->>'provider' = ${provider}`, isNull(workspaceRecords.archivedAt),
  )).limit(1);
  return row;
}

async function saveIntegrationControl(organizationId: string, userId: string, provider: IntegrationProvider, patch: Partial<IntegrationControl>) {
  const current = await findIntegrationControl(organizationId, provider);
  const data = { ...(current?.data || {}), provider, ...patch };
  if (current) {
    const [saved] = await db.update(workspaceRecords).set({ data, updatedAt: new Date() }).where(eq(workspaceRecords.id, current.id)).returning();
    return saved?.data as IntegrationControl | undefined;
  }
  const [created] = await db.insert(workspaceRecords).values({ organizationId, resource: 'integration-controls', data, createdBy: userId }).returning();
  return created?.data as IntegrationControl | undefined;
}

async function isIntegrationEnabled(organizationId: string, provider: IntegrationProvider) {
  const control = await findIntegrationControl(organizationId, provider);
  return control?.data.enabled !== false;
}

function paymentDetailsFromOrder(order: Record<string, any>) {
  const payment = order.transactions?.payments?.[0] ?? {};
  const method = payment.payment_method ?? {};
  return {
    orderId: String(order.id ?? ''),
    status: String(order.status ?? payment.status ?? 'pending'),
    statusDetail: String(order.status_detail ?? payment.status_detail ?? ''),
    paymentId: payment.id ? String(payment.id) : null,
    paymentMethod: String(method.id ?? ''),
    ticketUrl: method.ticket_url ? String(method.ticket_url) : null,
    barcode: method.barcode_content ? String(method.barcode_content) : null,
    digitableLine: method.digitable_line ? String(method.digitable_line) : null,
    pixCode: method.qr_code ? String(method.qr_code) : null,
    pixQrCodeBase64: method.qr_code_base64 ? String(method.qr_code_base64) : null,
    expirationAt: method.expiration_date ? String(method.expiration_date) : null,
  };
}

function validMercadoPagoSignature(signature: string | undefined, requestId: string | undefined, dataId: string | undefined) {
  if (!signature || !env.MERCADOPAGO_WEBHOOK_SECRET) return false;
  const parts = Object.fromEntries(signature.split(',').map((part) => part.trim().split('=', 2) as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `${dataId ? `id:${dataId.toLowerCase()};` : ''}${requestId ? `request-id:${requestId};` : ''}ts:${parts.ts};`;
  const expected = createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET).update(manifest).digest();
  let received: Buffer;
  try { received = Buffer.from(parts.v1, 'hex'); } catch { return false; }
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function providerStatus(status: string) {
  if (['processed', 'authorized'].includes(status)) return 'paid';
  if (['cancelled', 'canceled', 'rejected', 'expired', 'refunded'].includes(status)) return status === 'refunded' ? 'refunded' : 'cancelled';
  if (status === 'in_process') return 'processing';
  return 'pending';
}

app.get('/api/health', async (_request, reply) => {
  try { await pool.query('select 1'); return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() }; }
  catch { return reply.code(503).send({ status: 'degraded', database: 'unavailable' }); }
});

const wahaSessionName = (row: typeof workspaceRecords.$inferSelect) => String(row.data.name || '');
async function findOwnedWahaSession(organizationId: string, id: string) {
  const [row] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.id, id), eq(workspaceRecords.organizationId, organizationId),
    eq(workspaceRecords.resource, 'whatsapp-sessions'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  return row;
}

app.get('/api/integrations/waha/sessions', { preHandler: app.authenticate }, async (request, reply) => {
  if (!env.WAHA_API_URL || !env.WAHA_API_KEY) return reply.code(503).send({ error: 'waha_not_configured', message: 'WAHA ainda não está configurada no servidor.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Nexo. Reative em Integrações para continuar.' });
  const owned = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'whatsapp-sessions'), isNull(workspaceRecords.archivedAt))).orderBy(desc(workspaceRecords.createdAt));
  const remote = await wahaRequest<Array<Record<string, any>>>('/api/sessions');
  const byName = new Map(remote.map((session) => [String(session.name || ''), session]));
  return { data: owned.map((row) => {
    const session = byName.get(wahaSessionName(row));
    const number = String(session?.me?.id || '').split('@').at(0)?.split(':').at(0) || '';
    return { id: row.id, label: row.data.label, status: String(session?.status || 'NOT_FOUND'), number, engine: session?.engine || 'NOWEB', createdAt: row.createdAt };
  }) };
});

app.post('/api/integrations/waha/sessions', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(z.object({ label: z.string().trim().min(2).max(80) }), request.body, reply); if (!body) return;
  if (!env.WAHA_API_URL || !env.WAHA_API_KEY) return reply.code(503).send({ error: 'waha_not_configured', message: 'WAHA ainda não está configurada no servidor.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Nexo. Reative em Integrações para continuar.' });
  const slug = body.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'whatsapp';
  const sessionName = `org-${request.user.organizationId.replaceAll('-', '').slice(0, 8)}-${slug}-${randomUUID().slice(0, 8)}`;
  try {
    await wahaRequest('/api/sessions', { method: 'POST', body: JSON.stringify({ name: sessionName, start: false }) });
    await wahaRequest(`/api/sessions/${encodeURIComponent(sessionName)}/start`, { method: 'POST', body: '{}' });
    const [row] = await db.insert(workspaceRecords).values({ organizationId: request.user.organizationId, resource: 'whatsapp-sessions', data: { name: sessionName, label: body.label.trim() }, createdBy: request.user.sub }).returning();
    if (!row) throw new Error('waha_session_record_not_created');
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'whatsapp-session', entityId: row.id, action: 'created', payload: { label: body.label.trim() } });
    return reply.code(201).send({ data: { id: row.id, label: body.label.trim(), status: 'SCAN_QR_CODE' } });
  } catch (error) {
    try { await wahaRequest(`/api/sessions/${encodeURIComponent(sessionName)}`, { method: 'DELETE' }); } catch { /* preserve the original failure */ }
    const statusCode = Number((error as { statusCode?: number }).statusCode) || 502;
    return reply.code(statusCode).send({ error: 'waha_session_create_failed', message: 'WAHA não conseguiu iniciar esta sessão. Verifique o serviço e tente novamente.' });
  }
});

app.get('/api/integrations/waha/sessions/:id/qr', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Sessão inválida.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Nexo.' });
  const row = await findOwnedWahaSession(request.user.organizationId, params.data.id);
  if (!row) return reply.code(404).send({ error: 'not_found', message: 'Sessão não encontrada.' });
  try {
    const qr = await wahaRequest<{ mimetype?: string; data?: string }>(`/api/${encodeURIComponent(wahaSessionName(row))}/auth/qr?format=image`);
    return { data: qr.data ? { mimetype: qr.mimetype || 'image/png', image: qr.data } : null };
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return { data: null };
    throw error;
  }
});

app.post('/api/integrations/waha/sessions/:id/:action', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid(), action: z.enum(['start', 'stop', 'restart', 'logout']) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Ação ou sessão inválida.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Nexo. Reative em Integrações para continuar.' });
  const row = await findOwnedWahaSession(request.user.organizationId, params.data.id);
  if (!row) return reply.code(404).send({ error: 'not_found', message: 'Sessão não encontrada.' });
  await wahaRequest(`/api/sessions/${encodeURIComponent(wahaSessionName(row))}/${params.data.action}`, { method: 'POST', body: '{}' });
  return { data: { id: row.id, action: params.data.action, status: params.data.action === 'stop' ? 'STOPPED' : params.data.action === 'logout' ? 'SCAN_QR_CODE' : 'STARTING' } };
});

app.delete('/api/integrations/waha/sessions/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Sessão inválida.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Nexo. Reative em Integrações para continuar.' });
  const row = await findOwnedWahaSession(request.user.organizationId, params.data.id);
  if (!row) return reply.code(404).send({ error: 'not_found', message: 'Sessão não encontrada.' });
  await wahaRequest(`/api/sessions/${encodeURIComponent(wahaSessionName(row))}`, { method: 'DELETE' }).catch((error) => { if ((error as { statusCode?: number }).statusCode !== 404) throw error; });
  await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(workspaceRecords.id, row.id));
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'whatsapp-session', entityId: row.id, action: 'deleted', payload: { label: row.data.label } });
  return reply.code(204).send();
});

app.post('/api/integrations/waha/send', { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(z.object({
    sessionId: z.string().uuid(), conversationId: z.string().uuid(), clientMessageId: z.string().uuid(),
    chatId: z.string().trim().min(5).max(180).regex(/^[\w.+-]+@(?:c\.us|g\.us|lid|s\.whatsapp\.net|newsletter)$/),
    text: z.string().trim().min(1).max(4096),
  }), request.body, reply); if (!body) return;
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Nexo. Reative em Integrações para enviar.' });
  const sessionRow = await findOwnedWahaSession(request.user.organizationId, body.sessionId);
  if (!sessionRow) return reply.code(404).send({ error: 'waha_session_not_found', message: 'A sessão WhatsApp selecionada não pertence a este workspace.' });
  const [conversation] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.id, body.conversationId), eq(workspaceRecords.organizationId, request.user.organizationId),
    eq(workspaceRecords.resource, 'inbox'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  if (!conversation) return reply.code(404).send({ error: 'conversation_not_found', message: 'A conversa não está mais disponível no workspace.' });
  const data = conversation.data as Record<string, any>;
  const existingHistory = Array.isArray(data.history) ? data.history as Array<Record<string, any>> : [];
  const duplicate = existingHistory.find((message) => message.clientMessageId === body.clientMessageId);
  if (duplicate?.status === 'sent' && duplicate.providerMessageId) return { data: { messageId: duplicate.providerMessageId, status: 'sent', duplicated: true } };
  if (duplicate?.status === 'sending' && Date.now() - Date.parse(String(duplicate.createdAt || '')) < 30_000) return reply.code(202).send({ data: { messageId: duplicate.clientMessageId, status: 'sending', duplicated: true } });
  const pending = { id: body.clientMessageId, clientMessageId: body.clientMessageId, side: 'sent', text: body.text, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), createdAt: new Date().toISOString(), status: 'sending' };
  const pendingHistory = duplicate ? existingHistory.map((message) => message.clientMessageId === body.clientMessageId ? pending : message) : [...existingHistory, pending];
  await db.update(workspaceRecords).set({ data: { ...data, whatsappSessionId: sessionRow.id, whatsappChatId: body.chatId, channel: 'WhatsApp', history: pendingHistory }, updatedAt: new Date() }).where(eq(workspaceRecords.id, conversation.id));
  try {
    const remote = await wahaRequest<Array<{ name?: string; status?: string }>>('/api/sessions');
    const remoteSession = remote.find((session) => String(session.name || '') === wahaSessionName(sessionRow));
    if (remoteSession?.status !== 'WORKING') {
      const error = Object.assign(new Error('waha_session_not_connected'), { statusCode: 409 });
      throw error;
    }
    const result = await wahaRequest<{ id?: string }>('/api/sendText', { method: 'POST', body: JSON.stringify({ session: wahaSessionName(sessionRow), chatId: body.chatId, text: body.text }) });
    const [fresh] = await db.select().from(workspaceRecords).where(eq(workspaceRecords.id, conversation.id)).limit(1);
    const freshData = (fresh?.data || data) as Record<string, any>;
    const history = Array.isArray(freshData.history) ? freshData.history as Array<Record<string, any>> : pendingHistory;
    const savedMessage = { ...pending, providerMessageId: result.id || '', status: 'sent' };
    await db.update(workspaceRecords).set({ data: { ...freshData, whatsappSessionId: sessionRow.id, whatsappChatId: body.chatId, channel: 'WhatsApp', text: body.text, time: savedMessage.time, history: history.map((message) => message.clientMessageId === body.clientMessageId ? savedMessage : message) }, updatedAt: new Date() }).where(eq(workspaceRecords.id, conversation.id));
    return { data: { messageId: result.id || body.clientMessageId, status: 'sent' } };
  } catch (error) {
    const [fresh] = await db.select().from(workspaceRecords).where(eq(workspaceRecords.id, conversation.id)).limit(1);
    const freshData = (fresh?.data || data) as Record<string, any>;
    const history = Array.isArray(freshData.history) ? freshData.history as Array<Record<string, any>> : pendingHistory;
    await db.update(workspaceRecords).set({ data: { ...freshData, history: history.map((message) => message.clientMessageId === body.clientMessageId ? { ...pending, status: 'failed' } : message) }, updatedAt: new Date() }).where(eq(workspaceRecords.id, conversation.id));
    const statusCode = (error as { statusCode?: number }).statusCode;
    return reply.code(statusCode === 409 ? 409 : 502).send({ error: 'waha_send_failed', message: statusCode === 409 ? 'A sessão WhatsApp não está conectada. Escaneie o QR e tente novamente.' : 'WAHA não confirmou o envio. Confira a conexão da sessão antes de tentar novamente.' });
  }
});

app.post('/api/integrations/waha/webhook', async (request, reply) => {
  const provided = request.headers['x-nexo-waha-token'];
  const expected = env.WAHA_API_KEY || '';
  if (typeof provided !== 'string' || !expected || Buffer.byteLength(provided) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return reply.code(401).send({ error: 'webhook_unauthorized' });
  const parsed = z.object({ event: z.string(), session: z.string(), payload: z.record(z.string(), z.unknown()).default({}) }).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_waha_event' });
  const event = parsed.data.event;
  if (!['message', 'message.ack'].includes(event)) return reply.code(202).send({ data: { ignored: true } });
  const payload = parsed.data.payload as Record<string, any>;
  const [sessionRow] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.resource, 'whatsapp-sessions'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'name' = ${parsed.data.session}`,
  )).limit(1);
  if (!sessionRow || !await isIntegrationEnabled(sessionRow.organizationId, 'waha')) return reply.code(202).send({ data: { ignored: true } });
  const messageId = String(payload.id || '');
  const chatId = String(payload.chatId || (payload.fromMe ? payload.to : payload.from) || '');
  if (!messageId || !chatId) return reply.code(202).send({ data: { ignored: true } });
  const [conversation] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, sessionRow.organizationId), eq(workspaceRecords.resource, 'inbox'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'whatsappSessionId' = ${sessionRow.id}`, sql`${workspaceRecords.data}->>'whatsappChatId' = ${chatId}`,
  )).limit(1);
  if (event === 'message.ack') {
    if (conversation) {
      const data = conversation.data as Record<string, any>;
      const ack = Number(payload.ack || 0);
      const history = Array.isArray(data.history) ? data.history as Array<Record<string, any>> : [];
      await db.update(workspaceRecords).set({ data: { ...data, history: history.map((item) => item.providerMessageId === messageId ? { ...item, ack, status: ack >= 3 ? 'read' : ack >= 2 ? 'delivered' : item.status } : item) }, updatedAt: new Date() }).where(eq(workspaceRecords.id, conversation.id));
    }
    return reply.code(204).send();
  }
  if (payload.fromMe === true) return reply.code(202).send({ data: { ignored: true } });
  const from = String(payload.from || chatId);
  const phone = from.split('@')[0]?.split(':')[0] || '';
  const normalizedPhone = phone.replace(/\D/g, '');
  const text = String(payload.body || (payload.hasMedia ? `[Mídia${payload.media?.filename ? `: ${payload.media.filename}` : ' recebida'}]` : '')).slice(0, 4096);
  const timestamp = Number(payload.timestamp || Date.now() / 1000);
  const at = new Date(timestamp * 1000).toISOString();
  const currentData = (conversation?.data || {}) as Record<string, any>;
  const oldHistory = Array.isArray(currentData.history) ? currentData.history as Array<Record<string, any>> : [];
  if (oldHistory.some((item) => item.providerMessageId === messageId)) return reply.code(204).send();
  const clientRows = await db.select().from(clients).where(eq(clients.organizationId, sessionRow.organizationId));
  const matchingClient = clientRows.find((client) => client.phone?.replace(/\D/g, '') === normalizedPhone) || null;
  const displayName = String(payload._data?.notifyName || payload._data?.pushName || payload.pushName || matchingClient?.contactName || phone || 'WhatsApp');
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  const history = [...oldHistory, { id: messageId, providerMessageId: messageId, side: 'received', text: text || 'Mensagem recebida', time: new Date(timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), timestamp: at, status: 'received', ...(payload.media?.filename ? { attachment: String(payload.media.filename) } : {}) }];
  const nextData = { ...currentData, name: currentData.name || displayName, company: matchingClient?.name || currentData.company || '', clientId: matchingClient?.id || currentData.clientId || '', phone, email: matchingClient?.email || currentData.email || '', initials, color: currentData.color || 'blue', channel: 'WhatsApp', whatsappSessionId: sessionRow.id, whatsappChatId: chatId, text: text || 'Mensagem recebida', time: at, unread: Number(currentData.unread || 0) + 1, history };
  if (conversation) await db.update(workspaceRecords).set({ data: nextData, updatedAt: new Date() }).where(eq(workspaceRecords.id, conversation.id));
  else await db.insert(workspaceRecords).values({ organizationId: sessionRow.organizationId, resource: 'inbox', data: nextData, createdBy: null });
  return reply.code(204).send();
});

app.get('/api/integrations/google/authorize', { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return reply.code(503).send({ error: 'google_client_not_configured', message: 'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no serviço API do Coolify.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'google')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Reative Google Workspace no Nexo antes de autorizar a conta.' });
  const state = app.jwt.sign({ sub: request.user.sub, organizationId: request.user.organizationId, role: 'owner', purpose: 'google-oauth-state', nonce: randomUUID() }, { expiresIn: '10m' });
  reply.setCookie('nexo_google_oauth_state', state, { path: '/api/integrations', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 10 * 60 });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: googleRedirectUri, response_type: 'code', scope: googleScopes.join(' '), access_type: 'offline', include_granted_scopes: 'true', prompt: 'consent', state }).toString();
  return reply.redirect(url.toString());
});

app.get('/api/integrations/google/callback', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const query = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }).safeParse(request.query);
  const stateCookie = request.cookies.nexo_google_oauth_state;
  reply.clearCookie('nexo_google_oauth_state', { path: '/api/integrations', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  const redirectToApp = (result: string, reason?: string) => {
    const target = new URL('/', allowedOrigins[0]);
    target.searchParams.set('google', result);
    if (reason) target.searchParams.set('reason', reason);
    return reply.redirect(target.toString());
  };
  if (!query.success || !query.data.state || !stateCookie || query.data.state !== stateCookie) return redirectToApp('error', 'state_invalid');
  let claims: { sub?: string; organizationId?: string; purpose?: string };
  try { claims = app.jwt.verify<{ sub?: string; organizationId?: string; purpose?: string }>(query.data.state); }
  catch { return redirectToApp('error', 'state_expired'); }
  if (claims.purpose !== 'google-oauth-state' || !claims.sub || !claims.organizationId) return redirectToApp('error', 'state_invalid');
  if (query.data.error || !query.data.code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirectToApp('error', query.data.error === 'access_denied' ? 'consent_denied' : 'oauth_incomplete');
  try {
    const [owner] = await db.select({ id: users.id }).from(users).where(and(
      eq(users.id, claims.sub), eq(users.organizationId, claims.organizationId), eq(users.active, true), eq(users.email, env.OWNER_EMAIL),
    )).limit(1);
    if (!owner) return redirectToApp('error', 'owner_required');
    if (!await isIntegrationEnabled(claims.organizationId, 'google')) return redirectToApp('error', 'integration_disconnected');
    const exchange = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: query.data.code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: googleRedirectUri, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!exchange.ok) return redirectToApp('error', 'code_exchange_failed');
    const grant = await exchange.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!grant.access_token || !grant.expires_in) return redirectToApp('error', 'token_response_invalid');
    const existing = await getGoogleTokens(claims.organizationId);
    const refreshToken = grant.refresh_token || existing?.refreshToken;
    if (!refreshToken) return redirectToApp('error', 'offline_access_missing');
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${grant.access_token}` }, signal: AbortSignal.timeout(12_000) });
    if (!profileResponse.ok) return redirectToApp('error', 'google_profile_failed');
    const profile = await profileResponse.json() as { email?: string; email_verified?: boolean };
    if (!profile.email || !profile.email_verified) return redirectToApp('error', 'google_email_unverified');
    await saveGoogleConnection(claims.organizationId, claims.sub, { accessToken: grant.access_token, refreshToken, expiresAt: Date.now() + grant.expires_in * 1000, email: profile.email });
    await saveIntegrationControl(claims.organizationId, claims.sub, 'google', { lastTestStatus: 'connected', lastTestMessage: `Conta Google autorizada: ${profile.email}.`, testedAt: new Date().toISOString() });
    await db.insert(activityEvents).values({ organizationId: claims.organizationId, actorUserId: claims.sub, entityType: 'integration', action: 'google_authorized', payload: { provider: 'google', email: profile.email } });
    return redirectToApp('connected');
  } catch (error) {
    app.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Google OAuth callback failed');
    return redirectToApp('error', 'callback_failed');
  }
});

app.post('/api/integrations/google/disconnect', { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
  const row = await findGoogleConnection(request.user.organizationId);
  const sealed = typeof row?.data.sealedTokens === 'string' ? row.data.sealedTokens : '';
  if (sealed) {
    const tokens = openGoogleTokens(sealed);
    const response = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: tokens.refreshToken }), signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok && response.status !== 400) return reply.code(502).send({ error: 'google_revoke_failed', message: 'O Google não confirmou a revogação. A conta continua conectada.' });
    if (row) await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(workspaceRecords.id, row.id));
  }
  await saveIntegrationControl(request.user.organizationId, request.user.sub, 'google', { lastTestStatus: null, lastTestMessage: null, testedAt: null });
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'integration', action: 'google_disconnected', payload: { provider: 'google' } });
  return { data: { disconnected: true } };
});

app.route({ method: ['POST', 'PATCH'], url: '/api/integrations/google/calendar/events', preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, handler: async (request, reply) => {
  const body = parseBody(z.object({
    eventId: z.string().regex(/^[a-v0-9]{5,1024}$/).optional(),
    title: z.string().trim().min(1).max(180),
    description: z.string().max(8000).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    createMeet: z.boolean().default(false),
    attendees: z.array(z.string().email()).max(30).default([]),
  }), request.body, reply); if (!body) return;
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' };
    if (body.eventId) {
      const existing = await fetch(`${base}/${body.eventId}`, { headers, signal: AbortSignal.timeout(12_000) });
      if (existing.ok) {
        if (request.method === 'POST') {
          const event = await existing.json() as { id?: string; htmlLink?: string; hangoutLink?: string };
          return { data: { eventId: event.id, htmlLink: event.htmlLink, meetUrl: event.hangoutLink, existing: true } };
        }
      }
      if (!existing.ok && existing.status !== 404) return reply.code(502).send({ error: 'google_calendar_lookup_failed', message: 'Não foi possível verificar o evento no Google Calendar.' });
      if (existing.status === 404 && request.method === 'PATCH') return reply.code(404).send({ error: 'google_calendar_event_missing', message: 'O evento não foi encontrado no Google Calendar.' });
    }
    const eventBody = {
      ...(body.eventId && request.method === 'POST' ? { id: body.eventId } : {}),
      summary: body.title,
      description: body.description || '',
      start: { dateTime: `${body.date}T${body.startTime}:00`, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: `${body.endDate || body.date}T${body.endTime}:00`, timeZone: 'America/Sao_Paulo' },
      ...(body.attendees.length ? { attendees: body.attendees.map((email) => ({ email })) } : {}),
      ...(body.createMeet ? { conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
    };
    const query = new URLSearchParams({ ...(body.createMeet ? { conferenceDataVersion: '1' } : {}), ...(body.attendees.length ? { sendUpdates: 'all' } : {}) });
    const response = await fetch(`${base}${body.eventId && request.method === 'PATCH' ? `/${body.eventId}` : ''}${query.size ? `?${query}` : ''}`, { method: request.method === 'PATCH' ? 'PATCH' : 'POST', headers, body: JSON.stringify(eventBody), signal: AbortSignal.timeout(15_000) });
    const result = await response.json().catch(() => ({})) as { id?: string; htmlLink?: string; hangoutLink?: string; error?: { message?: string } };
    if (!response.ok) {
      app.log.warn({ status: response.status, reason: result.error?.message }, 'Google Calendar event creation failed');
      return reply.code(response.status === 401 || response.status === 403 ? 409 : 502).send({ error: 'google_calendar_create_failed', message: 'O Google Calendar não aceitou o evento. Verifique a autorização e o escopo de calendário da conta.' });
    }
    return reply.code(request.method === 'PATCH' ? 200 : 201).send({ data: { eventId: result.id, htmlLink: result.htmlLink, meetUrl: result.hangoutLink, existing: false } });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 409 || statusCode === 503) return reply.code(statusCode).send({ error: 'google_authorization_required', message: 'Autorize o Google Workspace em Integrações antes de sincronizar eventos.' });
    app.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Google Calendar event failed');
    return reply.code(502).send({ error: 'google_calendar_unavailable', message: 'Não foi possível concluir a operação no Google Calendar.' });
  }
} });

app.delete('/api/integrations/google/calendar/events/:eventId', { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ eventId: z.string().regex(/^[a-v0-9]{5,1024}$/) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de evento inválido.' });
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${params.data.eventId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(12_000) });
    if ([200, 204, 404, 410].includes(response.status)) return reply.code(204).send();
    return reply.code(response.status === 401 || response.status === 403 ? 409 : 502).send({ error: 'google_calendar_delete_failed', message: 'O Google Calendar não confirmou a exclusão do evento.' });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 409 || statusCode === 503) return reply.code(statusCode).send({ error: 'google_authorization_required', message: 'Autorize o Google Workspace antes de excluir eventos sincronizados.' });
    app.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Google Calendar event deletion failed');
    return reply.code(502).send({ error: 'google_calendar_unavailable', message: 'Não foi possível concluir a exclusão no Google Calendar.' });
  }
});

app.get('/api/integrations/status', { preHandler: app.authenticate }, async (request) => {
  const controls = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'integration-controls'), isNull(workspaceRecords.archivedAt),
  ));
  const controlByProvider = new Map(controls.map((row) => [String(row.data.provider), row.data as IntegrationControl]));
  const googleConnection = await findGoogleConnection(request.user.organizationId);
  let googleEmail = '';
  if (typeof googleConnection?.data.sealedTokens === 'string') {
    try { googleEmail = openGoogleTokens(googleConnection.data.sealedTokens).email; } catch { /* corrupted credentials are shown as disconnected */ }
  }
  const names: Record<IntegrationProvider, string> = { mercadopago: 'Mercado Pago', evolution: 'Evolution API', waha: 'WAHA', resend: 'Resend', google: 'Google Workspace', github: 'GitHub', n8n: 'n8n', sentry: 'Sentry' };
  return { data: integrationProviders.map((provider) => {
    const control = controlByProvider.get(provider);
    const configured = integrationConfigured(provider);
    return { name: names[provider], provider, configured, enabled: configured && control?.enabled !== false, ...(provider === 'google' && googleEmail ? { accountEmail: googleEmail } : {}), lastTestStatus: control?.lastTestStatus || null, lastTestMessage: control?.lastTestMessage || null, testedAt: control?.testedAt || null };
  }) };
});

app.post('/api/integrations/:provider/connection', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ provider: z.enum(integrationProviders) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Integração inválida.' });
  const body = parseBody(z.object({ enabled: z.boolean() }), request.body, reply); if (!body) return;
  const provider = params.data.provider;
  if (body.enabled && !integrationConfigured(provider)) return reply.code(409).send({ error: 'integration_not_configured', message: 'Configure as credenciais no Coolify antes de reativar esta integração.' });
  if (!body.enabled && provider === 'waha' && await isIntegrationEnabled(request.user.organizationId, 'waha')) {
    const sessions = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'whatsapp-sessions'), isNull(workspaceRecords.archivedAt)));
    const remote = await wahaRequest<Array<Record<string, any>>>('/api/sessions');
    const working = new Set(remote.filter((session) => session.status === 'WORKING').map((session) => String(session.name || '')));
    for (const session of sessions) {
      const sessionName = wahaSessionName(session);
      if (!working.has(sessionName)) continue;
      await wahaRequest(`/api/sessions/${encodeURIComponent(sessionName)}/stop`, { method: 'POST', body: '{}' }).catch((error) => {
        if ((error as { statusCode?: number }).statusCode !== 404) throw error;
      });
    }
  }
  const control = await saveIntegrationControl(request.user.organizationId, request.user.sub, provider, { enabled: body.enabled, ...(body.enabled ? { lastTestStatus: null, lastTestMessage: null, testedAt: null } : {}) });
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'integration', action: body.enabled ? 'enabled' : 'disabled', payload: { provider } });
  return { data: { provider, enabled: control?.enabled !== false } };
});

app.post('/api/integrations/:provider/test', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ provider: z.enum(['mercadopago', 'evolution', 'waha', 'resend', 'github', 'google', 'n8n', 'sentry']) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Integração inválida.' });
  const provider = params.data.provider;
  const unavailable = async (message: string) => {
    await saveIntegrationControl(request.user.organizationId, request.user.sub, provider, { lastTestStatus: 'not_configured', lastTestMessage: message, testedAt: new Date().toISOString() });
    return reply.code(503).send({ error: 'integration_not_configured', message });
  };
  const failed = async (message: string) => {
    await saveIntegrationControl(request.user.organizationId, request.user.sub, provider, { lastTestStatus: 'error', lastTestMessage: message, testedAt: new Date().toISOString() });
    return reply.code(502).send({ error: 'integration_test_failed', message });
  };
  if (!await isIntegrationEnabled(request.user.organizationId, provider)) return { data: { status: 'disconnected', message: 'Esta integração está desativada no Nexo. Reative para testar ou usar novamente.' } };
  const tested = async (status: string, message: string) => {
    await saveIntegrationControl(request.user.organizationId, request.user.sub, provider, { lastTestStatus: status, lastTestMessage: message, testedAt: new Date().toISOString() });
    return { data: { status, message } };
  };
  try {
    if (provider === 'mercadopago') {
      if (!env.MERCADOPAGO_ACCESS_TOKEN) return unavailable('Configure MERCADOPAGO_ACCESS_TOKEN nas variáveis do serviço API no Coolify.');
      const methods = await mercadoPago<Array<{ id: string }>>('/v1/payment_methods');
      return tested('connected', `Mercado Pago respondeu. ${methods.length} meios de pagamento disponíveis.`);
    }
    if (provider === 'waha') {
      if (!env.WAHA_API_URL || !env.WAHA_API_KEY) return unavailable('Configure WAHA_API_URL e WAHA_API_KEY no serviço API.');
      const sessions = await wahaRequest<Array<{ name?: string }>>('/api/sessions');
      return tested('connected', `WAHA respondeu. ${sessions.length} sessão(ões) encontrada(s).`);
    }
    if (provider === 'evolution') {
      const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
      const apiKey = process.env.EVOLUTION_API_KEY;
      if (!baseUrl || !apiKey) return unavailable('Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no serviço API.');
      const response = await fetch(`${baseUrl}/instance/fetchInstances`, { headers: { apikey: apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return failed(`Evolution API respondeu com HTTP ${response.status}. Confira a URL e a chave configuradas.`);
      const instances = await response.json().catch(() => []);
      return tested('connected', `Evolution API respondeu. ${Array.isArray(instances) ? instances.length : 0} instância(s) encontrada(s).`);
    }
    if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return unavailable('Configure RESEND_API_KEY no serviço API.');
      const response = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return failed(`Resend respondeu com HTTP ${response.status}. Confira a chave configurada.`);
      const result = await response.json() as { data?: Array<{ name?: string; status?: string }> };
      const domains = result.data ?? [];
      const verified = domains.filter((domain) => domain.status === 'verified');
      const domainSummary = verified.map((domain) => domain.name).filter(Boolean).slice(0, 4).join(', ');
      const senderReady = Boolean(process.env.RESEND_FROM_EMAIL && z.string().email().safeParse(process.env.RESEND_FROM_EMAIL.trim()).success && verified.some((domain) => process.env.RESEND_FROM_EMAIL!.trim().toLowerCase().endsWith(`@${domain.name?.toLowerCase()}`)));
      return tested('connected', `Resend conectado. Domínios verificados: ${verified.length}/${domains.length}${domainSummary ? ` (${domainSummary})` : ''}. Remetente para propostas: ${senderReady ? 'configurado' : 'pendente no Coolify (RESEND_FROM_EMAIL)'} .`);
    }
    if (provider === 'github') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return unavailable('Configure GITHUB_TOKEN no serviço API.');
      const response = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return failed(`GitHub respondeu com HTTP ${response.status}. Confira o token e as permissões.`);
      const result = await response.json() as { login?: string };
      return tested('connected', `GitHub conectado como ${result.login || 'usuário autenticado'}.`);
    }
    if (provider === 'google') {
      const tokens = await getGoogleTokens(request.user.organizationId);
      if (!tokens) return tested('setup_required', 'Autorize sua conta Google para liberar Gmail, Calendar, Drive e links de reunião Meet.');
      const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return failed(`Google Workspace respondeu com HTTP ${response.status}. Reconecte a conta se a autorização expirou.`);
      const profile = await response.json() as { email?: string };
      return tested('connected', `Google Workspace conectado como ${profile.email || tokens.email}.`);
    }
    if (provider === 'n8n') {
      const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '');
      const apiKey = process.env.N8N_API_KEY;
      if (!baseUrl || !apiKey) return unavailable('Configure N8N_BASE_URL e N8N_API_KEY no serviço API. Gere a chave em Configurações > n8n API na sua instância n8n.');
      const response = await fetch(`${baseUrl}/api/v1/workflows?limit=1`, { headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
      if (response.status === 401 || response.status === 403) return failed(n8nApiKeyFailureMessage(response.status));
      if (!response.ok) return failed(`A API pública do n8n respondeu com HTTP ${response.status}. Confira a URL e a versão da instância.`);
      const result = await response.json() as { data?: unknown[] };
      return tested('connected', `API do n8n autenticada. ${result.data?.length ?? 0} workflow(s) retornado(s) nesta consulta.`);
    }
    return tested('setup_required', 'O DSN do Sentry está no servidor, mas validar a ingestão exige enviar um evento de teste que criaria um evento no projeto.');
  } catch (error) {
    app.log.warn({ provider, error: error instanceof Error ? error.name : 'unknown' }, 'Integration connection test failed');
    return failed('Não foi possível confirmar a conexão. Confira o serviço, a URL e as credenciais no Coolify.');
  }
});

const n8nWorkflowIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
async function n8nApiRequest(path: string, init: RequestInit = {}) {
  const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw Object.assign(new Error('n8n_not_configured'), { statusCode: 503 });
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    signal: AbortSignal.timeout(12_000),
    headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  const body = await response.text();
  const data = body ? (() => { try { return JSON.parse(body) as unknown; } catch { return null; } })() : null;
  if (!response.ok) {
    const statusCode = response.status === 401 || response.status === 403 ? 403 : response.status === 404 ? 404 : response.status >= 500 ? 502 : 400;
    const safeMessage = n8nApiValidationMessage(response.status, data);
    app.log.warn({ statusCode: response.status, path, providerMessage: safeMessage }, 'n8n API request failed');
    throw Object.assign(new Error(response.status === 401 || response.status === 403 ? 'n8n_api_forbidden' : 'n8n_api_request_failed'), { statusCode, providerMessage: safeMessage });
  }
  return data;
}

const n8nWebhookHeader = 'X-Nexo-Signature';
const n8nWebhookSecret = createHmac('sha256', env.JWT_SECRET).update('nexo-workspace-automation-bridge-v1').digest('hex');
async function getN8nWebhookCredential() {
  const existing = await n8nApiRequest('/credentials?limit=250') as { data?: Array<{ id?: string; name?: string; type?: string }> };
  const match = existing.data?.find((item) => item.name === 'Nexo Workspace Automation Bridge' && item.type === 'httpHeaderAuth');
  const credentialData = { name: n8nWebhookHeader, value: n8nWebhookSecret };
  if (match?.id) {
    await n8nApiRequest(`/credentials/${encodeURIComponent(match.id)}`, { method: 'PATCH', body: JSON.stringify({ data: credentialData, isPartialData: false }) });
    return { id: match.id, name: 'Nexo Workspace Automation Bridge' };
  }
  const created = await n8nApiRequest('/credentials', { method: 'POST', body: JSON.stringify({ name: 'Nexo Workspace Automation Bridge', type: 'httpHeaderAuth', data: credentialData }) }) as { id?: string };
  if (!created.id) throw new Error('n8n_credential_create_failed');
  return { id: created.id, name: 'Nexo Workspace Automation Bridge' };
}

async function dispatchN8nEvent(organizationId: string, eventKey: string, record: Record<string, unknown>) {
  const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.N8N_API_KEY;
  if (!baseUrl || !apiKey || !await isIntegrationEnabled(organizationId, 'n8n')) return;
  const automations = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'eventKey' = ${eventKey}`, sql`${workspaceRecords.data}->>'active' = 'true'`,
  ));
  const eventId = randomUUID();
  await Promise.all(automations.map(async (row) => {
    const path = String(row.data.n8nWebhookPath ?? '');
    if (!/^nexo\/[0-9a-f-]{36}$/i.test(path)) return;
    try {
      const response = await fetch(new URL(`/webhook/${path}`, `${baseUrl}/`), {
        method: 'POST', signal: AbortSignal.timeout(8_000),
        headers: { 'Content-Type': 'application/json', [n8nWebhookHeader]: n8nWebhookSecret },
        body: JSON.stringify({ eventId, eventKey, record }),
      });
      if (!response.ok) app.log.warn({ eventKey, statusCode: response.status }, 'n8n event delivery failed');
    } catch (error) { app.log.warn({ eventKey, error: error instanceof Error ? error.name : 'unknown' }, 'n8n event delivery failed'); }
  }));
}

app.post('/api/integrations/n8n/actions', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
  const provided = request.headers[n8nWebhookHeader.toLowerCase()];
  if (typeof provided !== 'string' || Buffer.byteLength(provided) !== Buffer.byteLength(n8nWebhookSecret) || !timingSafeEqual(Buffer.from(provided), Buffer.from(n8nWebhookSecret))) return reply.code(401).send({ error: 'automation_unauthorized' });
  const body = parseBody(z.object({
    automationId: z.string().uuid(),
    event: z.object({ eventId: z.string().uuid(), eventKey: z.string().min(1).max(80), record: z.record(z.string(), z.unknown()) }).refine((value) => isSafeWorkspaceData(value.record)),
  }), request.body, reply);
  if (!body) return;
  const [automation] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.id, body.automationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'active' = 'true'`, sql`${workspaceRecords.data}->>'eventKey' = ${body.event.eventKey}`,
  )).limit(1);
  if (!automation) return reply.code(404).send({ error: 'automation_not_found' });
  const templateId = String(automation.data.templateId ?? '') as N8nAutomationTemplateId;
  const template = n8nAutomationTemplates[templateId];
  if (!template || template.eventKey !== body.event.eventKey) return reply.code(409).send({ error: 'automation_action_not_allowed' });
  const event = body.event.record;
  const sourceId = String(event.id ?? '');
  const [existingEventTask] = await db.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, automation.organizationId), eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'n8nEventId' = ${body.event.eventId}`,
  )).limit(1);
  if (existingEventTask) return { data: { status: 'already_processed', taskId: existingEventTask.id } };
  if (template.taskKind === 'lead' && sourceId) {
    const [nativeTask] = await db.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, automation.organizationId), eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
      sql`${workspaceRecords.data}->>'automationKey' = 'lead-first-contact'`, sql`${workspaceRecords.data}->>'sourceLeadId' = ${sourceId}`,
    )).limit(1);
    if (nativeTask) return { data: { status: 'already_applied', taskId: nativeTask.id } };
  }
  if (template.taskKind === 'project' && sourceId) {
    const [nativeTask] = await db.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, automation.organizationId), eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
      sql`${workspaceRecords.data}->>'automationKey' = 'project-delivery-follow-up'`, sql`${workspaceRecords.data}->>'projectId' = ${sourceId}`,
    )).limit(1);
    if (nativeTask) return { data: { status: 'already_applied', taskId: nativeTask.id } };
  }
  const label = String(event.name ?? event.title ?? event.description ?? sourceId ?? 'registro').trim().slice(0, 160) || 'registro';
  const clientName = String(event.client ?? event.clientName ?? event.company ?? '').trim().slice(0, 160);
  const dueDays = template.taskKind === 'project' ? 7 : template.taskKind === 'lead' || template.taskKind === 'proposal' ? 1 : 0;
  const due = new Date(Date.now() + dueDays * 86_400_000).toISOString().slice(0, 10);
  const titlePrefix: Record<typeof template.taskKind, string> = {
    lead: 'Primeiro contato', proposal: 'Preparar início do projeto', payment: 'Revisar pagamento recebido',
    project: 'Acompanhar entrega', ticket: 'Atender chamado',
  };
  const data = {
    title: `${titlePrefix[template.taskKind]} · ${label}`.slice(0, 220), client: clientName, project: String(event.project ?? ''), due,
    status: 'A fazer', priority: template.taskKind === 'lead' || template.taskKind === 'ticket' ? 'Alta' : 'Normal', assignee: '',
    automationKey: `n8n:${template.taskKind}`, sourceN8nAutomationId: automation.id, n8nEventId: body.event.eventId,
    ...(template.taskKind === 'lead' ? { sourceLeadId: sourceId } : {}), ...(template.taskKind === 'project' ? { projectId: sourceId } : {}),
  };
  const [task] = await db.transaction(async (tx) => {
    const rows = await tx.insert(workspaceRecords).values({ organizationId: automation.organizationId, createdBy: ownerAccountId, resource: 'tasks', data }).returning();
    await tx.insert(activityEvents).values({ organizationId: automation.organizationId, actorUserId: ownerAccountId, entityType: 'tasks', entityId: rows[0]!.id, action: 'created', payload: { automation: `n8n:${template.taskKind}`, sourceN8nAutomationId: automation.id } });
    return rows;
  });
  return { data: { status: 'processed', taskId: task!.id } };
});

app.post('/api/workspace/automations/:id/n8n-workflow', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de automação inválido.' });
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) return reply.code(503).send({ error: 'n8n_not_configured', message: 'Configure a URL segura do n8n e uma chave com permissões de workflow e credenciais no Coolify.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'n8n')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Reative o n8n em Integrações antes de criar workflows.' });
  const [automation] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  if (!automation) return reply.code(404).send({ error: 'not_found', message: 'Automação não encontrada.' });
  if (automation.data.n8nWorkflowId) return reply.code(409).send({ error: 'workflow_already_created', message: 'Esta automação já está associada a um workflow do n8n.' });
  const templateId = String(automation.data.templateId ?? '') as N8nAutomationTemplateId;
  if (!Object.hasOwn(n8nAutomationTemplates, templateId)) return reply.code(400).send({ error: 'automation_template_unsupported', message: 'Escolha um modelo compatível para criar o workflow n8n.' });
  let remoteWorkflowId = '';
  try {
    const credential = await getN8nWebhookCredential();
    const webhookPath = `nexo/${randomUUID()}`;
    const callbackUrl = new URL('/api/integrations/n8n/actions', allowedOrigins[0]).toString();
    const workflow = buildN8nAutomationWorkflow({ automationId: automation.id, templateId, name: String(automation.data.name ?? 'Automação'), webhookPath, callbackUrl, credentialId: credential.id });
    const created = await n8nApiRequest('/workflows', { method: 'POST', body: JSON.stringify(workflow) }) as { id?: string };
    if (!created.id) throw new Error('n8n_workflow_create_failed');
    remoteWorkflowId = created.id;
    const eventKey = n8nAutomationTemplates[templateId].eventKey;
    const data = { ...automation.data, n8nWorkflowId: created.id, n8nWebhookPath: webhookPath, eventKey, active: false, status: 'draft' };
    const [saved] = await db.update(workspaceRecords).set({ data, updatedAt: new Date() }).where(and(
      eq(workspaceRecords.id, automation.id), eq(workspaceRecords.organizationId, request.user.organizationId), isNull(workspaceRecords.archivedAt),
      sql`NOT (${workspaceRecords.data} ? 'n8nWorkflowId')`,
    )).returning();
    if (!saved) throw new Error('automation_changed_during_create');
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'automations', entityId: saved.id, action: 'n8n_workflow_created', payload: { n8nWorkflowId: created.id, eventKey } });
    return reply.code(201).send({ data: { ...saved.data, id: saved.id, createdAt: saved.createdAt, updatedAt: saved.updatedAt } });
  } catch (error) {
    if (remoteWorkflowId) { try { await n8nApiRequest(`/workflows/${encodeURIComponent(remoteWorkflowId)}`, { method: 'DELETE' }); } catch { app.log.error({ workflowId: remoteWorkflowId }, 'Could not clean up n8n workflow after failed link'); } }
    const statusCode = (error as { statusCode?: number }).statusCode ?? 502;
    const providerMessage = (error as { providerMessage?: string }).providerMessage;
    const message = statusCode === 403 ? 'A chave de API precisa de permissões credential:list, credential:create, credential:update e workflow:create.' : providerMessage ?? 'Não foi possível criar e vincular o workflow. Atualize a integração e tente novamente.';
    return reply.code(statusCode).send({ error: 'n8n_workflow_create_failed', message });
  }
});

app.get('/api/integrations/n8n/workflows', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) return reply.code(503).send({ error: 'n8n_not_configured', message: 'Configure a URL segura do n8n e a chave da API no Coolify.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'n8n')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Reative o n8n em Integrações para consultar workflows.' });
  try {
    const [workflowResult, executionResult] = await Promise.all([
      n8nApiRequest('/workflows?limit=100') as Promise<{ data?: unknown[]; nextCursor?: string | null }>,
      n8nApiRequest('/executions?limit=25&includeData=false') as Promise<{ data?: unknown[]; nextCursor?: string | null }>,
    ]);
    const mapped = mapN8nCollections(
      Array.isArray(workflowResult.data) ? workflowResult.data : [],
      Array.isArray(executionResult.data) ? executionResult.data : [],
    );
    return { data: { ...mapped, workflowNextCursor: workflowResult.nextCursor ?? null, executionNextCursor: executionResult.nextCursor ?? null } };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 502;
    return reply.code(statusCode).send({ error: statusCode === 403 ? 'n8n_api_forbidden' : 'n8n_request_failed', message: statusCode === 403 ? 'A chave do n8n não tem permissão para listar workflows e execuções.' : 'Não foi possível carregar workflows reais do n8n. Confira a integração e tente novamente.' });
  }
});

app.post('/api/integrations/n8n/workflows/:id/:action', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: n8nWorkflowIdSchema, action: z.enum(['publish', 'unpublish']) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Workflow ou ação inválidos.' });
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) return reply.code(503).send({ error: 'n8n_not_configured', message: 'Configure a URL segura do n8n e a chave da API no Coolify.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'n8n')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Reative o n8n em Integrações antes de alterar workflows.' });
  const { id, action } = params.data;
  try {
    await n8nApiRequest(`/workflows/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' });
    const verified = await n8nApiRequest(`/workflows/${encodeURIComponent(id)}`) as Record<string, unknown>;
    const active = verified.active === true;
    if (active !== (action === 'publish')) return reply.code(502).send({ error: 'n8n_publish_not_confirmed', message: 'O n8n não confirmou o estado solicitado. Atualize a lista antes de tentar novamente.' });
    const linkedAutomations = await db.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
      sql`${workspaceRecords.data}->>'n8nWorkflowId' = ${id}`,
    ));
    for (const automation of linkedAutomations) {
      const data = { ...automation.data, active, status: active ? 'connected' : 'draft' };
      await db.update(workspaceRecords).set({ data, updatedAt: new Date() }).where(eq(workspaceRecords.id, automation.id));
      await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'automations', entityId: automation.id, action: active ? 'n8n_workflow_published' : 'n8n_workflow_unpublished', payload: { n8nWorkflowId: id } });
    }
    return { data: { id, active, name: verified.name ?? '' } };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 502;
    const permission = statusCode === 403;
    return reply.code(statusCode).send({ error: permission ? 'n8n_api_forbidden' : 'n8n_workflow_action_failed', message: permission ? `A chave da API precisa da permissão workflow:${action === 'publish' ? 'publish' : 'unpublish'}.` : 'Não foi possível alterar o workflow. Confira o status no n8n e tente novamente.' });
  }
});

app.post('/api/workspace/proposals/:id/send-email', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(z.object({ to: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) }), request.body, reply);
  const idempotencyKey = z.string().uuid().safeParse(request.headers['idempotency-key']);
  if (!params.success || !idempotencyKey.success) return reply.code(400).send({ error: 'validation_error', message: 'Proposta ou chave de envio inválida.' });
  if (!body) return;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from || !z.string().email().safeParse(from).success) return reply.code(503).send({ error: 'resend_not_configured', message: 'Configure a chave do Resend e um endereço remetente verificado em Integrações no Coolify.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'resend')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Resend está desconectado no Nexo. Reative em Integrações para enviar.' });

  const reservation = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId),
      eq(workspaceRecords.resource, 'proposals'), isNull(workspaceRecords.archivedAt),
    )).for('update').limit(1);
    if (!row) return { error: 'not_found' as const };
    const data = row.data as Record<string, any>;
    const delivery = data.emailDelivery as Record<string, any> | undefined;
    if (delivery?.key === idempotencyKey.data && delivery.status === 'sent') return { duplicate: true as const, row, delivery };
    if (delivery?.status === 'sending' && delivery.key !== idempotencyKey.data) return { error: 'send_in_progress' as const };
    const nextDelivery = { key: idempotencyKey.data, status: 'sending', recipient: body.to, startedAt: new Date().toISOString() };
    await tx.update(workspaceRecords).set({ data: { ...data, email: body.to, emailDelivery: nextDelivery }, updatedAt: new Date() }).where(eq(workspaceRecords.id, row.id));
    return { row, delivery: nextDelivery };
  });
  if ('error' in reservation) {
    if (reservation.error === 'not_found') return reply.code(404).send({ error: 'not_found', message: 'Proposta não encontrada.' });
    return reply.code(409).send({ error: 'send_in_progress', message: 'Já existe um envio em andamento. Aguarde e atualize a proposta antes de tentar novamente.' });
  }
  if (reservation.duplicate) return { data: { status: 'sent', emailId: reservation.delivery.emailId, recipient: reservation.delivery.recipient, duplicated: true } };

  const proposal = reservation.row.data as Record<string, any>;
  const { html, text } = renderProposalEmail(proposal);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `nexo-proposal-${params.data.id}-${idempotencyKey.data}` },
      body: JSON.stringify({ from, to: [body.to], subject: `Proposta comercial: ${String(proposal.title || proposal.name || 'Nexo')}`, html, text }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => ({})) as { id?: string };
    if (!response.ok || !result.id) {
      await db.update(workspaceRecords).set({ data: { ...proposal, email: body.to, emailDelivery: { key: idempotencyKey.data, status: 'failed', recipient: body.to, failedAt: new Date().toISOString(), providerStatus: response.status } }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, reservation.row.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
      return reply.code(response.status === 429 ? 429 : 502).send({ error: 'resend_send_failed', message: `O Resend recusou o envio (HTTP ${response.status}). Verifique o remetente e o domínio verificado.` });
    }
    const sentAt = new Date().toISOString();
    const emailDelivery = { key: idempotencyKey.data, status: 'sent', recipient: body.to, emailId: result.id, sentAt };
    await db.update(workspaceRecords).set({ data: { ...proposal, email: body.to, status: 'Enviada', tone: 'blue', emailDelivery, date: `Enviada em ${new Date(sentAt).toLocaleDateString('pt-BR')}` }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, reservation.row.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'proposal', entityId: reservation.row.id, action: 'email_sent', payload: { recipient: body.to, emailId: result.id } });
    return { data: { status: 'sent', emailId: result.id, recipient: body.to, sentAt } };
  } catch {
    await db.update(workspaceRecords).set({ data: { ...proposal, email: body.to, emailDelivery: { key: idempotencyKey.data, status: 'failed', recipient: body.to, failedAt: new Date().toISOString() } }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, reservation.row.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
    return reply.code(502).send({ error: 'resend_unreachable', message: 'Não foi possível confirmar o envio no Resend. Use a mesma tentativa antes de iniciar outro envio.' });
  }
});

app.post('/api/auth/login', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const body = parseBody(loginSchema, request.body, reply); if (!body) return;
  const [user] = await db.select().from(users).where(and(
    eq(users.email, body.email), eq(users.active, true), sql`lower(${users.email}) = ${env.OWNER_EMAIL}`,
  )).limit(1);
  if (!user || !(await argon2.verify(user.passwordHash, body.password))) return reply.code(401).send({ error: 'invalid_credentials', message: 'E-mail ou senha incorretos.' });
  const token = app.jwt.sign({ sub: user.id, organizationId: user.organizationId, role: 'owner' });
  reply.setCookie('nexo_session', token, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 });
  const [organization] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
  return { user: { id: user.id, name: user.name, email: user.email, role: 'owner', organizationId: user.organizationId }, organization };
});

app.post('/api/auth/logout', async (_request, reply) => {
  reply.clearCookie('nexo_session', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  return reply.code(204).send();
});

app.get('/api/auth/me', { preHandler: app.authenticate }, async (request, reply) => {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId }).from(users).where(and(eq(users.id, request.user.sub), eq(users.active, true), sql`lower(${users.email}) = ${env.OWNER_EMAIL}`)).limit(1);
  if (!user) return reply.code(401).send({ error: 'unauthorized', message: 'Conta indisponível.' });
  const [organization] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
  return { user, organization };
});

app.get('/api/billing/payment-methods', { preHandler: app.authenticate }, async (request, reply) => {
  if (!await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Mercado Pago está desconectado no Nexo. Reative em Integrações para usar pagamentos.' });
  try {
    const methods = await mercadoPago<Array<Record<string, unknown>>>('/v1/payment_methods');
    return { data: methods.filter((method) => method.status === 'active').map((method) => ({ id: method.id, name: method.name, paymentType: method.payment_type_id, thumbnail: method.secure_thumbnail ?? method.thumbnail })) };
  } catch (error) {
    if (error instanceof Error && error.message === 'mercadopago_not_configured') return reply.code(503).send({ error: 'payment_provider_unavailable', message: 'Mercado Pago ainda não está configurado no servidor.' });
    return reply.code(502).send({ error: 'payment_methods_unavailable', message: 'Não foi possível consultar os meios de pagamento da conta.' });
  }
});

const notificationRoutes: Record<string, string> = {
  leads: 'Leads', clients: 'Clientes', client: 'Clientes', proposals: 'Propostas', projects: 'Projetos',
  tasks: 'Tarefas', events: 'Agenda', tickets: 'Tickets', approvals: 'Aprovações',
  billing_order: 'Cobranças', billing_subscription: 'Assinaturas',
};
const notificationLabels: Record<string, string> = {
  leads: 'lead', clients: 'cliente', client: 'cliente', proposals: 'proposta', projects: 'projeto',
  tasks: 'tarefa', events: 'reunião', tickets: 'ticket de suporte', approvals: 'aprovação',
  billing_order: 'cobrança', billing_subscription: 'assinatura',
};

app.get('/api/notifications', { preHandler: app.authenticate }, async (request) => {
  const [owner] = await db.select({ readAt: users.notificationsReadAt }).from(users).where(eq(users.id, request.user.sub)).limit(1);
  const rows = await db.select({
    id: activityEvents.id, entityType: activityEvents.entityType, entityId: activityEvents.entityId,
    action: activityEvents.action, payload: activityEvents.payload, createdAt: activityEvents.createdAt,
  }).from(activityEvents).where(eq(activityEvents.organizationId, request.user.organizationId))
    .orderBy(desc(activityEvents.createdAt)).limit(200);
  const readAt = owner?.readAt ?? new Date(0);
  const data = rows.flatMap((event) => {
    const label = notificationLabels[event.entityType];
    const route = notificationRoutes[event.entityType];
    if (!label || !route || !['created', 'updated', 'provider_updated'].includes(event.action)) return [];
    const payload = event.payload as Record<string, unknown>;
    const subject = String(payload.label || payload.name || payload.title || '').trim();
    const titleMap: Record<string, [string, string]> = {
      leads: ['Novo lead recebido', 'Lead atualizado'], clients: ['Cliente cadastrado', 'Cliente atualizado'], client: ['Cliente cadastrado', 'Cliente atualizado'],
      proposals: ['Nova proposta', 'Proposta atualizada'], projects: ['Projeto criado', 'Projeto atualizado'],
      tasks: ['Nova tarefa', 'Tarefa atualizada'], events: ['Reunião agendada', 'Reunião atualizada'],
      tickets: ['Novo ticket de suporte', 'Ticket de suporte atualizado'], approvals: ['Nova aprovação', 'Aprovação atualizada'],
      billing_order: ['Cobrança criada', event.action === 'provider_updated' ? 'Pagamento atualizado' : 'Cobrança atualizada'],
      billing_subscription: ['Assinatura criada', 'Assinatura atualizada'],
    };
    const title = titleMap[event.entityType]?.[event.action === 'created' ? 0 : 1] || `${label[0]?.toUpperCase()}${label.slice(1)} atualizado`;
    const amountDetail = typeof payload.amount === 'number' ? `R$ ${payload.amount.toFixed(2).replace('.', ',')}` : '';
    const statusDetail = typeof payload.status === 'string' ? `Status: ${payload.status}` : '';
    const detail = [subject, amountDetail, statusDetail].filter(Boolean).join(' · ') || `${title}.`;
    return [{
      id: event.id, entityId: event.entityId, entityType: event.entityType, page: route,
      title,
      detail, createdAt: event.createdAt, unread: event.createdAt > readAt,
    }];
  });
  return { data, unreadCount: data.filter((item) => item.unread).length, readAt };
});

app.post('/api/notifications/read', { preHandler: app.authenticate }, async (request) => {
  const readAt = new Date();
  await db.update(users).set({ notificationsReadAt: readAt }).where(eq(users.id, request.user.sub));
  return { data: { readAt } };
});

app.get('/api/billing/orders', { preHandler: app.authenticate }, async (request) => {
  const rows = await db.select().from(billingOrders).where(eq(billingOrders.organizationId, request.user.organizationId)).orderBy(desc(billingOrders.createdAt)).limit(100);
  return { data: rows };
});

app.post('/api/billing/orders', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(paymentOrderSchema, request.body, reply); if (!body) return;
  if (!await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Mercado Pago está desconectado no Nexo. Reative em Integrações para usar pagamentos.' });
  if (!env.MERCADOPAGO_ACCESS_TOKEN) return reply.code(503).send({ error: 'payment_provider_unavailable', message: 'Mercado Pago ainda não está configurado no servidor.' });
  if (body.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, body.clientId), eq(clients.organizationId, request.user.organizationId))).limit(1);
    if (!client) return reply.code(404).send({ error: 'client_not_found', message: 'Cliente não encontrado nesta empresa.' });
  }
  const [invoice] = await db.insert(billingOrders).values({
    organizationId: request.user.organizationId, clientId: body.clientId, createdBy: request.user.sub,
    clientName: body.clientName, payerEmail: body.payerEmail, description: body.description,
    amount: body.amount, method: body.method, status: 'creating',
  }).returning();
  const paymentType = body.method === 'pix' ? 'bank_transfer' : body.method === 'boleto' ? 'ticket' : body.method;
  const paymentMethod: Record<string, unknown> = body.method === 'pix'
    ? { id: 'pix', type: paymentType }
    : body.method === 'boleto'
      ? { id: 'boleto', type: paymentType }
      : { id: body.paymentMethodId, type: paymentType, token: body.cardToken, installments: body.installments };
  const payer: Record<string, unknown> = { email: body.payerEmail, first_name: body.clientName };
  if (body.identificationType && body.identificationNumber) payer.identification = { type: body.identificationType, number: body.identificationNumber.replace(/\D/g, '') };
  if (body.address) payer.address = { zip_code: body.address.zipCode, street_name: body.address.streetName, street_number: body.address.streetNumber, neighborhood: body.address.neighborhood, city: body.address.city, state: body.address.state.toUpperCase() };
  try {
    const order = await mercadoPago<Record<string, any>>('/v1/orders', {
      method: 'POST', headers: { 'X-Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        type: 'online', external_reference: invoice!.id, processing_mode: 'automatic',
        total_amount: body.amount.toFixed(2), description: body.description, payer,
        transactions: { payments: [{ amount: body.amount.toFixed(2), payment_method: paymentMethod, ...(body.method === 'pix' ? { expiration_time: 'PT24H' } : {}), ...(body.method === 'boleto' ? { expiration_time: 'P5D' } : {}) }] },
      }),
    });
    const details = paymentDetailsFromOrder(order);
    const [saved] = await db.update(billingOrders).set({
      mpOrderId: details.orderId, mpPaymentId: details.paymentId, status: providerStatus(details.status), statusDetail: details.statusDetail,
      paymentDetails: details as Record<string, unknown>, dueAt: details.expirationAt ? new Date(details.expirationAt) : null, updatedAt: new Date(),
    }).where(eq(billingOrders.id, invoice!.id)).returning();
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'billing_order', entityId: invoice!.id, action: 'created', payload: { method: body.method, amount: body.amount } });
    return reply.code(201).send({ data: saved });
  } catch (error) {
    await db.update(billingOrders).set({ status: 'failed', updatedAt: new Date() }).where(eq(billingOrders.id, invoice!.id));
    if (error instanceof Error && error.message === 'mercadopago_not_configured') return reply.code(503).send({ error: 'payment_provider_unavailable', message: 'Mercado Pago ainda não está configurado no servidor.' });
    return reply.code(502).send({ error: 'payment_creation_failed', message: 'O Mercado Pago não conseguiu criar esta cobrança. Confira os dados e tente novamente.' });
  }
});

app.get('/api/billing/subscriptions', { preHandler: app.authenticate }, async (request) => {
  const rows = await db.select().from(billingSubscriptions).where(eq(billingSubscriptions.organizationId, request.user.organizationId)).orderBy(desc(billingSubscriptions.createdAt)).limit(100);
  return { data: rows };
});

app.post('/api/billing/subscriptions', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(subscriptionSchema, request.body, reply); if (!body) return;
  if (!await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Mercado Pago está desconectado no Nexo. Reative em Integrações para usar assinaturas.' });
  if (!env.MERCADOPAGO_ACCESS_TOKEN) return reply.code(503).send({ error: 'payment_provider_unavailable', message: 'Mercado Pago ainda não está configurado no servidor.' });
  if (body.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, body.clientId), eq(clients.organizationId, request.user.organizationId))).limit(1);
    if (!client) return reply.code(404).send({ error: 'client_not_found', message: 'Cliente não encontrado nesta empresa.' });
  }
  const [subscription] = await db.insert(billingSubscriptions).values({
    organizationId: request.user.organizationId, clientId: body.clientId, createdBy: request.user.sub,
    clientName: body.clientName, payerEmail: body.payerEmail, description: body.description,
    amount: body.amount, frequency: body.frequency, frequencyInterval: body.frequencyInterval, status: 'creating',
  }).returning();
  try {
    const result = await mercadoPago<Record<string, any>>('/preapproval', {
      method: 'POST', headers: { 'X-Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        reason: body.description, external_reference: subscription!.id, payer_email: body.payerEmail,
        auto_recurring: {
          frequency: body.frequencyInterval, frequency_type: body.frequency,
          transaction_amount: body.amount, currency_id: 'BRL',
          ...(body.startAt ? { start_date: body.startAt } : {}), ...(body.endAt ? { end_date: body.endAt } : {}),
        },
        back_url: `${env.APP_ORIGIN.split(',')[0]!.trim()}/financeiro`, status: 'pending',
      }),
    });
    const [saved] = await db.update(billingSubscriptions).set({
      mpSubscriptionId: String(result.id), checkoutUrl: result.init_point ? String(result.init_point) : null,
      status: String(result.status ?? 'pending'), nextPaymentAt: result.next_payment_date ? new Date(String(result.next_payment_date)) : null,
      updatedAt: new Date(),
    }).where(eq(billingSubscriptions.id, subscription!.id)).returning();
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'billing_subscription', entityId: subscription!.id, action: 'created', payload: { frequency: body.frequency, frequencyInterval: body.frequencyInterval, amount: body.amount } });
    return reply.code(201).send({ data: saved });
  } catch {
    await db.update(billingSubscriptions).set({ status: 'failed', updatedAt: new Date() }).where(eq(billingSubscriptions.id, subscription!.id));
    return reply.code(502).send({ error: 'subscription_creation_failed', message: 'Não foi possível iniciar a assinatura no Mercado Pago.' });
  }
});

app.patch('/api/billing/subscriptions/:id/status', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de assinatura inválido.' });
  const body = parseBody(z.object({ status: z.enum(['authorized', 'paused', 'canceled']) }), request.body, reply); if (!body) return;
  if (!await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Mercado Pago está desconectado no Nexo.' });
  const [subscription] = await db.select().from(billingSubscriptions).where(and(eq(billingSubscriptions.id, params.data.id), eq(billingSubscriptions.organizationId, request.user.organizationId))).limit(1);
  if (!subscription) return reply.code(404).send({ error: 'not_found', message: 'Assinatura não encontrada.' });
  if (!subscription.mpSubscriptionId) return reply.code(409).send({ error: 'subscription_not_started', message: 'A assinatura ainda não foi criada no Mercado Pago.' });
  try {
    await mercadoPago(`/preapproval/${encodeURIComponent(subscription.mpSubscriptionId)}`, { method: 'PUT', body: JSON.stringify({ status: body.status }) });
    const [saved] = await db.update(billingSubscriptions).set({ status: body.status, updatedAt: new Date() }).where(eq(billingSubscriptions.id, subscription.id)).returning();
    return { data: saved };
  } catch { return reply.code(502).send({ error: 'subscription_status_update_failed', message: 'Não foi possível atualizar a assinatura no Mercado Pago.' }); }
});

app.post('/api/integrations/mercadopago/webhook', async (request, reply) => {
  const query = z.object({ 'data.id': z.string().optional(), type: z.string().optional(), topic: z.string().optional() }).safeParse(request.query);
  const body = z.object({ type: z.string().optional(), data: z.object({ id: z.union([z.string(), z.number()]).optional() }).optional() }).safeParse(request.body);
  const dataId = query.success ? query.data['data.id'] : undefined;
  if (!env.MERCADOPAGO_WEBHOOK_SECRET) return reply.code(503).send({ error: 'webhook_secret_missing' });
  const signatureHeader = request.headers['x-signature'];
  const requestIdHeader = request.headers['x-request-id'];
  if (!validMercadoPagoSignature(Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader, Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader, dataId)) return reply.code(401).send({ error: 'invalid_signature' });
  const resourceId = dataId ?? (body.success && body.data.data?.id !== undefined ? String(body.data.data.id) : undefined);
  const topic = (query.success && (query.data.type ?? query.data.topic)) ?? (body.success ? body.data.type : undefined);
  if (!resourceId || !env.MERCADOPAGO_ACCESS_TOKEN) return reply.code(200).send({ received: true });
  try {
    if (topic === 'order' || topic === 'merchant_order') {
      const order = await mercadoPago<Record<string, any>>(`/v1/orders/${encodeURIComponent(resourceId)}`);
      const externalReference = String(order.external_reference ?? '');
      const details = paymentDetailsFromOrder(order);
      const [local] = await db.select({ id: billingOrders.id, organizationId: billingOrders.organizationId, status: billingOrders.status, description: billingOrders.description, clientName: billingOrders.clientName, amount: billingOrders.amount }).from(billingOrders).where(eq(billingOrders.id, externalReference)).limit(1);
      if (local) {
        const nextStatus = providerStatus(details.status);
        await db.update(billingOrders).set({ status: nextStatus, statusDetail: details.statusDetail, mpPaymentId: details.paymentId, paymentDetails: details as Record<string, unknown>, updatedAt: new Date() }).where(eq(billingOrders.id, local.id));
        await db.insert(activityEvents).values({ organizationId: local.organizationId, entityType: 'billing_order', entityId: local.id, action: 'provider_updated', payload: { status: providerStatus(details.status) } });
        if (nextStatus === 'paid' && local.status !== 'paid') void dispatchN8nEvent(local.organizationId, 'payment.confirmed', { id: local.id, title: local.description, client: local.clientName, amount: local.amount });
      }
    } else if (topic === 'subscription_preapproval') {
      const remote = await mercadoPago<Record<string, any>>(`/preapproval/${encodeURIComponent(resourceId)}`);
      const externalReference = String(remote.external_reference ?? '');
      await db.update(billingSubscriptions).set({ status: String(remote.status ?? 'pending'), nextPaymentAt: remote.next_payment_date ? new Date(String(remote.next_payment_date)) : null, updatedAt: new Date() }).where(eq(billingSubscriptions.id, externalReference));
    }
    return reply.code(200).send({ received: true });
  } catch { return reply.code(500).send({ error: 'webhook_processing_failed' }); }
});

app.get('/api/clients', { preHandler: app.authenticate }, async (request, reply) => {
  const querySchema = z.object({ search: z.string().trim().max(120).optional(), status: z.enum(['active', 'inactive', 'archived']).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0) });
  const query = parseBody(querySchema, request.query, reply); if (!query) return;
  const clauses = [eq(clients.organizationId, request.user.organizationId)];
  if (query.status) clauses.push(eq(clients.status, query.status));
  if (query.search) { const match = `%${query.search.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`; clauses.push(or(ilike(clients.name, match), ilike(clients.contactName, match), ilike(clients.email, match))!); }
  const where = and(...clauses);
  const [rows, count] = await Promise.all([
    db.select().from(clients).where(where).orderBy(desc(clients.updatedAt), asc(clients.name)).limit(query.limit).offset(query.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(clients).where(where),
  ]);
  return { data: rows, pagination: { limit: query.limit, offset: query.offset, total: count[0]?.count ?? 0 } };
});

app.post('/api/clients', { preHandler: app.authenticate }, async (request, reply) => {
  const body = parseBody(clientSchema, request.body, reply); if (!body) return;
  const [client] = await db.transaction(async (tx) => {
    const created = await tx.insert(clients).values({ ...body, email: body.email || null, organizationId: request.user.organizationId }).returning();
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'client', entityId: created[0]!.id, action: 'created', payload: { name: created[0]!.name } });
    return created;
  });
  return reply.code(201).send({ data: client });
});

app.get('/api/clients/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de cliente inválido.' });
  const [client] = await db.select().from(clients).where(and(eq(clients.id, params.data.id), eq(clients.organizationId, request.user.organizationId))).limit(1);
  if (!client) return reply.code(404).send({ error: 'not_found', message: 'Cliente não encontrado.' });
  return { data: client };
});

app.patch('/api/clients/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de cliente inválido.' });
  const bodySchema = clientSchema.partial().refine((body) => Object.keys(body).length > 0, 'Envie pelo menos um campo.');
  const body = parseBody(bodySchema, request.body, reply); if (!body) return;
  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(clients).set({ ...body, ...(body.email !== undefined ? { email: body.email || null } : {}), updatedAt: new Date() }).where(and(eq(clients.id, params.data.id), eq(clients.organizationId, request.user.organizationId), sql`${clients.status} <> 'archived'`)).returning();
    if (!rows[0]) return undefined;
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'client', entityId: rows[0].id, action: 'updated', payload: { fields: Object.keys(body) } });
    return rows[0];
  });
  if (!updated) return reply.code(404).send({ error: 'not_found', message: 'Cliente não encontrado ou arquivado.' });
  return { data: updated };
});

app.delete('/api/clients/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de cliente inválido.' });
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx.update(clients).set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(clients.id, params.data.id), eq(clients.organizationId, request.user.organizationId), sql`${clients.status} <> 'archived'`)).returning({ id: clients.id, name: clients.name });
    if (rows[0]) await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'client', entityId: rows[0].id, action: 'archived', payload: { name: rows[0].name } });
    return rows;
  });
  if (!updated) return reply.code(404).send({ error: 'not_found', message: 'Cliente não encontrado.' });
  return reply.code(204).send();
});

app.get('/api/workspace/:resource', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource }).safeParse(request.params);
  const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100), offset: z.coerce.number().int().min(0).default(0) }).safeParse(request.query);
  if (!params.success || !query.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso ou paginação inválidos.' });
  const where = and(eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource), isNull(workspaceRecords.archivedAt));
  const [rows, count] = await Promise.all([
    db.select().from(workspaceRecords).where(where).orderBy(desc(workspaceRecords.updatedAt)).limit(query.data.limit).offset(query.data.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(workspaceRecords).where(where),
  ]);
  return { data: rows.map((row) => ({ ...row.data, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt })), pagination: { ...query.data, total: count[0]?.count ?? 0 } };
});

app.post('/api/workspace/:resource', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource }).safeParse(request.params);
  const body = parseBody(z.object({ data: workspaceDataSchema }), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso inválido.' });
  if (!body) return;
  const [saved] = await db.transaction(async (tx) => {
    const created = await tx.insert(workspaceRecords).values({ organizationId: request.user.organizationId, createdBy: request.user.sub, resource: params.data.resource, data: body.data }).returning();
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: params.data.resource, entityId: created[0]!.id, action: 'created', payload: { label: body.data.name ?? body.data.title ?? body.data.clientName ?? '' } });
    if (params.data.resource === 'leads') {
      const [linkedN8nAutomation] = await tx.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
        sql`${workspaceRecords.data}->>'eventKey' = 'lead.created'`, sql`${workspaceRecords.data}->>'active' = 'true'`, sql`${workspaceRecords.data}->>'n8nWorkflowId' <> ''`,
      )).limit(1);
      if (!linkedN8nAutomation) {
        const leadName = String(body.data.name ?? body.data.title ?? 'novo lead');
        const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const [task] = await tx.insert(workspaceRecords).values({ organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'tasks', data: {
          title: `Primeiro contato - ${leadName}`, client: String(body.data.company ?? leadName), project: '', due, status: 'A fazer', priority: 'Alta', assignee: '',
          automationKey: 'lead-first-contact', sourceLeadId: created[0]!.id,
        } }).returning();
        await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'tasks', entityId: task!.id, action: 'created', payload: { automation: 'lead-first-contact', leadId: created[0]!.id } });
      }
    }
    return created;
  });
  if (params.data.resource === 'leads') void dispatchN8nEvent(request.user.organizationId, 'lead.created', { ...saved!.data, id: saved!.id });
  if (params.data.resource === 'tickets') void dispatchN8nEvent(request.user.organizationId, 'ticket.created', { ...saved!.data, id: saved!.id });
  return reply.code(201).send({ data: { ...saved!.data, id: saved!.id, createdAt: saved!.createdAt, updatedAt: saved!.updatedAt } });
});

app.patch('/api/workspace/:resource/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource, id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(z.object({ data: workspaceDataSchema }).refine((value) => Object.keys(value.data).length > 0), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso ou identificador inválidos.' });
  if (!body) return;
  let previousData: Record<string, unknown> | undefined;
  const updated = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource), isNull(workspaceRecords.archivedAt))).limit(1);
    if (!current) return undefined;
    previousData = current.data;
    const [saved] = await tx.update(workspaceRecords).set({ data: { ...current.data, ...body.data }, updatedAt: new Date() }).where(eq(workspaceRecords.id, current.id)).returning();
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: params.data.resource, entityId: current.id, action: 'updated', payload: { fields: Object.keys(body.data) } });
    const completedStatuses = new Set(['Concluído', 'Concluido', 'Publicado', 'Entregue']);
    const projectName = String(body.data.name ?? current.data.name ?? current.data.title ?? 'Projeto');
    if (params.data.resource === 'projects' && completedStatuses.has(String(body.data.status ?? '')) && !completedStatuses.has(String(current.data.status ?? ''))) {
      const [existingFollowUp] = await tx.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
        sql`${workspaceRecords.data}->>'automationKey' = 'project-delivery-follow-up'`, sql`${workspaceRecords.data}->>'projectId' = ${current.id}`,
      )).limit(1);
      const [linkedN8nAutomation] = await tx.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
        sql`${workspaceRecords.data}->>'eventKey' = 'project.published'`, sql`${workspaceRecords.data}->>'active' = 'true'`, sql`${workspaceRecords.data}->>'n8nWorkflowId' <> ''`,
      )).limit(1);
      if (!existingFollowUp && !linkedN8nAutomation) {
        const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const [task] = await tx.insert(workspaceRecords).values({ organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'tasks', data: {
          title: `Acompanhamento da entrega · ${projectName}`, client: String(body.data.client ?? current.data.client ?? ''), project: projectName, projectId: current.id,
          due, status: 'A fazer', priority: 'Normal', assignee: '', automationKey: 'project-delivery-follow-up',
        } }).returning();
        await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'tasks', entityId: task!.id, action: 'created', payload: { automation: 'project-delivery-follow-up', projectId: current.id } });
      }
    }
    return saved;
  });
  if (!updated) return reply.code(404).send({ error: 'not_found', message: 'Registro não encontrado.' });
  const normalizeStatus = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const priorStatus = normalizeStatus(previousData?.status);
  const nextStatus = normalizeStatus(body.data.status);
  const publishedStatuses = new Set(['publicado', 'entregue', 'concluido']);
  if (params.data.resource === 'projects' && publishedStatuses.has(nextStatus) && !publishedStatuses.has(priorStatus)) void dispatchN8nEvent(request.user.organizationId, 'project.published', { ...updated.data, id: updated.id });
  if (params.data.resource === 'proposals' && nextStatus === 'aprovada' && priorStatus !== 'aprovada') void dispatchN8nEvent(request.user.organizationId, 'proposal.accepted', { ...updated.data, id: updated.id });
  return { data: { ...updated.data, id: updated.id, createdAt: updated.createdAt, updatedAt: updated.updatedAt } };
});

app.delete('/api/workspace/:resource/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource, id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso ou identificador inválidos.' });
  if (params.data.resource === 'automations') {
    const [automation] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt))).limit(1);
    if (automation?.data.active === true && automation.data.n8nWorkflowId) {
      if (!process.env.N8N_API_KEY || !process.env.N8N_BASE_URL || !await isIntegrationEnabled(request.user.organizationId, 'n8n')) return reply.code(409).send({ error: 'n8n_workflow_active', message: 'Despublique o workflow do n8n antes de excluir esta automação.' });
      try {
        const workflowId = String(automation.data.n8nWorkflowId);
        await n8nApiRequest(`/workflows/${encodeURIComponent(workflowId)}/unpublish`, { method: 'POST', body: '{}' });
        const verified = await n8nApiRequest(`/workflows/${encodeURIComponent(workflowId)}`) as Record<string, unknown>;
        if (verified.active === true) return reply.code(502).send({ error: 'n8n_unpublish_not_confirmed', message: 'O n8n não confirmou a despublicação; a automação foi mantida.' });
      } catch { return reply.code(502).send({ error: 'n8n_unpublish_failed', message: 'Não foi possível despublicar no n8n; a automação foi mantida.' }); }
    }
  }
  const [archived] = await db.transaction(async (tx) => {
    const rows = await tx.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource), isNull(workspaceRecords.archivedAt))).returning({ id: workspaceRecords.id });
    if (rows[0]) await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: params.data.resource, entityId: rows[0].id, action: 'archived', payload: {} });
    return rows;
  });
  if (!archived) return reply.code(404).send({ error: 'not_found', message: 'Registro não encontrado.' });
  return reply.code(204).send();
});

app.post('/api/workspace/clients/:id/portal-link', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Cliente inválido.' });
  const [client] = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
    eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  if (!client) return reply.code(404).send({ error: 'not_found', message: 'Cliente não encontrado.' });
  const clientData = client.data as Record<string, unknown>;
  const version = Number(clientData.portalTokenVersion ?? 0) + 1;
  await db.update(workspaceRecords).set({ data: { ...clientData, portalTokenVersion: version }, updatedAt: new Date() }).where(eq(workspaceRecords.id, client.id));
  const portalPayload = { sub: client.id, role: 'member' as const, purpose: 'client_portal', clientRecordId: client.id, organizationId: request.user.organizationId, version };
  const token = app.jwt.sign(portalPayload, { expiresIn: '90d' });
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'client', entityId: client.id, action: 'portal_link_created', payload: {} });
  return { data: { url: `${env.APP_ORIGIN.split(',')[0]!.trim()}/portal/${encodeURIComponent(token)}`, expiresInDays: 90 } };
});

function verifyPortalClaims(token: string) {
  try {
    const claims = app.jwt.verify<{ purpose?: string; clientRecordId?: string; organizationId?: string; version?: number }>(token);
    if (claims.purpose !== 'client_portal' || !claims.clientRecordId || !claims.organizationId || !Number.isInteger(claims.version)) return null;
    return claims as { purpose: 'client_portal'; clientRecordId: string; organizationId: string; version: number };
  } catch { return null; }
}

app.get('/api/public/client-portal/:token', async (request, reply) => {
  const params = z.object({ token: z.string().min(20).max(4096) }).safeParse(request.params);
  if (!params.success) return reply.code(404).send({ error: 'portal_not_found' });
  const claims = verifyPortalClaims(params.data.token);
  if (!claims) return reply.code(404).send({ error: 'portal_not_found', message: 'Este link expirou ou não é válido.' });
  const [record] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.id, claims.clientRecordId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  if (!record) return reply.code(404).send({ error: 'portal_not_found' });
  const client = record.data as Record<string, unknown>;
  if (Number(client.portalTokenVersion ?? 0) !== claims.version) return reply.code(404).send({ error: 'portal_not_found' });
  const clientName = String(client.name ?? client.title ?? '');
  const visibility = { project: true, tasks: true, contracts: true, payments: true, approvals: true, ...((client.portalVisibility && typeof client.portalVisibility === 'object') ? client.portalVisibility as Record<string, boolean> : {}) };
  const resources = ['projects', 'tasks', 'contracts', 'approvals'];
  const relatedRows = await Promise.all(resources.map((resource) => db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, resource), isNull(workspaceRecords.archivedAt),
  )).orderBy(desc(workspaceRecords.updatedAt)).limit(300)));
  const related = Object.fromEntries(resources.map((resource, index) => [resource, relatedRows[index]!.filter((row) => {
    const data = row.data as Record<string, unknown>;
    return data.clientId === record.id;
  }).map((row) => {
    const data = row.data as Record<string, unknown>;
    const common = { id: row.id, status: data.status };
    if (resource === 'projects') return { ...common, name: data.name ?? data.title ?? '', due: data.due ?? data.dueDate ?? '', progress: data.progress ?? 0 };
    if (resource === 'tasks') return { ...common, title: data.title ?? data.name ?? '', due: data.due ?? data.dueDate ?? '' };
    if (resource === 'contracts') return { ...common, title: data.title ?? data.name ?? '', code: data.code ?? '', renewal: data.renewal ?? '' };
    return { ...common, title: data.title ?? data.name ?? '' };
  })]));
  const [payments] = await Promise.all([db.select({ id: billingOrders.id, description: billingOrders.description, amount: billingOrders.amount, status: billingOrders.status, dueAt: billingOrders.dueAt, paymentDetails: billingOrders.paymentDetails, createdAt: billingOrders.createdAt }).from(billingOrders).where(and(
    eq(billingOrders.organizationId, claims.organizationId), eq(billingOrders.clientId, record.id),
  )).orderBy(desc(billingOrders.createdAt)).limit(100)]);
  const publicPayments = payments.map((item) => {
    const details = item.paymentDetails && typeof item.paymentDetails === 'object' ? item.paymentDetails as Record<string, unknown> : {};
    return { id: item.id, description: item.description, amount: item.amount, status: item.status, dueAt: item.dueAt, paymentDetails: { pixCode: details.pixCode ?? null, ticketUrl: details.ticketUrl ?? null } };
  });
  return { data: { client: { name: clientName, person: client.person ?? '' }, projects: visibility.project ? related.projects : [], tasks: visibility.tasks ? related.tasks : [], contracts: visibility.contracts ? related.contracts : [], approvals: visibility.approvals ? related.approvals : [], payments: visibility.payments ? publicPayments : [] } };
});

app.post('/api/public/client-portal/:token/messages', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ token: z.string().min(20).max(4096) }).safeParse(request.params);
  const body = parseBody(z.object({ message: z.string().trim().min(1).max(2000) }), request.body, reply);
  if (!params.success) return reply.code(404).send({ error: 'portal_not_found' });
  if (!body) return;
  const claims = verifyPortalClaims(params.data.token);
  if (!claims) return reply.code(404).send({ error: 'portal_not_found' });
  const [client] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, claims.clientRecordId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt))).limit(1);
  if (!client) return reply.code(404).send({ error: 'portal_not_found' });
  if (Number((client.data as Record<string, unknown>).portalTokenVersion ?? 0) !== claims.version) return reply.code(404).send({ error: 'portal_not_found' });
  const name = String((client.data as Record<string, unknown>).name ?? 'Cliente');
  const [saved] = await db.transaction(async (tx) => {
    const row = await tx.insert(workspaceRecords).values({ organizationId: claims.organizationId, createdBy: null, resource: 'inbox', data: {
      clientId: client.id, client: name, channel: 'portal', direction: 'inbound', message: body.message, status: 'unread', source: 'client-portal',
    } }).returning();
    await tx.insert(activityEvents).values({ organizationId: claims.organizationId, entityType: 'client', entityId: client.id, action: 'portal_message_received', payload: { messageId: row[0]!.id } });
    return row;
  });
  return reply.code(201).send({ data: { id: saved!.id, received: true } });
});

app.post('/api/public/client-portal/:token/approvals/:id', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ token: z.string().min(20).max(4096), id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(z.object({ decision: z.enum(['approved', 'changes_requested']), comment: z.string().trim().max(2000).optional() }), request.body, reply);
  if (!params.success) return reply.code(404).send({ error: 'portal_not_found' });
  if (!body) return;
  const claims = verifyPortalClaims(params.data.token);
  if (!claims) return reply.code(404).send({ error: 'portal_not_found' });
  const [client] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, claims.clientRecordId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt))).limit(1);
  const [approval] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'approvals'), isNull(workspaceRecords.archivedAt))).limit(1);
  if (!client || !approval) return reply.code(404).send({ error: 'approval_not_found' });
  if (Number((client.data as Record<string, unknown>).portalTokenVersion ?? 0) !== claims.version) return reply.code(404).send({ error: 'approval_not_found' });
  const approvalData = approval.data as Record<string, unknown>;
  if (approvalData.clientId !== client.id) return reply.code(404).send({ error: 'approval_not_found' });
  const status = body.decision === 'approved' ? 'Aprovada' : 'Alterações solicitadas';
  const [saved] = await db.transaction(async (tx) => {
    const row = await tx.update(workspaceRecords).set({ data: { ...approvalData, status, clientComment: body.comment ?? '', decidedAt: new Date().toISOString() }, updatedAt: new Date() }).where(eq(workspaceRecords.id, approval.id)).returning();
    await tx.insert(activityEvents).values({ organizationId: claims.organizationId, entityType: 'client', entityId: client.id, action: `portal_approval_${body.decision}`, payload: { approvalId: approval.id } });
    return row;
  });
  return { data: { id: saved!.id, status } };
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  if (reply.sent) return;
  if (error instanceof Error && 'code' in error && error.code === '23505') return reply.code(409).send({ error: 'conflict', message: 'Já existe um registro com esses dados.' });
  return reply.code(500).send({ error: 'internal_error', message: 'Não foi possível concluir a solicitação.' });
});

app.addHook('onClose', async () => { await pool.end(); });
try {
  if (process.env.RUN_MIGRATIONS !== 'false') await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
  const removedAccounts = await db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${env.OWNER_EMAIL}`).limit(1);
    if (!owner) return null;
    const removed = await tx.delete(users).where(sql`${users.id} <> ${owner.id}`).returning({ id: users.id });
    await tx.update(users).set({ active: true, role: 'owner' }).where(eq(users.id, owner.id));
    return { ownerId: owner.id, removedCount: removed.length };
  });
  if (removedAccounts === null) app.log.error('Owner account is missing; no user accounts were removed.');
  else { ownerAccountId = removedAccounts.ownerId; if (removedAccounts.removedCount > 0) app.log.info({ removedAccounts: removedAccounts.removedCount }, 'Removed non-owner accounts.'); }
  await app.listen({ port: env.PORT, host: env.HOST });
}
catch (error) { app.log.error(error); process.exit(1); }
