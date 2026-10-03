import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardLayoutStorageKey, normalizeDashboardLayout, readDashboardLayout, writeDashboardLayout } from './dashboard-layout-preferences.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('Meu Dia layout defaults to all panels and retains valid per-user choices', () => {
  const storage = memoryStorage();
  const key = dashboardLayoutStorageKey('user-1');
  assert.deepEqual(readDashboardLayout(storage, key), { summary: true, leads: true, tasks: true, inbox: true, agenda: true, alerts: true });
  assert.equal(writeDashboardLayout(storage, key, { summary: false, inbox: false }), true);
  assert.deepEqual(readDashboardLayout(storage, key), { summary: false, leads: true, tasks: true, inbox: false, agenda: true, alerts: true });
  assert.notEqual(dashboardLayoutStorageKey('user-1'), dashboardLayoutStorageKey('user-2'));
});

test('Meu Dia layout ignores unknown and malformed stored values and tolerates blocked storage', () => {
  assert.deepEqual(normalizeDashboardLayout({ tasks: false, custom: false }), { summary: true, leads: true, tasks: false, inbox: true, agenda: true, alerts: true });
  assert.equal(readDashboardLayout({ getItem: () => '{invalid' }, 'key').tasks, true);
  assert.equal(writeDashboardLayout({ setItem: () => { throw new Error('quota'); } }, 'key', {}), false);
});
