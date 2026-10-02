export type WorkspaceRole = 'owner' | 'admin' | 'member';
export const permissionModules = ['crm', 'delivery', 'support', 'finance', 'sites', 'automations', 'integrations', 'settings', 'reports'] as const;
export type PermissionModule = typeof permissionModules[number];
export type ModulePermission = { read?: boolean; write?: boolean; delete?: boolean };
export type WorkspaceRecordScope = { mode: 'all' | 'selected'; clientIds: string[]; projectIds: string[] };
export type WorkspacePermissions = Partial<Record<PermissionModule, ModulePermission>> & { scope?: WorkspaceRecordScope };

export function canChangeProjectArchiveState(role: WorkspaceRole, currentStatus: unknown, nextStatus: unknown) {
  if (role !== 'member') return true;
  const archived = (status: unknown) => String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'arquivado';
  return archived(currentStatus) === archived(nextStatus);
}

function moduleForPath(path: string): PermissionModule | null {
  const resource = path.match(/^\/api\/workspace\/([a-z-]+)(?:\/|$)/)?.[1];
  if (resource && ['clients', 'leads', 'companies', 'contacts', 'proposals', 'services', 'contracts'].includes(resource)) return 'crm';
  if (resource && ['projects', 'tasks', 'events', 'hours', 'team'].includes(resource)) return 'delivery';
  if (resource && ['tickets', 'inbox', 'approvals', 'files', 'assignees'].includes(resource)) return 'support';
  if (resource && ['revenues', 'expenses', 'finance-accounts', 'finance-transactions', 'finance-transfers'].includes(resource)) return 'finance';
  if (resource && ['site-assets', 'monitors', 'repositories'].includes(resource)) return 'sites';
  if (resource === 'automations') return 'automations';
  if (resource === 'preferences' || resource === 'settings') return 'settings';
  if (resource === 'reports' || resource === 'goals') return 'reports';
  if (path === '/api/clients' || path.startsWith('/api/clients/')) return 'crm';
  if (path.startsWith('/api/integrations/github/')) return 'sites';
  if (path.startsWith('/api/billing/')) return 'finance';
  if (path.startsWith('/api/integrations/google/calendar/')) return 'delivery';
  if (path.startsWith('/api/integrations/google/gmail') || path === '/api/integrations/google/drive/files'
    || path.startsWith('/api/integrations/google/drive/upload') || /^\/api\/integrations\/google\/drive\/[^/]+\/metadata$/.test(path)
    || path.startsWith('/api/integrations/waha/')
    || path === '/api/integrations/hostinger/inbox' || path === '/api/integrations/hostinger/send'
    || /^\/api\/integrations\/hostinger\/[^/]+\/read$/.test(path)) return 'support';
  if (path.startsWith('/api/integrations/n8n/')) return 'automations';
  if (path.startsWith('/api/integrations/')) return 'integrations';
  return null;
}

function roleBaseline(role: WorkspaceRole, verb: string, path: string) {
  if (role === 'admin') {
    if (/^\/api\/integrations\/[^/]+\/(?:test|connection)$/.test(path)) return false;
    if (path === '/api/integrations/hostinger/configure') return false;
    if (path.startsWith('/api/integrations/waha/sessions')) return verb === 'GET' && path === '/api/integrations/waha/sessions';
    if (path.startsWith('/api/integrations/google/authorize') || path === '/api/integrations/google/disconnect') return false;
    return true;
  }

  const workspaceResource = path.match(/^\/api\/workspace\/([a-z-]+)(?:\/|$)/)?.[1];
  if (workspaceResource) {
    const readable = new Set(['clients', 'projects', 'tasks', 'events', 'tickets', 'inbox', 'approvals', 'files', 'preferences', 'assignees']);
    const writable = new Set(['projects', 'tasks', 'events', 'tickets', 'inbox', 'approvals', 'files']);
    if (verb === 'GET' && readable.has(workspaceResource)) return true;
    if (verb === 'POST' && ['tasks', 'events', 'tickets', 'inbox', 'approvals', 'files'].includes(workspaceResource)) return true;
    if (verb === 'PATCH' && writable.has(workspaceResource)) return true;
    if (verb === 'DELETE' && ['tasks', 'tickets'].includes(workspaceResource)) return true;
  }
  if (verb === 'GET' && path === '/api/notifications') return true;
  if (verb === 'POST' && path === '/api/notifications/read') return true;
  if (verb === 'GET' && path === '/api/integrations/google/gmail') return true;
  if (verb === 'GET' && path.startsWith('/api/integrations/google/calendar/events')) return true;
  if (verb === 'POST' && path === '/api/integrations/google/calendar/events') return true;
  if (verb === 'PATCH' && path === '/api/integrations/google/calendar/events') return true;
  if (verb === 'DELETE' && /^\/api\/integrations\/google\/calendar\/events\/[^/]+$/.test(path)) return true;
  if (verb === 'POST' && /^\/api\/integrations\/google\/gmail\/[^/]+\/(?:reply|read)$/.test(path)) return true;
  if (verb === 'POST' && path === '/api/integrations/google/gmail/send') return true;
  if (verb === 'GET' && path === '/api/integrations/hostinger/inbox') return true;
  if (verb === 'POST' && (path === '/api/integrations/hostinger/send' || /^\/api\/integrations\/hostinger\/[^/]+\/read$/.test(path))) return true;
  if (verb === 'GET' && path === '/api/integrations/google/drive/files') return true;
  if (verb === 'PATCH' && /^\/api\/integrations\/google\/drive\/[^/]+\/metadata$/.test(path)) return true;
  if (verb === 'GET' && path === '/api/integrations/waha/sessions') return true;
  if (verb === 'POST' && path === '/api/integrations/google/drive/upload') return true;
  if (verb === 'POST' && path === '/api/integrations/waha/send') return true;
  return false;
}

export function isWorkspaceRequestAllowed(role: WorkspaceRole, method: string, requestUrl: string, permissions?: WorkspacePermissions | null) {
  const verb = method.toUpperCase();
  const path = requestUrl.split('?', 1)[0] || '/';
  if (role === 'owner') return true;
  if (path === '/api/workspace/backup' || path === '/api/workspace/backup/restore') return false;
  if (path === '/api/auth/me' || path === '/api/auth/logout') return true;
  if (permissions?.scope?.mode === 'selected' && (path === '/api/clients' || path.startsWith('/api/clients/'))) return false;
  if (path === '/api/team' || path.startsWith('/api/team/')) return false;
  if (path === '/api/workspace/assignees' || path.startsWith('/api/workspace/assignees/')) return verb === 'GET';

  // Credentials and integration lifecycle controls remain administrator-owned.
  if (/^\/api\/integrations\/[^/]+\/(?:test|connection)$/.test(path)
    || path.startsWith('/api/integrations/google/authorize') || path === '/api/integrations/google/disconnect'
    || (path.startsWith('/api/integrations/waha/sessions') && !(verb === 'GET' && path === '/api/integrations/waha/sessions'))) return false;

  const module = moduleForPath(path);
  const level = verb === 'GET' || verb === 'HEAD' ? 'read' : verb === 'DELETE' ? 'delete' : 'write';
  const override = module ? permissions?.[module]?.[level] : undefined;
  if (module && ['write', 'delete'].includes(level) && override === true && permissions?.[module]?.read !== true) return false;
  if (module && permissions?.[module] && typeof override !== 'boolean') return false;
  if (typeof override === 'boolean') return override;
  return roleBaseline(role, verb, path);
}
