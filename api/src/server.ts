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
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db, pool } from './db/index.js';
import { activityEvents, billingOrders, billingSubscriptions, clients, organizations, users, workspaceRecords } from './db/schema.js';

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
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || request.url.startsWith('/api/integrations/mercadopago/webhook')) return;
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return reply.code(403).send({ error: 'origin_forbidden', message: 'Origem da solicitacao nao autorizada.' });
});

app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify({ onlyCookie: true });
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
const workspaceDataSchema = z.record(z.string().trim().min(1).max(100), z.unknown()).refine((data) => {
  const forbidden = /password|secret|token|apikey|accesskey|privatekey/i;
  return Object.keys(data).every((key) => !forbidden.test(key)) && JSON.stringify(data).length <= 64_000;
}, 'O registro contém um campo privado ou excede o limite permitido.');
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
  const row = await findOwnedWahaSession(request.user.organizationId, params.data.id);
  if (!row) return reply.code(404).send({ error: 'not_found', message: 'Sessão não encontrada.' });
  await wahaRequest(`/api/sessions/${encodeURIComponent(wahaSessionName(row))}/${params.data.action}`, { method: 'POST', body: '{}' });
  return { data: { id: row.id, action: params.data.action, status: params.data.action === 'stop' ? 'STOPPED' : params.data.action === 'logout' ? 'SCAN_QR_CODE' : 'STARTING' } };
});

app.delete('/api/integrations/waha/sessions/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Sessão inválida.' });
  const row = await findOwnedWahaSession(request.user.organizationId, params.data.id);
  if (!row) return reply.code(404).send({ error: 'not_found', message: 'Sessão não encontrada.' });
  await wahaRequest(`/api/sessions/${encodeURIComponent(wahaSessionName(row))}`, { method: 'DELETE' }).catch((error) => { if ((error as { statusCode?: number }).statusCode !== 404) throw error; });
  await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(workspaceRecords.id, row.id));
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'whatsapp-session', entityId: row.id, action: 'deleted', payload: { label: row.data.label } });
  return reply.code(204).send();
});

app.get('/api/integrations/status', { preHandler: app.authenticate }, async () => ({ data: [
  { name: 'Mercado Pago', configured: Boolean(env.MERCADOPAGO_ACCESS_TOKEN) },
  { name: 'Evolution API', configured: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) },
  { name: 'WAHA', configured: Boolean(env.WAHA_API_URL && env.WAHA_API_KEY) },
  { name: 'Resend', configured: Boolean(process.env.RESEND_API_KEY) },
  { name: 'Google Workspace', configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) },
  { name: 'GitHub', configured: Boolean(process.env.GITHUB_TOKEN) },
  { name: 'n8n', configured: Boolean(process.env.N8N_WEBHOOK_URL) },
  { name: 'Sentry', configured: Boolean(process.env.SENTRY_DSN) },
] }));

