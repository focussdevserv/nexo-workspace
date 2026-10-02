import assert from 'node:assert/strict';
import test from 'node:test';
import { isClientPortalSectionVisible } from '../src/security/client-portal-visibility.js';

test('portal sections remain visible for legacy records unless explicitly disabled', () => {
  assert.equal(isClientPortalSectionVisible({}, 'approvals'), true);
  assert.equal(isClientPortalSectionVisible({ portalVisibility: null }, 'approvals'), true);
  assert.equal(isClientPortalSectionVisible({ portalVisibility: { approvals: true } }, 'approvals'), true);
  assert.equal(isClientPortalSectionVisible({ portalVisibility: { approvals: false } }, 'approvals'), false);
});

test('malformed visibility settings do not hide sections or throw', () => {
  assert.equal(isClientPortalSectionVisible({ portalVisibility: 'false' }, 'payments'), true);
  assert.equal(isClientPortalSectionVisible({ portalVisibility: [] }, 'payments'), true);
});
