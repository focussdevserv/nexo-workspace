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

test('billing list distinguishes its first load and offers a retry when records fail to load', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /const \[loadingRecords, setLoadingRecords\] = useState\(true\)/);
  assert.match(source, /const \[recordsLoadError, setRecordsLoadError\] = useState\(false\)/);
  assert.match(source, /setLoadingRecords\(true\)[\s\S]*?setRecordsLoadError\(false\)/);
  assert.match(source, /role="status" aria-live="polite"[\s\S]*?Carregando cobran/);
  assert.match(source, /role="alert"[\s\S]*?Não foi possível carregar os registros[\s\S]*?onClick=\{refresh\}>Tentar novamente/);
});
