import React, { useState } from 'react';
import {
  ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, FileText, MoreHorizontal, Plus, Search,
  Sparkles, Target, Users, Zap,
} from 'lucide-react';
import './admin.css';
import './repositories.css';
import SettingsScreen from './SettingsScreen.jsx';
import GoalsScreen from './GoalsScreen.jsx';
import ReportsScreen from './ReportsScreen.jsx';
import TeamScreen from './TeamScreen.jsx';
import { ClientPortalAdmin } from './ClientPortalScreens.jsx';

const team = [
  { name: 'Gustavo Silva', role: 'Direção e desenvolvimento', initials: 'GS', tone: 'teal', load: 78, projects: 4 },
  { name: 'Ana Martins', role: 'Design e conteúdo', initials: 'AM', tone: 'lilac', load: 64, projects: 3 },
  { name: 'Lucas Costa', role: 'Desenvolvimento', initials: 'LC', tone: 'blue', load: 89, projects: 5 },
  { name: 'Rafaela Nunes', role: 'Atendimento e mídia', initials: 'RN', tone: 'rose', load: 52, projects: 2 },
];

const reportBars = [32, 45, 39, 62, 51, 72, 58, 82, 65, 90, 74, 100];
const repositorySeed = [
  { name:'vidamais-site', owner:'nexo-agencia', project:'Site institucional · Clínica VidaMais', branch:'main', commit:'Ajusta responsividade da homepage', time:'há 18 min', status:'Deploy concluído', tone:'green' },
  { name:'novaera-landing', owner:'nexo-agencia', project:'Landing page · NovaEra Imóveis', branch:'main', commit:'Atualiza formulário de contato', time:'há 2 h', status:'Deploy concluído', tone:'green' },
  { name:'doce-ponto-brand', owner:'nexo-agencia', project:'Identidade visual · Doce Ponto', branch:'develop', commit:'Adiciona variações do logotipo', time:'ontem', status:'Revisão pendente', tone:'amber' },
];

