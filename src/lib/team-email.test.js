import assert from 'node:assert/strict';
import test from 'node:test';
import { hasTeamEmailConflict, normalizeTeamEmail } from './team-email.js';

test('normalizes surrounding whitespace and case for operational team email checks', () => {
  assert.equal(normalizeTeamEmail('  Sales@Example.com  '), 'sales@example.com');
  assert.equal(hasTeamEmailConflict([{ id: 1, email: ' Sales@Example.com ' }], 'sales@example.com'), true);
});

test('allows empty emails and editing the same person while still blocking another person', () => {
  const people = [{ id: 1, email: 'person@example.com' }, { id: 2, email: 'other@example.com' }];
  assert.equal(hasTeamEmailConflict(people, ''), false);
  assert.equal(hasTeamEmailConflict(people, 'person@example.com', 1), false);
  assert.equal(hasTeamEmailConflict(people, 'PERSON@example.com', 2), true);
});
