import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Globe2, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { apiRequest } from '../lib/workspace-api.js';
import { publicLeadFormManagerState } from '../lib/public-lead-form.js';
import './public-lead-manager.css';

export default function PublicLeadFormManager({ isOwner, localDemo }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (!isOwner) return null;
  const state = publicLeadFormManagerState({ isOwner, localDemo });
  async function load() {
    setOpen(true); setError(''); setNotice('');
    if (!state.available) return;
    setLoading(true);
    try { const result = await apiRequest('/api/workspace/crm/public-lead-form'); setConfig(result.data); }
    catch (cause) { setError(cause.message || 'Não foi possível carregar o formulário.'); }
    finally { setLoading(false); }
  }
  async function toggleEnabled() {
    if (!state.available || !config || saving) return;
    setSaving(true); setError(''); setNotice('');
    try { const result = await apiRequest('/api/workspace/crm/public-lead-form', { method: 'PUT', body: JSON.stringify({ enabled: !config.enabled }) }); setConfig(result.data); setNotice(result.data.enabled ? 'Formulário ativado.' : 'Formulário desativado.'); }
    catch (cause) { setError(cause.message || 'Não foi possível salvar a configuração.'); }
    finally { setSaving(false); }
  }
  const publicUrl = config?.slug ? `${window.location.origin}/captura/${encodeURIComponent(config.slug)}` : '';
  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setNotice('Link copiado.'); }
    catch { setError('Não foi possível copiar automaticamente. Selecione e copie o link exibido.'); }
  }
  return <>
    <button type="button" className="com-secondary public-lead-manager-trigger" onClick={load}><Globe2 size={15} /> Formulário público</button>
    {open && <div className="com-modal-backdrop public-lead-manager-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setOpen(false); }}><section className="com-create-modal public-lead-manager" role="dialog" aria-modal="true" aria-labelledby="public-lead-manager-title">
      <header><div><small>CAPTAÇÃO DE CONTATOS</small><h2 id="public-lead-manager-title">Formulário público de leads</h2><p>Compartilhe um link para receber solicitações diretamente no CRM.</p></div><button type="button" aria-label="Fechar" onClick={() => setOpen(false)} disabled={saving}><X size={15} /></button></header>
      {!state.available ? <div className="public-lead-manager-demo" role="note"><ShieldCheck size={18} /><span>Disponível no workspace conectado. A demonstração local não cria nem altera formulários reais.</span></div> : loading ? <div className="public-lead-manager-state" role="status"><LoaderCircle className="public-lead-manager-spinner" size={18} />Carregando configuração…</div> : error && !config ? <div className="public-lead-manager-state" role="alert"><span>{error}</span><button type="button" className="com-secondary" onClick={load}>Tentar novamente</button></div> : <>
        <div className="public-lead-manager-status"><span className={`public-lead-manager-dot ${config?.enabled ? 'active' : ''}`} /><div><b>{config?.enabled ? 'Formulário ativo' : 'Formulário desativado'}</b><small>{config?.enabled ? 'Pessoas com o link podem enviar solicitações.' : 'Ative para começar a receber solicitações.'}</small></div></div>
        {publicUrl && <label className="public-lead-manager-link-label">Link público<input readOnly value={publicUrl} onFocus={event => event.target.select()} aria-label="Link do formulário público" /></label>}
        {error && <p className="public-lead-manager-error" role="alert">{error}</p>}{notice && <p className="public-lead-manager-notice" role="status"><Check size={14} />{notice}</p>}
        <footer><button type="button" className="com-secondary" disabled={saving || loading} onClick={toggleEnabled}>{saving ? 'Salvando…' : config?.enabled ? 'Desativar formulário' : 'Ativar formulário'}</button>{publicUrl && <><button type="button" className="com-secondary" onClick={copyLink}><Copy size={14} />Copiar link</button><a className="com-primary" href={publicUrl} target="_blank" rel="noreferrer">Abrir formulário<ExternalLink size={14} /></a></>}</footer>
      </>}
    </section></div>}
  </>;
}