export default function AdminScreen({ page }) {
  const [tab, setTab] = useState('Geral');
  const [notice, setNotice] = useState('');
  const [repos, setRepos] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('nexo.repositories.v1') || 'null'); return Array.isArray(saved) ? saved : repositorySeed; } catch { return repositorySeed; } });
  const [repoModal, setRepoModal] = useState(false);
  const [repoDraft, setRepoDraft] = useState({ name: '', owner: '', project: '', branch: 'main' });
  const [activeRepo, setActiveRepo] = useState('');
  const saveRepos = (next) => { setRepos(next); localStorage.setItem('nexo.repositories.v1', JSON.stringify(next)); };
  const addRepo = (event) => { event.preventDefault(); if (!repoDraft.name.trim() || !repoDraft.owner.trim()) return; saveRepos([{ ...repoDraft, name: repoDraft.name.trim(), owner: repoDraft.owner.trim(), project: repoDraft.project || 'Projeto não vinculado', commit: 'Repositório cadastrado localmente', time: 'agora', status: 'Aguardando conexão', tone: 'amber' }, ...repos]); setRepoDraft({ name: '', owner: '', project: '', branch: 'main' }); setRepoModal(false); notify('Repositório registrado localmente.'); };
  const notify = (text) => { setNotice(text); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setNotice(''), 2600); };

  return <main className="admin-screen">
    <header className="admin-heading">
      <div><div className="admin-breadcrumb">NEXO <ChevronRight size={13} /> GESTÃO</div><span className="admin-eyebrow">ESPAÇO DE GESTÃO</span><h1>{page}</h1><p>{descriptionFor(page)}</p></div>
      {!['Configurações', 'Metas', 'Relatórios', 'Equipe', 'Portal do cliente'].includes(page) && <button className="admin-primary" onClick={() => page === 'Repositórios' ? setRepoModal(true) : notify('Relatório atualizado.')}><Plus size={16} />{page === 'Repositórios' ? 'Conectar repositório' : 'Novo relatório'}</button>}
    </header>

    {page === 'Equipe' && <TeamScreen notify={notify} />}

    {page === 'Repositórios' && <>
      <section className="admin-stats"><AdminStat icon={FileText} label="Repositórios cadastrados" value={String(repos.length)} hint="em projetos da agência" tone="blue" /><AdminStat icon={Zap} label="Deploys simulados" value={String(repos.filter((repo) => repo.status.includes('simulado') || repo.status.includes('concluído')).length)} hint="nenhum deploy externo executado" tone="green" /><AdminStat icon={CheckCircle2} label="Prontos para integrar" value={String(repos.filter((repo) => repo.status.includes('Aguardando')).length)} hint="GitHub ainda não conectado" tone="violet" /></section>
      <section className="admin-panel"><div className="admin-panel-head"><div><h2>Repositórios GitHub</h2><p>Cadastre os projetos e simule ações enquanto a integração não está conectada.</p></div><button className="admin-secondary" onClick={() => setRepoModal(true)}><Plus size={14}/>Adicionar repositório</button></div><div className="repo-grid">{repos.map((repo)=><article className="repo-card" key={repo.name}><div className="repo-card-head"><span className="repo-mark">GH</span><button className="admin-icon-button" aria-label={`Remover ${repo.name}`} onClick={()=>{if(!window.confirm(`Remover ${repo.name} do cadastro local?`))return;saveRepos(repos.filter((item)=>item.name!==repo.name));notify('Repositório removido.');}}><MoreHorizontal size={18}/></button></div><h3>{repo.name}</h3><small>{repo.owner} / {repo.project}</small><div className="repo-branch"><span>⑂ {repo.branch}</span><span>Último commit · {repo.time}</span></div><p>{repo.commit}</p><span className={`repo-status ${repo.tone}`}><i/>{repo.status}</span><div className="repo-card-actions"><button className="repo-open" onClick={()=>setActiveRepo(activeRepo===repo.name?'':repo.name)}>Ver atividade <ArrowRight size={14}/></button><button className="repo-open" onClick={()=>{saveRepos(repos.map((item)=>item.name===repo.name?{...item,status:'Deploy simulado · não publicado',tone:'amber',time:'agora'}:item));notify(`Simulação local preparada para ${repo.name}; nenhum deploy foi feito.`);}}>Simular deploy <Zap size={13}/></button></div>{activeRepo===repo.name&&<div className="repo-activity-detail"><b>{repo.owner}/{repo.name}</b><span>Branch: {repo.branch}</span><span>Último commit: {repo.commit}</span><small>Atividade demonstrativa. Conecte o GitHub para receber dados reais.</small></div>}</article>)}</div></section>
      {repoModal&&<div className="repo-modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setRepoModal(false);}}><form className="repo-modal" onSubmit={addRepo}><header><div><small>OPERAÇÕES · GITHUB</small><h2>Adicionar repositório</h2></div><button type="button" onClick={()=>setRepoModal(false)} aria-label="Fechar">×</button></header><label>Nome do repositório<input autoFocus required value={repoDraft.name} onChange={(e)=>setRepoDraft({...repoDraft,name:e.target.value})} placeholder="site-do-cliente"/></label><label>Usuário ou organização<input required value={repoDraft.owner} onChange={(e)=>setRepoDraft({...repoDraft,owner:e.target.value})} placeholder="minha-agencia"/></label><label>Projeto relacionado<input value={repoDraft.project} onChange={(e)=>setRepoDraft({...repoDraft,project:e.target.value})} placeholder="Site institucional · Cliente"/></label><label>Branch principal<input value={repoDraft.branch} onChange={(e)=>setRepoDraft({...repoDraft,branch:e.target.value})}/></label><p>Registro local. Nenhum acesso ao GitHub foi autorizado.</p><footer><button className="admin-secondary" type="button" onClick={()=>setRepoModal(false)}>Cancelar</button><button className="admin-primary" type="submit">Salvar repositório</button></footer></form></div>}
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
