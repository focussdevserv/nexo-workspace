import 'dotenv/config';
import { readFileSync } from 'node:fs';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import rawBody from 'fastify-raw-body';
import argon2 from 'argon2';
import * as Sentry from '@sentry/node';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { and, asc, desc, eq, ilike, inArray, isNull, lte, notExists, or, sql } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { simpleParser } from 'mailparser';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { db, pool } from './db/index.js';
import { activityEvents, billingOrders, billingOverdueEvents, billingSubscriptions, clients, n8nEventDeliveries, organizations, passwordResetTokens, users, workspaceRecords } from './db/schema.js';
import { isSafeWorkspaceData } from './security/workspace-data.js';
import { buildWorkspaceBackup, parseWorkspaceBackup } from './workspace-backup.js';
import { findDuplicateLead, findLeadDuplicateMatch } from './crm/lead-identity.js';
import { buildClientFromLead, mergeLeadServiceIntoClient } from './crm/lead-conversion.js';
import { canChangeProjectArchiveState, isWorkspaceRequestAllowed, type WorkspaceRecordScope } from './security/authorization.js';
import { billingClientIdsForWorkspaceScope, clientLinkedWorkspaceResources, recordMatchesWorkspaceScope } from './security/record-scope.js';
import { renderProposalEmail } from './email/proposal.js';
import { buildGoogleRawMessage, decodeGoogleDriveUpload, decodeGoogleMailAttachments, googleMailAddresses, googleThreadBelongsToAllowedContacts, mapGoogleMailMessage } from './integrations/google-mail.js';
import { classifyGoogleDriveListFailure, googleDriveFileMetadataUrl, googleDriveFilesListUrl, mapGoogleDriveFile, type GoogleDriveFile } from './integrations/google-drive.js';
import { validateClientServiceCharges } from './integrations/client-service-charges.js';
import { clientApprovalDecisionHasValidComment, clientPortalApprovalDecisionRecord, isClientApprovalPending, portalApprovalRecord } from './integrations/client-approvals.js';
import { recordBelongsToPortalClient } from './security/client-portal-record-scope.js';
import { isClientPortalSectionVisible } from './security/client-portal-visibility.js';
import { approvalFileMatchesClientScope } from './security/approval-file-scope.js';
import { hashPortalLoginCode, maskPortalEmail, portalIdentifierMatches, portalLoginCodeMatches } from './integrations/client-portal-auth.js';
import { safeClientPortalBranding } from './integrations/client-portal-branding.js';
import { normalizeHostingerCredentials, verifyHostingerMailbox, type HostingerCredentials } from './integrations/hostinger-mail.js';
import { buildOverduePaymentEvent, overduePaymentRetryDelayMs } from './integrations/overdue-payment.js';
import { proposalAcceptanceDisposition } from './integrations/proposal-acceptance.js';
import { resendOperationalReadiness } from './integrations/resend-readiness.js';
import { passwordResetDeliveryReadiness } from './auth/password-reset-readiness.js';
import { shouldRenewPersistentWorkspaceSession, workspaceSessionCookieOptions, workspaceSessionPolicy, workspaceSessionVersionIsCurrent } from './auth/session-policy.js';
import { normalizeAccountEmail } from './auth/account-email.js';
import { mapGitHubRepositoryActivity } from './integrations/github.js';
import { googleCalendarTestDisposition } from './integrations/google-health.js';
import { sameMercadoPagoPaymentSnapshot } from './integrations/mercadopago.js';
import { matchesMercadoPagoExternalReference, mercadoPagoAccountMatchesRecord, mercadoPagoWebhookResource } from './integrations/mercadopago-webhook.js';
import { calculateFinanceTransferBalances } from './integrations/finance-transfers.js';
import { calculateAccountMovementBalance, canUpdateFinanceAccountBalance, isCurrencyAmount, isCurrencyBalance, reverseAccountMovementBalance } from './integrations/account-ledger.js';
import { paymentDueDateAtEndOfDay, paymentDueDateDuration } from './billing/due-date.js';
import { withStableBillingPaidAt } from './billing/paid-at.js';
import { subscriptionDateTimeSchema, validateSubscriptionDates } from './billing/subscription-dates.js';
import { billingMethodPreferenceAllows } from './billing/method-preferences.js';
import { isBillingOrderCancelable } from './billing/order-cancellation.js';
import { canTransitionBillingSubscription, normalizeBillingSubscriptionStatus } from './billing/subscription-transitions.js';
import { buildFinanceRecurrenceDates } from './integrations/finance-recurrence.js';
import { buildWahaSendFilePayload, classifyWahaQrResponse, classifyWahaSessionReadiness } from './integrations/waha.js';
import { clicksignBaseUrl, createClicksignEnvelope, getClicksignEnvelope, notifyClicksignEnvelope } from './integrations/clicksign.js';
import { mapN8nCollections, n8nAutomationTemplates, buildN8nAutomationWorkflow, n8nApiKeyFailureMessage, n8nApiValidationMessage, n8nProposalTaskMatchesSource, n8nWorkflowActionEndpoint, n8nWorkflowsEndpoint, type N8nAutomationTemplateId } from './integrations/n8n.js';
import { N8N_DELIVERY_MAX_ATTEMPTS, n8nCallbackRejectionReason, n8nDeliveryCanRetry, n8nDeliveryExhausted, n8nDeliveryRetryDelayMs } from './integrations/n8n-delivery.js';
import { isUnverifiedContractTransition, requiresExternalSignature } from './contracts/status.js';
import { checkPublicSite } from './monitoring/site-check.js';
import { siteCheckFailureData } from './monitoring/site-check-failure.js';
import { scrubSentryEvent } from './integrations/sentry-scrub.js';
import { normalizeBrowserNotificationPreferences, notificationAccessPath, resolveActivityNotificationTitle } from './notifications.js';
import { googleCalendarAttendeesPayload, mapGoogleCalendarEvents } from './integrations/google-calendar.js';
import { isValidCalendarTimeZone, localDateTimeToIso, nextCalendarDate, normalizeCalendarTimeZone } from './integrations/calendar-time-zone.js';
import { buildGoogleAuthorizationUrl, googleOAuthStateRecordIsActive } from './integrations/google-oauth.js';
import { buildMercadoPagoAuthorizationUrl, createPkcePair, mercadoPagoOAuthStateIsActive, parseMercadoPagoTokenSet, type MercadoPagoTokenSet } from './integrations/mercadopago-oauth.js';
import { canApplyClicksignWebhookStatus, clicksignContractStatus, clicksignWebhookEnvelopeStatus, clicksignWebhookIsReady, parseClicksignWebhookEvent, verifyClicksignWebhook } from './integrations/clicksign-webhook.js';

const env = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(32),
  OWNER_EMAIL: z.string().email().default('contato@focussdev.art').transform((value) => value.trim().toLowerCase()),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_CLIENT_ID: z.string().optional(),
  MERCADOPAGO_CLIENT_SECRET: z.string().optional(),
  MERCADOPAGO_REDIRECT_URI: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  WAHA_API_URL: z.string().url().optional(),
  WAHA_API_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  CLICKSIGN_WEBHOOK_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
}).parse(process.env);

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV || 'development',
  includeLocalVariables: false,
  tracesSampleRate: 0,
  beforeSend: (event) => scrubSentryEvent(event),
});

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024, maxParamLength: 4096, trustProxy: process.env.TRUST_PROXY === 'true' });
await app.register(helmet);
await app.register(cookie);
await app.register(cors, { origin: env.APP_ORIGIN.split(',').map((origin) => z.string().url().parse(origin.trim())), credentials: true });
await app.register(rateLimit, { max: 360, timeWindow: '1 minute' });
await app.register(rawBody, { global: false, encoding: false });
await app.register(jwt, { secret: env.JWT_SECRET, cookie: { cookieName: 'nexo_session', signed: false }, sign: { expiresIn: '8h' } });

const allowedOrigins = env.APP_ORIGIN.split(',').map((origin) => z.string().url().parse(origin.trim()));
let ownerAccountId: string | null = null;
app.addHook('onRequest', async (request, reply) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || request.url.startsWith('/api/integrations/mercadopago/webhook') || request.url === '/api/integrations/waha/webhook' || request.url === '/api/integrations/n8n/actions' || request.url === '/api/integrations/clicksign/webhook') return;
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return reply.code(403).send({ error: 'origin_forbidden', message: 'Origem da solicitacao nao autorizada.' });
});

app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify({ onlyCookie: true });
    if (request.user.purpose) return reply.code(401).send({ error: 'unauthorized', message: 'Sessao invalida ou expirada.' });
    const [user] = await db.select({ id: users.id, role: users.role, email: users.email, inviteVersion: users.inviteVersion, sessionVersion: users.sessionVersion, permissions: users.permissions }).from(users).where(and(
      eq(users.id, request.user.sub), eq(users.organizationId, request.user.organizationId), eq(users.active, true),
    )).limit(1);
    if (!user || user.role !== request.user.role || !workspaceSessionVersionIsCurrent(request.user.sessionVersion, user.sessionVersion) || (user.role === 'owner' && (user.id !== ownerAccountId || user.email.toLowerCase() !== env.OWNER_EMAIL)) || (user.role !== 'owner' && user.inviteVersion < 1)) return reply.code(401).send({ error: 'unauthorized', message: 'Sessao invalida ou expirada.' });
    if (!isWorkspaceRequestAllowed(user.role, request.method, request.url, user.permissions)) return reply.code(403).send({ error: 'forbidden', message: 'Seu papel ou as permissoes deste modulo nao permitem esta acao. Solicite acesso a pessoa proprietaria do workspace.' });
    const sessionClaims = request.user as typeof request.user & { exp?: number; rememberMe?: boolean };
    if (shouldRenewPersistentWorkspaceSession(sessionClaims.rememberMe, sessionClaims.exp)) {
      const sessionPolicy = workspaceSessionPolicy(true);
      const token = app.jwt.sign({ sub: user.id, organizationId: request.user.organizationId, role: user.role, sessionVersion: user.sessionVersion, rememberMe: true }, { expiresIn: sessionPolicy.expiresIn });
      reply.setCookie('nexo_session', token, workspaceSessionCookieOptions(sessionPolicy.maxAge, process.env.NODE_ENV === 'production'));
    }
  } catch { return reply.code(401).send({ error: 'unauthorized', message: 'Sessao invalida ou expirada.' }); }
});

const loginSchema = z.object({ email: z.string().trim().email().transform(normalizeAccountEmail), password: z.string().min(1).max(128), rememberMe: z.boolean().default(true) });
const gmailAttachmentSchema = z.array(z.object({ filename: z.string().trim().min(1).max(255), mimeType: z.string().max(127), contentBase64: z.string().min(4).max(11_184_820) })).max(5).optional();
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
  workspaceClientId: z.string().uuid().optional(),
  clientName: z.string().trim().min(2).max(180),
  payerEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  description: z.string().trim().min(2).max(250),
  amount: z.coerce.number().positive().max(1000000),
  method: z.enum(['pix', 'boleto', 'credit_card', 'debit_card']),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
  if (value.dueDate && !['pix', 'boleto'].includes(value.method)) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'A data de vencimento personalizada está disponível para Pix e boleto.' });
  if (value.dueDate && !paymentDueDateDuration(value.dueDate)) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Escolha uma data entre amanhã e os próximos 30 dias.' });
  if (['credit_card', 'debit_card'].includes(value.method) && (!value.cardToken || !value.paymentMethodId)) ctx.addIssue({ code: 'custom', path: ['cardToken'], message: 'Dados seguros do cartão não foram enviados.' });
  if (value.method === 'boleto' && !value.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Endereço completo é obrigatório para emitir boleto.' });
  if (['credit_card', 'debit_card', 'boleto'].includes(value.method) && (!value.identificationType || !value.identificationNumber)) ctx.addIssue({ code: 'custom', path: ['identificationNumber'], message: 'CPF ou CNPJ do pagador é obrigatório.' });
});
const subscriptionSchema = z.object({
  clientId: z.string().uuid().optional(), workspaceClientId: z.string().uuid().optional(), clientName: z.string().trim().min(2).max(180),
  payerEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  description: z.string().trim().min(2).max(250), amount: z.coerce.number().positive().max(1000000),
  frequency: z.enum(['days', 'months']).default('months'),
  frequencyInterval: z.coerce.number().int().min(1).max(24).default(1),
  startAt: subscriptionDateTimeSchema.optional(), endAt: subscriptionDateTimeSchema.optional(),
}).superRefine((value, ctx) => {
  const dateError = validateSubscriptionDates(value.startAt, value.endAt);
  if (dateError === 'start_in_past') ctx.addIssue({ code: 'custom', path: ['startAt'], message: 'A primeira cobrança deve começar em uma data futura.' });
  if (dateError === 'end_before_start') ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'O fim da assinatura deve ser posterior ao início.' });
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown, reply: FastifyReply): T | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) { reply.code(400).send({ error: 'validation_error', message: 'Confira os campos enviados.', details: parsed.error.flatten().fieldErrors }); return undefined; }
  return parsed.data;
}

async function mercadoPago<T = Record<string, unknown>>(organizationId: string, path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await mercadoPagoAccessToken(organizationId);
  if (!accessToken) throw new Error('mercadopago_not_configured');
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

const integrationProviders = ['mercadopago', 'evolution', 'waha', 'resend', 'hostinger', 'google', 'clicksign', 'github', 'n8n', 'sentry'] as const;
type IntegrationProvider = typeof integrationProviders[number];
type IntegrationControl = { provider?: string; enabled?: boolean; lastTestStatus?: string | null; lastTestMessage?: string | null; testedAt?: string | null };
type GoogleTokenSet = { accessToken: string; refreshToken: string; expiresAt: number; email: string };

const googleScopes = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
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

const hostingerEncryptionKey = createHash('sha256').update('nexo-hostinger-email-v1\0').update(env.JWT_SECRET).digest();
function sealHostingerCredentials(credentials: HostingerCredentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', hostingerEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}
function openHostingerCredentials(sealed: string): HostingerCredentials {
  const [iv, tag, encrypted] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted || iv.length !== 12 || tag.length !== 16) throw new Error('hostinger_credentials_invalid');
  const decipher = createDecipheriv('aes-256-gcm', hostingerEncryptionKey, iv);
  decipher.setAuthTag(tag);
  return normalizeHostingerCredentials(JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')));
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

async function findHostingerConnection(organizationId: string) {
  const [row] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'integration-secrets'),
    sql`${workspaceRecords.data}->>'provider' = 'hostinger'`, isNull(workspaceRecords.archivedAt),
  )).limit(1);
  return row;
}
async function getHostingerCredentials(organizationId: string) {
  const row = await findHostingerConnection(organizationId);
  const sealed = typeof row?.data.sealedCredentials === 'string' ? row.data.sealedCredentials : '';
  return sealed ? openHostingerCredentials(sealed) : null;
}
async function saveHostingerCredentials(organizationId: string, userId: string, credentials: HostingerCredentials) {
  const data = { provider: 'hostinger', sealedCredentials: sealHostingerCredentials(credentials) };
  const current = await findHostingerConnection(organizationId);
  if (current) await db.update(workspaceRecords).set({ data, updatedAt: new Date() }).where(eq(workspaceRecords.id, current.id));
  else await db.insert(workspaceRecords).values({ organizationId, resource: 'integration-secrets', data, createdBy: userId });
}

const mercadoPagoRedirectUri = env.MERCADOPAGO_REDIRECT_URI || new URL('/api/integrations/mercadopago/callback', allowedOrigins[0]).toString();
const mercadoPagoEncryptionKey = createHash('sha256').update('nexo-mercadopago-oauth-v1\0').update(env.JWT_SECRET).digest();
const mercadoPagoRefreshes = new Map<string, Promise<string>>();
function sealMercadoPagoTokens(tokens: MercadoPagoTokenSet) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', mercadoPagoEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}
function openMercadoPagoTokens(sealed: string): MercadoPagoTokenSet {
  const [iv, tag, encrypted] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted || iv.length !== 12 || tag.length !== 16) throw new Error('mercadopago_token_payload_invalid');
  const decipher = createDecipheriv('aes-256-gcm', mercadoPagoEncryptionKey, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')) as MercadoPagoTokenSet;
}
async function findMercadoPagoConnection(organizationId: string) {
  const [row] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'integration-secrets'),
    sql`${workspaceRecords.data}->>'provider' = 'mercadopago'`, isNull(workspaceRecords.archivedAt),
  )).limit(1);
  return row;
}
async function getMercadoPagoTokens(organizationId: string) {
  const row = await findMercadoPagoConnection(organizationId);
  const sealed = typeof row?.data.sealedTokens === 'string' ? row.data.sealedTokens : '';
  return sealed ? openMercadoPagoTokens(sealed) : null;
}
async function saveMercadoPagoTokens(organizationId: string, userId: string, tokens: MercadoPagoTokenSet) {
  const data = { provider: 'mercadopago', sealedTokens: sealMercadoPagoTokens(tokens) };
  const current = await findMercadoPagoConnection(organizationId);
  if (current) await db.update(workspaceRecords).set({ data, updatedAt: new Date() }).where(eq(workspaceRecords.id, current.id));
  else await db.insert(workspaceRecords).values({ organizationId, resource: 'integration-secrets', data, createdBy: userId });
}
async function legacyMercadoPagoTokenIsSafeFor(organizationId: string) {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) return false;
  const rows = await db.select({ id: organizations.id }).from(organizations).limit(2);
  return rows.length === 1 && rows[0]?.id === organizationId;
}
async function mercadoPagoAccessToken(organizationId: string) {
  const tokens = await getMercadoPagoTokens(organizationId);
  if (!tokens) return await legacyMercadoPagoTokenIsSafeFor(organizationId) ? env.MERCADOPAGO_ACCESS_TOKEN || null : null;
  if (tokens.expiresAt > Date.now() + 60_000) return tokens.accessToken;
  const pending = mercadoPagoRefreshes.get(organizationId);
  if (pending) return pending;
  const refresh = db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`);
    const current = await getMercadoPagoTokens(organizationId);
    if (!current) throw Object.assign(new Error('mercadopago_not_configured'), { statusCode: 503 });
    if (current.expiresAt > Date.now() + 60_000) return current.accessToken;
    if (!env.MERCADOPAGO_CLIENT_ID || !env.MERCADOPAGO_CLIENT_SECRET) throw Object.assign(new Error('mercadopago_client_not_configured'), { statusCode: 503 });
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.MERCADOPAGO_CLIENT_ID, client_secret: env.MERCADOPAGO_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: current.refreshToken }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw Object.assign(new Error('mercadopago_token_refresh_failed'), { statusCode: 502 });
    const next = parseMercadoPagoTokenSet(await response.json() as Record<string, unknown>, current);
    if (!next) throw Object.assign(new Error('mercadopago_token_refresh_invalid'), { statusCode: 502 });
    const row = await findMercadoPagoConnection(organizationId);
    await saveMercadoPagoTokens(organizationId, String(row?.createdBy || ''), next);
    return next.accessToken;
  });
  mercadoPagoRefreshes.set(organizationId, refresh);
  try { return await refresh; }
  finally { if (mercadoPagoRefreshes.get(organizationId) === refresh) mercadoPagoRefreshes.delete(organizationId); }
}
async function mercadoPagoRecordBelongsToCurrentAccount(organizationId: string, recordAccountId: string | null | undefined) {
  const tokens = await getMercadoPagoTokens(organizationId).catch(() => null);
  const legacySafe = tokens ? false : await legacyMercadoPagoTokenIsSafeFor(organizationId);
  return mercadoPagoAccountMatchesRecord(recordAccountId, tokens?.accountId, legacySafe);
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
    mercadopago: false,
    evolution: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
    waha: Boolean(env.WAHA_API_URL && env.WAHA_API_KEY),
    resend: Boolean(process.env.RESEND_API_KEY),
    hostinger: false,
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    clicksign: Boolean(process.env.CLICKSIGN_API_TOKEN),
    github: Boolean(process.env.GITHUB_TOKEN),
    n8n: Boolean(process.env.N8N_BASE_URL && process.env.N8N_API_KEY),
    sentry: Boolean(process.env.SENTRY_DSN && process.env.VITE_SENTRY_DSN),
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

async function recordIntegrationTest(organizationId: string, userId: string, provider: IntegrationProvider, status: string) {
  await db.insert(activityEvents).values({
    organizationId, actorUserId: userId, entityType: 'integration-test', action: 'completed',
    payload: { provider, status },
  });
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
    paidAt: payment.date_approved ?? payment.dateApproved ?? order.date_approved ?? null,
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
  try {
    await pool.query('select 1');
    let revision = 'unknown';
    try { revision = String(JSON.parse(readFileSync(new URL('../build-info.json', import.meta.url), 'utf8')).revision || revision); } catch {}
    return { status: 'ok', database: 'connected', revision, timestamp: new Date().toISOString() };
  }
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
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Focusshub. Reative em Integrações para continuar.' });
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
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Focusshub. Reative em Integrações para continuar.' });
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
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Focusshub.' });
  const row = await findOwnedWahaSession(request.user.organizationId, params.data.id);
  if (!row) return reply.code(404).send({ error: 'not_found', message: 'Sessão não encontrada.' });
  try {
    // WAHA serves the QR as image bytes (not a JSON { data } object).
    // Keep it in memory only and prevent intermediaries from caching this login credential.
    const response = await fetch(`${env.WAHA_API_URL!.replace(/\/$/, '')}/api/${encodeURIComponent(wahaSessionName(row))}/auth/qr`, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'X-Api-Key': env.WAHA_API_KEY!, Accept: 'image/png, image/*' },
    });
    // WAHA returns 422 when no QR challenge is pending (for example, before
    // SCAN_QR_CODE or after the code expired). That is a normal session state.
    const qrResponse = classifyWahaQrResponse(response.status, response.headers.get('content-type') || '');
    if (qrResponse === 'pending') return reply.header('Cache-Control', 'no-store').send({ data: null });
    if (qrResponse === 'error') {
      app.log.warn({ statusCode: response.status, path: 'auth/qr' }, 'WAHA QR request failed');
      const message = response.status === 401 || response.status === 403
        ? 'A WAHA recusou a chave de API. Revise a credencial da integração.'
        : `A WAHA não conseguiu gerar o QR (HTTP ${response.status}). Reinicie a sessão e tente novamente.`;
      return reply.code(502).header('Cache-Control', 'no-store').send({ error: 'waha_qr_unavailable', message });
    }
    const mimetype = response.headers.get('content-type')?.split(';')[0] || 'image/png';
    const image = Buffer.from(await response.arrayBuffer()).toString('base64');
    return reply.header('Cache-Control', 'no-store').send({ data: { mimetype, image } });
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return { data: null };
    throw error;
  }
});

app.post('/api/integrations/waha/sessions/:id/:action', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid(), action: z.enum(['start', 'stop', 'restart', 'logout']) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Ação ou sessão inválida.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Focusshub. Reative em Integrações para continuar.' });
  const row = await findOwnedWahaSession(request.user.organizationId, params.data.id);
  if (!row) return reply.code(404).send({ error: 'not_found', message: 'Sessão não encontrada.' });
  await wahaRequest(`/api/sessions/${encodeURIComponent(wahaSessionName(row))}/${params.data.action}`, { method: 'POST', body: '{}' });
  return { data: { id: row.id, action: params.data.action, status: params.data.action === 'stop' ? 'STOPPED' : params.data.action === 'logout' ? 'SCAN_QR_CODE' : 'STARTING' } };
});

app.delete('/api/integrations/waha/sessions/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Sessão inválida.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Focusshub. Reative em Integrações para continuar.' });
  const row = await findOwnedWahaSession(request.user.organizationId, params.data.id);
  if (!row) return reply.code(404).send({ error: 'not_found', message: 'Sessão não encontrada.' });
  await wahaRequest(`/api/sessions/${encodeURIComponent(wahaSessionName(row))}`, { method: 'DELETE' }).catch((error) => { if ((error as { statusCode?: number }).statusCode !== 404) throw error; });
  await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(workspaceRecords.id, row.id));
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'whatsapp-session', entityId: row.id, action: 'deleted', payload: { label: row.data.label } });
  return reply.code(204).send();
});

app.post('/api/integrations/waha/send', { preHandler: app.authenticate, bodyLimit: 12 * 1024 * 1024, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(z.object({
    sessionId: z.string().uuid(), conversationId: z.string().uuid(), clientMessageId: z.string().uuid(),
    chatId: z.string().trim().min(5).max(180).regex(/^[\w.+-]+@(?:c\.us|g\.us|lid|s\.whatsapp\.net|newsletter)$/),
    text: z.string().trim().max(4096).default(''),
    attachment: z.object({ filename: z.string().trim().min(1).max(255).refine((value) => !/[\r\n\0]/.test(value)), mimeType: z.string().max(127), contentBase64: z.string().min(4).max(11_184_820) }).optional(),
  }).refine((value) => Boolean(value.text || value.attachment), 'A message or attachment is required.'), request.body, reply); if (!body) return;
  let attachmentData: Buffer | undefined;
  try { if (body.attachment) attachmentData = decodeGoogleDriveUpload(body.attachment.contentBase64, 8 * 1024 * 1024); }
  catch { return reply.code(400).send({ error: 'waha_file_invalid', message: 'O arquivo WhatsApp est? vazio ou excede o limite de 8 MiB.' }); }
  if (!await isIntegrationEnabled(request.user.organizationId, 'waha')) return reply.code(409).send({ error: 'integration_disconnected', message: 'WAHA está desconectada no Focusshub. Reative em Integrações para enviar.' });
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
  const pending = { id: body.clientMessageId, clientMessageId: body.clientMessageId, side: 'sent', text: body.text, ...(body.attachment ? { attachment: body.attachment.filename } : {}), time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), createdAt: new Date().toISOString(), status: 'sending' };
  const pendingHistory = duplicate ? existingHistory.map((message) => message.clientMessageId === body.clientMessageId ? pending : message) : [...existingHistory, pending];
  await db.update(workspaceRecords).set({ data: { ...data, whatsappSessionId: sessionRow.id, whatsappChatId: body.chatId, channel: 'WhatsApp', history: pendingHistory }, updatedAt: new Date() }).where(eq(workspaceRecords.id, conversation.id));
  try {
    const remote = await wahaRequest<Array<{ name?: string; status?: string }>>('/api/sessions');
    const remoteSession = remote.find((session) => String(session.name || '') === wahaSessionName(sessionRow));
    if (remoteSession?.status !== 'WORKING') {
      const error = Object.assign(new Error('waha_session_not_connected'), { statusCode: 409 });
      throw error;
    }
    const result = body.attachment && attachmentData
      ? await wahaRequest<{ id?: string }>('/api/sendFile', { method: 'POST', body: JSON.stringify(buildWahaSendFilePayload({ session: wahaSessionName(sessionRow), chatId: body.chatId, filename: body.attachment.filename, mimeType: body.attachment.mimeType, data: attachmentData.toString('base64'), caption: body.text })) })
      : await wahaRequest<{ id?: string }>('/api/sendText', { method: 'POST', body: JSON.stringify({ session: wahaSessionName(sessionRow), chatId: body.chatId, text: body.text }) });
    const [fresh] = await db.select().from(workspaceRecords).where(eq(workspaceRecords.id, conversation.id)).limit(1);
    const freshData = (fresh?.data || data) as Record<string, any>;
    const history = Array.isArray(freshData.history) ? freshData.history as Array<Record<string, any>> : pendingHistory;
    const savedMessage = { ...pending, providerMessageId: result.id || '', status: 'sent' };
    await db.update(workspaceRecords).set({ data: { ...freshData, whatsappSessionId: sessionRow.id, whatsappChatId: body.chatId, channel: 'WhatsApp', text: body.text || (body.attachment ? `Arquivo: ${body.attachment.filename}` : ''), time: savedMessage.time, history: history.map((message) => message.clientMessageId === body.clientMessageId ? savedMessage : message) }, updatedAt: new Date() }).where(eq(workspaceRecords.id, conversation.id));
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
  const nextData = { ...currentData, name: currentData.name || displayName, company: matchingClient?.name || currentData.company || '', clientId: matchingClient?.id || currentData.clientId || '', phone, email: matchingClient?.email || currentData.email || '', initials, color: currentData.color || 'blue', channel: 'WhatsApp', status: 'open', whatsappSessionId: sessionRow.id, whatsappChatId: chatId, text: text || 'Mensagem recebida', time: at, unread: Number(currentData.unread || 0) + 1, history };
  let inboxId = conversation?.id;
  if (conversation) await db.update(workspaceRecords).set({ data: nextData, updatedAt: new Date() }).where(eq(workspaceRecords.id, conversation.id));
  else {
    const [created] = await db.insert(workspaceRecords).values({ organizationId: sessionRow.organizationId, resource: 'inbox', data: nextData, createdBy: null }).returning({ id: workspaceRecords.id });
    inboxId = created?.id;
  }
  if (inboxId) await db.insert(activityEvents).values({ organizationId: sessionRow.organizationId, entityType: 'inbox', entityId: inboxId, action: 'received', payload: { label: displayName, preview: (text || 'Mensagem recebida').slice(0, 180), providerMessageId: messageId } });
  return reply.code(204).send();
});

app.get('/api/integrations/google/authorize', { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return reply.code(503).send({ error: 'google_client_not_configured', message: 'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no serviço API do Coolify.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'google')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Reative Google Workspace no Focusshub antes de autorizar a conta.' });
  const [googleOwner] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, request.user.sub), eq(users.organizationId, request.user.organizationId), eq(users.active, true), eq(users.role, 'owner'), eq(users.email, env.OWNER_EMAIL))).limit(1);
  if (!googleOwner) return reply.code(403).send({ error: 'owner_required', message: 'Somente a pessoa proprietária do workspace pode autorizar o Google.' });
  const nonce = randomUUID();
  const stateId = randomUUID();
  const state = app.jwt.sign({ sub: request.user.sub, organizationId: request.user.organizationId, role: 'owner', purpose: 'google-oauth-state', nonce, stateId } as any, { expiresIn: '10m' });
  await db.insert(workspaceRecords).values({ id: stateId, organizationId: request.user.organizationId, resource: 'integration-oauth-state', data: { provider: 'google', nonce, expiresAt: Date.now() + 10 * 60_000 }, createdBy: request.user.sub });
  reply.setCookie('nexo_google_oauth_state', state, { path: '/api/integrations', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 10 * 60 });
  return reply.redirect(buildGoogleAuthorizationUrl({ clientId: env.GOOGLE_CLIENT_ID, redirectUri: googleRedirectUri, scopes: googleScopes, state }));
});

app.get('/api/integrations/mercadopago/authorize', { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
  if (!env.MERCADOPAGO_CLIENT_ID || !env.MERCADOPAGO_CLIENT_SECRET) return reply.code(503).send({ error: 'mercadopago_oauth_not_configured', message: 'Configure MERCADOPAGO_CLIENT_ID e MERCADOPAGO_CLIENT_SECRET na API do Coolify.' });
  const [owner] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, request.user.sub), eq(users.organizationId, request.user.organizationId), eq(users.active, true), eq(users.role, 'owner'), eq(users.email, env.OWNER_EMAIL))).limit(1);
  if (!owner) return reply.code(403).send({ error: 'owner_required', message: 'Somente a pessoa proprietária do workspace pode autorizar o Mercado Pago.' });
  const { verifier, challenge } = createPkcePair();
  const verifierHash = createHash('sha256').update(verifier).digest('base64url');
  const stateId = randomUUID();
  const state = app.jwt.sign({ sub: request.user.sub, organizationId: request.user.organizationId, purpose: 'mercadopago-oauth-state', verifierHash, stateId } as any, { expiresIn: '10m' });
  await db.insert(workspaceRecords).values({ id: stateId, organizationId: request.user.organizationId, resource: 'integration-oauth-state', data: { provider: 'mercadopago', verifierHash, expiresAt: Date.now() + 10 * 60_000 }, createdBy: request.user.sub });
  const cookieOptions = { path: '/api/integrations/mercadopago', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 10 * 60 };
  reply.setCookie('nexo_mp_oauth_state', state, cookieOptions);
  reply.setCookie('nexo_mp_oauth_verifier', verifier, cookieOptions);
  return reply.redirect(buildMercadoPagoAuthorizationUrl({ clientId: env.MERCADOPAGO_CLIENT_ID, redirectUri: mercadoPagoRedirectUri, state, challenge }));
});

app.get('/api/integrations/mercadopago/callback', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const query = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }).safeParse(request.query);
  const stateCookie = request.cookies.nexo_mp_oauth_state;
  const verifier = request.cookies.nexo_mp_oauth_verifier;
  const cookieOptions = { path: '/api/integrations/mercadopago', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const };
  reply.clearCookie('nexo_mp_oauth_state', cookieOptions);
  reply.clearCookie('nexo_mp_oauth_verifier', cookieOptions);
  const redirectToApp = (result: string, reason?: string) => {
    const target = new URL('/', allowedOrigins[0]);
    target.searchParams.set('mercadopago', result);
    if (reason) target.searchParams.set('reason', reason);
    return reply.redirect(target.toString());
  };
  if (!query.success || !query.data.state || !stateCookie || !verifier || query.data.state !== stateCookie) return redirectToApp('error', 'state_invalid');
  let claims: { sub?: string; organizationId?: string; purpose?: string; verifierHash?: string; stateId?: string };
  try { claims = app.jwt.verify<{ sub?: string; organizationId?: string; purpose?: string; verifierHash?: string; stateId?: string }>(query.data.state); }
  catch { return redirectToApp('error', 'state_expired'); }
  if (claims.purpose !== 'mercadopago-oauth-state' || !claims.sub || !claims.organizationId || !claims.stateId || claims.verifierHash !== createHash('sha256').update(verifier).digest('base64url')) return redirectToApp('error', 'state_invalid');
  const [issuedState] = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data, createdBy: workspaceRecords.createdBy }).from(workspaceRecords).where(and(eq(workspaceRecords.id, claims.stateId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'integration-oauth-state'), isNull(workspaceRecords.archivedAt))).limit(1);
  if (!issuedState || issuedState.createdBy !== claims.sub || issuedState.data.provider !== 'mercadopago' || !mercadoPagoOAuthStateIsActive({ callbackState: query.data.state, cookieState: stateCookie, verifier, expectedVerifierHash: claims.verifierHash, recordVerifierHash: issuedState.data.verifierHash, recordExpiresAt: issuedState.data.expiresAt, recordActive: true })) return redirectToApp('error', 'state_replayed_or_expired');
  const [consumedState] = await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceRecords.id, claims.stateId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'integration-oauth-state'), isNull(workspaceRecords.archivedAt))).returning({ id: workspaceRecords.id });
  if (!consumedState) return redirectToApp('error', 'state_replayed');
  if (query.data.error || !query.data.code || !env.MERCADOPAGO_CLIENT_ID || !env.MERCADOPAGO_CLIENT_SECRET) return redirectToApp('error', query.data.error === 'access_denied' ? 'consent_denied' : 'oauth_incomplete');
  try {
    const [owner] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, claims.sub), eq(users.organizationId, claims.organizationId), eq(users.active, true), eq(users.role, 'owner'), eq(users.email, env.OWNER_EMAIL))).limit(1);
    if (!owner) return redirectToApp('error', 'owner_required');
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.MERCADOPAGO_CLIENT_ID, client_secret: env.MERCADOPAGO_CLIENT_SECRET, grant_type: 'authorization_code', code: query.data.code, redirect_uri: mercadoPagoRedirectUri, code_verifier: verifier }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return redirectToApp('error', 'code_exchange_failed');
    const tokens = parseMercadoPagoTokenSet(await response.json() as Record<string, unknown>);
    if (!tokens) return redirectToApp('error', 'token_response_invalid');
    await saveMercadoPagoTokens(claims.organizationId, claims.sub, tokens);
    await saveIntegrationControl(claims.organizationId, claims.sub, 'mercadopago', { enabled: true, lastTestStatus: 'connected', lastTestMessage: `Conta Mercado Pago autorizada: vendedor ${tokens.accountId}.`, testedAt: new Date().toISOString() });
    await db.insert(activityEvents).values({ organizationId: claims.organizationId, actorUserId: claims.sub, entityType: 'integration', action: 'mercadopago_authorized', payload: { provider: 'mercadopago', accountId: tokens.accountId } });
    return redirectToApp('connected');
  } catch (error) {
    app.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Mercado Pago OAuth callback failed');
    return redirectToApp('error', 'callback_failed');
  }
});

app.post('/api/integrations/mercadopago/disconnect', { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request) => {
  const row = await findMercadoPagoConnection(request.user.organizationId);
  if (row) await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(workspaceRecords.id, row.id));
  await saveIntegrationControl(request.user.organizationId, request.user.sub, 'mercadopago', { enabled: false, lastTestStatus: null, lastTestMessage: null, testedAt: null });
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'integration', action: 'mercadopago_disconnected', payload: { provider: 'mercadopago' } });
  return { data: { disconnected: true } };
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
  let claims: { sub?: string; organizationId?: string; purpose?: string; nonce?: string; stateId?: string };
  try { claims = app.jwt.verify<{ sub?: string; organizationId?: string; purpose?: string; nonce?: string; stateId?: string }>(query.data.state); }
  catch { return redirectToApp('error', 'state_expired'); }
  if (claims.purpose !== 'google-oauth-state' || !claims.sub || !claims.organizationId || !claims.nonce || !claims.stateId) return redirectToApp('error', 'state_invalid');
  const [issuedState] = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data, createdBy: workspaceRecords.createdBy }).from(workspaceRecords).where(and(eq(workspaceRecords.id, claims.stateId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'integration-oauth-state'), isNull(workspaceRecords.archivedAt))).limit(1);
  if (!issuedState || issuedState.createdBy !== claims.sub || issuedState.data.provider !== 'google' || !googleOAuthStateRecordIsActive({ callbackState: query.data.state, cookieState: stateCookie, expectedNonce: claims.nonce, recordNonce: issuedState.data.nonce, recordExpiresAt: issuedState.data.expiresAt, recordActive: true })) return redirectToApp('error', 'state_replayed_or_expired');
  const [consumedState] = await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceRecords.id, claims.stateId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'integration-oauth-state'), isNull(workspaceRecords.archivedAt))).returning({ id: workspaceRecords.id });
  if (!consumedState) return redirectToApp('error', 'state_replayed');
  if (query.data.error || !query.data.code || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirectToApp('error', query.data.error === 'access_denied' ? 'consent_denied' : 'oauth_incomplete');
  try {
    const [owner] = await db.select({ id: users.id }).from(users).where(and(
      eq(users.id, claims.sub), eq(users.organizationId, claims.organizationId), eq(users.active, true), eq(users.role, 'owner'), eq(users.email, env.OWNER_EMAIL),
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

app.get('/api/integrations/google/calendar/events', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const query = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeZone: z.string().max(100).optional(),
  }).safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'validation_error', message: 'Informe o período da agenda no formato AAAA-MM-DD.' });
  const fromDate = new Date(`${query.data.from}T00:00:00Z`);
  const toDate = new Date(`${query.data.to}T00:00:00Z`);
  const days = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
  const timeZone = normalizeCalendarTimeZone(query.data.timeZone);
  if (!isValidCalendarTimeZone(timeZone)) return reply.code(400).send({ error: 'invalid_calendar_time_zone', message: 'Fuso horário da agenda inválido.' });
  if (!Number.isFinite(days) || days < 0 || days > 62 || fromDate.toISOString().slice(0, 10) !== query.data.from || toDate.toISOString().slice(0, 10) !== query.data.to) {
    return reply.code(400).send({ error: 'invalid_calendar_range', message: 'O intervalo precisa ser válido e não pode exceder 62 dias.' });
  }
  if (!await isIntegrationEnabled(request.user.organizationId, 'google')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Reative o Google Workspace em Integrações antes de sincronizar o calendário.' });
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const timeMin = localDateTimeToIso(query.data.from, '00:00', timeZone);
    const timeMax = localDateTimeToIso(nextCalendarDate(query.data.to), '00:00', timeZone);
    const result: unknown[] = [];
    let pageToken = '';
    for (let page = 0; page < 4; page += 1) {
      const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', fields: 'items(id,status,summary,description,start,end,attendees(email),hangoutLink,htmlLink,conferenceData(entryPoints(entryPointType,uri))),nextPageToken' });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetch(`${base}?${params}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return reply.code(409).send({ error: 'google_calendar_scope_required', message: 'O Google não liberou a leitura do Calendar. Reautorize a conta com o escopo calendar.events e confira se a API Google Calendar está habilitada.' });
        return reply.code(502).send({ error: 'google_calendar_read_failed', message: 'Não foi possível ler os eventos do Google Calendar agora.' });
      }
      const data = await response.json() as { items?: unknown[]; nextPageToken?: string };
      if (Array.isArray(data.items)) result.push(...data.items);
      pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
      if (!pageToken) break;
    }
    return { data: mapGoogleCalendarEvents(result, timeZone), truncated: Boolean(pageToken) };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 409 || statusCode === 503) return reply.code(statusCode).send({ error: 'google_authorization_required', message: 'Autorize o Google Workspace em Integrações antes de sincronizar eventos.' });
    app.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Google Calendar event read failed');
    return reply.code(502).send({ error: 'google_calendar_unavailable', message: 'Não foi possível ler o Google Calendar. Tente novamente.' });
  }
});

