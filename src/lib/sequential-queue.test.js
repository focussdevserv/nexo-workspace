import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequentialQueue } from './sequential-queue.js';

test('serializes concurrent file operations in enqueue order', async () => {
  const queue = createSequentialQueue();
  const order = [];
  let active = 0;
  let maxActive = 0;
  const run = (name) => queue.enqueue(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push(`${name}:start`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    order.push(`${name}:end`);
    active -= 1;
  });

  await Promise.all([run('first'), run('second'), run('third')]);
  assert.equal(maxActive, 1);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start', 'second:end', 'third:start', 'third:end']);
});

test('a failed operation does not prevent later queued files from being processed', async () => {
  const queue = createSequentialQueue();
  const order = [];
  const failed = queue.enqueue(async () => { order.push('failed'); throw new Error('upload failed'); });
  const next = queue.enqueue(async () => { order.push('next'); return 'saved'; });

  await assert.rejects(failed, /upload failed/);
  assert.equal(await next, 'saved');
  assert.deepEqual(order, ['failed', 'next']);
});
