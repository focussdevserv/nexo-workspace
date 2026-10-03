import assert from 'node:assert/strict';
import test from 'node:test';
import { clientPortalVisibleSections, isClientPortalSectionVisible } from '../src/security/client-portal-visibility.js';

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

test('public portal exposes section visibility so an empty payment list is distinguishable from a hidden section', () => {
  assert.deepEqual(clientPortalVisibleSections({ portalVisibility: { payments: true, approvals: false } }), {
    project: true, tasks: true, contracts: true, payments: true, approvals: false,
  });
});
