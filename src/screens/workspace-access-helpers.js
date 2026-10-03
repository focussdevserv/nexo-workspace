export function prefillRecoveryEmail(loginEmail) {
  return typeof loginEmail === 'string' ? loginEmail.trim() : '';
}

export function normalizeAuthEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function passwordConfirmationMatches(password, confirmation) {
  return typeof password === 'string' && typeof confirmation === 'string' && password === confirmation;
}

export function readPasswordResetToken(hash) {
  if (typeof hash !== 'string') return '';
  return new URLSearchParams(hash.replace(/^#/, '')).get('reset') || '';
}

export function readWorkspaceAccessMode(hash) {
  if (typeof hash !== 'string') return 'login';
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.has('reset')) return 'reset-complete';
  return params.get('access') === 'reset-request' ? 'reset-request' : 'login';
}

export function workspaceAccessModeUrl(href, mode) {
  const url = new URL(href);
  url.searchParams.delete('invite');
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  params.delete('reset');
  params.delete('invite');
  params.delete('access');
  if (mode === 'reset-request') params.set('access', mode);
  url.hash = params.toString();
  return url.toString();
}

export function stripWorkspaceAccessTokens(href) {
  const url = new URL(href);
  url.searchParams.delete('invite');
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const hadHashToken = hashParams.has('reset') || hashParams.has('invite');
  if (hadHashToken) {
    hashParams.delete('reset');
    hashParams.delete('invite');
    url.hash = hashParams.toString();
  }
  return url.toString();
}
