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
    else if (rule.parent.type === 'atrule' && rule.parent.params.replace(/[()\s]/g, '') === mediaQuery.replace(/[()\s]/g, '')) found ||= rule;
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

test('Google Calendar failure notices remain readable, actionable and stack on narrow screens', () => {
  const notice = findRule('html[data-theme] #root .app-shell .dashboard-calendar-error');
  const action = findRule('html[data-theme] #root .app-shell .dashboard-calendar-error button');
  const mobile = findRule('html[data-theme] #root .app-shell .dashboard-calendar-error', 'max-width:600px');
  assert.ok(notice);
  assert.equal(notice.nodes.find((node) => node.prop === 'display')?.value, 'flex');
  assert.ok(action.nodes.find((node) => node.prop === 'min-height')?.value === '36px');
  assert.equal(mobile.nodes.find((node) => node.prop === 'flex-direction')?.value, 'column');
});

test('mobile schedule strip gives room to the date and event instead of clipping the status and empty label', () => {
  const mobile = findRule('html[data-theme] #root .app-shell .topbar .day-strip .time-pin', 'max-width:760px');
  const empty = findRule('html[data-theme] #root .app-shell .topbar .day-strip .strip-empty', 'max-width:760px');
  const title = findRule('html[data-theme] #root .app-shell .topbar .day-strip .strip-title', 'max-width:760px');
  const event = findRule('html[data-theme] #root .app-shell .topbar .day-strip .strip-event', 'max-width:760px');
  assert.equal(mobile.nodes.find((node) => node.prop === 'display')?.value, 'none');
  assert.equal(empty.nodes.find((node) => node.prop === 'display')?.value, 'none');
  assert.equal(title.nodes.find((node) => node.prop === 'gap')?.value, '7px');
  assert.equal(event.nodes.find((node) => node.prop === 'gap')?.value, '5px');
});
