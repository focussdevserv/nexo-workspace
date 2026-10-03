import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const stylesheet = await readFile(new URL('../premium-design.css', import.meta.url), 'utf8');
const root = postcss.parse(stylesheet);

function findRule(selector, mediaQuery = '') {
  let found = null;
  root.walkRules(selector, (rule) => {
    if (!mediaQuery) found ||= rule;
    else if (rule.parent.type === 'atrule' && rule.parent.params.replace(/[()]/g, '') === mediaQuery) found ||= rule;
  });
  return found;
}

test('Meu Dia switches to one column below 1600px rather than squeezing header content beside KPIs', () => {
  const layout = findRule('html[data-theme] #root .app-shell .dashboard-view', 'max-width:1600px');
  assert.ok(layout, 'responsive dashboard breakpoint should exist');
  assert.equal(layout.nodes.find((node) => node.prop === 'grid-template-columns')?.value, 'minmax(0,1fr)');
});

test('Meu Dia keeps its title on one line and lets the title copy flex beside fixed-width actions', () => {
  const title = findRule('html[data-theme] #root .app-shell .dashboard-view > .welcome-row h1');
  const copy = findRule('html[data-theme] #root .app-shell .dashboard-view > .welcome-row > div:first-child');
  assert.equal(title.nodes.find((node) => node.prop === 'white-space')?.value, 'nowrap');
  assert.equal(copy.nodes.find((node) => node.prop === 'min-width')?.value, '0');
  assert.equal(copy.nodes.find((node) => node.prop === 'flex')?.value, '1 1 auto');
});
