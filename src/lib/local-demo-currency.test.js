import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLocalDemoCurrency, migrateLegacyDemoContractValue } from './local-demo.js';

test('formats demo catalog and contract currency with Brazilian grouping', () => {
  assert.match(formatLocalDemoCurrency(12800), /^R\$\s12\.800,00$/u);
  assert.match(formatLocalDemoCurrency(4200), /^R\$\s4\.200,00$/u);
});

test('migrates only the untouched legacy demo contract amount and preserves user edits', () => {
  const seeded = { id: 'demo-contract-1', demo: true, value: formatLocalDemoCurrency(12800) };
  const migrated = migrateLegacyDemoContractValue({ ...seeded, value: 'R$ 12800,00' }, seeded);
  assert.equal(migrated.value, seeded.value);
  assert.equal(migrateLegacyDemoContractValue({ ...seeded, value: 'R$ 13.000,00' }, seeded).value, 'R$ 13.000,00');
  assert.equal(migrateLegacyDemoContractValue({ id: 'other', demo: true, value: 'R$ 12800,00' }, seeded).value, 'R$ 12800,00');
});
