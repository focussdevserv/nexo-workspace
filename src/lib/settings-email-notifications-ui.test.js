import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const settingsScreen = await readFile(new URL('../screens/SettingsScreen.jsx', import.meta.url), 'utf8');

test('email notifications are visibly unavailable until the app can deliver them', () => {
  assert.match(settingsScreen, /notifications: \{[^}]*weekly: false, email: false, emailConsentVersion: 0/);
  assert.match(settingsScreen, /SettingUnavailable title="Notificações por e-mail"/);
  assert.doesNotMatch(settingsScreen, /SettingToggle title="Notificações por e-mail"/);
  assert.match(settingsScreen, /ainda não envia notificações por e-mail|envio automático de alertas por e-mail ainda não está conectado/i);
});

test('unsupported digest and WhatsApp controls are visibly unavailable while browser alerts remain operable', () => {
  assert.match(settingsScreen, /SettingUnavailable title="Resumo semanal por e-mail"/);
  assert.match(settingsScreen, /SettingUnavailable title="Avisos pelo WhatsApp"/);
  assert.match(settingsScreen, /SettingToggle title="Notificações no navegador"[\s\S]*onChange=\{toggleBrowserNotifications\}/);
  assert.match(settingsScreen, /Estas categorias controlam os avisos do navegador/);
});

test('imported and stored settings are normalized to keep unavailable channels off', () => {
  assert.equal((settingsScreen.match(/normalizeNotificationPreferences\(/g) || []).length, 2);
  assert.match(settingsScreen, /window\.dispatchEvent\(new CustomEvent\('nexo:workspace-notifications', \{ detail: settings\.notifications \}\)\)/);
});
