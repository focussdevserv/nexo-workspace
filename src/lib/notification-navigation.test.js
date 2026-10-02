import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationNavigationTarget } from './notification-navigation.js';

test('opens a task, event, or client notification on its exact record', () => {
  assert.deepEqual(notificationNavigationTarget({ entityType: 'tasks', entityId: 'task-1', page: 'Tarefas' }), { page: 'Tarefas', context: { taskId: 'task-1' } });
  assert.deepEqual(notificationNavigationTarget({ entityType: 'events', entityId: 'event-1', page: 'Agenda' }), { page: 'Agenda', context: { eventId: 'event-1' } });
  assert.deepEqual(notificationNavigationTarget({ entityType: 'client', entityId: 'client-1', page: 'Clientes' }), { page: 'Clientes', context: { clientId: 'client-1' } });
});

test('preserves task reminder targeting and falls back to the notification page', () => {
  assert.deepEqual(notificationNavigationTarget({ taskId: 'task-2', page: 'Tarefas' }), { page: 'Tarefas', context: { taskId: 'task-2' } });
  assert.deepEqual(notificationNavigationTarget({ page: 'Cobranças', context: { filter: 'overdue' } }), { page: 'Cobranças', context: { filter: 'overdue' } });
  assert.deepEqual(notificationNavigationTarget({}), { page: 'Meu Dia', context: null });
});
