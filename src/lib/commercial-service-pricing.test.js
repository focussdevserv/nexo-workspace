import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialServicePricingInput, validateCommercialServicePricing } from './commercial-service-pricing.js';

test('normalizes catalog display prices before reopening the editor', () => {
  assert.equal(commercialServicePricingInput('A partir de R$ 2.500,00'), '2.500,00');
  assert.equal(commercialServicePricingInput('R$ 850'), '850');
  assert.equal(commercialServicePricingInput('A combinar'), '');
  assert.equal(commercialServicePricingInput(''), '');
});

test('accepts Brazilian price and cost inputs while allowing an omitted price and a zero cost', () => {
  assert.deepEqual(validateCommercialServicePricing('1.250,50', '0'), {
    price: '1.250,50',
    cost: '0',
  });
  assert.deepEqual(validateCommercialServicePricing('', ''), { price: '', cost: '' });
  assert.deepEqual(validateCommercialServicePricing('0', ''), { price: '0', cost: '' });
});

test('rejects malformed and negative catalog amounts while preserving legitimate free services', () => {
  for (const value of ['R$ 1.2x0', '-25', '1.234,567']) {
    assert.match(validateCommercialServicePricing(value, '').error, /Preço base/);
  }
  assert.match(validateCommercialServicePricing('250', 'texto').error, /Custo estimado/);
});
