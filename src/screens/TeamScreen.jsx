import React, { useMemo, useState } from 'react';
import { useWorkspaceRecords } from '../lib/workspace-api.js';
import { Check, Mail, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react';
import './team.css';




export default function TeamScreen({ notify }) {
  const { records: people, create, update, remove: deleteRecord } = useWorkspaceRecords('team');
  const [filter, setFilter] = useState('Todos');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ name: '', email: '', role: 'Membro da equipe', title: '', load: '0' });
  const activeCount = people.filter((person) => person.status === 'Ativo').length;
  const pendingCount = people.filter((person) => person.status === 'Convite pendente').length;
  const averageLoad = activeCount ? Math.round(people.filter((person) => person.status === 'Ativo').reduce((sum, person) => sum + Number(person.load || 0), 0) / activeCount) : 0;
  const visible = useMemo(() => people.filter((person) => (filter === 'Todos' || person.status === filter) && `${person.name} ${person.email} ${person.title}`.toLowerCase().includes(query.toLowerCase())), [people, filter, query]);
  const persist = async (next) => { try { for (const person of next) { const old = people.find((item) => item.id === person.id); const payload = Object.fromEntries(Object.entries(person).filter(([key]) => !['id','createdAt','updatedAt'].includes(key))); if (!old) await create(payload); else if (JSON.stringify(old) !== JSON.stringify(person)) await update(person.id, payload); } for (const old of people) if (!next.some((person) => person.id === old.id)) await deleteRecord(old.id); } catch (error) { window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: error.message })); } };
  const openNew = () => { setEditing(null); setDraft({ name: '', email: '', role: 'Membro da equipe', title: '', load: '0' }); setDialog(true); };
  const openEdit = (person) => { setEditing(person.id); setDraft({ name: person.name, email: person.email, role: person.role, title: person.title, load: String(person.load) }); setDialog(true); };
  const savePerson = (event) => {
    event.preventDefault();
    const name = draft.name.trim(); const email = draft.email.trim().toLowerCase();
    if (!name || !email) return;
    if (people.some((person) => person.email.toLowerCase() === email && person.id !== editing)) { notify('Este e-mail já está cadastrado na equipe.'); return; }
    if (editing) {
      persist(people.map((person) => person.id === editing ? { ...person, name, email, role: draft.role, title: draft.title.trim(), load: Number(draft.load) || 0, initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() } : person));
      notify('Dados e permissões atualizados.');
    } else {
      const next = [{ id: globalThis.crypto?.randomUUID?.() || `person-${Date.now()}`, name, email, role: draft.role, title: draft.title.trim() || draft.role, initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), tone: 'blue', load: Number(draft.load) || 0, projects: 0, status: 'Convite pendente' }, ...people];
      persist(next); notify(`Cadastro salvo para ${email}. O convite por e-mail ainda não foi enviado.`);
    }
    setDialog(false);
  };
  const toggleStatus = (person) => {
    const nextStatus = person.status === 'Ativo' ? 'Inativo' : 'Ativo';
    persist(people.map((entry) => entry.id === person.id ? { ...entry, status: nextStatus } : entry));
    notify(`${person.name}: acesso ${nextStatus.toLowerCase()}.`);
  };
  const remove = (person) => {
    if (person.role === 'Proprietário') { notify('O proprietário principal não pode ser removido.'); return; }
    if (!window.confirm(`Remover ${person.name} da equipe?`)) return;
    persist(people.filter((entry) => entry.id !== person.id)); notify(`${person.name} foi removido da equipe.`);
  };
  const resend = (person) => notify('Envio de convite por e-mail ainda não está conectado.');

  return <div className="team-module">
    <section className="team-summary"><TeamStat icon={Users} label="Pessoas ativas" value={String(activeCount).padStart(2, '0')} detail="com acesso ao workspace" /><TeamStat icon={Mail} label="Convites pendentes" value={String(pendingCount).padStart(2, '0')} detail="aguardando entrada" /><TeamStat icon={UserRound} label="Carga média" value={`${averageLoad}%`} detail="capacidade registrada" /></section>
    <section className="team-directory"><header className="team-directory-head"><div><h2>Pessoas e acessos</h2><p>Gerencie quem participa da operação da agência.</p></div><button className="admin-primary" onClick={openNew}><Plus size={15} />Convidar pessoa</button></header>
      <div className="team-directory-controls"><div className="team-filter-tabs">{['Todos', 'Ativo', 'Convite pendente', 'Inativo'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="team-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail ou função" /></label></div>
      <div className="team-directory-table"><div className="team-directory-row team-directory-labels"><span>Pessoa</span><span>Papel</span><span>Projetos</span><span>Carga semanal</span><span>Status</span><span>Ações</span></div>
        {visible.map((person) => <div className="team-directory-row" key={person.id}><div className="team-directory-person"><span className={`admin-avatar tone-${person.tone}`}>{person.initials}</span><span><b>{person.name}</b><small>{person.email}</small></span></div><div className="team-role-cell"><b>{person.role}</b><small>{person.title}</small></div><span className="team-number-cell">{person.projects} projetos</span><div className="team-load"><div><i style={{ width: `${Math.max(0, Math.min(100, person.load))}%` }} /></div><small>{person.load}%</small></div><span className={`team-member-status ${person.status === 'Ativo' ? 'active' : person.status === 'Convite pendente' ? 'pending' : ''}`}><i />{person.status}</span><div className="team-row-menu"><button aria-label={`Editar ${person.name}`} onClick={() => openEdit(person)}><Pencil size={14} /></button>{person.status === 'Convite pendente' ? <button aria-label={`Reenviar convite para ${person.name}`} onClick={() => resend(person)}><Mail size={14} /></button> : <button aria-label={`${person.status === 'Ativo' ? 'Desativar' : 'Ativar'} acesso de ${person.name}`} onClick={() => toggleStatus(person)}><ShieldCheck size={14} /></button>}<button aria-label={`Remover ${person.name}`} onClick={() => remove(person)}><Trash2 size={14} /></button></div></div>)}
        {!visible.length && <div className="team-empty">Ninguém encontrado com esses filtros.</div>}
      </div>
    </section>
    <div className="team-guidance"><ShieldCheck size={16} /><span><b>Acesso por função.</b> Alterar papéis muda o que cada pessoa poderá ver quando a autenticação e as permissões do servidor forem implementadas.</span></div>
    {dialog && <div className="team-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(false); }}><form className="team-modal" onSubmit={savePerson}><header><div><span className="admin-eyebrow">EQUIPE DO WORKSPACE</span><h2>{editing ? 'Editar pessoa' : 'Convidar pessoa'}</h2></div><button type="button" aria-label="Fechar" onClick={() => setDialog(false)}><X size={17} /></button></header><div className="team-modal-fields"><label>Nome completo<input autoFocus required maxLength="80" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>E-mail de trabalho<input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="nome@empresa.com" /></label><label>Papel de acesso<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}><option>Membro da equipe</option><option>Administrador</option><option>Somente leitura</option>{editing && <option>Proprietário</option>}</select></label><label>Função na agência<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Desenvolvimento" /></label><label>Carga semanal estimada (%)<input type="number" min="0" max="100" value={draft.load} onChange={(event) => setDraft({ ...draft, load: event.target.value })} /></label></div><p className="team-modal-note">{editing ? 'As alterações ficam salvas neste navegador.' : 'Será criado um convite pendente. O e-mail de convite será ligado ao backend depois.'}</p><footer><button type="button" className="admin-secondary" onClick={() => setDialog(false)}>Cancelar</button><button type="submit" className="admin-primary"><Check size={14} />{editing ? 'Salvar pessoa' : 'Preparar convite'}</button></footer></form></div>}
  </div>;
}

function TeamStat({ icon: Icon, label, value, detail }) { return <article className="team-summary-card"><span><Icon size={17} /></span><div><small>{label}</small><b>{value}</b><em>{detail}</em></div></article>; }
