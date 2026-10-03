import React, { useEffect, useState } from 'react';
import {
  ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronRight, ExternalLink,
  CircleDollarSign, Clock3, FileText, Pencil, Plus, Search, Trash2,
  RefreshCw, Sparkles, Target, Users, Zap,
} from 'lucide-react';
import './admin.css';
import './repositories.css';
import { apiRequest, useWorkspaceRecords } from '../lib/workspace-api.js';
import SettingsScreen from './SettingsScreen.jsx';
import GoalsScreen from './GoalsScreen.jsx';
import ReportsScreen from './ReportsScreen.jsx';
import TeamScreen from './TeamScreen.jsx';
import { ClientPortalAdmin } from './ClientPortalScreens.jsx';
import { repositoryRegistrationIssue } from '../lib/repository-registration.js';
import { normalizeRepositoryActivity } from '../lib/repository-activity.js';
import { repositoryConnectionState } from '../lib/repository-connection.js';
import { updateKeyedBusyState } from '../lib/keyed-busy-state.js';
import { canStartRepositoryOperation } from '../lib/repository-operation.js';
import { confirmWorkspaceDelete, useWorkspacePreferences } from '../lib/workspace-preferences.js';
import { formatWorkspaceDateTime } from '../lib/workspace-formatting.js';

const team = [];

const reportBars = [32, 45, 39, 62, 51, 72, 58, 82, 65, 90, 74, 100];
const repositorySeed = [];

