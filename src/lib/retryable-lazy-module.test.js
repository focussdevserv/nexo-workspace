import test from 'node:test';
import assert from 'node:assert/strict';
import { createRetryableLazyModuleRegistry } from './retryable-lazy-module.js';

test('reuses a lazy component until a retry requests a fresh attempt', () => {
  const created = [];
  const loaders = { commercial: () => Promise.resolve({ default: () => null }) };
  const getModule = createRetryableLazyModuleRegistry((loader) => {
    const component = { loader };
    created.push(component);
    return component;
  }, loaders);

  const first = getModule('commercial', 0);
  assert.equal(getModule('commercial', 0), first);
  const retry = getModule('commercial', 1);

  assert.notEqual(retry, first);
  assert.equal(retry.loader, loaders.commercial);
  assert.equal(created.length, 2);
});

test('returns no lazy component for an unknown module', () => {
  const getModule = createRetryableLazyModuleRegistry((loader) => loader, {});
  assert.equal(getModule('missing', 0), null);
});
