import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { subscriptionStatusUrl } from './subscription-status-url.js';

test('subscription status actions encode IDs so reserved characters stay inside the path segment', () => {
  assert.equal(subscriptionStatusUrl('subscription-123'), '/api/billing/subscriptions/subscription-123/status');
  assert.equal(subscriptionStatusUrl('id/with?reserved#chars'), '/api/billing/subscriptions/id%2Fwith%3Freserved%23chars/status');
});

test('all subscription status actions use the shared encoded endpoint', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ subscriptionStatusUrl \} from ['"]\.\.\/lib\/subscription-status-url\.js['"]/);
  assert.equal((source.match(/request\(subscriptionStatusUrl\(item\.id\)/g) || []).length, 3);
  assert.doesNotMatch(source, /\/api\/billing\/subscriptions\/\$\{item\.id\}\/status/);
});
