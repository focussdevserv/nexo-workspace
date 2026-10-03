import assert from 'node:assert/strict';
import test from 'node:test';
import { inboxChannelSelection, setInboxChannelSelection } from './inbox-channel-selection.js';

test('remembers the selected conversation independently for each inbox channel', () => {
  let selections = {};
  selections = setInboxChannelSelection(selections, 'WhatsApp', 'wa-2');
  selections = setInboxChannelSelection(selections, 'E-mail', 'mail-3');

  assert.equal(inboxChannelSelection(selections, 'WhatsApp', [{ id: 'wa-1' }, { id: 'wa-2' }]), 'wa-2');
  assert.equal(inboxChannelSelection(selections, 'E-mail', [{ id: 'mail-1' }, { id: 'mail-3' }]), 'mail-3');
});

test('falls back to the first available conversation when the saved selection disappears', () => {
  assert.equal(inboxChannelSelection({ WhatsApp: 'removed' }, 'WhatsApp', [{ id: 'wa-1' }]), 'wa-1');
  assert.equal(inboxChannelSelection({}, 'E-mail', []), '');
});
