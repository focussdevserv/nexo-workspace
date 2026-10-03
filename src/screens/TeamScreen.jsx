import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAllRecords, useWorkspaceRecords } from '../lib/workspace-api.js';
import { Check, Copy, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2, UserMinus, UserRound, Users, X } from 'lucide-react';
import { apiRequest } from '../lib/workspace-api.js';
import { copyTextToClipboard } from '../lib/copy-to-clipboard.js';
import { isLocalDemoActive } from '../lib/local-demo.js';
import { createLatestRequestGuard } from '../lib/latest-request.js';
import { averageActiveTeamLoad } from '../lib/team-capacity.js';
import { hasTeamEmailConflict } from '../lib/team-email.js';
import { confirmWorkspaceDelete, useWorkspacePreferences } from '../lib/workspace-preferences.js';
import { formatWorkspaceDateTime } from '../lib/workspace-formatting.js';
import { effectiveModulePermissionDraft, permissionDraftForAccount, permissionsPayload, setModulePermissionMode, setModulePermissionValue, validatePermissionDraft } from '../lib/team-permissions.js';
import { shouldCloseTeamDialog } from '../lib/team-dialog.js';
import { confirmDiscardTeamPermissionDraft, teamPermissionDraftHasChanges } from '../lib/team-permission-draft.js';
import { resolveTeamInviteLink } from '../lib/team-invite-link.js';
import './team.css';

