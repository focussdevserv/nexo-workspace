type GitHubCommit = { sha?: string; html_url?: string; commit?: { message?: string; author?: { name?: string; date?: string } } };
type GitHubPullRequest = { number?: number; title?: string; html_url?: string; user?: { login?: string }; updated_at?: string };
type GitHubDeployment = { id?: number; environment?: string; ref?: string; created_at?: string; statuses_url?: string };
type GitHubDeploymentStatus = { state?: string; environment_url?: string; target_url?: string; created_at?: string };

export function mapGitHubRepositoryActivity(input: {
  repository: Record<string, any>;
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  deployments: GitHubDeployment[];
  deploymentStatuses: GitHubDeploymentStatus[];
}) {
  const latestCommit = input.commits[0];
  const latestDeployment = input.deployments[0];
  const latestDeploymentStatus = input.deploymentStatuses[0];
  return {
    repository: {
      name: String(input.repository.name ?? ''),
      fullName: String(input.repository.full_name ?? ''),
      url: String(input.repository.html_url ?? ''),
      description: String(input.repository.description ?? ''),
      defaultBranch: String(input.repository.default_branch ?? 'main'),
      private: Boolean(input.repository.private),
      updatedAt: String(input.repository.updated_at ?? ''),
    },
    latestCommit: latestCommit ? {
      sha: String(latestCommit.sha ?? '').slice(0, 7),
      message: String(latestCommit.commit?.message ?? '').split(/\r?\n/, 1)[0],
      author: String(latestCommit.commit?.author?.name ?? ''),
      date: String(latestCommit.commit?.author?.date ?? ''),
      url: String(latestCommit.html_url ?? ''),
    } : null,
    pullRequests: input.pullRequests.slice(0, 5).map((pull) => ({
      number: Number(pull.number ?? 0), title: String(pull.title ?? ''), url: String(pull.html_url ?? ''),
      author: String(pull.user?.login ?? ''), updatedAt: String(pull.updated_at ?? ''),
    })),
    deployment: latestDeployment ? {
      environment: String(latestDeployment.environment ?? ''), ref: String(latestDeployment.ref ?? ''),
      state: String(latestDeploymentStatus?.state ?? 'pending'),
      url: String(latestDeploymentStatus?.environment_url ?? latestDeploymentStatus?.target_url ?? ''),
      createdAt: String(latestDeploymentStatus?.created_at ?? latestDeployment.created_at ?? ''),
    } : null,
    syncedAt: new Date().toISOString(),
  };
}
