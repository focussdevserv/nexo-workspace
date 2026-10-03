import test from 'node:test';
import assert from 'node:assert/strict';
import { copyPaymentText } from './copy-payment-text.js';

test('uses the browser clipboard API when available', async () => {
  const writes = [];
  assert.equal(await copyPaymentText('pix-code', { clipboard: { writeText: async (text) => writes.push(text) } }), true);
  assert.deepEqual(writes, ['pix-code']);
});

test('falls back to a temporary textarea when clipboard permission is denied', async () => {
  const appended = [];
  let removed = false;
  let copiedText = '';
  const field = {
    value: '',
    style: {},
    setAttribute() {},
    focus() {},
    select() { copiedText = this.value; },
    remove() { removed = true; },
  };
  const document = {
    body: { append(element) { appended.push(element); } },
    createElement: () => field,
    execCommand: (command) => command === 'copy',
  };

  const copied = await copyPaymentText('https://pay.example/charge', {
    clipboard: { writeText: async () => { throw new Error('permission denied'); } },
    document,
  });

  assert.equal(copied, true);
  assert.equal(copiedText, 'https://pay.example/charge');
  assert.equal(appended.length, 1);
  assert.equal(removed, true);
});

test('reports unavailable clipboard fallback and rejects empty values', async () => {
  assert.equal(await copyPaymentText('pix-code', { clipboard: null, document: {} }), false);
  assert.equal(await copyPaymentText('', { clipboard: { writeText: async () => assert.fail('must not write') } }), false);
});
