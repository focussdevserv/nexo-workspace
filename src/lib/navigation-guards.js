export function confirmSettingsNavigation({ dirty, destinationPage, confirmLeave }) {
  if (!dirty || destinationPage === 'Configurações') return true;
  return confirmLeave('Há alterações não salvas em Configurações. Sair desta tela e descartá-las?');
}

export function dispatchBeforeWorkspaceNavigation(target, page, context = null) {
  const event = new CustomEvent('nexo:before-navigate', {
    cancelable: true,
    detail: { page, context },
  });
  return target.dispatchEvent(event);
}

export function workspaceRouteDestination(page, canOpenPage) {
  return page && canOpenPage ? page : 'Meu Dia';
}
