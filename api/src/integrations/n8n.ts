type N8nWorkflowSummary = {
  id: unknown;
  name?: unknown;
  active?: unknown;
  triggerCount?: unknown;
  updatedAt?: unknown;
};

type N8nExecutionSummary = {
  id: unknown;
  workflowId?: unknown;
  status?: unknown;
  finished?: unknown;
  startedAt?: unknown;
  stoppedAt?: unknown;
  mode?: unknown;
};

function safeDate(value: unknown) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

export function mapN8nCollections(workflowEntries: unknown[], executionEntries: unknown[]) {
  const workflows = workflowEntries.filter((entry): entry is N8nWorkflowSummary => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      name: typeof item.name === 'string' ? item.name : 'Workflow sem nome',
      active: item.active === true,
      triggerCount: Number.isFinite(Number(item.triggerCount)) ? Number(item.triggerCount) : 0,
      updatedAt: safeDate(item.updatedAt),
    })).filter((item) => item.id.length > 0);
  const workflowNames = new Map(workflows.map((item) => [item.id, item.name]));
  const executions = executionEntries.filter((entry): entry is N8nExecutionSummary => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((item) => {
      const workflowId = typeof item.workflowId === 'string' ? item.workflowId : '';
      const status = typeof item.status === 'string' ? item.status : item.finished === true ? 'success' : 'running';
      return {
        id: typeof item.id === 'string' ? item.id : '',
        workflowId,
        workflowName: workflowNames.get(workflowId) ?? 'Workflow removido',
        status: ['canceled', 'crashed', 'error', 'new', 'running', 'success', 'unknown', 'waiting'].includes(status) ? status : 'unknown',
        startedAt: safeDate(item.startedAt),
        stoppedAt: safeDate(item.stoppedAt),
        mode: typeof item.mode === 'string' ? item.mode : null,
      };
    }).filter((item) => item.id.length > 0);
  return { workflows, executions };
}
