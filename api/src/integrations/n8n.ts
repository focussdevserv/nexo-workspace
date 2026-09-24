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

export function n8nApiKeyFailureMessage(status: number) {
  if (status === 401) return 'n8n respondeu HTTP 401. A chave do Coolify não corresponde a uma chave ativa nesta instância; gere uma chave nova, copie o valor completo e faça redeploy.';
  if (status === 403) return 'n8n respondeu HTTP 403. A chave foi reconhecida, mas não tem os escopos necessários para consultar workflows. Revise workflow:list e workflow:read.';
  return `n8n recusou a autenticação com HTTP ${status}. Confira a chave e as permissões no n8n.`;
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

export const n8nAutomationTemplates = {
  'new-lead-follow-up': { eventKey: 'lead.created', taskKind: 'lead' },
  'proposal-accepted-project': { eventKey: 'proposal.accepted', taskKind: 'proposal' },
  'payment-confirmed': { eventKey: 'payment.confirmed', taskKind: 'payment' },
  'project-delivery-follow-up': { eventKey: 'project.published', taskKind: 'project' },
  'new-support-ticket': { eventKey: 'ticket.created', taskKind: 'ticket' },
} as const;

export type N8nAutomationTemplateId = keyof typeof n8nAutomationTemplates;

export function buildN8nAutomationWorkflow(input: {
  automationId: string;
  templateId: N8nAutomationTemplateId;
  name: string;
  webhookPath: string;
  callbackUrl: string;
  credentialId: string;
}) {
  const credential = { id: input.credentialId, name: 'Nexo Workspace Automation Bridge' };
  const eventExpression = `={{ JSON.stringify({ automationId: "${input.automationId}", event: $json.body || $json }) }}`;
  return {
    name: `Nexo · ${input.name}`.slice(0, 120),
    nodes: [
      {
        id: 'nexo-webhook-trigger', name: 'Evento do Nexo', type: 'n8n-nodes-base.webhook', typeVersion: 2,
        position: [260, 300], parameters: { httpMethod: 'POST', path: input.webhookPath, authentication: 'headerAuth', responseMode: 'lastNode', options: {} },
        credentials: { httpHeaderAuth: credential },
      },
      {
        id: 'nexo-action', name: 'Executar ação no Nexo', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
        position: [520, 300], parameters: {
          method: 'POST', url: input.callbackUrl, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
          sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: eventExpression, options: { timeout: 10000 },
        },
        credentials: { httpHeaderAuth: credential },
      },
    ],
    connections: { 'Evento do Nexo': { main: [[{ node: 'Executar ação no Nexo', type: 'main', index: 0 }]] } },
    settings: { executionTimeout: 15, saveDataSuccessExecution: 'none', saveDataErrorExecution: 'none', saveManualExecutions: false, callerPolicy: 'none' },
    staticData: null,
    meta: { templateId: `nexo:${input.templateId}` },
  };
}
