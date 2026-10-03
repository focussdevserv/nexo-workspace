import test from 'node:test';
import assert from 'node:assert/strict';
import { beginSiteCheck, finishSiteCheck, siteCheckFailureMessage } from './site-check-state.js';

test('finishing one site check leaves other concurrent checks marked in progress', () => {
  const pending = new Set();
  assert.equal(beginSiteCheck(pending, 'site-a'), true);
  assert.equal(beginSiteCheck(pending, 'site-b'), true);
  assert.equal(beginSiteCheck(pending, 'site-a'), false);

  const rendered = finishSiteCheck(pending, 'site-a');
  assert.deepEqual([...rendered], ['site-b']);
  assert.equal(beginSiteCheck(pending, 'site-a'), true);
});

test('manual site check failures give a useful message for invalid, private, and unavailable targets', () => {
  assert.match(siteCheckFailureMessage('host_not_public'), /precisa ser público/);
  assert.match(siteCheckFailureMessage('invalid_url'), /URL HTTP\/HTTPS válido/);
  assert.match(siteCheckFailureMessage('check_failed'), /Confira o endereço/);
  assert.match(siteCheckFailureMessage(undefined), /Confira o endereço/);
});