app.route({ method: ['POST', 'PATCH'], url: '/api/integrations/google/calendar/events', preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, handler: async (request, reply) => {
  const body = parseBody(z.object({
    eventId: z.string().regex(/^[a-v0-9]{5,1024}$/).optional(),
    title: z.string().trim().min(1).max(180),
    description: z.string().max(8000).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    allDay: z.boolean().default(false),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timeZone: z.string().max(100).optional(),
    createMeet: z.boolean().default(false),
    attendees: z.array(z.string().email()).max(30).default([]),
  }), request.body, reply); if (!body) return;
  const timeZone = normalizeCalendarTimeZone(body.timeZone);
  if (!isValidCalendarTimeZone(timeZone)) return reply.code(400).send({ error: 'invalid_calendar_time_zone', message: 'O fuso horário da agenda é inválido.' });
  const validCalendarDate = (value: string) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validCalendarDate(body.date) || (body.endDate && (!validCalendarDate(body.endDate) || body.endDate < body.date))) {
    return reply.code(400).send({ error: 'invalid_calendar_date', message: 'A data inicial ou final do evento é inválida.' });
  }
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
    const allDayEnd = new Date(`${body.date}T12:00:00Z`);
    allDayEnd.setUTCDate(allDayEnd.getUTCDate() + 1);
    const eventBody = {
      ...(body.eventId && request.method === 'POST' ? { id: body.eventId } : {}),
      summary: body.title,
      description: body.description || '',
      start: body.allDay ? { date: body.date } : { dateTime: `${body.date}T${body.startTime}:00`, timeZone },
      end: body.allDay ? { date: body.endDate || allDayEnd.toISOString().slice(0, 10) } : { dateTime: `${body.endDate || body.date}T${body.endTime}:00`, timeZone },
      ...googleCalendarAttendeesPayload(body.attendees),
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

async function gmailScopedContactEmails(organizationId: string, scope?: WorkspaceRecordScope | null) {
  const clientIds = await billingClientIdsForScope(organizationId, scope);
  if (clientIds === null) return null;
  if (!clientIds.length) return new Set<string>();
  const [clientRows, contactRows] = await Promise.all([
    db.select({ data: workspaceRecords.data }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt), inArray(workspaceRecords.id, clientIds),
    )),
    db.select({ data: workspaceRecords.data }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'contacts'), isNull(workspaceRecords.archivedAt),
      inArray(sql<string>`${workspaceRecords.data}->>'clientId'`, clientIds),
    )),
  ]);
  return new Set(googleMailAddresses([...clientRows, ...contactRows].map((row) => row.data.email)));
}

async function gmailThreadParticipants(accessToken: string, threadId: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  const thread = await response.json() as { messages?: Array<{ payload?: { headers?: Array<{ name?: string; value?: string }> } }> };
  const values = (thread.messages || []).flatMap((message) => (message.payload?.headers || []).filter((header) => ['from', 'to', 'cc', 'bcc'].includes(String(header.name || '').toLowerCase())).map((header) => header.value || ''));
  return googleMailAddresses(values);
}

async function gmailThreadIsInScope(organizationId: string, scope: WorkspaceRecordScope | null | undefined, accessToken: string, threadId: string, accountEmail: string) {
  const allowedEmails = await gmailScopedContactEmails(organizationId, scope);
  if (allowedEmails === null) return true;
  if (!allowedEmails.size) return false;
  const participants = await gmailThreadParticipants(accessToken, threadId);
  return Boolean(participants && googleThreadBelongsToAllowedContacts(participants, allowedEmails, accountEmail));
}

app.get('/api/integrations/google/gmail', { preHandler: app.authenticate }, async (request, reply) => {
  const query = z.object({ q: z.string().trim().max(180).default('in:inbox OR in:sent'), maxResults: z.coerce.number().int().min(1).max(30).default(20) }).safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid Gmail query.' });
  const tokens = await getGoogleTokens(request.user.organizationId);
  if (!tokens) return reply.code(409).send({ error: 'google_authorization_required', message: 'Connect and authorize Gmail in Integrations.' });
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const allowedEmails = await gmailScopedContactEmails(request.user.organizationId, request.user.permissions?.scope);
    if (allowedEmails && !allowedEmails.size) return { data: [] };
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/threads');
    listUrl.search = new URLSearchParams({ q: query.data.q, maxResults: String(query.data.maxResults) }).toString();
    const listResponse = await fetch(listUrl, { headers, signal: AbortSignal.timeout(12_000) });
    if (!listResponse.ok) return reply.code(listResponse.status === 403 ? 409 : 502).send({ error: listResponse.status === 403 ? 'google_gmail_scope_required' : 'google_gmail_unavailable', message: listResponse.status === 403 ? 'Reauthorize Google Workspace and grant Gmail read/modify access.' : 'Gmail could not return the requested messages.' });
    const list = await listResponse.json() as { threads?: Array<{ id?: string }> };
    const threads = await Promise.all((list.threads || []).flatMap((thread) => thread.id ? [fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(thread.id)}?format=full`, { headers, signal: AbortSignal.timeout(12_000) }).then(async (response) => {
      if (!response.ok) return null;
      const raw = await response.json() as { id?: string; messages?: Array<Parameters<typeof mapGoogleMailMessage>[0]> };
      const messages = (raw.messages || []).map((item) => mapGoogleMailMessage(item, tokens.email));
      if (!messages.length) return null;
      messages.sort((a, b) => Date.parse(a.date || '') - Date.parse(b.date || ''));
      const latest = messages[messages.length - 1]!;
      const participants = googleMailAddresses((raw.messages || []).flatMap((message) => (message.payload?.headers || []).filter((header) => ['from', 'to', 'cc', 'bcc'].includes(String(header.name || '').toLowerCase())).map((header) => header.value || '')));
      return { id: raw.id || latest.threadId, threadId: raw.id || latest.threadId, name: latest.side === 'sent' ? latest.to : latest.from, company: latest.side === 'sent' ? latest.to : latest.from, email: (latest.side === 'sent' ? latest.to : latest.from).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '', subject: latest.subject, text: latest.text || '', snippet: latest.text.slice(0, 180), time: latest.date, unread: messages.some((item) => item.unread) ? 1 : 0, channel: 'E-mail', history: messages.map((item) => ({ ...item, time: item.date })), _participants: participants };
    }).catch(() => null)] : []));
    const visibleThreads = threads.filter((thread): thread is NonNullable<typeof thread> => Boolean(thread))
      .filter((thread) => !allowedEmails || googleThreadBelongsToAllowedContacts(thread._participants, allowedEmails, tokens.email))
      .map(({ _participants, ...thread }) => thread);
    return { data: visibleThreads };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 409 || status === 503) return reply.code(status).send({ error: 'google_authorization_required', message: 'Reconnect Google Workspace to access Gmail.' });
    return reply.code(502).send({ error: 'google_gmail_unavailable', message: 'Gmail could not be reached. Try again in a moment.' });
  }
});

app.post('/api/integrations/google/gmail/send', { preHandler: app.authenticate, bodyLimit: 12 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(z.object({ to: z.string().trim().email().max(254), subject: z.string().trim().min(1).max(250), text: z.string().trim().min(1).max(20_000), attachments: gmailAttachmentSchema }), request.body, reply);
  if (!body) return;
  let attachments;
  try { attachments = decodeGoogleMailAttachments(body.attachments); }
  catch { return reply.code(400).send({ error: 'gmail_attachment_invalid', message: 'Anexos invalidos ou acima do limite de 8 MiB.' }); }
  const scopedEmails = await gmailScopedContactEmails(request.user.organizationId, request.user.permissions?.scope);
  if (scopedEmails && !scopedEmails.has(body.to.toLocaleLowerCase('en-US'))) return reply.code(403).send({ error: 'record_scope_denied', message: 'O destinatario nao pertence aos clientes atribuidos ao seu escopo.' });
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const raw = buildGoogleRawMessage({ to: body.to, subject: body.subject, text: body.text, html: body.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\\n', '<br>'), attachments });
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }), signal: AbortSignal.timeout(12_000) });
    const result = await response.json().catch(() => ({})) as { id?: string; threadId?: string };
    if (!response.ok || !result.id) return reply.code(response.status === 403 ? 409 : 502).send({ error: 'gmail_send_failed', message: 'Gmail did not accept this message.' });
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'gmail_thread', action: 'message_sent', payload: { threadId: result.threadId || null, messageId: result.id, recipient: body.to } });
    return reply.code(201).send({ data: { id: result.id, threadId: result.threadId, sent: true } });
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 409 || status === 503) return reply.code(status).send({ error: 'google_authorization_required', message: 'Reconnect Google Workspace to send mail.' });
    return reply.code(502).send({ error: 'gmail_send_failed', message: 'Gmail could not send this message.' });
  }
});

app.post('/api/integrations/google/gmail/:threadId/read', { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ threadId: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid Gmail thread.' });
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    if (!await gmailThreadIsInScope(request.user.organizationId, request.user.permissions?.scope, accessToken, params.data.threadId, (await getGoogleTokens(request.user.organizationId))?.email || '')) return reply.code(404).send({ error: 'not_found', message: 'Thread nao encontrado.' });
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(params.data.threadId)}/modify`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ removeLabelIds: ['UNREAD'] }), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return reply.code(response.status === 403 ? 409 : 502).send({ error: 'gmail_read_update_failed', message: 'Gmail could not mark this thread as read.' });
    return { data: { read: true } };
  } catch { return reply.code(502).send({ error: 'gmail_unavailable', message: 'Gmail could not be reached.' }); }
});

app.post('/api/integrations/google/gmail/:threadId/reply', { preHandler: app.authenticate, bodyLimit: 12 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ threadId: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/) }).safeParse(request.params);
  const body = parseBody(z.object({ to: z.string().trim().email().max(254), subject: z.string().trim().min(1).max(250), text: z.string().trim().min(1).max(20_000), attachments: gmailAttachmentSchema, inReplyTo: z.string().trim().max(998).optional(), references: z.string().trim().max(998).optional() }), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid Gmail thread.' });
  if (!body) return;
  let attachments;
  try { attachments = decodeGoogleMailAttachments(body.attachments); }
  catch { return reply.code(400).send({ error: 'gmail_attachment_invalid', message: 'Anexos invalidos ou acima do limite de 8 MiB.' }); }
  const scopedEmails = await gmailScopedContactEmails(request.user.organizationId, request.user.permissions?.scope);
  if (scopedEmails && !scopedEmails.has(body.to.toLocaleLowerCase('en-US'))) return reply.code(403).send({ error: 'record_scope_denied', message: 'O destinatario nao pertence aos clientes atribuidos ao seu escopo.' });
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    if (!await gmailThreadIsInScope(request.user.organizationId, request.user.permissions?.scope, accessToken, params.data.threadId, (await getGoogleTokens(request.user.organizationId))?.email || '')) return reply.code(404).send({ error: 'not_found', message: 'Thread nao encontrado.' });
    const raw = buildGoogleRawMessage({ to: body.to, subject: body.subject, text: body.text, html: body.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>'), inReplyTo: body.inReplyTo, references: body.references, attachments });
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId: params.data.threadId, raw }), signal: AbortSignal.timeout(12_000) });
    const result = await response.json().catch(() => ({})) as { id?: string; threadId?: string };
    if (!response.ok || !result.id) return reply.code(response.status === 403 ? 409 : 502).send({ error: 'gmail_send_failed', message: 'Gmail did not accept this reply.' });
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'gmail_thread', action: 'reply_sent', payload: { threadId: params.data.threadId, messageId: result.id } });
    return reply.code(201).send({ data: { id: result.id, threadId: result.threadId || params.data.threadId, sent: true } });
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 409 || status === 503) return reply.code(status).send({ error: 'google_authorization_required', message: 'Reconnect Google Workspace to send mail.' });
    return reply.code(502).send({ error: 'gmail_send_failed', message: 'Gmail could not send this reply.' });
  }
});

app.get('/api/integrations/hostinger/inbox', { preHandler: app.authenticate }, async (request, reply) => {
  const credentials = await getHostingerCredentials(request.user.organizationId);
  if (!credentials) return reply.code(409).send({ error: 'hostinger_not_configured', message: 'Conecte uma caixa Hostinger em Integrações.' });
  const query = z.object({ limit: z.coerce.number().int().min(1).max(30).default(20) }).safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'validation_error', message: 'Limite de mensagens inválido.' });
  const imap = new ImapFlow({ host: 'imap.hostinger.com', port: 993, secure: true, auth: { user: credentials.email, pass: credentials.password }, logger: false, connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000 });
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock('INBOX');
    try {
      const mailbox = imap.mailbox;
      if (!mailbox) return { data: [] };
      const start = Math.max(1, Number(mailbox.exists || 0) - query.data.limit + 1);
      const rows = [];
      if (mailbox.exists) for await (const item of imap.fetch(`${start}:*`, { uid: true, source: true, flags: true }, { uid: false })) {
        if (!item.source) continue;
        const parsed = await simpleParser(item.source);
        const from = parsed.from?.text || '';
        const email = parsed.from?.value?.[0]?.address || '';
        const text = (parsed.text || '').slice(0, 20_000);
        const date = (parsed.date || new Date()).toISOString();
        rows.push({ id: `hostinger:${item.uid}`, threadId: `hostinger:${item.uid}`, provider: 'hostinger', name: from || email || '(remetente desconhecido)', company: from || email, email, subject: parsed.subject || '(sem assunto)', text, snippet: text.slice(0, 180), time: date, unread: item.flags?.has('\\Seen') ? 0 : 1, channel: 'E-mail', history: [{ id: String(item.uid), messageId: parsed.messageId || '', references: Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references || '', from, to: credentials.email, subject: parsed.subject || '', text, date, time: date, side: email.toLowerCase() === credentials.email.toLowerCase() ? 'sent' : 'received' }] });
      }
      rows.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
      const scopedEmails = await gmailScopedContactEmails(request.user.organizationId, request.user.permissions?.scope);
      return { data: scopedEmails === null ? rows : rows.filter((row) => scopedEmails.has(row.email.toLowerCase())) };
    } finally { lock.release(); }
  } catch { return reply.code(502).send({ error: 'hostinger_inbox_unavailable', message: 'Não foi possível acessar a caixa Hostinger. Confira a conexão em Integrações.' }); }
  finally { if (imap.usable) await imap.logout().catch(() => {}); else imap.close(); }
});

app.post('/api/integrations/hostinger/:uid/read', { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ uid: z.string().regex(/^[1-9]\d{0,11}$/) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Mensagem Hostinger inválida.' });
  const credentials = await getHostingerCredentials(request.user.organizationId);
  if (!credentials) return reply.code(409).send({ error: 'hostinger_not_configured', message: 'Conecte uma caixa Hostinger em Integrações.' });
  const imap = new ImapFlow({ host: 'imap.hostinger.com', port: 993, secure: true, auth: { user: credentials.email, pass: credentials.password }, logger: false, connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000 });
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock('INBOX');
    try {
      const message = await imap.fetchOne(Number(params.data.uid), { source: true }, { uid: true });
      if (!message || !message.source) return reply.code(404).send({ error: 'not_found', message: 'Mensagem não encontrada.' });
      const parsed = await simpleParser(message.source);
      const scopedEmails = await gmailScopedContactEmails(request.user.organizationId, request.user.permissions?.scope);
      const sender = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
      if (scopedEmails && !scopedEmails.has(sender)) return reply.code(404).send({ error: 'not_found', message: 'Mensagem não encontrada.' });
      await imap.messageFlagsAdd(Number(params.data.uid), ['\\Seen'], { uid: true });
    }
    finally { lock.release(); }
    return { data: { read: true } };
  } catch { return reply.code(502).send({ error: 'hostinger_read_failed', message: 'Não foi possível atualizar a mensagem Hostinger.' }); }
  finally { if (imap.usable) await imap.logout().catch(() => {}); else imap.close(); }
});

app.post('/api/integrations/hostinger/send', { preHandler: app.authenticate, bodyLimit: 12 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(z.object({ to: z.string().trim().email().max(254), subject: z.string().trim().min(1).max(250).refine((v) => !/[\\r\\n]/.test(v)), text: z.string().trim().min(1).max(20_000), inReplyTo: z.string().trim().max(998).optional().refine((v) => !v || !/[\\r\\n]/.test(v)), references: z.string().trim().max(998).optional().refine((v) => !v || !/[\\r\\n]/.test(v)), attachments: gmailAttachmentSchema }), request.body, reply);
  if (!body) return;
  let attachments;
  try { attachments = decodeGoogleMailAttachments(body.attachments); }
  catch { return reply.code(400).send({ error: 'mail_attachment_invalid', message: 'Anexos inválidos ou acima do limite de 8 MiB.' }); }
  const credentials = await getHostingerCredentials(request.user.organizationId);
  if (!credentials) return reply.code(409).send({ error: 'hostinger_not_configured', message: 'Conecte uma caixa Hostinger em Integrações.' });
  const scopedEmails = await gmailScopedContactEmails(request.user.organizationId, request.user.permissions?.scope);
  if (scopedEmails && !scopedEmails.has(body.to.toLowerCase())) return reply.code(403).send({ error: 'record_scope_denied', message: 'O destinatário não pertence aos clientes atribuídos ao seu escopo.' });
  const smtp = nodemailer.createTransport({ host: 'smtp.hostinger.com', port: 465, secure: true, auth: { user: credentials.email, pass: credentials.password }, connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000 });
  try {
    const result = await smtp.sendMail({ from: credentials.email, to: body.to, subject: body.subject, text: body.text, inReplyTo: body.inReplyTo, references: body.references, attachments: attachments.map((item) => ({ filename: item.filename, contentType: item.mimeType, content: item.data })) });
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'hostinger_email', action: 'message_sent', payload: { messageId: result.messageId, recipient: body.to } });
    return reply.code(201).send({ data: { messageId: result.messageId, sent: true } });
  } catch { return reply.code(502).send({ error: 'hostinger_send_failed', message: 'A Hostinger não aceitou o envio. Verifique a caixa em Integrações.' }); }
  finally { smtp.close(); }
});

app.get('/api/integrations/status', { preHandler: app.authenticate }, async (request) => {
  const controls = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'integration-controls'), isNull(workspaceRecords.archivedAt),
  ));
  const controlByProvider = new Map(controls.map((row) => [String(row.data.provider), row.data as IntegrationControl]));
  const googleConnection = await findGoogleConnection(request.user.organizationId);
  const mercadoPagoTokens = await getMercadoPagoTokens(request.user.organizationId).catch(() => null);
  const mercadoPagoLegacySafe = await legacyMercadoPagoTokenIsSafeFor(request.user.organizationId);
  const hostingerConnection = await findHostingerConnection(request.user.organizationId);
  let googleEmail = '';
  let hostingerEmail = '';
  if (typeof googleConnection?.data.sealedTokens === 'string') {
    try { googleEmail = openGoogleTokens(googleConnection.data.sealedTokens).email; } catch { /* corrupted credentials are shown as disconnected */ }
  }
  if (typeof hostingerConnection?.data.sealedCredentials === 'string') {
    try { hostingerEmail = openHostingerCredentials(hostingerConnection.data.sealedCredentials).email; } catch { /* corrupted credentials are shown as disconnected */ }
  }
  const names: Record<IntegrationProvider, string> = { mercadopago: 'Mercado Pago', evolution: 'Evolution API', waha: 'WAHA', resend: 'Resend', hostinger: 'Hostinger E-mail', google: 'Google Workspace', clicksign: 'Clicksign', github: 'GitHub', n8n: 'n8n', sentry: 'Sentry' };
  return { data: integrationProviders.map((provider) => {
    const control = controlByProvider.get(provider);
    const configured = provider === 'hostinger' ? Boolean(hostingerEmail) : provider === 'mercadopago' ? Boolean(mercadoPagoTokens || mercadoPagoLegacySafe) : integrationConfigured(provider);
    const accountEmail = provider === 'google' ? googleEmail : provider === 'hostinger' ? hostingerEmail : '';
    return { name: names[provider], provider, configured, enabled: configured && control?.enabled !== false, ...(provider === 'mercadopago' ? { oauthAvailable: Boolean(env.MERCADOPAGO_CLIENT_ID && env.MERCADOPAGO_CLIENT_SECRET), oauthRedirectUri: mercadoPagoRedirectUri, ...(mercadoPagoTokens?.accountId ? { accountId: mercadoPagoTokens.accountId } : {}), ...(mercadoPagoLegacySafe && !mercadoPagoTokens ? { legacyAccount: true } : {}) } : {}), ...(accountEmail ? { accountEmail } : {}), lastTestStatus: control?.lastTestStatus || null, lastTestMessage: control?.lastTestMessage || null, testedAt: control?.testedAt || null };
  }) };
});

app.post('/api/integrations/hostinger/configure', { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const body = parseBody(z.object({ email: z.string().trim().min(3).max(254), password: z.string().min(1).max(256) }), request.body, reply);
  if (!body) return;
  let credentials: HostingerCredentials;
  try { credentials = normalizeHostingerCredentials(body); }
  catch { return reply.code(400).send({ error: 'hostinger_credentials_invalid', message: 'Informe um e-mail válido e a senha da caixa postal.' }); }
  try { await verifyHostingerMailbox(credentials); }
  catch { return reply.code(502).send({ error: 'hostinger_auth_failed', message: 'Não foi possível autenticar no IMAP e SMTP da Hostinger. Confira o e-mail e a senha da caixa postal.' }); }
  await saveHostingerCredentials(request.user.organizationId, request.user.sub, credentials);
  await saveIntegrationControl(request.user.organizationId, request.user.sub, 'hostinger', { enabled: true, lastTestStatus: 'connected', lastTestMessage: `Conta Hostinger conectada: ${credentials.email}.`, testedAt: new Date().toISOString() });
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'integration', action: 'hostinger_connected', payload: { provider: 'hostinger', accountEmail: credentials.email } });
  return { data: { provider: 'hostinger', accountEmail: credentials.email, connected: true } };
});

