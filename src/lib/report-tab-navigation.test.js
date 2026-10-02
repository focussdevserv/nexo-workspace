import assert from 'node:assert/strict';
import test from 'node:test';
import { reportTabForKey } from './report-tab-navigation.js';

const tabs = ['Visão geral', 'Comercial', 'Projetos', 'Financeiro'];

test('report tabs wrap at both ends for left and right arrow navigation', () => {
  assert.equal(reportTabForKey('Visão geral', 'ArrowLeft', tabs), 'Financeiro');
  assert.equal(reportTabForKey('Financeiro', 'ArrowRight', tabs), 'Visão geral');
  assert.equal(reportTabForKey('Comercial', 'ArrowRight', tabs), 'Projetos');
  assert.equal(reportTabForKey('Projetos', 'ArrowLeft', tabs), 'Comercial');
});

test('Home and End move to the first and last report tabs', () => {
  assert.equal(reportTabForKey('Projetos', 'Home', tabs), 'Visão geral');
  assert.equal(reportTabForKey('Comercial', 'End', tabs), 'Financeiro');
});

test('unhandled keys and unknown current tabs do not change selection', () => {
  assert.equal(reportTabForKey('Comercial', 'Enter', tabs), 'Comercial');
  assert.equal(reportTabForKey('missing', 'ArrowRight', tabs), 'missing');
});
