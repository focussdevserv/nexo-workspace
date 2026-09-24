import React, { useState } from 'react';
import {
  ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, FileText, MoreHorizontal, Plus, Search,
  Sparkles, Target, Users, Zap,
} from 'lucide-react';
import './admin.css';
import './repositories.css';
import { useWorkspaceRecords } from '../lib/workspace-api.js';
import SettingsScreen from './SettingsScreen.jsx';
import GoalsScreen from './GoalsScreen.jsx';
import ReportsScreen from './ReportsScreen.jsx';
import TeamScreen from './TeamScreen.jsx';
import { ClientPortalAdmin } from './ClientPortalScreens.jsx';

const team = [];

const reportBars = [32, 45, 39, 62, 51, 72, 58, 82, 65, 90, 74, 100];
const repositorySeed = [];

export default function AdminScreen({ page }) {
  const [tab, setTab] = useState('Geral');
  const [notice, setNotice] = useState('');
  const { records: repos, create: createRepo, remove: deleteRepo } = useWorkspaceRecords('repositories');
  const [repoModal, setRepoModal] = useState(false);
  const [repoDraft, setRepoDraft] = useState({ name: '', owner: '', project: '', branch: 'main' });
  const addRepo = async (event) => { event.preventDefault(); if (!repoDraft.name.trim() || !repoDraft.owner.trim()) return; try { await createRepo({ ...repoDraft, name: repoDraft.name.trim(), owner: repoDraft.owner.trim(), project: repoDraft.project.trim(), status: 'Aguardando conexão' }); setRepoDraft({ name: '', owner: '', project: '', branch: 'main' }); setRepoModal(false); notify('Repositório cadastrado. Conecte a integração para sincronizar atividade e deploys.'); } catch (error) { notify(error.message || 'Não foi possível salvar o repositório.'); } };
  const notify = (text) => { setNotice(text); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setNotice(''), 2600); };

  return <main className="admin-screen">
    <header className="admin-heading">
      <div><div className="admin-breadcrumb">NEXO <ChevronRight size={13} /> GESTÃO</div><span className="admin-eyebrow">ESPAÇO DE GESTÃO</span><h1>{page}</h1><p>{descriptionFor(page)}</p></div>
      {!['Configurações', 'Metas', 'Relatórios', 'Equipe', 'Portal do cliente'].includes(page) && <button className="admin-primary" onClick={() => page === 'Repositórios' ? setRepoModal(true) : notify('Relatório atualizado.')}><Plus size={16} />{page === 'Repositórios' ? 'Conectar repositório' : 'Novo relatório'}</button>}
    </header>

    {page === 'Equipe' && <TeamScreen notify={notify} />}

    {page === 'Repositórios' && <>
      <section className="admin-stats"><AdminStat icon={FileText} label="Repositórios cadastrados" value={String(repos.length)} hint="registros salvos no workspace" tone="blue" /><AdminStat icon={Zap} label="GitHub" value="Não conectado" hint="commits e deploys indisponíveis" tone="green" /><AdminStat icon={CheckCircle2} label="Aguardando integração" value={String(repos.length)} hint="cadastros sem sincronização externa" tone="violet" /></section>
      <section className="admin-panel"><div className="admin-panel-head"><div><h2>Repositórios GitHub</h2><p>Registre repositórios para organizá-los. Commits, pull requests e deploys só aparecerão após conectar o GitHub.</p></div><button className="admin-secondary" onClick={() => setRepoModal(true)}><Plus size={14}/>Adicionar repositório</button></div><div className="repo-grid">{repos.map((repo)=><article className="repo-card" key={repo.id}><div className="repo-card-head"><span className="repo-mark">GH</span><button className="admin-icon-button" aria-label={`Remover ${repo.name}`} onClick={async()=>{if(!window.confirm(`Remover ${repo.name} do cadastro?`))return;try{await deleteRepo(repo.id);notify('Repositório removido.')}catch(error){notify(error.message)}}}><MoreHorizontal size={18}/></button></div><h3>{repo.name}</h3><small>{repo.owner}{repo.project ? ` / ${repo.project}` : ''}</small><div className="repo-branch"><span>⑂ {repo.branch || 'main'}</span><span>Sem atividade sincronizada</span></div><p>Conecte o GitHub para consultar commits, pull requests e deploys deste repositório.</p><span className="repo-status"><i/>Aguardando integração</span><div className="repo-card-actions"><button className="repo-open" onClick={()=>window.dispatchEvent(new CustomEvent('nexo:navigate',{detail:'Integrações'}))}>Configurar GitHub <ArrowRight size={14}/></button></div></article>)}{repos.length===0&&<div className="reports-no-data">Nenhum repositório cadastrado.</div>}</div></section>
      {repoModal&&<div className="repo-modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setRepoModal(false);}}><form className="repo-modal" onSubmit={addRepo}><header><div><small>OPERAÇÕES · GITHUB</small><h2>Adicionar repositório</h2></div><button type="button" onClick={()=>setRepoModal(false)} aria-label="Fechar">×</button></header><label>Nome do repositório<input autoFocus required value={repoDraft.name} onChange={(e)=>setRepoDraft({...repoDraft,name:e.target.value})} placeholder="site-do-cliente"/></label><label>Usuário ou organização<input required value={repoDraft.owner} onChange={(e)=>setRepoDraft({...repoDraft,owner:e.target.value})} placeholder="minha-agencia"/></label><label>Projeto relacionado<input value={repoDraft.project} onChange={(e)=>setRepoDraft({...repoDraft,project:e.target.value})} placeholder="Site institucional · Cliente"/></label><label>Branch principal<input value={repoDraft.branch} onChange={(e)=>setRepoDraft({...repoDraft,branch:e.target.value})}/></label><p>O cadastro fica salvo no workspace. A sincronização requer conectar o GitHub em Integrações.</p><footer><button className="admin-secondary" type="button" onClick={()=>setRepoModal(false)}>Cancelar</button><button className="admin-primary" type="submit">Salvar repositório</button></footer></form></div>}
    </>}

    {page === 'Relatórios' && <ReportsScreen notify={notify} />}

    {page === 'Metas' && <GoalsScreen notify={notify} />}

    {page === 'Configurações' && <SettingsScreen notify={notify} />}

    {page === 'Portal do cliente' && <ClientPortalAdmin notify={notify} />}

    {notice && <div className="admin-toast" role="status"><Check size={15} />{notice}</div>}
  </main>;
}

function descriptionFor(page) {
  return ({ Equipe: 'Pessoas, responsabilidades e capacidade de trabalho.', Relatórios: 'Acompanhe os indicadores que movem sua agência.', Metas: 'Defina objetivos e acompanhe o progresso da agência.', Configurações: 'Gerencie os dados e as preferências do seu workspace.', 'Portal do cliente': 'Veja a experiência de acompanhamento compartilhada com seus clientes.', Repositórios: 'Repositórios, commits e deploys ligados aos projetos.' })[page] || 'Gestão da agência';
}

function AdminStat({ icon: Icon, label, value, hint, tone }) { return <article className="admin-stat"><span className={`admin-stat-icon ${tone}`}><Icon size={18} /></span><span className="admin-stat-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span></article>; }
function Avatar({ initials, tone = 'blue', small = false }) { return <span className={`admin-avatar tone-${tone} ${small ? 'small' : ''}`}>{initials}</span>; }
function BriefcaseIcon(props) { return <FileText {...props} />; }
