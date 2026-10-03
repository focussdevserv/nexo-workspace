import assert from 'node:assert/strict';
import test from 'node:test';
import { handleDialogEscape, restoreDialogFocus } from './dialog-dismiss.js';

test('Escape closes an idle dialog and consumes the key', () => {
  let closed = 0;
  let prevented = 0;
  const handled = handleDialogEscape({ key: 'Escape', preventDefault: () => { prevented += 1; } }, { onClose: () => { closed += 1; } });
  assert.equal(handled, true);
  assert.equal(closed, 1);
  assert.equal(prevented, 1);
});

test('Escape does not dismiss a dialog while an asynchronous action is running', () => {
  let closed = 0;
  let prevented = 0;
  const handled = handleDialogEscape({ key: 'Escape', preventDefault: () => { prevented += 1; } }, { busy: true, onClose: () => { closed += 1; } });
  assert.equal(handled, false);
  assert.equal(closed, 0);
  assert.equal(prevented, 0);
});

test('focus returns only to a still-connected opener', () => {
  let focused = 0;
  const opener = { isConnected: true, focus: () => { focused += 1; } };
  assert.equal(restoreDialogFocus(opener), true);
  assert.equal(restoreDialogFocus({ isConnected: false, focus: () => { focused += 1; } }), false);
  assert.equal(focused, 1);
});
