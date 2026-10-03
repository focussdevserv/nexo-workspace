/** Prevent conflicting or duplicate actions on one repository card. */
export function canStartRepositoryOperation({ syncingRepos = new Set(), removingRepos = new Set() } = {}, repoId, operation) {
  const key = String(repoId);
  if (operation === 'sync') return !syncingRepos.has(key) && !removingRepos.has(key);
  if (operation === 'remove') return !syncingRepos.has(key) && !removingRepos.has(key);
  return false;
}
