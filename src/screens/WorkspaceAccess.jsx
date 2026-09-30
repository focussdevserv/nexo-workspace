import React, { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { apiRequest, parseApiResponse } from '../lib/workspace-api.js';
import './workspace-access.css';

export default function WorkspaceAccess({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: 'contato@focussdev.art', password: '' });

  useEffect(() => {
    sessionStorage.removeItem('nexo.api.token');
    sessionStorage.removeItem('nexo.api.user');
    const onExpired = () => { sessionStorage.removeItem('nexo.api.user'); setUser(null); setChecking(false); setError('Sua sessao expirou. Entre novamente.'); };
    window.addEventListener('nexo:session-expired', onExpired);
    let active = true;
    apiRequest('/api/auth/me').then((response) => { if (active) { const profile = { ...response.user, organizationName: response.organization?.name }; sessionStorage.setItem('nexo.api.user', JSON.stringify(profile)); setUser(profile); } })
      .catch((err) => { if (active) { sessionStorage.removeItem('nexo.api.user'); setUser(null); if (/API do Nexo|conectar à API/i.test(err.message || '')) setError(err.message); } })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; window.removeEventListener('nexo:session-expired', onExpired); };
  }, []);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }),
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) throw new Error(payload.message || 'Nao foi possivel entrar. Confira seus dados.');
      const profile = { ...payload.user, organizationName: payload.organization?.name };
      sessionStorage.setItem('nexo.api.user', JSON.stringify(profile));
      setUser(profile);
      setForm((current) => ({ ...current, password: '' }));
    } catch (err) { setError(err.message || 'Falha ao conectar com o servidor.'); }
    finally { setBusy(false); }
  };

  if (checking) return <div className="workspace-access-loading"><LoaderCircle className="spin" size={24} /><span>Verificando sua sessao...</span></div>;
  if (user) return <>{children}</>;

  return <main className="workspace-access-page"><section className="workspace-access-card" aria-labelledby="workspace-login-title">
    <div className="workspace-access-brand"><span className="brand-glyph"><i /><b /><em /></span><strong>nexo</strong><small>WORKSPACE</small></div>
    <span className="workspace-access-icon"><LockKeyhole size={18} /></span>
    <p className="eyebrow">ACESSO PRIVADO</p>
    <h1 id="workspace-login-title">Entre no seu workspace</h1>
    <p className="workspace-access-description">Clientes, projetos e cobrancas da FocussDev protegidos em um unico lugar.</p>
    <form onSubmit={submit}>
      <label htmlFor="workspace-email">E-mail<input id="workspace-email" name="email" type="email" autoCapitalize="none" autoCorrect="off" spellCheck="false" autoComplete="username" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label htmlFor="workspace-password">Senha<input id="workspace-password" name="password" type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      {error && <p className="workspace-access-error" role="alert">{error}</p>}
      <button className="admin-primary workspace-access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{busy ? 'Verificando...' : 'Entrar'}<ArrowRight size={15} /></button>
    </form>
    <div className="workspace-access-restricted"><ShieldCheck size={15} /><span>Acesso restrito a conta proprietaria. O cadastro de novas contas esta desativado.</span></div>
  </section></main>;
}
