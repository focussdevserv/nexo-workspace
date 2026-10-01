import React, { useEffect, useMemo, useState } from 'react';
import { fetchAllRecords, useWorkspaceRecords } from '../lib/workspace-api.js';
import { Check, Copy, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2, UserMinus, UserRound, Users, X } from 'lucide-react';
import { apiRequest } from '../lib/workspace-api.js';
import './team.css';

const accessModules = [
  ['crm', 'CRM e clientes'], ['delivery', 'Projetos e tarefas'], ['support', 'Atendimento e aprovacoes'],
  ['finance', 'Financeiro'], ['sites', 'Sites e repositorios'], ['automations', 'Automacoes'], ['integrations', 'Integracoes'],
  ['settings', 'Configuracoes'], ['reports', 'Relatorios'],
];
const defaultAccess = (role) => Object.fromEntries(accessModules.map(([key]) => [key,
  role === 'admin' ? { read: true, write: true, delete: true }
    : key === 'delivery' || key === 'support' ? { read: true, write: true, delete: false }
      : key === 'crm' ? { read: true, write: false, delete: false }
        : key === 'settings' ? { read: true, write: false, delete: false }
          : { read: false, write: false, delete: false },
]));



export default function TeamScreen({ notify }) {
  const { records: people, create, update, remove: deleteRecord } = useWorkspaceRecords('team');
  const [filter, setFilter] = useState('Todos');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ name: '', email: '', title: '', load: '0' });
  const activeCount = people.filter((person) => person.status === 'Ativo').length;
  const inactiveCount = people.filter((person) => person.status !== 'Ativo').length;
  const averageLoad = activeCount ? Math.round(people.filter((person) => person.status === 'Ativo').reduce((sum, person) => sum + Number(person.load || 0), 0) / activeCount) : 0;
  const visible = useMemo(() => people.filter((person) => {
    const status = person.status === 'Ativo' ? 'Ativo' : 'Inativo';
    return (filter === 'Todos' || status === filter) && `${person.name} ${person.email} ${person.title || person.role || ''}`.toLowerCase().includes(query.toLowerCase());
  }), [people, filter, query]);
  const openNew = () => { setEditing(null); setDraft({ name: '', email: '', title: '', load: '0' }); setDialog(true); };
  const openEdit = (person) => { setEditing(person.id); setDraft({ name: person.name, email: person.email, title: person.title || person.role || '', load: String(person.load || 0) }); setDialog(true); };
  const savePerson = async (event) => {
    event.preventDefault();
    const name = draft.name.trim(); const email = draft.email.trim().toLowerCase();
    if (!name) { notify('Informe o nome da pessoa.'); return; }
    if (email && people.some((person) => String(person.email || '').toLowerCase() === email && person.id !== editing)) { notify('Este e-mail já está cadastrado na equipe.'); return; }
    const title = draft.title.trim() || 'Sem função definida';
    const record = { name, email, role: title, title, initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), tone: 'blue', load: Number(draft.load) || 0, projects: editing ? people.find((person) => person.id === editing)?.projects || 0 : 0, status: editing ? people.find((person) => person.id === editing)?.status || 'Ativo' : 'Ativo' };
    try {
      if (editing) await update(editing, record);
      else await create(record);
      notify(editing ? 'Cadastro operacional atualizado.' : 'Pessoa registrada na equipe operacional; nenhum acesso ao Nexo foi criado.');
      setDialog(false);
    } catch (error) { notify(error.message || 'Não foi possível salvar o cadastro da equipe.'); }
  };
  const toggleStatus = async (person) => {
    const nextStatus = person.status === 'Ativo' ? 'Inativo' : 'Ativo';
    try { await update(person.id, { status: nextStatus }); notify(`${person.name}: cadastro operacional ${nextStatus === 'Ativo' ? 'ativado' : 'inativado'}.`); }
    catch (error) { notify(error.message || 'Não foi possível atualizar a situação da pessoa.'); }
  };
  const remove = async (person) => {
    if (!window.confirm(`Remover ${person.name} da equipe?`)) return;
    try { await deleteRecord(person.id); notify(`${person.name} foi removido da equipe.`); }
    catch (error) { notify(error.message || 'Não foi possível remover o cadastro.'); }
  };
  return <div className="team-module">
    <div className="team-guidance"><ShieldCheck size={16} /><span><b>Controles separados.</b> Cadastros operacionais organizam tarefas. Contas e permissoes do Nexo sao gerenciadas abaixo.</span></div>
    <TeamAccessPanel notify={notify} />
    <section className="team-summary"><TeamStat icon={Users} label="Pessoas ativas" value={String(activeCount).padStart(2, '0')} detail="na operação" /><TeamStat icon={UserRound} label="Pessoas inativas" value={String(inactiveCount).padStart(2, '0')} detail="cadastros operacionais" /><TeamStat icon={ShieldCheck} label="Acesso ao Nexo" value="1" detail="somente proprietário" /></section>
    <section className="team-directory"><header className="team-directory-head"><div><h2>Equipe operacional</h2><p>Registre colaboradores para organizar tarefas e carga de trabalho. O cadastro não cria uma conta Nexo.</p></div><button className="admin-primary" onClick={openNew}><Plus size={15} />Adicionar pessoa</button></header>
      <div className="team-directory-controls"><div className="team-filter-tabs">{['Todos', 'Ativo', 'Inativo'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="team-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail ou função" /></label></div>
      <div className="team-directory-table"><div className="team-directory-row team-directory-labels"><span>Pessoa</span><span>Função</span><span>Projetos</span><span>Carga semanal</span><span>Situação</span><span>Ações</span></div>
        {visible.map((person) => { const status = person.status === 'Ativo' ? 'Ativo' : 'Inativo'; return <div className="team-directory-row" key={person.id}><div className="team-directory-person"><span className={`admin-avatar tone-${person.tone}`}>{person.initials}</span><span><b>{person.name}</b><small>{person.email || 'Sem e-mail cadastrado'}</small></span></div><div className="team-role-cell"><b>{person.title || person.role || 'Sem função definida'}</b><small>Função operacional</small></div><span className="team-number-cell">{person.projects || 0} projetos</span><div className="team-load"><div><i style={{ width: `${Math.max(0, Math.min(100, person.load))}%` }} /></div><small>{person.load}%</small></div><span className={`team-member-status ${status === 'Ativo' ? 'active' : ''}`}><i />{status}</span><div className="team-row-menu"><button aria-label={`Editar ${person.name}`} onClick={() => openEdit(person)}><Pencil size={14} /></button><button aria-label={`${status === 'Ativo' ? 'Inativar' : 'Ativar'} cadastro de ${person.name}`} onClick={() => toggleStatus({ ...person, status })}><ShieldCheck size={14} /></button><button aria-label={`Remover ${person.name}`} onClick={() => remove(person)}><Trash2 size={14} /></button></div></div>; })}
        {!visible.length && <div className="team-empty">Ninguém encontrado com esses filtros.</div>}
      </div>
    </section>
    {dialog && <div className="team-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(false); }}><form className="team-modal" onSubmit={savePerson}><header><div><span className="admin-eyebrow">EQUIPE OPERACIONAL</span><h2>{editing ? 'Editar cadastro' : 'Adicionar pessoa'}</h2></div><button type="button" aria-label="Fechar" onClick={() => setDialog(false)}><X size={17} /></button></header><div className="team-modal-fields"><label>Nome completo<input autoFocus required maxLength="80" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>E-mail de contato (opcional)<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="nome@empresa.com" /></label><label>Função / especialidade<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Desenvolvimento" /></label><label>Carga semanal estimada (%)<input type="number" min="0" max="100" value={draft.load} onChange={(event) => setDraft({ ...draft, load: event.target.value })} /></label></div><p className="team-modal-note">Cadastro interno para organizar o trabalho. Nenhum convite de acesso será enviado.</p><footer><button type="button" className="admin-secondary" onClick={() => setDialog(false)}>Cancelar</button><button type="submit" className="admin-primary"><Check size={14} />{editing ? 'Salvar cadastro' : 'Adicionar pessoa'}</button></footer></form></div>}
  </div>;
}

function TeamAccessPanel({ notify }) {
  const currentUser = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null'); } catch { return null; } })();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [draft, setDraft] = useState({ name: '', email: '', role: 'member' });
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState(null);
  const [scopeSources, setScopeSources] = useState({ clients: [], projects: [] });
  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [result, clients, projects] = await Promise.all([
        apiRequest('/api/team/users'), fetchAllRecords('/api/workspace/clients'), fetchAllRecords('/api/workspace/projects'),
      ]);
      setAccounts(result.data || []); setScopeSources({ clients, projects });
    }
    catch (err) { setError(err.message || 'Nao foi possivel carregar os acessos.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (currentUser?.role === 'owner') refresh(); }, []);
  if (currentUser?.role !== 'owner') return null;
  const createInvite = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setInviteUrl('');
    try {
      const result = await apiRequest('/api/team/invites', { method: 'POST', body: JSON.stringify({ ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase() }) });
      setInviteUrl(result.inviteUrl);
      setDraft({ name: '', email: '', role: 'member' });
      await refresh();
      notify('Convite criado. Copie e compartilhe o link com a pessoa.');
    } catch (err) { setError(err.message || 'Nao foi possivel criar o convite.'); }
    finally { setBusy(false); }
  };
  const deactivate = async (account) => {
    if (!window.confirm(`Suspender o acesso de ${account.name}? A sessao sera bloqueada imediatamente.`)) return;
    setBusy(true); setError('');
    try { await apiRequest(`/api/team/users/${account.id}/deactivate`, { method: 'POST', body: '{}' }); await refresh(); notify(`Acesso de ${account.name} suspenso.`); }
    catch (err) { setError(err.message || 'Nao foi possivel suspender este acesso.'); }
    finally { setBusy(false); }
  };
  const copyInvite = async () => { try { await navigator.clipboard.writeText(inviteUrl); notify('Link de convite copiado.'); } catch { setError('Nao foi possivel copiar o link neste navegador.'); } };
  const renewInvite = (account) => { setDraft({ name: account.name, email: account.email, role: account.role }); setInviteUrl(''); };
  const editPermissions = (account) => { setEditingPermissions(account.id); setPermissionDraft({ ...defaultAccess(account.role), ...(account.permissions || {}), scope: account.permissions?.scope || { mode: 'all', clientIds: [], projectIds: [] } }); };
  const savePermissions = async (account) => {
    setBusy(true); setError('');
    try {
      await apiRequest(`/api/team/users/${encodeURIComponent(account.id)}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions: permissionDraft }) });
      setEditingPermissions(null); setPermissionDraft(null); await refresh(); notify(`Permissoes de ${account.name} atualizadas.`);
    } catch (err) { setError(err.message || 'Nao foi possivel salvar as permissoes.'); }
    finally { setBusy(false); }
  };
  return <section className="team-access-panel"><header><div><span className="admin-eyebrow">CONTAS E PERMISSOES</span><h2>Acesso ao Nexo</h2><p>Convites expiram em 48 horas. O link e exibido aqui para voce compartilhar; nenhum e-mail e enviado automaticamente.</p></div><button type="button" className="admin-secondary" onClick={refresh} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar lista'}</button></header>
    <form className="team-invite-form" onSubmit={createInvite}><label>Nome<input required minLength="2" maxLength="120" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>E-mail<input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label><label>Papel<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}><option value="member">Membro - entrega e atendimento</option><option value="admin">Administrador - operacao da agencia</option></select></label><button type="submit" className="admin-primary" disabled={busy}><Plus size={14} />{busy ? 'Criando...' : 'Criar convite'}</button></form>
    {inviteUrl && <div className="team-invite-link" role="status"><span><b>Convite pronto</b><small>Uso unico, valido por 48 horas</small><code>{inviteUrl}</code></span><button type="button" className="admin-secondary" onClick={copyInvite}><Copy size={14} />Copiar link</button></div>}
    {error && <p className="team-access-error" role="alert">{error}<button type="button" onClick={refresh}>Tentar novamente</button></p>}
    <div className="team-account-list"><div className="team-account-list-head"><span>Conta</span><span>Papel</span><span>Acesso</span><span>Acoes</span></div>{accounts.map((account) => <React.Fragment key={account.id}><div className="team-account-row"><span><b>{account.name}</b><small>{account.email}</small></span><span>{account.role === 'owner' ? 'Proprietario' : account.role === 'admin' ? 'Administrador' : 'Membro'}</span><span className={account.active ? 'team-account-active' : 'team-account-pending'}>{account.active ? 'Ativo' : 'Convite pendente / suspenso'}</span><span>{account.role !== 'owner' && <><button type="button" aria-expanded={editingPermissions === account.id} onClick={() => editingPermissions === account.id ? (setEditingPermissions(null), setPermissionDraft(null)) : editPermissions(account)}>Permissoes</button>{account.active ? <button type="button" aria-label={'Suspender acesso de ' + account.name} disabled={busy} onClick={() => deactivate(account)}><UserMinus size={15} />Suspender</button> : <button type="button" aria-label={'Gerar novo convite para ' + account.name} disabled={busy} onClick={() => renewInvite(account)}><Plus size={15} />Novo link</button>}</>}</span></div>{editingPermissions === account.id && permissionDraft && <div className="team-permission-editor"><h3>Permissoes de {account.name}</h3><p>Defina leitura, edicao e exclusao por modulo. A exclusao exige uma permissao separada.</p><label className="team-record-scope">Escopo dos registros<select value={permissionDraft.scope?.mode || 'all'} onChange={(event) => setPermissionDraft((current) => ({ ...current, scope: { ...(current.scope || { clientIds: [], projectIds: [] }), mode: event.target.value } }))}><option value="all">Todos os registros permitidos pelos modulos</option><option value="selected">Somente clientes e projetos selecionados</option></select></label>{permissionDraft.scope?.mode === 'selected' && <><p className="team-scope-hint">Registros vinculados por ID aos clientes ou projetos selecionados ficam visiveis. Registros sem vinculo nao aparecem.</p><div className="team-scope-selects"><label>Clientes<select multiple size="6" value={permissionDraft.scope.clientIds || []} onChange={(event) => setPermissionDraft((current) => ({ ...current, scope: { ...current.scope, clientIds: [...event.target.selectedOptions].map((option) => option.value) } }))}>{scopeSources.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Projetos<select multiple size="6" value={permissionDraft.scope.projectIds || []} onChange={(event) => setPermissionDraft((current) => ({ ...current, scope: { ...current.scope, projectIds: [...event.target.selectedOptions].map((option) => option.value) } }))}>{scopeSources.projects.map((project) => <option key={project.id} value={project.id}>{project.name || project.title}</option>)}</select></label></div></>}<div className="team-permission-grid">{accessModules.map(([key, label]) => { const access = permissionDraft[key] || { read: false, write: false, delete: false }; return <div className="team-permission-module" key={key}><b>{label}</b><label><input type="checkbox" checked={Boolean(access.read)} onChange={(event) => setPermissionDraft((current) => ({ ...current, [key]: { ...current[key], read: event.target.checked, write: event.target.checked ? current[key].write : false, delete: event.target.checked ? current[key].delete : false } }))} />Ler</label><label><input type="checkbox" checked={Boolean(access.write)} disabled={!access.read} onChange={(event) => setPermissionDraft((current) => ({ ...current, [key]: { ...current[key], read: true, write: event.target.checked } }))} />Editar</label><label><input type="checkbox" checked={Boolean(access.delete)} disabled={!access.read} onChange={(event) => setPermissionDraft((current) => ({ ...current, [key]: { ...current[key], read: true, delete: event.target.checked } }))} />Excluir</label></div>; })}</div><div className="team-permission-actions"><button type="button" className="admin-secondary" disabled={busy} onClick={() => { setEditingPermissions(null); setPermissionDraft(null); }}>Cancelar</button><button type="button" className="admin-primary" disabled={busy} onClick={() => savePermissions(account)}>{busy ? 'Salvando...' : 'Salvar permissoes'}</button></div></div>}</React.Fragment>)}{!loading && !accounts.length && <p className="team-empty">Nenhuma conta carregada.</p>}</div>
  </section>;
}

function TeamStat({ icon: Icon, label, value, detail }) { return <article className="team-summary-card"><span><Icon size={17} /></span><div><small>{label}</small><b>{value}</b><em>{detail}</em></div></article>; }
