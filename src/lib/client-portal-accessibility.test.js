import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('client portal identity checks use accessible, mobile-safe identity and one-time-code fields', async () => {
  const source = await readFile(new URL('../screens/ClientPortalScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /name="portalIdentifier" autoComplete="off" spellCheck=\{false\}/);
  assert.match(source, /name="verificationCode" autoComplete="one-time-code" inputMode="numeric"/);
  assert.match(source, /autoFocus=\{typeof window !== 'undefined' && window\.matchMedia\('\(min-width: 641px\)'\)\.matches\}/);
  assert.match(source, /type="submit" className="admin-primary" disabled=\{verificationBusy\}/);
});

test('client portal message composer has an explicit accessible name and submit action', async () => {
  const source = await readFile(new URL('../screens/ClientPortalScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /<textarea aria-label="Mensagem para a equipe" name="message" autoComplete="off"/);
  assert.match(source, /<button type="submit" className="admin-primary" disabled=\{!canSendPortalMessage\(message, busy\)\}/);
});

test('screen-level autofocus is limited to desktop viewports', async () => {
  const files = ['../App.jsx', '../screens/AdminScreens.jsx', '../screens/ClientPortalScreens.jsx', '../screens/CommercialScreens.jsx', '../screens/ServiceScreens.jsx', '../screens/TeamScreen.jsx', '../screens/WorkScreens.jsx'];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    const autofocusAttributes = source.match(/autoFocus(?:=\{[^}]*\})?/g) || [];
    for (const attribute of autofocusAttributes) {
      assert.match(attribute, /autoFocus=\{typeof window !== 'undefined' && window\.matchMedia\('\(min-width: 641px\)'\)\.matches\}/, `${file} has mobile-unconditional ${attribute}`);
    }
  }
});
