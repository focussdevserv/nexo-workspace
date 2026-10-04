import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { firstActiveLeadStage, isPublicLeadPhoneValid, normalizePublicLeadContact, publicLeadIsSpam, publicLeadPayloadSchema, publicLeadTaskData } from '../src/crm/public-lead.ts';

const valid = { name: 'Ana Silva', email: 'ana@example.com', contactConsent: true, marketingConsent: false, startedAt: 10_000 };

test('accepts strict public lead payload with separate consent values', () => {
  assert.equal(publicLeadPayloadSchema.safeParse(valid).success, true);
  assert.equal(publicLeadPayloadSchema.safeParse({ ...valid, unexpected: 'value' }).success, false);
  assert.equal(publicLeadPayloadSchema.safeParse({ ...valid, contactConsent: false }).success, false);
  assert.equal(publicLeadPayloadSchema.safeParse({ ...valid, marketingConsent: true }).data?.marketingConsent, true);
});

test('rejects missing contact channel and invalid email', () => {
  assert.equal(publicLeadPayloadSchema.safeParse({ ...valid, email: '' }).success, false);
  assert.equal(publicLeadPayloadSchema.safeParse({ ...valid, email: 'bad' }).success, false);
  assert.equal(publicLeadPayloadSchema.safeParse({ ...valid, email: undefined, phone: '(11) 99999-1234' }).success, true);
  assert.equal(publicLeadPayloadSchema.safeParse({ ...valid, email: '', phone: 'abcdefgh' }).success, false);
  assert.equal(publicLeadPayloadSchema.safeParse({ ...valid, email: '', phone: '123' }).success, false);
  assert.equal(isPublicLeadPhoneValid('+1 (415) 555-0100'), true);
  assert.equal(isPublicLeadPhoneValid('1234567'), false);
});

test('flags honeypot, too-fast, future, and stale submissions', () => {
  assert.equal(publicLeadIsSpam({ website: 'bot', startedAt: 1_000 }, 5_000), true);
  assert.equal(publicLeadIsSpam({ startedAt: 4_000 }, 5_000), true);
  assert.equal(publicLeadIsSpam({ startedAt: 6_000 }, 5_000), true);
  assert.equal(publicLeadIsSpam({ startedAt: 1_000 }, 90_000_000), true);
  assert.equal(publicLeadIsSpam({ startedAt: 2_000 }, 5_000), false);
});

test('creates one follow-up task shape tied to the new lead', () => {
  const task = publicLeadTaskData('Ana Silva', 'lead-id', 'Quero orçamento');
  assert.equal(task.leadId, 'lead-id');
  assert.equal(task.description, 'Quero orçamento');
  assert.equal(task.status, 'Pendente');
});

test('normalizes contact values canonically and selects the first active non-terminal stage', () => {
  assert.deepEqual(normalizePublicLeadContact({ email: ' ANA@EXAMPLE.COM ', phone: '+55 (11) 99999-1234' }), { email: 'ana@example.com', phone: '11999991234' });
  assert.deepEqual(normalizePublicLeadContact({ email: 'ana@example.com', phone: 'not a phone' }), { email: 'ana@example.com', phone: '' });
  assert.equal(firstActiveLeadStage({ stages: ['Fechado', 'Perdido'] }), 'Novo lead');
  assert.equal(firstActiveLeadStage({ stages: ['Entrada', 'Fechado', 'Perdido'] }), 'Entrada');
  assert.equal(firstActiveLeadStage(null), 'Novo lead');
});

const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
const configRoutes = server.slice(server.indexOf("app.get('/api/workspace/crm/public-lead-form'"), server.indexOf("app.post('/api/public/crm/leads/:slug'"));
const intakeRoute = server.slice(server.indexOf("app.post('/api/public/crm/leads/:slug'"), server.indexOf("app.get('/api/workspace/assignees'"));

test('public lead configuration GET and PUT are owner-only and strictly validate mutation input', () => {
  assert.equal((configRoutes.match(/request\.user\.role !== 'owner'/g) ?? []).length, 2);
  assert.match(configRoutes, /z\.object\(\{ enabled: z\.boolean\(\) \}\)\.strict\(\)/);
  assert.match(configRoutes, /pg_advisory_xact_lock/);
});

test('public intake handles only enabled known forms and is rate limited', () => {
  assert.match(intakeRoute, /rateLimit: \{ max: 6, timeWindow: '1 minute' \}/);
  assert.match(intakeRoute, /sql`\$\{workspaceRecords\.data\}->>'enabled' = 'true'`/);
  assert.match(intakeRoute, /if \(!config\).*form_unavailable/s);
  assert.match(intakeRoute, /publicLeadPayloadSchema\.safeParse/);
  assert.match(intakeRoute, /publicLeadIsSpam\(payload\.data\)/);
});

test('tenant-scoped locked deduplication creates lead, task and automation outbox atomically', () => {
  assert.match(intakeRoute, /eq\(workspaceRecords\.organizationId, config\.organizationId\)/);
  assert.match(intakeRoute, /pg_advisory_xact_lock\(hashtext\(\$\{config\.organizationId\}\), hashtext\('public-lead-contact-dedupe'\)\)/);
  assert.match(intakeRoute, /if \(prior\) return prior\.createRequestHash === requestHash \? 'replay' as const : 'key_conflict' as const/);
  assert.match(intakeRoute, /findDuplicateLead\(/);
  assert.match(intakeRoute, /await tx\.insert\(workspaceRecords\).*resource: 'leads'/s);
  assert.match(intakeRoute, /await tx\.insert\(workspaceRecords\).*resource: 'tasks'/s);
  assert.match(intakeRoute, /Persist the automation event with the lead and task/);
  assert.match(intakeRoute, /await tx\.insert\(n8nEventDeliveries\)/);
  assert.match(intakeRoute, /if \(submitResult === 'created' && createdLead && leadCreatedEventQueued\) void processN8nEventDeliveries\(\)/);
  assert.match(intakeRoute, /stage: firstActiveLeadStage\(stageConfig\?\.data\)/);
});
