import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const darkModeCss = readFileSync(new URL('../dark-mode.css', import.meta.url), 'utf8');

test('dark theme preserves semantic colors on styled actions and links', () => {
  assert.match(darkModeCss, /html\[data-theme='dark'\] button:not\(\[class\]\),\s*html\[data-theme='dark'\] a:not\(\[class\]\)\s*\{\s*color:\s*inherit;/);
  assert.doesNotMatch(darkModeCss, /html\[data-theme='dark'\] button:not\(\.primary-button\).*?html\[data-theme='dark'\] a\s*\{\s*color:\s*inherit;/s);
  assert.match(darkModeCss, /\.work-button:not\(\.work-button-primary\):not\(\.work-button-approve\):not\(\.file-remove\)/);
  assert.doesNotMatch(darkModeCss, /\.work-button:not\(\.work-button-primary\)(?!:not\(\.work-button-approve\))/);
  assert.match(darkModeCss, /\.work-button-approve\s*\{[^}]*color:\s*#c4f493/s);
  assert.match(darkModeCss, /html\[data-theme='light'\] \.app-shell \.work-button-approve\s*\{[^}]*color:\s*#208451/s);
  assert.match(darkModeCss, /\.work-button\.file-remove\s*\{[^}]*color:\s*#f0a0a5/s);
});
