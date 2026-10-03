const pageModules = new Map([
  ['crm', 'crm'], ['leads', 'crm'], ['pipeline', 'crm'], ['clientes', 'crm'], ['empresas', 'crm'],
  ['contatos', 'crm'], ['propostas', 'crm'], ['servicos', 'crm'], ['contratos', 'crm'],
  ['portal do cliente', 'crm'],
  ['agenda', 'delivery'], ['tarefas', 'delivery'], ['projetos', 'delivery'], ['horas', 'delivery'],
  ['arquivos', 'delivery'],
  ['caixa de entrada', 'support'], ['aprovacoes', 'support'], ['whatsapp', 'support'], ['tickets', 'support'],
  ['sites', 'sites'], ['dominios', 'sites'], ['hospedagens', 'sites'], ['repositorios', 'sites'], ['monitoramento', 'sites'],
  ['financeiro', 'finance'], ['receitas', 'finance'], ['despesas', 'finance'], ['contas', 'finance'],
  ['cobrancas', 'finance'], ['assinaturas', 'finance'],
  ['automacoes', 'automations'], ['integracoes', 'integrations'],
  ['relatorios', 'reports'], ['metas', 'reports'], ['configuracoes', 'settings'],
  ['equipe', 'team'],
]);

const memberPagesWithoutModulePermission = new Set([
  'meu dia', 'agenda', 'tarefas', 'caixa de entrada', 'aprovacoes', 'projetos', 'arquivos', 'tickets',
]);

function normalizedPage(page) {
  return typeof page === 'string'
    ? page.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
    : '';
}

export function workspacePagePermissionModule(page) {
  return pageModules.get(normalizedPage(page)) || null;
}

export function roleCanOpenWorkspacePage(role, page, permissions = null) {
  if (!['owner', 'admin', 'member'].includes(role)) return false;
  const normalized = normalizedPage(page);
  if (normalized === 'equipe') return role === 'owner';
  if (role === 'owner') return true;

  const module = workspacePagePermissionModule(page);
  const modulePermissions = module && permissions?.[module];
  const explicitRead = modulePermissions?.read;
  if (typeof explicitRead === 'boolean') return explicitRead;
  if (modulePermissions) return false;
  return role !== 'member' || memberPagesWithoutModulePermission.has(normalized);
}
