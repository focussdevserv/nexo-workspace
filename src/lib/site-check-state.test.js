import test from 'node:test';
import assert from 'node:assert/strict';
import { beginSiteCheck, finishSiteCheck } from './site-check-state.js';

test('finishing one site check leaves other concurrent checks marked in progress', () => {
  const pending = new Set();
  assert.equal(beginSiteCheck(pending, 'site-a'), true);
  assert.equal(beginSiteCheck(pending, 'site-b'), true);
  assert.equal(beginSiteCheck(pending, 'site-a'), false);

  const rendered = finishSiteCheck(pending, 'site-a');
  assert.deepEqual([...rendered], ['site-b']);
  assert.equal(beginSiteCheck(pending, 'site-a'), true);
});
