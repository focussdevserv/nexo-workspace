import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ArrowRight, KeyRound, LoaderCircle, LockKeyhole, Moon, ShieldCheck, Sun } from 'lucide-react';
import { apiRequest, parseApiResponse } from '../lib/workspace-api.js';
import { publishWorkspacePreferences, readCachedWorkspacePreferences, rememberWorkspaceThemePreference } from '../lib/workspace-preferences.js';
import './workspace-access.css';

function readInviteToken() {
  const queryToken = new URLSearchParams(window.location.search).get('invite');
  if (queryToken) return queryToken;
  const hash = window.location.hash.slice(1);
  return new URLSearchParams(hash).get('invite') || '';
}

export default function WorkspaceAccess({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [inviteToken, setInviteToken] = useState(() => readInviteToken());
  const [invitePassword, setInvitePassword] = useState('');
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState('');
  const [darkMode, setDarkMode] = useState(() => readCachedWorkspacePreferences().darkMode);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  const toggleTheme = () => {
    const next = !darkMode;
    rememberWorkspaceThemePreference(next);
    setDarkMode(next);
    publishWorkspacePreferences({ ...readCachedWorkspacePreferences(), darkMode: next });
  };

  useEffect(() => {
    if (!user) document.title = 'Focusshub · Entrar';
  }, [user]);

  useEffect(() => {
    if (inviteToken) { setChecking(false); return undefined; }
    sessionStorage.removeItem('nexo.api.token');
    sessionStorage.removeItem('nexo.api.user');
    const onExpired = () => { sessionStorage.removeItem('nexo.api.user'); setUser(null); setChecking(false); setError('Sua sessao expirou. Entre novamente.'); };
    window.addEventListener('nexo:session-expired', onExpired);
    let active = true;
    apiRequest('/api/auth/me').then((response) => { if (active) { const profile = { ...response.user, organizationName: response.organization?.name }; sessionStorage.setItem('nexo.api.user', JSON.stringify(profile)); setUser(profile); } })
      .catch((err) => { if (active) { sessionStorage.removeItem('nexo.api.user'); setUser(null); if (/API do Focusshub|conectar à API/i.test(err.message || '')) setError((err.message || '').replace(/Nexo/g, 'Focusshub')); } })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; window.removeEventListener('nexo:session-expired', onExpired); };
  }, [inviteToken]);

  const acceptInvite = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    if (invitePassword !== invitePasswordConfirm) { setBusy(false); setError('As senhas não conferem.'); return; }
    try {
      const response = await fetch('/api/auth/accept-invite', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: inviteToken, password: invitePassword }) });
      const payload = await parseApiResponse(response);
      if (!response.ok) throw new Error(payload.message || 'Não foi possível ativar a conta.');
      const profile = { ...payload.user, organizationName: payload.organization?.name };
      sessionStorage.setItem('nexo.api.user', JSON.stringify(profile));
      const url = new URL(window.location.href); url.searchParams.delete('invite'); if (new URLSearchParams(url.hash.slice(1)).has('invite')) url.hash = ''; window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      setUser(profile); setInviteToken(''); setInvitePassword(''); setInvitePasswordConfirm('');
    } catch (err) { setError(err.message || 'Não foi possível aceitar o convite.'); }
    finally { setBusy(false); }
  };

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }),
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) throw new Error(payload.message || 'Não foi possível entrar. Confira seus dados.');
      const profile = { ...payload.user, organizationName: payload.organization?.name };
      sessionStorage.setItem('nexo.api.user', JSON.stringify(profile));
      setUser(profile);
      setForm((current) => ({ ...current, password: '' }));
    } catch (err) { setError(err.message || 'Falha ao conectar com o servidor.'); }
    finally { setBusy(false); }
  };

  if (checking) return <div className="workspace-access-loading"><LoaderCircle className="spin" size={24} /><span>Verificando sua sessão...</span></div>;
  if (user) return <>{children}</>;
  if (inviteToken) return <main className="workspace-access-page"><button className="workspace-theme-toggle" type="button" onClick={toggleTheme} aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} title={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}<span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span></button><section className="workspace-access-card" aria-labelledby="workspace-invite-title"><div className="workspace-access-brand"><span className="brand-glyph"><i /><b /><em /></span><strong>Focusshub</strong><small>WORKSPACE</small></div><span className="workspace-access-icon"><ShieldCheck size={18} /></span><p className="eyebrow">CONVITE DE EQUIPE</p><h1 id="workspace-invite-title">Ative seu acesso</h1><p className="workspace-access-description">Crie uma senha com pelo menos 12 caracteres. Este link pode ser usado uma vez e expira em 48 horas.</p><form onSubmit={acceptInvite}><label htmlFor="invite-password">Nova senha<input id="invite-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} /></label><label htmlFor="invite-password-confirm">Confirme a senha<input id="invite-password-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={invitePasswordConfirm} onChange={(event) => setInvitePasswordConfirm(event.target.value)} /></label>{error && <p className="workspace-access-error" role="alert">{error}</p>}<button className="admin-primary workspace-access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{busy ? 'Ativando...' : 'Ativar acesso'}<ArrowRight size={15} /></button><button type="button" className="workspace-access-switch" disabled={busy} onClick={() => { const url = new URL(window.location.href); url.searchParams.delete('invite'); if (new URLSearchParams(url.hash.slice(1)).has('invite')) url.hash = ''; window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); setInviteToken(''); setError(''); }}>Voltar para entrar</button></form></section></main>;

  return <main className="workspace-access-page"><button className="workspace-theme-toggle" type="button" onClick={toggleTheme} aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} title={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}<span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span></button><section className="workspace-access-card" aria-labelledby="workspace-login-title">
    <div className="workspace-access-brand"><span className="brand-glyph"><i /><b /><em /></span><strong>Focusshub</strong><small>WORKSPACE</small></div>
    <span className="workspace-access-icon"><LockKeyhole size={18} /></span>
    <p className="eyebrow">ACESSO PRIVADO</p>
    <h1 id="workspace-login-title">Entre no seu workspace</h1>
    <p className="workspace-access-description">Clientes, projetos e cobranças da FocussDev protegidos em um só lugar.</p>
    <form onSubmit={submit}>
      <label htmlFor="workspace-email">E-mail<input id="workspace-email" name="email" type="email" autoCapitalize="none" autoCorrect="off" spellCheck="false" autoComplete="username" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label htmlFor="workspace-password">Senha<input id="workspace-password" name="password" type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      {error && <p className="workspace-access-error" role="alert">{error}</p>}
      <button className="admin-primary workspace-access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{busy ? 'Verificando...' : 'Entrar'}<ArrowRight size={15} /></button>
    </form>
    <div className="workspace-access-restricted"><ShieldCheck size={15} /><span>Acesso por convite da pessoa proprietária. Se já tem conta, entre com seu e-mail e senha.</span></div>
  </section></main>;
}
