import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAllRecords, useWorkspaceRecords } from '../lib/workspace-api.js';
import { confirmWorkspaceDelete, useWorkspacePreferences } from '../lib/workspace-preferences.js';
import { formatWorkspaceCurrency, formatWorkspaceDate, formatWorkspaceNumber } from '../lib/workspace-formatting.js';
import { calculateGoalMetric, calculateGoalsSummary, goalMetricDefinitions } from '../lib/goal-metrics.js';
import { guardGoalsNavigation } from '../lib/goals-navigation.js';
import { createLatestRequestGuard } from '../lib/latest-request.js';
import { goalSourceErrorState } from '../lib/goal-source-error.js';
import { Activity, ArrowDown, ArrowUp, Check, CircleDollarSign, Clock3, Flag, Pencil, Plus, Target, Trash2, TrendingUp, Users, X } from 'lucide-react';
import './goals.css';

const icons = { Financeiro: CircleDollarSign, Comercial: Users, Projetos: Flag, Operação: Activity };
const money = (value, preferences) => formatWorkspaceCurrency(value, preferences, { maximumFractionDigits: 2 });
const number = (value, preferences) => formatWorkspaceNumber(value, preferences, { maximumFractionDigits: 1 });
const safeCurrent = (goal) => Number.isFinite(Number(goal.current)) ? Math.max(0, Number(goal.current)) : 0;
const safeTarget = (goal) => Number.isFinite(Number(goal.target)) && Number(goal.target) > 0 ? Number(goal.target) : 0;
const sourcePaths = { leads: '/api/workspace/leads', projects: '/api/workspace/projects', hours: '/api/workspace/hours', revenues: '/api/workspace/revenues', orders: '/api/billing/orders' };
const groupMetrics = { Comercial: ['manual', 'won_leads'], Financeiro: ['manual', 'paid_revenue'], Projetos: ['manual', 'completed_projects'], 'Opera\u00e7\u00e3o': ['manual', 'registered_hours'] };


