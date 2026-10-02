export async function logoutWorkspace({ request, storage }) {
  await request('/api/auth/logout', { method: 'POST', body: '{}' });
  storage.removeItem('nexo.api.token');
  storage.removeItem('nexo.api.user');
  storage.removeItem('nexo.workspace.activePage');
}
