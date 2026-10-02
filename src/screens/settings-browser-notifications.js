export async function enableBrowserNotifications(NotificationApi = globalThis.Notification) {
  if (!NotificationApi) return { status: 'unsupported' };

  const permission = NotificationApi.permission === 'default'
    ? await NotificationApi.requestPermission()
    : NotificationApi.permission;
  if (permission !== 'granted') return { status: permission === 'denied' ? 'denied' : 'unsupported' };

  new NotificationApi('Focusshub', {
    body: 'As notificações deste navegador estão funcionando.',
    tag: 'focusshub-notification-test',
  });
  return { status: 'granted' };
}
