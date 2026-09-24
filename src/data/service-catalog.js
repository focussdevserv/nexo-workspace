const catalogGroups = {
  'Serviços avulsos': [
    'Landing Page', 'Site One Page', 'Site Institucional', 'Site Profissional', 'Site Premium',
    'Site para Clínica', 'Site para Advogado', 'Site para Imobiliária', 'Site para Restaurante',
    'Site para Prestador de Serviços', 'Catálogo Digital', 'Loja Virtual', 'E-commerce Premium',
    'Portal', 'Marketplace', 'Blog', 'Aplicativo', 'Sistema Interno', 'CRM', 'ERP', 'Dashboard',
    'SaaS', 'Chatbot', 'Chatbot com IA', 'Automação de WhatsApp', 'Automação Comercial',
    'Integrações', 'Criação de Logo', 'Identidade Visual', 'Branding', 'Design para Redes Sociais',
    'Banners', 'Materiais Gráficos', 'Google Meu Negócio', 'Gestão de Google Meu Negócio',
    'Consultoria Digital', 'Consultoria de Automação', 'Consultoria de Sistemas',
    'Manutenção de Sites', 'Manutenção de Sistemas', 'Hospedagem', 'Suporte Técnico',
  ],
  'Sites — do barato ao caro': [
    'Página Express', 'Landing Page Start', 'Landing Page Pro', 'Site One Page',
    'Site Institucional Start', 'Site Institucional Pro', 'Site Empresarial', 'Site Premium',
    'Site Corporativo', 'Catálogo Digital', 'Loja Virtual Start', 'E-commerce Pro',
    'Portal Profissional', 'Marketplace', 'Plataforma Web', 'Sistema Web Personalizado',
  ],
  Pacotes: [
    'Pacote Start', 'Pacote Presença Digital', 'Pacote Negócio Local', 'Pacote Profissional',
    'Pacote Empresa Digital', 'Pacote Comercial', 'Pacote Vendas', 'Pacote Marca Completa',
    'Pacote Automação', 'Pacote WhatsApp', 'Pacote Google', 'Pacote Marketing Digital',
    'Pacote Business', 'Pacote Business Pro', 'Pacote Empresa 360',
    'Pacote Transformação Digital', 'Pacote Sistema Completo', 'Pacote SaaS',
    'Pacote Aplicativo', 'Pacote Premium',
  ],
  'Planos mensais': [
    'Plano Essencial', 'Plano Start', 'Plano Site Care', 'Plano Digital', 'Plano Pro',
    'Plano Business', 'Plano Automação', 'Plano Growth', 'Plano Empresa 360', 'Plano Premium',
  ],
};

const starterChecklist = {
  'Serviços avulsos': ['Confirmar objetivo e escopo', 'Reunir materiais e acessos', 'Executar o serviço', 'Revisar com o cliente', 'Registrar aceite e entrega'],
  'Sites — do barato ao caro': ['Briefing e referências', 'Arquitetura e conteúdo', 'Design responsivo', 'Desenvolvimento e integrações', 'Testes e revisão', 'Aprovação do cliente', 'Publicação e entrega de acessos'],
  Pacotes: ['Confirmar itens incluídos e limites', 'Reunir materiais e acessos', 'Planejar entregas e responsáveis', 'Executar os itens contratados', 'Revisão e aceite do cliente', 'Entrega e orientação'],
  'Planos mensais': ['Confirmar início e ciclo de cobrança', 'Conferir acessos e escopo contratado', 'Executar rotina do período', 'Registrar atividades e pendências', 'Enviar resumo ao cliente'],
};

export const requestedServiceCatalog = Object.entries(catalogGroups).flatMap(([group, names]) => names.map((name) => ({
  name,
  category: group === 'Sites — do barato ao caro' ? 'Desenvolvimento' : group === 'Pacotes' ? 'Pacote' : group === 'Planos mensais' ? 'Recorrente' : 'Serviço',
  catalogGroup: group,
  description: '',
  price: '',
  cadence: group === 'Planos mensais' ? 'Mensal' : 'Projeto fechado',
  duration: '',
  cost: '',
  responsible: '',
  templateTasks: starterChecklist[group],
  proposalTemplate: '',
  contractTemplate: '',
  color: group === 'Planos mensais' ? 'green' : group === 'Pacotes' ? 'purple' : group === 'Sites — do barato ao caro' ? 'blue' : 'amber',
  status: 'Rascunho',
})));

export function mergeRequestedServiceCatalog(existingServices = [], requestedServices = requestedServiceCatalog) {
  const names = new Set(existingServices.map((item) => String(item.name || '').trim().toLocaleLowerCase('pt-BR')));
  return requestedServices.filter((item) => {
    const name = String(item.name || '').trim().toLocaleLowerCase('pt-BR');
    if (!name || names.has(name)) return false;
    names.add(name);
    return true;
  });
}
