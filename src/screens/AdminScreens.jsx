import React, { useEffect, useState } from 'react';
import {
  ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronRight, ExternalLink,
  CircleDollarSign, Clock3, FileText, MoreHorizontal, Plus, Search,
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

const team = [];

const reportBars = [32, 45, 39, 62, 51, 72, 58, 82, 65, 90, 74, 100];
const repositorySeed = [];

export default function AdminScreen({ page, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const [tab, setTab] = useState('Geral');
  const [notice, setNotice] = useState('');
  const { records: repos, create: createRepo, remove: deleteRepo } = useWorkspaceRecords('repositories');
  const [repoModal, setRepoModal] = useState(false);
  const [repoDraft, setRepoDraft] = useState({ name: '', owner: '', project: '', branch: 'main' });
  const [githubStatus, setGithubStatus] = useState(null);
  const [repoActivity, setRepoActivity] = useState({});
  const [repoSyncError, setRepoSyncError] = useState({});
  const [syncingRepo, setSyncingRepo] = useState('');
  useEffect(() => { apiRequest('/api/integrations/status').then(({ data }) => setGithubStatus(data.find((item) => item.provider === 'github') || null)).catch(() => setGithubStatus(null)); }, []);
  const addRepo = async (event) => { event.preventDefault(); if (!repoDraft.name.trim() || !repoDraft.owner.trim()) return; try { await createRepo({ ...repoDraft, name: repoDraft.name.trim(), owner: repoDraft.owner.trim(), project: repoDraft.project.trim(), status: 'Aguardando conexão' }); setRepoDraft({ name: '', owner: '', project: '', branch: 'main' }); setRepoModal(false); notify('Repositório cadastrado. Conecte a integração para sincronizar atividade e deploys.'); } catch (error) { notify(error.message || 'Não foi possível salvar o repositório.'); } };
  const syncRepository = async (repo) => {
    setSyncingRepo(String(repo.id));
    setRepoSyncError((current) => ({ ...current, [repo.id]: '' }));
    try {
      const owner = encodeURIComponent(String(repo.owner || '').trim());
      const name = encodeURIComponent(String(repo.name || '').trim());
      const result = await apiRequest(`/api/integrations/github/repos/${owner}/${name}/activity`);
      setRepoActivity((current) => ({ ...current, [repo.id]: result.data }));
    } catch (error) { setRepoSyncError((current) => ({ ...current, [repo.id]: error.message || 'Falha ao consultar o GitHub.' })); }
    finally { setSyncingRepo(''); }
  };
  const notify = (text) => { setNotice(text); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setNotice(''), 2600); };

  return <main className="admin-screen">
    <header className="admin-heading">
      <div><div className="admin-breadcrumb">NEXO <ChevronRight size={13} /> GESTÃO</div><span className="admin-eyebrow">ESPAÇO DE GESTÃO</span><h1>{page}</h1><p>{descriptionFor(page)}</p></div>
      {!['Configurações', 'Metas', 'Relatórios', 'Equipe', 'Portal do cliente'].includes(page) && <button className="admin-primary" onClick={() => page === 'Repositórios' ? setRepoModal(true) : notify('Relatório atualizado.')}><Plus size={16} />{page === 'Repositórios' ? 'Conectar repositório' : 'Novo relatório'}</button>}
    </header>

    {page === 'Equipe' && <TeamScreen notify={notify} />}

    {page === 'Repositórios' && <>
      <section className="admin-stats"><AdminStat icon={FileText} label="Repositórios cadastrados" value={String(repos.length)} hint="registros salvos no workspace" tone="blue" /><AdminStat icon={Zap} label="GitHub" value={githubStatus?.configured && githubStatus?.enabled ? (githubStatus?.lastTestStatus === 'connected' ? 'Conectado' : 'Token presente') : (githubStatus?.configured ? 'Desconectado' : 'Não conectado')} hint={githubStatus?.lastTestStatus === 'connected' && githubStatus?.enabled ? 'identidade verificada pela API' : 'configure GITHUB_TOKEN no Coolify'} tone="green" /><AdminStat icon={CheckCircle2} label="Repositórios pendentes" value={githubStatus?.configured && githubStatus?.enabled ? String(repos.filter((repo) => !repoActivity[repo.id]).length) : String(repos.length)} hint="sem consulta nesta sessão" tone="violet" /></section>
      <section className="admin-panel"><div className="admin-panel-head"><div><h2>Repositórios GitHub</h2><p>Consulte commits recentes, pull requests abertas e o último deploy dos repositórios cadastrados.</p></div><button className="admin-secondary" onClick={() => setRepoModal(true)}><Plus size={14}/>Adicionar repositório</button></div><div className="repo-grid">{repos.map((repo) => <RepositoryCard key={repo.id} repo={repo} activity={repoActivity[repo.id]} error={repoSyncError[repo.id]} syncing={syncingRepo === String(repo.id)} githubAvailable={Boolean(githubStatus?.configured && githubStatus?.enabled)} onSync={syncRepository} onConfigure={() => window.dispatchEvent(new CustomEvent('nexo:navigate',{detail:'Integrações'}))} onRemove={async (item) => { if (!window.confirm(`Remover ${item.name} do cadastro?`)) return; try { await deleteRepo(item.id); notify('Repositório removido.'); } catch (error) { notify(error.message || 'Não foi possível remover o repositório.'); } }} />)}{repos.length===0&&<div className="reports-no-data">Nenhum repositório cadastrado.</div>}</div></section>
      {repoModal&&<div className="repo-modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setRepoModal(false);}}><form className="repo-modal" onSubmit={addRepo}><header><div><small>OPERAÇÕES · GITHUB</small><h2>Adicionar repositório</h2></div><button type="button" onClick={()=>setRepoModal(false)} aria-label="Fechar">×</button></header><label>Nome do repositório<input autoFocus required value={repoDraft.name} onChange={(e)=>setRepoDraft({...repoDraft,name:e.target.value})} placeholder="site-do-cliente"/></label><label>Usuário ou organização<input required value={repoDraft.owner} onChange={(e)=>setRepoDraft({...repoDraft,owner:e.target.value})} placeholder="minha-agencia"/></label><label>Projeto relacionado<input value={repoDraft.project} onChange={(e)=>setRepoDraft({...repoDraft,project:e.target.value})} placeholder="Site institucional · Cliente"/></label><label>Branch principal<input value={repoDraft.branch} onChange={(e)=>setRepoDraft({...repoDraft,branch:e.target.value})}/></label><p>O cadastro fica salvo no workspace. A sincronização requer conectar o GitHub em Integrações.</p><footer><button className="admin-secondary" type="button" onClick={()=>setRepoModal(false)}>Cancelar</button><button className="admin-primary" type="submit">Salvar repositório</button></footer></form></div>}
    </>}

    {page === 'Relatórios' && <ReportsScreen notify={notify} />}

    {page === 'Metas' && <GoalsScreen notify={notify} />}

    {page === 'Configurações' && <SettingsScreen notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />}

    {page === 'Portal do cliente' && <ClientPortalAdmin notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />}

    {notice && <div className="admin-toast" role="status"><Check size={15} />{notice}</div>}
  </main>;
}

function RepositoryCard({ repo, activity, error, syncing, githubAvailable, onSync, onConfigure, onRemove }) {
  const latestCommit = activity?.latestCommit;
  const deployment = activity?.deployment;
  const deploymentTone = deployment?.state === 'success' ? '' : 'amber';
  return <article className="repo-card">
    <div className="repo-card-head"><span className="repo-mark">GH</span><button className="admin-icon-button" aria-label={`Remover ${repo.name}`} onClick={() => onRemove(repo)}><MoreHorizontal size={18}/></button></div>
    <h3>{activity?.repository?.url ? <a href={activity.repository.url} target="_blank" rel="noreferrer">{activity.repository.fullName || repo.name}<ExternalLink size={12}/></a> : repo.name}</h3>
    <small>{repo.owner}{repo.project ? ` / ${repo.project}` : ''}</small>
    <div className="repo-branch"><span>⑂ {activity?.repository?.defaultBranch || repo.branch || 'main'}</span><span>{activity ? `${activity.pullRequests.length} PRs abertas` : 'Ainda não sincronizado'}</span></div>
    {error ? <p className="repo-sync-error" role="alert">{error}</p> : latestCommit ? <div className="repo-activity-detail"><b>Último commit · {latestCommit.sha}</b><small>{latestCommit.message || 'Commit sem descrição'}{latestCommit.author ? ` · ${latestCommit.author}` : ''}</small>{activity.pullRequests.length > 0 && <small>Pull requests abertas: {activity.pullRequests.map((pull) => `#${pull.number} ${pull.title}`).join(' · ')}</small>}{deployment ? <small className={deploymentTone}>Deploy {deployment.environment || ''}: {deployment.state}{deployment.url ? <> · <a href={deployment.url} target="_blank" rel="noreferrer">abrir</a></> : ''}</small> : <small>Sem deploy registrado no GitHub.</small>}<small>Sincronizado {new Date(activity.syncedAt).toLocaleString('pt-BR')}</small></div> : <p>Consulte o último commit, pull requests abertas e o deploy mais recente.</p>}
    {!activity && !error && <span className="repo-status amber"><i/>Aguardando sincronização</span>}
    <div className="repo-card-actions">{githubAvailable ? <button className="repo-open" type="button" disabled={syncing} onClick={() => onSync(repo)}>{syncing ? <RefreshCw className="repo-spin" size={13}/> : <RefreshCw size={13}/>} {syncing ? 'Sincronizando...' : 'Sincronizar GitHub'}</button> : <button className="repo-open" type="button" onClick={onConfigure}>Configurar GitHub <ArrowRight size={14}/></button>}{activity?.repository?.url && <a className="repo-open" href={activity.repository.url} target="_blank" rel="noreferrer">Abrir repositório <ExternalLink size={13}/></a>}</div>
  </article>;
}
function descriptionFor(page) {
  return ({ Equipe: 'Pessoas, responsabilidades e capacidade de trabalho.', Relatórios: 'Acompanhe os indicadores que movem sua agência.', Metas: 'Defina objetivos e acompanhe o progresso da agência.', Configurações: 'Gerencie os dados e as preferências do seu workspace.', 'Portal do cliente': 'Veja a experiência de acompanhamento compartilhada com seus clientes.', Repositórios: 'Repositórios, commits e deploys ligados aos projetos.' })[page] || 'Gestão da agência';
}

function AdminStat({ icon: Icon, label, value, hint, tone }) { return <article className="admin-stat"><span className={`admin-stat-icon ${tone}`}><Icon size={18} /></span><span className="admin-stat-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span></article>; }
function Avatar({ initials, tone = 'blue', small = false }) { return <span className={`admin-avatar tone-${tone} ${small ? 'small' : ''}`}>{initials}</span>; }
function BriefcaseIcon(props) { return <FileText {...props} />; }
