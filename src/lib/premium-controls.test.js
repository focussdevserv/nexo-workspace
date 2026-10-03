import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const premiumCss = await readFile(new URL('../premium-design.css', import.meta.url), 'utf8');
const serviceCss = await readFile(new URL('../screens/service.css', import.meta.url), 'utf8');
const root = postcss.parse(premiumCss);
const serviceRoot = postcss.parse(serviceCss);

function findRule(stylesheet, selector) {
  let found = null;
  stylesheet.walkRules((rule) => {
    if (typeof selector === 'function' ? selector(rule.selector) : rule.selector === selector) found ||= rule;
  });
  return found;
}

test('shared form controls align with secondary actions across modules', () => {
  const fields = findRule(root, (selector) => selector.includes('html[data-theme] .app-shell :is(input') && selector.includes('html[data-theme] .workspace-access-page :is(input') && selector.includes('html[data-theme] .cp-public-page :is(input'));
  const sharedSecondary = findRule(root, (selector) => selector.includes('html[data-theme] .app-shell :is(.ns-secondary') && selector.includes('.cp-action-button)'));
  const financeFilter = findRule(serviceRoot, '.ns-finance-filters select');

  assert.equal(fields.nodes.find((node) => node.prop === 'min-height')?.value, '38px');
  assert.equal(sharedSecondary.nodes.find((node) => node.prop === 'min-height')?.value, '38px');
  assert.equal(financeFilter.nodes.find((node) => node.prop === 'height')?.value, '36px');
  assert.ok(Number.parseInt(fields.nodes.find((node) => node.prop === 'min-height').value, 10) >= 38);
});