app.get('/api/integrations/test-history', { preHandler: app.authenticate }, async (request, reply) => {
  const query = z.object({ provider: z.enum(integrationProviders).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }).safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'validation_error', message: 'Filtro de histórico inválido.' });
  const rows = await db.select({ id: activityEvents.id, payload: activityEvents.payload, createdAt: activityEvents.createdAt })
    .from(activityEvents).where(and(
      eq(activityEvents.organizationId, request.user.organizationId),
      eq(activityEvents.entityType, 'integration-test'), eq(activityEvents.action, 'completed'),
      ...(query.data.provider ? [sql`${activityEvents.payload}->>'provider' = ${query.data.provider}`] : []),
    )).orderBy(desc(activityEvents.createdAt)).limit(query.data.limit);
  return { data: rows.map((row) => ({ id: row.id, provider: row.payload.provider, status: row.payload.status, createdAt: row.createdAt })) };
});

app.delete('/api/integrations/hostinger/connection', { preHandler: app.authenticate }, async (request) => {
  const current = await findHostingerConnection(request.user.organizationId);
  if (current) await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(workspaceRecords.id, current.id));
  await saveIntegrationControl(request.user.organizationId, request.user.sub, 'hostinger', { enabled: false, lastTestStatus: null, lastTestMessage: null, testedAt: null });
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'integration', action: 'hostinger_credentials_removed', payload: { provider: 'hostinger' } });
  return { data: { provider: 'hostinger', removed: true } };
});

app.post('/api/integrations/:provider/connection', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ provider: z.enum(integrationProviders) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Integração inválida.' });
  const body = parseBody(z.object({ enabled: z.boolean() }), request.body, reply); if (!body) return;
  const provider = params.data.provider;
  if (body.enabled && !(provider === 'hostinger' ? Boolean(await getHostingerCredentials(request.user.organizationId)) : provider === 'mercadopago' ? Boolean(await getMercadoPagoTokens(request.user.organizationId) || await legacyMercadoPagoTokenIsSafeFor(request.user.organizationId) || (env.MERCADOPAGO_CLIENT_ID && env.MERCADOPAGO_CLIENT_SECRET)) : integrationConfigured(provider))) return reply.code(409).send({ error: 'integration_not_configured', message: 'Configure as credenciais no Coolify ou autorize a conta antes de reativar esta integração.' });
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

app.get('/api/integrations/github/repos/:owner/:repo/activity', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
  const repoPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;
  const params = z.object({ owner: z.string().max(39).regex(ownerPattern), repo: z.string().max(100).regex(repoPattern) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Proprietário ou repositório GitHub inválido.' });
  const token = process.env.GITHUB_TOKEN;
  if (!token) return reply.code(503).send({ error: 'github_not_configured', message: 'Configure GITHUB_TOKEN no serviço API do Coolify.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'github')) return reply.code(409).send({ error: 'integration_disconnected', message: 'GitHub está desconectado no Focusshub. Reative em Integrações para sincronizar.' });
  const { owner, repo } = params.data;
  const prefix = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const githubRequest = async (path: string) => {
    const response = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw Object.assign(new Error('github_api_request_failed'), { statusCode: response.status });
    return response.json() as Promise<any>;
  };
  try {
    const [repository, commits, pullRequests, deployments] = await Promise.all([
      githubRequest(prefix), githubRequest(`${prefix}/commits?per_page=5`),
      githubRequest(`${prefix}/pulls?state=open&per_page=5`), githubRequest(`${prefix}/deployments?per_page=1`),
    ]);
    const deployment = Array.isArray(deployments) ? deployments[0] : undefined;
    const deploymentStatuses = deployment?.id ? await githubRequest(`${prefix}/deployments/${Number(deployment.id)}/statuses?per_page=1`) : [];
    return { data: mapGitHubRepositoryActivity({ repository, commits: Array.isArray(commits) ? commits : [], pullRequests: Array.isArray(pullRequests) ? pullRequests : [], deployments: Array.isArray(deployments) ? deployments : [], deploymentStatuses: Array.isArray(deploymentStatuses) ? deploymentStatuses : [] }) };
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number }).statusCode) || 502;
    if (statusCode === 404) return reply.code(404).send({ error: 'github_repository_not_found', message: 'Repositório não encontrado ou token sem acesso a ele.' });
    if (statusCode === 401 || statusCode === 403) return reply.code(409).send({ error: 'github_permission_required', message: 'O GitHub recusou o acesso. Confira o token e as permissões de leitura de conteúdo, pull requests e deployments.' });
    app.log.warn({ statusCode, error: error instanceof Error ? error.name : 'unknown' }, 'GitHub repository activity request failed');
    return reply.code(502).send({ error: 'github_repository_sync_failed', message: 'Não foi possível sincronizar atividade deste repositório agora.' });
  }
});

app.post('/api/integrations/:provider/test', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ provider: z.enum(integrationProviders) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Integração inválida.' });
  const provider = params.data.provider;
  const unavailable = async (message: string) => {
    await saveIntegrationControl(request.user.organizationId, request.user.sub, provider, { lastTestStatus: 'not_configured', lastTestMessage: message, testedAt: new Date().toISOString() });
    await recordIntegrationTest(request.user.organizationId, request.user.sub, provider, 'not_configured');
    return reply.code(503).send({ error: 'integration_not_configured', message });
  };
  const failed = async (message: string) => {
    await saveIntegrationControl(request.user.organizationId, request.user.sub, provider, { lastTestStatus: 'error', lastTestMessage: message, testedAt: new Date().toISOString() });
    await recordIntegrationTest(request.user.organizationId, request.user.sub, provider, 'error');
    return reply.code(502).send({ error: 'integration_test_failed', message });
  };
  if (!await isIntegrationEnabled(request.user.organizationId, provider)) {
    await recordIntegrationTest(request.user.organizationId, request.user.sub, provider, 'disconnected');
    return { data: { status: 'disconnected', message: 'Esta integração está desativada no Focusshub. Reative para testar ou usar novamente.' } };
  }
  const tested = async (status: string, message: string) => {
    await saveIntegrationControl(request.user.organizationId, request.user.sub, provider, { lastTestStatus: status, lastTestMessage: message, testedAt: new Date().toISOString() });
    await recordIntegrationTest(request.user.organizationId, request.user.sub, provider, status);
    return { data: { status, message } };
  };
  try {
    if (provider === 'hostinger') {
      const credentials = await getHostingerCredentials(request.user.organizationId);
      if (!credentials) return unavailable('Conecte a caixa de e-mail Hostinger neste workspace.');
      try { await verifyHostingerMailbox(credentials); }
      catch { return failed('Hostinger recusou a autenticação IMAP/SMTP. Confira se a senha da caixa postal ainda é válida.'); }
      return tested('connected', `Caixa Hostinger autenticada em IMAP e SMTP: ${credentials.email}. Nenhuma mensagem foi enviada.`);
    }
    if (provider === 'mercadopago') {
      const tokens = await getMercadoPagoTokens(request.user.organizationId).catch(() => null);
      if (!tokens && !await legacyMercadoPagoTokenIsSafeFor(request.user.organizationId)) return unavailable('Autorize a conta Mercado Pago deste workspace pelo botão de autorização.');
      const methods = await mercadoPago<Array<{ id: string }>>(request.user.organizationId, '/v1/payment_methods');
      return tested('connected', `Mercado Pago respondeu. ${methods.length} meios de pagamento disponíveis${tokens ? ` para o vendedor ${tokens.accountId}` : ' com a configuração legada de workspace único'}.`);
    }
    if (provider === 'waha') {
      if (!env.WAHA_API_URL || !env.WAHA_API_KEY) return unavailable('Configure WAHA_API_URL e WAHA_API_KEY no serviço API.');
      const remoteSessions = await wahaRequest<Array<{ name?: string; status?: string }>>('/api/sessions');
      const ownedSessions = await db.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'whatsapp-sessions'), isNull(workspaceRecords.archivedAt),
      ));
      const ownedNames = new Set(ownedSessions.map(wahaSessionName));
      const managedSessions = remoteSessions.filter((session) => ownedNames.has(String(session.name || '')));
      const readiness = classifyWahaSessionReadiness(managedSessions);
      return tested(readiness.status, readiness.message);
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
      const sender = process.env.RESEND_FROM_EMAIL?.trim() || '';
      const senderConfigured = z.string().email().safeParse(sender).success;
      const senderMatchesVerifiedDomain = senderConfigured && verified.some((domain) => sender.toLowerCase().endsWith(`@${domain.name?.toLowerCase()}`));
      const readiness = resendOperationalReadiness({ verifiedDomainCount: verified.length, senderConfigured, senderMatchesVerifiedDomain });
      const domainState = `Domínios verificados: ${verified.length}/${domains.length}${domainSummary ? ` (${domainSummary})` : ''}.`;
      if (readiness.status === 'setup_required') return tested('setup_required', `A API do Resend respondeu, mas o envio de propostas não está pronto. ${domainState} Ação necessária: ${readiness.missing.join('; ')}.`);
      return tested('connected', `Resend pronto para envio de propostas. ${domainState}`);
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
      const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=items%28id%29', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
      const calendarDisposition = googleCalendarTestDisposition(calendarResponse.status);
      if (calendarDisposition === 'setup_required') return tested('setup_required', `A conta Google ${profile.email || tokens.email} está autenticada, mas o Calendar recusou a leitura. Revise o escopo calendar.events e reautorize a conta.`);
      if (calendarDisposition === 'error') return failed(`Google Calendar respondeu com HTTP ${calendarResponse.status}. Reconecte a conta se a autorização expirou.`);
      const calendarData = await calendarResponse.json().catch(() => ({})) as { items?: unknown[] };
      return tested('connected', `Google conectado como ${profile.email || tokens.email}; Calendar API confirmou acesso de leitura (${calendarData.items?.length ?? 0} evento(s) consultado(s)). Envio Gmail e upload Drive não são executados pelo teste.`);
    }
    if (provider === 'clicksign') {
      const token = process.env.CLICKSIGN_API_TOKEN;
      if (!token) return unavailable('Configure CLICKSIGN_API_TOKEN no serviço API do Coolify.');
      let baseUrl: string;
      try { baseUrl = clicksignBaseUrl(process.env.CLICKSIGN_API_BASE_URL || 'https://sandbox.clicksign.com'); } catch { return unavailable('CLICKSIGN_API_BASE_URL deve ser https://sandbox.clicksign.com ou https://app.clicksign.com.'); }
      const response = await fetch(`${baseUrl}/api/v3/envelopes?filter%5Bstatus%5D=draft`, { headers: { Authorization: token, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' }, signal: AbortSignal.timeout(12_000) });
      if (response.status === 401 || response.status === 403) return failed(`Clicksign respondeu com HTTP ${response.status}. Confira o token e o ambiente (sandbox ou produção).`);
      if (!response.ok) return failed(`Clicksign respondeu com HTTP ${response.status}. Confira o token e a URL do ambiente.`);
      const result = await response.json() as { data?: unknown[] };
      const webhookEndpoint = new URL('/api/integrations/clicksign/webhook', allowedOrigins[0]).toString();
      const webhookResponse = await fetch(`${baseUrl}/api/v3/webhooks`, { headers: { Authorization: token, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' }, signal: AbortSignal.timeout(12_000) });
      if (!webhookResponse.ok) return tested('setup_required', `API da Clicksign conectada, mas não foi possível confirmar webhooks (HTTP ${webhookResponse.status}). Verifique a permissão de webhooks no token.`);
      const webhookData = await webhookResponse.json() as { data?: unknown[] };
      const requiredEvents = ['document_closed', 'auto_close', 'close', 'cancel', 'deadline', 'refusal', 'sign'];
      if (!clicksignWebhookIsReady(webhookData.data, webhookEndpoint, requiredEvents)) return tested('setup_required', `Crie e ative um webhook Clicksign no endpoint ${webhookEndpoint}, com os eventos ${requiredEvents.join(', ')}.`);
      if (!env.CLICKSIGN_WEBHOOK_SECRET) return tested('setup_required', 'Webhook Clicksign ativo, mas CLICKSIGN_WEBHOOK_SECRET ainda não está configurado no Coolify.');
      return tested('connected', `Clicksign conectado; API confirmou ${result.data?.length ?? 0} envelope(s) em rascunho e o webhook ativo no endpoint correto. Nenhum contrato foi criado ou enviado.`);
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
    const apiDsnConfigured = Boolean(process.env.SENTRY_DSN);
    const webDsnConfigured = Boolean(process.env.VITE_SENTRY_DSN);
    if (!apiDsnConfigured || !webDsnConfigured) {
      const missing = [!apiDsnConfigured ? 'SENTRY_DSN (API)' : '', !webDsnConfigured ? 'VITE_SENTRY_DSN (frontend/build)' : ''].filter(Boolean).join(' e ');
      return tested('setup_required', `Configure ${missing} no Coolify e refaça o deploy. O teste não cria incidentes artificiais.`);
    }
    return tested('setup_required', 'Os DSNs do frontend e da API estão configurados. A ingestão não foi testada para evitar criar um incidente artificial; erros reais serão enviados pelos SDKs.');
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
let overdueWorkerTimer: NodeJS.Timeout | null = null;
let overdueWorkerRunning = false;
let n8nDeliveryWorkerTimer: NodeJS.Timeout | null = null;
let n8nDeliveryWorkerRunning = false;
let siteMonitorWorkerTimer: NodeJS.Timeout | null = null;
let siteMonitorWorkerRunning = false;
const siteMonitorIntervals = new Set([5, 15, 30, 60]);

async function processScheduledSiteChecks() {
  if (siteMonitorWorkerRunning) return;
  siteMonitorWorkerRunning = true;
  try {
    const now = new Date();
    const claimed = await db.transaction(async (tx) => {
      const due = await tx.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.resource, 'monitors'), isNull(workspaceRecords.archivedAt),
        sql`${workspaceRecords.data}->>'enabled' = 'true'`,
        sql`coalesce(${workspaceRecords.data}->>'nextCheckAt', '') <= ${now.toISOString()}`,
      )).orderBy(asc(workspaceRecords.updatedAt)).limit(5).for('update', { skipLocked: true });
      const claims: Array<{ monitor: typeof due[number] }> = [];
      for (const monitor of due) {
        const interval = Number(monitor.data.intervalMinutes);
        const minutes = siteMonitorIntervals.has(interval) ? interval : 15;
        const nextCheckAt = new Date(now.getTime() + minutes * 60_000).toISOString();
        await tx.update(workspaceRecords).set({ data: { ...monitor.data, intervalMinutes: minutes, nextCheckAt }, updatedAt: now })
          .where(and(eq(workspaceRecords.id, monitor.id), eq(workspaceRecords.organizationId, monitor.organizationId), isNull(workspaceRecords.archivedAt)));
        claims.push({ monitor });
      }
      return claims;
    });
    for (const { monitor } of claimed) {
      const siteAssetId = String(monitor.data.siteAssetId || '');
      const [asset] = await db.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.id, siteAssetId), eq(workspaceRecords.organizationId, monitor.organizationId),
        eq(workspaceRecords.resource, 'site-assets'), isNull(workspaceRecords.archivedAt),
      )).limit(1);
      let status = 'error';
      let httpStatus: number | null = null;
      let latencyMs: number | null = null;
      let checkedAt = new Date().toISOString();
      let safeReason = 'check_failed';
      if (asset) {
        const target = String(asset.data.url ?? asset.data.domain ?? asset.data.name ?? '').trim();
        try {
          const result = await checkPublicSite(target);
          status = result.status;
          httpStatus = result.httpStatus;
          latencyMs = result.latencyMs;
          checkedAt = result.checkedAt;
          safeReason = '';
          await db.update(workspaceRecords).set({
            data: { ...asset.data, url: result.url, health: result.status, status: result.status, httpStatus: result.httpStatus, latencyMs: result.latencyMs, sslExpiresAt: result.sslExpiresAt, checkedAt: result.checkedAt },
            updatedAt: new Date(),
          }).where(and(eq(workspaceRecords.id, asset.id), eq(workspaceRecords.organizationId, monitor.organizationId), isNull(workspaceRecords.archivedAt)));
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          const reason = code === 'host_not_public' ? 'host_not_public' : code === 'invalid_url' ? 'invalid_url' : 'check_failed';
          safeReason = reason;
          await db.update(workspaceRecords).set({
            data: siteCheckFailureData(asset.data, checkedAt, reason),
            updatedAt: new Date(),
          }).where(and(eq(workspaceRecords.id, asset.id), eq(workspaceRecords.organizationId, monitor.organizationId), isNull(workspaceRecords.archivedAt)));
        }
      } else safeReason = 'asset_missing';
      const [currentMonitor] = await db.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.id, monitor.id), eq(workspaceRecords.organizationId, monitor.organizationId),
        eq(workspaceRecords.resource, 'monitors'), isNull(workspaceRecords.archivedAt),
      )).limit(1);
      const currentInterval = Number(currentMonitor?.data.intervalMinutes);
      const intervalMinutes = siteMonitorIntervals.has(currentInterval) ? currentInterval : 15;
      const scheduleStillEnabled = currentMonitor?.data.enabled === true && Boolean(asset);
      const nextDue = scheduleStillEnabled ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null;
      if (currentMonitor) await db.update(workspaceRecords).set({ data: {
        ...currentMonitor.data, enabled: scheduleStillEnabled, intervalMinutes,
        nextCheckAt: nextDue, lastCheckedAt: checkedAt, lastStatus: status, lastHttpStatus: httpStatus,
        lastLatencyMs: latencyMs, lastErrorCode: safeReason || null,
      }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, monitor.id), eq(workspaceRecords.organizationId, monitor.organizationId), isNull(workspaceRecords.archivedAt)));
      await db.insert(activityEvents).values({ organizationId: monitor.organizationId, entityType: 'site-assets', entityId: asset?.id || null, action: 'checked', payload: { status, httpStatus, latencyMs, checkedAt, source: 'scheduled', ...(safeReason ? { reason: safeReason } : {}) } });
    }
  } catch (error) {
    app.log.error({ error: error instanceof Error ? error.name : 'unknown' }, 'Scheduled site monitoring scan failed');
  } finally { siteMonitorWorkerRunning = false; }
}

async function getN8nWebhookCredential() {
  const existing = await n8nApiRequest('/credentials?limit=250') as { data?: Array<{ id?: string; name?: string; type?: string }> };
  const match = existing.data?.find((item) => item.name === 'Nexo Workspace Automation Bridge' && item.type === 'httpHeaderAuth');
  const credentialData = { name: n8nWebhookHeader, value: n8nWebhookSecret };
  if (match?.id) {
    await n8nApiRequest(`/credentials/${encodeURIComponent(match.id)}`, { method: 'PATCH', body: JSON.stringify({ data: credentialData, isPartialData: false }) });
    return { id: match.id, name: 'Nexo Workspace Automation Bridge' };
  }
  const created = await n8nApiRequest('/credentials', { method: 'POST', body: JSON.stringify({ name: 'Nexo Workspace Automation Bridge', type: 'httpHeaderAuth', data: credentialData }) }) as { id?: string };
  if (!created.id) throw Object.assign(new Error('n8n_credential_create_failed'), { providerMessage: 'n8n aceitou a criação da credencial mas não devolveu um identificador.' });
  return { id: created.id, name: 'Nexo Workspace Automation Bridge' };
}

async function sendN8nEvent(organizationId: string, eventKey: string, record: Record<string, unknown>, eventId: string = randomUUID()) {
  try {
    const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '');
    const apiKey = process.env.N8N_API_KEY;
    if (!baseUrl || !apiKey || !await isIntegrationEnabled(organizationId, 'n8n')) return false;
    const automations = await db.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
      sql`${workspaceRecords.data}->>'eventKey' = ${eventKey}`, sql`${workspaceRecords.data}->>'active' = 'true'`,
    ));
    if (!automations.length) return false;
    const deliveries = await Promise.all(automations.map(async (row) => {
      const path = String(row.data.n8nWebhookPath ?? '');
      if (!/^nexo\/[0-9a-f-]{36}$/i.test(path)) return false;
      try {
        const response = await fetch(new URL(`/webhook/${path}`, `${baseUrl}/`), {
          method: 'POST', signal: AbortSignal.timeout(8_000),
          headers: { 'Content-Type': 'application/json', [n8nWebhookHeader]: n8nWebhookSecret },
          body: JSON.stringify({ eventId, eventKey, record }),
        });
        if (!response.ok) app.log.warn({ eventKey, statusCode: response.status }, 'n8n event delivery failed');
        return response.ok;
      } catch (error) {
        app.log.warn({ eventKey, error: error instanceof Error ? error.name : 'unknown' }, 'n8n event delivery failed');
        return false;
      }
    }));
    return deliveries.every(Boolean);
  } catch (error) {
    app.log.warn({ eventKey, error: error instanceof Error ? error.name : 'unknown' }, 'n8n event dispatch failed');
    return false;
  }
}

async function enqueueN8nEvent(organizationId: string, eventKey: string, record: Record<string, unknown>, eventId: string = randomUUID()) {
  if (!isSafeWorkspaceData(record) || !z.string().uuid().safeParse(eventId).success) return false;
  try {
    if (!await isIntegrationEnabled(organizationId, 'n8n')) return false;
    const automations = await db.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
      sql`${workspaceRecords.data}->>'eventKey' = ${eventKey}`, sql`${workspaceRecords.data}->>'active' = 'true'`,
    ));
    if (!automations.length) return false;
    await db.insert(n8nEventDeliveries).values(automations.map((automation) => ({
      organizationId, automationId: automation.id, eventId, eventKey, record,
    }))).onConflictDoNothing({ target: [n8nEventDeliveries.automationId, n8nEventDeliveries.eventId] });
    void processN8nEventDeliveries();
    return true;
  } catch (error) {
    app.log.warn({ eventKey, error: error instanceof Error ? error.name : 'unknown' }, 'n8n event could not be queued');
    return false;
  }
}

async function processN8nEventDeliveries() {
  if (n8nDeliveryWorkerRunning) return;
  n8nDeliveryWorkerRunning = true;
  try {
    const now = new Date();
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx.select().from(n8nEventDeliveries).where(and(
        isNull(n8nEventDeliveries.deliveredAt), isNull(n8nEventDeliveries.discardedAt), lte(n8nEventDeliveries.nextAttemptAt, now),
      )).orderBy(asc(n8nEventDeliveries.nextAttemptAt)).limit(25).for('update', { skipLocked: true });
      const ready = [];
      const leaseUntil = new Date(now.getTime() + 2 * 60_000);
      for (const row of rows) {
        const [claimedRow] = await tx.update(n8nEventDeliveries).set({ attempts: row.attempts + 1, nextAttemptAt: leaseUntil, updatedAt: now })
          .where(eq(n8nEventDeliveries.id, row.id)).returning();
        if (claimedRow) ready.push(claimedRow);
      }
      return ready;
    });

    for (const delivery of claimed) {
      let delivered = false;
      let terminalError = '';
      let lastError = 'provider_unavailable';
      const [automation] = await db.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.id, delivery.automationId), eq(workspaceRecords.organizationId, delivery.organizationId),
        eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt),
      )).limit(1);
      if (!automation || automation.data.active !== true || automation.data.eventKey !== delivery.eventKey || !await isIntegrationEnabled(delivery.organizationId, 'n8n')) {
        terminalError = 'automation_inactive_or_removed';
      } else {
        const path = String(automation.data.n8nWebhookPath ?? '');
        if (!/^nexo\/[0-9a-f-]{36}$/i.test(path)) {
          terminalError = 'invalid_webhook_path';
        } else {
          try {
            const baseUrl = process.env.N8N_BASE_URL?.replace(/\/$/, '');
            if (!baseUrl) throw new Error('n8n_not_configured');
            const response = await fetch(new URL(`/webhook/${path}`, `${baseUrl}/`), {
              method: 'POST', signal: AbortSignal.timeout(8_000),
              headers: { 'Content-Type': 'application/json', [n8nWebhookHeader]: n8nWebhookSecret },
              body: JSON.stringify({ eventId: delivery.eventId, eventKey: delivery.eventKey, record: delivery.record }),
            });
            delivered = response.ok;
            if (!response.ok) lastError = `provider_http_${response.status}`;
          } catch (error) {
            lastError = error instanceof Error && error.name === 'TimeoutError' ? 'provider_timeout' : 'provider_unavailable';
          }
        }
      }

      const updatedAt = new Date();
      if (delivered) {
        await db.update(n8nEventDeliveries).set({ deliveredAt: updatedAt, record: {}, lastError: null, updatedAt })
          .where(eq(n8nEventDeliveries.id, delivery.id));
        continue;
      }
      if (terminalError || n8nDeliveryExhausted(delivery.attempts)) {
        await db.update(n8nEventDeliveries).set({ discardedAt: updatedAt, lastError: terminalError || 'delivery_attempts_exhausted', updatedAt })
          .where(eq(n8nEventDeliveries.id, delivery.id));
        app.log.warn({ eventKey: delivery.eventKey, reason: terminalError || 'delivery_attempts_exhausted' }, 'n8n event delivery discarded');
        continue;
      }
      await db.update(n8nEventDeliveries).set({
        nextAttemptAt: new Date(updatedAt.getTime() + n8nDeliveryRetryDelayMs(delivery.attempts)), lastError, updatedAt,
      }).where(eq(n8nEventDeliveries.id, delivery.id));
      app.log.warn({ eventKey: delivery.eventKey, attempt: delivery.attempts, reason: lastError }, 'n8n event delivery will retry');
    }
  } catch (error) {
    app.log.error({ error: error instanceof Error ? error.name : 'unknown' }, 'n8n delivery queue processing failed');
  } finally {
    n8nDeliveryWorkerRunning = false;
  }
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
  )).limit(1);
  if (!automation) return reply.code(404).send({ error: 'automation_not_found' });
  const rejection = n8nCallbackRejectionReason({
    integrationEnabled: await isIntegrationEnabled(automation.organizationId, 'n8n'),
    automationActive: automation.data.active === true,
    automationEventKey: automation.data.eventKey,
    incomingEventKey: body.event.eventKey,
  });
  if (rejection === 'integration_disconnected') return reply.code(409).send({ error: rejection, message: 'Reative a integração n8n para aceitar ações de workflows.' });
  if (rejection) return reply.code(404).send({ error: rejection });
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
  if (template.taskKind === 'proposal' && sourceId) {
    const proposalTasks = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, automation.organizationId), eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
      sql`${workspaceRecords.data}->>'sourceProposalId' = ${sourceId}`,
    ));
    const nativeTask = proposalTasks.find((task) => n8nProposalTaskMatchesSource(task.data, sourceId));
    if (nativeTask) return { data: { status: 'already_applied', taskId: nativeTask.id } };
  }
  if (template.taskKind === 'project' && sourceId) {
    const [nativeTask] = await db.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, automation.organizationId), eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
      sql`${workspaceRecords.data}->>'automationKey' = 'project-delivery-follow-up'`, sql`${workspaceRecords.data}->>'projectId' = ${sourceId}`,
    )).limit(1);
    if (nativeTask) return { data: { status: 'already_applied', taskId: nativeTask.id } };
  }
  if (template.taskKind === 'overduePayment' && sourceId) {
    const [nativeTask] = await db.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, automation.organizationId), eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
      sql`${workspaceRecords.data}->>'automationKey' = 'n8n:overduePayment'`, sql`${workspaceRecords.data}->>'sourceBillingOrderId' = ${sourceId}`,
    )).limit(1);
    if (nativeTask) return { data: { status: 'already_applied', taskId: nativeTask.id } };
  }
  const label = String(event.name ?? event.title ?? event.description ?? sourceId ?? 'registro').trim().slice(0, 160) || 'registro';
  const clientName = String(event.client ?? event.clientName ?? event.company ?? '').trim().slice(0, 160);
  const dueDays = template.taskKind === 'project' ? 7 : template.taskKind === 'lead' || template.taskKind === 'proposal' ? 1 : 0;
  const due = new Date(Date.now() + dueDays * 86_400_000).toISOString().slice(0, 10);
  const titlePrefix: Record<typeof template.taskKind, string> = {
    lead: 'Primeiro contato', proposal: 'Preparar início do projeto', payment: 'Revisar pagamento recebido',
    project: 'Acompanhar entrega', ticket: 'Atender chamado', overduePayment: 'Revisar cobrança vencida',
  };
  const data = {
    title: `${titlePrefix[template.taskKind]} · ${label}`.slice(0, 220), client: clientName, project: String(event.project ?? ''), due,
    description: template.taskKind === 'overduePayment'
      ? `Cobrança ${sourceId}, vencida em ${String(event.dueAt ?? '').slice(0, 10)}. Confira o estado atual no Mercado Pago antes de emitir uma nova cobrança.`
      : String(event.description ?? ''),
    amount: template.taskKind === 'overduePayment' ? Number(event.amount) || 0 : undefined,
    status: 'A fazer', priority: template.taskKind === 'lead' || template.taskKind === 'ticket' || template.taskKind === 'overduePayment' ? 'Alta' : 'Normal', assignee: '',
    automationKey: `n8n:${template.taskKind}`, sourceN8nAutomationId: automation.id, n8nEventId: body.event.eventId,
    ...(template.taskKind === 'lead' ? { sourceLeadId: sourceId } : {}), ...(template.taskKind === 'proposal' ? { sourceProposalId: sourceId } : {}), ...(template.taskKind === 'project' ? { projectId: sourceId } : {}),
    ...(template.taskKind === 'overduePayment' ? { sourceBillingOrderId: sourceId, clientId: typeof event.clientId === 'string' ? event.clientId : null } : {}),
  };
  const result = await db.transaction(async (tx) => {
    const [task] = await tx.insert(workspaceRecords).values({ organizationId: automation.organizationId, createdBy: ownerAccountId, resource: 'tasks', data })
      .onConflictDoNothing().returning({ id: workspaceRecords.id });
    if (!task) {
      const [duplicate] = await tx.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, automation.organizationId), eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
        sql`${workspaceRecords.data}->>'n8nEventId' = ${body.event.eventId}`,
      )).limit(1);
      if (!duplicate) throw new Error('n8n_event_task_conflict_without_record');
      return { taskId: duplicate.id, inserted: false };
    }
    await tx.insert(activityEvents).values({ organizationId: automation.organizationId, actorUserId: ownerAccountId, entityType: 'tasks', entityId: task.id, action: 'created', payload: { automation: `n8n:${template.taskKind}`, sourceN8nAutomationId: automation.id } });
    return { taskId: task.id, inserted: true };
  });
  return { data: { status: result.inserted ? 'processed' : 'already_processed', taskId: result.taskId } };
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
  let stage = 'preparar credencial';
  try {
    const credential = await getN8nWebhookCredential();
    stage = 'criar workflow remoto';
    const webhookPath = `nexo/${randomUUID()}`;
    const callbackUrl = new URL('/api/integrations/n8n/actions', allowedOrigins[0]).toString();
    const workflow = buildN8nAutomationWorkflow({ automationId: automation.id, templateId, name: String(automation.data.name ?? 'Automação'), webhookPath, callbackUrl, credentialId: credential.id });
    const created = await n8nApiRequest('/workflows', { method: 'POST', body: JSON.stringify(workflow) }) as { id?: string };
    if (!created.id) throw Object.assign(new Error('n8n_workflow_create_failed'), { providerMessage: 'n8n aceitou a criação do workflow mas não devolveu um identificador.' });
    remoteWorkflowId = created.id;
    stage = 'vincular workflow ao modelo';
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
    app.log.error({ stage, statusCode, error: error instanceof Error ? error.message : 'unknown' }, 'Could not create n8n workflow');
    const message = statusCode === 403 ? 'A chave de API precisa de permissões credential:list, credential:create, credential:update e workflow:create.' : providerMessage ?? `Falha ao ${stage}. Verifique os logs da API no Coolify para o diagnóstico.`;
    return reply.code(statusCode).send({ error: 'n8n_workflow_create_failed', message });
  }
});

