import assert from 'node:assert/strict';
import test from 'node:test';
import { enableBrowserNotifications } from './settings-browser-notifications.js';

test('requests browser permission and sends a test notification when granted', async () => {
  const seen = [];
  class NotificationStub {
    static permission = 'default';
    static async requestPermission() { NotificationStub.permission = 'granted'; return 'granted'; }
    constructor(title, options) { seen.push({ title, options }); }
  }

  assert.deepEqual(await enableBrowserNotifications(NotificationStub), { status: 'granted' });
  assert.equal(seen[0].title, 'Focusshub');
  assert.match(seen[0].options.body, /funcionando/);
});

test('does not send a notification when permission is denied or unavailable', async () => {
  class DeniedNotification {
    static permission = 'denied';
    static async requestPermission() { throw new Error('Should not prompt after denial'); }
    constructor() { assert.fail('Should not send a notification'); }
  }

  assert.deepEqual(await enableBrowserNotifications(DeniedNotification), { status: 'denied' });
  assert.deepEqual(await enableBrowserNotifications(undefined), { status: 'unsupported' });
});
