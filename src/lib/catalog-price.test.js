import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogPrice } from './catalog-price.js';

test('parses Brazilian catalog prices with thousands and decimal separators', () => {
  assert.equal(parseCatalogPrice('A partir de R$ 2.500,00'), 2500);
  assert.equal(parseCatalogPrice('R$ 12.345,67'), 12345.67);
  assert.equal(parseCatalogPrice('2.500'), 2500);
});

test('keeps plain numeric and decimal prices and safely handles empty values', () => {
  assert.equal(parseCatalogPrice('350'), 350);
  assert.equal(parseCatalogPrice('350,50'), 350.5);
  assert.equal(parseCatalogPrice('350.50'), 350.5);
  assert.equal(parseCatalogPrice('A combinar'), 0);
});
