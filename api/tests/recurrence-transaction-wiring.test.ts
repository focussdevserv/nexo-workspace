import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
const workScreens = readFileSync(new URL('../../src/screens/WorkScreens.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');

function route(path: string, nextPath: string) {
  const start = server.indexOf(`app.post('${path}'`);
  const end = server.indexOf(`app.${nextPath}`, start + 1);
  assert.notEqual(start, -1, `missing ${path} route`);
  assert.notEqual(end, -1, `missing route boundary after ${path}`);
  return server.slice(start, end);
}

test('recurring agenda series validates and inserts the entire series with activity in one locked transaction', () => {
  const source = route('/api/workspace/events/recurring-series', "post('/api/workspace/:resource'");
  assert.match(source, /validateRecurringAgendaSeries\(body\.seriesId, body\.events\)/);
  assert.match(source, /await db\.transaction\(async \(tx\)/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /recurringAgendaSeriesMatches/);
  assert.match(source, /tx\.insert\(workspaceRecords\)\.values\(values\)/);
  assert.match(source, /tx\.insert\(activityEvents\)/);
});

test('recurring task completion locks the task and series and writes task plus occurrence and audit in one transaction', () => {
  const source = route('/api/workspace/tasks/:id/complete-occurrence', "post('/api/workspace/events/recurring-series'");
  assert.match(source, /\.for\('update'\)/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /recordMatchesWorkspaceScope/);
  assert.match(source, /dependencyBlocked/);
  assert.match(source, /tx\.update\(workspaceRecords\)/);
  assert.match(source, /tx\.insert\(workspaceRecords\)/);
  assert.match(source, /tx\.insert\(activityEvents\)/);
});

test('the work modules and Meu Dia use atomic routes instead of patch-then-create recurring writes', () => {
  assert.match(workScreens, /\/api\/workspace\/events\/recurring-series/);
  assert.match(workScreens, /\/api\/workspace\/tasks\/\$\{encodeURIComponent\(currentTask\.id\)\}\/complete-occurrence/);
  assert.match(app, /\/api\/workspace\/tasks\/\$\{encodeURIComponent\(id\)\}\/complete-occurrence/);
});
