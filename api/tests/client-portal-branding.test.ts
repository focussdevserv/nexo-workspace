import test from 'node:test';
import assert from 'node:assert/strict';
import { safeClientPortalBranding } from '../src/integrations/client-portal-branding.js';

test('allows only bounded base64 WebP data URLs for portal branding', () => {
  const valid = `data:image/webp;base64,${Buffer.from('webp').toString('base64')}`;
  assert.deepEqual(safeClientPortalBranding(valid), { logo: valid });
  for (const value of [
    'data:image/svg+xml;base64,PHN2Zz4=',
    'https://example.com/logo.webp',
    'data:image/webp;base64,!!!',
    `data:image/webp;base64,${'A'.repeat(40_000)}`,
  ]) assert.deepEqual(safeClientPortalBranding(value), {});
});
