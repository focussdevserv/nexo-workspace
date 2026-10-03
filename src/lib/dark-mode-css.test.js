import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const darkModeCss = readFileSync(new URL('../dark-mode.css', import.meta.url), 'utf8');

test('dark theme preserves semantic colors on styled actions and links', () => {
  assert.match(darkModeCss, /html\[data-theme='dark'\] button:not\(\[class\]\),\s*html\[data-theme='dark'\] a:not\(\[class\]\)\s*\{\s*color:\s*inherit;/);
  assert.doesNotMatch(darkModeCss, /html\[data-theme='dark'\] button:not\(\.primary-button\).*?html\[data-theme='dark'\] a\s*\{\s*color:\s*inherit;/s);
});