app.get('/api/integrations/n8n/deliveries', { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
  const rows = await db.select({
    id: n8nEventDeliveries.id, automationId: n8nEventDeliveries.automationId, eventKey: n8nEventDeliveries.eventKey,
    attempts: n8nEventDeliveries.attempts, nextAttemptAt: n8nEventDeliveries.nextAttemptAt,
    deliveredAt: n8nEventDeliveries.deliveredAt, discardedAt: n8nEventDeliveries.discardedAt,
    lastError: n8nEventDeliveries.lastError, createdAt: n8nEventDeliveries.createdAt, record: n8nEventDeliveries.record,
  }).from(n8nEventDeliveries).where(eq(n8nEventDeliveries.organizationId, request.user.organizationId))
    .orderBy(desc(n8nEventDeliveries.createdAt)).limit(50);
  const automationIds = [...new Set(rows.map((row) => row.automationId))];
  const automations = automationIds.length ? await db.select({ id: workspaceRecords.id, name: sql<string>`coalesce(${workspaceRecords.data}->>'name', 'Automação removida')` })
    .from(workspaceRecords).where(and(eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'automations'), inArray(workspaceRecords.id, automationIds))) : [];
  const names = new Map(automations.map((item) => [item.id, item.name]));
  return { data: rows.map((row) => ({ id: row.id, automationId: row.automationId, eventKey: row.eventKey, attempts: row.attempts, nextAttemptAt: row.nextAttemptAt, deliveredAt: row.deliveredAt, discardedAt: row.discardedAt, lastError: row.lastError, createdAt: row.createdAt, automationName: names.get(row.automationId) || 'Automação removida', status: row.deliveredAt ? 'delivered' : row.discardedAt ? 'discarded' : 'pending', retryable: n8nDeliveryCanRetry(row) })) };
});

app.post('/api/integrations/n8n/deliveries/:id/retry', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de entrega inválido.' });
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(n8nEventDeliveries).where(and(eq(n8nEventDeliveries.id, params.data.id), eq(n8nEventDeliveries.organizationId, request.user.organizationId))).limit(1).for('update', { skipLocked: true });
    if (!row) return 'not_found' as const;
    if (!n8nDeliveryCanRetry(row)) return 'not_retryable' as const;
    await tx.update(n8nEventDeliveries).set({ attempts: 0, discardedAt: null, lastError: null, nextAttemptAt: now, updatedAt: now }).where(eq(n8nEventDeliveries.id, row.id));
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'n8n_delivery', entityId: row.id, action: 'manual_retry', payload: { eventKey: row.eventKey } });
    return 'queued' as const;
  });
  if (result === 'not_found') return reply.code(404).send({ error: 'delivery_not_found', message: 'Entrega não encontrada neste workspace.' });
  if (result === 'not_retryable') return reply.code(409).send({ error: 'delivery_not_retryable', message: 'Esta entrega não pode ser reprocessada: o evento ainda está ativo, já foi entregue ou os dados foram descartados.' });
  void processN8nEventDeliveries();
  return { data: { id: params.data.id, status: 'pending' } };
});

app.post('/api/integrations/n8n/deliveries/:id/discard', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de entrega inválido.' });
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(n8nEventDeliveries).where(and(eq(n8nEventDeliveries.id, params.data.id), eq(n8nEventDeliveries.organizationId, request.user.organizationId))).limit(1).for('update', { skipLocked: true });
    if (!row) return 'not_found' as const;
    if (row.deliveredAt || row.discardedAt) return 'not_pending' as const;
    const now = new Date();
    await tx.update(n8nEventDeliveries).set({ discardedAt: now, record: {}, lastError: row.lastError || 'manually_discarded', updatedAt: now }).where(eq(n8nEventDeliveries.id, row.id));
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'n8n_delivery', entityId: row.id, action: 'manual_discard', payload: { eventKey: row.eventKey } });
    return 'discarded' as const;
  });
  if (result === 'not_found') return reply.code(404).send({ error: 'delivery_not_found', message: 'Entrega não encontrada neste workspace.' });
  if (result === 'not_pending') return reply.code(409).send({ error: 'delivery_not_pending', message: 'Somente entregas pendentes podem ser descartadas.' });
  return { data: { id: params.data.id, status: 'discarded' } };
});

app.get('/api/integrations/n8n/workflows', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const query = z.object({ cursor: z.string().trim().min(1).max(512).optional() }).safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'validation_error', message: 'Cursor de workflows inválido.' });
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) return reply.code(503).send({ error: 'n8n_not_configured', message: 'Configure a URL segura do n8n e a chave da API no Coolify.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'n8n')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Reative o n8n em Integrações para consultar workflows.' });
  try {
    const [workflowResult, executionResult, deliveryQueueResult] = await Promise.all([
      n8nApiRequest(n8nWorkflowsEndpoint(query.data.cursor)) as Promise<{ data?: unknown[]; nextCursor?: string | null }>,
      n8nApiRequest('/executions?limit=25&includeData=false') as Promise<{ data?: unknown[]; nextCursor?: string | null }>,
      db.select({
        pending: sql<number>`count(*) filter (where ${n8nEventDeliveries.deliveredAt} is null and ${n8nEventDeliveries.discardedAt} is null)`,
        delivered: sql<number>`count(*) filter (where ${n8nEventDeliveries.deliveredAt} is not null)`,
        discarded: sql<number>`count(*) filter (where ${n8nEventDeliveries.discardedAt} is not null)`,
      }).from(n8nEventDeliveries).where(eq(n8nEventDeliveries.organizationId, request.user.organizationId)),
    ]);
    const mapped = mapN8nCollections(
      Array.isArray(workflowResult.data) ? workflowResult.data : [],
      Array.isArray(executionResult.data) ? executionResult.data : [],
    );
    const [queue] = deliveryQueueResult;
    return { data: { ...mapped, workflowNextCursor: workflowResult.nextCursor ?? null, executionNextCursor: executionResult.nextCursor ?? null, deliveryQueue: { pending: Number(queue?.pending || 0), delivered: Number(queue?.delivered || 0), discarded: Number(queue?.discarded || 0) } } };
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
    await n8nApiRequest(`/workflows/${encodeURIComponent(id)}/${n8nWorkflowActionEndpoint(action)}`, { method: 'POST', body: '{}' });
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
    return reply.code(statusCode).send({ error: permission ? 'n8n_api_forbidden' : 'n8n_workflow_action_failed', message: permission ? 'A chave da API precisa do escopo workflow:activate para publicar ou despublicar workflows.' : 'Não foi possível alterar o workflow. Confira o status no n8n e tente novamente.' });
  }
});

app.post('/api/workspace/proposals/:id/send-email', { preHandler: app.authenticate, bodyLimit: 12 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(z.object({ to: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), provider: z.enum(['resend', 'google']).default('resend') }), request.body, reply);
  const idempotencyKey = z.string().uuid().safeParse(request.headers['idempotency-key']);
  if (!params.success || !idempotencyKey.success) return reply.code(400).send({ error: 'validation_error', message: 'Proposta ou chave de envio inválida.' });
  if (!body) return;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (body.provider === 'resend' && (!apiKey || !from || !z.string().email().safeParse(from).success)) return reply.code(503).send({ error: 'resend_not_configured', message: 'Configure a chave e o remetente do Resend em Integrações.' });
  if (!await isIntegrationEnabled(request.user.organizationId, body.provider)) return reply.code(409).send({ error: 'integration_disconnected', message: 'O provedor de e-mail está desconectado no Focusshub.' });
  if (body.provider === 'google' && !await getGoogleTokens(request.user.organizationId)) return reply.code(409).send({ error: 'google_authorization_required', message: 'Autorize Google Workspace em Integrações antes de enviar pelo Gmail.' });

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
    const nextDelivery = { key: idempotencyKey.data, status: 'sending', recipient: body.to, provider: body.provider, startedAt: new Date().toISOString() };
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
    const response = await fetch(body.provider === 'resend' ? 'https://api.resend.com/emails' : 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${body.provider === 'resend' ? apiKey : await googleAccessToken(request.user.organizationId, request.user.sub)}`, 'Content-Type': 'application/json', ...(body.provider === 'resend' ? { 'Idempotency-Key': `nexo-proposal-${params.data.id}-${idempotencyKey.data}` } : {}) },
      body: body.provider === 'resend' ? JSON.stringify({ from, to: [body.to], subject: `Proposta comercial: ${String(proposal.title || proposal.name || 'Focusshub')}`, html, text }) : JSON.stringify({ raw: buildGoogleRawMessage({ to: body.to, subject: `Proposta comercial: ${String(proposal.title || proposal.name || 'Focusshub')}`, html, text }) }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; threadId?: string };
    if (!response.ok || !result.id) {
      await db.update(workspaceRecords).set({ data: { ...proposal, email: body.to, emailDelivery: { key: idempotencyKey.data, status: 'failed', provider: body.provider, recipient: body.to, failedAt: new Date().toISOString(), providerStatus: response.status } }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, reservation.row.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
      return reply.code(response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 409 : 502).send({ error: `${body.provider}_send_failed`, message: `${body.provider === 'google' ? 'Gmail' : 'Resend'} recusou o envio (HTTP ${response.status}). Confira autorizacao e remetente.` });
    }
    const sentAt = new Date().toISOString();
    const emailDelivery = { key: idempotencyKey.data, status: 'sent', provider: body.provider, recipient: body.to, emailId: result.id, sentAt };
    await db.update(workspaceRecords).set({ data: { ...proposal, email: body.to, status: 'Enviada', tone: 'blue', emailDelivery, date: `Enviada em ${new Date(sentAt).toLocaleDateString('pt-BR')}` }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, reservation.row.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'proposal', entityId: reservation.row.id, action: 'email_sent', payload: { provider: body.provider, recipient: body.to, emailId: result.id } });
    return { data: { status: 'sent', emailId: result.id, recipient: body.to, sentAt } };
  } catch {
    await db.update(workspaceRecords).set({ data: { ...proposal, email: body.to, emailDelivery: { key: idempotencyKey.data, status: 'failed', provider: body.provider, recipient: body.to, failedAt: new Date().toISOString() } }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, reservation.row.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
    return reply.code(502).send({ error: `${body.provider}_unreachable`, message: `Nao foi possivel confirmar o envio no ${body.provider === 'google' ? 'Gmail' : 'Resend'}. Reutilize a mesma chave de envio ao tentar novamente.` });
  }
});

app.get('/api/integrations/google/drive/files', { preHandler: app.authenticate, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
  const query = z.object({ pageToken: z.string().max(2048).optional() }).safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'validation_error', message: 'Cursor de paginação do Drive inválido.' });
  if (!isWorkspaceRequestAllowed(request.user.role, 'GET', '/api/workspace/files', request.user.permissions)) return reply.code(403).send({ error: 'forbidden', message: 'Você não tem acesso aos arquivos deste workspace.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'google')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Conecte o Google Workspace para navegar nos arquivos autorizados ao Focusshub.' });
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const response = await fetch(googleDriveFilesListUrl(query.data.pageToken), { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) });
    const payload = await response.json().catch(() => ({})) as { files?: GoogleDriveFile[]; nextPageToken?: string };
    if (!response.ok) {
      const failure = classifyGoogleDriveListFailure(response.status);
      return reply.code(response.status === 401 ? 409 : 502).send({ error: failure.code, message: failure.message });
    }
    let files = (Array.isArray(payload.files) ? payload.files : []).map(mapGoogleDriveFile).filter((file): file is NonNullable<typeof file> => Boolean(file));
    const scope = request.user.permissions?.scope;
    if (scope?.mode === 'selected') {
      const linkedFiles = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'files'), isNull(workspaceRecords.archivedAt),
      ));
      const visibleDriveIds = new Set(linkedFiles.filter((row) => recordMatchesWorkspaceScope('files', row.id, row.data, scope)).map((row) => String(row.data.driveFileId || '')).filter(Boolean));
      files = files.filter((file) => visibleDriveIds.has(file.id));
    }
    return { data: { files, nextPageToken: typeof payload.nextPageToken === 'string' ? payload.nextPageToken : null, limited: true, scope: 'drive.file' } };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 409 || statusCode === 503) return reply.code(statusCode).send({ error: 'google_authorization_required', message: 'Autorize o Google Workspace em Integrações para navegar nos arquivos autorizados ao Focusshub.' });
    app.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Google Drive listing failed');
    return reply.code(502).send({ error: 'google_drive_unavailable', message: 'Não foi possível consultar o Google Drive. Tente novamente em instantes.' });
  }
});

app.patch('/api/integrations/google/drive/:fileId/metadata', { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ fileId: z.string().min(5).max(200).regex(/^[A-Za-z0-9_-]+$/) }).safeParse(request.params);
  const body = parseBody(z.object({ name: z.string().trim().min(1).max(180).refine((value) => !value.includes('/') && !value.includes('\\') && !/[\r\n\0]/.test(value)) }), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'ID de arquivo do Drive inválido.' });
  if (!body) return;
  if (!isWorkspaceRequestAllowed(request.user.role, 'PATCH', '/api/workspace/files', request.user.permissions)) return reply.code(403).send({ error: 'forbidden', message: 'Você não tem acesso aos arquivos deste workspace.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'google')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Conecte o Google Workspace antes de renomear arquivos.' });

  const fileRows = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'files'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'driveFileId' = ${params.data.fileId}`,
  )).limit(10);
  const allowedRows = fileRows.filter((row) => recordMatchesWorkspaceScope('files', row.id, row.data, request.user.permissions?.scope));
  const [primaryRecord] = allowedRows;
  if (!primaryRecord) return reply.code(404).send({ error: 'drive_file_not_linked', message: 'Vincule este arquivo ao workspace antes de editar seus metadados.' });

  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const response = await fetch(googleDriveFileMetadataUrl(params.data.fileId), {
      method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: body.name }), signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => ({})) as GoogleDriveFile;
    if (!response.ok || !result.id) {
      if (response.status === 401 || response.status === 403) return reply.code(409).send({ error: 'google_authorization_required', message: 'O Google Drive recusou a edição. Confira a autorização da conta e tente novamente.' });
      return reply.code(502).send({ error: 'google_drive_update_failed', message: 'O Google Drive não confirmou a alteração do nome.' });
    }
    const file = mapGoogleDriveFile(result);
    if (!file) return reply.code(502).send({ error: 'google_drive_update_failed', message: 'O Google Drive retornou metadados inválidos.' });
    for (const row of allowedRows) {
      await db.update(workspaceRecords).set({ data: { ...(row.data as Record<string, unknown>), name: file.name }, updatedAt: new Date() }).where(and(
        eq(workspaceRecords.id, row.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'files'), isNull(workspaceRecords.archivedAt),
      ));
    }
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'file', entityId: primaryRecord.id, action: 'google_drive_file_renamed', payload: { fileId: file.id, name: file.name } });
    return { data: file };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 409 || statusCode === 503) return reply.code(statusCode).send({ error: 'google_authorization_required', message: 'Autorize o Google Workspace em Integrações para editar arquivos do Drive.' });
    app.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Google Drive metadata update failed');
    return reply.code(502).send({ error: 'google_drive_unavailable', message: 'Não foi possível atualizar o arquivo no Google Drive.' });
  }
});

app.post('/api/integrations/google/drive/upload', { bodyLimit: 12 * 1024 * 1024, preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(z.object({ name: z.string().trim().min(1).max(180).refine((value) => !value.includes('/') && !value.includes('\\') && !/[\r\n\0]/.test(value)), mimeType: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.+-]*\/[A-Za-z0-9][A-Za-z0-9.+-]*$/).max(120), data: z.string().max(11_185_000), taskId: z.string().uuid().optional() }), request.body, reply);
  if (!body) return;
  if (!isWorkspaceRequestAllowed(request.user.role, 'POST', '/api/integrations/google/drive/upload', request.user.permissions)) return reply.code(403).send({ error: 'forbidden', message: 'Você não tem permissão para enviar arquivos ao Google Drive deste workspace.' });
  if (body.taskId && !isWorkspaceRequestAllowed(request.user.role, 'PATCH', `/api/workspace/tasks/${body.taskId}`, request.user.permissions)) return reply.code(403).send({ error: 'forbidden', message: 'Você não tem permissão para anexar arquivos a tarefas deste workspace.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'google')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Google Workspace is disconnected. Reconnect it before uploading.' });
  let bytes: Buffer;
  try { bytes = decodeGoogleDriveUpload(body.data); }
  catch { return reply.code(413).send({ error: 'drive_upload_too_large_or_invalid', message: 'The file is empty, invalid, or larger than the 8 MiB limit.' }); }
  const [task] = body.taskId ? await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.id, body.taskId), eq(workspaceRecords.organizationId, request.user.organizationId),
    eq(workspaceRecords.resource, 'tasks'), isNull(workspaceRecords.archivedAt),
  )).limit(1) : [];
  if (body.taskId && !task) return reply.code(404).send({ error: 'task_not_found', message: 'A tarefa vinculada não existe neste workspace.' });
  if (task && !recordMatchesWorkspaceScope('tasks', task.id, task.data, request.user.permissions?.scope)) return reply.code(403).send({ error: 'record_scope_denied', message: 'A tarefa não pertence ao escopo atribuído.' });
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const boundary = `nexo_${randomUUID().replaceAll('-', '')}`;
    const metadata = Buffer.from(JSON.stringify({ name: body.name, mimeType: body.mimeType }), 'utf8');
    const multipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`), metadata,
      Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${body.mimeType}\r\n\r\n`), bytes,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart, signal: AbortSignal.timeout(30_000) });
    const result = await response.json().catch(() => ({})) as { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; createdTime?: string };
    if (!response.ok || !result.id) return reply.code(response.status === 401 || response.status === 403 ? 409 : 502).send({ error: 'google_drive_upload_failed', message: 'Google Drive did not confirm the upload. Check the authorized account and Drive access.' });
    const uploadedFile = { id: result.id, name: result.name || body.name, mimeType: result.mimeType || body.mimeType, size: Number(result.size || bytes.length), url: result.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(result.id)}`, createdAt: result.createdTime || new Date().toISOString() };
    if (task) {
      const taskData = task.data as Record<string, unknown>;
      const attachment = { driveFileId: uploadedFile.id, name: uploadedFile.name, mimeType: uploadedFile.mimeType, size: uploadedFile.size, url: uploadedFile.url, createdAt: uploadedFile.createdAt };
      await db.update(workspaceRecords).set({ data: { ...taskData, attachment }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, task.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
    }
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'file', entityId: task?.id, action: 'google_drive_uploaded', payload: { fileId: result.id, name: uploadedFile.name, mimeType: uploadedFile.mimeType, size: uploadedFile.size, taskId: task?.id } });
    return reply.code(201).send({ data: uploadedFile });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 409 || statusCode === 503) return reply.code(statusCode).send({ error: 'google_authorization_required', message: 'Authorize Google Workspace in Integrations to upload files to Drive.' });
    app.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Google Drive upload failed');
    return reply.code(502).send({ error: 'google_drive_unavailable', message: 'Google Drive upload could not be completed.' });
  }
});

app.post('/api/integrations/google/drive/:fileId/share-for-portal', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ fileId: z.string().min(5).max(200).regex(/^[A-Za-z0-9_-]+$/) }).safeParse(request.params);
  const body = parseBody(z.object({ confirmPublicAccess: z.literal(true), clientId: z.string().uuid(), projectId: z.string().uuid().optional() }), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid Drive file ID.' });
  if (!body) return;
  const scope = request.user.permissions?.scope;
  const [clientRecord] = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
    eq(workspaceRecords.id, body.clientId), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  if (!clientRecord) return reply.code(400).send({ error: 'approval_client_invalid', message: 'Selecione um cliente ativo deste workspace.' });
  if (!recordMatchesWorkspaceScope('clients', clientRecord.id, clientRecord.data, scope)) return reply.code(403).send({ error: 'record_scope_denied', message: 'O cliente nao pertence ao escopo atribuido.' });
  let projectRecord: { id: string; data: Record<string, unknown> } | undefined;
  if (body.projectId) {
    [projectRecord] = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
      eq(workspaceRecords.id, body.projectId), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'projects'), isNull(workspaceRecords.archivedAt),
    )).limit(1);
    if (!projectRecord) return reply.code(400).send({ error: 'approval_project_invalid', message: 'Selecione um projeto ativo deste workspace.' });
    if (!recordMatchesWorkspaceScope('projects', projectRecord.id, projectRecord.data, scope)) return reply.code(403).send({ error: 'record_scope_denied', message: 'O projeto nao pertence ao escopo atribuido.' });
  }
  const fileRows = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'files'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'driveFileId' = ${params.data.fileId}`,
  )).limit(10);
  const eligibleFile = fileRows.some((row) => recordMatchesWorkspaceScope('files', row.id, row.data, scope) && approvalFileMatchesClientScope({
    fileId: params.data.fileId, file: row.data, clientId: clientRecord.id,
    clientName: String(clientRecord.data.name ?? clientRecord.data.title ?? ''),
    projectId: projectRecord?.id, projectName: String(projectRecord?.data.name ?? projectRecord?.data.title ?? ''), project: projectRecord?.data,
  }));
  if (!eligibleFile) return reply.code(403).send({ error: 'approval_file_scope_denied', message: 'O arquivo precisa estar vinculado ao cliente ou ao projeto selecionado.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'google')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Reconnect Google Workspace before sharing this file.' });
  let createdPermissionId = '';
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.data.fileId)}/permissions`;
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
    const listResponse = await fetch(`${base}?fields=permissions(id,type,role)&supportsAllDrives=true`, { headers, signal: AbortSignal.timeout(12_000) });
    const permissions = await listResponse.json().catch(() => ({})) as { permissions?: Array<{ id?: string; type?: string; role?: string }> };
    if (!listResponse.ok) return reply.code(listResponse.status === 404 ? 404 : listResponse.status === 403 ? 409 : 502).send({ error: 'drive_permissions_unavailable', message: listResponse.status === 403 ? 'The Google account or Workspace policy does not allow sharing this file.' : 'Drive could not verify file permissions.' });
    let permission = permissions.permissions?.find((item) => item.type === 'anyone' && item.role === 'reader');
    if (!permission) {
      const created = await fetch(`${base}?fields=id,type,role&supportsAllDrives=true&sendNotificationEmail=false`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }), signal: AbortSignal.timeout(12_000) });
      permission = await created.json().catch(() => ({})) as { id?: string; type?: string; role?: string };
      if (!created.ok || permission.type !== 'anyone' || permission.role !== 'reader') return reply.code(created.status === 403 ? 409 : 502).send({ error: 'drive_public_share_failed', message: 'Google Drive did not confirm view-only access for the portal.' });
      createdPermissionId = permission.id || '';
    }
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'drive_file', action: 'shared_for_client_portal', payload: { fileId: params.data.fileId, permissionType: permission.type, role: permission.role, permissionId: createdPermissionId || null } });
    return { data: { shared: true, created: Boolean(createdPermissionId), permissionId: createdPermissionId || null, url: `https://drive.google.com/file/d/${encodeURIComponent(params.data.fileId)}/view` } };
  } catch (error) {
    if (createdPermissionId) {
      try { const token = await googleAccessToken(request.user.organizationId, request.user.sub); await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.data.fileId)}/permissions/${encodeURIComponent(createdPermissionId)}?supportsAllDrives=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000) }); } catch { /* keep the original safe error */ }
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 409 || status === 503) return reply.code(status).send({ error: 'google_authorization_required', message: 'Authorize Google Drive in Integrations to share portal files.' });
    return reply.code(502).send({ error: 'drive_permissions_unavailable', message: 'Google Drive could not update this file permission.' });
  }
});

app.delete('/api/integrations/google/drive/:fileId/share-for-portal', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ fileId: z.string().min(5).max(200).regex(/^[A-Za-z0-9_-]+$/) }).safeParse(request.params);
  const body = parseBody(z.object({ permissionId: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/) }), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid Drive file ID.' });
  if (!body) return;
  const grantWhere = and(
    eq(activityEvents.organizationId, request.user.organizationId), eq(activityEvents.entityType, 'drive_file'), eq(activityEvents.action, 'shared_for_client_portal'),
    sql`${activityEvents.payload}->>'fileId' = ${params.data.fileId}`, sql`${activityEvents.payload}->>'permissionId' = ${body.permissionId}`,
  );
  const [grant] = await db.select({ id: activityEvents.id }).from(activityEvents).where(grantWhere).limit(1);
  if (!grant) {
    const [revokedGrant] = await db.select({ id: activityEvents.id }).from(activityEvents).where(and(
      eq(activityEvents.organizationId, request.user.organizationId), eq(activityEvents.entityType, 'drive_file'), eq(activityEvents.action, 'portal_share_revoked'),
      sql`${activityEvents.payload}->>'fileId' = ${params.data.fileId}`, sql`${activityEvents.payload}->>'permissionId' = ${body.permissionId}`,
    )).limit(1);
    if (revokedGrant) return { data: { revoked: true, alreadyRevoked: true } };
    return reply.code(404).send({ error: 'permission_not_owned', message: 'This public permission was not created by Focusshub for this workspace.' });
  }
  try {
    const accessToken = await googleAccessToken(request.user.organizationId, request.user.sub);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.data.fileId)}/permissions/${encodeURIComponent(body.permissionId)}?supportsAllDrives=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok && response.status !== 404) return reply.code(response.status === 403 ? 409 : 502).send({ error: 'drive_permission_revoke_failed', message: 'Google Drive could not revoke public access.' });
    await db.update(activityEvents).set({ action: 'portal_share_revoked' }).where(grantWhere);
    return { data: { revoked: true } };
  } catch {
    return reply.code(502).send({ error: 'drive_permission_revoke_failed', message: 'Google Drive could not revoke public access.' });
  }
});

app.get('/api/team/users', { preHandler: app.authenticate }, async (request, reply) => {
  if (request.user.role !== 'owner') return reply.code(403).send({ error: 'owner_required', message: 'Somente a pessoa proprietaria pode administrar os acessos.' });
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, permissions: users.permissions, createdAt: users.createdAt }).from(users).where(eq(users.organizationId, request.user.organizationId)).orderBy(asc(users.createdAt));
  return { data: rows };
});

app.patch('/api/team/users/:id/permissions', { preHandler: app.authenticate }, async (request, reply) => {
  if (request.user.role !== 'owner') return reply.code(403).send({ error: 'owner_required', message: 'Somente a pessoa proprietaria pode alterar permissoes.' });
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  const permission = z.object({ read: z.boolean(), write: z.boolean(), delete: z.boolean().optional() }).strict();
  const permissionsSchema = z.object({ permissions: z.object({
    crm: permission.optional(), delivery: permission.optional(), support: permission.optional(), finance: permission.optional(), sites: permission.optional(),
    automations: permission.optional(), integrations: permission.optional(), settings: permission.optional(), reports: permission.optional(),
    scope: z.object({ mode: z.enum(['all', 'selected']), clientIds: z.array(z.string().uuid()).max(500), projectIds: z.array(z.string().uuid()).max(500) }).strict().optional(),
  }).strict().superRefine((value, context) => {
    for (const [module, access] of Object.entries(value)) {
      if (module === 'scope' || !access || typeof access !== 'object' || !('read' in access)) continue;
      if (access?.write && !access.read) context.addIssue({ code: 'custom', path: [module, 'write'], message: 'Edicao exige acesso de leitura.' });
      if (access?.delete && !access.read) context.addIssue({ code: 'custom', path: [module, 'delete'], message: 'Exclusao exige acesso de leitura.' });
    }
  }) }).strict();
  const body = parseBody(permissionsSchema, request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Usuario invalido.' });
  if (!body) return;
  if (params.data.id === request.user.sub) return reply.code(409).send({ error: 'cannot_change_owner_permissions', message: 'As permissoes da conta proprietaria nao podem ser reduzidas.' });
  const [updated] = await db.update(users).set({ permissions: body.permissions }).where(and(
    eq(users.id, params.data.id), eq(users.organizationId, request.user.organizationId), sql`${users.role} <> 'owner'`,
  )).returning({ id: users.id, permissions: users.permissions });
  if (!updated) return reply.code(404).send({ error: 'team_user_not_found', message: 'Usuario nao encontrado neste workspace.' });
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'team-user', entityId: updated.id, action: 'permissions_updated', payload: { permissions: updated.permissions } });
  return { data: updated };
});

app.post('/api/team/invites', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
  if (request.user.role !== 'owner') return reply.code(403).send({ error: 'owner_required', message: 'Somente a pessoa proprietaria pode convidar usuarios.' });
  const body = parseBody(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254).transform(normalizeAccountEmail), role: z.enum(['admin', 'member']) }).strict(), request.body, reply);
  if (!body) return;
  const existing = await db.select().from(users).where(sql`lower(${users.email}) = ${body.email}`).limit(1);
  const existingUser = existing[0];
  if (existingUser && (existingUser.organizationId !== request.user.organizationId || existingUser.role === 'owner' || existingUser.active)) return reply.code(409).send({ error: 'team_user_exists', message: 'Este e-mail ja tem uma conta ativa, pertence a outro workspace ou esta reservado a uma conta proprietaria.' });
  const inviteVersion = (existingUser?.inviteVersion ?? 0) + 1;
  const invite = await db.transaction(async (tx) => {
    const passwordHash = await argon2.hash(randomBytes(32).toString('base64url'));
    const [user] = existingUser
      ? await tx.update(users).set({ name: body.name, email: body.email, role: body.role, permissions: null, active: false, inviteVersion, sessionVersion: sql`${users.sessionVersion} + 1`, passwordHash }).where(and(eq(users.id, existingUser.id), eq(users.organizationId, request.user.organizationId), eq(users.active, false), eq(users.inviteVersion, existingUser.inviteVersion))).returning({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, createdAt: users.createdAt })
      : await tx.insert(users).values({ organizationId: request.user.organizationId, name: body.name, email: body.email, role: body.role, active: false, inviteVersion, passwordHash }).returning({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, createdAt: users.createdAt });
    if (!user) return undefined;
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'team-user', entityId: user.id, action: existingUser ? 'invite_renewed' : 'invited', payload: { role: body.role, email: user.email } });
    return user;
  });
  if (!invite) return reply.code(409).send({ error: 'team_user_changed', message: 'A conta mudou enquanto o convite era criado. Atualize a lista e tente novamente.' });
  const token = app.jwt.sign({ sub: invite.id, organizationId: request.user.organizationId, role: body.role, purpose: 'team-invite', inviteVersion }, { expiresIn: '48h' });
  const appOrigin = env.APP_ORIGIN.split(',')[0]!.trim().replace(/\/+$/, '');
  return reply.code(201).send({ data: invite, inviteUrl: `${appOrigin}/#invite=${encodeURIComponent(token)}`, expiresInHours: 48 });
});

app.post('/api/team/users/:id/deactivate', { preHandler: app.authenticate }, async (request, reply) => {
  if (request.user.role !== 'owner') return reply.code(403).send({ error: 'owner_required', message: 'Somente a pessoa proprietaria pode suspender acessos.' });
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Usuario invalido.' });
  if (params.data.id === request.user.sub) return reply.code(409).send({ error: 'cannot_deactivate_self', message: 'A conta proprietaria atual nao pode suspender o proprio acesso.' });
  const [updated] = await db.update(users).set({ active: false, inviteVersion: sql`${users.inviteVersion} + 1`, sessionVersion: sql`${users.sessionVersion} + 1` }).where(and(eq(users.id, params.data.id), eq(users.organizationId, request.user.organizationId), sql`${users.role} <> 'owner'`)).returning({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active });
  if (!updated) return reply.code(404).send({ error: 'team_user_not_found', message: 'Usuario nao encontrado neste workspace.' });
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'team-user', entityId: updated.id, action: 'deactivated', payload: { email: updated.email } });
  return { data: updated };
});

