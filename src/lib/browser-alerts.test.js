import assert from 'node:assert/strict';
import test from 'node:test';
import { isWithinWorkspaceQuietHours, shouldSendActivityBrowserAlert, taskReminderCandidates } from './browser-alerts.js';

test('activity alerts follow channel/category preferences and require a hidden, permitted browser', () => {
  const preferences = { browser: true, newLead: true, proposal: false, payment: true };
  const options = { permission: 'granted', visible: false, now: new Date('2026-10-02T15:00:00Z'), timeZone: 'America/Sao_Paulo' };
  assert.equal(shouldSendActivityBrowserAlert({ entityType: 'leads' }, preferences, options), true);
  assert.equal(shouldSendActivityBrowserAlert({ entityType: 'proposals' }, preferences, options), false);
  assert.equal(shouldSendActivityBrowserAlert({ entityType: 'billing_order' }, preferences, options), true);
  assert.equal(shouldSendActivityBrowserAlert({ entityType: 'leads' }, preferences, { ...options, visible: true }), false);
  assert.equal(shouldSendActivityBrowserAlert({ entityType: 'leads' }, preferences, { ...options, permission: 'denied' }), false);
  assert.equal(shouldSendActivityBrowserAlert({ entityType: 'tickets' }, preferences, options), false);
});

test('quiet hours support ranges that cross midnight in the workspace timezone', () => {
  const prefs = { quietHours: true, quietStart: '22:00', quietEnd: '07:00' };
  assert.equal(isWithinWorkspaceQuietHours(new Date('2026-10-02T01:30:00Z'), prefs, 'America/Sao_Paulo'), true);
  assert.equal(isWithinWorkspaceQuietHours(new Date('2026-10-02T15:00:00Z'), prefs, 'America/Sao_Paulo'), false);
  assert.equal(isWithinWorkspaceQuietHours(new Date('2026-10-02T01:30:00Z'), { ...prefs, quietStart: '07:00', quietEnd: '22:00' }, 'America/Sao_Paulo'), false);
});

test('task reminders use workspace calendar dates, skip completed items and respect category switches', () => {
  const tasks = [
    { id: 'tomorrow', title: 'Entregar página', due: '2026-10-02', status: 'Pendente' },
    { id: 'overdue', title: 'Revisar contrato', due: '2026-09-30', status: 'Em andamento' },
    { id: 'done', title: 'Tarefa concluída', due: '2026-09-30', status: 'Concluída' },
    { id: 'far', title: 'Sem urgência', due: '2026-10-10', status: 'Pendente' },
  ];
  const options = { permission: 'granted', now: new Date('2026-10-02T01:30:00Z'), timeZone: 'America/Sao_Paulo' };
  const candidates = taskReminderCandidates(tasks, { browser: true, taskDue: true, overdue: true }, options);
  assert.deepEqual(candidates.map((item) => item.key), ['tomorrow:due:2026-10-02', 'overdue:overdue:2026-09-30']);
  assert.equal(candidates[0].body, 'Entregar página · vence amanhã.');
  assert.deepEqual(taskReminderCandidates(tasks, { browser: true, taskDue: false, overdue: true }, options).map((item) => item.key), ['overdue:overdue:2026-09-30']);
  assert.deepEqual(taskReminderCandidates(tasks, { browser: true, taskDue: true, overdue: true }, { ...options, permission: 'denied' }), []);
});
