import React, { useEffect, useRef, useState } from 'react';
import {
  Bell, Building2, Check, ChevronRight, CircleHelp, Database, Download,
  Globe2, KeyRound, Link2, LockKeyhole, Mail, Palette, RotateCcw,
  ShieldCheck, SlidersHorizontal, Upload, UserRound, Users, Webhook,
} from 'lucide-react';
import './settings.css';
import { apiRequest, useWorkspaceRecords } from '../lib/workspace-api.js';

const defaults = {
  workspace: { agency: '', timezone: 'America/Sao_Paulo', weekStart: 'monday', currency: 'BRL', dateFormat: 'dd/MM/yyyy', language: 'pt-BR', fiscalName: '', document: '', email: '', phone: '', website: '', address: '' },
  preferences: { compact: false, dark: false, startPage: 'Meu Dia', showCompleted: false, confirmDelete: true },
  notifications: { taskDue: true, overdue: true, newLead: true, proposal: true, payment: true, weekly: true, email: true, browser: false, whatsapp: false, quietHours: false, quietStart: '20:00', quietEnd: '08:00' },
  permissions: { role: 'member', invitePolicy: 'admin', allowClientPortal: true, require2fa: false, sessionDays: '30' },
  billing: { defaultDueDays: '7', reminderDays: '3, 1, 0, -3', lateFee: '2', interest: '1', pix: true, boleto: true, card: true, autoRenew: true },
};
const sections = [
  { id: 'workspace', label: 'Workspace', hint: 'Idioma, moeda e preferências', icon: SlidersHorizontal },
  { id: 'agency', label: 'Perfil da agência', hint: 'Dados e identidade da empresa', icon: Building2 },
  { id: 'notifications', label: 'Notificações', hint: 'Alertas e lembretes automáticos', icon: Bell },
  { id: 'team', label: 'Equipe e acesso', hint: 'Papéis, convites e segurança', icon: Users },
  { id: 'billing', label: 'Financeiro', hint: 'Padrões de cobrança e pagamentos', icon: Database },
  { id: 'integrations', label: 'Integrações', hint: 'Serviços conectados ao workspace', icon: Link2 },
  { id: 'security', label: 'Segurança', hint: 'Sessões, autenticação e acesso', icon: ShieldCheck },
  { id: 'data', label: 'Dados e exportação', hint: 'Backup e preferências de dados', icon: Download },
];
const integrations = [
  { name: 'Mercado Pago', type: 'Pagamentos', detail: 'Cobranças, pagamentos e assinaturas', icon: 'MP' },
  { name: 'Evolution API', type: 'WhatsApp', detail: 'Conversas, notificações e follow-up', icon: 'WA' },
  { name: 'WAHA', type: 'WhatsApp', detail: 'Conecte uma instância WhatsApp', icon: 'WA' },
  { name: 'Resend', type: 'E-mail', detail: 'E-mails transacionais e propostas', icon: 'RE' },
  { name: 'Google Workspace', type: 'Produtividade', detail: 'Gmail, Calendar, Drive e Meet', icon: 'G' },
  { name: 'GitHub', type: 'Desenvolvimento', detail: 'Repositórios, commits e deploys', icon: 'GH' },
  { name: 'n8n', type: 'Automações', detail: 'Fluxos, webhooks e integrações', icon: 'n8n' },
  { name: 'Sentry', type: 'Monitoramento', detail: 'Erros e saúde das aplicações', icon: 'SE' },
];

