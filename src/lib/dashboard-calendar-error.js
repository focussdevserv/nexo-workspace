const authorizationErrors = new Set([
  'google_authorization_required',
  'google_reauthorization_required',
  'google_calendar_scope_required',
  'google_token_refresh_unavailable',
  'google_token_refresh_failed',
]);

export function dashboardCalendarError(error, canManageIntegration = true) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (code === 'integration_disconnected') {
    if (!canManageIntegration) return {
      title: 'Google Calendar está desconectado',
      detail: 'Os compromissos salvos no Focusshub continuam visíveis. Peça à pessoa proprietária do workspace para reativar a integração.',
      action: null,
      actionLabel: '',
    };
    return {
      title: 'Google Calendar está desconectado',
      detail: 'Os compromissos salvos no Focusshub continuam visíveis. Reative a integração para consultar também os eventos do Google.',
      action: 'integrations',
      actionLabel: 'Abrir Integrações',
    };
  }
  if (authorizationErrors.has(code)) {
    if (!canManageIntegration) return {
      title: 'Google Calendar precisa de autorização',
      detail: 'Os compromissos salvos no Focusshub continuam visíveis. Peça à pessoa proprietária do workspace para autorizar novamente o calendário.',
      action: null,
      actionLabel: '',
    };
    return {
      title: 'É preciso autorizar o Google Calendar',
      detail: 'Os compromissos salvos no Focusshub continuam visíveis. Autorize novamente o calendário para incluir seus eventos do Google.',
      action: 'authorize',
      actionLabel: 'Autorizar Google',
    };
  }
  return {
    title: 'Não foi possível sincronizar o Google Calendar',
    detail: 'Os compromissos salvos no Focusshub continuam visíveis. Tente atualizar para carregar os eventos do Google.',
    action: 'retry',
    actionLabel: 'Tentar novamente',
  };
}