app.post('/api/auth/accept-invite', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const body = parseBody(z.object({ token: z.string().min(30).max(4096), password: z.string().min(12).max(128) }).strict(), request.body, reply);
  if (!body) return;
  let claims: typeof request.user;
  try { claims = app.jwt.verify(body.token); }
  catch { return reply.code(400).send({ error: 'invite_invalid', message: 'O convite expirou ou nao e valido. Peça um novo convite a pessoa proprietaria.' }); }
  if (claims.purpose !== 'team-invite' || typeof claims.inviteVersion !== 'number' || claims.inviteVersion < 1 || !['admin', 'member'].includes(claims.role)) return reply.code(400).send({ error: 'invite_invalid', message: 'Este link nao e um convite de equipe valido.' });
  const inviteVersion = claims.inviteVersion;
  const passwordHash = await argon2.hash(body.password);
  const activated = await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(and(eq(users.id, claims.sub), eq(users.organizationId, claims.organizationId), eq(users.active, false), eq(users.role, claims.role), eq(users.inviteVersion, inviteVersion))).limit(1);
    if (!user) return undefined;
    const [updated] = await tx.update(users).set({ passwordHash, active: true }).where(and(eq(users.id, user.id), eq(users.active, false), eq(users.inviteVersion, inviteVersion))).returning({ id: users.id, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId, permissions: users.permissions, sessionVersion: users.sessionVersion });
    if (updated) await tx.insert(activityEvents).values({ organizationId: user.organizationId, actorUserId: user.id, entityType: 'team-user', entityId: user.id, action: 'invite_accepted', payload: { role: user.role } });
    return updated;
  });
  if (!activated) return reply.code(409).send({ error: 'invite_already_used', message: 'Este convite ja foi usado, revogado ou substituido.' });
  const sessionPolicy = workspaceSessionPolicy();
  const token = app.jwt.sign({ sub: activated.id, organizationId: activated.organizationId, role: activated.role, sessionVersion: activated.sessionVersion, rememberMe: true }, { expiresIn: sessionPolicy.expiresIn });
  reply.setCookie('nexo_session', token, workspaceSessionCookieOptions(sessionPolicy.maxAge, process.env.NODE_ENV === 'production'));
  const [organization] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, activated.organizationId)).limit(1);
  return { user: activated, organization };
});

app.post('/api/auth/login', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const body = parseBody(loginSchema, request.body, reply); if (!body) return;
  const [user] = await db.select().from(users).where(and(
    sql`lower(${users.email}) = ${body.email}`, eq(users.active, true), or(sql`lower(${users.email}) = ${env.OWNER_EMAIL}`, and(sql`${users.role} IN ('admin', 'member')`, sql`${users.inviteVersion} > 0`)),
  )).limit(1);
  if (!user || !(await argon2.verify(user.passwordHash, body.password))) return reply.code(401).send({ error: 'invalid_credentials', message: 'E-mail ou senha incorretos.' });
  if ((user.role === 'owner' && (user.id !== ownerAccountId || user.email.toLowerCase() !== env.OWNER_EMAIL)) || (user.role !== 'owner' && user.inviteVersion < 1)) return reply.code(401).send({ error: 'invalid_credentials', message: 'E-mail ou senha incorretos.' });
  const sessionPolicy = workspaceSessionPolicy(body.rememberMe);
  const token = app.jwt.sign({ sub: user.id, organizationId: user.organizationId, role: user.role, sessionVersion: user.sessionVersion, rememberMe: body.rememberMe }, { expiresIn: sessionPolicy.expiresIn });
  reply.setCookie('nexo_session', token, workspaceSessionCookieOptions(sessionPolicy.maxAge, process.env.NODE_ENV === 'production'));
  const [organization] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId, permissions: user.permissions }, organization };
});

const passwordResetRequestSchema = z.object({ email: z.string().trim().email().max(254).transform(normalizeAccountEmail) }).strict();
const passwordResetSchema = z.object({ token: z.string().min(40).max(128), password: z.string().min(12).max(128) }).strict();
const passwordResetMessage = 'Se o e-mail pertencer a uma conta ativa e a recuperação estiver funcionando, enviaremos as instrucoes. Caso não receba, contate a pessoa administradora do workspace.';

app.post('/api/auth/password-reset/request', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const body = parseBody(passwordResetRequestSchema, request.body, reply); if (!body) return;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  // This check is independent of the submitted address, so it cannot be used
  // to enumerate accounts. Do not report success when delivery is impossible.
  const delivery = passwordResetDeliveryReadiness(apiKey, from);
  if (delivery.statusCode !== 202) return reply.code(delivery.statusCode).send({ error: delivery.error, message: delivery.message });
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(sql`lower(${users.email}) = ${body.email}`, eq(users.active, true))).limit(1);
  if (!user) return reply.code(202).send({ message: passwordResetMessage });

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await tx.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });
  });
  const resetUrl = new URL('/', allowedOrigins[0]);
  resetUrl.hash = new URLSearchParams({ reset: rawToken }).toString();
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `focusshub-password-reset-${tokenHash}` },
      body: JSON.stringify({
        from, to: [user.email], subject: 'Redefina sua senha do Focusshub',
        text: `Ola, ${user.name}. Use este link para criar uma nova senha. Ele expira em 30 minutos e pode ser usado uma vez: ${resetUrl.toString()} Se voce nao solicitou, ignore este e-mail.`,
        html: `<p>Olá, ${escapeHtml(user.name)}.</p><p>Use o link abaixo para criar uma nova senha. Ele expira em 30 minutos e pode ser usado uma vez.</p><p><a href="${resetUrl.toString()}">Redefinir senha</a></p><p>Se você não solicitou, ignore este e-mail.</p>`,
      }), signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error('password_reset_email_failed');
  } catch {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
    request.log.warn('Password reset email could not be delivered.');
  }
  return reply.code(202).send({ message: passwordResetMessage });
});

app.post('/api/auth/password-reset/complete', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const body = parseBody(passwordResetSchema, request.body, reply); if (!body) return;
  const tokenHash = createHash('sha256').update(body.token).digest('hex');
  const passwordHash = await argon2.hash(body.password);
  const reset = await db.transaction(async (tx) => {
    const [entry] = await tx.select().from(passwordResetTokens).where(and(
      eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), sql`${passwordResetTokens.expiresAt} > now()`,
    )).limit(1);
    if (!entry) return undefined;
    const [consumed] = await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.id, entry.id), isNull(passwordResetTokens.usedAt), sql`${passwordResetTokens.expiresAt} > now()`)).returning({ id: passwordResetTokens.id });
    if (!consumed) return undefined;
    const [user] = await tx.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` }).where(and(eq(users.id, entry.userId), eq(users.active, true))).returning({ id: users.id, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId, permissions: users.permissions, sessionVersion: users.sessionVersion });
    if (!user) return undefined;
    await tx.delete(passwordResetTokens).where(and(eq(passwordResetTokens.userId, entry.userId), sql`${passwordResetTokens.id} <> ${entry.id}`));
    return user;
  });
  if (!reset) return reply.code(400).send({ error: 'password_reset_invalid', message: 'Este link expirou ou ja foi utilizado. Solicite outro.' });
  const sessionPolicy = workspaceSessionPolicy();
  const sessionToken = app.jwt.sign({ sub: reset.id, organizationId: reset.organizationId, role: reset.role, sessionVersion: reset.sessionVersion, rememberMe: true }, { expiresIn: sessionPolicy.expiresIn });
  reply.setCookie('nexo_session', sessionToken, workspaceSessionCookieOptions(sessionPolicy.maxAge, process.env.NODE_ENV === 'production'));
  const [organization] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, reset.organizationId)).limit(1);
  return { user: { id: reset.id, name: reset.name, email: reset.email, role: reset.role, organizationId: reset.organizationId, permissions: reset.permissions }, organization };
});

app.post('/api/auth/logout', async (_request, reply) => {
  reply.clearCookie('nexo_session', workspaceSessionCookieOptions(0, process.env.NODE_ENV === 'production'));
  return reply.code(204).send();
});

app.get('/api/auth/me', { preHandler: app.authenticate }, async (request, reply) => {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId, permissions: users.permissions }).from(users).where(and(eq(users.id, request.user.sub), eq(users.organizationId, request.user.organizationId), eq(users.active, true))).limit(1);
  if (!user) return reply.code(401).send({ error: 'unauthorized', message: 'Conta indisponível.' });
  const [organization] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
  return { user, organization };
});

app.get('/api/billing/payment-methods', { preHandler: app.authenticate }, async (request, reply) => {
  if (!await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Mercado Pago está desconectado no Focusshub. Reative em Integrações para usar pagamentos.' });
  try {
    const methods = await mercadoPago<Array<Record<string, unknown>>>(request.user.organizationId, '/v1/payment_methods');
    return { data: methods.filter((method) => method.status === 'active').map((method) => ({ id: method.id, name: method.name, paymentType: method.payment_type_id, thumbnail: method.secure_thumbnail ?? method.thumbnail })) };
  } catch (error) {
    if (error instanceof Error && error.message === 'mercadopago_not_configured') return reply.code(503).send({ error: 'payment_provider_unavailable', message: 'Mercado Pago ainda não está configurado no servidor.' });
    return reply.code(502).send({ error: 'payment_methods_unavailable', message: 'Não foi possível consultar os meios de pagamento da conta.' });
  }
});

const notificationRoutes: Record<string, string> = {
  inbox: 'Caixa de entrada',
  leads: 'Leads', clients: 'Clientes', client: 'Clientes', proposals: 'Propostas', contracts: 'Contratos', projects: 'Projetos',
  tasks: 'Tarefas', events: 'Agenda', tickets: 'Tickets', approvals: 'Aprovações',
  billing_order: 'Cobranças', billing_subscription: 'Assinaturas',
};
const notificationLabels: Record<string, string> = {
  inbox: 'mensagem WhatsApp',
  leads: 'lead', clients: 'cliente', client: 'cliente', proposals: 'proposta', contracts: 'contrato', projects: 'projeto',
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
  let visibleRows = rows.filter((event) => {
    const path = notificationAccessPath(event.entityType);
    return Boolean(path && isWorkspaceRequestAllowed(request.user.role, 'GET', path, request.user.permissions));
  });
  const scope = request.user.permissions?.scope;
  if (scope?.mode === 'selected') {
    const billingClientIds = await billingClientIdsForScope(request.user.organizationId, scope) || [];
    const workspaceGroups = new Map<string, Set<string>>();
    for (const event of visibleRows) {
      if (!event.entityId) continue;
      const resource = event.entityType === 'client' ? '' : event.entityType;
      if (resource === 'clients' || resource === 'projects' || clientLinkedWorkspaceResources.includes(resource as typeof clientLinkedWorkspaceResources[number])) {
        if (!workspaceGroups.has(resource)) workspaceGroups.set(resource, new Set());
        workspaceGroups.get(resource)!.add(event.entityId);
      }
    }
    const workspaceRows = await Promise.all([...workspaceGroups].map(async ([resource, ids]) => {
      const records = await db.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, resource),
        inArray(workspaceRecords.id, [...ids]),
      ));
      return [resource, new Map(records.map((record) => [record.id, record]))] as const;
    }));
    const scopedRecords = new Map(workspaceRows);
    const orderIds = visibleRows.filter((event) => event.entityType === 'billing_order').map((event) => event.entityId).filter((id): id is string => Boolean(id));
    const subscriptionIds = visibleRows.filter((event) => event.entityType === 'billing_subscription').map((event) => event.entityId).filter((id): id is string => Boolean(id));
    const [orders, subscriptions] = await Promise.all([
      orderIds.length ? db.select({ id: billingOrders.id, workspaceClientId: billingOrders.workspaceClientId }).from(billingOrders).where(and(eq(billingOrders.organizationId, request.user.organizationId), inArray(billingOrders.id, orderIds))) : Promise.resolve([]),
      subscriptionIds.length ? db.select({ id: billingSubscriptions.id, workspaceClientId: billingSubscriptions.workspaceClientId }).from(billingSubscriptions).where(and(eq(billingSubscriptions.organizationId, request.user.organizationId), inArray(billingSubscriptions.id, subscriptionIds))) : Promise.resolve([]),
    ]);
    const billingClients = new Map([...orders, ...subscriptions].map((record) => [record.id, record.workspaceClientId]));
    visibleRows = visibleRows.filter((event) => {
      if (!event.entityId) return false;
      if (event.entityType === 'client') return false;
      if (event.entityType === 'billing_order' || event.entityType === 'billing_subscription') return billingClientIds.includes(String(billingClients.get(event.entityId) || ''));
      const resource = event.entityType;
      if (resource === 'clients' || resource === 'projects' || clientLinkedWorkspaceResources.includes(resource as typeof clientLinkedWorkspaceResources[number])) {
        const record = scopedRecords.get(resource)?.get(event.entityId);
        return Boolean(record && recordMatchesWorkspaceScope(resource, record.id, record.data, scope));
      }
      return true;
    });
  }
  const data = visibleRows.flatMap((event) => {
    const label = notificationLabels[event.entityType];
    const route = notificationRoutes[event.entityType];
    const title = resolveActivityNotificationTitle(event.entityType, event.action);
    if (!label || !route || !title) return [];
    const payload = event.payload as Record<string, unknown>;
    const subject = String(payload.label || payload.name || payload.title || '').trim();
    const amountDetail = typeof payload.amount === 'number' ? `R$ ${payload.amount.toFixed(2).replace('.', ',')}` : '';
    const statusDetail = typeof payload.status === 'string' ? `Status: ${payload.status}` : '';
    const recipientDetail = typeof payload.recipient === 'string' ? `Destinatário: ${payload.recipient}` : '';
    const detail = [subject, amountDetail, statusDetail, recipientDetail].filter(Boolean).join(' · ') || `${title}.`;
    return [{
      id: event.id, entityId: event.entityId, entityType: event.entityType, page: route,
      title,
      detail, createdAt: event.createdAt, unread: event.createdAt > readAt,
    }];
  });
  return { data, unreadCount: data.filter((item) => item.unread).length, readAt };
});

app.post('/api/notifications/read', { preHandler: app.authenticate }, async (request, reply) => {
  const body = parseBody(z.object({ notificationId: z.string().uuid().optional() }).strict(), request.body ?? {}, reply);
  if (!body) return;
  let readThrough = new Date();
  if (body.notificationId) {
    const [event] = await db.select({ createdAt: activityEvents.createdAt }).from(activityEvents).where(and(
      eq(activityEvents.id, body.notificationId), eq(activityEvents.organizationId, request.user.organizationId),
    )).limit(1);
    if (!event) return reply.code(404).send({ error: 'notification_not_found', message: 'A notificação não existe neste workspace.' });
    readThrough = event.createdAt;
  }
  const [owner] = await db.update(users).set({ notificationsReadAt: sql`GREATEST(${users.notificationsReadAt}, ${readThrough})` })
    .where(eq(users.id, request.user.sub)).returning({ readAt: users.notificationsReadAt });
  return { data: { readAt: owner?.readAt ?? readThrough } };
});

async function billingClientIdsForScope(organizationId: string, scope?: WorkspaceRecordScope | null) {
  if (!scope || scope.mode !== 'selected') return null;
  let projects: Array<{ id: string; data: Record<string, unknown> }> = [];
  if (scope.projectIds.length) {
    projects = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, organizationId), eq(workspaceRecords.resource, 'projects'), isNull(workspaceRecords.archivedAt),
      inArray(workspaceRecords.id, scope.projectIds),
    ));
  }
  return billingClientIdsForWorkspaceScope(scope, projects);
}

function billingClientScopeWhere(clientColumn: typeof billingOrders.workspaceClientId | typeof billingSubscriptions.workspaceClientId, clientIds: string[] | null) {
  if (clientIds === null) return undefined;
  return clientIds.length ? inArray(clientColumn, clientIds) : sql`false`;
}

app.get('/api/billing/orders', { preHandler: app.authenticate }, async (request, reply) => {
  const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100), offset: z.coerce.number().int().min(0).default(0) }).safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid billing pagination.' });
  const clientIds = await billingClientIdsForScope(request.user.organizationId, request.user.permissions?.scope);
  const where = and(eq(billingOrders.organizationId, request.user.organizationId), billingClientScopeWhere(billingOrders.workspaceClientId, clientIds));
  const [rows, count] = await Promise.all([
    db.select().from(billingOrders).where(where).orderBy(desc(billingOrders.createdAt)).limit(query.data.limit).offset(query.data.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(billingOrders).where(where),
  ]);
  return { data: rows, pagination: { ...query.data, total: count[0]?.count ?? 0 } };
});

app.post('/api/billing/orders', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(paymentOrderSchema, request.body, reply); if (!body) return;
  const scopedClientIds = await billingClientIdsForScope(request.user.organizationId, request.user.permissions?.scope);
  if (scopedClientIds && (!body.workspaceClientId || !scopedClientIds.includes(body.workspaceClientId))) return reply.code(403).send({ error: 'record_scope_denied', message: 'Selecione um cliente atribuido ao seu escopo antes de criar a cobranca.' });
  const [preferenceRecord] = await db.select({ data: workspaceRecords.data }).from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'settings'),
    sql`${workspaceRecords.data} ->> 'key' = 'workspace-preferences'`,
  )).limit(1);
  const savedSettings = preferenceRecord?.data && typeof preferenceRecord.data === 'object' ? preferenceRecord.data as Record<string, unknown> : null;
  const billingSettings = savedSettings?.settings && typeof savedSettings.settings === 'object'
    ? (savedSettings.settings as Record<string, unknown>).billing
    : undefined;
  if (!billingMethodPreferenceAllows(body.method, billingSettings)) return reply.code(409).send({ error: 'payment_method_disabled', message: 'Este meio de pagamento está desativado nas Configurações financeiras.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Mercado Pago está desconectado no Focusshub. Reative em Integrações para usar pagamentos.' });
  if (!await getMercadoPagoTokens(request.user.organizationId) && !await legacyMercadoPagoTokenIsSafeFor(request.user.organizationId)) return reply.code(503).send({ error: 'payment_provider_unavailable', message: 'Autorize a conta Mercado Pago deste workspace em Integrações antes de criar cobranças.' });
  const sellerTokens = await getMercadoPagoTokens(request.user.organizationId);
  if (body.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, body.clientId), eq(clients.organizationId, request.user.organizationId))).limit(1);
    if (!client) return reply.code(404).send({ error: 'client_not_found', message: 'Cliente não encontrado nesta empresa.' });
  }
  if (body.workspaceClientId) {
    const [client] = await db.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(eq(workspaceRecords.id, body.workspaceClientId), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt))).limit(1);
    if (!client) return reply.code(404).send({ error: 'workspace_client_not_found', message: 'O cliente selecionado não existe nesta agência.' });
  }
  const [invoice] = await db.insert(billingOrders).values({
    organizationId: request.user.organizationId, clientId: body.clientId, workspaceClientId: body.workspaceClientId, createdBy: request.user.sub,
    mercadoPagoAccountId: sellerTokens?.accountId ?? null,
    clientName: body.clientName, payerEmail: body.payerEmail, description: body.description,
    amount: body.amount, method: body.method, status: 'creating',
  }).returning();
  const paymentType = body.method === 'pix' ? 'bank_transfer' : body.method === 'boleto' ? 'ticket' : body.method;
  const requestedDue = body.dueDate ? paymentDueDateDuration(body.dueDate) : null;
  const paymentMethod: Record<string, unknown> = body.method === 'pix'
    ? { id: 'pix', type: paymentType }
    : body.method === 'boleto'
      ? { id: 'boleto', type: paymentType }
      : { id: body.paymentMethodId, type: paymentType, token: body.cardToken, installments: body.installments };
  const payer: Record<string, unknown> = { email: body.payerEmail, first_name: body.clientName };
  if (body.identificationType && body.identificationNumber) payer.identification = { type: body.identificationType, number: body.identificationNumber.replace(/\D/g, '') };
  if (body.address) payer.address = { zip_code: body.address.zipCode, street_name: body.address.streetName, street_number: body.address.streetNumber, neighborhood: body.address.neighborhood, city: body.address.city, state: body.address.state.toUpperCase() };
  try {
    const order = await mercadoPago<Record<string, any>>(request.user.organizationId, '/v1/orders', {
      method: 'POST', headers: { 'X-Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        type: 'online', external_reference: invoice!.id, processing_mode: 'automatic',
        total_amount: body.amount.toFixed(2), description: body.description, payer,
        transactions: { payments: [{ amount: body.amount.toFixed(2), payment_method: paymentMethod, ...(body.method === 'pix' ? { expiration_time: requestedDue?.duration || 'PT24H' } : {}), ...(body.method === 'boleto' ? { expiration_time: requestedDue?.duration || 'P5D' } : {}) }] },
      }),
    });
    const details = paymentDetailsFromOrder(order);
    const status = providerStatus(details.status);
    const updatedAt = new Date();
    const paymentDetails = withStableBillingPaidAt('creating', status, {}, details, invoice!.updatedAt, updatedAt);
    const [saved] = await db.update(billingOrders).set({
      mpOrderId: details.orderId, mpPaymentId: details.paymentId, status, statusDetail: details.statusDetail,
      paymentDetails, dueAt: details.expirationAt ? new Date(details.expirationAt) : body.dueDate ? paymentDueDateAtEndOfDay(body.dueDate) : null, updatedAt,
    }).where(eq(billingOrders.id, invoice!.id)).returning();
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'billing_order', entityId: invoice!.id, action: 'created', payload: { method: body.method, amount: body.amount } });
    return reply.code(201).send({ data: saved });
  } catch (error) {
    await db.update(billingOrders).set({ status: 'failed', updatedAt: new Date() }).where(eq(billingOrders.id, invoice!.id));
    if (error instanceof Error && error.message === 'mercadopago_not_configured') return reply.code(503).send({ error: 'payment_provider_unavailable', message: 'Mercado Pago ainda não está configurado no servidor.' });
    return reply.code(502).send({ error: 'payment_creation_failed', message: 'O Mercado Pago não conseguiu criar esta cobrança. Confira os dados e tente novamente.' });
  }
});

app.post('/api/billing/orders/:id/cancel', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de cobrança inválido.' });
  const [order] = await db.select().from(billingOrders).where(and(
    eq(billingOrders.id, params.data.id), eq(billingOrders.organizationId, request.user.organizationId),
  )).limit(1);
  if (!order) return reply.code(404).send({ error: 'not_found', message: 'Cobrança não encontrada.' });
  const scopedClientIds = await billingClientIdsForScope(request.user.organizationId, request.user.permissions?.scope);
  if (scopedClientIds && (!order.workspaceClientId || !scopedClientIds.includes(order.workspaceClientId))) return reply.code(404).send({ error: 'not_found', message: 'Cobrança não encontrada.' });
  const providerDetails = order.paymentDetails && typeof order.paymentDetails === 'object' ? order.paymentDetails : {};
  if (['cancelled', 'canceled'].includes(order.status)) return { data: order, alreadyCanceled: true };
  if (!isBillingOrderCancelable(order.status, providerDetails.status)) return reply.code(409).send({ error: 'order_not_cancelable', message: 'O Mercado Pago só permite cancelar uma cobrança que ainda não foi paga e permanece aberta.' });
  if (!order.mpOrderId || !await mercadoPagoRecordBelongsToCurrentAccount(request.user.organizationId, order.mercadoPagoAccountId) || !await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'payment_provider_unavailable', message: 'A cobrança pertence a outra conta vendedora ou a conta atual não está conectada. A cobrança não foi alterada.' });
  try {
    const canceledOrder = await mercadoPago<Record<string, any>>(request.user.organizationId, `/v1/orders/${encodeURIComponent(order.mpOrderId)}/cancel`, {
      method: 'POST', headers: { 'X-Idempotency-Key': randomUUID() },
    });
    const details = paymentDetailsFromOrder(canceledOrder);
    const [saved] = await db.update(billingOrders).set({
      status: providerStatus(details.status), statusDetail: details.statusDetail || 'canceled_by_workspace',
      paymentDetails: details, updatedAt: new Date(),
    }).where(eq(billingOrders.id, order.id)).returning();
    await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'billing_order', entityId: order.id, action: 'canceled', payload: { method: order.method, amount: order.amount } });
    return { data: saved };
  } catch {
    return reply.code(502).send({ error: 'payment_cancellation_failed', message: 'O Mercado Pago não confirmou o cancelamento. A cobrança continua ativa; atualize o status antes de tentar novamente.' });
  }
});

app.post('/api/billing/orders/:id/refresh', { preHandler: app.authenticate, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de cobrança inválido.' });
  const [order] = await db.select().from(billingOrders).where(and(
    eq(billingOrders.id, params.data.id), eq(billingOrders.organizationId, request.user.organizationId),
  )).limit(1);
  if (!order) return reply.code(404).send({ error: 'not_found', message: 'Cobrança não encontrada.' });
  const scopedClientIds = await billingClientIdsForScope(request.user.organizationId, request.user.permissions?.scope);
  if (scopedClientIds && (!order.workspaceClientId || !scopedClientIds.includes(order.workspaceClientId))) return reply.code(404).send({ error: 'not_found', message: 'Cobrança não encontrada.' });
  if (!order.mpOrderId || !await mercadoPagoRecordBelongsToCurrentAccount(request.user.organizationId, order.mercadoPagoAccountId) || !await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'payment_provider_unavailable', message: 'A cobrança pertence a outra conta vendedora ou a conta atual não está conectada.' });
  try {
    const remoteOrder = await mercadoPago<Record<string, any>>(request.user.organizationId, `/v1/orders/${encodeURIComponent(order.mpOrderId)}`);
    const details = paymentDetailsFromOrder(remoteOrder);
    const status = providerStatus(details.status);
    const updatedAt = new Date();
    const paymentDetails = withStableBillingPaidAt(order.status, status, order.paymentDetails, details, order.updatedAt, updatedAt);
    const changed = !sameMercadoPagoPaymentSnapshot(
      { status: order.status, statusDetail: order.statusDetail, paymentId: order.mpPaymentId },
      { status, statusDetail: details.statusDetail, paymentId: details.paymentId },
    );
    const [saved] = await db.update(billingOrders).set({
      status, statusDetail: details.statusDetail, mpPaymentId: details.paymentId,
      paymentDetails, dueAt: details.expirationAt ? new Date(details.expirationAt) : order.dueAt, updatedAt,
    }).where(eq(billingOrders.id, order.id)).returning();
    if (changed) {
      await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'billing_order', entityId: order.id, action: 'provider_updated', payload: { status } });
      if (status === 'paid' && order.status !== 'paid') await enqueueN8nEvent(request.user.organizationId, 'payment.confirmed', { id: order.id, title: order.description, client: order.clientName, amount: order.amount });
    }
    return { data: saved, changed };
  } catch {
    return reply.code(502).send({ error: 'payment_status_refresh_failed', message: 'O Mercado Pago não respondeu. O status salvo foi mantido.' });
  }
});

app.get('/api/billing/subscriptions', { preHandler: app.authenticate }, async (request, reply) => {
  const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100), offset: z.coerce.number().int().min(0).default(0) }).safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid subscription pagination.' });
  const clientIds = await billingClientIdsForScope(request.user.organizationId, request.user.permissions?.scope);
  const where = and(eq(billingSubscriptions.organizationId, request.user.organizationId), billingClientScopeWhere(billingSubscriptions.workspaceClientId, clientIds));
  const [rows, count] = await Promise.all([
    db.select().from(billingSubscriptions).where(where).orderBy(desc(billingSubscriptions.createdAt)).limit(query.data.limit).offset(query.data.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(billingSubscriptions).where(where),
  ]);
  return { data: rows, pagination: { ...query.data, total: count[0]?.count ?? 0 } };
});

app.post('/api/billing/subscriptions', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = parseBody(subscriptionSchema, request.body, reply); if (!body) return;
  const scopedClientIds = await billingClientIdsForScope(request.user.organizationId, request.user.permissions?.scope);
  if (scopedClientIds && (!body.workspaceClientId || !scopedClientIds.includes(body.workspaceClientId))) return reply.code(403).send({ error: 'record_scope_denied', message: 'Selecione um cliente atribuido ao seu escopo antes de criar a assinatura.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Mercado Pago está desconectado no Focusshub. Reative em Integrações para usar assinaturas.' });
  if (!await getMercadoPagoTokens(request.user.organizationId) && !await legacyMercadoPagoTokenIsSafeFor(request.user.organizationId)) return reply.code(503).send({ error: 'payment_provider_unavailable', message: 'Autorize a conta Mercado Pago deste workspace em Integrações antes de criar assinaturas.' });
  const sellerTokens = await getMercadoPagoTokens(request.user.organizationId);
  if (body.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, body.clientId), eq(clients.organizationId, request.user.organizationId))).limit(1);
    if (!client) return reply.code(404).send({ error: 'client_not_found', message: 'Cliente não encontrado nesta empresa.' });
  }
  if (body.workspaceClientId) {
    const [client] = await db.select({ id: workspaceRecords.id }).from(workspaceRecords).where(and(eq(workspaceRecords.id, body.workspaceClientId), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt))).limit(1);
    if (!client) return reply.code(404).send({ error: 'workspace_client_not_found', message: 'O cliente selecionado não existe nesta agência.' });
  }
  const [subscription] = await db.insert(billingSubscriptions).values({
    organizationId: request.user.organizationId, clientId: body.clientId, workspaceClientId: body.workspaceClientId, createdBy: request.user.sub,
    mercadoPagoAccountId: sellerTokens?.accountId ?? null,
    clientName: body.clientName, payerEmail: body.payerEmail, description: body.description,
    amount: body.amount, frequency: body.frequency, frequencyInterval: body.frequencyInterval, status: 'creating',
  }).returning();
  try {
    const result = await mercadoPago<Record<string, any>>(request.user.organizationId, '/preapproval', {
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
      status: String(result.status ?? 'pending'), nextPaymentAt: result.next_payment_date ? new Date(String(result.next_payment_date)) : body.startAt ? new Date(body.startAt) : null,
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
  const scopedClientIds = await billingClientIdsForScope(request.user.organizationId, request.user.permissions?.scope);
  if (scopedClientIds && (!subscription.workspaceClientId || !scopedClientIds.includes(subscription.workspaceClientId))) return reply.code(404).send({ error: 'not_found', message: 'Assinatura não encontrada.' });
  if (!await mercadoPagoRecordBelongsToCurrentAccount(request.user.organizationId, subscription.mercadoPagoAccountId)) return reply.code(409).send({ error: 'payment_provider_account_mismatch', message: 'Esta assinatura pertence a outra conta vendedora e não foi alterada.' });
  const currentStatus = normalizeBillingSubscriptionStatus(subscription.status);
  if (!canTransitionBillingSubscription(subscription.status, body.status)) return reply.code(409).send({ error: 'subscription_status_transition_invalid', message: 'Esta assinatura não pode mudar para esse status. Confira o estado atual antes de tentar novamente.' });
  if (currentStatus === body.status) return { data: subscription, unchanged: true };
  if (!subscription.mpSubscriptionId) return reply.code(409).send({ error: 'subscription_not_started', message: 'A assinatura ainda não foi criada no Mercado Pago.' });
  if (!await isIntegrationEnabled(request.user.organizationId, 'mercadopago')) return reply.code(409).send({ error: 'integration_disconnected', message: 'Mercado Pago está desconectado no Focusshub.' });
  try {
    await mercadoPago(request.user.organizationId, `/preapproval/${encodeURIComponent(subscription.mpSubscriptionId)}`, { method: 'PUT', body: JSON.stringify({ status: body.status }) });
    const [saved] = await db.update(billingSubscriptions).set({ status: body.status, updatedAt: new Date() }).where(eq(billingSubscriptions.id, subscription.id)).returning();
    await db.insert(activityEvents).values({
      organizationId: request.user.organizationId, actorUserId: request.user.sub,
      entityType: 'billing_subscription', entityId: subscription.id, action: 'updated',
      payload: { status: body.status, amount: subscription.amount, label: subscription.description },
    });
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
  const topic = query.success ? query.data.type ?? query.data.topic : body.success ? body.data.type : undefined;
  if (!resourceId) return reply.code(200).send({ received: true });
  try {
    if (mercadoPagoWebhookResource(topic) === 'order') {
      const [local] = await db.select({ id: billingOrders.id, organizationId: billingOrders.organizationId, mercadoPagoAccountId: billingOrders.mercadoPagoAccountId, status: billingOrders.status, statusDetail: billingOrders.statusDetail, mpPaymentId: billingOrders.mpPaymentId, paymentDetails: billingOrders.paymentDetails, updatedAt: billingOrders.updatedAt, description: billingOrders.description, clientName: billingOrders.clientName, amount: billingOrders.amount }).from(billingOrders).where(eq(billingOrders.mpOrderId, resourceId)).limit(1);
      if (!local || !await mercadoPagoRecordBelongsToCurrentAccount(local.organizationId, local.mercadoPagoAccountId)) return reply.code(200).send({ received: true });
      const order = await mercadoPago<Record<string, any>>(local.organizationId, `/v1/orders/${encodeURIComponent(resourceId)}`);
      const externalReference = String(order.external_reference ?? '');
      const details = paymentDetailsFromOrder(order);
      if (matchesMercadoPagoExternalReference(externalReference, local.id)) {
        const nextStatus = providerStatus(details.status);
        const duplicateSnapshot = sameMercadoPagoPaymentSnapshot(
          { status: local.status, statusDetail: local.statusDetail, paymentId: local.mpPaymentId },
          { status: nextStatus, statusDetail: details.statusDetail, paymentId: details.paymentId },
        );
        const needsPaidDateBackfill = nextStatus === 'paid' && typeof local.paymentDetails?.paidAt !== 'string';
        if (!duplicateSnapshot || needsPaidDateBackfill) {
          const updatedAt = new Date();
          const paymentDetails = withStableBillingPaidAt(local.status, nextStatus, local.paymentDetails, details, local.updatedAt, updatedAt);
          await db.update(billingOrders).set({ status: nextStatus, statusDetail: details.statusDetail, mpPaymentId: details.paymentId, paymentDetails, updatedAt }).where(eq(billingOrders.id, local.id));
          if (!duplicateSnapshot) {
            await db.insert(activityEvents).values({ organizationId: local.organizationId, entityType: 'billing_order', entityId: local.id, action: 'provider_updated', payload: { status: nextStatus } });
            if (nextStatus === 'paid' && local.status !== 'paid') await enqueueN8nEvent(local.organizationId, 'payment.confirmed', { id: local.id, title: local.description, client: local.clientName, amount: local.amount });
          }
        }
      }
    } else if (mercadoPagoWebhookResource(topic) === 'subscription') {
      const [local] = await db.select({ id: billingSubscriptions.id, organizationId: billingSubscriptions.organizationId, mercadoPagoAccountId: billingSubscriptions.mercadoPagoAccountId }).from(billingSubscriptions).where(eq(billingSubscriptions.mpSubscriptionId, resourceId)).limit(1);
      if (!local || !await mercadoPagoRecordBelongsToCurrentAccount(local.organizationId, local.mercadoPagoAccountId)) return reply.code(200).send({ received: true });
      const remote = await mercadoPago<Record<string, any>>(local.organizationId, `/preapproval/${encodeURIComponent(resourceId)}`);
      if (matchesMercadoPagoExternalReference(remote.external_reference, local.id)) await db.update(billingSubscriptions).set({ status: String(remote.status ?? 'pending'), nextPaymentAt: remote.next_payment_date ? new Date(String(remote.next_payment_date)) : null, updatedAt: new Date() }).where(eq(billingSubscriptions.id, local.id));
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

app.get('/api/workspace/backup', { preHandler: app.authenticate, config: { rateLimit: { max: 4, timeWindow: '1 minute' } } }, async (request, reply) => {
  if (request.user.role !== 'owner') return reply.code(403).send({ error: 'forbidden', message: 'Somente a conta proprietaria pode exportar o backup do workspace.' });
  const [recordRows, clientRows, orderRows, subscriptionRows] = await Promise.all([
    db.select().from(workspaceRecords).where(eq(workspaceRecords.organizationId, request.user.organizationId)).orderBy(asc(workspaceRecords.createdAt)),
    db.select().from(clients).where(eq(clients.organizationId, request.user.organizationId)).orderBy(asc(clients.createdAt)),
    db.select().from(billingOrders).where(eq(billingOrders.organizationId, request.user.organizationId)).orderBy(asc(billingOrders.createdAt)),
    db.select().from(billingSubscriptions).where(eq(billingSubscriptions.organizationId, request.user.organizationId)).orderBy(asc(billingSubscriptions.createdAt)),
  ]);
  const backup = buildWorkspaceBackup({ organizationId: request.user.organizationId, records: recordRows, clients: clientRows, billingOrders: orderRows, billingSubscriptions: subscriptionRows });
  const serialized = JSON.stringify(backup);
  if (Buffer.byteLength(serialized, 'utf8') > 25 * 1024 * 1024) return reply.code(413).send({ error: 'backup_too_large', message: 'O backup excede 25 MB; solicite uma exportacao administrativa do banco.' });
  const date = new Date().toISOString().slice(0, 10);
  return reply.header('Content-Type', 'application/json; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="nexo-workspace-${date}.json"`)
    .send(backup);
});

