import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CircleAlert, LoaderCircle, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { publicLeadHasContact, publicLeadPayload } from '../lib/public-lead-form.js';
import './public-lead-form.css';

function freshKey() {
  return globalThis.crypto?.randomUUID?.() || `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PublicLeadForm({ slug }) {
  const startedAt = useRef(Date.now());
  const key = useRef(freshKey());
  const [state, setState] = useState(slug ? 'ready' : 'unavailable');
  const [error, setError] = useState('');
  const [values, setValues] = useState({ name: '', email: '', phone: '', company: '', message: '', contactConsent: false, marketingConsent: false, website: '' });
  useEffect(() => { document.title = 'Fale com a equipe · Focusshub'; }, []);
  const unavailable = state === 'unavailable';
  const update = (event) => {
    const { name, value, checked, type } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    key.current = freshKey();
    if (state === 'error') setState('ready');
  };
  async function submit(event) {
    event.preventDefault();
    if (state === 'sending' || unavailable) return;
    if (!publicLeadHasContact(values)) { setError('Informe um e-mail ou um telefone com pelo menos oito dígitos.'); setState('error'); return; }
    setState('sending'); setError('');
    try {
      const response = await fetch(`/api/public/crm/leads/${encodeURIComponent(slug)}`, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key.current },
        body: JSON.stringify(publicLeadPayload(values, startedAt.current)),
      });
      if (response.status === 404) { setState('unavailable'); return; }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Não foi possível enviar agora. Revise os dados e tente novamente.');
      setState('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha de conexão. Tente novamente.'); setState('error');
    }
  }
  return <main className="public-lead-page">
    <header className="public-lead-brand"><a href="/" aria-label="Focusshub"><span><UserRoundPlus size={18} /></span><b>Focusshub</b></a><span>CONTATO COMERCIAL</span></header>
    <section className="public-lead-card" aria-labelledby="public-lead-title">
      {unavailable ? <div className="public-lead-result"><span className="public-lead-result-icon"><CircleAlert size={22} /></span><h1 id="public-lead-title">Formulário indisponível</h1><p>Este link não está ativo no momento. Peça à equipe um novo endereço para contato.</p></div> : state === 'success' ? <div className="public-lead-result" role="status"><span className="public-lead-result-icon success"><Check size={22} /></span><h1 id="public-lead-title">Recebemos sua mensagem</h1><p>Obrigado pelo contato. A equipe vai analisar as informações e retornar pelo canal informado.</p></div> : <>
        <span className="public-lead-kicker">VAMOS CONVERSAR</span><h1 id="public-lead-title">Conte um pouco sobre o que você precisa</h1><p className="public-lead-intro">Deixe seus dados e a equipe Focusshub entrará em contato com você.</p>
        <form onSubmit={submit}>
          <div className="public-lead-fields"><label>Seu nome<input name="name" autoComplete="name" required minLength={2} maxLength={180} value={values.name} onChange={update} placeholder="Nome e sobrenome" /></label>
            <label>Empresa <span>opcional</span><input name="company" autoComplete="organization" maxLength={180} value={values.company} onChange={update} placeholder="Nome da empresa" /></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" maxLength={254} value={values.email} onChange={update} placeholder="voce@empresa.com" /></label>
            <label>Telefone <span>opcional</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} value={values.phone} onChange={update} placeholder="(11) 99999-9999" /></label>
            <label className="public-lead-message">Como podemos ajudar? <span>opcional</span><textarea name="message" rows={4} maxLength={4000} value={values.message} onChange={update} placeholder="Conte brevemente sobre seu projeto ou necessidade" /></label>
          </div>
          <label className="public-lead-consent"><input name="contactConsent" type="checkbox" required checked={values.contactConsent} onChange={update} /><span>Autorizo a equipe Focusshub a usar meus dados para responder a esta solicitação. Li a <a href="/privacy" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span></label>
          <label className="public-lead-consent optional"><input name="marketingConsent" type="checkbox" checked={values.marketingConsent} onChange={update} /><span>Quero receber novidades e comunicações comerciais. Posso cancelar quando quiser.</span></label>
          <div className="public-lead-trap" aria-hidden="true"><label>Não preencha este campo<input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={update} /></label></div>
          {error && <p className="public-lead-error" role="alert"><CircleAlert size={16} />{error}</p>}
          <button className="public-lead-submit" type="submit" disabled={state === 'sending'}>{state === 'sending' ? <><LoaderCircle className="public-lead-spinner" size={17} />Enviando…</> : <>Enviar solicitação<ArrowRight size={17} /></>}</button>
          <p className="public-lead-footnote"><ShieldCheck size={15} /> Seus dados são usados para atender sua solicitação.</p>
        </form>
      </>}
    </section>
    <footer className="public-lead-footer">Focusshub · Focuss Dev <a href="/terms">Termos de Uso</a></footer>
  </main>;
}