export default function SettingsScreen({ notify }) {
  const { records, create, update: updateRecord } = useWorkspaceRecords('settings');
  const savedSettings = records.find((item) => item.key === 'workspace-preferences');
  const [settings, setSettings] = useState(structuredClone(defaults));
  const [active, setActive] = useState('workspace');
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [integrationsState, setIntegrationsState] = useState({});
  const fileRef = useRef(null);
  useEffect(() => {
    if (!savedSettings) return;
    setSettings(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...value, ...(savedSettings.settings?.[key] || {}) }])));
    setSavedAt(savedSettings.savedAt || '');
    setDirty(false);
  }, [savedSettings?.id, savedSettings?.updatedAt]);
  const refreshIntegrationStatus = async () => {
    try { const { data } = await apiRequest('/api/integrations/status'); setIntegrationsState(Object.fromEntries(data.map((item) => [item.name, item.configured]))); }
    catch (error) { notify(error.message || 'Could not load integration status.'); }
  };
  useEffect(() => { refreshIntegrationStatus(); }, []);
  useEffect(() => {
    const onBeforeUnload = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  const update = (group, field, value) => { setSettings((current) => ({ ...current, [group]: { ...current[group], [field]: value } })); setDirty(true); };
  const save = async () => {
    try {
      const timestamp = new Date().toISOString();
      const payload = { key: 'workspace-preferences', settings, savedAt: timestamp };
      if (savedSettings) await updateRecord(savedSettings.id, payload); else await create(payload);
      setSavedAt(timestamp); setDirty(false); notify('Workspace preferences saved.');
    } catch (error) { notify(error.message || 'Could not save preferences to the server.'); }
  };
  const toggleIntegration = (name) => { window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integrações' })); notify(`${name}: configure credentials on the server to change its status.`); };
  const exportData = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), settings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `nexo-configuracoes-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    URL.revokeObjectURL(url);
    notify('Arquivo de configurações exportado.');
  };
  const importData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!payload.settings || typeof payload.settings !== 'object') throw new Error('invalid');
      setSettings(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...value, ...(payload.settings[key] || {}) }])));
      setDirty(true);
      notify('Configurações importadas. Salve para aplicar.');
    } catch { notify('Esse arquivo não contém uma exportação válida do Nexo.'); }
    event.target.value = '';
  };
  const reset = () => {
    if (!window.confirm('Restaurar todas as configurações para os valores iniciais?')) return;
    setSettings(structuredClone(defaults)); setDirty(true);
    notify('Valores iniciais carregados. Salve para confirmar.');
  };
  const activeSection = sections.find((item) => item.id === active);

  return <div className="settings-layout">
    <aside className="settings-sidebar" aria-label="Seções das configurações">
      <div className="settings-side-title"><span>Workspace</span><strong>Configurações</strong></div>
      <nav>{sections.map(({ id, label, hint, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}><Icon size={16} /><span><b>{label}</b><small>{hint}</small></span><ChevronRight size={14} /></button>)}</nav>
      <div className="settings-help"><CircleHelp size={16} /><span><b>Precisa de ajuda?</b><small>Consulte a central de suporte.</small></span></div>
    </aside>

    <section className="settings-main">
      <div className="settings-main-head"><div><span className="settings-overline">PREFERÊNCIAS DO WORKSPACE</span><h2>{activeSection.label}</h2><p>{activeSection.hint}. As preferências sincronizam com o servidor ao salvar.</p></div><div className="settings-head-actions"><span className={`settings-save-state ${dirty ? 'pending' : ''}`}><i />{dirty ? 'Alterações não salvas' : savedAt ? `Salvo às ${new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Tudo atualizado'}</span><button className="admin-primary" onClick={save}><Check size={15} /> Salvar alterações</button></div></div>

      {active === 'workspace' && <>
        <SettingsCard title="Preferências gerais" description="Ajuste como o workspace organiza datas, valores e páginas." icon={SlidersHorizontal}><div className="settings-fields">
          <Field label="Nome do workspace"><input value={settings.workspace.agency} onChange={(e) => update('workspace', 'agency', e.target.value)} /></Field>
          <Field label="Idioma"><select value={settings.workspace.language} onChange={(e) => update('workspace', 'language', e.target.value)}><option value="pt-BR">Português (Brasil)</option><option value="en">English</option><option value="es">Español</option></select></Field>
          <Field label="Fuso horário"><select value={settings.workspace.timezone} onChange={(e) => update('workspace', 'timezone', e.target.value)}><option value="America/Sao_Paulo">Brasília (GMT−03:00)</option><option value="America/Manaus">Manaus (GMT−04:00)</option><option value="UTC">UTC</option></select></Field>
          <Field label="Moeda padrão"><select value={settings.workspace.currency} onChange={(e) => update('workspace', 'currency', e.target.value)}><option value="BRL">Real brasileiro · BRL</option><option value="USD">Dólar americano · USD</option><option value="EUR">Euro · EUR</option></select></Field>
          <Field label="Formato de data"><select value={settings.workspace.dateFormat} onChange={(e) => update('workspace', 'dateFormat', e.target.value)}><option value="dd/MM/yyyy">DD/MM/AAAA</option><option value="MM/dd/yyyy">MM/DD/AAAA</option><option value="yyyy-MM-dd">AAAA-MM-DD</option></select></Field>
          <Field label="A semana começa em"><select value={settings.workspace.weekStart} onChange={(e) => update('workspace', 'weekStart', e.target.value)}><option value="monday">Segunda-feira</option><option value="sunday">Domingo</option></select></Field>
          <Field label="Página inicial"><select value={settings.preferences.startPage} onChange={(e) => update('preferences', 'startPage', e.target.value)}>{['Meu Dia', 'Agenda', 'Tarefas', 'CRM', 'Projetos'].map((page) => <option key={page}>{page}</option>)}</select></Field>
        </div></SettingsCard>
        <SettingsCard title="Como você trabalha" description="Pequenos ajustes para deixar a rotina do seu jeito." icon={Palette}><SettingToggle title="Exibição compacta" detail="Mostra mais informações em tabelas e listas." value={settings.preferences.compact} onChange={(v) => update('preferences', 'compact', v)} /><SettingToggle title="Mostrar tarefas concluídas" detail="Mantém tarefas finalizadas visíveis nas listas." value={settings.preferences.showCompleted} onChange={(v) => update('preferences', 'showCompleted', v)} /><SettingToggle title="Confirmar antes de excluir" detail="Pede confirmação antes de remover registros." value={settings.preferences.confirmDelete} onChange={(v) => update('preferences', 'confirmDelete', v)} /></SettingsCard>
      </>}

      {active === 'agency' && <>
        <SettingsCard title="Dados da agência" description="Informações usadas em propostas, contratos e cobranças." icon={Building2}><div className="settings-fields"><Field label="Nome fantasia"><input value={settings.workspace.agency} onChange={(e) => update('workspace', 'agency', e.target.value)} /></Field><Field label="Razão social"><input value={settings.workspace.fiscalName} onChange={(e) => update('workspace', 'fiscalName', e.target.value)} placeholder="Nome registrado da empresa" /></Field><Field label="CNPJ ou CPF"><input value={settings.workspace.document} onChange={(e) => update('workspace', 'document', e.target.value)} placeholder="00.000.000/0001-00" /></Field><Field label="E-mail comercial"><input type="email" value={settings.workspace.email} onChange={(e) => update('workspace', 'email', e.target.value)} placeholder="contato@suaagencia.com.br" /></Field><Field label="Telefone / WhatsApp"><input value={settings.workspace.phone} onChange={(e) => update('workspace', 'phone', e.target.value)} placeholder="(11) 99999-9999" /></Field><Field label="Site"><input value={settings.workspace.website} onChange={(e) => update('workspace', 'website', e.target.value)} placeholder="https://suaagencia.com.br" /></Field><Field label="Endereço" wide><input value={settings.workspace.address} onChange={(e) => update('workspace', 'address', e.target.value)} placeholder="Rua, número, cidade e estado" /></Field></div></SettingsCard>
        <SettingsCard title="Identidade visual" description="A marca da agência será usada nas experiências compartilhadas." icon={Palette}><div className="settings-brand-preview"><span className="brand-glyph"><i /><b /><em /></span><div><b>{settings.workspace.agency || 'Sua agência'}</b><small>Prévia da marca no portal do cliente</small></div><button className="admin-secondary" onClick={() => notify('Envio de logotipo estará disponível após configurar o armazenamento.')}>Enviar logotipo</button></div><p className="settings-note">PNG ou SVG, recomendado até 2 MB. O armazenamento de arquivos será configurado na etapa de infraestrutura.</p></SettingsCard>
      </>}

      {active === 'notifications' && <>
        <SettingsCard title="Alertas do workspace" description="Escolha quais acontecimentos merecem uma notificação." icon={Bell}><SettingToggle title="Tarefas próximas do prazo" detail="Avisar quando uma tarefa estiver perto do vencimento." value={settings.notifications.taskDue} onChange={(v) => update('notifications', 'taskDue', v)} /><SettingToggle title="Tarefas atrasadas" detail="Alertar você e o responsável quando uma tarefa atrasar." value={settings.notifications.overdue} onChange={(v) => update('notifications', 'overdue', v)} /><SettingToggle title="Novo lead recebido" detail="Avisar quando um formulário ou integração criar um lead." value={settings.notifications.newLead} onChange={(v) => update('notifications', 'newLead', v)} /><SettingToggle title="Proposta visualizada ou aceita" detail="Acompanhar mudanças importantes nas propostas." value={settings.notifications.proposal} onChange={(v) => update('notifications', 'proposal', v)} /><SettingToggle title="Pagamento recebido ou vencido" detail="Acompanhar cobranças e assinaturas dos clientes." value={settings.notifications.payment} onChange={(v) => update('notifications', 'payment', v)} /></SettingsCard>
        <SettingsCard title="Canais e frequência" description="Defina como e quando você quer receber os avisos." icon={Mail}><SettingToggle title="Resumo semanal por e-mail" detail="Resumo de projetos, vendas e financeiro na segunda-feira." value={settings.notifications.weekly} onChange={(v) => update('notifications', 'weekly', v)} /><SettingToggle title="Notificações por e-mail" detail="Enviar alertas importantes para o e-mail da sua conta." value={settings.notifications.email} onChange={(v) => update('notifications', 'email', v)} /><SettingToggle title="Notificações no navegador" detail="Exibir alertas enquanto o Nexo estiver aberto." value={settings.notifications.browser} onChange={(v) => update('notifications', 'browser', v)} /><SettingToggle title="Avisos pelo WhatsApp" detail="Depende da configuração de uma instância Evolution ou WAHA." value={settings.notifications.whatsapp} onChange={(v) => update('notifications', 'whatsapp', v)} /><SettingToggle title="Horário silencioso" detail="Pausar notificações fora do seu horário de trabalho." value={settings.notifications.quietHours} onChange={(v) => update('notifications', 'quietHours', v)} />{settings.notifications.quietHours && <div className="settings-fields settings-hours"><Field label="Início"><input type="time" value={settings.notifications.quietStart} onChange={(e) => update('notifications', 'quietStart', e.target.value)} /></Field><Field label="Fim"><input type="time" value={settings.notifications.quietEnd} onChange={(e) => update('notifications', 'quietEnd', e.target.value)} /></Field></div>}</SettingsCard>
      </>}

      {active === 'team' && <>
        <SettingsCard title="Papéis e permissões" description="Defina quem pode acessar áreas sensíveis da operação." icon={Users}><div className="settings-fields"><Field label="Quem pode convidar pessoas"><select value={settings.permissions.invitePolicy} onChange={(e) => update('permissions', 'invitePolicy', e.target.value)}><option value="owner">Somente proprietário</option><option value="admin">Proprietários e administradores</option></select></Field><Field label="Papel padrão para novos convites"><select value={settings.permissions.role} onChange={(e) => update('permissions', 'role', e.target.value)}><option value="member">Membro da equipe</option><option value="admin">Administrador</option><option value="viewer">Somente leitura</option></select></Field></div><div className="settings-role-list"><RoleRow name="Proprietário" detail="Acesso completo, configurações e dados financeiros" badge="1 pessoa" /><RoleRow name="Administrador" detail="Gerencia clientes, projetos, equipe e integrações" badge="0 pessoas" /><RoleRow name="Membro da equipe" detail="Acessa projetos e tarefas atribuídos" badge="3 pessoas" /><RoleRow name="Somente leitura" detail="Consulta dados permitidos sem editar" badge="0 pessoas" /></div><button className="admin-secondary" onClick={() => notify('Convites de equipe serão ativados quando a autenticação estiver configurada.')}>Convidar pessoa</button></SettingsCard>
        <SettingsCard title="Acesso do cliente" description="Controle o que os clientes podem fazer no portal." icon={UserRound}><SettingToggle title="Permitir acesso ao portal do cliente" detail="Clientes poderão acompanhar projetos e documentos compartilhados." value={settings.permissions.allowClientPortal} onChange={(v) => update('permissions', 'allowClientPortal', v)} /></SettingsCard>
      </>}

      {active === 'billing' && <>
        <SettingsCard title="Padrões de cobrança" description="Valores padrão para criar cobranças e recorrências." icon={Database}><div className="settings-fields"><Field label="Vencimento padrão após emissão"><select value={settings.billing.defaultDueDays} onChange={(e) => update('billing', 'defaultDueDays', e.target.value)}><option value="0">No mesmo dia</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option></select></Field><Field label="Multa por atraso (%)"><input type="number" min="0" max="100" step="0.1" value={settings.billing.lateFee} onChange={(e) => update('billing', 'lateFee', e.target.value)} /></Field><Field label="Juros ao mês (%)"><input type="number" min="0" max="100" step="0.1" value={settings.billing.interest} onChange={(e) => update('billing', 'interest', e.target.value)} /></Field><Field label="Dias para lembretes"><input value={settings.billing.reminderDays} onChange={(e) => update('billing', 'reminderDays', e.target.value)} /><small>Ex.: 3, 1, 0, -3 (antes e depois do vencimento)</small></Field></div></SettingsCard>
        <SettingsCard title="Meios de pagamento aceitos" description="Selecione os métodos que sua agência pretende oferecer." icon={Database}><SettingToggle title="Pix" detail="Pagamento instantâneo via Mercado Pago." value={settings.billing.pix} onChange={(v) => update('billing', 'pix', v)} /><SettingToggle title="Boleto bancário" detail="Cobrança com vencimento e confirmação automática." value={settings.billing.boleto} onChange={(v) => update('billing', 'boleto', v)} /><SettingToggle title="Cartão de crédito" detail="Pagamento à vista ou parcelado, conforme configuração do provedor." value={settings.billing.card} onChange={(v) => update('billing', 'card', v)} /><SettingToggle title="Renovar assinaturas automaticamente" detail="Requer uma integração de pagamentos ativa." value={settings.billing.autoRenew} onChange={(v) => update('billing', 'autoRenew', v)} /></SettingsCard><div className="settings-callout"><LockKeyhole size={17} /><span><b>Dados de pagamento protegidos</b><small>Chaves e tokens do Mercado Pago serão guardados no servidor quando a API estiver conectada.</small></span></div>
      </>}

      {active === 'integrations' && <><div className="settings-integrations-intro"><div><h3>Conecte as ferramentas que sua agência já usa</h3><p>As conexões reais exigem credenciais e configuração segura no servidor.</p></div><button className="admin-secondary" onClick={refreshIntegrationStatus}>Verificar conexões</button></div><div className="settings-integration-grid">{integrations.map((item) => <article className="settings-integration" key={item.name}><div className="integration-head"><span className="integration-logo">{item.icon}</span><span className={`integration-status ${integrationsState[item.name] ? 'connected' : ''}`}><i />{integrationsState[item.name] ? 'Configurada' : 'Não conectada'}</span></div><h3>{item.name}</h3><small>{item.type}</small><p>{item.detail}</p><button className="admin-secondary" onClick={() => toggleIntegration(item.name)}>Gerenciar conexões</button></article>)}</div><div className="settings-callout"><KeyRound size={17} /><span><b>Segredos não ficam no navegador</b><small>O estado acima é apenas organizacional. A conexão com APIs será concluída quando configurarmos variáveis de ambiente e endpoints no VPS.</small></span></div></>}

      {active === 'security' && <>
        <SettingsCard title="Proteção da conta" description="Controles para reduzir acessos indevidos." icon={ShieldCheck}><SettingToggle title="Exigir autenticação em dois fatores" detail="Recomendado para todos os usuários com acesso financeiro." value={settings.permissions.require2fa} onChange={(v) => update('permissions', 'require2fa', v)} /><div className="settings-fields"><Field label="Encerrar sessão após"><select value={settings.permissions.sessionDays} onChange={(e) => update('permissions', 'sessionDays', e.target.value)}><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></select></Field></div></SettingsCard>
        <SettingsCard title="Credenciais e integrações" description="Tokens privados devem ser gerenciados no servidor." icon={KeyRound}><div className="settings-security-note"><LockKeyhole size={19} /><div><b>Nenhuma chave secreta é armazenada aqui</b><p>Quando ativarmos as integrações, as credenciais ficarão nas variáveis protegidas do VPS. Esta tela não salva senhas, tokens ou chaves de API no localStorage.</p></div></div></SettingsCard>
      </>}

      {active === 'data' && <>
        <SettingsCard title="Exportar configurações" description="Baixe uma cópia das preferências deste workspace em JSON." icon={Download}><div className="settings-data-action"><div><b>Backup de preferências</b><small>Inclui dados do workspace, notificações e estado organizacional das integrações.</small></div><button className="admin-secondary" onClick={exportData}><Download size={15} /> Exportar arquivo</button></div><div className="settings-data-action"><div><b>Importar configurações</b><small>Restaure um arquivo JSON exportado pelo Nexo. Revise e salve depois de importar.</small></div><button className="admin-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Escolher arquivo</button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={importData} /></div></SettingsCard>
        <SettingsCard title="Privacidade e armazenamento" description="Nesta etapa, suas preferências vivem no armazenamento local deste navegador." icon={Globe2}><div className="settings-security-note"><Database size={19} /><div><b>Sem sincronização entre dispositivos</b><p>Os dados salvos aqui não são compartilhados com outros usuários ou computadores. O próximo passo de infraestrutura é migrar essas preferências para o banco de dados do workspace, com autenticação e permissões.</p></div></div></SettingsCard>
        <div className="settings-danger-zone"><div><b>Restaurar valores iniciais</b><small>Remove as preferências salvas neste navegador e recupera os valores padrão.</small></div><button onClick={reset}><RotateCcw size={14} /> Restaurar configurações</button></div>
      </>}

      <footer className="settings-bottom"><span><ShieldCheck size={15} /> Suas alterações são salvas somente quando você clicar em “Salvar alterações”.</span><button className="admin-primary" onClick={save}><Check size={15} /> Salvar alterações</button></footer>
    </section>
  </div>;
}

function SettingsCard({ title, description, icon: Icon, children }) { return <section className="settings-card"><header><span className="settings-card-icon"><Icon size={17} /></span><div><h3>{title}</h3><p>{description}</p></div></header><div className="settings-card-body">{children}</div></section>; }
function Field({ label, children, wide = false }) { return <label className={`settings-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>; }
function SettingToggle({ title, detail, value, onChange }) { return <div className="settings-toggle-row"><span><b>{title}</b><small>{detail}</small></span><button type="button" role="switch" aria-checked={value} aria-label={`${title}: ${value ? 'ativado' : 'desativado'}`} className={`settings-switch ${value ? 'on' : ''}`} onClick={() => onChange(!value)}><i /></button></div>; }
function RoleRow({ name, detail, badge }) { return <div className="settings-role-row"><span className="settings-role-icon"><Users size={15} /></span><span><b>{name}</b><small>{detail}</small></span><em>{badge}</em></div>; }
