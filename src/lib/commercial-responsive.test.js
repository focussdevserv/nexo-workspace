import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('commercial navigation keeps every module visible without horizontal scrolling on mobile', async () => {
  const css = await readFile(new URL('../screens/commercial.css', import.meta.url), 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.com-tabs\s*\{[^}]*display:grid[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)[^}]*overflow:visible/);
  assert.match(css, /\.com-tabs button\s*\{[^}]*min-width:0[^}]*white-space:normal/);
});

test('narrow mobile layouts release the desktop minimum width and wrap commercial breadcrumbs', async () => {
  const [globalCss, commercialCss] = await Promise.all([
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../screens/commercial.css', import.meta.url), 'utf8'),
  ]);
  assert.match(globalCss, /@media\s*\(max-width:\s*340px\)\s*\{\s*body\s*\{\s*min-width:\s*0/);
  assert.match(commercialCss, /\.com-breadcrumb\s*\{[^}]*width:100%[^}]*min-width:0[^}]*flex-wrap:wrap/);
});
