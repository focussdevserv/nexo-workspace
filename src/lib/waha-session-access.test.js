import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageWahaSessions, canShowWahaQr } from './waha-session-access.js';

test('session management and QR pairing are limited to the owner role', () => {
  assert.equal(canManageWahaSessions('owner'), true);
  assert.equal(canManageWahaSessions('admin'), false);
  assert.equal(canManageWahaSessions('member'), false);
  assert.equal(canShowWahaQr('owner', 'SCAN_QR_CODE'), true);
  assert.equal(canShowWahaQr('admin', 'SCAN_QR_CODE'), false);
  assert.equal(canShowWahaQr('owner', 'WORKING'), false);
});
