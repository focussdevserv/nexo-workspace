import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientFromLead } from '../src/crm/lead-conversion.js';

test('converts a company opportunity into a linked client with contact and service data', () => {
  const client = buildClientFromLead({ id: 'lead-1', name: 'Ana Silva', company: 'Acme', email: ' ANA@ACME.COM ', phone: '+55 11 90000-0000', service: 'Site', source: 'Indicacao', value: 'R$ 2.500,00', notes: 'Briefing feito' }, new Date('2026-10-01T12:00:00Z'));
  assert.equal(client.name, 'Acme');
  assert.equal(client.person, 'Ana Silva');
  assert.equal(client.email, 'ana@acme.com');
  assert.equal(client.leadId, 'lead-1');
  assert.deepEqual(client.services, ['Site']);
  assert.equal(client.since, '2026-10-01');
});

test('uses the lead contact name when no company was supplied', () => {
  assert.equal(buildClientFromLead({ id: 'lead-2', name: 'Bruno' }).name, 'Bruno');
});
