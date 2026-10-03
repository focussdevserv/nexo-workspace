import assert from 'node:assert/strict';
import test from 'node:test';
import { averageActiveTeamLoad } from './team-capacity.js';

test('averages only active operational team members', () => {
  assert.equal(averageActiveTeamLoad([
    { status: 'Ativo', load: 25 },
    { status: 'Ativo', load: 50 },
    { status: 'Inativo', load: 100 },
  ]), 38);
});

test('returns no percentage when nobody active has a valid capacity value', () => {
  assert.equal(averageActiveTeamLoad([]), null);
  assert.equal(averageActiveTeamLoad([{ status: 'Inativo', load: 45 }]), null);
  assert.equal(averageActiveTeamLoad([{ status: 'Ativo', load: 'invalid' }]), null);
});

test('clamps legacy out-of-range capacity values to the displayed 0–100% scale', () => {
  assert.equal(averageActiveTeamLoad([
    { status: 'Ativo', load: 140 },
    { status: 'Ativo', load: -20 },
  ]), 50);
});