export default function AdminScreen({ page, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const preferences = useWorkspacePreferences();
  const [tab, setTab] = useState('Geral');
  const [notice, setNotice] = useState('');
  const { records: repos, create: createRepo, update: updateRepo, remove: deleteRepo, loading: reposLoading, error: reposError, refresh: refreshRepos } = useWorkspaceRecords('repositories');
  const [repoModal, setRepoModal] = useState(false);
  const [editingRepo, setEditingRepo] = useState(null);
  const [repoSaving, setRepoSaving] = useState(false);
  const [repoError, setRepoError] = useState('');
  const [repoDraft, setRepoDraft] = useState({ name: '', owner: '', project: '', branch: 'main' });
  const [githubStatus, setGithubStatus] = useState(null);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubError, setGithubError] = useState('');
  const [repoActivity, setRepoActivity] = useState({});
  const [repoSyncError, setRepoSyncError] = useState({});
  const [syncingRepos, setSyncingRepos] = useState(() => new Set());
  const [removingRepos, setRemovingRepos] = useState(() => new Set());
  const githubConnection = repositoryConnectionState({ loading: githubLoading, error: githubError, status: githubStatus });
  const loadGithubStatus = async () => {
    setGithubLoading(true);
    setGithubError('');
    try {
      const { data } = await apiRequest('/api/integrations/status');
      setGithubStatus(data.find((item) => item.provider === 'github') || null);
    } catch (error) {
      setGithubStatus(null);
      setGithubError(error.message || 'Não foi possível consultar o estado do GitHub.');
    } finally { setGithubLoading(false); }
  };
  useEffect(() => { loadGithubStatus(); }, []);
  const saveRepo = async (event) => {
    event.preventDefault();
    if (repoSaving) return;
    const owner = repoDraft.owner.trim();
    const name = repoDraft.name.trim();
    const validationIssue = repositoryRegistrationIssue({ repos, owner, name, loading: reposLoading, excludeId: editingRepo?.id });
    if (validationIssue) {
      setRepoError(validationIssue);
      return;
    }
    if (reposError) { setRepoError('Atualize a lista de repositórios antes de salvar.'); return; }
    setRepoSaving(true);
    setRepoError('');
    try {
      const payload = { ...repoDraft, name, owner, project: repoDraft.project.trim(), branch: repoDraft.branch.trim() || 'main' };
      if (editingRepo) await updateRepo(editingRepo.id, payload);
      else await createRepo({ ...payload, status: 'Aguardando conexao' });
      setRepoDraft({ name: '', owner: '', project: '', branch: 'main' });
      setEditingRepo(null);
      setRepoModal(false);
      notify(editingRepo ? 'Cadastro do repositório atualizado.' : 'Repositorio cadastrado. Conecte o GitHub em Integracoes para sincronizar atividade e deploys.');
    } catch (error) {
      setRepoError(error.message || 'Nao foi possivel salvar o repositorio. Seus dados continuam no formulario.');
    } finally { setRepoSaving(false); }
  };
  const syncRepository = async (repo) => {
    if (!canStartRepositoryOperation({ syncingRepos, removingRepos }, repo.id, 'sync')) return;
    setSyncingRepos((current) => updateKeyedBusyState(current, repo.id, true));
    setRepoSyncError((current) => ({ ...current, [repo.id]: '' }));
    try {
      const owner = encodeURIComponent(String(repo.owner || '').trim());
      const name = encodeURIComponent(String(repo.name || '').trim());
      const result = await apiRequest(`/api/integrations/github/repos/${owner}/${name}/activity`);
      setRepoActivity((current) => ({ ...current, [repo.id]: normalizeRepositoryActivity(result?.data) }));
    } catch (error) { setRepoSyncError((current) => ({ ...current, [repo.id]: error.message || 'Falha ao consultar o GitHub.' })); }
    finally { setSyncingRepos((current) => updateKeyedBusyState(current, repo.id, false)); }
  };
  const openNewRepository = () => {
    setEditingRepo(null);
    setRepoDraft({ name: '', owner: '', project: '', branch: 'main' });
    setRepoError('');
    setRepoModal(true);
  };
  const openEditRepository = (repo) => {
    setEditingRepo(repo);
    setRepoDraft({ name: repo.name || '', owner: repo.owner || '', project: repo.project || '', branch: repo.branch || 'main' });
    setRepoError('');
    setRepoModal(true);
  };
  const removeRepository = async (repo) => {
    const key = String(repo.id);
    if (!canStartRepositoryOperation({ syncingRepos, removingRepos }, key, 'remove')) return;
    if (!confirmWorkspaceDelete(`Remover ${repo.name} do cadastro?`, preferences)) return;
    setRemovingRepos((current) => updateKeyedBusyState(current, repo.id, true));
    try {
      await deleteRepo(repo.id);
      setRepoActivity((current) => { const next = { ...current }; delete next[repo.id]; return next; });
      setRepoSyncError((current) => { const next = { ...current }; delete next[repo.id]; return next; });
      notify('Repositório removido.');
    } catch (error) {
      notify(error.message || 'Não foi possível remover o repositório.');
    } finally {
      setRemovingRepos((current) => updateKeyedBusyState(current, repo.id, false));
    }
  };
  const notify = (text) => { setNotice(text); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setNotice(''), 2600); };

  return <main className="admin-screen">
    <header className="admin-heading">
      <div><div className="admin-breadcrumb">FOCUSSHUB <ChevronRight size={13} /> GESTÃO</div><span className="admin-eyebrow">ESPAÇO DE GESTÃO</span><h1>{page}</h1><p>{descriptionFor(page)}</p></div>
      {page === 'Repositórios' && <button type="button" className="admin-primary" disabled={reposLoading || Boolean(reposError)} onClick={openNewRepository}><Plus size={16} />{reposLoading ? 'Carregando repositórios...' : 'Adicionar repositório'}</button>}
    </header>

    {page === 'Equipe' && <TeamScreen notify={notify} />}

    {page === 'Repositórios' && <>
      <section className="admin-stats"><AdminStat icon={FileText} label="Repositórios cadastrados" value={reposLoading ? '…' : reposError ? 'Indisponível' : String(repos.length)} hint={reposError ? 'falha ao carregar a lista' : 'registros salvos no workspace'} tone="blue" /><AdminStat icon={Zap} label="GitHub" value={githubConnection.label} hint={githubConnection.hint} tone="green" /><AdminStat icon={CheckCircle2} label="Repositórios pendentes" value={reposLoading ? '…' : reposError ? 'Indisponível' : githubConnection.available ? String(repos.filter((repo) => !repoActivity[repo.id]).length) : String(repos.length)} hint="sem consulta nesta sessão" tone="violet" /></section>
      {(reposError || githubError) && <div className="repo-load-error" role="alert">{reposError && <span>Falha ao carregar repositórios: {reposError}</span>}{githubError && <span>Falha ao consultar GitHub: {githubError}</span>}{reposError && <button type="button" className="admin-secondary" onClick={refreshRepos} disabled={reposLoading}>Tentar lista novamente</button>}{githubError && <button type="button" className="admin-secondary" onClick={loadGithubStatus} disabled={githubLoading}>Tentar GitHub novamente</button>}</div>}
      <section className="admin-panel"><div className="admin-panel-head"><div><h2>Repositórios GitHub</h2><p>Consulte commits recentes, pull requests abertas e o último deploy dos repositórios cadastrados.</p></div><button type="button" className="admin-secondary" onClick={() => { refreshRepos(); loadGithubStatus(); }} disabled={reposLoading || githubLoading}><RefreshCw size={14} /> Atualizar</button></div><div className="repo-grid">{repos.map((repo) => <RepositoryCard key={repo.id} repo={repo} activity={repoActivity[repo.id]} error={repoSyncError[repo.id]} syncing={syncingRepos.has(String(repo.id))} removing={removingRepos.has(String(repo.id))} githubAvailable={githubConnection.available} preferences={preferences} onSync={syncRepository} onConfigure={() => window.dispatchEvent(new CustomEvent('nexo:navigate',{detail:'Integrações'}))} onEdit={openEditRepository} onRemove={removeRepository} />)}{reposLoading && <div className="reports-no-data" role="status">Carregando repositórios…</div>}{reposError && <div className="reports-no-data" role="alert">A lista não está disponível. Use “Tentar lista novamente” acima.</div>}{!reposLoading && !reposError && repos.length===0&&<div className="reports-no-data">Nenhum repositório cadastrado.</div>}</div></section>
      {repoModal && <div className="repo-modal-backdrop" onMouseDown={(event) => { if (!repoSaving && event.target === event.currentTarget) setRepoModal(false); }}>
        <form className="repo-modal" role="dialog" aria-modal="true" aria-labelledby="repo-dialog-title" aria-busy={repoSaving} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); if (!repoSaving) setRepoModal(false); } }} onSubmit={saveRepo}>
          <header><div><small>OPERACOES - GITHUB</small><h2 id="repo-dialog-title">{editingRepo ? 'Editar repositorio' : 'Adicionar repositorio'}</h2></div><button type="button" disabled={repoSaving} onClick={() => setRepoModal(false)} aria-label="Fechar">X</button></header>
          <label>Nome do repositorio<input autoFocus required disabled={repoSaving} value={repoDraft.name} onChange={(e) => setRepoDraft({ ...repoDraft, name: e.target.value })} placeholder="site-do-cliente" /></label>
          <label>Usuario ou organizacao<input required disabled={repoSaving} value={repoDraft.owner} onChange={(e) => setRepoDraft({ ...repoDraft, owner: e.target.value })} placeholder="minha-agencia" /></label>
          <label>Projeto relacionado<input disabled={repoSaving} value={repoDraft.project} onChange={(e) => setRepoDraft({ ...repoDraft, project: e.target.value })} placeholder="Site institucional - Cliente" /></label>
          <label>Branch principal<input disabled={repoSaving} value={repoDraft.branch} onChange={(e) => setRepoDraft({ ...repoDraft, branch: e.target.value })} /></label>
          <p>O cadastro fica salvo no workspace. A sincronizacao requer conectar o GitHub em Integracoes.</p>
          {repoError && <p className="repo-modal-error" role="alert">{repoError}</p>}
          <footer><button className="admin-secondary" type="button" disabled={repoSaving} onClick={() => setRepoModal(false)}>Cancelar</button><button className="admin-primary" type="submit" disabled={repoSaving}>{repoSaving ? 'Salvando...' : editingRepo ? 'Salvar alteracoes' : 'Salvar repositorio'}</button></footer>
        </form>
      </div>}
    </>}

    {page === 'Relatórios' && <ReportsScreen notify={notify} />}

    {page === 'Metas' && <GoalsScreen notify={notify} />}

    {page === 'Configurações' && <SettingsScreen notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />}

    {page === 'Portal do cliente' && <ClientPortalAdmin notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />}

    {notice && <div className="admin-toast" role="status"><Check size={15} />{notice}</div>}
  </main>;
}

