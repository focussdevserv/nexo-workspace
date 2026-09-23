import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, ArrowUpRight, Check, CheckCircle2, Copy, CreditCard, ExternalLink, KeyRound, LoaderCircle, LockKeyhole, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import './payments.css';

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const labels = { pending: 'Aguardando pagamento', creating: 'Criando', processing: 'Em processamento', paid: 'Paga', authorized: 'Autorizada', paused: 'Pausada', canceled: 'Cancelada', failed: 'Falhou', refunded: 'Estornada', rejected: 'Recusada', expired: 'Expirada' };

function MercadoPagoBrick({ amount, onSubmit, onError }) {
  const id = useRef(`mp-card-${Math.random().toString(36).slice(2)}`);
  const controller = useRef(null);
  useEffect(() => {
    let alive = true;
    const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) { onError('A Public Key do Mercado Pago ainda não foi adicionada ao build do site.'); return undefined; }
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
          onSubmit: async (formData, additionalData) => { try { await onSubmit(formData, additionalData); } catch (error) { onError(error.message || 'Não foi possível processar o pagamento.'); throw error; } },
          onError: (error) => onError(error?.message || 'O Mercado Pago não conseguiu abrir o formulário de cartão.'),
        },
      });
      if (alive) controller.current = brick; else brick.unmount();
    }).catch(() => onError('Não foi possível carregar o formulário seguro do Mercado Pago.'));
    return () => { alive = false; controller.current?.unmount?.(); controller.current = null; };
  }, [amount, onSubmit, onError]);
  return <div id={id.current} className="mp-card-brick" />;
}

function PaymentAccess({ onConnected }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ organizationName: '', name: '', email: '', password: '', bootstrapToken: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(mode === 'register' ? { 'x-bootstrap-token': form.bootstrapToken } : {}) },
        body: JSON.stringify(mode === 'login' ? { email: form.email, password: form.password } : { organizationName: form.organizationName, name: form.name, email: form.email, password: form.password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Não foi possível entrar. Confira os dados.');
      sessionStorage.setItem('nexo.api.token', payload.token); onConnected(payload.token);
    } catch (err) { setError(err.message || 'Falha de conexão com o servidor.'); }
    finally { setBusy(false); }
  };
  return <section className="pay-access"><span className="pay-access-icon"><LockKeyhole size={19} /></span><span className="pay-eyebrow">FINANCEIRO PROTEGIDO</span><h2>{mode === 'login' ? 'Conecte sua conta Nexo' : 'Ative o primeiro acesso'}</h2><p>As cobranças reais ficam isoladas por empresa e exigem autenticação.</p><form onSubmit={submit}>
    {mode === 'register' && <><label>Nome da empresa<input required value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} /></label><label>Seu nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Token de ativação<input required value={form.bootstrapToken} onChange={(e) => setForm({ ...form, bootstrapToken: e.target.value })} /></label></>}
    <label>E-mail<input required type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Senha<input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
    {error && <p className="pay-error" role="alert">{error}</p>}<button className="ns-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{mode === 'login' ? 'Entrar no financeiro' : 'Criar conta proprietária'}</button>
  </form><button className="pay-mode-switch" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>{mode === 'login' ? 'Primeiro acesso? Criar a conta da empresa' : 'Já tem acesso? Entrar'}</button><small className="pay-access-note">O token de ativação é usado uma vez. Não compartilhe credenciais no chat.</small></section>;
}

