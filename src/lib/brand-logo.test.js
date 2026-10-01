import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrandLogoFile } from './brand-logo.js';

test('accepts supported raster image types under the upload limit', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.doesNotThrow(() => validateBrandLogoFile({ type, size: 1024 }));
  }
});

test('rejects SVG, empty images, and files over 2 MB', () => {
  for (const file of [
    { type: 'image/svg+xml', size: 100 },
    { type: 'image/png', size: 0 },
    { type: 'image/png', size: 2 * 1024 * 1024 + 1 },
  ]) assert.throws(() => validateBrandLogoFile(file));
});
