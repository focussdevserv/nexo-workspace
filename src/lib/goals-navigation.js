export function shouldConfirmGoalsNavigation(dirty, destinationPage, currentPage = 'Metas') {
  return Boolean(dirty && destinationPage && destinationPage !== currentPage);
}

export function guardGoalsNavigation(event, { dirty, confirmLeave, currentPage = 'Metas' }) {
  if (!shouldConfirmGoalsNavigation(dirty, event.detail?.page, currentPage)) return true;
  if (confirmLeave('Há alterações não salvas em Metas. Sair desta tela e descartá-las?')) return true;
  event.preventDefault();
  return false;
}