export function PaymentConsole({ kind = 'orders', notify = () => {} }) {
  const subscriptionMode = kind === 'subscriptions';
  const [token, setToken] = useState(() => sessionStorage.getItem('nexo.api.token') || '');
  const [items, setItems] = useState([]);
  const [methods, setMethods] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ clientName: '', payerEmail: '', description: '', amount: '', method: 'pix', identificationType: 'CPF', identificationNumber: '', frequency: 'months', frequencyInterval: 1, address: { zipCode: '', streetName: '', streetNumber: '', neighborhood: '', city: '', state: '' } });
  const endpoint = subscriptionMode ? '/api/billing/subscriptions' : '/api/billing/orders';
  const methodChoices = [
    { value: 'pix', label: 'Pix · QR Code' },
    { value: 'boleto', label: 'Boleto bancário' },
    { value: 'credit_card', label: 'Cartão de crédito' },
    { value: 'debit_card', label: 'Cartão de débito disponível' },
  ].filter((choice) => methods.some((method) => choice.value === 'pix' ? method.id === 'pix' || method.paymentType === 'bank_transfer' : choice.value === 'boleto' ? method.paymentType === 'ticket' : method.paymentType === choice.value));
  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { sessionStorage.removeItem('nexo.api.token'); setToken(''); throw new Error('Sua sessão expirou. Entre novamente.'); }
    if (!response.ok) throw new Error(payload.message || 'Não foi possível concluir a ação.');
    return payload;
  }, [token]);
  const refresh = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [records, availableMethods] = await Promise.all([
        request(endpoint),
        subscriptionMode ? Promise.resolve({ data: [] }) : request('/api/billing/payment-methods'),
      ]);
      setItems(records.data || []); setMethods(availableMethods.data || []);
    } catch (err) { setError(err.message); }
  }, [endpoint, request, subscriptionMode, token]);
  useEffect(() => { refresh(); }, [refresh]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const payload = subscriptionMode
        ? { clientName: form.clientName, payerEmail: form.payerEmail, description: form.description, amount: Number(form.amount), frequency: form.frequency, frequencyInterval: Number(form.frequencyInterval) }
        : { clientName: form.clientName, payerEmail: form.payerEmail, description: form.description, amount: Number(form.amount), method: form.method, ...(form.method === 'boleto' ? { identificationType: form.identificationType, identificationNumber: form.identificationNumber, address: { zipCode: form.address.zipCode, streetName: form.address.streetName, streetNumber: form.address.streetNumber, neighborhood: form.address.neighborhood, city: form.address.city, state: form.address.state } } : {}) };
      const response = await request(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      setResult(response.data); setModal(false); await refresh(); notify(subscriptionMode ? 'Assinatura criada. Envie o link para o cliente autorizar.' : 'Cobrança enviada ao Mercado Pago.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const submitCard = useCallback(async (cardData, additionalData) => {
    setBusy(true); setError('');
    try {
      const payer = cardData.payer || {};
      const response = await request(endpoint, { method: 'POST', body: JSON.stringify({
        clientName: form.clientName, payerEmail: payer.email || form.payerEmail, description: form.description, amount: Number(form.amount),
        method: additionalData?.paymentTypeId === 'debit_card' ? 'debit_card' : 'credit_card', cardToken: cardData.token,
        paymentMethodId: cardData.payment_method_id, installments: Number(cardData.installments || 1),
        identificationType: payer.identification?.type || form.identificationType, identificationNumber: payer.identification?.number || form.identificationNumber,
      }) });
      setResult(response.data); setModal(false); await refresh(); notify('Pagamento enviado ao Mercado Pago.');
    } finally { setBusy(false); }
  }, [endpoint, form, notify, refresh, request]);
  const cancelSubscription = async (item) => {
    if (!window.confirm(`Cancelar as cobranças futuras de ${item.clientName}?`)) return;
    try { await request(`/api/billing/subscriptions/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'canceled' }) }); await refresh(); notify('Assinatura cancelada no Mercado Pago.'); }
    catch (err) { setError(err.message); }
  };
  const toggleSubscription = async (item) => {
    const status = item.status === 'paused' ? 'authorized' : 'paused';
    try { await request(`/api/billing/subscriptions/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh(); notify(status === 'paused' ? 'Assinatura pausada.' : 'Assinatura retomada.'); }
    catch (err) { setError(err.message); }
  };
  const copy = async (value) => { try { await navigator.clipboard.writeText(value); notify('Copiado para a área de transferência.'); } catch { notify('Não foi possível acessar a área de transferência.'); } };
  const filtered = items.filter((item) => `${item.clientName} ${item.description} ${item.status}`.toLowerCase().includes(search.toLowerCase()));
  const resetForm = () => setForm({ clientName: '', payerEmail: '', description: '', amount: '', method: methodChoices[0]?.value || 'pix', identificationType: 'CPF', identificationNumber: '', frequency: 'months', frequencyInterval: 1, address: { zipCode: '', streetName: '', streetNumber: '', neighborhood: '', city: '', state: '' } });
  if (!token) return <PaymentAccess onConnected={setToken} />;
  if (result) {
    const details = result.paymentDetails || {};
    return <section className="pay-result"><button className="pay-back" onClick={() => setResult(null)}>← Voltar ao financeiro</button><span className="pay-access-icon success"><CheckCircle2 size={21} /></span><span className="pay-eyebrow">{subscriptionMode ? 'ASSINATURA CRIADA' : 'COBRANÇA CRIADA'}</span><h2>{result.clientName} · {money(result.amount)}</h2><p>{result.description}</p><span className={`pay-status status-${result.status}`}>{labels[result.status] || result.status}</span>
      {subscriptionMode && result.checkoutUrl && <div className="pay-result-action"><p>O cliente precisa confirmar o meio de pagamento no Mercado Pago. Depois da autorização, a renovação será automática.</p><a className="ns-primary" href={result.checkoutUrl} target="_blank" rel="noreferrer">Abrir autorização <ExternalLink size={15} /></a><button className="ns-secondary" onClick={() => copy(result.checkoutUrl)}><Copy size={14} />Copiar link</button></div>}
      {!subscriptionMode && details.pixQrCodeBase64 && <div className="pay-pix"><img alt="QR Code Pix" src={`data:image/png;base64,${details.pixQrCodeBase64}`} /><span>Escaneie o QR Code ou use Pix Copia e Cola.</span><button className="ns-secondary" onClick={() => copy(details.pixCode)}><Copy size={14} />Copiar Pix Copia e Cola</button></div>}
      {!subscriptionMode && details.ticketUrl && <div className="pay-result-action"><a className="ns-primary" href={details.ticketUrl} target="_blank" rel="noreferrer">Abrir boleto <ExternalLink size={15} /></a>{details.digitableLine && <button className="ns-secondary" onClick={() => copy(details.digitableLine)}><Copy size={14} />Copiar linha digitável</button>}</div>}
      {!subscriptionMode && !details.pixQrCodeBase64 && !details.ticketUrl && <p className="pay-result-action">Resultado do cartão: {labels[result.status] || result.status}. A confirmação final virá pelo webhook.</p>}
      <button className="ns-secondary" onClick={() => { setResult(null); resetForm(); }}>Fechar</button></section>;
  }
  return <div className="pay-workspace">
    <div className="pay-toolbar"><div><span className="pay-eyebrow">MERCADO PAGO · API DE ORDERS E ASSINATURAS</span><h2>{subscriptionMode ? 'Cobranças recorrentes' : 'Cobranças de clientes'}</h2><p>{subscriptionMode ? 'Crie renovações automáticas após autorização do cliente.' : 'Pix com QR Code, boleto e cartões dentro do financeiro.'}</p></div><div className="pay-toolbar-actions"><button className="ns-secondary" onClick={() => { sessionStorage.removeItem('nexo.api.token'); setToken(''); }}><LockKeyhole size={14} />Sair</button><button className="ns-primary" onClick={() => { resetForm(); setError(''); setModal(true); }}><Plus size={15} />{subscriptionMode ? 'Nova assinatura' : 'Nova cobrança'}</button></div></div>
    <div className="pay-method-strip">{(subscriptionMode ? ['Cartões autorizados', 'Pix e boleto via adesão no Mercado Pago'] : ['Pix · QR Code e Copia e Cola', 'Boleto bancário', 'Crédito e débito']).map((label) => <span key={label}><CheckCircle2 size={15} />{label}</span>)}</div>
    {error && <div className="pay-error-banner"><AlertCircle size={16} />{error}<button onClick={() => setError('')} aria-label="Fechar aviso"><X size={14} /></button></div>}
    <div className="pay-list-head"><div><b>{items.length} {subscriptionMode ? 'assinaturas' : 'cobranças'}</b><small>Dados sincronizados com o backend Nexo</small></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" /><button className="ns-secondary" onClick={refresh}><RefreshCw size={14} />Atualizar</button></div>
    <div className="pay-record-list">{filtered.map((item) => <article className="pay-record" key={item.id}><div className="pay-record-icon">{subscriptionMode ? <RefreshCw size={18} /> : <CreditCard size={18} />}</div><div className="pay-record-main"><b>{item.clientName}</b><small>{item.description} · {item.payerEmail}</small><small>{subscriptionMode ? `${item.frequencyInterval} ${item.frequency === 'months' ? 'mês(es)' : 'dia(s)'}` : `${item.method} · ${item.mpOrderId || 'Pedido em processamento'}`}</small></div><strong>{money(item.amount)}</strong><span className={`pay-status status-${item.status}`}>{labels[item.status] || item.status}</span>{subscriptionMode ? <div className="pay-record-actions">{item.checkoutUrl && item.status === 'pending' && <button className="ns-secondary" onClick={() => copy(item.checkoutUrl)}><Copy size={14} />Link</button>}{!['canceled', 'cancelled'].includes(item.status) && <><button className="ns-secondary" onClick={() => toggleSubscription(item)}><RefreshCw size={14} />{item.status === 'paused' ? 'Retomar' : 'Pausar'}</button><button className="ns-secondary" onClick={() => cancelSubscription(item)}><X size={14} />Cancelar</button></>}</div> : <div className="pay-record-actions">{item.paymentDetails?.pixCode && <button className="ns-secondary" onClick={() => copy(item.paymentDetails.pixCode)}><Copy size={14} />Pix</button>}{item.paymentDetails?.ticketUrl && <a className="ns-secondary" href={item.paymentDetails.ticketUrl} target="_blank" rel="noreferrer">Boleto <ArrowUpRight size={14} /></a>}</div>}</article>)}{!filtered.length && <div className="pay-empty"><Activity size={20} /><b>Nenhum registro encontrado</b><span>Crie uma cobrança ou assinatura para ela aparecer aqui.</span></div>}</div>
    <div className="pay-security-note"><ShieldCheck size={17} /><span>Credenciais privadas ficam no servidor. Dados de cartão são tokenizados pelo Mercado Pago e não passam pelos servidores do Nexo.</span></div>
    {modal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setModal(false); }}><form className="ns-integration-modal pay-create-modal" onSubmit={submit}><header><span className="ns-integration-logo mercado">{subscriptionMode ? <RefreshCw size={18} /> : <CreditCard size={18} />}</span><div><h2>{subscriptionMode ? 'Nova assinatura recorrente' : 'Nova cobrança'}</h2><p>{subscriptionMode ? 'O cliente autoriza o método no Mercado Pago.' : 'Selecione como o cliente pagará.'}</p></div><button type="button" aria-label="Fechar" disabled={busy} onClick={() => setModal(false)}><X size={17} /></button></header><div className="ns-integration-fields pay-fields"><label>Cliente<input required value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></label><label>E-mail do pagador<input required type="email" value={form.payerEmail} onChange={(e) => setForm({ ...form, payerEmail: e.target.value })} /></label><label>Descrição<input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Valor (R$)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
      {subscriptionMode ? <><label>Frequência<select value={`${form.frequency}:${form.frequencyInterval}`} onChange={(e) => { const [frequency, frequencyInterval] = e.target.value.split(':'); setForm({ ...form, frequency, frequencyInterval: Number(frequencyInterval) }); }}><option value="months:1">Mensal</option><option value="months:3">Trimestral</option><option value="months:6">Semestral</option><option value="months:12">Anual</option><option value="days:7">Semanal</option></select></label><p className="pay-hint wide">A autorização pode oferecer os meios habilitados no Mercado Pago. A renovação automática começa após o cliente aprovar a assinatura.</p></> : <><label>Meio de pagamento<select value={form.method} onChange={(e) => { setForm({ ...form, method: e.target.value }); setError(''); }}>{methodChoices.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>{!methodChoices.length && <p className="pay-error wide">A conta Mercado Pago não retornou meios de pagamento ativos.</p>}{form.method === 'boleto' && <><label>Documento<select value={form.identificationType} onChange={(e) => setForm({ ...form, identificationType: e.target.value })}><option>CPF</option><option>CNPJ</option></select></label><label>CPF/CNPJ<input required value={form.identificationNumber} onChange={(e) => setForm({ ...form, identificationNumber: e.target.value })} /></label><label>CEP<input required value={form.address.zipCode} onChange={(e) => setForm({ ...form, address: { ...form.address, zipCode: e.target.value } })} /></label><label>Rua<input required value={form.address.streetName} onChange={(e) => setForm({ ...form, address: { ...form.address, streetName: e.target.value } })} /></label><label>Número<input required value={form.address.streetNumber} onChange={(e) => setForm({ ...form, address: { ...form.address, streetNumber: e.target.value } })} /></label><label>Bairro<input required value={form.address.neighborhood} onChange={(e) => setForm({ ...form.address, neighborhood: e.target.value })} /></label><label>Cidade<input required value={form.address.city} onChange={(e) => setForm({ ...form.address, city: e.target.value })} /></label><label>UF<input required maxLength="2" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value.toUpperCase() } })} /></label></>}
        {['credit_card', 'debit_card'].includes(form.method) && <><label>Documento<select value={form.identificationType} onChange={(e) => setForm({ ...form, identificationType: e.target.value })}><option>CPF</option><option>CNPJ</option></select></label><label>CPF/CNPJ<input required value={form.identificationNumber} onChange={(e) => setForm({ ...form, identificationNumber: e.target.value })} /></label><p className="pay-hint wide">Os dados do cartão são inseridos no formulário seguro hospedado pelo Mercado Pago.</p></>}
      </>}
    </div>{error && <p className="pay-error" role="alert">{error}</p>}
      {!subscriptionMode && ['credit_card', 'debit_card'].includes(form.method) ? <MercadoPagoBrick amount={form.amount || 0} onSubmit={submitCard} onError={setError} /> : <footer><button type="button" className="ns-secondary" disabled={busy} onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="ns-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={14} />}{subscriptionMode ? 'Criar assinatura' : 'Gerar cobrança'}</button></footer>}
    </form></div>}
  </div>;
}
