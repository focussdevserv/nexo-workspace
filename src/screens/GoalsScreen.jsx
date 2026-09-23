import React, { useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, Check, CircleDollarSign, Clock3, Flag, Pencil, Plus, Target, Trash2, TrendingUp, Users, X } from 'lucide-react';
import './goals.css';

const KEY = 'nexo.workspace.goals.v1';
const seed = [
  { id: 'revenue', name: 'Receita fechada', group: 'Financeiro', current: 0, target: 25000, unit: 'BRL', period: 'month', color: 'green' },
  { id: 'leads', name: 'Novos clientes', group: 'Comercial', current: 0, target: 6, unit: 'number', period: 'month', color: 'blue' },
  { id: 'projects', name: 'Projetos entregues', group: 'Projetos', current: 0, target: 8, unit: 'number', period: 'month', color: 'violet' },
];
const icons = { Financeiro: CircleDollarSign, Comercial: Users, Projetos: Flag, Operação: Activity };
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value) || 0);
const number = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(value) || 0);
function readGoals() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* use initial goal templates */ }
  return seed;
}

export default function GoalsScreen({ notify }) {
  const [goals, setGoals] = useState(readGoals);
  const [period, setPeriod] = useState('month');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', group: 'Comercial', current: '0', target: '', unit: 'number' });
  const [savedAt, setSavedAt] = useState('');
  const [dirty, setDirty] = useState(false);
  const visibleGoals = useMemo(() => goals.filter((goal) => goal.period === period), [goals, period]);
  const totalProgress = visibleGoals.length ? Math.round(visibleGoals.reduce((sum, goal) => sum + Math.min(100, Number(goal.current) / Math.max(1, Number(goal.target)) * 100), 0) / visibleGoals.length) : 0;
  const achieved = visibleGoals.filter((goal) => Number(goal.current) >= Number(goal.target)).length;
  const revenue = visibleGoals.filter((goal) => goal.unit === 'BRL').reduce((sum, goal) => sum + Number(goal.current), 0);

  const save = (nextGoals = goals) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(nextGoals));
      setGoals(nextGoals); setDirty(false); setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      notify('Metas salvas neste navegador.');
    } catch { notify('Não foi possível salvar as metas neste navegador.'); }
  };
  const openNew = () => { setEditing(null); setFormError(''); setForm({ name: '', group: 'Comercial', current: '0', target: '', unit: 'number' }); setShowForm(true); };
  const openEdit = (goal) => { setEditing(goal.id); setFormError(''); setForm({ name: goal.name, group: goal.group, current: String(goal.current), target: String(goal.target), unit: goal.unit }); setShowForm(true); };
  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || Number(form.target) <= 0) { setFormError('Informe um nome e uma meta maior que zero.'); return; }
    const existing = goals.find((goal) => goal.id === editing);
    const newId = globalThis.crypto?.randomUUID?.() || `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item = { id: editing || newId, name: form.name.trim(), group: form.group, current: Number(form.current) || 0, target: Number(form.target), unit: form.unit, period, color: existing?.color || (form.group === 'Financeiro' ? 'green' : form.group === 'Projetos' ? 'violet' : 'blue') };
    const next = editing ? goals.map((goal) => goal.id === editing ? item : goal) : [item, ...goals];
    setGoals(next); setDirty(true); setShowForm(false); setFormError('');
  };
  const updateProgress = (goal, direction) => {
    const step = goal.unit === 'BRL' ? 500 : 1;
    const next = goals.map((item) => item.id === goal.id ? { ...item, current: Math.max(0, Number(item.current) + (direction * step)) } : item);
    setGoals(next); setDirty(true);
  };
  const removeGoal = (goal) => {
    if (!window.confirm(`Excluir a meta “${goal.name}”?`)) return;
    setGoals((current) => current.filter((item) => item.id !== goal.id)); setDirty(true);
  };
  const periodLabel = period === 'month' ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()) : 'semana atual';

  return <div className="goals-module">
    <div className="goals-toolbar"><div className="goals-period"><button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>Esta semana</button><button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Este mês</button></div><div className="goals-actions"><span className={`goals-saved ${dirty ? 'pending' : ''}`}><i />{dirty ? 'Alterações não salvas' : savedAt ? `Salvo às ${savedAt}` : 'Salve para registrar'}</span><button className="admin-secondary" onClick={openNew}><Plus size={14} /> Nova meta</button><button className="admin-primary" onClick={() => save()}><Check size={14} /> Salvar metas</button></div></div>

    <section className="goals-summary"><div className="goals-summary-main"><div className="goals-summary-title"><span className="goals-icon-main"><Target size={19} /></span><span><small>PROGRESSO GERAL · {periodLabel}</small><b>Seu foco para este período</b></span></div><div className="goals-total"><strong>{totalProgress}%</strong><span>de progresso médio</span></div><div className="goals-progress-track"><i style={{ width: `${totalProgress}%` }} /></div><div className="goals-summary-foot"><span>{achieved} de {visibleGoals.length} metas atingidas</span><span>{money(revenue)} em receita registrada</span></div></div><div className="goals-summary-side"><span className="goals-summary-side-icon"><TrendingUp size={19} /></span><b>{visibleGoals.length ? 'Acompanhe seu ritmo' : 'Comece definindo uma meta'}</b><p>{visibleGoals.length ? 'Atualize os resultados conforme sua equipe avança.' : 'Crie objetivos para acompanhar receita, clientes e entregas.'}</p><span className="goals-period-label"><Clock3 size={13} /> {periodLabel}</span></div></section>

    <div className="goals-list-head"><div><h2>Metas do período</h2><p>Atualize os resultados manualmente; a integração com seus módulos vem na sequência.</p></div><span>{visibleGoals.length} {visibleGoals.length === 1 ? 'meta' : 'metas'}</span></div>
    {visibleGoals.length ? <section className="goals-grid">{visibleGoals.map((goal) => {
      const Icon = icons[goal.group] || Target;
      const progress = Math.min(100, Math.round(Number(goal.current) / Math.max(1, Number(goal.target)) * 100));
      const complete = Number(goal.current) >= Number(goal.target);
      return <article className={`goal-item ${goal.color}`} key={goal.id}>
        <div className="goal-item-head"><span className="goal-item-icon"><Icon size={17} /></span><div className="goal-item-menu"><button aria-label={`Editar meta ${goal.name}`} onClick={() => openEdit(goal)}><Pencil size={14} /></button><button aria-label={`Excluir meta ${goal.name}`} onClick={() => removeGoal(goal)}><Trash2 size={14} /></button></div></div>
        <span className="goal-item-group">{goal.group}</span><h3>{goal.name}</h3>
        <div className="goal-item-numbers"><strong>{goal.unit === 'BRL' ? money(goal.current) : number(goal.current)}</strong><span>de {goal.unit === 'BRL' ? money(goal.target) : number(goal.target)}</span></div>
        <div className="goal-item-track"><i style={{ width: `${progress}%` }} /></div>
        <div className="goal-item-footer"><span className={complete ? 'complete' : ''}>{complete ? <Check size={13} /> : null}{complete ? 'Meta atingida' : `${progress}% concluído`}</span><div><button aria-label={`Reduzir resultado de ${goal.name}`} onClick={() => updateProgress(goal, -1)}><ArrowDown size={13} /></button><button aria-label={`Aumentar resultado de ${goal.name}`} onClick={() => updateProgress(goal, 1)}><ArrowUp size={13} /></button></div></div>
      </article>;
    })}</section> : <div className="goals-empty"><span><Target size={22} /></span><b>Nenhuma meta neste período</b><p>Adicione uma meta para acompanhar o progresso da agência.</p><button className="admin-primary" onClick={openNew}><Plus size={14} /> Criar primeira meta</button></div>}

    <div className="goals-note"><Activity size={15} /><span><b>Os resultados ainda são manuais.</b> Quando Financeiro, CRM e Projetos tiverem dados reais, conectaremos estas metas aos indicadores automaticamente.</span></div>

    {showForm && <div className="goal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><form className="goal-modal" onSubmit={submit} aria-labelledby="goal-modal-title"><header><div><span className="admin-eyebrow">OBJETIVO DO PERÍODO</span><h2 id="goal-modal-title">{editing ? 'Editar meta' : 'Criar meta'}</h2></div><button type="button" aria-label="Fechar" onClick={() => setShowForm(false)}><X size={17} /></button></header><label>Nome da meta<input autoFocus required maxLength="60" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormError(''); }} placeholder="Ex.: Fechar novos contratos" /></label><div className="goal-modal-fields"><label>Área<select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}><option>Comercial</option><option>Financeiro</option><option>Projetos</option><option>Operação</option></select></label><label>Tipo de resultado<select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option value="number">Quantidade</option><option value="BRL">Valor em reais</option></select></label><label>Resultado atual<input type="number" min="0" step={form.unit === 'BRL' ? '0.01' : '1'} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></label><label>Meta do período<input required type="number" min="0.01" step={form.unit === 'BRL' ? '0.01' : '1'} value={form.target} onChange={(e) => { setForm({ ...form, target: e.target.value }); setFormError(''); }} placeholder="Ex.: 10" /></label></div>{formError && <p className="goal-form-error" role="alert">{formError}</p>}<footer><button type="button" className="admin-secondary" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="admin-primary" onClick={(event) => { event.preventDefault(); submit(event); }}><Check size={14} /> {editing ? 'Salvar meta' : 'Criar meta'}</button></footer></form></div>}
  </div>;
}
