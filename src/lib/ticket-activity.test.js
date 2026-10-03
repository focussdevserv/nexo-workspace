import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ticketActivityForDisplay } from './ticket-activity.js';

test('ticket history defaults to the newest eight updates in reverse chronological order', () => {
  const activity = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));
  assert.deepEqual(ticketActivityForDisplay(activity).map(({ id }) => id), [12, 11, 10, 9, 8, 7, 6, 5]);
});

test('ticket history can expose every update and safely handles missing legacy history', () => {
  const activity = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));
  assert.deepEqual(ticketActivityForDisplay(activity, true).map(({ id }) => id), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(ticketActivityForDisplay(null, true), []);
});

test('ticket dialog exposes a control to expand long history beyond the initial eight updates', () => {
  const source = readFileSync(fileURLToPath(new URL('../screens/ServiceScreens.jsx', import.meta.url)), 'utf8');
  assert.match(source, /ticketActivityForDisplay\(selected\.activity, showAllTicketActivity\)/);
  assert.match(source, /selected\.activity\.length > 8 && <button[^>]+aria-expanded=\{showAllTicketActivity\}/);
  assert.match(source, /Ver histórico completo \(\$\{selected\.activity\.length\}\)/);
});