app.post('/api/workspace/backup/restore', { preHandler: app.authenticate, bodyLimit: 26 * 1024 * 1024, config: { rateLimit: { max: 2, timeWindow: '1 minute' } } }, async (request, reply) => {
  if (request.user.role !== 'owner') return reply.code(403).send({ error: 'forbidden', message: 'Somente a conta proprietaria pode restaurar o workspace.' });
  let backup;
  try { backup = parseWorkspaceBackup(request.body, request.user.organizationId); }
  catch (error) { return reply.code(400).send({ error: 'invalid_backup', message: error instanceof Error ? error.message : 'O arquivo de backup e invalido.' }); }

  try {
    const result = await db.transaction(async (tx) => {
      const counts = { recordsCreated: 0, recordsUpdated: 0, clientsCreated: 0, clientsUpdated: 0, ordersCreated: 0, ordersUpdated: 0, overdueRemindersSuppressed: 0, subscriptionsCreated: 0, subscriptionsUpdated: 0 };
      for (const row of backup.records) {
        const [existing] = await tx.select({ id: workspaceRecords.id, resource: workspaceRecords.resource }).from(workspaceRecords).where(and(eq(workspaceRecords.id, row.id), eq(workspaceRecords.organizationId, request.user.organizationId))).limit(1);
        if (existing && existing.resource !== row.resource) throw new Error('O backup conflita com o tipo de um registro existente.');
        const values = { data: row.data, updatedAt: new Date(row.updatedAt), archivedAt: row.archivedAt ? new Date(row.archivedAt) : null };
        if (existing) {
          await tx.update(workspaceRecords).set(values).where(and(eq(workspaceRecords.id, row.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
          counts.recordsUpdated += 1;
        } else {
          await tx.insert(workspaceRecords).values({ id: row.id, organizationId: request.user.organizationId, resource: row.resource, data: row.data, createdBy: request.user.sub, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt), archivedAt: row.archivedAt ? new Date(row.archivedAt) : null });
          counts.recordsCreated += 1;
        }
      }
      for (const row of backup.clients) {
        const [existing] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, row.id), eq(clients.organizationId, request.user.organizationId))).limit(1);
        const values = { name: row.name, legalName: row.legalName, contactName: row.contactName, email: row.email, phone: row.phone, document: row.document, status: row.status as 'active' | 'inactive' | 'archived', source: row.source, notes: row.notes, tags: row.tags, updatedAt: new Date(row.updatedAt), archivedAt: row.archivedAt ? new Date(row.archivedAt) : null };
        if (existing) { await tx.update(clients).set(values).where(and(eq(clients.id, row.id), eq(clients.organizationId, request.user.organizationId))); counts.clientsUpdated += 1; }
        else { await tx.insert(clients).values({ id: row.id, organizationId: request.user.organizationId, ...values, createdAt: new Date(row.createdAt) }); counts.clientsCreated += 1; }
      }
      for (const row of backup.billingOrders) {
        const [existing] = await tx.select({ id: billingOrders.id }).from(billingOrders).where(and(eq(billingOrders.id, row.id), eq(billingOrders.organizationId, request.user.organizationId))).limit(1);
        const values = { clientId: row.clientId, workspaceClientId: row.workspaceClientId, clientName: row.clientName, payerEmail: row.payerEmail, description: row.description, amount: row.amount, method: row.method, status: row.status, statusDetail: row.statusDetail, mpOrderId: row.mpOrderId, mpPaymentId: row.mpPaymentId, mercadoPagoAccountId: row.mercadoPagoAccountId ?? null, paymentDetails: row.paymentDetails, dueAt: row.dueAt ? new Date(row.dueAt) : null, updatedAt: new Date(row.updatedAt) };
        if (existing) { await tx.update(billingOrders).set(values).where(and(eq(billingOrders.id, row.id), eq(billingOrders.organizationId, request.user.organizationId))); counts.ordersUpdated += 1; }
        else { await tx.insert(billingOrders).values({ id: row.id, organizationId: request.user.organizationId, createdBy: request.user.sub, ...values, createdAt: new Date(row.createdAt) }); counts.ordersCreated += 1; }
      }
      const restoreTime = new Date();
      for (const row of backup.billingOrders.filter((item) => item.status === 'pending' && item.dueAt && new Date(item.dueAt) <= restoreTime)) {
        const [event] = await tx.select({ id: billingOverdueEvents.id, deliveredAt: billingOverdueEvents.deliveredAt, discardedAt: billingOverdueEvents.discardedAt }).from(billingOverdueEvents).where(eq(billingOverdueEvents.billingOrderId, row.id)).limit(1);
        if (event?.deliveredAt || event?.discardedAt) continue;
        if (event) await tx.update(billingOverdueEvents).set({ discardedAt: restoreTime, lastError: 'backup_restore_suppressed_overdue_replay', updatedAt: restoreTime }).where(eq(billingOverdueEvents.id, event.id));
        else await tx.insert(billingOverdueEvents).values({ organizationId: request.user.organizationId, billingOrderId: row.id, discardedAt: restoreTime, lastError: 'backup_restore_suppressed_overdue_replay', updatedAt: restoreTime });
        counts.overdueRemindersSuppressed += 1;
      }
      for (const row of backup.billingSubscriptions) {
        const [existing] = await tx.select({ id: billingSubscriptions.id }).from(billingSubscriptions).where(and(eq(billingSubscriptions.id, row.id), eq(billingSubscriptions.organizationId, request.user.organizationId))).limit(1);
        const values = { clientId: row.clientId, workspaceClientId: row.workspaceClientId, clientName: row.clientName, payerEmail: row.payerEmail, description: row.description, amount: row.amount, frequency: row.frequency, frequencyInterval: row.frequencyInterval, status: row.status, mpSubscriptionId: row.mpSubscriptionId, mercadoPagoAccountId: row.mercadoPagoAccountId ?? null, checkoutUrl: row.checkoutUrl, nextPaymentAt: row.nextPaymentAt ? new Date(row.nextPaymentAt) : null, updatedAt: new Date(row.updatedAt) };
        if (existing) { await tx.update(billingSubscriptions).set(values).where(and(eq(billingSubscriptions.id, row.id), eq(billingSubscriptions.organizationId, request.user.organizationId))); counts.subscriptionsUpdated += 1; }
        else { await tx.insert(billingSubscriptions).values({ id: row.id, organizationId: request.user.organizationId, createdBy: request.user.sub, ...values, createdAt: new Date(row.createdAt) }); counts.subscriptionsCreated += 1; }
      }
      await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'workspace', action: 'backup_restored', payload: counts });
      return counts;
    });
    return reply.send({ data: { ...result, excludedRecords: backup.excludedRecords } });
  } catch (error) {
    request.log.warn({ error: error instanceof Error ? error.name : 'unknown' }, 'Workspace backup restore failed');
    return reply.code(409).send({ error: 'backup_restore_conflict', message: 'A restauracao foi cancelada sem salvar alteracoes. Verifique os IDs e vinculos do backup ou use o suporte.' });
  }
});

app.get('/api/workspace/assignees', { preHandler: app.authenticate }, async (request) => {
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users)
    .where(and(eq(users.organizationId, request.user.organizationId), eq(users.active, true)))
    .orderBy(asc(users.name));
  return { data: rows };
});

