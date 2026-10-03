import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, ArrowUpRight, Check, CheckCircle2, Copy, CreditCard, ExternalLink, KeyRound, Link2, LoaderCircle, LockKeyhole, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import './payments.css';
import { fetchAllRecords } from '../lib/workspace-api.js';
import { filterRecordsForClient } from '../lib/client-record-filter.js';
import { filterPayments } from '../lib/payment-filters.js';
import { paymentSupportWarning } from '../lib/payment-support-warning.js';
import { splitInstallmentAmounts } from '../lib/installment-plan.js';
import { advanceServiceInstallment } from '../lib/service-installment.js';
import { apiRequest } from '../lib/workspace-api.js';
import { isLocalDemoActive } from '../lib/local-demo.js';
import { dateAfterDays } from '../lib/payment-due-date.js';
import { buildSubscriptionSchedule, minimumSubscriptionEndDate } from '../lib/subscription-schedule.js';
import { formatPaymentDate } from '../lib/payment-date-display.js';
import { canCancelPaymentOrder, canCancelSubscription, normalizePaymentStatus } from '../lib/payment-status.js';
import { copyPaymentText } from '../lib/copy-payment-text.js';

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const labels = { pending: 'Aguardando pagamento', creating: 'Criando', processing: 'Em processamento', paid: 'Paga', authorized: 'Autorizada', paused: 'Pausada', canceled: 'Cancelada', cancelled: 'Cancelada', overdue: 'Vencida', failed: 'Falhou', refunded: 'Estornada', rejected: 'Recusada', expired: 'Expirada' };

function MercadoPagoBrick({ amount, onSubmit, onError }) {
  const id = useRef(`mp-card-${Math.random().toString(36).slice(2)}`);
  const controller = useRef(null);
  const handlers = useRef({ onSubmit, onError });
  handlers.current = { onSubmit, onError };
  useEffect(() => {
    let alive = true;
    const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) { handlers.current.onError('A Public Key do Mercado Pago ainda não foi adicionada ao build do site.'); return undefined; }
    const loadSdk = () => new Promise((resolve, reject) => {
      if (window.MercadoPago) return resolve();
      const existing = document.querySelector('script[data-mp-sdk]');
      if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
      const script = document.createElement('script'); script.src = 'https://sdk.mercadopago.com/js/v2'; script.dataset.mpSdk = 'true'; script.onload = resolve; script.onerror = reject; document.head.append(script);
    });
    loadSdk().then(async () => {
      if (!alive) return;
      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
      const brick = await mp.bricks().create('cardPayment', id.current, {
        initialization: { amount: Number(amount) },
        customization: { paymentMethods: { maxInstallments: 12 } },
        callbacks: {
          onSubmit: async (formData, additionalData) => { try { await handlers.current.onSubmit(formData, additionalData); } catch (error) { handlers.current.onError(error.message || 'Não foi possível processar o pagamento.'); throw error; } },
          onError: (error) => handlers.current.onError(error?.message || 'O Mercado Pago não conseguiu abrir o formulário de cartão.'),
        },
      });
      if (alive) controller.current = brick; else brick.unmount();
    }).catch(() => handlers.current.onError('Não foi possível carregar o formulário seguro do Mercado Pago.'));
    return () => { alive = false; controller.current?.unmount?.(); controller.current = null; };
  }, [amount]);
  return <div id={id.current} className="mp-card-brick" />;
}

function PaymentAccess({ onConnected }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Nao foi possivel entrar. Confira seus dados.');
      setForm((current) => ({ ...current, password: '' })); onConnected(true);
    } catch (err) { setError(err.message || 'Falha de conexao com o servidor.'); }
    finally { setBusy(false); }
  };
  return <section className="pay-access"><span className="pay-access-icon"><LockKeyhole size={19} /></span><span className="pay-eyebrow">FINANCEIRO PROTEGIDO</span><h2>Entre no workspace</h2><p>Acesse com uma conta autorizada para o financeiro.</p><form onSubmit={submit}>
    <label>E-mail<input required type="email" autoCapitalize="none" autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Senha<input required type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
    {error && <p className="pay-error" role="alert">{error}</p>}<button className="ns-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{busy ? 'Verificando...' : 'Entrar no financeiro'}</button>
  </form><small className="pay-access-note">A equipe e os convites sao gerenciados no workspace.</small></section>;
}

