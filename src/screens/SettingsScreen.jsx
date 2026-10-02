import React, { useEffect, useRef, useState } from 'react';
import {
  Bell, Building2, Check, ChevronRight, CircleHelp, Database, Download,
  Globe2, KeyRound, Link2, LockKeyhole, Mail, Palette, RotateCcw,
  ShieldCheck, SlidersHorizontal, Upload, UserRound, Users, Webhook,
} from 'lucide-react';
import './settings.css';
import './branding.css';
import { apiRequest, useWorkspaceRecords } from '../lib/workspace-api.js';
import { publishWorkspacePreferences, readCachedWorkspacePreferences, rememberWorkspaceThemePreference, workspacePreferencesFromSettings } from '../lib/workspace-preferences.js';
import { compressBrandLogo } from '../lib/brand-logo.js';
import { confirmSettingsNavigation } from '../lib/navigation-guards.js';
import { enableBrowserNotifications } from './settings-browser-notifications.js';
import { confirmSettingsImport, normalizeImportedSettings } from '../lib/settings-import.js';
import { workspaceStartPages } from '../lib/workspace-preferences.js';

const defaults = {
  workspace: { agency: '', timezone: 'America/Sao_Paulo', weekStart: 'monday', currency: 'BRL', dateFormat: 'dd/MM/yyyy', language: 'pt-BR', fiscalName: '', document: '', email: '', phone: '', website: '', address: '', brandLogo: '' },
  preferences: { compact: false, darkMode: false, startPage: 'Meu Dia', showCompleted: false, confirmDelete: true },
  notifications: { taskDue: true, overdue: true, newLead: true, proposal: true, payment: true, weekly: true, email: true, browser: false, whatsapp: false, quietHours: false, quietStart: '20:00', quietEnd: '08:00' },
  billing: { defaultDueDays: '7', reminderDays: '3, 1, 0, -3', lateFee: '2', interest: '1', pix: true, boleto: true, card: true, autoRenew: true },
};
const sections = [
  { id: 'workspace', label: 'Workspace', hint: 'Idioma, moeda e preferências', icon: SlidersHorizontal },
  { id: 'agency', label: 'Perfil da agência', hint: 'Dados e identidade da empresa', icon: Building2 },
  { id: 'notifications', label: 'Notificações', hint: 'Alertas e lembretes automáticos', icon: Bell },
  { id: 'team', label: 'Equipe e acesso', hint: 'Cadastro operacional e autenticação', icon: Users },
  { id: 'billing', label: 'Financeiro', hint: 'Padrões de cobrança e pagamentos', icon: Database },
  { id: 'integrations', label: 'Integrações', hint: 'Serviços conectados ao workspace', icon: Link2 },
  { id: 'security', label: 'Segurança', hint: 'Sessões, autenticação e acesso', icon: ShieldCheck },
  { id: 'data', label: 'Dados e exportação', hint: 'Backup e preferências de dados', icon: Download },
];
export default function SettingsScreen({ notify, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const { records, loading: settingsLoading, error: settingsLoadError, refresh: refreshSettings, create, update: updateRecord } = useWorkspaceRecords('settings');
  const currentUser = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null'); } catch { return null; } })();
  const isOwner = currentUser?.role === 'owner';
  const settingsPermission = currentUser?.permissions?.settings;
  const canWriteSettings = isOwner || (settingsPermission && typeof settingsPermission.write === 'boolean' ? settingsPermission.write : currentUser?.role === 'admin');
  const savedSettings = records.find((item) => item.key === 'workspace-preferences');
  const [settings, setSettingsState] = useState(structuredClone(defaults));
  const settingsRevision = useRef(0);
  const setSettings = (next) => { settingsRevision.current += 1; setSettingsState(next); };
  const [active, setActive] = useState('workspace');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const fileRef = useRef(null);
  const backupRef = useRef(null);
  const logoRef = useRef(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  useEffect(() => {
    const requestedSection = navigationContext?.settingsSection;
    if (requestedSection && sections.some((section) => section.id === requestedSection)) setActive(requestedSection);
    if (requestedSection) onNavigationContextConsumed();
  }, [navigationContext, onNavigationContextConsumed]);
  useEffect(() => {
    if (!savedSettings || dirty) return;
    setSettings(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...value, ...(savedSettings.settings?.[key] || {}) }])));
    setSavedAt(savedSettings.savedAt || '');
    setDirty(false);
  }, [savedSettings?.id, savedSettings?.updatedAt, dirty]);
  useEffect(() => {
    const onBeforeUnload = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  useEffect(() => {
    const onBeforeNavigate = (event) => {
      const allowed = confirmSettingsNavigation({
        dirty,
        destinationPage: event.detail?.page,
        confirmLeave: (message) => window.confirm(message),
      });
      if (!allowed) event.preventDefault();
    };
    window.addEventListener('nexo:before-navigate', onBeforeNavigate);
    return () => window.removeEventListener('nexo:before-navigate', onBeforeNavigate);
  }, [dirty]);
  const update = (group, field, value) => {
    const next = { ...settings, [group]: { ...settings[group], [field]: value } };
    const baseline = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, { ...fallback, ...(savedSettings?.settings?.[key] || {}) }]));
    setSettings(next);
    if (group === 'preferences') {
      if (field === 'darkMode') rememberWorkspaceThemePreference(value);
      publishWorkspacePreferences({ ...next.preferences, timezone: next.workspace.timezone, weekStart: next.workspace.weekStart });
    } else if (group === 'workspace' && ['timezone', 'weekStart'].includes(field)) {
      publishWorkspacePreferences({ ...readCachedWorkspacePreferences(), timezone: next.workspace.timezone, weekStart: next.workspace.weekStart });
    }
    setDirty(JSON.stringify(next) !== JSON.stringify(baseline));
  };
  const save = async () => {
    if (!canWriteSettings) { notify('Seu perfil pode consultar estas configurações, mas não pode alterá-las.'); return; }
    if (settingsLoading || settingsLoadError) { notify('Recarregue as configurações antes de salvar para evitar sobrescrever dados existentes.'); return; }
    if (saving) return;
    const revision = settingsRevision.current;
    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const payload = { key: 'workspace-preferences', settings, savedAt: timestamp };
      if (savedSettings) await updateRecord(savedSettings.id, payload); else await create(payload);
      publishWorkspacePreferences(workspacePreferencesFromSettings(settings));
      window.dispatchEvent(new CustomEvent('nexo:workspace-notifications', { detail: settings.notifications }));
      setSavedAt(timestamp);
      if (settingsRevision.current === revision) setDirty(false);
      notify(settingsRevision.current === revision ? 'Preferências do workspace salvas.' : 'Preferências salvas. As alterações mais recentes continuam sem salvar.');
    } catch (error) { notify(error.message || 'Não foi possível salvar as preferências no servidor.'); }
    finally { setSaving(false); }
  };
  const openIntegrations = () => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integrações' }));
  const toggleBrowserNotifications = async (enabled) => {
    if (!enabled) { update('notifications', 'browser', false); return; }
    try {
      const result = await enableBrowserNotifications();
      if (result.status === 'granted') {
        update('notifications', 'browser', true);
        notify('Permissão ativa. Notificação de teste enviada; os avisos selecionados ficam ativos enquanto o Focusshub estiver aberto.');
      } else if (result.status === 'denied') {
        notify('O navegador bloqueou as notificações. Altere a permissão nas configurações do site.');
      } else {
        notify('Este navegador não oferece suporte a notificações.');
      }
    } catch {
      notify('Não foi possível exibir a notificação de teste neste navegador.');
    }
  };
  const openTeam = () => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Equipe' }));
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportData = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), settings };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `focusshub-configuracoes-${new Date().toISOString().slice(0, 10)}.json`);
    notify('Arquivo de configurações exportado.');
  };
  const importData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!canWriteSettings) throw new Error('Seu perfil não pode importar configurações neste workspace.');
      if (file.size > 2 * 1024 * 1024) throw new Error('O arquivo excede o limite de 2 MB.');
      const payload = JSON.parse(await file.text());
      const imported = normalizeImportedSettings(payload, defaults);
      if (!confirmSettingsImport({ dirty, confirmReplace: (message) => window.confirm(message) })) return;
      setSettings(imported);
      rememberWorkspaceThemePreference(imported.preferences.darkMode);
      publishWorkspacePreferences(workspacePreferencesFromSettings(imported));
      setDirty(true);
      notify('Configurações importadas. Salve para aplicar.');
    } catch { notify('Esse arquivo não contém uma exportação válida do Focusshub.'); }
    event.target.value = '';
  };
  const uploadBrandLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    try {
      const brandLogo = await compressBrandLogo(file);
      setSettings((current) => ({ ...current, workspace: { ...current.workspace, brandLogo } }));
      setDirty(true);
      notify('Logotipo preparado. Salve as alterações para aplicá-lo ao portal.');
    } catch (error) { notify(error.message || 'Não foi possível preparar o logotipo.'); }
    finally { setLogoBusy(false); event.target.value = ''; }
  };
  const removeBrandLogo = () => {
    setSettings((current) => ({ ...current, workspace: { ...current.workspace, brandLogo: '' } }));
    setDirty(true);
  };
  const exportBackup = async () => {
    setBackupBusy(true);
    try {
      const backup = await apiRequest('/api/workspace/backup');
      downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `focusshub-workspace-${new Date().toISOString().slice(0, 10)}.json`);
      notify(backup.excludedRecords ? `Backup baixado. ${backup.excludedRecords} registro(s) de credenciais foram excluídos.` : 'Backup completo do workspace baixado.');
    } catch (error) { notify(error.message || 'Não foi possível baixar o backup.'); }
    finally { setBackupBusy(false); }
  };
  const restoreBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!isOwner) throw new Error('Somente a pessoa proprietária pode restaurar o backup deste workspace.');
      if (file.size > 25 * 1024 * 1024) throw new Error('O arquivo de backup excede o limite de 25 MB.');
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'nexo-workspace-backup' || backup.version !== 1 || !Array.isArray(backup.records)) throw new Error('Selecione um backup completo exportado pelo Focusshub.');
      if (dirty && !window.confirm('Há configurações não salvas. Continuar e descartá-las após a restauração?')) return;
      const count = (backup.records?.length || 0) + (backup.clients?.length || 0) + (backup.billingOrders?.length || 0) + (backup.billingSubscriptions?.length || 0);
      const message = `Restaurar ${count} registro(s) deste backup? Registros com o mesmo ID serão atualizados; os demais dados atuais serão mantidos. Nenhum e-mail, cobrança ou automação externa será disparado.`;
      if (!window.confirm(message)) return;
      setBackupBusy(true);
      const response = await apiRequest('/api/workspace/backup/restore', { method: 'POST', body: JSON.stringify(backup) });
      const updated = Object.entries(response.data || {}).filter(([key]) => key.endsWith('Created') || key.endsWith('Updated')).reduce((sum, [, value]) => sum + Number(value || 0), 0);
      notify(`Backup restaurado: ${updated} registro(s) criados ou atualizados. Recarregando o workspace.`);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) { notify(error.message || 'Não foi possível restaurar este backup.'); }
    finally { setBackupBusy(false); event.target.value = ''; }
  };
  const reset = () => {
    if (!canWriteSettings) { notify('Seu perfil não pode redefinir as configurações deste workspace.'); return; }
    if (!window.confirm('Restaurar todas as configurações para os valores iniciais?')) return;
    setSettings(structuredClone(defaults));
    rememberWorkspaceThemePreference(defaults.preferences.darkMode);
    publishWorkspacePreferences(workspacePreferencesFromSettings(defaults));
    setDirty(true);
    notify('Valores iniciais carregados. Salve para confirmar.');
  };
  const activeSection = sections.find((item) => item.id === active);

  return <div className="settings-layout">
    <aside className="settings-sidebar" aria-label="Seções das configurações">
      <div className="settings-side-title"><span>Workspace</span><strong>Configurações</strong></div>
      <nav>{sections.map(({ id, label, hint, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}><Icon size={16} /><span><b>{label}</b><small>{hint}</small></span><ChevronRight size={14} /></button>)}</nav>
      <button type="button" className="settings-help" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Tickets' }))}><CircleHelp size={16} /><span><b>Precisa de ajuda?</b><small>Abrir a central de suporte.</small></span><ChevronRight size={14} /></button>
    </aside>

    <section className="settings-main">
      <div className="settings-main-head"><div><span className="settings-overline">PREFERÊNCIAS DO WORKSPACE</span><h2>{activeSection.label}</h2><p>{activeSection.hint}. As preferências sincronizam com o servidor ao salvar.</p></div><div className="settings-head-actions"><span className={`settings-save-state ${dirty ? 'pending' : ''}`}><i />{saving ? 'Salvando alterações…' : dirty ? 'Alterações não salvas' : savedAt ? `Salvo às ${new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Tudo atualizado'}</span><button className="admin-primary" disabled={saving || !dirty || !canWriteSettings || settingsLoading || Boolean(settingsLoadError)} onClick={save}><Check size={15} />{saving ? ' Salvando…' : ' Salvar alterações'}</button></div></div>

      {active === 'integrations' && <div className="settings-data-action"><div><b>Gerenciar integrações</b><small>Abra o painel para autorizar contas OAuth, conectar caixas postais ou configurar credenciais no servidor.</small></div><button type="button" className="admin-secondary" onClick={openIntegrations}><Link2 size={15} /> Abrir painel de integrações</button></div>}
      {settingsLoading && <div className="settings-access-notice" role="status">Carregando configurações salvas antes de liberar a edição…</div>}
      {settingsLoadError && <div className="settings-access-notice error" role="alert"><span>Não foi possível carregar as configurações. A edição está bloqueada para evitar criar uma cópia sobre dados existentes.</span><button type="button" className="admin-secondary" onClick={refreshSettings}>Tentar novamente</button></div>}
      {!settingsLoading && !settingsLoadError && !canWriteSettings && <div className="settings-access-notice" role="status"><LockKeyhole size={16} /><span>Seu perfil tem acesso somente para consulta. Peça à pessoa proprietária a permissão de edição em Configurações.</span></div>}
      <fieldset className="settings-edit-surface" disabled={!canWriteSettings || settingsLoading || Boolean(settingsLoadError)}>

      {active === 'workspace' && <>
        <SettingsCard title="Preferências gerais" description="O fuso e o início da semana se aplicam à Agenda. As outras preferências salvas continuam preservadas enquanto a aplicação global é concluída." icon={SlidersHorizontal}><div className="settings-fields">
          <Field label="Nome do workspace"><input value={settings.workspace.agency} onChange={(e) => update('workspace', 'agency', e.target.value)} /></Field>
          <Field label="Fuso horário"><select value={settings.workspace.timezone} onChange={(e) => update('workspace', 'timezone', e.target.value)}><option value="America/Sao_Paulo">Brasília (GMT−03:00)</option><option value="America/Manaus">Manaus (GMT−04:00)</option><option value="UTC">UTC</option></select></Field>
          <Field label="A semana começa em"><select value={settings.workspace.weekStart} onChange={(e) => update('workspace', 'weekStart', e.target.value)}><option value="monday">Segunda-feira</option><option value="sunday">Domingo</option></select></Field>
          <Field label="Preferências preservadas" wide><small>Idioma: {settings.workspace.language || 'pt-BR'} · Moeda: {settings.workspace.currency || 'BRL'} · Formato de data: {settings.workspace.dateFormat || 'dd/MM/yyyy'}. Esses valores salvos não serão alterados, mas ainda não controlam todas as telas.</small></Field>
          <Field label="Página inicial"><select value={settings.preferences.startPage} onChange={(e) => update('preferences', 'startPage', e.target.value)}>{workspaceStartPages.map((page) => <option key={page}>{page}</option>)}</select><small>Na próxima abertura, o app respeitará as permissões da sua conta para esta página.</small></Field>
        </div></SettingsCard>
        <SettingsCard title="Como você trabalha" description="Pequenos ajustes para deixar a rotina do seu jeito." icon={Palette}><SettingToggle title="Modo escuro" detail="Reduz o brilho em todas as áreas do workspace." value={settings.preferences.darkMode} onChange={(v) => update('preferences', 'darkMode', v)} /><SettingToggle title="Exibição compacta" detail="Mostra mais informações em tabelas e listas." value={settings.preferences.compact} onChange={(v) => update('preferences', 'compact', v)} /><SettingToggle title="Mostrar tarefas concluídas" detail="Mantém tarefas finalizadas visíveis nas listas." value={settings.preferences.showCompleted} onChange={(v) => update('preferences', 'showCompleted', v)} /><SettingToggle title="Confirmar antes de excluir" detail="Pede confirmação antes de remover registros." value={settings.preferences.confirmDelete} onChange={(v) => update('preferences', 'confirmDelete', v)} /></SettingsCard>
      </>}

      {active === 'agency' && <>
        <SettingsCard title="Dados da agência" description="Informações usadas em propostas, contratos e cobranças." icon={Building2}><div className="settings-fields"><Field label="Nome fantasia"><input value={settings.workspace.agency} onChange={(e) => update('workspace', 'agency', e.target.value)} /></Field><Field label="Razão social"><input value={settings.workspace.fiscalName} onChange={(e) => update('workspace', 'fiscalName', e.target.value)} placeholder="Nome registrado da empresa" /></Field><Field label="CNPJ ou CPF"><input value={settings.workspace.document} onChange={(e) => update('workspace', 'document', e.target.value)} placeholder="00.000.000/0001-00" /></Field><Field label="E-mail comercial"><input type="email" value={settings.workspace.email} onChange={(e) => update('workspace', 'email', e.target.value)} placeholder="contato@suaagencia.com.br" /></Field><Field label="Telefone / WhatsApp"><input value={settings.workspace.phone} onChange={(e) => update('workspace', 'phone', e.target.value)} placeholder="(11) 99999-9999" /></Field><Field label="Site"><input value={settings.workspace.website} onChange={(e) => update('workspace', 'website', e.target.value)} placeholder="https://suaagencia.com.br" /></Field><Field label="Endereço" wide><input value={settings.workspace.address} onChange={(e) => update('workspace', 'address', e.target.value)} placeholder="Rua, número, cidade e estado" /></Field></div></SettingsCard>
        <SettingsCard title="Identidade visual" description="A marca da agência será usada nas experiências compartilhadas." icon={Palette}><div className="settings-brand-preview">{settings.workspace.brandLogo ? <img className="settings-brand-logo" width={56} height={56} src={settings.workspace.brandLogo} alt="Logotipo da agência" /> : <span className="brand-glyph"><i /><b /><em /></span>}<div><b>{settings.workspace.agency || 'Sua agência'}</b><small>Prévia da marca no portal do cliente</small></div><div className="settings-brand-actions"><button type="button" className="admin-secondary" disabled={logoBusy} onClick={() => logoRef.current?.click()}><Upload size={14} />{logoBusy ? 'Preparando…' : settings.workspace.brandLogo ? 'Trocar logotipo' : 'Enviar logotipo'}</button>{settings.workspace.brandLogo && <button type="button" className="admin-secondary" disabled={logoBusy} onClick={removeBrandLogo}>Remover</button>}<input ref={logoRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadBrandLogo} /></div></div><p className="settings-note">PNG, JPEG ou WebP, até 2 MB. A imagem é otimizada para o workspace e aplicada ao portal ao salvar as alterações.</p></SettingsCard>
      </>}

      {active === 'notifications' && <>
        <SettingsCard title="Alertas do workspace" description="A central registra atualizações. Com o navegador autorizado, avisos de prazo, leads, propostas e pagamentos aparecem enquanto o app estiver aberto." icon={Bell}><SettingToggle title="Tarefas próximas do prazo" detail="Notifica no navegador quando uma tarefa aberta vence hoje ou amanhã." value={settings.notifications.taskDue} onChange={(v) => update('notifications', 'taskDue', v)} /><SettingToggle title="Tarefas atrasadas" detail="Notifica uma vez por prazo de tarefa atrasada." value={settings.notifications.overdue} onChange={(v) => update('notifications', 'overdue', v)} /><SettingToggle title="Novo lead recebido" detail="Notifica quando um novo lead é registrado no workspace." value={settings.notifications.newLead} onChange={(v) => update('notifications', 'newLead', v)} /><SettingToggle title="Proposta visualizada ou aceita" detail="Notifica atualizações registradas em propostas." value={settings.notifications.proposal} onChange={(v) => update('notifications', 'proposal', v)} /><SettingToggle title="Pagamento recebido ou vencido" detail="Notifica atualizações registradas em cobranças e assinaturas." value={settings.notifications.payment} onChange={(v) => update('notifications', 'payment', v)} /></SettingsCard>
        <SettingsCard title="Canais e frequência" description="Alertas no navegador funcionam enquanto o Focusshub estiver aberto. Envio automático por e-mail e WhatsApp ainda não está conectado." icon={Mail}><SettingToggle title="Resumo semanal por e-mail" detail="Preferência salva; envio semanal ainda não está configurado." value={settings.notifications.weekly} onChange={(v) => update('notifications', 'weekly', v)} /><SettingToggle title="Notificações por e-mail" detail="Preferência salva; envio de alertas por e-mail ainda não está configurado." value={settings.notifications.email} onChange={(v) => update('notifications', 'email', v)} /><SettingToggle title="Notificações no navegador" detail="Pede permissão e envia um teste. Com a opção salva, os alertas acima aparecem neste navegador." value={settings.notifications.browser} onChange={toggleBrowserNotifications} /><SettingToggle title="Avisos pelo WhatsApp" detail="Preferência salva; envio via Evolution/WAHA ainda não está configurado." value={settings.notifications.whatsapp} onChange={(v) => update('notifications', 'whatsapp', v)} /><SettingToggle title="Horário silencioso" detail="Silencia os alertas no navegador durante a faixa definida abaixo." value={settings.notifications.quietHours} onChange={(v) => update('notifications', 'quietHours', v)} />{settings.notifications.quietHours && <div className="settings-fields settings-hours"><Field label="Início"><input type="time" value={settings.notifications.quietStart} onChange={(e) => update('notifications', 'quietStart', e.target.value)} /></Field><Field label="Fim"><input type="time" value={settings.notifications.quietEnd} onChange={(e) => update('notifications', 'quietEnd', e.target.value)} /></Field></div>}</SettingsCard>
      </>}

      {active === 'team' && <>
        <SettingsCard title="Acesso ao workspace" description="Convide pessoas pela aba Equipe e escolha o papel de acesso." icon={Users}><div className="settings-security-note"><ShieldCheck size={19} /><div><b>Acesso por convite</b><p>O proprietario pode convidar administradores e membros. O link expira em 48 horas e pode ser usado uma vez. Na aba Equipe, ajuste leitura, edicao e exclusao por modulo e limite o acesso a clientes e projetos selecionados.</p></div></div><button type="button" className="admin-secondary" disabled={!isOwner} title={!isOwner ? 'Somente a pessoa proprietária pode gerenciar convites e permissões.' : undefined} onClick={openTeam}><Users size={15} /> Gerenciar acessos da equipe</button>{!isOwner && <p className="settings-note">Gerenciar convites e permissões está disponível somente para a pessoa proprietária.</p>}</SettingsCard>
        <SettingsCard title="Portal do cliente" description="O portal usa links individuais assinados e revogáveis." icon={UserRound}><div className="settings-security-note"><UserRound size={19} /><div><b>Ative cada cliente pela ficha dele</b><p>A equipe pode criar ou revogar o link do portal na ficha do cliente. O acesso público não concede login no workspace.</p></div></div></SettingsCard>
      </>}

      {active === 'billing' && <>
        <SettingsCard title="Padrões de cobrança" description="O vencimento padrão preenche novas cobranças avulsas de Pix e boleto. Multa, juros e lembretes ainda não são aplicados automaticamente." icon={Database}><div className="settings-fields"><Field label="Vencimento padrão após emissão"><select value={settings.billing.defaultDueDays} onChange={(e) => update('billing', 'defaultDueDays', e.target.value)}><option value="1">1 dia</option><option value="3">3 dias</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option></select></Field><Field label="Multa por atraso (%)"><input type="number" min="0" max="100" step="0.1" value={settings.billing.lateFee} onChange={(e) => update('billing', 'lateFee', e.target.value)} /></Field><Field label="Juros ao mês (%)"><input type="number" min="0" max="100" step="0.1" value={settings.billing.interest} onChange={(e) => update('billing', 'interest', e.target.value)} /></Field><Field label="Dias para lembretes"><input value={settings.billing.reminderDays} onChange={(e) => update('billing', 'reminderDays', e.target.value)} /><small>Ex.: 3, 1, 0, -3 (antes e depois do vencimento)</small></Field></div></SettingsCard>
        <SettingsCard title="Meios de pagamento aceitos" description="Desativar um método também o remove das novas cobranças; a disponibilidade final depende do Mercado Pago." icon={Database}><SettingToggle title="Pix" detail="Pagamento instantâneo via Mercado Pago." value={settings.billing.pix} onChange={(v) => update('billing', 'pix', v)} /><SettingToggle title="Boleto bancário" detail="Cobrança com vencimento e confirmação automática." value={settings.billing.boleto} onChange={(v) => update('billing', 'boleto', v)} /><SettingToggle title="Cartão de crédito" detail="Pagamento à vista ou parcelado, conforme configuração do provedor." value={settings.billing.card} onChange={(v) => update('billing', 'card', v)} /><SettingToggle title="Permitir novas assinaturas recorrentes" detail="Controla a criação de novas assinaturas; não altera as já autorizadas." value={settings.billing.autoRenew} onChange={(v) => update('billing', 'autoRenew', v)} /></SettingsCard><div className="settings-callout"><LockKeyhole size={17} /><span><b>Dados de pagamento protegidos</b><small>Chaves e tokens do Mercado Pago serão guardados no servidor quando a API estiver conectada.</small></span></div>
      </>}

      {active === 'integrations' && <SettingsCard title="Gerenciar integrações" description="Veja o estado real, teste conexões e controle os serviços do workspace em um único painel." icon={Link2}><div className="settings-security-note"><ShieldCheck size={19} /><div><b>As credenciais são mantidas no servidor</b><p>O painel de Integrações consulta as configurações da VPS e informa quando cada serviço foi testado, se está conectado ou se precisa de configuração.</p></div></div></SettingsCard>}

      {active === 'security' && <>
        <SettingsCard title="Proteção da conta" description="A autenticação aplicada atualmente pelo servidor." icon={ShieldCheck}><div className="settings-security-note"><LockKeyhole size={19} /><div><b>Acesso protegido por papel</b><p>O servidor aceita a conta proprietária e contas de equipe ativadas por convite. Ao marcar “Manter conectado” no login, a sessão dura até 30 dias; sem marcar, dura até 8 horas. O cookie é protegido e não pode ser lido por scripts da página. A autenticação em dois fatores não está disponível.</p></div></div></SettingsCard>
        <SettingsCard title="Credenciais e integrações" description="Tokens privados devem ser gerenciados no servidor." icon={KeyRound}><div className="settings-security-note"><LockKeyhole size={19} /><div><b>Nenhuma chave secreta é armazenada aqui</b><p>As credenciais das integrações ficam nas variáveis protegidas do VPS. Esta tela não salva senhas, tokens ou chaves de API no navegador.</p></div></div><button type="button" className="admin-secondary" onClick={openIntegrations}><Link2 size={15} /> Abrir painel de Integrações</button></SettingsCard>
      </>}

      {active === 'data' && <>
        <SettingsCard title="Backup do workspace" description="Exporte ou restaure clientes, registros operacionais, histórico financeiro e preferências." icon={Database}>{isOwner ? <><div className="settings-data-action"><div><b>Baixar backup completo</b><small>Inclui os dados deste workspace e os registros do Mercado Pago. Senhas, tokens e filas de automação ficam de fora; arquivos do Drive mantêm o link, sem copiar o conteúdo.</small></div><button type="button" className="admin-secondary" disabled={backupBusy} onClick={exportBackup}><Download size={15} /> {backupBusy ? 'Preparando…' : 'Baixar backup'}</button></div><div className="settings-data-action"><div><b>Restaurar backup</b><small>Disponível no mesmo workspace. Mescla por ID e não dispara integrações; lembretes automáticos de cobranças vencidas do arquivo são suprimidos para evitar reenvio de avisos antigos.</small></div><button type="button" className="admin-secondary" disabled={backupBusy} onClick={() => backupRef.current?.click()}><Upload size={15} /> {backupBusy ? 'Restaurando…' : 'Selecionar backup'}</button><input ref={backupRef} hidden type="file" accept="application/json,.json" onChange={restoreBackup} /></div></> : <div className="settings-security-note"><LockKeyhole size={18} /><div><b>Backup restrito à pessoa proprietária</b><p>Exportar ou restaurar o workspace inclui dados de vários módulos e só está disponível para a conta proprietária.</p></div></div>}</SettingsCard>
        <SettingsCard title="Exportar configurações" description="Baixe uma cópia das preferências deste workspace em JSON." icon={Download}><div className="settings-data-action"><div><b>Exportar preferências</b><small>Este arquivo contém somente as preferências gerais do workspace; use o backup completo para incluir os outros dados.</small></div><button className="admin-secondary" onClick={exportData}><Download size={15} /> Exportar arquivo</button></div><div className="settings-data-action"><div><b>Importar preferências</b><small>Carregue um JSON exportado pelo Focusshub; revise as alterações e salve para aplicar.</small></div><button className="admin-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Escolher arquivo</button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={importData} /></div></SettingsCard>
        <SettingsCard title="Privacidade e armazenamento" description="As preferências do workspace são persistidas no banco da aplicação." icon={Globe2}><div className="settings-security-note"><Database size={19} /><div><b>Salvas na conta proprietária</b><p>Clientes, projetos e preferências são acessados por sessão autenticada. A exportação nesta tela cobre apenas as preferências mostradas em Configurações, não substituindo backup completo do banco.</p></div></div></SettingsCard>
        <div className="settings-danger-zone"><div><b>Restaurar valores iniciais</b><small>Carrega os valores padrão desta tela. Revise e salve para aplicar ao workspace.</small></div><button onClick={reset}><RotateCcw size={14} /> Restaurar configurações</button></div>
      </>}

      </fieldset>
      <footer className="settings-bottom"><span><ShieldCheck size={15} /> Suas alterações são salvas somente quando você clicar em “Salvar alterações”.</span><button className="admin-primary" disabled={saving || !dirty || !canWriteSettings || settingsLoading || Boolean(settingsLoadError)} onClick={save}><Check size={15} />{saving ? ' Salvando…' : ' Salvar alterações'}</button></footer>
    </section>
  </div>;
}

function SettingsCard({ title, description, icon: Icon, children }) { return <section className="settings-card"><header><span className="settings-card-icon"><Icon size={17} /></span><div><h3>{title}</h3><p>{description}</p></div></header><div className="settings-card-body">{children}</div></section>; }
function Field({ label, children, wide = false }) { return <label className={`settings-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>; }
function SettingToggle({ title, detail, value, onChange }) { return <div className="settings-toggle-row"><span><b>{title}</b><small>{detail}</small></span><button type="button" role="switch" aria-checked={value} aria-label={`${title}: ${value ? 'ativado' : 'desativado'}`} className={`settings-switch ${value ? 'on' : ''}`} onClick={() => onChange(!value)}><i /></button></div>; }
