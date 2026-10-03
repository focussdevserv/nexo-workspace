import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
const eventListeners = new Map();

globalThis.localStorage = localStorage;
globalThis.sessionStorage = localStorage;
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};
globalThis.window = {
  localStorage,
  sessionStorage: localStorage,
  location: { search: '', pathname: '/app/meu-dia', hash: '', origin: 'http://localhost' },
  history: { state: null, replaceState() {} },
  matchMedia: () => ({ matches: false }),
  addEventListener: (type, listener) => eventListeners.set(type, listener),
  removeEventListener: (type) => eventListeners.delete(type),
  dispatchEvent: () => true,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
  confirm: () => true,
};
globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: { dataset: {}, style: {}, lang: 'pt-BR' },
  body: { appendChild() {}, removeChild() {} },
};

const demoWorkspaceApi = {
  name: 'focusshub-local-demo-workspace-api',
  enforce: 'pre',
  resolveId(id) {
    return id.includes('workspace-api.js') ? '\0focusshub-local-demo-workspace-api' : null;
  },
  load(id) {
    if (id !== '\0focusshub-local-demo-workspace-api') return null;
    return `
      export function useWorkspaceRecords(resource) {
        const result = globalThis.__focusshubDemoRead('/api/workspace/' + resource + '?limit=200');
        return {
          records: Array.isArray(result?.data) ? result.data : [],
          loading: false,
          error: '',
          refresh: async () => {},
          create: async () => ({}),
          update: async () => ({}),
          remove: async () => {},
        };
      }
      export async function apiRequest(path) { return globalThis.__focusshubDemoRead(path); }
      export async function fetchAllRecords(path) {
        const result = globalThis.__focusshubDemoRead(path + '?limit=200');
        return Array.isArray(result?.data) ? result.data : [];
      }
    `;
  },
};

const routeGroups = [
  ['commercial', ['CRM', 'Leads', 'Pipeline', 'Clientes', 'Empresas', 'Contatos', 'Propostas', 'Serviços', 'Contratos']],
  ['work', ['Agenda', 'Tarefas', 'Aprovações', 'Projetos', 'Horas', 'Arquivos']],
  ['service', ['Financeiro', 'Receitas', 'Despesas', 'Contas', 'Cobranças', 'Assinaturas', 'Caixa de entrada', 'WhatsApp', 'Tickets', 'Sites', 'Domínios', 'Hospedagens', 'Monitoramento', 'Integrações', 'Automações']],
  ['admin', ['Equipe', 'Relatórios', 'Metas', 'Configurações', 'Portal do cliente', 'Repositórios']],
];
const screenModules = {
  commercial: '/src/screens/CommercialScreens.jsx',
  work: '/src/screens/WorkScreens.jsx',
  service: '/src/screens/ServiceScreens.jsx',
  admin: '/src/screens/AdminScreens.jsx',
};

const vite = await createServer({
  configFile: './vite.config.js',
  plugins: [demoWorkspaceApi],
  server: { middlewareMode: true },
  appType: 'custom',
});

let total = 0;
const failures = [];
try {
  const demo = await vite.ssrLoadModule('/src/lib/local-demo.js');
  demo.activateLocalDemo();
  globalThis.__focusshubDemoRead = demo.handleLocalDemoRequest;

  for (const [group, pages] of routeGroups) {
    const { default: Screen } = await vite.ssrLoadModule(screenModules[group]);
    for (const page of pages) {
      total += 1;
      try {
        const html = renderToString(React.createElement(Screen, { page }));
        if (!html.length) throw new Error('A tela não gerou HTML.');
      } catch (error) {
        failures.push({ page, name: error?.name || 'Error', message: error?.message || 'Falha sem mensagem.' });
      }
    }
  }

  const contacts = demo.handleLocalDemoRequest('/api/workspace/contacts?limit=200').data || [];
  console.log(JSON.stringify({ total, passed: total - failures.length, seededContacts: contacts.length, failures }));
  if (failures.length) process.exitCode = 1;
} finally {
  await vite.close();
}
