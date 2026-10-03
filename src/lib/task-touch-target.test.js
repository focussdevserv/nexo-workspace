import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const stylesheet = readFileSync(fileURLToPath(new URL('../screens/work.css', import.meta.url)), 'utf8');

test('task completion controls keep a minimum 24px touch target on desktop and mobile', () => {
  const rules = [...stylesheet.matchAll(/\.task-check\s*\{([^}]*)\}/g)]
    .map((match) => match[1])
    .filter((rule) => /(?:^|;)\s*width\s*:/.test(rule) && /(?:^|;)\s*height\s*:/.test(rule));
  assert.ok(rules.length >= 2, 'expected base and mobile task completion size rules');

  for (const rule of rules) {
    const width = Number(rule.match(/(?:^|;)\s*width\s*:\s*(\d+)px/)?.[1]);
    const height = Number(rule.match(/(?:^|;)\s*height\s*:\s*(\d+)px/)?.[1]);
    assert.ok(width >= 24, `task completion width must be at least 24px, got ${width}`);
    assert.ok(height >= 24, `task completion height must be at least 24px, got ${height}`);
  }
});
