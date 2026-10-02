import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('billing toolbar manages Mercado Pago integration without logging out of the workspace', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');

  assert.match(source, /detail: 'Integrações'/);
  assert.doesNotMatch(source, /\/api\/auth\/logout/);
});
