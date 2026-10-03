import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldInterceptWorkspaceLink } from './workspace-navigation-link.js';

const ordinaryClick = () => ({ button: 0, currentTarget: { target: '' } });

test('intercepts an ordinary primary click for in-app navigation', () => {
  assert.equal(shouldInterceptWorkspaceLink(ordinaryClick()), true);
});

test('leaves modified, middle, prevented, and new-tab link clicks to the browser', () => {
  for (const patch of [
    { button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true },
    { altKey: true }, { defaultPrevented: true }, { currentTarget: { target: '_blank' } },
  ]) {
    assert.equal(shouldInterceptWorkspaceLink({ ...ordinaryClick(), ...patch }), false);
  }
  assert.equal(shouldInterceptWorkspaceLink(null), false);
});
