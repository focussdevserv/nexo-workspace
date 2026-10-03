import assert from 'node:assert/strict';
import test from 'node:test';
import { canRemoveSiteAsset } from './site-asset-removal.js';

test('site removal waits until monitor schedules have loaded successfully', () => {
  assert.equal(canRemoveSiteAsset({ monitorsLoading: true }), false);
  assert.equal(canRemoveSiteAsset({ monitorsError: 'API indisponível' }), false);
  assert.equal(canRemoveSiteAsset({}), true);
  assert.equal(canRemoveSiteAsset({ monitorsLoading: false, monitorsError: '' }), true);
});
