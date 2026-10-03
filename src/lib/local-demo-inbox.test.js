import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLocalDemoRequest } from './local-demo.js';
import { filterInboxConversations } from './inbox-filter.js';

test('local demo inbox supports filtering, read/resolve state and an isolated simulated WhatsApp reply', () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['focusshub.local-demo.v1', JSON.stringify({ inbox: [
    { id: 'demo-inbox-a', name: 'Ana Costa', company: 'Aurora', text: 'Pode enviar a prévia?', unread: 1, status: 'open', channel: 'WhatsApp', history: [] },
    { id: 'demo-inbox-b', name: 'Bia Lima', company: 'Beta', text: 'Tudo certo', unread: 0, status: 'closed', channel: 'WhatsApp', history: [] },
  ] })]]);
  const writes = [];
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  globalThis.window = {
    location: { origin: 'http://localhost' },
    dispatchEvent: (event) => writes.push(event.type),
  };

  try {
    const initial = handleLocalDemoRequest('/api/workspace/inbox?limit=200&offset=0');
    assert.deepEqual(filterInboxConversations(initial.data, 'prévia', 'Nao lidas').map(({ id }) => id), ['demo-inbox-a']);
    assert.deepEqual(filterInboxConversations(initial.data, '', 'Resolvidas').map(({ id }) => id), ['demo-inbox-b']);

    handleLocalDemoRequest('/api/workspace/inbox/demo-inbox-a', { method: 'PATCH', body: JSON.stringify({ data: { unread: 0 } }) });
    let rows = handleLocalDemoRequest('/api/workspace/inbox?limit=200&offset=0').data;
    assert.deepEqual(filterInboxConversations(rows, '', 'Nao lidas'), []);

    handleLocalDemoRequest('/api/workspace/inbox/demo-inbox-a', { method: 'PATCH', body: JSON.stringify({ data: { status: 'closed' } }) });
    rows = handleLocalDemoRequest('/api/workspace/inbox?limit=200&offset=0').data;
    assert.deepEqual(filterInboxConversations(rows, '', 'Resolvidas').map(({ id }) => id), ['demo-inbox-a', 'demo-inbox-b']);

    const status = handleLocalDemoRequest('/api/integrations/status');
    const sessions = handleLocalDemoRequest('/api/integrations/waha/sessions');
    assert.deepEqual(status.data.map((item) => item.name), ['Mercado Pago', 'Evolution API', 'WAHA', 'Resend', 'Hostinger E-mail', 'Google Workspace', 'Clicksign', 'GitHub', 'n8n', 'Sentry']);
    assert.ok(status.data.every((item) => item.demo === true));
    assert.equal(status.data.find((item) => item.provider === 'waha')?.configured, true);
    assert.equal(status.data.find((item) => item.provider === 'waha')?.enabled, true);
    assert.equal(status.data.find((item) => item.provider === 'waha')?.lastTestStatus, 'demo');
    assert.ok(status.data.filter((item) => item.provider !== 'waha').every((item) => !item.configured && !item.enabled));
    assert.equal(status.data.find((item) => item.provider === 'google')?.configured, false);
    assert.equal(status.data.find((item) => item.provider === 'waha')?.demo, true);
    assert.equal(sessions.data[0].status, 'WORKING');
    assert.equal(sessions.data[0].demo, true);

    const paused = handleLocalDemoRequest(`/api/integrations/waha/sessions/${sessions.data[0].id}/stop`, { method: 'POST', body: '{}' });
    assert.equal(paused.data.status, 'STOPPED');
    assert.equal(handleLocalDemoRequest('/api/integrations/waha/sessions').data[0].status, 'STOPPED');
    const resumed = handleLocalDemoRequest(`/api/integrations/waha/sessions/${sessions.data[0].id}/start`, { method: 'POST', body: '{}' });
    assert.equal(resumed.data.status, 'WORKING');
    assert.equal(handleLocalDemoRequest('/api/integrations/waha/sessions').data[0].status, 'WORKING');

    handleLocalDemoRequest('/api/workspace/inbox/demo-inbox-a', { method: 'PATCH', body: JSON.stringify({ data: { status: 'open' } }) });
    const response = handleLocalDemoRequest('/api/integrations/waha/send', {
      method: 'POST',
      body: JSON.stringify({ sessionId: sessions.data[0].id, conversationId: 'demo-inbox-a', clientMessageId: 'demo-reply-1', chatId: '5511999999999', text: 'Segue a prévia.' }),
    });
    assert.equal(response.data.simulated, true);
    rows = handleLocalDemoRequest('/api/workspace/inbox?limit=200&offset=0').data;
    assert.equal(rows[0].history.at(-1).text, 'Segue a prévia.');
    assert.equal(rows[0].history.at(-1).simulated, true);
    assert.match(rows[0].history.at(-1).demoTag, /NADA ENVIADO/);
    assert.ok(writes.length > 0, 'demo changes were persisted locally');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('local demo reply rejects a resolved conversation and non-demo WAHA session', () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['focusshub.local-demo.v1', JSON.stringify({ inbox: [{ id: 'demo-inbox-closed', status: 'closed', history: [] }] })]]);
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = { location: { origin: 'http://localhost' }, dispatchEvent: () => {} };
  try {
    const body = { sessionId: 'real-session-id', conversationId: 'demo-inbox-closed', text: 'Não envie.' };
    assert.throws(() => handleLocalDemoRequest('/api/integrations/waha/send', { method: 'POST', body: JSON.stringify(body) }), /sessão WhatsApp simulada/);
    body.sessionId = 'demo-waha-session';
    assert.throws(() => handleLocalDemoRequest('/api/integrations/waha/send', { method: 'POST', body: JSON.stringify(body) }), /Reabra o atendimento/);
    assert.deepEqual(JSON.parse(values.get('focusshub.local-demo.v1')).inbox[0].history, []);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('local demo can add, inspect, use and remove multiple simulated WAHA sessions without making a provider call', () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['focusshub.local-demo.v1', JSON.stringify({ inbox: [
    { id: 'demo-inbox-a', name: 'Ana Costa', status: 'open', history: [] },
  ] })]]);
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = { location: { origin: 'http://localhost' }, dispatchEvent: () => {} };

  try {
    const created = handleLocalDemoRequest('/api/integrations/waha/sessions', {
      method: 'POST', body: JSON.stringify({ label: 'WhatsApp Vendas' }),
    });
    assert.match(created.data.id, /^demo-waha-/);
    assert.equal(created.data.demo, true);
    assert.equal(created.data.status, 'SCAN_QR_CODE');
    assert.equal(handleLocalDemoRequest('/api/integrations/waha/sessions').data.length, 2);

    const qr = handleLocalDemoRequest(`/api/integrations/waha/sessions/${created.data.id}/qr`);
    assert.equal(qr.data.demo, true);
    assert.equal(qr.data.image, '');
    assert.match(qr.data.message, /QR Code real indisponível/);

    handleLocalDemoRequest(`/api/integrations/waha/sessions/${created.data.id}/start`, { method: 'POST', body: '{}' });
    const sent = handleLocalDemoRequest('/api/integrations/waha/send', {
      method: 'POST',
      body: JSON.stringify({ sessionId: created.data.id, conversationId: 'demo-inbox-a', clientMessageId: 'simulated-two', text: 'Mensagem de teste local.' }),
    });
    assert.equal(sent.data.simulated, true);
    assert.equal(handleLocalDemoRequest('/api/workspace/inbox?limit=200&offset=0').data[0].history[0].text, 'Mensagem de teste local.');

    const deleted = handleLocalDemoRequest(`/api/integrations/waha/sessions/${created.data.id}`, { method: 'DELETE' });
    assert.equal(deleted.data.simulated, true);
    assert.equal(handleLocalDemoRequest('/api/integrations/waha/sessions').data.length, 1);
    assert.throws(() => handleLocalDemoRequest('/api/integrations/waha/sessions', {
      method: 'POST', body: JSON.stringify({ label: 'x' }),
    }), /2 e 80/);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