app.get('/api/workspace/preferences', { preHandler: app.authenticate }, async (request) => {
  const [row] = await db.select({ data: workspaceRecords.data }).from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'settings'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'key' = 'workspace-preferences'`,
  )).limit(1);
  const record = row?.data as Record<string, unknown> | undefined;
  const settings = record?.settings && typeof record.settings === 'object' ? record.settings as Record<string, unknown> : {};
  const preferences = settings.preferences && typeof settings.preferences === 'object' ? settings.preferences as Record<string, unknown> : {};
  const workspace = settings.workspace && typeof settings.workspace === 'object' ? settings.workspace as Record<string, unknown> : {};
  const notifications = settings.notifications && typeof settings.notifications === 'object' ? settings.notifications : {};
  return { data: {
    compact: typeof preferences.compact === 'boolean' ? preferences.compact : undefined,
    darkMode: typeof preferences.darkMode === 'boolean' ? preferences.darkMode : undefined,
    showCompleted: typeof preferences.showCompleted === 'boolean' ? preferences.showCompleted : undefined,
    confirmDelete: typeof preferences.confirmDelete === 'boolean' ? preferences.confirmDelete : undefined,
    startPage: typeof preferences.startPage === 'string' ? preferences.startPage : undefined,
    timezone: normalizeCalendarTimeZone(workspace.timezone),
    weekStart: workspace.weekStart === 'sunday' ? 'sunday' : 'monday',
    notifications: normalizeBrowserNotificationPreferences(notifications),
  } };
});

function workspaceRecordScopeWhere(resource: string, scope?: WorkspaceRecordScope | null) {
  if (!scope || scope.mode !== 'selected') return undefined;
  const clientIds = scope.clientIds.map(String);
  const projectIds = scope.projectIds.map(String);
  const clientFields = ['clientId', 'workspaceClientId', 'clientRecordId'];
  const projectFields = ['projectId', 'sourceProjectId'];
  const clientConditions = clientIds.flatMap((id) => clientFields.map((field) => sql`${workspaceRecords.data}->>${field} = ${id}`));
  const projectConditions = projectIds.flatMap((id) => projectFields.map((field) => sql`${workspaceRecords.data}->>${field} = ${id}`));
  if (resource === 'clients') return clientIds.length ? inArray(workspaceRecords.id, clientIds) : sql`false`;
  if (resource === 'projects') return or(...(projectIds.length ? [inArray(workspaceRecords.id, projectIds)] : []), ...clientConditions) || sql`false`;
  if (clientLinkedWorkspaceResources.includes(resource as typeof clientLinkedWorkspaceResources[number])) return or(...clientConditions, ...projectConditions) || sql`false`;
  return undefined;
}

app.get('/api/workspace/:resource', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource }).safeParse(request.params);
  const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100), offset: z.coerce.number().int().min(0).default(0) }).safeParse(request.query);
  if (!params.success || !query.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso ou paginação inválidos.' });
  const where = and(eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource), isNull(workspaceRecords.archivedAt), workspaceRecordScopeWhere(params.data.resource, request.user.permissions?.scope));
  const [rows, count] = await Promise.all([
    db.select().from(workspaceRecords).where(where).orderBy(desc(workspaceRecords.updatedAt)).limit(query.data.limit).offset(query.data.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(workspaceRecords).where(where),
  ]);
  return { data: rows.map((row) => ({ ...row.data, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt })), pagination: { ...query.data, total: count[0]?.count ?? 0 } };
});

app.post('/api/workspace/proposals/:id/accept', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(z.object({
    contract: workspaceDataSchema,
    project: workspaceDataSchema,
    tasks: z.array(workspaceDataSchema).min(1).max(100),
  }), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador da proposta inválido.' });
  if (!body) return;
  if (typeof body.contract.documentText !== 'string' || !body.contract.documentText.trim() || typeof body.project.name !== 'string' || body.tasks.some((task) => typeof task.title !== 'string' || !String(task.title).trim())) {
    return reply.code(400).send({ error: 'validation_error', message: 'Contrato, projeto e tarefas precisam ter conteúdo válido.' });
  }

  const acceptedAt = new Date().toISOString();
  const result = await db.transaction(async (tx) => {
    const [proposal] = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId),
      eq(workspaceRecords.resource, 'proposals'), isNull(workspaceRecords.archivedAt),
    )).for('update').limit(1);
    if (!proposal) return { kind: 'missing' as const };
    if (!recordMatchesWorkspaceScope('proposals', proposal.id, proposal.data, request.user.permissions?.scope)) return { kind: 'missing' as const };

    const disposition = proposalAcceptanceDisposition(proposal.data.status);
    if (disposition === 'return_existing') {
      const [existingContract] = await tx.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'contracts'),
        isNull(workspaceRecords.archivedAt), sql`${workspaceRecords.data}->>'sourceProposalId' = ${proposal.id}`,
      )).limit(1);
      const [existingProject] = await tx.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'projects'),
        isNull(workspaceRecords.archivedAt), sql`${workspaceRecords.data}->>'sourceProposalId' = ${proposal.id}`,
      )).limit(1);
      const existingTasks = await tx.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'tasks'),
        isNull(workspaceRecords.archivedAt), sql`${workspaceRecords.data}->>'sourceProposalId' = ${proposal.id}`,
      ));
      if (!existingContract || !existingProject) return { kind: 'already_accepted_without_bundle' as const };
      return { kind: 'already_accepted' as const, proposal, contract: existingContract, project: existingProject, tasks: existingTasks };
    }
    if (disposition === 'reject_closed') return { kind: 'closed' as const };

    const clientId = String(proposal.data.clientId ?? '');
    if (!z.string().uuid().safeParse(clientId).success) return { kind: 'client_required' as const };
    const [client] = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.id, clientId), eq(workspaceRecords.organizationId, request.user.organizationId),
      eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt),
    )).limit(1);
    if (!client) return { kind: 'client_missing' as const };
    if (!recordMatchesWorkspaceScope('clients', client.id, client.data, request.user.permissions?.scope)) return { kind: 'client_missing' as const };

    const removeRecordMetadata = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field)));
    const contractData = {
      ...removeRecordMetadata(body.contract), title: String(proposal.data.title ?? proposal.data.name ?? body.contract.title ?? 'Contrato'),
      client: String(client.data.name ?? proposal.data.client ?? ''), clientId, sourceProposalId: proposal.id,
      status: 'Rascunho', tone: 'gray', signatureEvents: [],
    };
    const projectName = String(body.project.name);
    const projectData = {
      ...removeRecordMetadata(body.project), client: String(client.data.name ?? proposal.data.client ?? ''), clientId,
      sourceProposalId: proposal.id, status: 'Em andamento', progress: 0,
    };
    const [contract] = await tx.insert(workspaceRecords).values({ organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'contracts', data: contractData }).returning();
    const [project] = await tx.insert(workspaceRecords).values({ organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'projects', data: projectData }).returning();
    const tasks = await tx.insert(workspaceRecords).values(body.tasks.map((task) => ({
      organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'tasks',
      data: { ...removeRecordMetadata(task), project: projectName, projectId: project!.id, client: String(client.data.name ?? proposal.data.client ?? ''), clientId, sourceProposalId: proposal.id },
    }))).returning();
    const nextProposalData = { ...proposal.data, status: 'Aprovada', tone: 'green', acceptedAt };
    const [savedProposal] = await tx.update(workspaceRecords).set({ data: nextProposalData, updatedAt: new Date(acceptedAt) }).where(and(
      eq(workspaceRecords.id, proposal.id), eq(workspaceRecords.organizationId, request.user.organizationId),
    )).returning();
    await tx.insert(activityEvents).values([
      { organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'contracts', entityId: contract!.id, action: 'created_from_accepted_proposal', payload: { proposalId: proposal.id } },
      { organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'projects', entityId: project!.id, action: 'created_from_accepted_proposal', payload: { proposalId: proposal.id, taskCount: tasks.length } },
      { organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'proposals', entityId: proposal.id, action: 'accepted', payload: { contractId: contract!.id, projectId: project!.id } },
    ]);
    return { kind: 'accepted' as const, proposal: savedProposal!, contract: contract!, project: project!, tasks };
  });

  if (result.kind === 'missing') return reply.code(404).send({ error: 'not_found', message: 'Proposta não encontrada.' });
  if (result.kind === 'closed') return reply.code(409).send({ error: 'proposal_closed', message: 'Uma proposta recusada ou expirada não pode ser aceita.' });
  if (result.kind === 'client_required') return reply.code(409).send({ error: 'proposal_client_required', message: 'Vincule a proposta a um cliente cadastrado antes de aceitá-la.' });
  if (result.kind === 'client_missing') return reply.code(409).send({ error: 'proposal_client_missing', message: 'O cliente vinculado não está disponível nesta organização.' });
  if (result.kind === 'already_accepted_without_bundle') return reply.code(409).send({ error: 'proposal_acceptance_incomplete', message: 'A proposta consta como aprovada, mas o contrato e o projeto não estão vinculados. Revise os registros antes de continuar.' });
  if (result.kind === 'accepted') await enqueueN8nEvent(request.user.organizationId, 'proposal.accepted', { ...result.proposal.data, id: result.proposal.id, clientId: result.proposal.data.clientId });
  const serialize = (row: typeof result.contract) => ({ ...row.data, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt });
  return reply.code(result.kind === 'accepted' ? 201 : 200).send({ data: {
    proposal: serialize(result.proposal), contract: serialize(result.contract), project: serialize(result.project), tasks: result.tasks.map(serialize),
    idempotent: result.kind === 'already_accepted',
  } });
});

app.get('/api/monitoring/site-assets/:id/history', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de ativo inválido.' });
  if (!isWorkspaceRequestAllowed(request.user.role, 'GET', '/api/workspace/site-assets', request.user.permissions)) return reply.code(403).send({ error: 'forbidden', message: 'Você não tem acesso ao histórico deste ativo.' });
  const [asset] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId),
    eq(workspaceRecords.resource, 'site-assets'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  if (!asset) return reply.code(404).send({ error: 'not_found', message: 'Ativo não encontrado.' });
  const scope = request.user.permissions?.scope;
  if (scope?.mode === 'selected' && clientLinkedWorkspaceResources.includes('site-assets') && !recordMatchesWorkspaceScope('site-assets', asset.id, asset.data, scope)) return reply.code(403).send({ error: 'record_scope_denied', message: 'Este ativo não pertence ao seu escopo.' });
  const rows = await db.select({ id: activityEvents.id, payload: activityEvents.payload, createdAt: activityEvents.createdAt })
    .from(activityEvents).where(and(
      eq(activityEvents.organizationId, request.user.organizationId), eq(activityEvents.entityType, 'site-assets'),
      eq(activityEvents.entityId, asset.id), eq(activityEvents.action, 'checked'),
    )).orderBy(desc(activityEvents.createdAt)).limit(50);
  return { data: rows };
});

app.post('/api/monitoring/site-assets/:id/check', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador de ativo inválido.' });
  if (!isWorkspaceRequestAllowed(request.user.role, 'POST', '/api/workspace/site-assets', request.user.permissions)) return reply.code(403).send({ error: 'forbidden', message: 'Você não tem permissão para iniciar verificações deste ativo.' });
  const [asset] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId),
    eq(workspaceRecords.resource, 'site-assets'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  if (!asset) return reply.code(404).send({ error: 'not_found', message: 'Ativo não encontrado.' });
  if (!recordMatchesWorkspaceScope('site-assets', asset.id, asset.data, request.user.permissions?.scope)) return reply.code(403).send({ error: 'record_scope_denied', message: 'Este ativo não pertence ao seu escopo.' });
  const target = String(asset.data.url ?? asset.data.domain ?? asset.data.name ?? '').trim();
  let result;
  try { result = await checkPublicSite(target); }
  catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'host_not_public') return reply.code(400).send({ error: 'host_not_public', message: 'O endereço precisa ser público; IPs privados e locais não podem ser verificados.' });
    if (code === 'invalid_url') return reply.code(400).send({ error: 'invalid_url', message: 'Informe um domínio ou URL HTTP/HTTPS válido.' });
    return reply.code(422).send({ error: 'site_check_failed', message: 'Não foi possível consultar o domínio. Confira o endereço e tente novamente.' });
  }
  const health = result.status;
  const [saved] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(workspaceRecords).set({
      data: { ...asset.data, url: result.url, health, status: health, httpStatus: result.httpStatus, latencyMs: result.latencyMs, sslExpiresAt: result.sslExpiresAt, checkedAt: result.checkedAt },
      updatedAt: new Date(),
    }).where(and(eq(workspaceRecords.id, asset.id), eq(workspaceRecords.organizationId, request.user.organizationId), isNull(workspaceRecords.archivedAt))).returning();
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'site-assets', entityId: asset.id, action: 'checked', payload: { status: result.status, httpStatus: result.httpStatus, latencyMs: result.latencyMs, checkedAt: result.checkedAt } });
    return [updated];
  });
  if (!saved) return reply.code(404).send({ error: 'not_found', message: 'Ativo não encontrado.' });
  return { data: { ...saved.data, id: saved.id, createdAt: saved.createdAt, updatedAt: saved.updatedAt } };
});

app.post('/api/integrations/clicksign/webhook', { config: { rawBody: true, rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (request, reply) => {
  if (!env.CLICKSIGN_WEBHOOK_SECRET) return reply.code(503).send({ error: 'clicksign_webhook_not_configured' });
  const rawBody = request.rawBody;
  const signature = request.headers['content-hmac'];
  if (!Buffer.isBuffer(rawBody) || !verifyClicksignWebhook(rawBody, env.CLICKSIGN_WEBHOOK_SECRET, Array.isArray(signature) ? signature[0] : signature)) return reply.code(401).send({ error: 'clicksign_webhook_unauthorized' });
  const event = parseClicksignWebhookEvent(request.body);
  if (!event) return reply.code(202).send({ received: true, matched: false });
  const supportedEvents = new Set(['document_closed', 'auto_close', 'close', 'cancel', 'deadline', 'refusal', 'sign']);
  if (!supportedEvents.has(event.name) || (!event.documentId && !event.envelopeId)) return reply.code(202).send({ received: true, matched: false });
  const matches = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.resource, 'contracts'), isNull(workspaceRecords.archivedAt),
    or(
      ...(event.envelopeId ? [sql`${workspaceRecords.data}->'clicksign'->>'envelopeId' = ${event.envelopeId}`] : []),
      ...(event.documentId ? [sql`${workspaceRecords.data}->'clicksign'->>'documentId' = ${event.documentId}`] : []),
    ),
  )).limit(2);
  if (matches.length !== 1) return reply.code(202).send({ received: true, matched: false });
  const contract = matches[0]!;
  const clicksign = contract.data.clicksign as Record<string, unknown> | undefined;
  if (!clicksign || typeof clicksign.envelopeId !== 'string') return reply.code(202).send({ received: true, matched: false });
  if (!await isIntegrationEnabled(contract.organizationId, 'clicksign')) return reply.code(503).send({ error: 'clicksign_integration_disabled' });
  try {
    const providerStatus = clicksignWebhookEnvelopeStatus(event);
    const mapped = clicksignContractStatus(providerStatus);
    if (!canApplyClicksignWebhookStatus(contract.data.status, mapped.status)) return reply.code(200).send({ received: true, matched: true, stale: true });
    await db.transaction(async (tx) => {
      const [changed] = await tx.update(workspaceRecords).set({
        data: { ...contract.data, status: mapped.status, tone: mapped.tone, clicksign: { ...clicksign, status: providerStatus, webhookEvent: event.name, syncedAt: new Date().toISOString() } },
        updatedAt: new Date(),
      }).where(and(
        eq(workspaceRecords.id, contract.id), eq(workspaceRecords.organizationId, contract.organizationId),
        eq(workspaceRecords.resource, 'contracts'), isNull(workspaceRecords.archivedAt),
        sql`${workspaceRecords.data}->>'status' IS DISTINCT FROM ${mapped.status}`,
        sql`NOT (${workspaceRecords.data}->>'status' IN ('Assinado', 'Cancelado') AND ${workspaceRecords.data}->>'status' IS DISTINCT FROM ${mapped.status})`,
      )).returning({ id: workspaceRecords.id });
      if (changed) await tx.insert(activityEvents).values({ organizationId: contract.organizationId, actorUserId: null, entityType: 'contracts', entityId: contract.id, action: 'signature_status_synced', payload: { provider: 'clicksign', status: providerStatus, source: 'webhook' } });
    });
    return reply.code(200).send({ received: true, matched: true });
  } catch (error) {
    request.log.warn({ error: error instanceof Error ? error.message : 'unknown', envelopeId: clicksign.envelopeId }, 'Clicksign webhook status update failed');
    return reply.code(503).send({ error: 'clicksign_webhook_processing_failed' });
  }
});

const clicksignContractSendSchema = z.object({
  signerName: z.string().trim().min(2).max(140),
  signerEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  documentText: z.string().trim().min(100).max(60_000),
});

app.post('/api/integrations/clicksign/contracts/:id/send', { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(clicksignContractSendSchema, request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Contrato invalido.' });
  if (!body) return;
  if (!process.env.CLICKSIGN_API_TOKEN || !await isIntegrationEnabled(request.user.organizationId, 'clicksign')) return reply.code(409).send({ error: 'clicksign_not_configured', message: 'Configure e teste a Clicksign antes de enviar contratos.' });
  const [contract] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'contracts'), isNull(workspaceRecords.archivedAt))).limit(1);
  if (!contract) return reply.code(404).send({ error: 'not_found', message: 'Contrato nao encontrado.' });
  if (contract.data.status !== 'Rascunho' || contract.data.clicksign && typeof contract.data.clicksign === 'object') return reply.code(409).send({ error: 'contract_already_sent', message: 'Este contrato ja possui um processo Clicksign. Sincronize o status ou use a acao de reenviar notificacao.' });
  const content = body.documentText;
  const unresolvedField = content.match(/\[[^\]]{2,100}\]/);
  if (unresolvedField) return reply.code(422).send({ error: 'contract_fields_incomplete', message: 'Preencha todos os campos entre colchetes do documento antes de enviar para assinatura.' });
  const title = String(contract.data.title || contract.data.name || 'Contrato');
  const clientName = String(contract.data.client || '');
  if (!content.includes(title) || !clientName || !content.includes(clientName)) return reply.code(422).send({ error: 'contract_document_mismatch', message: 'O texto deve identificar o titulo do contrato e o cliente vinculado.' });
  const baseUrl = process.env.CLICKSIGN_API_BASE_URL || 'https://sandbox.clicksign.com';
  const sendClaim = { status: 'creating', requestId: randomUUID(), startedAt: new Date().toISOString() };
  const [claimed] = await db.update(workspaceRecords).set({ data: { ...contract.data, clicksign: sendClaim }, updatedAt: new Date() }).where(and(
    eq(workspaceRecords.id, contract.id), eq(workspaceRecords.organizationId, request.user.organizationId),
    eq(workspaceRecords.resource, 'contracts'), sql`${workspaceRecords.data}->'clicksign' IS NULL`,
  )).returning();
  if (!claimed) return reply.code(409).send({ error: 'contract_send_in_progress', message: 'Outro envio foi iniciado ou este contrato ja tem um envelope. Atualize a ficha antes de continuar.' });
  let envelope: Awaited<ReturnType<typeof createClicksignEnvelope>>;
  try {
    envelope = await createClicksignEnvelope({ baseUrl, token: process.env.CLICKSIGN_API_TOKEN, name: `${String(contract.data.code || 'Contrato')} - ${title}`.slice(0, 180), filename: `${String(contract.data.code || 'contrato').replace(/[^a-zA-Z0-9_-]+/g, '-')}.txt`, text: content, signerName: body.signerName, signerEmail: body.signerEmail });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    app.log.warn({ error: error instanceof Error ? error.message : 'unknown' }, 'Clicksign envelope creation failed');
    await db.update(workspaceRecords).set({ data: { ...claimed!.data, clicksign: { ...sendClaim, status: 'error', httpStatus: statusCode || null } }, updatedAt: new Date() }).where(eq(workspaceRecords.id, contract.id));
    return reply.code(502).send({ error: 'clicksign_send_failed', message: 'A Clicksign nao confirmou o envelope. Como a criacao pode ter sido parcial, confira a conta Clicksign antes de tentar novamente.' });
  }
  const now = new Date().toISOString();
  const clicksign = { ...envelope, status: 'running', notificationStatus: 'pending', signerName: body.signerName, signerEmail: body.signerEmail, sentAt: now };
  const [saved] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(workspaceRecords).set({ data: { ...claimed!.data, documentText: content, clicksign, status: 'Aguardando assinatura', tone: 'amber' }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, contract.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'contracts'))).returning();
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'contracts', entityId: contract.id, action: 'signature_requested', payload: { provider: 'clicksign', envelopeId: envelope.envelopeId, recipient: body.signerEmail } });
    return [updated];
  });
  let notificationSent = false;
  try {
    await notifyClicksignEnvelope(baseUrl, process.env.CLICKSIGN_API_TOKEN, envelope.envelopeId);
    notificationSent = true;
    const [notified] = await db.update(workspaceRecords).set({ data: { ...saved!.data, clicksign: { ...clicksign, notificationStatus: 'sent', notifiedAt: new Date().toISOString() } }, updatedAt: new Date() }).where(eq(workspaceRecords.id, contract.id)).returning();
    return { data: { ...notified!.data, id: notified!.id, createdAt: notified!.createdAt, updatedAt: notified!.updatedAt }, notificationSent };
  } catch (error) {
    app.log.warn({ error: error instanceof Error ? error.message : 'unknown', envelopeId: envelope.envelopeId }, 'Clicksign notification failed after envelope activation');
    return { data: { ...saved!.data, id: saved!.id, createdAt: saved!.createdAt, updatedAt: saved!.updatedAt }, notificationSent, warning: 'Envelope ativado; a notificacao nao foi confirmada. Use Reenviar notificacao.' };
  }
});

app.post('/api/integrations/clicksign/contracts/:id/notify', { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Contrato invalido.' });
  if (!process.env.CLICKSIGN_API_TOKEN || !await isIntegrationEnabled(request.user.organizationId, 'clicksign')) return reply.code(409).send({ error: 'clicksign_not_configured', message: 'Configure a Clicksign antes de enviar notificacoes.' });
  const [contract] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'contracts'), isNull(workspaceRecords.archivedAt))).limit(1);
  const clicksign = contract?.data.clicksign as Record<string, unknown> | undefined;
  if (!contract || typeof clicksign?.envelopeId !== 'string') return reply.code(409).send({ error: 'clicksign_envelope_missing', message: 'Este contrato ainda nao tem envelope Clicksign.' });
  try {
    await notifyClicksignEnvelope(process.env.CLICKSIGN_API_BASE_URL || 'https://sandbox.clicksign.com', process.env.CLICKSIGN_API_TOKEN, clicksign.envelopeId);
    const next = { ...clicksign, notificationStatus: 'sent', notifiedAt: new Date().toISOString() };
    const [saved] = await db.update(workspaceRecords).set({ data: { ...contract.data, clicksign: next }, updatedAt: new Date() }).where(eq(workspaceRecords.id, contract.id)).returning();
    return { data: { ...saved!.data, id: saved!.id, createdAt: saved!.createdAt, updatedAt: saved!.updatedAt } };
  } catch {
    return reply.code(502).send({ error: 'clicksign_notification_failed', message: 'A Clicksign nao confirmou o envio da notificacao. O envelope continua ativo.' });
  }
});

app.post('/api/integrations/clicksign/contracts/:id/sync', { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Contrato invalido.' });
  if (!process.env.CLICKSIGN_API_TOKEN || !await isIntegrationEnabled(request.user.organizationId, 'clicksign')) return reply.code(409).send({ error: 'clicksign_not_configured', message: 'Configure a Clicksign antes de sincronizar.' });
  const [contract] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'contracts'), isNull(workspaceRecords.archivedAt))).limit(1);
  const clicksign = contract?.data.clicksign as Record<string, unknown> | undefined;
  if (!contract || typeof clicksign?.envelopeId !== 'string') return reply.code(409).send({ error: 'clicksign_envelope_missing', message: 'Este contrato ainda nao tem envelope Clicksign.' });
  try {
    const remote = await getClicksignEnvelope(process.env.CLICKSIGN_API_BASE_URL || 'https://sandbox.clicksign.com', process.env.CLICKSIGN_API_TOKEN, clicksign.envelopeId);
    const status = remote.status === 'closed' ? 'Assinado' : remote.status === 'canceled' ? 'Cancelado' : 'Aguardando assinatura';
    const [saved] = await db.transaction(async (tx) => {
      const [updated] = await tx.update(workspaceRecords).set({ data: { ...contract.data, clicksign: { ...clicksign, status: remote.status, syncedAt: new Date().toISOString() }, status, tone: status === 'Assinado' ? 'green' : status === 'Cancelado' ? 'gray' : 'amber' }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, contract.id), eq(workspaceRecords.organizationId, request.user.organizationId))).returning();
      if (status !== contract.data.status) await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'contracts', entityId: contract.id, action: 'signature_status_synced', payload: { provider: 'clicksign', status: remote.status } });
      return [updated];
    });
    return { data: { ...saved!.data, id: saved!.id, createdAt: saved!.createdAt, updatedAt: saved!.updatedAt } };
  } catch {
    return reply.code(502).send({ error: 'clicksign_sync_failed', message: 'Nao foi possivel consultar o estado do envelope na Clicksign.' });
  }
});

app.post('/api/workspace/finance-accounts/:id/transactions', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  const body = z.object({
    description: z.string().trim().min(1).max(240),
    direction: z.enum(['Entrada', 'Saída']),
    amount: z.number().finite().positive().max(1_000_000_000_000).refine(isCurrencyAmount, 'Amount must use at most two decimal places.'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year!, month! - 1, day!));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
    }),
  }).safeParse(request.body);
  if (!params.success || !body.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid account movement.' });
  let invalidAccountBalance = false;
  const result = await db.transaction(async (tx) => {
    const [account] = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId),
      eq(workspaceRecords.resource, 'finance-accounts'), isNull(workspaceRecords.archivedAt),
    )).for('update').limit(1);
    if (!account) return undefined;
    const accountData = account.data as Record<string, unknown>;
    let nextBalance: number;
    try { nextBalance = calculateAccountMovementBalance(accountData.balance ?? 0, body.data.direction, body.data.amount); }
    catch { invalidAccountBalance = true; return undefined; }
    const [updatedAccount] = await tx.update(workspaceRecords).set({
      data: { ...accountData, balance: nextBalance }, updatedAt: new Date(),
    }).where(and(eq(workspaceRecords.id, account.id), eq(workspaceRecords.organizationId, request.user.organizationId), isNull(workspaceRecords.archivedAt))).returning();
    if (!updatedAccount) return undefined;
    const [created] = await tx.insert(workspaceRecords).values({
      organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'finance-transactions',
      data: { ...body.data, accountId: account.id, accountName: String(accountData.name ?? ''), status: 'Registrada' },
    }).returning();
    await tx.insert(activityEvents).values([
      { organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'finance-accounts', entityId: account.id, action: 'balance_adjusted', payload: { direction: body.data.direction, amount: body.data.amount } },
      { organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'finance-transactions', entityId: created!.id, action: 'created', payload: { accountId: account.id, direction: body.data.direction, amount: body.data.amount } },
    ]);
    return { account: updatedAccount, transaction: created };
  });
  if (invalidAccountBalance) return reply.code(409).send({ error: 'finance_account_balance_invalid', message: 'The account balance must use at most two decimal places before new movements can be recorded.' });
  if (!result) return reply.code(404).send({ error: 'not_found', message: 'Finance account not found.' });
  return reply.code(201).send({ data: { ...result.transaction!.data, id: result.transaction!.id, createdAt: result.transaction!.createdAt, updatedAt: result.transaction!.updatedAt }, account: { ...result.account!.data, id: result.account!.id, updatedAt: result.account!.updatedAt } });
});

app.post('/api/workspace/finance-transfers', { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
  const body = z.object({
    sourceAccountId: z.string().uuid(), destinationAccountId: z.string().uuid(),
    description: z.string().trim().min(2).max(240), amount: z.number().finite().positive().max(1_000_000_000_000),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year!, month! - 1, day!));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
    }),
  }).safeParse(request.body);
  if (!body.success) return reply.code(400).send({ error: 'validation_error', message: 'Informe duas contas, uma descricao, uma data e um valor validos.' });
  if (body.data.sourceAccountId === body.data.destinationAccountId) return reply.code(400).send({ error: 'finance_transfer_same_account', message: 'Escolha duas contas diferentes.' });
  let balanceError = '';
  const result = await db.transaction(async (tx) => {
    const { sourceAccountId, destinationAccountId } = body.data;
    // Lock both accounts in a stable order so concurrent transfers cannot overspend or deadlock.
    await tx.execute(sql`SELECT id FROM workspace_records WHERE organization_id = ${request.user.organizationId} AND resource = 'finance-accounts' AND archived_at IS NULL AND id IN (${sourceAccountId}::uuid, ${destinationAccountId}::uuid) ORDER BY id FOR UPDATE`);
    const rows = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'finance-accounts'),
      isNull(workspaceRecords.archivedAt), sql`${workspaceRecords.id} IN (${sourceAccountId}::uuid, ${destinationAccountId}::uuid)`,
    ));
    const source = rows.find((row) => row.id === sourceAccountId);
    const destination = rows.find((row) => row.id === destinationAccountId);
    if (!source || !destination) return { error: 'finance_account_not_found' as const };
    const sourceData = source.data as Record<string, unknown>;
    const destinationData = destination.data as Record<string, unknown>;
    let balances: ReturnType<typeof calculateFinanceTransferBalances>;
    try { balances = calculateFinanceTransferBalances(sourceData.balance ?? 0, destinationData.balance ?? 0, body.data.amount); }
    catch (error) { balanceError = error instanceof Error ? error.message : 'finance_transfer_invalid_amount'; return { error: balanceError }; }
    await tx.update(workspaceRecords).set({ data: { ...sourceData, balance: balances.sourceBalance }, updatedAt: new Date() }).where(eq(workspaceRecords.id, source.id));
    await tx.update(workspaceRecords).set({ data: { ...destinationData, balance: balances.destinationBalance }, updatedAt: new Date() }).where(eq(workspaceRecords.id, destination.id));
    const transferId = randomUUID();
    const transactions = await tx.insert(workspaceRecords).values([
      { organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'finance-transactions', data: { description: body.data.description, direction: 'Sa\u00edda', amount: balances.amount, date: body.data.date, accountId: source.id, accountName: String(sourceData.name ?? ''), status: 'Registrada', transferId, transferSide: 'debit', relatedAccountId: destination.id, relatedAccountName: String(destinationData.name ?? '') } },
      { organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'finance-transactions', data: { description: body.data.description, direction: 'Entrada', amount: balances.amount, date: body.data.date, accountId: destination.id, accountName: String(destinationData.name ?? ''), status: 'Registrada', transferId, transferSide: 'credit', relatedAccountId: source.id, relatedAccountName: String(sourceData.name ?? '') } },
    ]).returning();
    await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'finance-transfer', entityId: transferId, action: 'created', payload: { sourceAccountId: source.id, destinationAccountId: destination.id, amount: balances.amount, transactionIds: transactions.map((item) => item.id) } });
    return { transferId, transactions, sourceBalance: balances.sourceBalance, destinationBalance: balances.destinationBalance };
  });
  if ('error' in result) {
    if (result.error === 'finance_account_not_found') return reply.code(404).send({ error: result.error, message: 'Uma das contas nao existe neste workspace.' });
    if (result.error === 'finance_transfer_insufficient_funds') return reply.code(409).send({ error: result.error, message: 'Saldo insuficiente na conta de origem para esta transferencia.' });
    return reply.code(400).send({ error: result.error, message: 'O valor da transferencia deve ter no maximo duas casas decimais.' });
  }
  return reply.code(201).send({ data: { transferId: result.transferId, transactions: result.transactions, balances: { source: result.sourceBalance, destination: result.destinationBalance } } });
});

app.post('/api/workspace/leads/:id/convert', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(z.object({ data: z.object({
    value: z.unknown().optional(), chance: z.number().min(0).max(100).optional(), source: z.string().max(500).optional(),
    service: z.string().max(500).optional(), owner: z.string().max(500).optional(), nextAction: z.string().max(2000).optional(),
    closeDate: z.string().max(40).optional(), notes: z.string().max(8000).optional(),
  }).strict().optional() }).strict(), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Identificador do lead invalido.' });
  if (!body) return;
  const result = await db.transaction(async (tx) => {
    const [lead] = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId),
      eq(workspaceRecords.resource, 'leads'), isNull(workspaceRecords.archivedAt),
    )).for('update').limit(1);
    if (!lead || !recordMatchesWorkspaceScope('leads', lead.id, lead.data, request.user.permissions?.scope)) return { kind: 'missing' as const };
    const leadData: Record<string, unknown> = { ...lead.data, ...(body.data || {}), stage: 'Fechado' };
    if (leadData.convertedClientId) {
      const [linkedClient] = await tx.select().from(workspaceRecords).where(and(
        eq(workspaceRecords.id, String(leadData.convertedClientId)), eq(workspaceRecords.organizationId, request.user.organizationId),
        eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt),
      )).limit(1);
      if (!linkedClient) return { kind: 'review' as const };
      if (!recordMatchesWorkspaceScope('clients', linkedClient.id, linkedClient.data, request.user.permissions?.scope)) return { kind: 'missing' as const };
      const linkedClientData = mergeLeadServiceIntoClient(linkedClient.data, leadData);
      let clientRecord = linkedClient;
      if (linkedClientData !== linkedClient.data) {
        const [updatedClient] = await tx.update(workspaceRecords).set({ data: linkedClientData, updatedAt: new Date() }).where(eq(workspaceRecords.id, linkedClient.id)).returning();
        clientRecord = updatedClient!;
      }
      const [savedLead] = await tx.update(workspaceRecords).set({ data: { ...leadData, convertedClientId: linkedClient.id }, updatedAt: new Date() }).where(eq(workspaceRecords.id, lead.id)).returning();
      return { kind: 'existing' as const, lead: savedLead!, client: clientRecord };
    }
    const clientsInWorkspace = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt),
    ));
    const duplicateMatch = findLeadDuplicateMatch(clientsInWorkspace.map((client) => ({ ...client.data, id: client.id, row: client })), { email: leadData.email, phone: leadData.phone });
    if (duplicateMatch.kind === 'ambiguous') return { kind: 'ambiguous' as const };
    const duplicate = duplicateMatch.kind === 'match' ? duplicateMatch.record : undefined;
    let client = duplicate?.row;
    if (client && !recordMatchesWorkspaceScope('clients', String(client.id), client.data, request.user.permissions?.scope)) return { kind: 'missing' as const };
    if (client) {
      const clientData = mergeLeadServiceIntoClient(client.data, leadData);
      if (clientData !== client.data) {
        const [updatedClient] = await tx.update(workspaceRecords).set({ data: clientData, updatedAt: new Date() }).where(eq(workspaceRecords.id, client.id)).returning();
        client = updatedClient!;
      }
    }
    if (!client) {
      if (request.user.permissions?.scope?.mode === 'selected') return { kind: 'scope_denied' as const };
      const clientData = buildClientFromLead({ ...leadData, id: lead.id });
      if (!clientData.name) return { kind: 'invalid' as const };
      const [createdClient] = await tx.insert(workspaceRecords).values({ organizationId: request.user.organizationId, createdBy: request.user.sub, resource: 'clients', data: clientData }).returning();
      client = createdClient!;
    }
    const [savedLead] = await tx.update(workspaceRecords).set({ data: { ...leadData, convertedClientId: client.id }, updatedAt: new Date() }).where(eq(workspaceRecords.id, lead.id)).returning();
    await tx.insert(activityEvents).values([
      { organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'leads', entityId: lead.id, action: 'converted_to_client', payload: { clientId: client.id } },
      ...(duplicate ? [] : [{ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'clients', entityId: client.id, action: 'created_from_lead', payload: { leadId: lead.id } }]),
    ]);
    return { kind: duplicate ? 'existing' as const : 'converted' as const, lead: savedLead!, client };
  });
  if (result.kind === 'missing') return reply.code(404).send({ error: 'not_found', message: 'Lead ou cliente fora do escopo.' });
  if (result.kind === 'scope_denied') return reply.code(403).send({ error: 'record_scope_denied', message: 'A conversao criaria um cliente fora do escopo atribuido.' });
  if (result.kind === 'review') return reply.code(409).send({ error: 'lead_conversion_review', message: 'O cliente vinculado nao esta mais ativo; revise a ficha antes de tentar novamente.' });
  if (result.kind === 'ambiguous') return reply.code(409).send({ error: 'lead_conversion_ambiguous', message: 'O e-mail e o telefone deste lead correspondem a clientes diferentes. Revise os dados na ficha do cliente antes de converter.' });
  if (result.kind === 'invalid') return reply.code(400).send({ error: 'lead_conversion_invalid', message: 'Informe o nome do contato ou da empresa antes de converter.' });
  return { data: { lead: { ...result.lead.data, id: result.lead.id, createdAt: result.lead.createdAt, updatedAt: result.lead.updatedAt }, client: { ...result.client.data, id: result.client.id, createdAt: result.client.createdAt, updatedAt: result.client.updatedAt }, existing: result.kind === 'existing' } };
});

app.post('/api/workspace/:resource/recurring', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: z.enum(['revenues', 'expenses']) }).safeParse(request.params);
  const body = parseBody(z.object({
    seriesId: z.string().uuid(),
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
    count: z.coerce.number().int().min(2).max(60),
    data: workspaceDataSchema,
  }), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'finance_recurrence_resource_invalid', message: 'Selecione receitas ou despesas para criar uma recorrência.' });
  if (!body) return;

  const data = body.data;
  const amount = Number(data.amount);
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (!description || description.length > 240 || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
    return reply.code(400).send({ error: 'finance_recurrence_data_invalid', message: 'Informe uma descrição e um valor válido para os lançamentos.' });
  }

  const recordScope = request.user.permissions?.scope;
  const parsedClientId = data.clientId == null || data.clientId === '' ? null : z.string().uuid().safeParse(data.clientId);
  if (parsedClientId && !parsedClientId.success) return reply.code(400).send({ error: 'finance_client_invalid', message: 'O cliente vinculado não é válido.' });
  if (parsedClientId?.success) {
    const [client] = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
      eq(workspaceRecords.id, parsedClientId.data), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt),
    )).limit(1);
    if (!client || !recordMatchesWorkspaceScope('clients', client.id, client.data, recordScope)) return reply.code(403).send({ error: 'record_scope_denied', message: 'O cliente vinculado não pertence ao seu escopo.' });
  }

  let dates: ReturnType<typeof buildFinanceRecurrenceDates>;
  try {
    dates = buildFinanceRecurrenceDates(String(data.date ?? ''), data.dueDate == null || data.dueDate === '' ? null : String(data.dueDate), body.frequency, body.count);
  } catch {
    return reply.code(400).send({ error: 'finance_recurrence_date_invalid', message: 'Confira a data do lançamento e o vencimento.' });
  }

  const baseData = Object.fromEntries(Object.entries(data).filter(([key]) => !['id', 'createdAt', 'updatedAt', 'recurrenceSeriesId', 'recurrenceSequence', 'recurrenceCount'].includes(key)));
  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${request.user.organizationId}:${body.seriesId}`}))`);
    const existing = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource),
      isNull(workspaceRecords.archivedAt), sql`${workspaceRecords.data}->>'recurrenceSeriesId' = ${body.seriesId}`,
    )).orderBy(asc(workspaceRecords.createdAt));
    if (existing.length) return existing;

    const rows = await tx.insert(workspaceRecords).values(dates.map((occurrence, index) => ({
      organizationId: request.user.organizationId,
      createdBy: request.user.sub,
      resource: params.data.resource,
      data: {
        ...baseData,
        code: `${params.data.resource === 'revenues' ? 'REC' : 'DES'}-${randomUUID().slice(0, 8).toUpperCase()}`,
        description,
        amount: Math.round(amount * 100) / 100,
        clientId: parsedClientId?.success ? parsedClientId.data : null,
        dueDate: occurrence.dueDate,
        date: occurrence.date,
        status: 'Pendente',
        recurrenceSeriesId: body.seriesId,
        recurrenceFrequency: body.frequency,
        recurrenceSequence: index + 1,
        recurrenceCount: body.count,
      },
    }))).returning();
    await tx.insert(activityEvents).values({
      organizationId: request.user.organizationId, actorUserId: request.user.sub,
      entityType: params.data.resource, entityId: rows[0]!.id, action: 'recurrence_created',
      payload: { seriesId: body.seriesId, frequency: body.frequency, count: rows.length },
    });
    return rows;
  });
  return reply.code(201).send({ data: {
    seriesId: body.seriesId,
    records: outcome.map((row) => ({ ...row.data, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt })),
  } });
});

app.post('/api/workspace/:resource', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource }).safeParse(request.params);
  const body = parseBody(z.object({ data: workspaceDataSchema }), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso inválido.' });
  if (!body) return;
  const recordScope = request.user.permissions?.scope;
   if (params.data.resource === 'finance-accounts' && Object.hasOwn(body.data, 'balance') && !isCurrencyBalance(body.data.balance)) return reply.code(400).send({ error: 'finance_account_balance_invalid', message: 'O saldo deve ter no máximo duas casas decimais.' });
  if (recordScope?.mode === 'selected' && (params.data.resource === 'clients' || (clientLinkedWorkspaceResources.includes(params.data.resource as typeof clientLinkedWorkspaceResources[number]) && !recordMatchesWorkspaceScope(params.data.resource, '', body.data, recordScope)))) return reply.code(403).send({ error: 'record_scope_denied', message: 'Este registro nao pertence ao escopo atribuido.' });
  if (params.data.resource === 'clients') { const validationError = validateClientServiceCharges(body.data.serviceCharges); if (validationError) return reply.code(400).send({ error: 'client_billing_invalid', message: validationError }); }
  if (params.data.resource === 'approvals') {
    const clientId = z.string().uuid().safeParse(body.data.clientId);
    if (!clientId.success) return reply.code(400).send({ error: 'approval_client_required', message: 'Selecione um cliente valido para esta aprovacao.' });
    const [client] = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(eq(workspaceRecords.id, clientId.data), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt))).limit(1);
    if (!client) return reply.code(400).send({ error: 'approval_client_invalid', message: 'O cliente selecionado nao existe neste workspace.' });
    const attachment = body.data.attachment && typeof body.data.attachment === 'object' && !Array.isArray(body.data.attachment) ? body.data.attachment as Record<string, unknown> : {};
    const driveFileId = String(attachment.driveFileId || '');
    if (attachment.publicAccess === true || driveFileId) {
      const resolvedProjectId = String(body.data.projectId || '');
      if (resolvedProjectId && !z.string().uuid().safeParse(resolvedProjectId).success) return reply.code(400).send({ error: 'approval_project_invalid', message: 'O projeto vinculado a aprovacao e invalido.' });
      if (!driveFileId) return reply.code(400).send({ error: 'approval_file_scope_denied', message: 'Um arquivo publico precisa estar vinculado a um arquivo do Drive deste cliente.' });
      const [project] = resolvedProjectId ? await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(eq(workspaceRecords.id, resolvedProjectId), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'projects'), isNull(workspaceRecords.archivedAt))).limit(1) : [];
      const filesForApproval = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'files'), isNull(workspaceRecords.archivedAt), sql`${workspaceRecords.data}->>'driveFileId' = ${driveFileId}`)).limit(10);
      const eligible = filesForApproval.some((file) => recordMatchesWorkspaceScope('files', file.id, file.data, recordScope) && approvalFileMatchesClientScope({
        fileId: driveFileId, file: file.data, clientId: client.id, clientName: String(client.data.name ?? client.data.title ?? ''),
        projectId: project?.id, projectName: String(project?.data.name ?? project?.data.title ?? ''), project: project?.data,
      }));
      if ((resolvedProjectId && !project) || (project && !recordMatchesWorkspaceScope('projects', project.id, project.data, recordScope)) || !eligible) return reply.code(403).send({ error: 'approval_file_scope_denied', message: 'O arquivo precisa estar vinculado ao cliente ou ao projeto selecionado.' });
    }
  }
  if (params.data.resource === 'proposals' && proposalAcceptanceDisposition(body.data.status) === 'return_existing') return reply.code(409).send({ error: 'proposal_acceptance_required', message: 'Use a aprovacao para criar contrato, projeto e tarefas de forma atomica.' });
  if (params.data.resource === 'contracts' && requiresExternalSignature(body.data.status)) return reply.code(409).send({ error: 'contract_signature_required', message: 'Contrato so muda para Aguardando assinatura, Assinado ou Ativo apos confirmacao do provedor.' });
  const outcome = await db.transaction(async (tx) => {
    if (params.data.resource === 'leads') {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${request.user.organizationId}))`);
      const existingLeads = await tx.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
        eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'leads'), isNull(workspaceRecords.archivedAt),
      ));
      const duplicate = findDuplicateLead(existingLeads.map((lead) => ({ ...lead.data, id: lead.id })), body.data);
      if (duplicate) return { created: [], duplicateId: duplicate.id };
    }
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
    return { created };
  });
  if ('duplicateId' in outcome) return reply.code(409).send({ error: 'duplicate_lead', message: 'Ja existe uma oportunidade com este e-mail ou telefone.', duplicateId: outcome.duplicateId });
  const saved = outcome.created[0]!;
  if (params.data.resource === 'leads') await enqueueN8nEvent(request.user.organizationId, 'lead.created', { ...saved!.data, id: saved!.id });
  if (params.data.resource === 'tickets') await enqueueN8nEvent(request.user.organizationId, 'ticket.created', { ...saved!.data, id: saved!.id });
  return reply.code(201).send({ data: { ...saved!.data, id: saved!.id, createdAt: saved!.createdAt, updatedAt: saved!.updatedAt } });
});

app.patch('/api/workspace/:resource/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource, id: z.string().uuid() }).safeParse(request.params);
  const body = parseBody(z.object({ data: workspaceDataSchema }).refine((value) => Object.keys(value.data).length > 0), request.body, reply);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso ou identificador inválidos.' });
  if (!body) return;
  let invalidClientBilling = '';
   if (params.data.resource === 'finance-accounts' && Object.hasOwn(body.data, 'balance') && !isCurrencyBalance(body.data.balance)) return reply.code(400).send({ error: 'finance_account_balance_invalid', message: 'O saldo deve ter no máximo duas casas decimais.' });
  let previousData: Record<string, unknown> | undefined;
  let rejectedContractTransition = false;
  let rejectedManagedSignatureMutation = false;
  let rejectedProposalTransition = false;
  let invalidApprovalClient = false;
  let invalidApprovalAttachment = false;
  let linkedTransferMutationBlocked = false;
  let financeAccountBalanceMutationBlocked = false;
  let projectArchiveTransitionBlocked = false;
  const updated = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource), isNull(workspaceRecords.archivedAt))).limit(1);
    if (!current) return undefined;
    if (!recordMatchesWorkspaceScope(params.data.resource, current.id, current.data, request.user.permissions?.scope)) return undefined;
    if (!recordMatchesWorkspaceScope(params.data.resource, current.id, { ...current.data, ...body.data }, request.user.permissions?.scope)) return undefined;
    if (params.data.resource === 'projects' && Object.hasOwn(body.data, 'status') && !canChangeProjectArchiveState(request.user.role, current.data.status, body.data.status)) { projectArchiveTransitionBlocked = true; return undefined; }
    if (params.data.resource === 'finance-transactions' && current.data.transferId) { linkedTransferMutationBlocked = true; return undefined; }
    if (params.data.resource === 'finance-accounts' && Object.hasOwn(body.data, 'balance') && !canUpdateFinanceAccountBalance(current.data.balance, body.data.balance)) { financeAccountBalanceMutationBlocked = true; return undefined; }
    if (params.data.resource === 'clients') { invalidClientBilling = validateClientServiceCharges({ ...current.data, ...body.data }.serviceCharges) || ''; if (invalidClientBilling) return undefined; }
    if (params.data.resource === 'approvals') {
      const merged = { ...current.data, ...body.data };
      const clientId = z.string().uuid().safeParse(merged.clientId);
      const [client] = clientId.success ? await tx.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(eq(workspaceRecords.id, clientId.data), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt))).limit(1) : [];
      if (!client) { invalidApprovalClient = true; return undefined; }
      const attachment = merged.attachment && typeof merged.attachment === 'object' && !Array.isArray(merged.attachment) ? merged.attachment as Record<string, unknown> : {};
      const driveFileId = String(attachment.driveFileId || '');
      if (attachment.publicAccess === true || driveFileId) {
        const projectId = String(merged.projectId || '');
        const projectIdValid = !projectId || z.string().uuid().safeParse(projectId).success;
        const [project] = projectIdValid && projectId ? await tx.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(eq(workspaceRecords.id, projectId), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'projects'), isNull(workspaceRecords.archivedAt))).limit(1) : [];
        const filesForApproval = driveFileId ? await tx.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'files'), isNull(workspaceRecords.archivedAt), sql`${workspaceRecords.data}->>'driveFileId' = ${driveFileId}`)).limit(10) : [];
        const eligible = filesForApproval.some((file) => recordMatchesWorkspaceScope('files', file.id, file.data, request.user.permissions?.scope) && approvalFileMatchesClientScope({
          fileId: driveFileId, file: file.data, clientId: client.id, clientName: String(client.data.name ?? client.data.title ?? ''),
          projectId: project?.id, projectName: String(project?.data.name ?? project?.data.title ?? ''), project: project?.data,
        }));
        if (!projectIdValid || (projectId && !project) || (project && !recordMatchesWorkspaceScope('projects', project.id, project.data, request.user.permissions?.scope)) || !driveFileId || !eligible) { invalidApprovalAttachment = true; return undefined; }
      }
    }
    if (params.data.resource === 'proposals' && Object.hasOwn(body.data, 'status') && proposalAcceptanceDisposition(body.data.status) !== proposalAcceptanceDisposition(current.data.status) && (proposalAcceptanceDisposition(body.data.status) === 'return_existing' || proposalAcceptanceDisposition(current.data.status) === 'return_existing')) { rejectedProposalTransition = true; return undefined; }
    if (params.data.resource === 'contracts' && current.data.clicksign && (
      (Object.hasOwn(body.data, 'status') && body.data.status !== current.data.status)
      || (Object.hasOwn(body.data, 'clicksign') && JSON.stringify(body.data.clicksign) !== JSON.stringify(current.data.clicksign))
      || (Object.hasOwn(body.data, 'documentText') && body.data.documentText !== current.data.documentText)
    )) { rejectedManagedSignatureMutation = true; return undefined; }
    if (params.data.resource === 'contracts' && isUnverifiedContractTransition(current.data.status, body.data.status)) { rejectedContractTransition = true; return undefined; }
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
  if (invalidClientBilling) return reply.code(400).send({ error: 'client_billing_invalid', message: invalidClientBilling });
  if (rejectedContractTransition) return reply.code(409).send({ error: 'contract_signature_required', message: 'Contrato so muda para Aguardando assinatura, Assinado ou Ativo apos confirmacao do provedor.' });
  if (rejectedManagedSignatureMutation) return reply.code(409).send({ error: 'clicksign_contract_managed', message: 'Este contrato possui envelope Clicksign. Sincronize o status no provedor; documento, metadados e estado de assinatura ficam bloqueados para edicao manual.' });
  if (rejectedProposalTransition) return reply.code(409).send({ error: 'proposal_acceptance_required', message: 'Use a aprovacao para criar contrato, projeto e tarefas de forma atomica.' });
  if (invalidApprovalClient) return reply.code(400).send({ error: 'approval_client_invalid', message: 'A aprovacao precisa estar vinculada a um cliente ativo deste workspace.' });
  if (invalidApprovalAttachment) return reply.code(403).send({ error: 'approval_file_scope_denied', message: 'O arquivo precisa estar vinculado ao cliente ou ao projeto selecionado.' });
  if (linkedTransferMutationBlocked) return reply.code(409).send({ error: 'finance_transfer_managed', message: 'A movimentacao faz parte de uma transferencia pareada e nao pode ser alterada separadamente.' });
  if (financeAccountBalanceMutationBlocked) return reply.code(409).send({ error: 'finance_account_balance_ledger_required', message: 'Para alterar o saldo, registre uma movimentacao na conta. O ajuste direto ocultaria o historico financeiro.' });
  if (projectArchiveTransitionBlocked) return reply.code(403).send({ error: 'project_archive_forbidden', message: 'Somente administradores podem arquivar ou reabrir projetos.' });
  if (!updated) return reply.code(404).send({ error: 'not_found', message: 'Registro não encontrado.' });
  const normalizeStatus = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const priorStatus = normalizeStatus(previousData?.status);
  const nextStatus = normalizeStatus(body.data.status);
  const publishedStatuses = new Set(['publicado', 'entregue', 'concluido']);
  if (params.data.resource === 'projects' && publishedStatuses.has(nextStatus) && !publishedStatuses.has(priorStatus)) await enqueueN8nEvent(request.user.organizationId, 'project.published', { ...updated.data, id: updated.id });
  if (params.data.resource === 'proposals' && nextStatus === 'aprovada' && priorStatus !== 'aprovada') await enqueueN8nEvent(request.user.organizationId, 'proposal.accepted', { ...updated.data, id: updated.id });
  return { data: { ...updated.data, id: updated.id, createdAt: updated.createdAt, updatedAt: updated.updatedAt } };
});

