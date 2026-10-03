const asText = (value) => typeof value === 'string' ? value : '';

/** Keep the last successful snapshot visible when a later refresh fails. */
export function repositoryActivityDisplayState({ activity = null, error = '' } = {}) {
  return {
    hasActivity: Boolean(activity),
    hasError: Boolean(error),
    stale: Boolean(activity && error),
    showEmptyHint: !activity && !error,
  };
}

/** Cached GitHub activity belongs to a repository identity, not the workspace record ID. */
export function repositoryActivityIdentityChanged(previous, next) {
  const identity = (repository) => [repository?.owner, repository?.name]
    .map((value) => String(value || '').trim().toLocaleLowerCase('en-US'));
  const before = identity(previous);
  const after = identity(next);
  return before[0] !== after[0] || before[1] !== after[1];
}

/** GitHub activity can contain user-controlled deployment URLs; only link to credential-free HTTPS destinations. */
export function safeRepositoryExternalUrl(value) {
  if (typeof value !== 'string' || /[\\\u0000-\u001f]/.test(value)) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/** Normalize optional GitHub fields so a partial API response cannot break the repositories screen. */
export function normalizeRepositoryActivity(value) {
  const activity = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const repository = activity.repository && typeof activity.repository === 'object' && !Array.isArray(activity.repository)
    ? activity.repository
    : {};
  const rawCommit = activity.latestCommit && typeof activity.latestCommit === 'object' && !Array.isArray(activity.latestCommit)
    ? activity.latestCommit
    : null;
  const rawDeployment = activity.deployment && typeof activity.deployment === 'object' && !Array.isArray(activity.deployment)
    ? activity.deployment
    : null;

  return {
    repository: {
      fullName: asText(repository.fullName),
      url: safeRepositoryExternalUrl(repository.url),
      defaultBranch: asText(repository.defaultBranch),
    },
    latestCommit: rawCommit ? {
      sha: asText(rawCommit.sha),
      message: asText(rawCommit.message),
      author: asText(rawCommit.author),
    } : null,
    pullRequests: Array.isArray(activity.pullRequests)
      ? activity.pullRequests.filter((pull) => pull && typeof pull === 'object' && !Array.isArray(pull)).map((pull) => ({
        number: Number.isFinite(Number(pull.number)) ? Number(pull.number) : '',
        title: asText(pull.title),
      }))
      : [],
    deployment: rawDeployment ? {
      environment: asText(rawDeployment.environment),
      state: asText(rawDeployment.state) || 'desconhecido',
      url: safeRepositoryExternalUrl(rawDeployment.url),
    } : null,
    syncedAt: typeof activity.syncedAt === 'string' && Number.isFinite(Date.parse(activity.syncedAt))
      ? activity.syncedAt
      : null,
  };
}
