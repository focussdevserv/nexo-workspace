import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWorkspaceSettings } from './settings-validation.js';

const valid = {
  workspace: { language: 'pt-BR', currency: 'BRL', dateFormat: 'dd/MM/yyyy' },
  billing: { lateFee: '2', interest: '1', reminderDays: '3, 1, 0, -3', defaultDueDays: '7' },
};

test('accepts the configured billing defaults and zero values', () => {
  assert.equal(validateWorkspaceSettings(valid), '');
  assert.equal(validateWorkspaceSettings({ billing: { ...valid.billing, lateFee: '0', interest: '0' } }), '');
});

test('rejects percentages outside the range or with invalid numeric values', () => {
  for (const value of ['-0.1', '100.1', 'NaN', '']) {
    assert.match(validateWorkspaceSettings({ billing: { ...valid.billing, lateFee: value } }), /Multa por atraso/);
    assert.match(validateWorkspaceSettings({ billing: { ...valid.billing, interest: value } }), /Juros ao mês/);
  }
});

test('requires reminder offsets to be comma-separated integers in a bounded range', () => {
  for (const reminderDays of ['', '1.5, -2', 'a, 2', '366', '-366']) {
    assert.match(validateWorkspaceSettings({ billing: { ...valid.billing, reminderDays } }), /Dias para lembretes/);
  }
});

test('only accepts billing due-day choices offered by the settings control', () => {
  assert.match(validateWorkspaceSettings({ billing: { ...valid.billing, defaultDueDays: '0' } }), /Vencimento padrão/);
});

test('rejects unsupported workspace locale, currency, or date pattern', () => {
  for (const [field, value] of [['language', 'fr-FR'], ['currency', 'JPY'], ['dateFormat', 'yyyy-dd-MM']]) {
    assert.match(validateWorkspaceSettings({ ...valid, workspace: { ...valid.workspace, [field]: value } }), /selecione uma opção disponível/);
  }
});
