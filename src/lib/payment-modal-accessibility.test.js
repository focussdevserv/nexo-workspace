import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('new billing dialog is named, modal, keyboard dismissible, and manages focus', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /role="dialog" aria-modal="true" aria-labelledby="payment-create-title" aria-busy=\{busy\}/);
  assert.match(source, /<h2 id="payment-create-title">\{subscriptionMode \?/);
  assert.match(source, /if \(event\.key === 'Escape'\)/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /previouslyFocused\.focus\(\)/);
});
