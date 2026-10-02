const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const repoPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

/** Validate first so rejected submissions cannot invalidate an in-flight request. */
export function startGithubActivityRequest(requestGuard, owner, repo, integrationState) {
  if (!ownerPattern.test(String(owner || '').trim()) || !repoPattern.test(String(repo || '').trim())) {
    return { requestId: null, error: 'Informe proprietário e repositório com nomes válidos do GitHub.' };
  }
  if (!integrationState?.configured || !integrationState?.enabled) {
    return {
      requestId: null,
      error: integrationState?.configured ? 'Reative o GitHub no Focusshub antes de consultar.' : 'Configure GITHUB_TOKEN no serviço API antes de consultar.',
    };
  }
  return { requestId: requestGuard.begin(), error: '' };
}