function RepositoryCard({ repo, activity, error, syncing, removing, githubAvailable, preferences, onSync, onConfigure, onEdit, onRemove }) {
  const latestCommit = activity?.latestCommit;
  const deployment = activity?.deployment;
  const deploymentTone = deployment?.state === 'success' ? '' : 'amber';
  return <article className="repo-card">
    <div className="repo-card-head"><span className="repo-mark">GH</span><div className="repo-card-tools"><button className="admin-icon-button" type="button" aria-label={`Editar ${repo.name}`} title={`Editar ${repo.name}`} disabled={syncing || removing} onClick={() => onEdit(repo)}><Pencil size={15}/></button><button className="admin-icon-button" type="button" aria-label={removing ? `Removendo ${repo.name}` : `Remover ${repo.name}`} title={removing ? 'Removendo repositório...' : `Remover ${repo.name}`} disabled={syncing || removing} onClick={() => onRemove(repo)}><Trash2 size={16}/></button></div></div>
    <h3>{activity?.repository?.url ? <a href={activity.repository.url} target="_blank" rel="noopener noreferrer">{activity.repository.fullName || repo.name}<ExternalLink size={12}/></a> : repo.name}</h3>
    <small>{repo.owner}{repo.project ? ` / ${repo.project}` : ''}</small>
    <div className="repo-branch"><span>⑂ {activity?.repository?.defaultBranch || repo.branch || 'main'}</span><span>{activity ? `${activity.pullRequests.length} PRs abertas` : 'Ainda não sincronizado'}</span></div>
    {error ? <p className="repo-sync-error" role="alert">{error}</p> : latestCommit ? <div className="repo-activity-detail"><b>Último commit · {latestCommit.sha || 'SHA não informado'}</b><small>{latestCommit.message || 'Commit sem descrição'}{latestCommit.author ? ` · ${latestCommit.author}` : ''}</small>{activity.pullRequests.length > 0 && <small>Pull requests abertas: {activity.pullRequests.map((pull) => `#${pull.number} ${pull.title}`).join(' · ')}</small>}{deployment ? <small className={deploymentTone}>Deploy {deployment.environment || ''}: {deployment.state}{deployment.url ? <> · <a href={deployment.url} target="_blank" rel="noopener noreferrer">abrir</a></> : ''}</small> : <small>Sem deploy registrado no GitHub.</small>}<small>Sincronizado {activity.syncedAt ? formatWorkspaceDateTime(activity.syncedAt, preferences, { timeZone: preferences.timezone }) : 'horário não informado'}</small></div> : activity ? <div className="repo-activity-detail"><small>Atividade consultada, mas nenhum commit recente foi retornado.</small><small>{activity.pullRequests.length} PRs abertas{deployment ? ` · Deploy ${deployment.state}` : ''}</small><small>Sincronizado {activity.syncedAt ? formatWorkspaceDateTime(activity.syncedAt, preferences, { timeZone: preferences.timezone }) : 'horário não informado'}</small></div> : <p>Consulte o último commit, pull requests abertas e o deploy mais recente.</p>}
    {!activity && !error && <span className="repo-status amber"><i/>Aguardando sincronização</span>}
    <div className="repo-card-actions">{githubAvailable ? <button className="repo-open" type="button" disabled={syncing || removing} onClick={() => onSync(repo)}>{syncing ? <RefreshCw className="repo-spin" size={13}/> : <RefreshCw size={13}/>} {syncing ? 'Sincronizando...' : removing ? 'Removendo...' : 'Sincronizar GitHub'}</button> : <button className="repo-open" type="button" disabled={removing} onClick={onConfigure}>Configurar GitHub <ArrowRight size={14}/></button>}{activity?.repository?.url && <a className="repo-open" href={activity.repository.url} target="_blank" rel="noopener noreferrer">Abrir repositório <ExternalLink size={13}/></a>}</div>
  </article>;
}
function descriptionFor(page) {
  return ({ Equipe: 'Pessoas, responsabilidades e capacidade de trabalho.', Relatórios: 'Acompanhe os indicadores que movem sua agência.', Metas: 'Defina objetivos e acompanhe o progresso da agência.', Configurações: 'Gerencie os dados e as preferências do seu workspace.', 'Portal do cliente': 'Veja a experiência de acompanhamento compartilhada com seus clientes.', Repositórios: 'Repositórios, commits e deploys ligados aos projetos.' })[page] || 'Gestão da agência';
}

function AdminStat({ icon: Icon, label, value, hint, tone }) { return <article className="admin-stat"><span className={`admin-stat-icon ${tone}`}><Icon size={18} /></span><span className="admin-stat-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span></article>; }
function Avatar({ initials, tone = 'blue', small = false }) { return <span className={`admin-avatar tone-${tone} ${small ? 'small' : ''}`}>{initials}</span>; }
function BriefcaseIcon(props) { return <FileText {...props} />; }
