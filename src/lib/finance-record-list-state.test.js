import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { financeRecordListState } from './finance-record-list-state.js';

test('finance records show loading and unavailable states instead of presenting failed loads as zero data', () => {
  assert.equal(financeRecordListState({ records: [], loading: true, error: '' }), 'loading');
  assert.equal(financeRecordListState({ records: [], loading: false, error: 'API offline' }), 'error');
  assert.equal(financeRecordListState({ records: [], loading: false, error: '' }), 'empty');
  assert.equal(financeRecordListState({ records: [{ id: '1' }], loading: false, error: '' }), 'ready');
});

test('finance revenue and expense screens gate totals and provide a retry action after load failure', async () => {
  const source = await readFile(new URL('../screens/ServiceScreens.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('function FinanceList(');
  const end = source.indexOf('function Inbox(', start);
  const financeScreen = source.slice(start, end);
  assert.match(financeScreen, /recordsViewState === 'ready' \? money\(total, preferences\) : '—'/);
  assert.match(financeScreen, /role="alert">N\u00e3o foi poss\u00edvel carregar os lan\u00e7amentos/);
  assert.match(financeScreen, /onClick=\{\(\) => refreshRecords\(\)\.catch\(\(\) => \{\}\)\}>Tentar novamente/);
  assert.match(financeScreen, /recordsViewState === 'loading' \? 'Carregando lan\u00e7amentos do workspace/);
});
