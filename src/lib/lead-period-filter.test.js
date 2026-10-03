import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLeadsByPeriod } from './lead-period-filter.js';

const now = new Date('2026-10-01T12:00:00Z');
const leads = [
  { id: 'today', createdAt: '2026-10-01T10:00:00Z' },
  { id: 'week', createdAt: '2026-09-28T10:00:00Z' },
  { id: 'month', createdAt: '2026-09-10T10:00:00Z' },
  { id: 'old', createdAt: '2026-07-15T10:00:00Z' },
  { id: 'undated', date: 'Agora' },
];

test('filters pipeline leads by rolling 7, 30, and 90 day windows', () => {
  assert.deepEqual(filterLeadsByPeriod(leads, 'last7', now).map((lead) => lead.id), ['today', 'week']);
  assert.deepEqual(filterLeadsByPeriod(leads, 'last30', now).map((lead) => lead.id), ['today', 'week', 'month']);
  assert.deepEqual(filterLeadsByPeriod(leads, 'last90', now).map((lead) => lead.id), ['today', 'week', 'month', 'old']);
});

test('keeps undated leads available through an explicit filter', () => {
  assert.deepEqual(filterLeadsByPeriod(leads, 'undated', now).map((lead) => lead.id), ['undated']);
  assert.equal(filterLeadsByPeriod(leads, 'all', now), leads);
});

test('falls back to a valid legacy date when createdAt aliases are malformed', () => {
  const legacyLead = {
    id: 'legacy',
    createdAt: 'not-a-date',
    created_at: '',
    date: '2026-09-28T10:00:00Z',
  };

  assert.deepEqual(filterLeadsByPeriod([legacyLead], 'last7', now), [legacyLead]);
  assert.deepEqual(filterLeadsByPeriod([legacyLead], 'undated', now), []);
});