export function PaymentConsole({ kind = 'orders', notify = () => {}, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const subscriptionMode = kind === 'subscriptions';
  const demoMode = isLocalDemoActive();
  const [token, setToken] = useState(() => isLocalDemoActive());
  useEffect(() => { if (isLocalDemoActive()) { setToken(true); return undefined; } let active = true; fetch('/api/auth/me', { credentials: 'same-origin' }).then((response) => { if (active) setToken(response.ok); }).catch(() => { if (active) setToken(false); }); return () => { active = false; }; }, []);
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [methods, setMethods] = useState([]);
  const [busy, setBusy] = useState(false);
  const [cancelingId, setCancelingId] = useState('');
  const [refreshingId, setRefreshingId] = useState('');
  const [subscriptionBusyId, setSubscriptionBusyId] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const [clientScope, setClientScope] = useState(null);
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [dueFilter, setDueFilter] = useState('Todos');
  const [defaultDueDays, setDefaultDueDays] = useState(7);
  const [enabledMethods, setEnabledMethods] = useState({ pix: true, boleto: true, card: true });
  const [form, setForm] = useState({ clientId: '', clientName: '', payerEmail: '', description: '', amount: '', method: 'pix', billingType: 'single', dueDate: dateAfterDays(7), startDate: dateAfterDays(1), endDate: '', identificationType: 'CPF', identificationNumber: '', frequency: 'months', frequencyInterval: 1, address: { zipCode: '', streetName: '', streetNumber: '', neighborhood: '', city: '', state: '' } });
  const [installmentContext, setInstallmentContext] = useState(null);
  const endpoint = subscriptionMode ? '/api/billing/subscriptions' : '/api/billing/orders';
  const creatingSubscription = subscriptionMode || form.billingType === 'recurring';
  const methodChoices = [
    { value: 'pix', label: 'Pix · QR Code' },
    { value: 'boleto', label: 'Boleto bancário' },
    { value: 'credit_card', label: 'Cartão de crédito' },
    { value: 'debit_card', label: 'Cartão de débito disponível' },
  ].filter((choice) => (choice.value === 'pix' ? enabledMethods.pix : choice.value === 'boleto' ? enabledMethods.boleto : enabledMethods.card) && methods.some((method) => choice.value === 'pix' ? method.id === 'pix' || method.paymentType === 'bank_transfer' : choice.value === 'boleto' ? method.paymentType === 'ticket' : method.paymentType === choice.value));
  const request = useCallback(async (url, options = {}) => {
    if (isLocalDemoActive()) return apiRequest(url, options);
    const response = await fetch(url, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { setToken(false); window.dispatchEvent(new CustomEvent('nexo:session-expired')); throw new Error('Sua sessao expirou. Entre novamente.'); }
    if (!response.ok) throw new Error(payload.message || 'Não foi possível concluir a ação.');
    return payload;
  }, []);
  const refresh = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [records, availableMethods, clientResult, settings] = await Promise.all([
        fetchAllRecords(endpoint, request),
        subscriptionMode ? Promise.resolve({ data: [] }) : request('/api/billing/payment-methods').catch((methodError) => ({ data: [], error: methodError.message })),
        fetchAllRecords('/api/workspace/clients', request).then((data) => ({ data })).catch((clientError) => ({ data: [], error: clientError.message })),
        fetchAllRecords('/api/workspace/settings', request).catch(() => []),
      ]);
      setItems(records); setMethods(demoMode ? [{ id: 'pix', paymentType: 'bank_transfer' }, { id: 'boleto', paymentType: 'ticket' }] : availableMethods.data || []); setClients(clientResult.data);
      const preferences = settings.find((item) => item.key === 'workspace-preferences')?.settings?.billing;
      if (preferences) setEnabledMethods({ pix: preferences.pix !== false, boleto: preferences.boleto !== false, card: preferences.card !== false });
      if (preferences?.defaultDueDays != null) {
        const days = Math.min(30, Math.max(1, Number(preferences.defaultDueDays) || 1));
        setDefaultDueDays(days);
        setForm((current) => current.dueDate === dateAfterDays(7) ? { ...current, dueDate: dateAfterDays(days) } : current);
      }
      setError(paymentSupportWarning({ clientError: clientResult.error, methodsError: availableMethods.error }));
    } catch (err) { setError(err.message); }
  }, [demoMode, endpoint, request, subscriptionMode, token]);
  const persistInstallmentProgress = useCallback(async () => {
    if (subscriptionMode || !installmentContext) return '';
    const client = clients.find((item) => String(item.id) === String(installmentContext.clientId));
    const charges = Array.isArray(client?.serviceCharges) ? client.serviceCharges : [];
    const nextCharges = advanceServiceInstallment(charges, installmentContext.serviceId, installmentContext.index);
    if (!client || !nextCharges) return 'A cobrança foi criada, mas não foi possível confirmar a parcela no cadastro do cliente. Confira a lista de cobranças antes de tentar novamente.';
    try {
      await request(`/api/workspace/clients/${encodeURIComponent(client.id)}`, { method: 'PATCH', body: JSON.stringify({ data: { serviceCharges: nextCharges } }) });
      return '';
    } catch {
      return 'A cobrança foi criada, mas o controle da próxima parcela não foi atualizado. Confira a lista de cobranças antes de tentar novamente.';
    }
  }, [clients, installmentContext, request, subscriptionMode]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (subscriptionMode || methodChoices.some((choice) => choice.value === form.method) || !methodChoices.length) return;
    setForm((current) => ({ ...current, method: methodChoices[0].value }));
  }, [subscriptionMode, form.method, methodChoices]);
  useEffect(() => {
    if (navigationContext?.filter === 'overdue') {
      setClientScope(null); setSearch(''); setDueFilter('Vencidas'); setStatusFilter('Todos'); onNavigationContextConsumed(); return;
    }
    if (!navigationContext?.clientName) {
      if (navigationContext?.action !== 'create' || !navigationContext?.intentId) return;
      setClientScope(null); setInstallmentContext(null); setSearch(''); setDueFilter('Todos'); setStatusFilter('Todos');
      setForm((current) => ({ ...current, clientId: '', clientName: '', payerEmail: '', description: '', amount: '', billingType: 'single', dueDate: dateAfterDays(defaultDueDays), startDate: dateAfterDays(1) }));
      setModal(true);
      onNavigationContextConsumed();
      return;
    }
    setDueFilter('Todos'); setStatusFilter('Todos');
    setClientScope({ clientId: navigationContext.clientId || '', clientName: navigationContext.clientName });
    setInstallmentContext(navigationContext.installmentServiceId ? { clientId: navigationContext.clientId, serviceId: navigationContext.installmentServiceId, index: Number(navigationContext.installmentIndex) || 0, count: Number(navigationContext.installmentCount) || 0 } : null);
    setSearch(navigationContext.clientName);
    if (navigationContext.action === 'create') setForm((current) => ({ clientId: navigationContext.clientId || '', clientName: navigationContext.clientName, payerEmail: navigationContext.clientEmail || '', description: navigationContext.description || '', amount: navigationContext.amount != null ? String(navigationContext.amount) : '', method: current.method, billingType: 'single', dueDate: dateAfterDays(defaultDueDays), startDate: dateAfterDays(1), endDate: '', identificationType: 'CPF', identificationNumber: '', frequency: navigationContext.frequency || 'months', frequencyInterval: navigationContext.frequencyInterval || 1, address: { zipCode: '', streetName: '', streetNumber: '', neighborhood: '', city: '', state: '' } }));
    else setForm((current) => ({ ...current, clientId: navigationContext.clientId || '', clientName: navigationContext.clientName, payerEmail: navigationContext.clientEmail || current.payerEmail, description: navigationContext.description || current.description, amount: navigationContext.amount != null ? String(navigationContext.amount) : current.amount, frequency: navigationContext.frequency || current.frequency, frequencyInterval: navigationContext.frequencyInterval || current.frequencyInterval }));
    if (navigationContext.action === 'create') setModal(true);
    onNavigationContextConsumed();
  }, [defaultDueDays, navigationContext?.intentId, navigationContext?.filter, navigationContext?.action, navigationContext?.clientName]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const payload = creatingSubscription
        ? { clientName: form.clientName, payerEmail: form.payerEmail, description: form.description, amount: Number(form.amount), ...(form.clientId ? { workspaceClientId: form.clientId } : {}), frequency: form.frequency, frequencyInterval: Number(form.frequencyInterval), ...buildSubscriptionSchedule(form.startDate, form.endDate) }
        : { clientName: form.clientName, payerEmail: form.payerEmail, description: form.description, amount: Number(form.amount), ...(form.clientId ? { workspaceClientId: form.clientId } : {}), method: form.method, ...(['pix', 'boleto'].includes(form.method) ? { dueDate: form.dueDate } : {}), ...(form.method === 'boleto' ? { identificationType: form.identificationType, identificationNumber: form.identificationNumber, address: { zipCode: form.address.zipCode, streetName: form.address.streetName, streetNumber: form.address.streetNumber, neighborhood: form.address.neighborhood, city: form.address.city, state: form.address.state } } : {}) };
      const response = await request(creatingSubscription ? '/api/billing/subscriptions' : endpoint, { method: 'POST', body: JSON.stringify(payload) });
      const followupWarning = await persistInstallmentProgress();
      setResult({ ...response.data, followupWarning, isSubscription: creatingSubscription }); setModal(false); await refresh(); notify(demoMode ? 'Cobrança fictícia criada neste navegador. Nenhum pagamento foi enviado.' : creatingSubscription ? 'Assinatura criada. Envie o link para o cliente autorizar.' : 'Cobrança enviada ao Mercado Pago.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const submitCard = useCallback(async (cardData, additionalData) => {
    setBusy(true); setError('');
    try {
      const payer = cardData.payer || {};
      const response = await request(endpoint, { method: 'POST', body: JSON.stringify({
        clientName: form.clientName, payerEmail: payer.email || form.payerEmail, description: form.description, amount: Number(form.amount), ...(form.clientId ? { workspaceClientId: form.clientId } : {}),
        method: additionalData?.paymentTypeId === 'debit_card' ? 'debit_card' : 'credit_card', cardToken: cardData.token,
        paymentMethodId: cardData.payment_method_id, installments: Number(cardData.installments || 1),
        identificationType: payer.identification?.type || form.identificationType, identificationNumber: payer.identification?.number || form.identificationNumber,
      }) });
      const followupWarning = await persistInstallmentProgress();
      setResult({ ...response.data, followupWarning, isSubscription: false }); setModal(false); await refresh(); notify(demoMode ? 'Pagamento fictício registrado neste navegador.' : 'Pagamento enviado ao Mercado Pago.');
    } finally { setBusy(false); }
  }, [demoMode, endpoint, form, notify, persistInstallmentProgress, refresh, request]);
  const cancelSubscription = async (item) => {
    if (!window.confirm(`Cancelar as cobranças futuras de ${item.clientName}?`)) return;
    setSubscriptionBusyId(item.id);
    try { await request(`/api/billing/subscriptions/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'canceled' }) }); await refresh(); notify('Assinatura cancelada no Mercado Pago.'); }
    catch (err) { setError(err.message); }
    finally { setSubscriptionBusyId(''); }
  };
  const toggleSubscription = async (item) => {
    const status = normalizePaymentStatus(item.status) === 'paused' ? 'authorized' : 'paused';
    setSubscriptionBusyId(item.id);
    try { await request(`/api/billing/subscriptions/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh(); notify(status === 'paused' ? 'Assinatura pausada.' : 'Assinatura retomada.'); }
    catch (err) { setError(err.message); }
    finally { setSubscriptionBusyId(''); }
  };
  const cancelOrder = async (item) => {
    if (!window.confirm(`Cancelar este pagamento de ${item.clientName} no valor de ${money(item.amount)}? O cliente não poderá mais pagar.`)) return;
    setCancelingId(item.id);
    try {
      await request(`/api/billing/orders/${encodeURIComponent(item.id)}/cancel`, { method: 'POST' });
      await refresh();
      notify(demoMode ? 'Cobrança fictícia cancelada neste navegador.' : 'Cancelamento confirmado pelo Mercado Pago.');
    } catch (err) { setError(err.message || 'Não foi possível confirmar o cancelamento.'); }
    finally { setCancelingId(''); }
  };
  const refreshOrder = async (item) => {
    setRefreshingId(item.id);
    try {
      const response = await request(`/api/billing/orders/${encodeURIComponent(item.id)}/refresh`, { method: 'POST' });
      if (response.data) setItems((current) => current.map((row) => row.id === item.id ? response.data : row));
      notify(demoMode ? 'Status demonstrativo atualizado.' : response.changed ? 'Status confirmado pelo Mercado Pago.' : 'A cobrança já estava atualizada.');
    } catch (err) { setError(err.message || 'Não foi possível consultar o status.'); }
    finally { setRefreshingId(''); }
  };
  const copy = async (value) => { if (await copyPaymentText(value)) notify('Copiado para a área de transferência.'); else notify('Não foi possível acessar a área de transferência.'); };
  const scopedItems = clientScope ? filterRecordsForClient(items, clientScope) : items;
  const filtered = filterPayments(scopedItems, { status: statusFilter, due: dueFilter }).filter((item) => `${item.clientName} ${item.description} ${item.status}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const resetForm = () => { setInstallmentContext(null); setForm({ clientId: '', clientName: '', payerEmail: '', description: '', amount: '', method: methodChoices[0]?.value || 'pix', billingType: 'single', dueDate: dateAfterDays(defaultDueDays), startDate: dateAfterDays(1), endDate: '', identificationType: 'CPF', identificationNumber: '', frequency: 'months', frequencyInterval: 1, address: { zipCode: '', streetName: '', streetNumber: '', neighborhood: '', city: '', state: '' } }); };
  if (!token) return <PaymentAccess onConnected={setToken} />;
  if (result) {
    const details = result.paymentDetails || {};
    const resultIsSubscription = result.isSubscription ?? subscriptionMode;
    const resultStatus = normalizePaymentStatus(result.status);
    return <section className="pay-result"><button className="pay-back" onClick={() => setResult(null)}>← Voltar ao financeiro</button><span className="pay-access-icon success"><CheckCircle2 size={21} /></span><span className="pay-eyebrow">{resultIsSubscription ? 'ASSINATURA CRIADA' : 'COBRANÇA CRIADA'}</span><h2>{result.clientName} · {money(result.amount)}</h2><p>{result.description}</p><span className={`pay-status status-${resultStatus}`}>{labels[resultStatus] || result.status}</span>
      {resultIsSubscription && result.checkoutUrl && <div className="pay-result-action"><p>O cliente precisa confirmar o meio de pagamento no Mercado Pago. Depois da autorização, a renovação será automática.</p><a className="ns-primary" href={result.checkoutUrl} target="_blank" rel="noreferrer">Abrir autorização <ExternalLink size={15} /></a><button className="ns-secondary" onClick={() => copy(result.checkoutUrl)}><Copy size={14} />Copiar link</button></div>}
      {!resultIsSubscription && details.pixQrCodeBase64 && <div className="pay-pix"><img width={190} height={190} alt="QR Code Pix" src={`data:image/png;base64,${details.pixQrCodeBase64}`} /><span>Escaneie o QR Code ou use Pix Copia e Cola.</span><button className="ns-secondary" onClick={() => copy(details.pixCode)}><Copy size={14} />Copiar Pix Copia e Cola</button></div>}
      {!resultIsSubscription && details.ticketUrl && <div className="pay-result-action"><a className="ns-primary" href={details.ticketUrl} target="_blank" rel="noreferrer">Abrir boleto <ExternalLink size={15} /></a>{details.digitableLine && <button className="ns-secondary" onClick={() => copy(details.digitableLine)}><Copy size={14} />Copiar linha digitável</button>}</div>}
      {!resultIsSubscription && !details.pixQrCodeBase64 && !details.ticketUrl && <p className="pay-result-action">Resultado do cartão: {labels[result.status] || result.status}. A confirmação final virá pelo webhook.</p>}
      {result.followupWarning && <p className="pay-error" role="alert">{result.followupWarning}</p>}
      {resultIsSubscription && !subscriptionMode && <button className="ns-secondary" onClick={() => { setResult(null); window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Assinaturas' })); }}>Ver assinaturas</button>}<button className="ns-secondary" onClick={() => { setResult(null); resetForm(); }}>Fechar</button></section>;
  }
  return <div className="pay-workspace">
    <div className="pay-toolbar"><div><span className="pay-eyebrow">MERCADO PAGO · API DE ORDERS E ASSINATURAS</span><h2>{subscriptionMode ? 'Cobranças recorrentes' : 'Cobranças de clientes'}</h2><p>{subscriptionMode ? 'Crie renovações automáticas após autorização do cliente.' : 'Pix com QR Code, boleto e cartões dentro do financeiro.'}</p></div><div className="pay-toolbar-actions"><button type="button" className="ns-secondary" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integrações' }))}><Link2 size={14} />Integrações</button><button className="ns-primary" onClick={() => { resetForm(); setError(''); setModal(true); }}><Plus size={15} />{subscriptionMode ? 'Nova assinatura' : 'Nova cobrança'}</button></div></div>
    <div className="pay-method-strip">{(subscriptionMode ? ['Cartões autorizados', 'Pix e boleto via adesão no Mercado Pago'] : ['Pix · QR Code e Copia e Cola', 'Boleto bancário', 'Crédito e débito']).map((label) => <span key={label}><CheckCircle2 size={15} />{label}</span>)}</div>
    {error && <div className="pay-error-banner"><AlertCircle size={16} />{error}<button onClick={() => setError('')} aria-label="Fechar aviso"><X size={14} /></button></div>}
    <div className="pay-list-head"><div><b>{filtered.length} {subscriptionMode ? 'assinaturas' : 'cobranças'}</b><small>{clientScope ? `Financeiro de ${clientScope.clientName}` : demoMode ? 'Exemplos salvos neste navegador' : 'Dados sincronizados com o backend Focusshub'}</small></div><input aria-label="Buscar cobranças e assinaturas" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou descrição" /><label className="pay-filter">Status<select aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option>{[...new Set(items.map((item) => normalizePaymentStatus(item.status)).filter(Boolean))].map((status) => <option key={status} value={status}>{labels[status] || status}</option>)}</select></label>{!subscriptionMode && <label className="pay-filter">Vencimento<select aria-label="Filtrar por vencimento" value={dueFilter} onChange={(event) => setDueFilter(event.target.value)}>{['Todos', 'Vencidas', 'Próximos 7 dias', 'Sem vencimento'].map((due) => <option key={due}>{due}</option>)}</select></label>}{clientScope && <button className="ns-secondary" onClick={() => { setClientScope(null); setSearch(''); }}>Todos os clientes</button>}{(statusFilter !== 'Todos' || dueFilter !== 'Todos') && <button className="ns-secondary" onClick={() => { setStatusFilter('Todos'); setDueFilter('Todos'); }}>Limpar filtros</button>}<button className="ns-secondary" disabled={busy} onClick={refresh}><RefreshCw size={14} />Atualizar</button></div>
    <div className="pay-record-list">
      {filtered.map((item) => <article className="pay-record" key={item.id}>
        <div className="pay-record-icon">{subscriptionMode ? <RefreshCw size={18} /> : <CreditCard size={18} />}</div>
        <div className="pay-record-main"><b>{item.clientName}</b><small>{item.description} · {item.payerEmail}</small><small>{subscriptionMode ? item.frequencyInterval + ' ' + (item.frequency === 'months' ? 'mês(es)' : 'dia(s)') : item.method + ' · ' + (demoMode ? 'Registro demonstrativo' : item.mpOrderId || 'Pedido em processamento')}</small>
          {subscriptionMode && (item.nextPaymentAt || item.startAt) && <small>Próxima cobrança · {formatPaymentDate(item.nextPaymentAt || item.startAt)}</small>}
          {!subscriptionMode && (item.dueAt || item.dueDate) && <small>Vencimento · {formatPaymentDate(item.dueAt || item.dueDate)}</small>}
        </div><strong>{money(item.amount)}</strong><span className={'pay-status status-' + normalizePaymentStatus(item.status)}>{labels[normalizePaymentStatus(item.status)] || item.status}</span>
        {subscriptionMode ? <div className="pay-record-actions">
          {item.checkoutUrl && normalizePaymentStatus(item.status) === 'pending' && <button className="ns-secondary" onClick={() => copy(item.checkoutUrl)}><Copy size={14} />Copiar link</button>}
          {normalizePaymentStatus(item.status) === 'authorized' && <button className="ns-secondary" disabled={subscriptionBusyId === item.id} onClick={() => toggleSubscription(item)}>{subscriptionBusyId === item.id ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}{subscriptionBusyId === item.id ? 'Atualizando...' : 'Pausar'}</button>}
          {normalizePaymentStatus(item.status) === 'paused' && <button className="ns-secondary" disabled={subscriptionBusyId === item.id} onClick={() => toggleSubscription(item)}>{subscriptionBusyId === item.id ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}{subscriptionBusyId === item.id ? 'Atualizando...' : 'Retomar'}</button>}
          {canCancelSubscription(item) && <button className="ns-secondary" disabled={subscriptionBusyId === item.id} onClick={() => cancelSubscription(item)}>{subscriptionBusyId === item.id ? <LoaderCircle className="spin" size={14} /> : <X size={14} />}{subscriptionBusyId === item.id ? 'Atualizando...' : 'Cancelar'}</button>}
        </div> : <div className="pay-record-actions">
          {(demoMode || item.mpOrderId) && <button className="ns-secondary" disabled={refreshingId === item.id} onClick={() => refreshOrder(item)}>{refreshingId === item.id ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}{refreshingId === item.id ? 'Consultando...' : 'Consultar status'}</button>}
          {canCancelPaymentOrder(item, demoMode) && <button className="ns-secondary" disabled={cancelingId === item.id} onClick={() => cancelOrder(item)}>{cancelingId === item.id ? <LoaderCircle className="spin" size={14} /> : <X size={14} />}{cancelingId === item.id ? 'Cancelando...' : 'Cancelar cobrança'}</button>}
          {item.paymentDetails?.pixCode && <button className="ns-secondary" onClick={() => copy(item.paymentDetails.pixCode)}><Copy size={14} />Pix</button>}
          {item.paymentDetails?.ticketUrl && <a className="ns-secondary" href={item.paymentDetails.ticketUrl} target="_blank" rel="noreferrer">Boleto <ArrowUpRight size={14} /></a>}
        </div>}
      </article>)}
      {!filtered.length && <div className="pay-empty"><Activity size={20} /><b>Nenhum registro encontrado</b><span>Crie uma cobrança ou assinatura para ela aparecer aqui.</span></div>}
    </div>
    <div className="pay-security-note"><ShieldCheck size={17} /><span>Credenciais privadas ficam no servidor. Dados de cartão são tokenizados pelo Mercado Pago e não passam pelos servidores do Focusshub.</span></div>
    {modal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setModal(false); }}><form className="ns-integration-modal pay-create-modal" onSubmit={submit}><header><span className="ns-integration-logo mercado">{subscriptionMode ? <RefreshCw size={18} /> : <CreditCard size={18} />}</span><div><h2>{subscriptionMode ? 'Nova assinatura recorrente' : 'Nova cobrança'}</h2><p>{subscriptionMode ? 'O cliente autoriza o método no Mercado Pago.' : 'Selecione como o cliente pagará.'}</p></div><button type="button" aria-label="Fechar" disabled={busy} onClick={() => setModal(false)}><X size={17} /></button></header><div className="ns-integration-fields pay-fields"><label>Cliente cadastrado<select value={form.clientId} onChange={(event) => { const client = clients.find((item) => String(item.id) === String(event.target.value)); setForm((current) => ({ ...current, clientId: client?.id || '', clientName: client?.name || '', payerEmail: client?.email || current.payerEmail })); }}><option value="">Selecionar cliente (opcional)</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Nome do cliente<input required value={form.clientName} onChange={(e) => setForm({ ...form, clientId: '', clientName: e.target.value })} /></label><label>E-mail do pagador<input required type="email" value={form.payerEmail} onChange={(e) => setForm({ ...form, payerEmail: e.target.value })} /></label><label>Descrição<input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Valor (R$)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
      {!subscriptionMode && <label className="pay-field-wide">Tipo de cobrança<select value={form.billingType} onChange={(event) => setForm({ ...form, billingType: event.target.value })}><option value="single">Cobrança única</option><option value="recurring">Recorrência automática</option></select></label>}
      {creatingSubscription ? <>
        <label>Frequência<select value={form.frequency + ':' + form.frequencyInterval} onChange={(event) => { const [frequency, frequencyInterval] = event.target.value.split(':'); setForm({ ...form, frequency, frequencyInterval: Number(frequencyInterval) }); }}><option value="months:1">Mensal</option><option value="months:3">Trimestral</option><option value="months:6">Semestral</option><option value="months:12">Anual</option><option value="days:7">Semanal</option></select></label>
        <label>Primeira cobrança<input type="date" required min={dateAfterDays(1)} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /><small className="pay-hint">A recorrência começa nesta data, após o cliente autorizar.</small></label>
        <label>Encerrar recorrência em (opcional)<input type="date" min={minimumSubscriptionEndDate(form.startDate)} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /><small className="pay-hint">Deixe em branco para manter a assinatura sem data final.</small></label>
        <p className="pay-hint wide">O cliente receberá um link para autorizar a recorrência no Mercado Pago.</p>
      </> : <>
        <label>Meio de pagamento<select required value={form.method} onChange={(event) => { setForm({ ...form, method: event.target.value }); setError(''); }}>{methodChoices.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
        {['pix', 'boleto'].includes(form.method) && <label>Vencimento<input type="date" required min={dateAfterDays(1)} max={dateAfterDays(30)} value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /><small className="pay-hint">Padrão: {defaultDueDays} {defaultDueDays === 1 ? 'dia' : 'dias'}. Ajustável entre 1 e 30 dias.{form.method === 'boleto' ? ' Fins de semana podem ser ajustados pelo Mercado Pago.' : ''}</small></label>}
        {!methodChoices.length && <p className="pay-error wide">A conta Mercado Pago não retornou meios de pagamento ativos.</p>}
        {form.method === 'boleto' && <><label>Documento<select value={form.identificationType} onChange={(event) => setForm({ ...form, identificationType: event.target.value })}><option>CPF</option><option>CNPJ</option></select></label><label>CPF/CNPJ<input required value={form.identificationNumber} onChange={(event) => setForm({ ...form, identificationNumber: event.target.value })} /></label><label>CEP<input required value={form.address.zipCode} onChange={(event) => setForm({ ...form, address: { ...form.address, zipCode: event.target.value } })} /></label><label>Rua<input required value={form.address.streetName} onChange={(event) => setForm({ ...form, address: { ...form.address, streetName: event.target.value } })} /></label><label>Número<input required value={form.address.streetNumber} onChange={(event) => setForm({ ...form, address: { ...form.address, streetNumber: event.target.value } })} /></label><label>Bairro<input required value={form.address.neighborhood} onChange={(event) => setForm({ ...form.address, neighborhood: event.target.value })} /></label><label>Cidade<input required value={form.address.city} onChange={(event) => setForm({ ...form.address, city: event.target.value })} /></label><label>UF<input required maxLength="2" value={form.address.state} onChange={(event) => setForm({ ...form, address: { ...form.address, state: event.target.value.toUpperCase() } })} /></label></>}
        {['credit_card', 'debit_card'].includes(form.method) && <><label>Documento<select value={form.identificationType} onChange={(e) => setForm({ ...form, identificationType: e.target.value })}><option>CPF</option><option>CNPJ</option></select></label><label>CPF/CNPJ<input required value={form.identificationNumber} onChange={(e) => setForm({ ...form, identificationNumber: e.target.value })} /></label><p className="pay-hint wide">Os dados do cartão são inseridos no formulário seguro hospedado pelo Mercado Pago.</p></>}
      </>}
    </div>{error && <p className="pay-error" role="alert">{error}</p>}
      {!creatingSubscription && ['credit_card', 'debit_card'].includes(form.method) ? <MercadoPagoBrick amount={form.amount || 0} onSubmit={submitCard} onError={setError} /> : <footer><button type="button" className="ns-secondary" disabled={busy} onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="ns-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={14} />}{creatingSubscription ? 'Criar assinatura' : 'Gerar cobrança'}</button></footer>}
    </form></div>}
  </div>;
}
