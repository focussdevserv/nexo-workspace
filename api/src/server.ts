import 'dotenv/config';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import argon2 from 'argon2';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db, pool } from './db/index.js';
import { activityEvents, clients, organizations, users } from './db/schema.js';

const env = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  BOOTSTRAP_TOKEN: z.string().default(''),
}).parse(process.env);

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024, trustProxy: process.env.TRUST_PROXY === 'true' });
await app.register(helmet);
await app.register(cors, { origin: env.APP_ORIGIN.split(',').map((origin) => z.string().url().parse(origin.trim())), credentials: true });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: '8h' } });

app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  try { await request.jwtVerify(); }
  catch { return reply.code(401).send({ error: 'unauthorized', message: 'Sessão inválida ou expirada.' }); }
});

const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
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

function parseBody<T>(schema: z.ZodType<T>, body: unknown, reply: FastifyReply): T | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) { reply.code(400).send({ error: 'validation_error', message: 'Confira os campos enviados.', details: parsed.error.flatten().fieldErrors }); return undefined; }
  return parsed.data;
}

app.get('/api/health', async (_request, reply) => {
  try { await pool.query('select 1'); return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() }; }
  catch { return reply.code(503).send({ status: 'degraded', database: 'unavailable' }); }
});

app.post('/api/auth/register', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
  const body = parseBody(registerSchema, request.body, reply); if (!body) return;
  const suppliedToken = request.headers['x-bootstrap-token'];
  const expectedToken = Buffer.from(env.BOOTSTRAP_TOKEN);
  const receivedToken = Buffer.from(typeof suppliedToken === 'string' ? suppliedToken : '');
  if (!expectedToken.length || expectedToken.length !== receivedToken.length || !timingSafeEqual(expectedToken, receivedToken)) return reply.code(403).send({ error: 'bootstrap_forbidden', message: 'Cadastro inicial não autorizado.' });
  const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(928461237)`);
    const [existingEmail] = await tx.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (existingEmail) return { conflict: 'email' as const };
    const [existingUser] = await tx.select({ id: users.id }).from(users).limit(1);
    if (existingUser) return { conflict: 'bootstrap_closed' as const };
    const [organization] = await tx.insert(organizations).values({ name: body.organizationName }).returning({ id: organizations.id, name: organizations.name });
    const [user] = await tx.insert(users).values({ organizationId: organization!.id, name: body.name, email: body.email, passwordHash }).returning({ id: users.id, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId });
    await tx.insert(activityEvents).values({ organizationId: organization!.id, actorUserId: user!.id, entityType: 'organization', entityId: organization!.id, action: 'created' });
    return { organization: organization!, user: user! };
  });
  if ('conflict' in result) return reply.code(409).send(result.conflict === 'email' ? { error: 'email_in_use', message: 'Este e-mail já possui uma conta.' } : { error: 'bootstrap_closed', message: 'A conta inicial já foi criada.' });
  const token = app.jwt.sign({ sub: result.user.id, organizationId: result.organization.id, role: result.user.role });
  return reply.code(201).send({ token, user: result.user, organization: result.organization });
});

app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const body = parseBody(loginSchema, request.body, reply); if (!body) return;
  const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  if (!user || !user.active || !(await argon2.verify(user.passwordHash, body.password))) return reply.code(401).send({ error: 'invalid_credentials', message: 'E-mail ou senha incorretos.' });
  const token = app.jwt.sign({ sub: user.id, organizationId: user.organizationId, role: user.role });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId } };
});

app.get('/api/auth/me', { preHandler: app.authenticate }, async (request, reply) => {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId }).from(users).where(and(eq(users.id, request.user.sub), eq(users.active, true))).limit(1);
  if (!user) return reply.code(401).send({ error: 'unauthorized', message: 'Conta indisponível.' });
  const [organization] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
  return { user, organization };
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

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  if (reply.sent) return;
  if (error instanceof Error && 'code' in error && error.code === '23505') return reply.code(409).send({ error: 'conflict', message: 'Já existe um registro com esses dados.' });
  return reply.code(500).send({ error: 'internal_error', message: 'Não foi possível concluir a solicitação.' });
});

app.addHook('onClose', async () => { await pool.end(); });
try {
  if (process.env.RUN_MIGRATIONS !== 'false') await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
  await app.listen({ port: env.PORT, host: env.HOST });
}
catch (error) { app.log.error(error); process.exit(1); }
