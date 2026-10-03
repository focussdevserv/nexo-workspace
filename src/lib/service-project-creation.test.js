import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommercialSubmissionLock } from './commercial-submission-lock.js';
import { createServiceProjectOnce } from './service-project-creation.js';

test('service project creation submits one project and task bundle when clicks overlap', async () => {
  const lock = createCommercialSubmissionLock();
  let finishCreate;
  let calls = 0;
  const create = () => {
    calls += 1;
    return new Promise((resolve) => { finishCreate = resolve; });
  };
  const service = { name: 'Site institucional', templateTasks: ['Briefing', 'Publicação'] };
  const client = { id: 'client-1', name: 'Acme' };

  const first = createServiceProjectOnce(lock, service, client, create);
  assert.equal(await createServiceProjectOnce(lock, service, client, create), false);
  assert.equal(calls, 1);
  finishCreate();
  const result = await first;

  assert.equal(result.project.clientId, 'client-1');
  assert.equal(result.tasks.length, 2);
  assert.equal(calls, 1);
  assert.ok(await createServiceProjectOnce(lock, service, client, async () => { calls += 1; }));
  assert.equal(calls, 2);
});

test('failed creation releases the lock so the user can retry', async () => {
  const lock = createCommercialSubmissionLock();
  await assert.rejects(createServiceProjectOnce(lock, { name: 'Site' }, { id: 'c1', name: 'Acme' }, async () => {
    throw new Error('network');
  }), /network/);
  const result = await createServiceProjectOnce(lock, { name: 'Site' }, { id: 'c1', name: 'Acme' }, async () => {});
  assert.ok(result.project);
});