app.delete('/api/workspace/finance-accounts/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Invalid finance account id.' });
  const archived = await db.transaction(async (tx) => {
    const [account] = await tx.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(
      eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId),
      eq(workspaceRecords.resource, 'finance-accounts'), isNull(workspaceRecords.archivedAt),
    )).returning({ id: workspaceRecords.id });
    if (!account) return undefined;
    const transactions = await tx.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(
      eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'finance-transactions'),
      isNull(workspaceRecords.archivedAt), or(sql`${workspaceRecords.data}->>'accountId' = ${params.data.id}`, sql`${workspaceRecords.data}->>'relatedAccountId' = ${params.data.id}`),
    )).returning({ id: workspaceRecords.id });
    await tx.insert(activityEvents).values([
      { organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'finance-accounts', entityId: account.id, action: 'archived', payload: { archivedTransactions: transactions.length } },
      ...transactions.map((transaction) => ({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'finance-transactions', entityId: transaction.id, action: 'archived', payload: { accountId: account.id } })),
    ]);
    return account;
  });
  if (!archived) return reply.code(404).send({ error: 'not_found', message: 'Finance account not found.' });
  return reply.code(204).send();
});

app.delete('/api/workspace/:resource/:id', { preHandler: app.authenticate }, async (request, reply) => {
  const params = z.object({ resource: workspaceResource, id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Recurso ou identificador inválidos.' });
  if (params.data.resource === 'finance-transactions') {
    const outcome = await db.transaction(async (tx) => {
      const transactionFilter = and(
        eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId),
        eq(workspaceRecords.resource, 'finance-transactions'), isNull(workspaceRecords.archivedAt),
        workspaceRecordScopeWhere('finance-transactions', request.user.permissions?.scope),
      );
      const [initial] = await tx.select().from(workspaceRecords).where(transactionFilter).limit(1);
      if (!initial) return { kind: 'missing' as const };
      const initialData = initial.data as Record<string, unknown>;
      if (initialData.transferId) return { kind: 'transfer' as const };

      const accountId = typeof initialData.accountId === 'string' ? initialData.accountId : '';
      let accountData: Record<string, unknown> | undefined;
      if (accountId) {
        const [account] = await tx.select().from(workspaceRecords).where(and(
          eq(workspaceRecords.id, accountId), eq(workspaceRecords.organizationId, request.user.organizationId),
          eq(workspaceRecords.resource, 'finance-accounts'), isNull(workspaceRecords.archivedAt),
        )).for('update').limit(1);
        if (!account) return { kind: 'account_missing' as const };
        accountData = account.data as Record<string, unknown>;
      }

      const [current] = await tx.select().from(workspaceRecords).where(transactionFilter).for('update').limit(1);
      if (!current) return { kind: 'missing' as const };
      const currentData = current.data as Record<string, unknown>;
      if (currentData.transferId) return { kind: 'transfer' as const };
      if (String(currentData.accountId || '') !== accountId || currentData.amount !== initialData.amount || currentData.direction !== initialData.direction) return { kind: 'changed' as const };

      let nextBalance: number | undefined;
      if (accountData) {
        try { nextBalance = reverseAccountMovementBalance(accountData.balance ?? 0, currentData.direction, currentData.amount); }
        catch { return { kind: 'account_balance_invalid' as const }; }
      }
      const [archived] = await tx.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(
        eq(workspaceRecords.id, current.id), eq(workspaceRecords.organizationId, request.user.organizationId),
        eq(workspaceRecords.resource, 'finance-transactions'), isNull(workspaceRecords.archivedAt),
      )).returning({ id: workspaceRecords.id });
      if (!archived) return { kind: 'missing' as const };
      if (accountData && nextBalance !== undefined) {
        const [updatedAccount] = await tx.update(workspaceRecords).set({
          data: { ...accountData, balance: nextBalance }, updatedAt: new Date(),
        }).where(and(eq(workspaceRecords.id, accountId), eq(workspaceRecords.organizationId, request.user.organizationId), isNull(workspaceRecords.archivedAt))).returning({ id: workspaceRecords.id });
        if (!updatedAccount) throw new Error('finance_transaction_account_disappeared');
      }
      await tx.insert(activityEvents).values([
        { organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'finance-transactions', entityId: archived.id, action: 'archived', payload: { accountId: accountId || null } },
        ...(accountId ? [{ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'finance-accounts', entityId: accountId, action: 'balance_adjusted', payload: { direction: currentData.direction === 'Entrada' ? 'Sa\u00edda' : 'Entrada', amount: currentData.amount, reason: 'transaction_deleted' } }] : []),
      ]);
      return { kind: 'deleted' as const };
    });
    if (outcome.kind === 'transfer') return reply.code(409).send({ error: 'finance_transfer_managed', message: 'A movimentacao faz parte de uma transferencia pareada e nao pode ser removida separadamente.' });
    if (outcome.kind === 'account_missing') return reply.code(409).send({ error: 'finance_transaction_account_missing', message: 'A conta vinculada nao esta ativa; restaure ou corrija a conta antes de excluir a movimentacao.' });
    if (outcome.kind === 'account_balance_invalid') return reply.code(409).send({ error: 'finance_account_balance_invalid', message: 'O saldo ou a movimentacao vinculada nao pode ser recalculado com seguranca.' });
    if (outcome.kind === 'changed') return reply.code(409).send({ error: 'finance_transaction_changed', message: 'A movimentacao mudou durante a exclusao. Atualize a lista e tente novamente.' });
    if (outcome.kind === 'missing') return reply.code(404).send({ error: 'not_found', message: 'Registro nao encontrado.' });
    return reply.code(204).send();
  }
  if (params.data.resource === 'automations') {
    const [automation] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'automations'), isNull(workspaceRecords.archivedAt))).limit(1);
    if (automation?.data.active === true && automation.data.n8nWorkflowId) {
      if (!process.env.N8N_API_KEY || !process.env.N8N_BASE_URL || !await isIntegrationEnabled(request.user.organizationId, 'n8n')) return reply.code(409).send({ error: 'n8n_workflow_active', message: 'Despublique o workflow do n8n antes de excluir esta automação.' });
      try {
        const workflowId = String(automation.data.n8nWorkflowId);
        await n8nApiRequest(`/workflows/${encodeURIComponent(workflowId)}/${n8nWorkflowActionEndpoint('unpublish')}`, { method: 'POST', body: '{}' });
        const verified = await n8nApiRequest(`/workflows/${encodeURIComponent(workflowId)}`) as Record<string, unknown>;
        if (verified.active === true) return reply.code(502).send({ error: 'n8n_unpublish_not_confirmed', message: 'O n8n não confirmou a despublicação; a automação foi mantida.' });
      } catch { return reply.code(502).send({ error: 'n8n_unpublish_failed', message: 'Não foi possível despublicar no n8n; a automação foi mantida.' }); }
    }
  }
  const [archived] = await db.transaction(async (tx) => {
    const rows = await tx.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, params.data.resource), isNull(workspaceRecords.archivedAt), workspaceRecordScopeWhere(params.data.resource, request.user.permissions?.scope))).returning({ id: workspaceRecords.id });
    if (rows[0]) await tx.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: params.data.resource, entityId: rows[0].id, action: 'archived', payload: {} });
    return rows;
  });
  if (!archived) return reply.code(404).send({ error: 'not_found', message: 'Registro não encontrado.' });
  return reply.code(204).send();
});

app.delete('/api/workspace/clients/:id/portal-link', { preHandler: app.authenticate }, async (request, reply) => {
  try {
  const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'validation_error', message: 'Cliente invãlido.' });
  const [client] = await db.select({ id: workspaceRecords.id, data: workspaceRecords.data }).from(workspaceRecords).where(and(
    eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, request.user.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt),
  )).limit(1);
  if (!client) return reply.code(404).send({ error: 'not_found', message: 'Cliente não encontrado.' });
  const data = client.data as Record<string, unknown>;
  const version = Number(data.portalTokenVersion ?? 0) + 1;
  await db.update(workspaceRecords).set({ data: { ...data, portalTokenVersion: version, portalTokenActive: false, portalTokenExpiresAt: null, portalTokenRevokedAt: new Date().toISOString() }, updatedAt: new Date() }).where(and(eq(workspaceRecords.id, client.id), eq(workspaceRecords.organizationId, request.user.organizationId)));
  await db.insert(activityEvents).values({ organizationId: request.user.organizationId, actorUserId: request.user.sub, entityType: 'client', entityId: client.id, action: 'portal_link_revoked', payload: {} });
  return { data: { revoked: true } };
  } catch (error) {
    request.log.error({ error }, 'Client portal link revocation failed');
    if (process.env.NODE_ENV === 'development' && error instanceof Error) return reply.code(500).send({ error: 'portal_revocation_failed', message: error.message });
    return reply.code(500).send({ error: 'internal_error', message: 'Não foi possível revogar o acesso ao portal.' });
  }
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
  if (!z.string().email().safeParse(clientData.email).success) return reply.code(409).send({ error: 'portal_email_required', message: 'Cadastre um e-mail válido para o cliente antes de ativar o login verificado do portal.' });
  await db.update(workspaceRecords).set({ data: { ...clientData, portalTokenVersion: version, portalTokenActive: true, portalAuthRequired: true, portalTokenCreatedAt: new Date().toISOString(), portalTokenRevokedAt: null, portalTokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() }, updatedAt: new Date() }).where(eq(workspaceRecords.id, client.id));
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

function portalSessionIsValid(request: FastifyRequest, client: Record<string, unknown>, linkClaims: { clientRecordId: string; organizationId: string; version: number }) {
  if (client.portalAuthRequired !== true) return true;
  const bearer = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return false;
  try {
    const session = app.jwt.verify<{ purpose?: string; clientRecordId?: string; organizationId?: string; version?: number }>(bearer);
    return session.purpose === 'client_portal_session' && session.clientRecordId === linkClaims.clientRecordId && session.organizationId === linkClaims.organizationId && session.version === linkClaims.version;
  } catch { return false; }
}

app.post('/api/public/client-portal/:token/request-code', { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const params = z.object({ token: z.string().min(20).max(4096) }).safeParse(request.params);
  const body = parseBody(z.object({ identifier: z.string().trim().min(3).max(254) }), request.body, reply);
  if (!params.success) return reply.code(404).send({ error: 'portal_not_found' });
  if (!body) return;
  const claims = verifyPortalClaims(params.data.token);
  if (!claims) return reply.code(404).send({ error: 'portal_not_found' });
  const [client] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, claims.clientRecordId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt))).limit(1);
  if (!client) return reply.code(404).send({ error: 'portal_not_found' });
  const clientData = client.data as Record<string, unknown>;
  if (clientData.portalAuthRequired !== true || Number(clientData.portalTokenVersion ?? 0) !== claims.version) return reply.code(404).send({ error: 'portal_not_found' });
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL?.trim() || '';
  if (!apiKey || !z.string().email().safeParse(from).success || !await isIntegrationEnabled(claims.organizationId, 'resend')) {
    return reply.code(503).send({ error: 'portal_email_unavailable', message: 'O acesso verificado do portal está temporariamente indisponível. A equipe precisa configurar o envio seguro de e-mail.' });
  }
  await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'portal-auth-challenges'), isNull(workspaceRecords.archivedAt), sql`(${workspaceRecords.data}->>'expiresAt')::timestamptz < now()`));
  const challengeId = randomUUID();
  const rawCode = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  const matched = portalIdentifierMatches(clientData, body.identifier) && z.string().email().safeParse(clientData.email).success;
  const challengeData = { purpose: 'portal_login', clientId: client.id, tokenVersion: claims.version, codeHash: matched ? hashPortalLoginCode(challengeId, rawCode, env.JWT_SECRET) : randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), attempts: 0, consumedAt: null, dummy: !matched };
  await db.insert(workspaceRecords).values({ id: challengeId, organizationId: claims.organizationId, createdBy: null, resource: 'portal-auth-challenges', data: challengeData });
  if (matched) {
    try {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `nexo-portal-${challengeId}` }, body: JSON.stringify({ from, to: [String(clientData.email)], subject: 'Seu código de acesso ao portal Focusshub', text: `Seu código de acesso é ${rawCode}. Ele expira em 10 minutos. Se você não solicitou, ignore este e-mail.`, html: `<p>Seu código de acesso ao portal Focusshub é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${rawCode}</p><p>Ele expira em 10 minutos. Se você não solicitou, ignore este e-mail.</p>` }), signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error('resend_send_failed');
    } catch {
      await db.update(workspaceRecords).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceRecords.id, challengeId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'portal-auth-challenges')));
      return reply.code(202).send({ data: { challengeId, message: 'Se os dados conferirem, enviaremos um codigo para o e-mail cadastrado.' } });
    }
  }
  const maskedEmail = matched ? maskPortalEmail(String(clientData.email)) : '';
  return reply.code(202).send({ data: { challengeId, message: 'Se os dados conferirem, enviaremos um codigo para o e-mail cadastrado.', ...(maskedEmail ? { destination: maskedEmail } : {}) } });
});

app.post('/api/public/client-portal/:token/verify-code', { config: { rateLimit: { max: 6, timeWindow: '10 minutes' } } }, async (request, reply) => {
  const params = z.object({ token: z.string().min(20).max(4096) }).safeParse(request.params);
  const body = parseBody(z.object({ challengeId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/) }), request.body, reply);
  if (!params.success) return reply.code(404).send({ error: 'portal_not_found' });
  if (!body) return;
  const claims = verifyPortalClaims(params.data.token);
  if (!claims) return reply.code(404).send({ error: 'portal_not_found' });
  const verified = await db.transaction(async (tx) => {
    const [challenge] = await tx.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, body.challengeId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'portal-auth-challenges'), isNull(workspaceRecords.archivedAt))).for('update').limit(1);
    if (!challenge) return false;
    const data = challenge.data as Record<string, unknown>;
    const now = new Date();
    const expiry = new Date(String(data.expiresAt || ''));
    if (data.purpose !== 'portal_login' || data.clientId !== claims.clientRecordId || Number(data.tokenVersion) !== claims.version || data.dummy === true || data.consumedAt || !Number.isFinite(expiry.valueOf()) || expiry <= now || Number(data.attempts || 0) >= 5) return false;
    const matched = portalLoginCodeMatches(challenge.id, body.code, env.JWT_SECRET, String(data.codeHash || ''));
    await tx.update(workspaceRecords).set({ data: { ...data, attempts: Number(data.attempts || 0) + 1, ...(matched ? { consumedAt: now.toISOString() } : {}) }, updatedAt: now }).where(eq(workspaceRecords.id, challenge.id));
    return matched;
  });
  if (!verified) return reply.code(400).send({ error: 'portal_code_invalid', message: 'Código inválido ou expirado. Solicite um novo código e tente novamente.' });
  const accessToken = app.jwt.sign({ sub: claims.clientRecordId, role: 'member' as const, purpose: 'client_portal_session', clientRecordId: claims.clientRecordId, organizationId: claims.organizationId, version: claims.version }, { expiresIn: '8h' });
  return { data: { accessToken, expiresIn: '8h' } };
});

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
  if (!portalSessionIsValid(request, client, claims)) return reply.code(401).send({ error: 'portal_verification_required', message: 'Confirme sua identidade com o código enviado ao e-mail cadastrado.' });
  const [preferences] = await db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'settings'), isNull(workspaceRecords.archivedAt),
    sql`${workspaceRecords.data}->>'key' = 'workspace-preferences'`,
  )).limit(1);
  const preferenceSettings = (preferences?.data as Record<string, any> | undefined)?.settings;
  const branding = safeClientPortalBranding(preferenceSettings?.workspace?.brandLogo);
  const clientName = String(client.name ?? client.title ?? 'Cliente');
  const visibility = {
    project: isClientPortalSectionVisible(client, 'project'),
    tasks: isClientPortalSectionVisible(client, 'tasks'),
    contracts: isClientPortalSectionVisible(client, 'contracts'),
    payments: isClientPortalSectionVisible(client, 'payments'),
    approvals: isClientPortalSectionVisible(client, 'approvals'),
  };
  const resources = ['projects', 'tasks', 'contracts', 'approvals'];
  const relatedRows = await Promise.all(resources.map((resource) => db.select().from(workspaceRecords).where(and(
    eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, resource), isNull(workspaceRecords.archivedAt),
  )).orderBy(desc(workspaceRecords.updatedAt)).limit(300)));
  const related = Object.fromEntries(resources.map((resource, index) => [resource, relatedRows[index]!.filter((row) => {
    const data = row.data as Record<string, unknown>;
    return recordBelongsToPortalClient(data, record.id);
  }).map((row) => {
    const data = row.data as Record<string, unknown>;
    const common = { id: row.id, status: data.status };
    if (resource === 'projects') return { ...common, name: data.name ?? data.title ?? '', due: data.due ?? data.dueDate ?? '', progress: data.progress ?? 0 };
    if (resource === 'tasks') return { ...common, title: data.title ?? data.name ?? '', due: data.due ?? data.dueDate ?? '' };
    if (resource === 'contracts') return { ...common, title: data.title ?? data.name ?? '', code: data.code ?? '', renewal: data.renewal ?? '' };
    if (resource === 'approvals') return portalApprovalRecord(row.id, data);
    return { ...common, title: data.title ?? data.name ?? '' };
  })]));
  const [payments, subscriptions] = await Promise.all([
    db.select({ id: billingOrders.id, description: billingOrders.description, amount: billingOrders.amount, status: billingOrders.status, dueAt: billingOrders.dueAt, paymentDetails: billingOrders.paymentDetails, createdAt: billingOrders.createdAt }).from(billingOrders).where(and(
      eq(billingOrders.organizationId, claims.organizationId), eq(billingOrders.workspaceClientId, record.id),
    )).orderBy(desc(billingOrders.createdAt)).limit(100),
    db.select({ id: billingSubscriptions.id, description: billingSubscriptions.description, amount: billingSubscriptions.amount, status: billingSubscriptions.status, dueAt: billingSubscriptions.nextPaymentAt, createdAt: billingSubscriptions.createdAt }).from(billingSubscriptions).where(and(
      eq(billingSubscriptions.organizationId, claims.organizationId), eq(billingSubscriptions.workspaceClientId, record.id),
    )).orderBy(desc(billingSubscriptions.createdAt)).limit(100),
  ]);
  const publicPayments = [
    ...payments.map((item) => {
      const details = item.paymentDetails && typeof item.paymentDetails === 'object' ? item.paymentDetails as Record<string, unknown> : {};
      return { id: item.id, description: item.description, amount: item.amount, status: item.status, dueAt: item.dueAt, paymentDetails: { pixCode: details.pixCode ?? null, ticketUrl: details.ticketUrl ?? null } };
    }),
    ...subscriptions.map((item) => ({ id: item.id, description: item.description, amount: item.amount, status: item.status, dueAt: item.dueAt, paymentDetails: {} })),
  ].sort((a, b) => new Date(b.dueAt || 0).valueOf() - new Date(a.dueAt || 0).valueOf()).slice(0, 100);
  const publicApprovals = visibility.approvals ? (related.approvals ?? []) : [];
  return { data: { client: { name: clientName, person: client.person ?? '' }, branding, projects: visibility.project ? related.projects : [], tasks: visibility.tasks ? related.tasks : [], contracts: visibility.contracts ? related.contracts : [], approvals: publicApprovals, payments: visibility.payments ? publicPayments : [] } };
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
  const clientData = client.data as Record<string, unknown>;
  if (Number(clientData.portalTokenVersion ?? 0) !== claims.version) return reply.code(404).send({ error: 'portal_not_found' });
  if (!portalSessionIsValid(request, clientData, claims)) return reply.code(401).send({ error: 'portal_verification_required', message: 'Confirme sua identidade antes de enviar mensagens.' });
  const name = String(clientData.name ?? 'Cliente');
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
  if (!clientApprovalDecisionHasValidComment(body.decision, body.comment)) return reply.code(400).send({ error: 'approval_comment_required', message: 'Explique o ajuste solicitado em pelo menos 3 caracteres.' });
  const claims = verifyPortalClaims(params.data.token);
  if (!claims) return reply.code(404).send({ error: 'portal_not_found' });
  const [client] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, claims.clientRecordId), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'clients'), isNull(workspaceRecords.archivedAt))).limit(1);
  const [approval] = await db.select().from(workspaceRecords).where(and(eq(workspaceRecords.id, params.data.id), eq(workspaceRecords.organizationId, claims.organizationId), eq(workspaceRecords.resource, 'approvals'), isNull(workspaceRecords.archivedAt))).limit(1);
  if (!client || !approval) return reply.code(404).send({ error: 'approval_not_found' });
  const clientData = client.data as Record<string, unknown>;
  if (Number(clientData.portalTokenVersion ?? 0) !== claims.version) return reply.code(404).send({ error: 'approval_not_found' });
  if (!portalSessionIsValid(request, clientData, claims)) return reply.code(401).send({ error: 'portal_verification_required', message: 'Confirme sua identidade antes de responder à aprovação.' });
  if (!isClientPortalSectionVisible(clientData, 'approvals')) return reply.code(404).send({ error: 'approval_not_found' });
  const approvalData = approval.data as Record<string, unknown>;
  if (!recordBelongsToPortalClient(approvalData, client.id)) return reply.code(404).send({ error: 'approval_not_found' });
  if (!isClientApprovalPending(approvalData.status)) {
    return reply.code(409).send({ error: 'approval_not_pending', message: 'Esta solicitação não aceita mais respostas.' });
  }
  const [saved] = await db.transaction(async (tx) => {
    const [currentApproval] = await tx.select().from(workspaceRecords).where(and(
      eq(workspaceRecords.id, approval.id), eq(workspaceRecords.organizationId, claims.organizationId),
      eq(workspaceRecords.resource, 'approvals'), isNull(workspaceRecords.archivedAt),
    )).for('update').limit(1);
    if (!currentApproval) return [];
    const nextData = clientPortalApprovalDecisionRecord(
      currentApproval.data as Record<string, unknown>, client.id, body.decision, body.comment, new Date().toISOString(),
    );
    if (!nextData) return [];
    const row = await tx.update(workspaceRecords).set({ data: nextData, updatedAt: new Date() }).where(and(
      eq(workspaceRecords.id, currentApproval.id), eq(workspaceRecords.organizationId, claims.organizationId),
      eq(workspaceRecords.resource, 'approvals'), isNull(workspaceRecords.archivedAt),
    )).returning();
    if (!row.length) return [];
    await tx.insert(activityEvents).values({ organizationId: claims.organizationId, entityType: 'client', entityId: client.id, action: `portal_approval_${body.decision}`, payload: { approvalId: currentApproval.id } });
    return row;
  });
  if (!saved) return reply.code(409).send({ error: 'approval_not_pending', message: 'Esta solicitação recebeu outra atualização e não aceita mais esta resposta. Atualize a página para conferir o status.' });
  return { data: { id: saved.id, status: saved.data.status } };
});

async function processOverdueBillingEvents() {
  if (overdueWorkerRunning) return;
  overdueWorkerRunning = true;
  try {
    const now = new Date();
    const expiredOrders = await db.select({
      id: billingOrders.id, organizationId: billingOrders.organizationId, clientId: billingOrders.clientId,
      clientName: billingOrders.clientName, description: billingOrders.description, amount: billingOrders.amount,
      status: billingOrders.status, dueAt: billingOrders.dueAt,
    }).from(billingOrders).where(and(
      eq(billingOrders.status, 'pending'), lte(billingOrders.dueAt, now),
      notExists(db.select({ id: billingOverdueEvents.id }).from(billingOverdueEvents)
        .where(eq(billingOverdueEvents.billingOrderId, billingOrders.id))),
    )).orderBy(asc(billingOrders.dueAt)).limit(100);
    for (const order of expiredOrders) {
      await db.insert(billingOverdueEvents).values({ organizationId: order.organizationId, billingOrderId: order.id })
        .onConflictDoNothing({ target: billingOverdueEvents.billingOrderId });
    }

    const claimed = await db.transaction(async (tx) => {
      const rows = await tx.select().from(billingOverdueEvents).where(and(
        isNull(billingOverdueEvents.deliveredAt), isNull(billingOverdueEvents.discardedAt), lte(billingOverdueEvents.nextAttemptAt, now),
      )).orderBy(asc(billingOverdueEvents.nextAttemptAt)).limit(25).for('update', { skipLocked: true });
      const ready = [];
      const leaseUntil = new Date(now.getTime() + 2 * 60_000);
      for (const row of rows) {
        const [claimedRow] = await tx.update(billingOverdueEvents).set({
          attempts: row.attempts + 1, nextAttemptAt: leaseUntil, updatedAt: now,
        }).where(eq(billingOverdueEvents.id, row.id)).returning();
        if (claimedRow) ready.push(claimedRow);
      }
      return ready;
    });

    for (const dispatch of claimed) {
      const [order] = await db.select({
        id: billingOrders.id, clientId: billingOrders.clientId, clientName: billingOrders.clientName,
        description: billingOrders.description, amount: billingOrders.amount, status: billingOrders.status, dueAt: billingOrders.dueAt,
      }).from(billingOrders).where(and(
        eq(billingOrders.id, dispatch.billingOrderId), eq(billingOrders.organizationId, dispatch.organizationId),
      )).limit(1);
      const record = order ? buildOverduePaymentEvent(order, now) : null;
      if (!record) {
        await db.update(billingOverdueEvents).set({ discardedAt: now, lastError: 'billing_order_not_pending_or_not_due', updatedAt: now })
          .where(eq(billingOverdueEvents.id, dispatch.id));
        continue;
      }
      const delivered = await sendN8nEvent(dispatch.organizationId, 'payment.overdue', record, dispatch.eventId);
      if (delivered) {
        await db.update(billingOverdueEvents).set({ deliveredAt: new Date(), lastError: null, updatedAt: new Date() })
          .where(eq(billingOverdueEvents.id, dispatch.id));
      } else {
        const retryAt = new Date(Date.now() + overduePaymentRetryDelayMs(dispatch.attempts));
        await db.update(billingOverdueEvents).set({
          nextAttemptAt: retryAt, lastError: 'n8n_workflow_unavailable_or_delivery_failed', updatedAt: new Date(),
        }).where(eq(billingOverdueEvents.id, dispatch.id));
      }
    }
  } catch (error) {
    app.log.error({ error: error instanceof Error ? error.name : 'unknown' }, 'Overdue billing automation scan failed');
  } finally {
    overdueWorkerRunning = false;
  }
}

app.setErrorHandler((error, request, reply) => {
  if (reply.sent) return;
  if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 429) {
    app.log.warn({ route: request.routeOptions.url || 'unmatched' }, 'Rate limit reached');
    return reply.code(429).send({ error: 'rate_limited', message: 'Muitas solicitações em pouco tempo. Aguarde alguns segundos e tente novamente.' });
  }
  app.log.error(error);
  if (reply.statusCode >= 500 && process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: { method: request.method, route: request.routeOptions.url || 'unmatched', statusCode: reply.statusCode } });
  }
  if (error instanceof Error && 'code' in error && error.code === '23505') return reply.code(409).send({ error: 'conflict', message: 'Já existe um registro com esses dados.' });
  return reply.code(500).send({ error: 'internal_error', message: 'Não foi possível concluir a solicitação.' });
});

app.addHook('onClose', async () => {
  if (overdueWorkerTimer) clearInterval(overdueWorkerTimer);
  if (n8nDeliveryWorkerTimer) clearInterval(n8nDeliveryWorkerTimer);
  if (siteMonitorWorkerTimer) clearInterval(siteMonitorWorkerTimer);
  await pool.end();
});
try {
  if (process.env.RUN_MIGRATIONS !== 'false') await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
  const ownerId = await db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${env.OWNER_EMAIL}`).limit(1);
    if (!owner) return null;
    await tx.update(users).set({ active: true, role: 'owner' }).where(eq(users.id, owner.id));
    return owner.id;
  });
  if (ownerId === null) app.log.error('Owner account is missing; authenticated startup is unavailable.');
  else {
    ownerAccountId = ownerId;
    app.log.info('Owner account configured. Other accounts require an explicit team invitation before sign-in.');
  }
  await app.listen({ port: env.PORT, host: env.HOST });
  overdueWorkerTimer = setInterval(() => { void processOverdueBillingEvents(); }, 60_000);
  overdueWorkerTimer.unref();
  void processOverdueBillingEvents();
  n8nDeliveryWorkerTimer = setInterval(() => { void processN8nEventDeliveries(); }, 15_000);
  n8nDeliveryWorkerTimer.unref();
  void processN8nEventDeliveries();
  siteMonitorWorkerTimer = setInterval(() => { void processScheduledSiteChecks(); }, 60_000);
  siteMonitorWorkerTimer.unref();
  void processScheduledSiteChecks();
}
catch (error) { app.log.error(error); process.exit(1); }
