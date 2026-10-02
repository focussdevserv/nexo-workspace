import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isWahaChatIdBoundToConversation } from '../src/integrations/waha-chat-scope.ts';

test('allows sends only to the existing WhatsApp chat bound to the conversation', () => {
  assert.equal(isWahaChatIdBoundToConversation('5511987654321@c.us', {
    whatsappChatId: '5511987654321@c.us',
    phone: '+55 11 98765-4321',
  }), true);
  assert.equal(isWahaChatIdBoundToConversation('5511987654321@lid', {
    whatsappChatId: '5511987654321@lid',
    phone: '+55 11 98765-4321',
  }), true);
});

test('permits legacy conversations without a chat ID only for their saved phone', () => {
  assert.equal(isWahaChatIdBoundToConversation('5511987654321@c.us', { phone: '(11) 98765-4321' }), true);
  assert.equal(isWahaChatIdBoundToConversation('12025550188@c.us', { phone: '+1 202-555-0188' }), true);
});

test('rejects a different recipient, missing recipient data, and malformed chat IDs', () => {
  assert.equal(isWahaChatIdBoundToConversation('5511999999999@c.us', {
    whatsappChatId: '5511987654321@c.us',
    phone: '+55 11 98765-4321',
  }), false);
  assert.equal(isWahaChatIdBoundToConversation('5511999999999@c.us', { phone: '(11) 98765-4321' }), false);
  assert.equal(isWahaChatIdBoundToConversation('https://attacker.example', { phone: '+55 11 98765-4321' }), false);
  assert.equal(isWahaChatIdBoundToConversation('5511987654321@c.us', {}), false);
});

test('the WAHA send route checks the recipient before recording or sending a message', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const routeStart = source.indexOf("app.post('/api/integrations/waha/send'");
  const routeEnd = source.indexOf("app.post('/api/integrations/waha/webhook'", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, 'WAHA send route should be present');
  const route = source.slice(routeStart, routeEnd);
  const guard = route.indexOf('isWahaChatIdBoundToConversation(body.chatId, data)');
  const historyMutation = route.indexOf('const pendingHistory');
  const providerSend = route.indexOf("'/api/sendText'");
  assert.ok(guard >= 0, 'send route must enforce conversation recipient binding');
  assert.ok(historyMutation > guard, 'recipient guard must run before message history changes');
  assert.ok(providerSend > guard, 'recipient guard must run before calling WAHA');
});
