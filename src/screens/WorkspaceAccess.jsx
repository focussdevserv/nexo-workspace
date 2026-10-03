import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ArrowRight, KeyRound, LoaderCircle, LockKeyhole, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { apiRequest, parseApiResponse } from '../lib/workspace-api.js';
import { activateLocalDemo, getLocalDemoUser, isLocalDemoActive, isLocalDemoRequested } from '../lib/local-demo.js';
import { applyWorkspaceTheme, publishWorkspacePreferences, readCachedWorkspacePreferences, rememberWorkspaceThemePreference } from '../lib/workspace-preferences.js';
import { normalizeAuthEmail, passwordConfirmationMatches, prefillRecoveryEmail, readPasswordResetToken, readWorkspaceAccessMode, readWorkspaceInvite, shouldAutoEnterLocalDemo, stripWorkspaceAccessTokens, workspaceAccessModeUrl } from './workspace-access-helpers.js';
import './workspace-access.css';

function isValidWorkspaceProfile(profile) {
  return Boolean(profile && typeof profile === 'object' && ['owner', 'admin', 'member'].includes(profile.role));
}

function AccessBrandPanel() {
  return <aside className="workspace-access-showcase" aria-label="Focusshub workspace">
    <div className="workspace-access-showcase-brand"><span className="brand-glyph"><i /><b /><em /></span><strong>Focusshub</strong><small>WORKSPACE</small></div>
    <div className="workspace-access-showcase-copy"><span>Seu ambiente de trabalho</span><h2>Uma rotina clara para a agência avançar.</h2><p>Clientes, projetos e financeiro com contexto e próximos passos no mesmo lugar.</p></div>
    <div className="workspace-access-capabilities" aria-label="Áreas do Focusshub"><span>CRM</span><span>Projetos</span><span>Financeiro</span></div>
    <div className="workspace-access-showcase-foot"><i aria-hidden="true" />Acesso privado para sua equipe</div>
  </aside>;
}

