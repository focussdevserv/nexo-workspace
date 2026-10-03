import assert from 'node:assert/strict';
import test from 'node:test';
import { copyTextToClipboard } from './copy-to-clipboard.js';

test('uses the clipboard API when it is available', async () => {
  const copied = [];
  assert.equal(await copyTextToClipboard('https://example.test/invite', {
    clipboard: { writeText: async (value) => copied.push(value) },
  }), true);
  assert.deepEqual(copied, ['https://example.test/invite']);
});

test('falls back to a temporary selection when browser clipboard access is blocked', async () => {
  let activeElement = { focus() { this.focused = true; } };
  let selectedValue = '';
  let removed = false;
  const field = {
    style: {}, setAttribute() {}, focus() {}, select() { selectedValue = this.value; },
    remove() { removed = true; },
  };
  const document = {
    get activeElement() { return activeElement; },
    createElement: () => field,
    body: { appendChild: (element) => { activeElement = element; } },
    execCommand: (command) => command === 'copy',
  };

  assert.equal(await copyTextToClipboard('invite-link', {
    clipboard: { writeText: async () => { throw new Error('clipboard denied'); } },
    document,
  }), true);
  assert.equal(selectedValue, 'invite-link');
  assert.equal(removed, true);
});

test('returns false when no clipboard mechanism is available', async () => {
  assert.equal(await copyTextToClipboard('invite-link', { document: {} }), false);
  assert.equal(await copyTextToClipboard('', { clipboard: { writeText: async () => {} } }), false);
});