export default function GoalsScreen({ notify }) {
  const { records: savedGoals, loading, error, refresh, create, update, remove: deleteRecord } = useWorkspaceRecords('goals');
  const preferences = useWorkspacePreferences();
  const [metricData, setMetricData] = useState({});
  const metricsRequestGuard = useRef(null);
  if (!metricsRequestGuard.current) metricsRequestGuard.current = createLatestRequestGuard();
  const [metricStates, setMetricStates] = useState(Object.fromEntries(Object.keys(sourcePaths).map((key) => [key, 'loading'])));
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [draftGoals, setDraftGoals] = useState(null);
  const goals = draftGoals || savedGoals;
  const setGoals = (value) => setDraftGoals((current) => typeof value === 'function' ? value(current || savedGoals) : value);
  const [period, setPeriod] = useState('month');
  const [showForm, setShowForm] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const goalDialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', group: 'Comercial', metric: 'manual', current: '0', target: '', unit: 'number' });
  const [savedAt, setSavedAt] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!showForm) return undefined;
    const dialog = goalDialogRef.current;
    const firstControl = dialog?.querySelector('input:not([readonly]), select, button');
    firstControl?.focus();
    return () => returnFocusRef.current?.focus?.();
  }, [showForm]);
  useEffect(() => {
    const confirmNavigation = (event) => {
      guardGoalsNavigation(event, { dirty, confirmLeave: (message) => window.confirm(message) });
    };
    const confirmClose = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('nexo:before-navigate', confirmNavigation);
    window.addEventListener('beforeunload', confirmClose);
    return () => {
      window.removeEventListener('nexo:before-navigate', confirmNavigation);
      window.removeEventListener('beforeunload', confirmClose);
    };
  }, [dirty]);
  const refreshMetrics = async () => {
    const requestId = metricsRequestGuard.current.begin();
    setMetricsLoading(true);
    setMetricStates(Object.fromEntries(Object.keys(sourcePaths).map((key) => [key, 'loading'])));
    const entries = await Promise.all(Object.entries(sourcePaths).map(async ([key, path]) => {
      try { return [key, await fetchAllRecords(path), 'ready']; }
      catch (err) { return [key, [], goalSourceErrorState(err)]; }
    }));
    if (!metricsRequestGuard.current.isCurrent(requestId)) return;
    setMetricData(Object.fromEntries(entries.map(([key, data]) => [key, data])));
    setMetricStates(Object.fromEntries(entries.map(([key, , state]) => [key, state])));
    setMetricsLoading(false);
  };
  useEffect(() => {
    refreshMetrics();
    return () => metricsRequestGuard.current.invalidate();
  }, []);
  const metricResult = (goal) => calculateGoalMetric(goal.metric || 'manual', metricData, metricStates, goal.period || period, new Date(), preferences);
  const goalCurrent = (goal) => goal.metric && goal.metric !== 'manual' ? metricResult(goal).value : safeCurrent(goal);
  const goalProgress = (goal) => { const current = goalCurrent(goal); return current === null ? null : safeTarget(goal) ? Math.max(0, Math.min(100, Math.round(current / safeTarget(goal) * 100))) : 0; };
  const currentLabel = (goal) => { const result = metricResult(goal); if (!goal.metric || goal.metric === 'manual') return goal.unit === 'BRL' ? money(safeCurrent(goal), preferences) : number(safeCurrent(goal), preferences); if (result.state === 'loading') return 'Carregando…'; if (result.state === 'restricted') return 'Sem acesso'; if (result.state !== 'ready') return 'Indisponível'; return goal.unit === 'BRL' ? money(result.value, preferences) : `${number(result.value, preferences)}${goal.unit === 'hours' ? ' h' : ''}`; };
  const visibleGoals = useMemo(() => goals.filter((goal) => goal.period === period), [goals, period]);
  const summary = calculateGoalsSummary(goals, metricData, metricStates, period, new Date(), preferences);
  const totalProgress = summary.averageProgress;
  const achieved = summary.achieved;
  // This summary is workspace revenue, not the sum of user-defined financial
  // goals (which may be manual or may duplicate the same revenue indicator).

  const save = async (nextGoals = goals) => {
    if (saving) return;
    if (loading || error) { notify('Recarregue as metas antes de salvar para evitar sobrescrever dados existentes.'); return; }
    setSaving(true);
    const persistedGoals = [...nextGoals];
    try {
      for (let index = 0; index < persistedGoals.length; index += 1) {
        const goal = persistedGoals[index];
        const existing = savedGoals.find((item) => item.id === goal.id);
        const payload = Object.fromEntries(Object.entries(goal).filter(([key]) => !['id','createdAt','updatedAt'].includes(key)));
        if (!existing) persistedGoals[index] = await create(payload);
        else if (JSON.stringify(existing) !== JSON.stringify(goal)) persistedGoals[index] = await update(goal.id, payload);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(goal)) setDraftGoals([...persistedGoals]);
      }
      for (const old of savedGoals) if (!persistedGoals.some((goal) => goal.id === old.id)) await deleteRecord(old.id);
      setDraftGoals(null); setDirty(false); setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })); notify('Metas salvas no workspace.');
    } catch (error) { setDraftGoals(persistedGoals); setDirty(true); notify(error.message || 'Não foi possível salvar as metas. As alterações continuam abertas para você tentar novamente.'); }
    finally { setSaving(false); }
  };
  const openNew = () => { returnFocusRef.current = document.activeElement; setEditing(null); setFormError(''); setFormDirty(false); setForm({ name: '', group: 'Comercial', metric: 'manual', current: '0', target: '', unit: 'number' }); setShowForm(true); };
  const openEdit = (goal) => { returnFocusRef.current = document.activeElement; setEditing(goal.id); setFormError(''); setFormDirty(false); setForm({ name: goal.name, group: goal.group, metric: goal.metric || 'manual', current: String(goal.current), target: String(goal.target), unit: goal.unit }); setShowForm(true); };
  const closeForm = () => {
    if (saving) return;
    if (formDirty && !window.confirm('Você tem alterações nesta meta que ainda não foram aplicadas. Fechar e descartar essas alterações?')) return;
    setShowForm(false);
    setFormDirty(false);
    setFormError('');
  };
  const handleGoalDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeForm();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(goalDialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') || [])];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !goalDialogRef.current?.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !goalDialogRef.current?.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };
  const submit = (event) => {
    event.preventDefault();
    const current = form.metric === 'manual' ? Number(form.current) : 0; const target = Number(form.target);
    if (!form.name.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0) { setFormError('Informe um nome, um resultado atual igual ou maior que zero e uma meta maior que zero.'); return; }
    const existing = goals.find((goal) => goal.id === editing);
    const newId = globalThis.crypto?.randomUUID?.() || `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item = { id: editing || newId, name: form.name.trim(), group: form.group, metric: form.metric, current, target, unit: form.metric === 'manual' ? form.unit : goalMetricDefinitions[form.metric].unit, period, color: existing?.color || (form.group === 'Financeiro' ? 'green' : form.group === 'Projetos' ? 'violet' : 'blue') };
    const next = editing ? goals.map((goal) => goal.id === editing ? item : goal) : [item, ...goals];
    setGoals(next); setDirty(true); setShowForm(false); setFormDirty(false); setFormError('');
  };
  const updateProgress = (goal, direction) => {
    if (goal.metric && goal.metric !== 'manual') return;
    const step = goal.unit === 'BRL' ? 500 : 1;
    const next = goals.map((item) => item.id === goal.id ? { ...item, current: Math.max(0, safeCurrent(item) + (direction * step)) } : item);
    setGoals(next); setDirty(true);
  };
  const removeGoal = (goal) => {
    if (!confirmWorkspaceDelete(`Excluir a meta “${goal.name}”?`, preferences)) return;
    setGoals((current) => current.filter((item) => item.id !== goal.id)); setDirty(true);
  };
  const periodLabel = period === 'month' ? formatWorkspaceDate(new Date(), preferences, { month: 'long', year: 'numeric', timeZone: preferences.timezone }) : 'semana atual';

  return <div className="goals-module">
    <div className="goals-toolbar"><div className="goals-period"><button type="button" className={period === 'week' ? 'active' : ''} disabled={saving || showForm} onClick={() => setPeriod('week')}>Esta semana</button><button type="button" className={period === 'month' ? 'active' : ''} disabled={saving || showForm} onClick={() => setPeriod('month')}>Este mês</button></div><div className="goals-actions"><span className={`goals-saved ${dirty ? 'pending' : ''}`} role="status"><i />{saving ? 'Salvando metas…' : dirty ? 'Alterações não salvas' : savedAt ? `Salvo às ${savedAt}` : 'Salve para registrar'}</span><button type="button" className="admin-secondary" disabled={loading || Boolean(error) || saving} onClick={openNew}><Plus size={14} /> Nova meta</button><button type="button" className="admin-primary" disabled={!dirty || loading || Boolean(error) || saving} onClick={() => save()}><Check size={14} /> {saving ? 'Salvando…' : 'Salvar metas'}</button></div></div>

    <section className="goals-summary"><div className="goals-summary-main"><div className="goals-summary-title"><span className="goals-icon-main"><Target size={19} /></span><span><small>PROGRESSO GERAL · {periodLabel}</small><b>Seu foco para este período</b></span></div><div className="goals-total"><strong>{totalProgress === null ? '—' : `${totalProgress}%`}</strong><span>{totalProgress === null && visibleGoals.length ? 'aguardando os dados das fontes' : 'de progresso médio'}</span></div><div className="goals-progress-track"><i style={{ width: `${totalProgress ?? 0}%` }} /></div><div className="goals-summary-foot"><span>{achieved} de {visibleGoals.length} metas atingidas</span><span>{summary.revenue.state === 'ready' ? money(summary.revenue.value, preferences) : '—'} em receita recebida</span></div></div><div className="goals-summary-side"><span className="goals-summary-side-icon"><TrendingUp size={19} /></span><b>{visibleGoals.length ? 'Acompanhe seu ritmo' : 'Comece definindo uma meta'}</b><p>{visibleGoals.length ? 'Atualize os resultados conforme sua equipe avança.' : 'Crie objetivos para acompanhar receita, clientes e entregas.'}</p><span className="goals-period-label"><Clock3 size={13} /> {periodLabel}</span></div></section>

    <div className="goals-list-head"><div><h2>Metas do período</h2><p>Resultados conectados ao Financeiro, CRM, Projetos e Horas ou atualizados manualmente.</p></div><span>{visibleGoals.length} {visibleGoals.length === 1 ? 'meta' : 'metas'}</span></div>
    {loading ? <div className="goals-empty" role="status">Carregando metas do workspace…</div> : error ? <div className="goals-empty" role="alert"><b>Não foi possível carregar as metas.</b><p>{error}</p><button className="admin-secondary" onClick={refresh}>Tentar novamente</button></div> : visibleGoals.length ? <section className="goals-grid">{visibleGoals.map((goal) => {
      const Icon = icons[goal.group] || Target;
      const progress = goalProgress(goal);
      const complete = progress !== null && safeTarget(goal) > 0 && goalCurrent(goal) >= safeTarget(goal);
      return <article className={`goal-item ${goal.color}`} key={goal.id}>
        <div className="goal-item-head"><span className="goal-item-icon"><Icon size={17} /></span><div className="goal-item-menu"><button type="button" disabled={saving} aria-label={`Editar meta ${goal.name}`} onClick={() => openEdit(goal)}><Pencil size={14} /></button><button type="button" disabled={saving} aria-label={`Excluir meta ${goal.name}`} onClick={() => removeGoal(goal)}><Trash2 size={14} /></button></div></div>
        <span className="goal-item-group">{goal.group}</span><h3>{goal.name}</h3>
        <div className="goal-item-numbers"><strong>{currentLabel(goal)}</strong><span>de {goal.unit === 'BRL' ? money(goal.target, preferences) : `${number(goal.target, preferences)}${goal.unit === 'hours' ? ' h' : ''}`}</span></div>
        <div className="goal-item-track"><i style={{ width: `${progress ?? 0}%` }} /></div>
        <div className="goal-item-footer"><span className={complete ? 'complete' : ''}>{complete ? <Check size={13} /> : null}{complete ? 'Meta atingida' : progress === null ? metricResult(goal).state === 'restricted' ? 'Sem acesso à fonte' : 'Dados indisponíveis' : `${progress}% concluído`}</span><div>{(!goal.metric || goal.metric === 'manual') && <><button type="button" disabled={saving} aria-label={`Reduzir resultado de ${goal.name}`} onClick={() => updateProgress(goal, -1)}><ArrowDown size={13} /></button><button type="button" disabled={saving} aria-label={`Aumentar resultado de ${goal.name}`} onClick={() => updateProgress(goal, 1)}><ArrowUp size={13} /></button></>}</div></div>
      </article>;
    })}</section> : <div className="goals-empty"><span><Target size={22} /></span><b>Nenhuma meta neste período</b><p>Adicione uma meta para acompanhar o progresso da agência.</p><button className="admin-primary" onClick={openNew}><Plus size={14} /> Criar primeira meta</button></div>}

    <div className="goals-note"><Activity size={15} /><span><b>Indicadores conectados aos módulos.</b> Receita usa cobranças recebidas, negócios ganhos vêm do CRM, entregas de Projetos e Horas de registros aprovados. Metas manuais continuam editáveis.</span><button type="button" className="admin-secondary" disabled={metricsLoading} onClick={refreshMetrics}>{metricsLoading ? 'Atualizando…' : 'Atualizar indicadores'}</button></div>

    {showForm && <div className="goal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}><form ref={goalDialogRef} className="goal-modal" role="dialog" aria-modal="true" onKeyDown={handleGoalDialogKeyDown} onSubmit={submit} aria-labelledby="goal-modal-title">
      <header><div><span className="admin-eyebrow">OBJETIVO DO PERÍODO</span><h2 id="goal-modal-title">{editing ? 'Editar meta' : 'Criar meta'}</h2></div><button type="button" disabled={saving} aria-label="Fechar" onClick={closeForm}><X size={17} /></button></header>
      <label>Nome da meta<input required maxLength="60" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormDirty(true); setFormError(''); }} placeholder="Ex.: Fechar novos contratos" /></label>
      <div className="goal-modal-fields">
        <label>Área<select value={form.group} onChange={(e) => { const group = e.target.value; const metric = groupMetrics[group][0]; setForm({ ...form, group, metric, unit: metric === 'manual' ? form.unit : goalMetricDefinitions[metric].unit }); setFormDirty(true); }}><option>Comercial</option><option>Financeiro</option><option>Projetos</option><option>Operação</option></select></label>
        <label>Indicador<select value={form.metric} onChange={(e) => { const metric = e.target.value; setForm({ ...form, metric, unit: metric === 'manual' ? form.unit : goalMetricDefinitions[metric].unit }); setFormDirty(true); }}><option value="manual">Atualizado manualmente</option>{groupMetrics[form.group].filter((metric) => metric !== 'manual').map((metric) => <option value={metric} key={metric}>{goalMetricDefinitions[metric].label}</option>)}</select></label>
        {form.metric === 'manual' ? <label>Unidade<select value={form.unit} onChange={(e) => { setForm({ ...form, unit: e.target.value }); setFormDirty(true); }}><option value="number">Quantidade</option><option value="BRL">Valor em reais</option></select></label> : <label>Resultado atual<input readOnly value={currentLabel({ metric: form.metric, unit: form.unit, period })} aria-describedby="goal-metric-help" /></label>}
        {form.metric === 'manual' && <label>Resultado atual<input type="number" min="0" step={form.unit === 'BRL' ? '0.01' : '1'} value={form.current} onChange={(e) => { setForm({ ...form, current: e.target.value }); setFormDirty(true); }} /></label>}
        <label>Meta do período<input required type="number" min="0.01" step={form.unit === 'BRL' ? '0.01' : '1'} value={form.target} onChange={(e) => { setForm({ ...form, target: e.target.value }); setFormDirty(true); setFormError(''); }} placeholder="Ex.: 10" /></label>
      </div>{form.metric !== 'manual' && <p id="goal-metric-help" className="goal-form-help">Resultado calculado com registros deste período. Atualize os indicadores para sincronizar.</p>}{formError && <p className="goal-form-error" role="alert">{formError}</p>}
      <footer><button type="button" className="admin-secondary" disabled={saving} onClick={closeForm}>Cancelar</button><button type="submit" className="admin-primary" disabled={saving}><Check size={14} /> {editing ? 'Salvar meta' : 'Criar meta'}</button></footer>
    </form></div>}
  </div>;
}
