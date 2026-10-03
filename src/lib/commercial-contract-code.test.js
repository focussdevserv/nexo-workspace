import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialContractCode } from './commercial-contract-code.js';

test('contracts accepted on the same date receive distinct proposal-based codes', () => {
  const date = new Date('2026-10-03T15:00:00.000Z');
  const first = commercialContractCode('2d5e0d5f-504f-4d12-b2a1-2a9f9d4f7630', date);
  const second = commercialContractCode('8f7b9067-1f4d-421c-9bf7-e601a0e1c953', date);

  assert.notEqual(first, second);
  assert.equal(first, 'CTR-20261003-2D5E0D5F504F4D12B2A12A9F9D4F7630');
  assert.equal(second, 'CTR-20261003-8F7B90671F4D421C9BF7E601A0E1C953');
});

test('retrying code generation for the same proposal is stable and missing ids are rejected', () => {
  const date = new Date('2026-10-03T15:00:00.000Z');
  assert.equal(commercialContractCode('proposal-123', date), commercialContractCode('proposal-123', date));
  assert.throws(() => commercialContractCode('', date), /proposal id is required/i);
});