app.post('/api/integrations/:provider/test', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ provider: z.enum(['mercadopago', 'evolution', 'waha', 'resend', 'github', 'google', 'n8n', 'sentry']) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Integração inválida.' });
  const provider = params.data.provider;
  const unavailable = (message: string) => reply.code(503).send({ error: 'integration_not_configured', message });
  try {
    if (provider === 'mercadopago') {
      if (!env.MERCADOPAGO_ACCESS_TOKEN) return unavailable('Configure MERCADOPAGO_ACCESS_TOKEN nas variáveis do serviço API no Coolify.');
      const methods = await mercadoPago<Array<{ id: string }>>('/v1/payment_methods');
      return { data: { status: 'connected', message: `Mercado Pago respondeu. ${methods.length} meios de pagamento disponíveis.` } };
    }
    if (provider === 'waha') {
      if (!env.WAHA_API_URL || !env.WAHA_API_KEY) return unavailable('Configure WAHA_API_URL e WAHA_API_KEY no serviço API.');
      const sessions = await wahaRequest<Array<{ name?: string }>>('/api/sessions');
      return { data: { status: 'connected', message: `WAHA respondeu. ${sessions.length} sessão(ões) encontrada(s).` } };
    }
    if (provider === 'evolution') {
      const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
      const apiKey = process.env.EVOLUTION_API_KEY;
      if (!baseUrl || !apiKey) return unavailable('Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no serviço API.');
      const response = await fetch(`${baseUrl}/instance/fetchInstances`, { headers: { apikey: apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return reply.code(502).send({ error: 'integration_test_failed', message: `Evolution API respondeu com HTTP ${response.status}. Confira a URL e a chave configuradas.` });
      const instances = await response.json().catch(() => []);
      return { data: { status: 'connected', message: `Evolution API respondeu. ${Array.isArray(instances) ? instances.length : 0} instância(s) encontrada(s).` } };
    }
    if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return unavailable('Configure RESEND_API_KEY no serviço API.');
      const response = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return reply.code(502).send({ error: 'integration_test_failed', message: `Resend respondeu com HTTP ${response.status}. Confira a chave configurada.` });
      const result = await response.json() as { data?: unknown[] };
      return { data: { status: 'connected', message: `Resend respondeu. ${result.data?.length ?? 0} domínio(s) disponível(is).` } };
    }
    if (provider === 'github') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return unavailable('Configure GITHUB_TOKEN no serviço API.');
      const response = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) return reply.code(502).send({ error: 'integration_test_failed', message: `GitHub respondeu com HTTP ${response.status}. Confira o token e as permissões.` });
      const result = await response.json() as { login?: string };
      return { data: { status: 'connected', message: `GitHub conectado como ${result.login || 'usuário autenticado'}.` } };
    }
    if (provider === 'google') return { data: { status: 'setup_required', message: 'As credenciais do Google não concluem a autorização. O fluxo OAuth precisa ser finalizado antes de testar Gmail, Calendar, Drive e Meet.' } };
    if (provider === 'n8n') return { data: { status: 'setup_required', message: 'Configure uma URL base e uma chave de API do n8n para validar a conexão sem disparar um workflow.' } };
    return { data: { status: 'setup_required', message: 'O DSN do Sentry está no servidor, mas validar a ingestão exige enviar um evento de teste que criaria um evento no projeto.' } };
  } catch (error) {
    app.log.warn({ provider, error: error instanceof Error ? error.name : 'unknown' }, 'Integration connection test failed');
    return reply.code(502).send({ error: 'integration_test_failed', message: 'Não foi possível confirmar a conexão. Confira o serviço, a URL e as credenciais no Coolify.' });
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

app.get('/api/billing/payment-methods', { preHandler: app.authenticate }, async (_request, reply) => {
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
      const [local] = await db.select({ id: billingOrders.id, organizationId: billingOrders.organizationId }).from(billingOrders).where(eq(billingOrders.id, externalReference)).limit(1);
      if (local) {
        await db.update(billingOrders).set({ status: providerStatus(details.status), statusDetail: details.statusDetail, mpPaymentId: details.paymentId, paymentDetails: details as Record<string, unknown>, updatedAt: new Date() }).where(eq(billingOrders.id, local.id));
        await db.insert(activityEvents).values({ organizationId: local.organizationId, entityType: 'billing_order', entityId: local.id, action: 'provider_updated', payload: { status: providerStatus(details.status) } });
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
    return created;
  });
  return reply.code(201).send({ data: { ...saved!.data, id: saved!.id, createdAt: saved!.createdAt, updatedAt: saved!.updatedAt } });
});

app.patch('/api/workspace/:resource/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource, id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(z.object({ data: workspaceDataSchema }).refine((value) => Object.keys(value.data).length > 0), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso ou identificador inválidos.' });
  if (!body) return;
  const updated = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource), isNull(workspaceRecords.archivedAt))).limit(1);
    if (!current) return undefined;
    const [saved] = await tx.update(workspaceRecords).set({ data: { ...current.data, ...body.data }, updatedAt: new Date() }).where(eq(workspaceRecords.id, current.id)).returning();
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: params.data.resource, entityId: current.id, action: 'updated', payload: { fields: Object.keys(body.data) } });
    return saved;
  });
  if (!updated) return reply.code(404).send({ error: 'not_found', message: 'Registro não encontrado.' });
  return { data: { ...updated.data, id: updated.id, createdAt: updated.createdAt, updatedAt: updated.updatedAt } };
});

app.delete('/api/workspace/:resource/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource, id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso ou identificador inválidos.' });
  const [archived] = await db.transaction(async (tx) => {
    const rows = await tx.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource), isNull(workspaceRecords.archivedAt))).returning({ id: workspaceRecords.id });
    if (rows[0]) await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: params.data.resource, entityId: rows[0].id, action: 'archived', payload: {} });
    return rows;
  });
  if (!archived) return reply.code(404).send({ error: 'not_found', message: 'Registro não encontrado.' });
  return reply.code(204).send();
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