export default function WorkspaceAccess({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const [retryingSession, setRetryingSession] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', rememberMe: true });
  const [invite, setInvite] = useState(() => readWorkspaceInvite(window.location.search, window.location.hash));
  const inviteToken = invite.token;
  const [suppressDemoAutologin, setSuppressDemoAutologin] = useState(false);
  const [resetToken, setResetToken] = useState(() => readPasswordResetToken(window.location.hash));
  const [accessMode, setAccessMode] = useState(() => readWorkspaceAccessMode(window.location.hash));
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState('');
  const [darkMode, setDarkMode] = useState(() => readCachedWorkspacePreferences().darkMode);

  useLayoutEffect(() => {
    applyWorkspaceTheme(darkMode);
  }, [darkMode]);

  const toggleTheme = () => {
    const next = !darkMode;
    rememberWorkspaceThemePreference(next);
    setDarkMode(next);
    publishWorkspacePreferences({ ...readCachedWorkspacePreferences(), darkMode: next });
  };

  useEffect(() => {
    if (!user) document.title = accessMode === 'reset-complete' ? 'Focusshub · Redefinir senha' : accessMode === 'reset-request' ? 'Focusshub · Recuperar acesso' : 'Focusshub · Entrar';
  }, [user, accessMode]);

  useEffect(() => {
    const sanitizedUrl = stripWorkspaceAccessTokens(window.location.href);
    if (sanitizedUrl !== window.location.href) {
      window.history.replaceState(window.history.state, '', sanitizedUrl);
    }
  }, []);

  useEffect(() => {
    const syncAccessMode = () => setAccessMode(readWorkspaceAccessMode(window.location.hash));
    window.addEventListener('popstate', syncAccessMode);
    return () => window.removeEventListener('popstate', syncAccessMode);
  }, []);

  const navigateAccessMode = (mode, replace = false) => {
    const nextUrl = workspaceAccessModeUrl(window.location.href, mode);
    window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', nextUrl);
    setAccessMode(mode);
  };

  useEffect(() => {
    if (inviteToken || invite.invalid || resetToken || accessMode === 'reset-invalid') { setChecking(false); return undefined; }
    if (suppressDemoAutologin) {
      sessionStorage.removeItem('nexo.api.token');
      sessionStorage.removeItem('nexo.api.user');
      setUser(null);
      setChecking(false);
      setError('');
      return undefined;
    }
    if (shouldAutoEnterLocalDemo({ requested: isLocalDemoRequested(), active: isLocalDemoActive() })) {
      activateLocalDemo();
      const profile = getLocalDemoUser();
      sessionStorage.setItem('nexo.api.user', JSON.stringify(profile));
      setUser(profile);
      setChecking(false);
      return undefined;
    }
    sessionStorage.removeItem('nexo.api.token');
    sessionStorage.removeItem('nexo.api.user');
    const onExpired = () => { sessionStorage.removeItem('nexo.api.token'); sessionStorage.removeItem('nexo.api.user'); setUser(null); setChecking(false); setSessionCheckFailed(false); setError('Sua sessão expirou. Entre novamente.'); };
    window.addEventListener('nexo:session-expired', onExpired);
    let active = true;
    apiRequest('/api/auth/me').then((response) => { if (active) { if (!isValidWorkspaceProfile(response.user)) throw new Error('Perfil de acesso invalido. Faca login novamente ou contate a pessoa proprietaria.'); const profile = { ...response.user, organizationName: response.organization?.name }; sessionStorage.setItem('nexo.api.user', JSON.stringify(profile)); setUser(profile); } })
      .catch((err) => { if (active) { sessionStorage.removeItem('nexo.api.user'); setUser(null); const authFailure = err.code === 'unauthorized' || err.code === 'forbidden' ; if (!authFailure) { setSessionCheckFailed(true); setError(err.message || 'Nao foi possivel verificar a sessao. Tente novamente.'); } } })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; window.removeEventListener('nexo:session-expired', onExpired); };
  }, [accessMode, invite.invalid, inviteToken, resetToken, suppressDemoAutologin]);

  const retrySessionCheck = async () => {
    setRetryingSession(true); setError('');
    try {
      const response = await apiRequest('/api/auth/me');
      if (!isValidWorkspaceProfile(response.user)) throw new Error('Perfil de acesso invalido. Faca login novamente ou contate a pessoa proprietaria.');
      const profile = { ...response.user, organizationName: response.organization?.name };
      sessionStorage.setItem('nexo.api.user', JSON.stringify(profile)); setUser(profile); setSessionCheckFailed(false);
    } catch (err) {
      const authFailure = err.code === 'unauthorized' || err.code === 'forbidden' ;
      setSessionCheckFailed(!authFailure); setError(authFailure ? 'Nenhuma sessao ativa encontrada. Entre com seu e-mail e senha.' : (err.message || 'Nao foi possivel verificar a sessao. Tente novamente.'));
    } finally { setRetryingSession(false); }
  };

  const acceptInvite = async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    if (!passwordConfirmationMatches(invitePassword, invitePasswordConfirm)) { setBusy(false); setError('As senhas não conferem.'); return; }
    try {
      const response = await fetch('/api/auth/accept-invite', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: inviteToken, password: invitePassword }) });
      const payload = await parseApiResponse(response);
      if (response.ok && !isValidWorkspaceProfile(payload.user)) throw new Error('Perfil de acesso invalido. Faca login novamente ou contate a pessoa proprietaria.');
      if (!response.ok) throw new Error(payload.message || 'Não foi possível ativar a conta.');
      const profile = { ...payload.user, organizationName: payload.organization?.name };
      sessionStorage.setItem('nexo.api.user', JSON.stringify(profile));
      const url = new URL(window.location.href); url.searchParams.delete('invite'); if (new URLSearchParams(url.hash.slice(1)).has('invite')) url.hash = ''; window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      setUser(profile); setSessionCheckFailed(false); setInvite({ token: '', invalid: false }); setInvitePassword(''); setInvitePasswordConfirm('');
    } catch (err) { setError(err.message || 'Não foi possível aceitar o convite.'); }
    finally { setBusy(false); }
  };

  const submit = async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizeAuthEmail(form.email), password: form.password, rememberMe: form.rememberMe }),
      });
      const payload = await parseApiResponse(response);
      if (response.ok && !isValidWorkspaceProfile(payload.user)) throw new Error('Perfil de acesso invalido. Faca login novamente ou contate a pessoa proprietaria.');
      if (!response.ok) throw new Error(payload.message || 'Não foi possível entrar. Confira seus dados.');
      const profile = { ...payload.user, organizationName: payload.organization?.name };
      sessionStorage.setItem('nexo.api.user', JSON.stringify(profile));
      setUser(profile);
      setSessionCheckFailed(false);
      setForm((current) => ({ ...current, password: '' }));
    } catch (err) { setError(err.message || 'Falha ao conectar com o servidor.'); }
    finally { setBusy(false); }
  };

  const startLocalDemo = () => {
    activateLocalDemo();
    const profile = getLocalDemoUser();
    sessionStorage.removeItem('nexo.api.token');
    sessionStorage.setItem('nexo.api.user', JSON.stringify(profile));
    setError('');
    setSessionCheckFailed(false);
    setUser(profile);
  };

  const requestPasswordReset = async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setResetNotice('');
    try {
      const response = await fetch('/api/auth/password-reset/request', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: normalizeAuthEmail(resetEmail) }) });
      const payload = await parseApiResponse(response);
      if (!response.ok) throw new Error(payload.message || 'Não foi possível solicitar a redefinição agora.');
      setResetNotice(payload.message || 'Se o e-mail pertencer a uma conta ativa, enviaremos as instruções para redefinir a senha.');
    } catch (err) { setError(err.message || 'Não foi possível solicitar a redefinição agora.'); }
    finally { setBusy(false); }
  };

  const completePasswordReset = async (event) => {
    event.preventDefault(); if (busy) return; setError('');
    if (!passwordConfirmationMatches(resetPassword, resetPasswordConfirm)) { setError('As senhas não conferem.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/password-reset/complete', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, password: resetPassword }) });
      const payload = await parseApiResponse(response);
      if (!response.ok) throw new Error(payload.message || 'Não foi possível redefinir a senha.');
      if (!isValidWorkspaceProfile(payload.user)) throw new Error('Perfil de acesso inválido. Entre novamente.');
      const profile = { ...payload.user, organizationName: payload.organization?.name };
      if (new URLSearchParams(window.location.hash.slice(1)).has('reset')) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
      sessionStorage.setItem('nexo.api.user', JSON.stringify(profile));
      setUser(profile); setResetToken(''); setResetPassword(''); setResetPasswordConfirm(''); setResetNotice('Senha atualizada.');
    } catch (err) { setError(err.message || 'Não foi possível redefinir a senha.'); }
    finally { setBusy(false); }
  };

  const returnToLogin = () => { navigateAccessMode('login', true); setResetNotice(''); setError(''); setResetToken(''); setResetPassword(''); setResetPasswordConfirm(''); };

  if (checking) return <div className="workspace-access-loading"><LoaderCircle className="spin" size={24} /><span>Verificando sua sessão...</span></div>;
  if (user) return <>{children}</>;
  if (inviteToken || invite.invalid) return <main className="workspace-access-page"><button className="workspace-theme-toggle" type="button" onClick={toggleTheme} aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} title={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}<span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span></button><AccessBrandPanel /><section className="workspace-access-card" aria-labelledby="workspace-invite-title"><div className="workspace-access-brand"><span className="brand-glyph"><i /><b /><em /></span><strong>Focusshub</strong><small>WORKSPACE</small></div><span className="workspace-access-icon"><ShieldCheck size={18} /></span><p className="eyebrow">CONVITE DE EQUIPE</p><h1 id="workspace-invite-title">{invite.invalid ? 'Convite inválido' : 'Ative seu acesso'}</h1><p className="workspace-access-description">{invite.invalid ? 'Este link não contém um convite válido. Peça à pessoa proprietária para enviar um novo convite.' : 'Crie uma senha com pelo menos 12 caracteres. Este link pode ser usado uma vez e expira em 48 horas.'}</p>{invite.invalid ? <p className="workspace-access-error" role="alert">Não foi possível identificar o código deste convite.</p> : <form onSubmit={acceptInvite}><label htmlFor="invite-password">Nova senha<input id="invite-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} /></label><label htmlFor="invite-password-confirm">Confirme a senha<input id="invite-password-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={invitePasswordConfirm} onChange={(event) => setInvitePasswordConfirm(event.target.value)} /></label>{error && <p className="workspace-access-error" role="alert">{error}</p>}<button className="admin-primary workspace-access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{busy ? 'Ativando...' : 'Ativar acesso'}<ArrowRight size={15} /></button></form>}<button type="button" className="workspace-access-switch" disabled={busy} onClick={() => { setSuppressDemoAutologin(true); const url = new URL(window.location.href); url.searchParams.delete('invite'); const hash = new URLSearchParams(url.hash.slice(1)); hash.delete('invite'); url.hash = hash.toString(); window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); setInvite({ token: '', invalid: false }); setError(''); }}>Voltar para entrar</button></section></main>;

  if (resetToken || ['reset-request', 'reset-complete', 'reset-invalid'].includes(accessMode)) return <main className="workspace-access-page"><button className="workspace-theme-toggle" type="button" onClick={toggleTheme} aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} title={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}<span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span></button><AccessBrandPanel /><section className="workspace-access-card" aria-labelledby="workspace-reset-title"><div className="workspace-access-brand"><span className="brand-glyph"><i /><b /><em /></span><strong>Focusshub</strong><small>WORKSPACE</small></div><span className="workspace-access-icon"><KeyRound size={18} /></span><p className="eyebrow">RECUPERAÇÃO DE ACESSO</p><h1 id="workspace-reset-title">{accessMode === 'reset-complete' ? 'Crie uma nova senha' : accessMode === 'reset-invalid' ? 'Link de recuperação inválido' : 'Redefina sua senha'}</h1><p className="workspace-access-description">{accessMode === 'reset-complete' ? 'Escolha uma senha com pelo menos 12 caracteres. O link pode ser usado uma vez e expira em 30 minutos.' : accessMode === 'reset-invalid' ? 'Este link não contém um código de recuperação válido. Solicite um novo link para continuar.' : 'Informe o e-mail da sua conta. Se ela estiver ativa e a recuperação estiver funcionando, enviaremos um link. Caso não receba, contate a pessoa administradora do workspace.'}</p>{accessMode === 'reset-invalid' ? <p className="workspace-access-error" role="alert">Não é possível redefinir a senha com este link.</p> : accessMode === 'reset-request' ? <form onSubmit={requestPasswordReset}><label htmlFor="reset-email">E-mail<input id="reset-email" type="email" autoComplete="email" required disabled={busy} value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} /></label>{error && <p className="workspace-access-error" role="alert">{error}</p>}{resetNotice && <p className="workspace-access-success" role="status">{resetNotice}</p>}<button className="admin-primary workspace-access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{busy ? 'Enviando...' : 'Enviar link de recuperação'}<ArrowRight size={15} /></button></form> : <form onSubmit={completePasswordReset}><label htmlFor="reset-password">Nova senha<input id="reset-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /></label><label htmlFor="reset-password-confirm">Confirme a senha<input id="reset-password-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={resetPasswordConfirm} onChange={(event) => setResetPasswordConfirm(event.target.value)} /></label>{error && <p className="workspace-access-error" role="alert">{error}</p>}<button className="admin-primary workspace-access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{busy ? 'Atualizando...' : 'Salvar nova senha'}<ArrowRight size={15} /></button></form>}<button type="button" className="workspace-access-switch" disabled={busy} onClick={returnToLogin}>Voltar para entrar</button></section></main>;

  return <main className="workspace-access-page"><button className="workspace-theme-toggle" type="button" onClick={toggleTheme} aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} title={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}<span>{darkMode ? 'Modo claro' : 'Modo escuro'}</span></button><AccessBrandPanel /><section className="workspace-access-card" aria-labelledby="workspace-login-title">
    <div className="workspace-access-brand"><span className="brand-glyph"><i /><b /><em /></span><strong>Focusshub</strong><small>WORKSPACE</small></div>
    <span className="workspace-access-icon"><LockKeyhole size={18} /></span>
    <p className="eyebrow">ACESSO PRIVADO</p>
    <h1 id="workspace-login-title">Entre no seu workspace</h1>
    <p className="workspace-access-description">Clientes, projetos e cobranças do seu workspace, protegidos em um só lugar.</p>
    <form onSubmit={submit}>
      <label htmlFor="workspace-email">E-mail<input id="workspace-email" name="email" type="email" autoCapitalize="none" autoCorrect="off" spellCheck="false" autoComplete="username" required disabled={busy} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label htmlFor="workspace-password">Senha<input id="workspace-password" name="password" type="password" autoComplete="current-password" required disabled={busy} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      <label className="workspace-remember" htmlFor="workspace-remember"><input id="workspace-remember" type="checkbox" checked={form.rememberMe} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, rememberMe: event.target.checked }))} /><span><b>Manter conectado por 30 dias</b><small>Somente neste dispositivo. Desmarque para uma sessão de até 8 horas.</small></span></label>
      {error && <p className="workspace-access-error" role="alert">{error}</p>}
      <button type="button" className="workspace-access-switch workspace-access-forgot" disabled={busy} onClick={() => { setResetEmail(prefillRecoveryEmail(form.email)); navigateAccessMode('reset-request'); setError(''); setResetNotice(''); }}>Esqueci minha senha</button>
      {sessionCheckFailed && <button type="button" className="workspace-access-retry" onClick={retrySessionCheck} disabled={retryingSession}>{retryingSession ? <LoaderCircle className="spin" size={14} /> : null}{retryingSession ? 'Verificando sessao...' : 'Tentar verificar novamente'}</button>}
      <button className="admin-primary workspace-access-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{busy ? 'Verificando...' : 'Entrar'}<ArrowRight size={15} /></button>
    </form>
    <button type="button" className="workspace-access-demo" onClick={startLocalDemo} disabled={busy} aria-label="Explorar Focusshub com dados de demonstração local"><Sparkles size={15} /><span><b>Explorar com dados de demonstração</b><small>Exemplos fictícios neste navegador. Nenhuma alteração chega ao workspace ou a serviços externos.</small></span><ArrowRight size={15} /></button>
    <div className="workspace-access-restricted"><ShieldCheck size={15} /><span>Acesso por convite da pessoa proprietária. Se já tem conta, entre com seu e-mail e senha.</span></div>
  </section></main>;
}