const accessModules = [
  ['crm', 'CRM e clientes'], ['delivery', 'Projetos e tarefas'], ['support', 'Atendimento e aprovacoes'],
  ['finance', 'Financeiro'], ['sites', 'Sites e repositorios'], ['automations', 'Automacoes'], ['integrations', 'Integracoes'],
  ['settings', 'Configuracoes'], ['reports', 'Relatorios'],
];
export default function TeamScreen({ notify }) {
  const preferences = useWorkspacePreferences();
  const { records: people, loading: peopleLoading, error: peopleError, refresh: refreshPeople, create, update, remove: deleteRecord } = useWorkspaceRecords('team');
  const [accountCount, setAccountCount] = useState(null);
  const [filter, setFilter] = useState('Todos');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(false);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ name: '', email: '', title: '', load: '0' });
  const addPersonButtonRef = useRef(null);
  const dialogTitleRef = useRef(null);
  const closePersonDialog = () => {
    setDialog(false);
    window.requestAnimationFrame(() => addPersonButtonRef.current?.focus());
  };
  useEffect(() => {
    if (!dialog || typeof window === 'undefined' || !window.matchMedia('(max-width: 640px)').matches) return;
    dialogTitleRef.current?.focus();
  }, [dialog]);
  const activeCount = people.filter((person) => person.status === 'Ativo').length;
  const inactiveCount = people.filter((person) => person.status !== 'Ativo').length;
  const averageLoad = averageActiveTeamLoad(people);
  const visible = useMemo(() => people.filter((person) => {
    const status = person.status === 'Ativo' ? 'Ativo' : 'Inativo';
    return (filter === 'Todos' || status === filter) && `${person.name} ${person.email} ${person.title || person.role || ''}`.toLowerCase().includes(query.toLowerCase());
  }), [people, filter, query]);
  const openNew = () => { setEditing(null); setDraft({ name: '', email: '', title: '', load: '0' }); setDialog(true); };
  const openEdit = (person) => { setEditing(person.id); setDraft({ name: person.name, email: person.email, title: person.title || person.role || '', load: String(person.load || 0) }); setDialog(true); };
  const savePerson = async (event) => {
    event.preventDefault();
    if (directoryBusy) return;
    if (peopleLoading || peopleError) { notify('Atualize a lista da equipe antes de salvar para validar duplicidades.'); return; }
    const name = draft.name.trim(); const email = draft.email.trim().toLowerCase();
    if (!name) { notify('Informe o nome da pessoa.'); return; }
    if (hasTeamEmailConflict(people, email, editing)) { notify('Este e-mail já está cadastrado na equipe.'); return; }
    const load = Number(draft.load);
    if (!Number.isFinite(load) || load < 0 || load > 100) { notify('Informe uma carga semanal entre 0 e 100%.'); return; }
    const title = draft.title.trim() || 'Sem função definida';
    const record = { name, email, role: title, title, initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), tone: 'blue', load: Number(draft.load) || 0, projects: editing ? people.find((person) => person.id === editing)?.projects || 0 : 0, status: editing ? people.find((person) => person.id === editing)?.status || 'Ativo' : 'Ativo' };
    setDirectoryBusy(true);
    try {
      if (editing) await update(editing, record);
      else await create(record);
      notify(editing ? 'Cadastro operacional atualizado.' : 'Pessoa registrada na equipe operacional; nenhum acesso ao Focusshub foi criado.');
      closePersonDialog();
    } catch (error) { notify(error.message || 'Não foi possível salvar o cadastro da equipe.'); }
    finally { setDirectoryBusy(false); }
  };
  const toggleStatus = async (person) => {
    if (directoryBusy || peopleLoading || peopleError) return;
    const nextStatus = person.status === 'Ativo' ? 'Inativo' : 'Ativo';
    setDirectoryBusy(true);
    try { await update(person.id, { status: nextStatus }); notify(`${person.name}: cadastro operacional ${nextStatus === 'Ativo' ? 'ativado' : 'inativado'}.`); }
    catch (error) { notify(error.message || 'Não foi possível atualizar a situação da pessoa.'); }
    finally { setDirectoryBusy(false); }
  };
  const remove = async (person) => {
    if (directoryBusy || peopleLoading || peopleError) return;
    if (!confirmWorkspaceDelete(`Remover ${person.name} da equipe?`, preferences)) return;
    setDirectoryBusy(true);
    try { await deleteRecord(person.id); notify(`${person.name} foi removido da equipe.`); }
    catch (error) { notify(error.message || 'Não foi possível remover o cadastro.'); }
    finally { setDirectoryBusy(false); }
  };
  return <div className="team-module">
    <div className="team-guidance"><ShieldCheck size={16} /><span><b>Controles separados.</b> Cadastros operacionais organizam tarefas. Contas e permissoes do Focusshub sao gerenciadas abaixo.</span></div>
    <TeamAccessPanel notify={notify} onAccountCountChange={setAccountCount} />
    <section className="team-summary"><TeamStat icon={Users} label="Pessoas ativas" value={String(activeCount).padStart(2, '0')} detail="na operação" /><TeamStat icon={UserRound} label="Pessoas inativas" value={String(inactiveCount).padStart(2, '0')} detail="cadastros operacionais" /><TeamStat icon={ShieldCheck} label="Contas Focusshub" value={accountCount === null ? '—' : String(accountCount).padStart(2, '0')} detail={accountCount === null ? 'visível para o proprietário' : 'com acesso ativo'} /><TeamStat icon={Users} label="Carga semanal média" value={averageLoad === null ? '—' : `${averageLoad}%`} detail={averageLoad === null ? 'sem pessoas ativas com carga' : 'entre pessoas ativas'} /></section>
    <section className="team-directory"><header className="team-directory-head"><div><h2>Equipe operacional</h2><p>Registre colaboradores para organizar tarefas e carga de trabalho. O cadastro não cria uma conta Focusshub.</p></div><button ref={addPersonButtonRef} type="button" className="admin-primary" disabled={peopleLoading || Boolean(peopleError) || directoryBusy} onClick={openNew}><Plus size={15} />Adicionar pessoa</button></header>
      <div className="team-directory-controls"><div className="team-filter-tabs">{['Todos', 'Ativo', 'Inativo'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="team-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail ou função" /></label></div>
      <div className="team-directory-table"><div className="team-directory-row team-directory-labels"><span>Pessoa</span><span>Função</span><span>Projetos</span><span>Carga semanal</span><span>Situação</span><span>Ações</span></div>
        {visible.map((person) => { const status = person.status === 'Ativo' ? 'Ativo' : 'Inativo'; const load = Math.max(0, Math.min(100, Number(person.load) || 0)); return <div className="team-directory-row" key={person.id}><div className="team-directory-person"><span className={`admin-avatar tone-${person.tone}`}>{person.initials}</span><span><b>{person.name}</b><small>{person.email || 'Sem e-mail cadastrado'}</small></span></div><div className="team-role-cell"><b>{person.title || person.role || 'Sem função definida'}</b><small>Função operacional</small></div><span className="team-number-cell">{person.projects || 0} projetos</span><div className="team-load"><div><i style={{ width: `${load}%` }} /></div><small>{load}%</small></div><span className={`team-member-status ${status === 'Ativo' ? 'active' : ''}`}><i />{status}</span><div className="team-row-menu"><button type="button" disabled={directoryBusy || peopleLoading || Boolean(peopleError)} aria-label={`Editar ${person.name}`} onClick={() => openEdit(person)}><Pencil size={14} /></button><button type="button" disabled={directoryBusy || peopleLoading || Boolean(peopleError)} aria-label={`${status === 'Ativo' ? 'Inativar' : 'Ativar'} cadastro de ${person.name}`} onClick={() => toggleStatus({ ...person, status })}><ShieldCheck size={14} /></button><button type="button" disabled={directoryBusy || peopleLoading || Boolean(peopleError)} aria-label={`Remover ${person.name}`} onClick={() => remove(person)}><Trash2 size={14} /></button></div></div>; })}
        {peopleLoading && <div className="team-empty" role="status">Carregando equipe operacional…</div>}{!peopleLoading && peopleError && <div className="team-empty" role="alert">Não foi possível carregar a equipe. <button type="button" onClick={refreshPeople}>Tentar novamente</button></div>}{!peopleLoading && !peopleError && !visible.length && <div className="team-empty">Ninguém encontrado com esses filtros.</div>}
      </div>
    </section>
    {dialog && <div className="team-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !directoryBusy) closePersonDialog(); }}><form className="team-modal" role="dialog" aria-modal="true" aria-busy={directoryBusy} aria-labelledby="team-person-dialog-title" onKeyDown={(event) => { if (shouldCloseTeamDialog(event.key, directoryBusy)) { event.preventDefault(); closePersonDialog(); } }} onSubmit={savePerson}><header><div><span className="admin-eyebrow">EQUIPE OPERACIONAL</span><h2 id="team-person-dialog-title" ref={dialogTitleRef} tabIndex="-1">{editing ? 'Editar cadastro' : 'Adicionar pessoa'}</h2></div><button type="button" disabled={directoryBusy} aria-label="Fechar" onClick={closePersonDialog}><X size={17} /></button></header><div className="team-modal-fields"><label>Nome completo<input autoFocus={typeof window !== 'undefined' && window.matchMedia('(min-width: 641px)').matches} required maxLength="80" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>E-mail de contato (opcional)<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="nome@empresa.com" /></label><label>Função / especialidade<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Desenvolvimento" /></label><label>Carga semanal estimada (%)<input type="number" min="0" max="100" value={draft.load} onChange={(event) => setDraft({ ...draft, load: event.target.value })} /></label></div><p className="team-modal-note">Cadastro interno para organizar o trabalho. Nenhum convite de acesso será enviado.</p><footer><button type="button" className="admin-secondary" disabled={directoryBusy} onClick={closePersonDialog}>Cancelar</button><button type="submit" className="admin-primary" disabled={directoryBusy || peopleLoading || Boolean(peopleError)}><Check size={14} />{directoryBusy ? 'Salvando…' : editing ? 'Salvar cadastro' : 'Adicionar pessoa'}</button></footer></form></div>}
  </div>;
}

function TeamAccessPanel({ notify, onAccountCountChange }) {
  const preferences = useWorkspacePreferences();
  const currentUser = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null'); } catch { return null; } })();
  const localDemo = isLocalDemoActive();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(currentUser?.role === 'owner' && !localDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [scopeError, setScopeError] = useState('');
  const [inviteLink, setInviteLink] = useState({ url: '', recipient: '' });
  const [inviteNotice, setInviteNotice] = useState('');
  const inviteFormRef = useRef(null);
  const [draft, setDraft] = useState({ name: '', email: '', role: 'member' });
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState(null);
  const [permissionBaseline, setPermissionBaseline] = useState(null);
  const [scopeSources, setScopeSources] = useState({ clients: [], projects: [] });
  const refreshRequests = useRef(null);
  if (!refreshRequests.current) refreshRequests.current = createLatestRequestGuard();
  const refresh = async () => {
    const requestId = refreshRequests.current.begin();
    setLoading(true); setError(''); setListError('');
    try {
      const [accountsResult, clientsResult, projectsResult] = await Promise.allSettled([
        apiRequest('/api/team/users'), fetchAllRecords('/api/workspace/clients'), fetchAllRecords('/api/workspace/projects'),
      ]);
      if (!refreshRequests.current.isCurrent(requestId)) return;
      if (accountsResult.status === 'rejected') throw accountsResult.reason;
      setAccounts(accountsResult.value.data || []);
      const clients = clientsResult.status === 'fulfilled' ? clientsResult.value : [];
      const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
      setScopeSources({ clients, projects });
      setScopeError([clientsResult, projectsResult].some((result) => result.status === 'rejected') ? 'Algumas listas de escopo não carregaram. Escopos selecionados ficam bloqueados para evitar salvar uma seleção incompleta.' : '');
    } catch (err) {
      if (!refreshRequests.current.isCurrent(requestId)) return;
      const message = err.message || 'Nao foi possivel carregar os acessos.'; setListError(message); setError(message);
    } finally { if (refreshRequests.current.isCurrent(requestId)) setLoading(false); }
  };
  useEffect(() => {
    if (currentUser?.role === 'owner' && !localDemo) refresh();
    return () => refreshRequests.current.invalidate();
  }, [currentUser?.role, localDemo]);
  useEffect(() => {
    if (currentUser?.role !== 'owner') return;
    if (localDemo) onAccountCountChange(1);
    else if (!loading && !listError) onAccountCountChange(accounts.filter((account) => account.active).length);
  }, [accounts, currentUser?.role, listError, loading, localDemo, onAccountCountChange]);
  if (currentUser?.role !== 'owner') return null;
  if (localDemo) return <section className="team-access-panel team-demo-access"><header><div><span className="admin-eyebrow">DEMONSTRAÇÃO LOCAL</span><h2>Acesso ao Focusshub</h2><p>Esta sessão está isolada neste navegador. Convites, suspensão de contas e permissões reais ficam desativados para não alterar acessos externos.</p></div></header><div className="team-demo-access-note" role="status"><ShieldCheck size={18} /><span><b>Somente o proprietário local está autenticado</b><small>Os colaboradores de exemplo abaixo organizam tarefas e carga de trabalho; não são contas de login.</small></span></div></section>;
  const createInvite = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (loading || listError) { setError('Atualize a lista de contas antes de criar outro convite.'); return; }
    setBusy(true); setError('');
    try {
      const result = await apiRequest('/api/team/invites', { method: 'POST', body: JSON.stringify({ ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase() }) });
      if (typeof result.inviteUrl !== 'string' || !result.inviteUrl.trim()) throw new Error('O convite foi aceito, mas o servidor não retornou um link. Atualize a lista antes de tentar novamente.');
      setInviteLink((current) => resolveTeamInviteLink(current, { type: 'created', url: result.inviteUrl, recipient: draft.email }));
      setInviteNotice('');
      setDraft({ name: '', email: '', role: 'member' });
      await refresh();
      notify('Convite criado. Copie e compartilhe o link com a pessoa.');
    } catch (err) { setError(err.message || 'Nao foi possivel criar o convite.'); }
    finally { setBusy(false); }
  };
  const deactivate = async (account) => {
    if (!window.confirm(`Suspender o acesso de ${account.name}? A sessao sera bloqueada imediatamente.`)) return;
    setBusy(true); setError('');
    try { await apiRequest(`/api/team/users/${encodeURIComponent(account.id)}/deactivate`, { method: 'POST', body: '{}' }); await refresh(); notify(`Acesso de ${account.name} suspenso.`); }
    catch (err) { setError(err.message || 'Nao foi possivel suspender este acesso.'); }
    finally { setBusy(false); }
  };
  const copyInvite = async () => {
    if (await copyTextToClipboard(inviteLink.url)) notify('Link de convite copiado.');
    else setError('Nao foi possivel copiar o link neste navegador. Selecione e copie o link exibido.');
  };
  const renewInvite = (account) => {
    setDraft({ name: account.name, email: account.email, role: account.role });
    setInviteNotice(`Dados de ${account.name} preparados. Revise-os e confirme em Criar convite para gerar um novo link.`);
    inviteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => inviteFormRef.current?.querySelector('input')?.focus(), 250);
  };
  const editPermissions = (account) => {
    setEditingPermissions(account.id);
    const nextDraft = permissionDraftForAccount(account, accessModules.map(([key]) => key));
    setPermissionDraft(nextDraft);
    setPermissionBaseline(nextDraft);
  };
  const permissionDraftDirty = teamPermissionDraftHasChanges(permissionDraft, permissionBaseline);
  const discardPermissionEdits = () => {
    if (!confirmDiscardTeamPermissionDraft({ dirty: permissionDraftDirty, confirmDiscard: (message) => window.confirm(message) })) return false;
    setEditingPermissions(null);
    setPermissionDraft(null);
    setPermissionBaseline(null);
    return true;
  };
  const togglePermissions = (account) => {
    setError('');
    if (editingPermissions === account.id) { discardPermissionEdits(); return; }
    if (!confirmDiscardTeamPermissionDraft({ dirty: permissionDraftDirty, confirmDiscard: (message) => window.confirm(message) })) return;
    editPermissions(account);
  };
  const changeModulePermission = (account, moduleKey, permission, value) => {
    if (permissionDraft?.[moduleKey] === null && !window.confirm('Esta permissão é herdada e pode variar entre telas do módulo. Personalizar vai substituir o padrão por permissões uniformes neste módulo. Continuar?')) {
      setPermissionDraft({ ...permissionDraft });
      return;
    }
    setPermissionDraft((current) => setModulePermissionValue(current, account.role, moduleKey, permission, value));
  };
  const savePermissions = async (account) => {
    if (!permissionDraft || busy) return;
    if (scopeError && permissionDraft.scope?.mode === 'selected') { setError('Atualize os clientes e projetos antes de salvar um escopo selecionado.'); return; }
    const validationError = validatePermissionDraft(permissionDraft, accessModules.map(([key]) => key));
    if (validationError) { setError(validationError); return; }
    setBusy(true); setError('');
    try {
      await apiRequest(`/api/team/users/${encodeURIComponent(account.id)}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions: permissionsPayload(permissionDraft, accessModules.map(([key]) => key)) }) });
      setEditingPermissions(null); setPermissionDraft(null); setPermissionBaseline(null); await refresh(); notify(`Permissoes de ${account.name} atualizadas.`);
    } catch (err) { setError(err.message || 'Nao foi possivel salvar as permissoes.'); }
    finally { setBusy(false); }
  };
  const accountStatusPresentation = (account) => {
    const status = account.accessStatus || (account.active ? 'active' : 'inactive');
    const labels = {
      active: 'Ativo',
      invite_pending: 'Convite aguardando aceite',
      invite_expired: 'Convite expirado',
      suspended: 'Acesso suspenso',
      inactive: 'Acesso inativo',
    };
    const deadline = status === 'invite_pending' && account.inviteExpiresAt
      ? `Válido até ${formatWorkspaceDateTime(account.inviteExpiresAt, preferences, { timeZone: preferences.timezone })}`
      : '';
    return { status, label: labels[status] || labels.inactive, deadline };
  };
  return <section className="team-access-panel"><header><div><span className="admin-eyebrow">CONTAS E PERMISSOES</span><h2>Acesso ao Focusshub</h2><p>Convites expiram em 48 horas. O link e exibido aqui para voce compartilhar; nenhum e-mail e enviado automaticamente. Contas inativas precisam de um novo convite para recuperar acesso.</p></div><button type="button" className="admin-secondary" onClick={refresh} disabled={loading || busy || editingPermissions !== null}>{loading ? 'Atualizando...' : 'Atualizar lista'}</button></header>
    <form ref={inviteFormRef} className="team-invite-form" onSubmit={createInvite}><label>Nome<input required minLength="2" maxLength="120" value={draft.name} onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setInviteNotice(''); }} /></label><label>E-mail<input required type="email" value={draft.email} onChange={(event) => { setDraft({ ...draft, email: event.target.value }); setInviteNotice(''); }} /></label><label>Papel<select value={draft.role} onChange={(event) => { setDraft({ ...draft, role: event.target.value }); setInviteNotice(''); }}><option value="member">Membro - entrega e atendimento</option><option value="admin">Administrador - operacao da agencia</option></select></label><button type="submit" className="admin-primary" disabled={busy || loading || Boolean(listError)}><Plus size={14} />{busy ? 'Criando...' : 'Criar convite'}</button></form>
    <p className="team-role-note">O papel é definido na criação do convite e não pode ser trocado nesta tela depois que a conta é ativada. Para alterar, suspenda a conta e gere um novo convite com o papel correto.</p>
    {inviteNotice && <p className="team-invite-notice" role="status">{inviteNotice}</p>}
    {inviteLink.url && <div className="team-invite-link" role="status"><span><b>Convite pronto para {inviteLink.recipient}</b><small>Uso único, válido por 48 horas. O link anterior permanece aqui até outro convite ser criado.</small><code>{inviteLink.url}</code></span><button type="button" className="admin-secondary" onClick={copyInvite}><Copy size={14} />Copiar link</button></div>}
    {scopeError && <p className="team-scope-empty-warning" role="status">{scopeError}</p>}
    {error && !listError && <p className="team-access-error" role="alert">{error}</p>}
    {listError && <p className="team-access-error" role="alert">{listError}<button type="button" disabled={loading || busy} onClick={refresh}>Tentar novamente</button></p>}
    {loading && <p className="team-empty" role="status">Carregando contas de acesso...</p>}
    {!loading && !listError && <div className="team-account-list"><div className="team-account-list-head"><span>Conta</span><span>Papel</span><span>Acesso</span><span>Acoes</span></div>{accounts.map((account) => <React.Fragment key={account.id}>
      <div className="team-account-row"><span><b>{account.name}</b><small>{account.email}</small></span><span>{account.role === 'owner' ? 'Proprietario' : account.role === 'admin' ? 'Administrador' : 'Membro'}</span>{(() => { const access = accountStatusPresentation(account); return <span className={`team-account-state ${access.status}`}><b>{access.label}</b>{access.deadline && <small>{access.deadline}</small>}</span>; })()}<span>{account.role !== 'owner' && <><button type="button" aria-expanded={editingPermissions === account.id} disabled={busy} onClick={() => togglePermissions(account)}>{editingPermissions === account.id ? 'Fechar permissoes' : 'Permissoes'}</button>{account.active ? <button type="button" aria-label={'Suspender acesso de ' + account.name} disabled={busy || editingPermissions !== null} onClick={() => deactivate(account)}><UserMinus size={15} />Suspender</button> : <button type="button" aria-label={'Gerar novo convite para ' + account.name} disabled={busy || editingPermissions !== null} onClick={() => renewInvite(account)}><Plus size={14} />Novo link</button>}</>}</span></div>
      {editingPermissions === account.id && permissionDraft && <div className="team-permission-editor"><h3>Permissoes de {account.name}</h3><p>Defina leitura, edicao e exclusao por modulo.</p>{permissionDraftDirty && <p className="team-scope-hint" role="status">Alterações de permissões ainda não salvas. Salve para aplicar ou cancele para descartar.</p>}
        <label className="team-record-scope">Escopo dos registros<select disabled={busy} value={permissionDraft.scope?.mode || 'all'} onChange={(event) => setPermissionDraft((current) => ({ ...current, scope: { ...(current.scope || { clientIds: [], projectIds: [] }), mode: event.target.value } }))}><option value="all">Todos os registros permitidos pelos modulos</option><option value="selected">Somente clientes e projetos selecionados</option></select></label>
        {permissionDraft.scope?.mode === 'selected' && <><p className="team-scope-hint">Registros vinculados por ID ficam visiveis; registros sem vinculo nao aparecem.</p><div className="team-scope-selects"><label>Clientes<select multiple size="6" disabled={busy || Boolean(scopeError)} value={permissionDraft.scope.clientIds || []} onChange={(event) => setPermissionDraft((current) => ({ ...current, scope: { ...current.scope, clientIds: [...event.target.selectedOptions].map((option) => option.value) } }))}>{scopeSources.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Projetos<select multiple size="6" disabled={busy || Boolean(scopeError)} value={permissionDraft.scope.projectIds || []} onChange={(event) => setPermissionDraft((current) => ({ ...current, scope: { ...current.scope, projectIds: [...event.target.selectedOptions].map((option) => option.value) } }))}>{scopeSources.projects.map((project) => <option key={project.id} value={project.id}>{project.name || project.title}</option>)}</select></label></div></>}
        {scopeError && permissionDraft.scope?.mode === 'selected' && <p className="team-scope-empty-warning" role="status">Atualize clientes e projetos antes de escolher registros.</p>}
        <div className="team-permission-grid">{accessModules.map(([key, label]) => {
          const inherited = permissionDraft[key] === null;
          const access = effectiveModulePermissionDraft(permissionDraft, account.role, key);
          return <div className="team-permission-module" key={key}>
            <b>{label}</b>
            <label><input type="checkbox" ref={(element) => { if (element) element.indeterminate = access.read === null; }} aria-checked={access.read === null ? 'mixed' : access.read} disabled={busy} checked={access.read === true} onChange={(event) => changeModulePermission(account, key, 'read', event.target.checked)} />Ler</label>
            <label><input type="checkbox" ref={(element) => { if (element) element.indeterminate = access.write === null; }} aria-checked={access.write === null ? 'mixed' : access.write} disabled={busy || access.read === false} checked={access.write === true} onChange={(event) => changeModulePermission(account, key, 'write', event.target.checked)} />Editar</label>
            <label><input type="checkbox" ref={(element) => { if (element) element.indeterminate = access.delete === null; }} aria-checked={access.delete === null ? 'mixed' : access.delete} disabled={busy || access.read === false} checked={access.delete === true} onChange={(event) => changeModulePermission(account, key, 'delete', event.target.checked)} />Excluir</label>
            {inherited ? <><small>Padrão herdado de {account.role === 'admin' ? 'administrador' : 'membro'}. Acesso que varia por tela aparece parcialmente marcado.</small><button type="button" className="team-permission-reset" disabled={busy} onClick={() => setPermissionDraft((current) => setModulePermissionMode(current, key, 'blocked'))}>Bloquear acesso herdado</button></> : <button type="button" className="team-permission-reset" disabled={busy} onClick={() => setPermissionDraft((current) => setModulePermissionMode(current, key, 'inherited'))}>Usar padrão do papel</button>}
          </div>;
        })}</div>
        <div className="team-permission-actions"><button type="button" className="admin-secondary" disabled={busy} onClick={discardPermissionEdits}>Cancelar</button><button type="button" className="admin-primary" disabled={busy || !permissionDraftDirty || Boolean(scopeError && permissionDraft.scope?.mode === 'selected')} onClick={() => savePermissions(account)}>{busy ? 'Salvando...' : 'Salvar permissoes'}</button></div>
      </div>}
    </React.Fragment>)}{!accounts.length && <p className="team-empty">Nenhuma conta encontrada.</p>}</div>}
  </section>;
}

function TeamStat({ icon: Icon, label, value, detail }) { return <article className="team-summary-card"><span><Icon size={17} /></span><div><small>{label}</small><b>{value}</b><em>{detail}</em></div></article>; }
