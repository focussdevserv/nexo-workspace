import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canonicalTicketClientData, ticketClientIdFromDraft } from '../src/support/ticket-client.ts';

test('ticket creation requires a valid workspace client identifier', () => {
  assert.equal(ticketClientIdFromDraft({}), null);
  assert.equal(ticketClientIdFromDraft({ clientId: '' }), null);
  assert.equal(ticketClientIdFromDraft({ clientId: 'client-123' }), null);
  assert.equal(ticketClientIdFromDraft({ clientId: '00000000-0000-0000-0000-000000000000' }), null);
  assert.equal(ticketClientIdFromDraft({ clientId: '8ab702c3-2322-4cb4-bf34-cb65b2cb80a0' }), '8ab702c3-2322-4cb4-bf34-cb65b2cb80a0');
});

test('ticket client label and identifier come from the canonical workspace record', () => {
  assert.deepEqual(canonicalTicketClientData({ title: 'Falha', client: 'nome forjado', clientId: 'old' }, {
    id: 'client-1', data: { name: ' Cliente Real ' },
  }), { title: 'Falha', client: 'Cliente Real', clientId: 'client-1' });
  assert.equal(canonicalTicketClientData({}, { id: 'client-2', data: {} }).client, '');
});

test('ticket creation route validates and locks an active same-workspace client before emitting automation', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/workspace/:resource'");
  const end = source.indexOf("app.patch('/api/workspace/:resource/:id'", start);
  assert.ok(start >= 0 && end > start, 'generic workspace create route exists');
  const route = source.slice(start, end);
  assert.match(route, /ticketClientIdFromDraft\(body\.data\)/);
  assert.match(route, /eq\(workspaceRecords\.organizationId, request\.user\.organizationId\)[\s\S]*eq\(workspaceRecords\.resource, 'clients'\)[\s\S]*isNull\(workspaceRecords\.archivedAt\)/);
  assert.match(route, /\.for\('share'\)/);
  assert.match(route, /recordMatchesWorkspaceScope\('clients', linkedClient\.id, linkedClient\.data, recordScope\)/);
  assert.match(route, /canonicalTicketClientData\(body\.data, ticketClient\)/);
  assert.match(route, /enqueueN8nEvent\(request\.user\.organizationId, 'ticket\.created'/);
});
