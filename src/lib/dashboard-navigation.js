export function shouldRefreshDashboardOnNavigation(previousPage, nextPage, userNavigated = false) {
  return userNavigated && previousPage !== 'Meu Dia' && nextPage === 'Meu Dia';
}
