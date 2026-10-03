import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskRecord } from './task-create.js';

test('new task record preserves its description and links while aligning open status fields', () => {
  assert.deepEqual(buildTaskRecord({
    id: 'task-id', title: '  Revisar homepage  ', project: 'Site', projectId: 'p1', client: 'Cliente', clientId: 'c1',
    due: '2026-10-09', assignee: '  Ana  ', priority: 'Alta', recurrence: 'Semanal', description: '  Validar no celular.  ',
  }), {
    id: 'task-id', title: 'Revisar homepage', project: 'Site', projectId: 'p1', client: 'Cliente', clientId: 'c1',
    due: '2026-10-09', assignee: 'Ana', status: 'A fazer', state: 'A fazer', priority: 'Alta', recurrence: 'Semanal', recurrenceSequence: 1,
    description: 'Validar no celular.',
  });
});

test('new task record has usable defaults for optional associations and scheduling', () => {
  const task = buildTaskRecord({ id: 'task-id', title: 'Ligar para cliente' });
  assert.equal(task.project, 'Sem projeto');
  assert.equal(task.client, 'Sem cliente');
  assert.equal(task.due, 'A definir');
  assert.equal(task.recurrence, 'Nao recorrente');
  assert.equal(task.description, '');
});
