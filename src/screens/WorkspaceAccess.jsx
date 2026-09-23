import React, { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, LoaderCircle, LockKeyhole } from 'lucide-react';
import { apiRequest } from '../lib/workspace-api.js';
import './workspace-access.css';

export default function WorkspaceAccess({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('nexo.api.token') || '');
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem('nexo.api.token')));
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ organizationName: '', name: '', email: '', password: '', bootstrapToken: '' });

  useEffect(() => {
    const onExpired = () => { setToken(''); setUser(null); setChecking(false); setError('Sua sessão expirou. Entre novamente.'); };
    window.addEventListener('nexo:session-expired', onExpired);
    return () => window.removeEventListener('nexo:session-expired', onExpired);
  }, []);

  useEffect(() => {
    if (!token) { setChecking(false); return; }
    let alive = true;
    apiRequest('/api/auth/me').then((response) => { if (alive) { const signedInUser = { ...response.user, organizationName: response.organization?.name }; setUser(signedInUser); sessionStorage.setItem('nexo.api.user', JSON.stringify(signedInUser)); } })
      .catch(() => { if (alive) { sessionStorage.removeItem('nexo.api.token'); sessionStorage.removeItem('nexo.api.user'); setToken(''); setUser(null); } })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [token]);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    const register = mode === 'register';
    try {
      const response = await fetch(register ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(register ? { 'x-bootstrap-token': form.bootstrapToken } : {}) },
        body: JSON.stringify(register ? { organizationName: form.organizationName, name: form.name, email: form.email, password: form.password } : { email: form.email, password: form.password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Não foi possível acessar a conta.');
      const signedInUser = { ...payload.user, organizationName: payload.organization?.name }; sessionStorage.setItem('nexo.api.token', payload.token); sessionStorage.setItem('nexo.api.user', JSON.stringify(signedInUser)); setToken(payload.token); setUser(signedInUser);
    } catch (err) { setError(err.message || 'Falha ao conectar com o servidor.'); }
    finally { setBusy(false); }
  };

  if (checking) return <div className="workspace-access-loading"><LoaderCircle className="spin" size={24} /><span>Conferindo sua sessão…</span></div>;
  if (token && user) return <>{children}</>;

  return <main className="workspace-access-page"><section className="workspace-access-card">
    <div className="workspace-access-brand"><span className="brand-glyph"><i /><b /><em /></span><strong>nexo</strong><small>WORKSPACE</small></div>
    <span className="workspace-access-icon"><LockKeyhole size={18} /></span>
    <p className="eyebrow">ESPAÇO DA SUA AGÊNCIA</p>
    <h1>{mode === 'login' ? 'Acesse seu workspace' : 'Configure o primeiro acesso'}</h1>
    <p className="workspace-access-description">Seus clientes, projetos e cobranças ficam protegidos na conta da empresa.</p>
    <form onSubmit={submit}>
      {mode === 'register' && <><label>Nome da empresa<input autoComplete="organization" required value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} /></label><label>Seu nome<input autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Token de ativação<input autoComplete="off" required value={form.bootstrapToken} onChange={(event) => setForm({ ...form, bootstrapToken: event.target.value })} /></label></>}
      <label>E-mail<input type="email" required autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Senha<input type="password" required minLength={mode === 'register' ? 12 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      {error && <p className="workspace-access-error" role="alert">{error}</p>}
      <button className="admin-primary workspace-access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{mode === 'login' ? 'Entrar' : 'Criar conta proprietária'}<ArrowRight size={15} /></button>
    </form>
    <button className="workspace-access-switch" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>{mode === 'login' ? 'Primeiro acesso? Criar conta da empresa' : 'Já tem conta? Entrar'}</button>
    {mode === 'register' && <small className="workspace-access-footnote">O token de ativação só autoriza a criação da primeira conta. Guarde sua senha em segurança.</small>}
  </section></main>;
}
