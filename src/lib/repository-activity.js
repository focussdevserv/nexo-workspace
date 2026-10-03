const asText = (value) => typeof value === 'string' ? value : '';

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
      url: asText(repository.url),
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
      url: asText(rawDeployment.url),
    } : null,
    syncedAt: typeof activity.syncedAt === 'string' && Number.isFinite(Date.parse(activity.syncedAt))
      ? activity.syncedAt
      : null,
  };
}
