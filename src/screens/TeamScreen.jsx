import React, { useMemo, useState } from 'react';
import { useWorkspaceRecords } from '../lib/workspace-api.js';
import { Check, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react';
import './team.css';




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
    if (!name || !email) return;
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
    <div className="team-guidance"><ShieldCheck size={16} /><span><b>Cadastro operacional.</b> Estas pessoas não recebem login nem acesso ao Nexo. Somente a conta proprietária autenticada pode entrar no workspace.</span></div>
    <section className="team-summary"><TeamStat icon={Users} label="Pessoas ativas" value={String(activeCount).padStart(2, '0')} detail="na operação" /><TeamStat icon={UserRound} label="Pessoas inativas" value={String(inactiveCount).padStart(2, '0')} detail="cadastros operacionais" /><TeamStat icon={ShieldCheck} label="Acesso ao Nexo" value="1" detail="somente proprietário" /></section>
    <section className="team-directory"><header className="team-directory-head"><div><h2>Equipe operacional</h2><p>Registre colaboradores para organizar tarefas e carga de trabalho. O cadastro não cria uma conta Nexo.</p></div><button className="admin-primary" onClick={openNew}><Plus size={15} />Adicionar pessoa</button></header>
      <div className="team-directory-controls"><div className="team-filter-tabs">{['Todos', 'Ativo', 'Inativo'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="team-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail ou função" /></label></div>
      <div className="team-directory-table"><div className="team-directory-row team-directory-labels"><span>Pessoa</span><span>Função</span><span>Projetos</span><span>Carga semanal</span><span>Situação</span><span>Ações</span></div>
        {visible.map((person) => { const status = person.status === 'Ativo' ? 'Ativo' : 'Inativo'; return <div className="team-directory-row" key={person.id}><div className="team-directory-person"><span className={`admin-avatar tone-${person.tone}`}>{person.initials}</span><span><b>{person.name}</b><small>{person.email}</small></span></div><div className="team-role-cell"><b>{person.title || person.role || 'Sem função definida'}</b><small>Função operacional</small></div><span className="team-number-cell">{person.projects || 0} projetos</span><div className="team-load"><div><i style={{ width: `${Math.max(0, Math.min(100, person.load))}%` }} /></div><small>{person.load}%</small></div><span className={`team-member-status ${status === 'Ativo' ? 'active' : ''}`}><i />{status}</span><div className="team-row-menu"><button aria-label={`Editar ${person.name}`} onClick={() => openEdit(person)}><Pencil size={14} /></button><button aria-label={`${status === 'Ativo' ? 'Inativar' : 'Ativar'} cadastro de ${person.name}`} onClick={() => toggleStatus({ ...person, status })}><ShieldCheck size={14} /></button><button aria-label={`Remover ${person.name}`} onClick={() => remove(person)}><Trash2 size={14} /></button></div></div>; })}
        {!visible.length && <div className="team-empty">Ninguém encontrado com esses filtros.</div>}
      </div>
    </section>
    {dialog && <div className="team-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(false); }}><form className="team-modal" onSubmit={savePerson}><header><div><span className="admin-eyebrow">EQUIPE OPERACIONAL</span><h2>{editing ? 'Editar cadastro' : 'Adicionar pessoa'}</h2></div><button type="button" aria-label="Fechar" onClick={() => setDialog(false)}><X size={17} /></button></header><div className="team-modal-fields"><label>Nome completo<input autoFocus required maxLength="80" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>E-mail de contato<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="nome@empresa.com" /></label><label>Função / especialidade<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Desenvolvimento" /></label><label>Carga semanal estimada (%)<input type="number" min="0" max="100" value={draft.load} onChange={(event) => setDraft({ ...draft, load: event.target.value })} /></label></div><p className="team-modal-note">Cadastro interno para organizar o trabalho. Nenhum convite de acesso será enviado.</p><footer><button type="button" className="admin-secondary" onClick={() => setDialog(false)}>Cancelar</button><button type="submit" className="admin-primary"><Check size={14} />{editing ? 'Salvar cadastro' : 'Adicionar pessoa'}</button></footer></form></div>}
  </div>;
}

function TeamStat({ icon: Icon, label, value, detail }) { return <article className="team-summary-card"><span><Icon size={17} /></span><div><small>{label}</small><b>{value}</b><em>{detail}</em></div></article>; }
