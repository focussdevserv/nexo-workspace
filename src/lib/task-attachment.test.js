import test from 'node:test';
import assert from 'node:assert/strict';
import { withoutTaskAttachment } from './task-attachment.js';

test('withoutTaskAttachment removes only the reference and preserves task data', () => {
  const task = {
    id: 'task-1',
    title: 'Revisar proposta',
    attachment: { name: 'proposta.pdf', driveFileId: 'drive-1' },
    comments: [{ id: 1, text: 'Enviada' }],
  };

  const result = withoutTaskAttachment(task);

  assert.deepEqual(result, { ...task, attachment: null, updatedAt: result.updatedAt });
  assert.ok(result.updatedAt);
  assert.deepEqual(task.attachment, { name: 'proposta.pdf', driveFileId: 'drive-1' });
});

test('withoutTaskAttachment leaves non-object values alone', () => {
  assert.equal(withoutTaskAttachment(null), null);
});
