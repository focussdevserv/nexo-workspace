import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, CircleDollarSign, Copy, ExternalLink, FileCheck2, FolderKanban, MessageCircle, Send, ShieldCheck, X } from 'lucide-react';
import './client-portal.css';
import { apiRequest, useWorkspaceRecords } from '../lib/workspace-api.js';
import { isLocalDemoActive } from '../lib/local-demo.js';
import { appendSentPortalMessage, canSendPortalMessage, canSubmitPortalApprovalDecision, copyPortalLink, portalLinkActionLabel, shouldConfirmPortalLinkRotation, splitClientPortalApprovals } from '../lib/client-portal-actions.js';
import { recordBelongsToPortalClient } from '../lib/client-portal-scope.js';

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const relatedTo = (row, client) => Boolean(client?.id) && recordBelongsToPortalClient(row, client.id);

export function ClientPortalAdmin({ notify = () => {}, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const localDemo = isLocalDemoActive();
  const clients = useWorkspaceRecords('clients');
  const settingsStore = useWorkspaceRecords('settings');
  const savedBrandLogo = settingsStore.records.find((item) => item.key === 'workspace-preferences')?.settings?.workspace?.brandLogo || '';
  const projects = useWorkspaceRecords('projects');
  const tasks = useWorkspaceRecords('tasks');
  const contracts = useWorkspaceRecords('contracts');
  const [clientId, setClientId] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [portalActive, setPortalActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  useEffect(() => {
    if (navigationContext?.clientId && clients.records.some((item) => String(item.id) === String(navigationContext.clientId))) {
      setClientId(String(navigationContext.clientId));
      setPortalUrl('');
      onNavigationContextConsumed();
    }
  }, [navigationContext?.clientId, clients.records, onNavigationContextConsumed]);
  const client = clients.records.find((item) => String(item.id) === String(clientId)) || null;
  const previewErrors = [projects.error && 'projetos', tasks.error && 'tarefas', contracts.error && 'contratos'].filter(Boolean);
  const previewLoading = projects.loading || tasks.loading || contracts.loading;
  const refreshPreview = () => Promise.all([projects.refresh(), tasks.refresh(), contracts.refresh()]);
  useEffect(() => {
    const expiry = client?.portalTokenExpiresAt ? new Date(client.portalTokenExpiresAt).valueOf() : 0;
    const hasLegacyToken = Number(client?.portalTokenVersion || 0) > 0 && !client?.portalTokenRevokedAt;
    setPortalActive(Boolean((client?.portalTokenActive || hasLegacyToken) && (!expiry || expiry > Date.now())));
  }, [client?.id, client?.portalTokenActive, client?.portalTokenVersion, client?.portalTokenRevokedAt, client?.portalTokenExpiresAt]);
  const visibility = { project: true, tasks: true, contracts: true, ...(client?.portalVisibility || {}) };
  const clientProjects = useMemo(() => projects.records.filter((item) => client && relatedTo(item, client)), [projects.records, client]);
  const clientTasks = useMemo(() => tasks.records.filter((item) => client && relatedTo(item, client)), [tasks.records, client]);
  const clientContracts = useMemo(() => contracts.records.filter((item) => client && relatedTo(item, client)), [contracts.records, client]);
  const createLink = async () => {
    if (!client || !client.email || busy || localDemo || previewLoading || previewErrors.length) return;
    if (shouldConfirmPortalLinkRotation(portalActive) && !window.confirm('Gerar outro link invalida imediatamente o link atual. O cliente precisará receber e usar o novo link. Deseja continuar?')) return;
    setBusy(true);
    try { const result = await apiRequest(`/api/workspace/clients/${client.id}/portal-link`, { method: 'POST', body: '{}' }); setPortalUrl(result.data.url); setPortalActive(true); await clients.refresh().catch(() => {}); notify(`Link seguro criado; validade de ${result.data.expiresInDays || 90} dias.`); }
    catch (error) { notify(error.message || 'Não foi possível criar o link do portal.'); }
    finally { setBusy(false); }
  };
  const revokeLink = async () => {
    if (!client || busy || localDemo) return;
    setBusy(true);
    try { await apiRequest(`/api/workspace/clients/${client.id}/portal-link`, { method: 'DELETE' }); setPortalUrl(''); setPortalActive(false); await clients.refresh().catch(() => {}); notify('Acesso do portal revogado; links anteriores deixaram de funcionar.'); }
    catch (error) { notify(error.message || 'Nao foi possivel revogar o acesso.'); }
    finally { setBusy(false); }
  };
  const toggleVisibility = async (key) => {
    if (!client || savingVisibility) return;
    setSavingVisibility(true);
    try { await clients.update(client.id, { portalVisibility: { ...visibility, [key]: !visibility[key] } }); notify('Configuracoes do portal salvas.'); }
    catch (error) { notify(error.message || 'Nao foi possivel salvar as configuracoes.'); }
    finally { setSavingVisibility(false); }
  };
  const copyLink = async () => { try { await copyPortalLink(portalUrl); notify('Link copiado.'); } catch (error) { notify(error.message || 'Não foi possível copiar o link neste navegador.'); } };

  if (clients.loading && !clients.records.length) return <section className="cp-empty-state" role="status"><h2>Carregando clientes...</h2><p>Buscando clientes disponiveis neste workspace.</p></section>;
  if (clients.error && !clients.records.length) return <section className="cp-empty-state" role="alert"><h2>Nao foi possivel carregar os clientes</h2><p>{clients.error}</p><button className="admin-secondary" onClick={clients.refresh}>Tentar novamente</button></section>;
  if (!clients.records.length && !clients.loading) return <section className="cp-empty-state"><h2>Nenhum cliente cadastrado</h2><p>Cadastre um cliente no CRM para preparar o acesso ao portal.</p><button className="admin-primary" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Clientes' }))}>Abrir clientes <ArrowRight size={14} /></button></section>;
  return <div className="client-portal-admin">
    <div className="cp-admin-toolbar"><label>Cliente<select value={clientId} onChange={(event) => { setClientId(event.target.value); setPortalUrl(''); setPortalActive(false); }}><option value="">Selecione um cliente</option>{clients.records.map((item) => <option value={item.id} key={item.id}>{item.name || item.title}</option>)}</select></label><div><button className="admin-primary" disabled={!client || !client.email || busy || localDemo || previewLoading || previewErrors.length > 0} onClick={createLink}>{busy ? 'Gerando link…' : localDemo ? 'Link desativado na demonstração' : portalLinkActionLabel(portalActive)} <ShieldCheck size={14} /></button>{portalActive && <button className="admin-secondary" disabled={busy} onClick={revokeLink}><X size={14} />Revogar acesso</button>}{portalUrl && <><button className="admin-secondary" onClick={copyLink}><Copy size={14} />Copiar link</button><a className="admin-secondary" href={portalUrl} target="_blank" rel="noreferrer">Abrir portal <ExternalLink size={14} /></a></>}</div></div>
    {!client && <section className="cp-admin-empty"><span className="cp-admin-empty-icon"><ShieldCheck size={22} /></span><div><span className="cp-overline">PORTAL INDIVIDUAL E PROTEGIDO</span><h2>Escolha um cliente para preparar o portal</h2><p>Cada cliente recebe um link exclusivo, com validade de 90 dias. Antes de mostrar qualquer dado, o portal confirma a identidade com um código enviado ao e-mail já cadastrado.</p><ol><li>Selecione um cliente na lista acima.</li><li>Confira quais projetos, tarefas e contratos serão compartilhados.</li><li>Gere o link e envie ao cliente; o acesso só é liberado após a confirmação do código.</li></ol><aside><ShieldCheck size={16} />O envio do código exige o Resend configurado e habilitado nas integrações.</aside></div></section>}
    {client && <>
      {localDemo && <p className="cp-admin-auth-note">Prévia local: nenhum link externo será criado nem enviado. A geração de links fica desativada nesta demonstração.</p>}
      {!localDemo && <p className="cp-admin-auth-note">Este portal pede e-mail, CPF/CNPJ ou telefone e envia um código de uso único ao e-mail cadastrado. O envio requer Resend configurado e habilitado.{!client.email ? ' Cadastre um e-mail para gerar o link.' : ''}</p>}
      {previewLoading && <p className="cp-admin-auth-note" role="status">Carregando dados relacionados ao cliente para conferir o escopo do portal...</p>}
      {!!previewErrors.length && <div className="cp-admin-load-error" role="alert"><span>Falha ao carregar {previewErrors.join(', ')}. A geracao do link fica bloqueada ate a previa estar completa.</span><button type="button" className="admin-secondary" disabled={previewLoading} onClick={refreshPreview}>Tentar novamente</button></div>}
      <section className="cp-customize"><div><b>Conteudo compartilhado com {client.name}</b><small>Os dados vem do cadastro e dos registros relacionados no workspace.{savingVisibility ? ' Salvando...' : ''}</small></div><div className="cp-customize-controls">{[['project', 'Projetos'], ['tasks', 'Tarefas'], ['contracts', 'Contratos'], ['payments', 'Pagamentos'], ['approvals', 'Aprovações']].map(([key, label]) => <label key={key}><input type="checkbox" disabled={savingVisibility} checked={visibility[key] !== false} onChange={() => toggleVisibility(key)} />{label}</label>)}</div><small className="cp-customize-hint">Pagamentos e aprovações aparecem no portal público conforme estas opções.</small></section>
      <section className="cp-preview-shell"><header className="cp-preview-bar"><span className="cp-brand">{savedBrandLogo && <img width={28} height={28} src={savedBrandLogo} alt="" />}<i /> Portal do cliente</span><span className="cp-client-chip">{client.person || client.name} · {client.name}</span></header><div className="cp-welcome"><div><span className="cp-overline">ÁREA DO CLIENTE</span><h2>Olá, {(client.person || client.name || 'cliente').split(' ')[0]}</h2><p>Acompanhe seus projetos e documentos compartilhados pela Focuss Dev.</p></div><span className={`cp-online ${portalActive ? 'is-active' : 'is-preview'}`}><i />{portalActive ? 'Link ativo' : 'Prévia do portal'}</span></div><div className="cp-client-content"><div className="cp-cards-grid">
        {visibility.project && <article className="cp-info-card cp-project-card"><div className="cp-card-heading"><span className="cp-card-icon green"><FolderKanban size={17} /></span><small>PROJETOS</small></div><h3>{clientProjects.length} projeto(s)</h3><p>{clientProjects.filter((item) => !['Concluído', 'Entregue', 'Publicado'].includes(item.status)).map((item) => item.name || item.title).join(' · ') || 'Nenhum projeto aberto'}</p></article>}
        {visibility.contracts && <article className="cp-info-card"><div className="cp-card-heading"><span className="cp-card-icon blue"><FileCheck2 size={17} /></span><small>CONTRATOS</small></div><h3>{clientContracts.length} documento(s)</h3><p>{clientContracts.map((item) => `${item.title || item.name} · ${item.status}`).join(' · ') || 'Nenhum contrato cadastrado'}</p></article>}
        {visibility.tasks && <article className="cp-info-card"><div className="cp-card-heading"><span className="cp-card-icon amber"><CheckCircle2 size={17} /></span><small>PRÓXIMAS ENTREGAS</small></div><h3>{clientTasks.filter((item) => !['Concluída', 'Concluido'].includes(item.status)).length} tarefa(s)</h3><p>{clientTasks.filter((item) => !['Concluída', 'Concluido'].includes(item.status)).slice(0, 3).map((item) => item.title).join(' · ') || 'Nenhuma pendência compartilhada'}</p></article>}
      </div></div></section>
      {portalUrl && <p className="cp-preview-note">O link contém um token de acesso individual e expira em 90 dias. Gere outro se precisar revogá-lo.</p>}
    </>}
  </div>;
}

export function PublicClientPortal({ slug }) {
  useEffect(() => { document.title = 'Focusshub \u00b7 Portal do cliente'; }, []);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sentMessages, setSentMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [approvalNotes, setApprovalNotes] = useState({});
  const [accessToken, setAccessToken] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationStep, setVerificationStep] = useState('identify');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const noticeTimer = useRef(null);
  React.useEffect(() => {
    let active = true;
    const controller = new window.AbortController();
    setLoading(true);
    setError('');
    setData(null);
    setSentMessages([]);
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    fetch(`/api/public/client-portal/${encodeURIComponent(slug)}`, { credentials: 'same-origin', headers, signal: controller.signal }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401 && payload.error === 'portal_verification_required') { if (active) { setRequiresVerification(true); setError(''); setData(null); } return; }
      if (!response.ok) throw new Error(payload.message || 'Este link do portal não é válido.');
      if (active) { setData(payload.data); setError(''); setRequiresVerification(false); }
    }).catch((err) => { if (active && err.name !== 'AbortError') { setError(err.message || 'Este link do portal não é válido.'); setData(null); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [slug, accessToken, reloadVersion]);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  const portalRequest = async (path, options = {}) => {
    const response = await fetch(path, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && payload.error === 'portal_verification_required') { setRequiresVerification(true); setData(null); setAccessToken(''); }
    if (!response.ok) throw new Error(payload.message || 'Não foi possível concluir a solicitação.');
    return payload;
  };
  const requestCode = async (event) => {
    event.preventDefault(); setVerificationBusy(true);
    try { const result = await portalRequest(`/api/public/client-portal/${encodeURIComponent(slug)}/request-code`, { method: 'POST', body: JSON.stringify({ identifier }) }); setChallengeId(result.data.challengeId); setVerificationStep('code'); flash(`${result.data.message}`); }
    catch (err) { flash(err.message || 'Não foi possível solicitar o código.'); }
    finally { setVerificationBusy(false); }
  };
  const verifyCode = async (event) => {
    event.preventDefault(); setVerificationBusy(true);
    try { const result = await portalRequest(`/api/public/client-portal/${encodeURIComponent(slug)}/verify-code`, { method: 'POST', body: JSON.stringify({ challengeId, code: verificationCode }) }); setAccessToken(result.data.accessToken); setVerificationCode(''); setError(''); setLoading(true); }
    catch (err) { flash(err.message || 'Codigo incorreto ou expirado.'); }
    finally { setVerificationBusy(false); }
  };
  const client = data?.client;
  const flash = (text) => { setNotice(text); window.clearTimeout(noticeTimer.current); noticeTimer.current = window.setTimeout(() => setNotice(''), 3500); };
  const copyPixCode = async (code) => {
    try { await navigator.clipboard.writeText(code); flash('Codigo Pix copiado.'); }
    catch { flash('Nao foi possivel copiar o codigo Pix neste navegador.'); }
  };
  const sendMessage = async (event) => {
    event.preventDefault();
    if (!canSendPortalMessage(message, busy)) { flash('Escreva sua mensagem antes de enviar.'); return; }
    setBusy(true);
    try { const result = await portalRequest(`/api/public/client-portal/${encodeURIComponent(slug)}/messages`, { method: 'POST', body: JSON.stringify({ message: message.trim() }) }); setSentMessages((current) => appendSentPortalMessage(current, message, result.data?.id)); setMessage(''); flash('Mensagem enviada para a equipe.'); }
    catch (err) { flash(err.message || 'Não foi possível enviar sua mensagem.'); }
    finally { setBusy(false); }
  };
  const decide = async (approval, decision) => {
    if (decision === 'changes_requested' && String(approvalNotes[approval.id] || '').trim().length < 3) { flash('Escreva pelo menos 3 caracteres explicando o ajuste solicitado.'); return; }
    setBusy(true);
    try {
      await portalRequest(`/api/public/client-portal/${encodeURIComponent(slug)}/approvals/${approval.id}`, { method: 'POST', body: JSON.stringify({ decision, comment: approvalNotes[approval.id] || '' }) });
      const status = decision === 'approved' ? 'Aprovada' : 'Alterações solicitadas';
      setData((current) => current ? { ...current, approvals: (current.approvals || []).map((item) => item.id === approval.id ? { ...item, status, clientComment: approvalNotes[approval.id] || '' } : item) } : current);
      setApprovalNotes((notes) => ({ ...notes, [approval.id]: '' }));
      flash(decision === 'approved' ? 'Aprovação registrada.' : 'Pedido de alteração enviado.');
      try { const fresh = await portalRequest(`/api/public/client-portal/${encodeURIComponent(slug)}`); setData(fresh.data); } catch { /* The saved decision stays visible; a later refresh can reconcile it. */ }
    }
    catch (err) { flash(err.message || 'Não foi possível registrar sua resposta.'); }
    finally { setBusy(false); }
  };
  if (loading) return <main className="cp-empty-state cp-public-access-state"><h1>Carregando portal…</h1></main>;
  if (requiresVerification && !data) return <main className="cp-empty-state cp-public-access-state"><section className="cp-login-card"><span className="cp-overline">ACESSO SEGURO AO PORTAL</span><h1>Confirme sua identidade</h1>{verificationStep === 'identify' ? <form onSubmit={requestCode}><p>Informe o e-mail, CPF/CNPJ ou telefone cadastrado. O código será enviado ao e-mail da conta.</p><label>Identificador<input autoFocus required minLength={3} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="E-mail, CPF/CNPJ ou telefone" /></label><button className="admin-primary" disabled={verificationBusy}>{verificationBusy ? 'Solicitando...' : 'Enviar c\u00f3digo por e-mail'}</button></form> : <form onSubmit={verifyCode}><p>Se os dados corresponderem, o c&#243;digo chegar&#225; ao e-mail cadastrado.{notice ? ` ${notice}` : ''}</p><label>Código de 6 dígitos<input autoFocus required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button className="admin-primary" disabled={verificationBusy || verificationCode.length !== 6}>{verificationBusy ? 'Verificando...' : 'Entrar no portal'}</button><button type="button" className="admin-secondary" disabled={verificationBusy} onClick={() => { setVerificationStep('identify'); setChallengeId(''); setVerificationCode(''); }}>Usar outro identificador</button></form>}</section>{notice && <div className="cp-toast" role="status">{notice}</div>}</main>;
  if (error || !client) return <main className="cp-empty-state cp-public-access-state"><section className="cp-login-card" role="alert"><h1>Portal indisponível</h1><p>{error || 'Este link não corresponde a um portal publicado.'}</p><button type="button" className="admin-secondary" onClick={() => setReloadVersion((version) => version + 1)}>Tentar novamente</button></section></main>;
  const { pending: pendingApprovals, history: approvalHistory } = splitClientPortalApprovals(data.approvals);
  return <main className="cp-public-page"><header className="cp-public-header"><span className="cp-brand">{data.branding?.logo && <img width={28} height={28} src={data.branding.logo} alt="" />}<i /> Portal do cliente</span><span className="cp-client-chip">{client.name}</span>{accessToken && <button type="button" className="admin-secondary" onClick={() => { setAccessToken(''); setData(null); setRequiresVerification(true); setVerificationStep('identify'); }}>Sair do portal</button>}</header><section className="cp-public-welcome"><span className="cp-overline">ÁREA DO CLIENTE</span><h1>Olá, {(client.person || client.name).split(' ')[0]}</h1><p>Acompanhe os serviços contratados com a Focuss Dev.</p></section><section className="cp-public-content"><div className="cp-public-grid">
    {(data.projects || []).map((item) => <article className="cp-info-card cp-project-card" key={item.id}><div className="cp-card-heading"><span className="cp-card-icon green"><FolderKanban size={17} /></span><small>PROJETO</small><span>{item.status}</span></div><h3>{item.name || item.title}</h3><p>Próxima entrega: {item.due || 'em definição'}</p><div className="cp-project-progress"><div><i style={{ width: `${Math.min(100, Math.max(0, Number(item.progress) || 0))}%` }} /></div><b>{Number(item.progress) || 0}%</b></div></article>)}
    {(data.contracts || []).map((item) => <article className="cp-info-card" key={item.id}><div className="cp-card-heading"><span className="cp-card-icon blue"><FileCheck2 size={17} /></span><small>CONTRATO</small><span>{item.status}</span></div><h3>{item.title || item.name}</h3><p>{item.code} · {item.renewal || 'Vigência conforme documento'}</p></article>)}
    {(data.payments || []).map((item) => <article className="cp-info-card" key={item.id}><div className="cp-card-heading"><span className="cp-card-icon amber"><CircleDollarSign size={17} /></span><small>PAGAMENTO</small><span>{item.status}</span></div><h3>{item.description}</h3><strong className="cp-payment-amount">{money(item.amount)}</strong>{item.paymentDetails?.pixCode && <button className="cp-action-button" onClick={() => copyPixCode(item.paymentDetails.pixCode)}>Copiar Pix <Copy size={12} /></button>}{item.paymentDetails?.ticketUrl && <a className="cp-action-button" href={item.paymentDetails.ticketUrl} target="_blank" rel="noreferrer">Abrir boleto <ExternalLink size={12} /></a>}</article>)}
    </div>
    {!!pendingApprovals.length && <section className="cp-activity"><div className="cp-section-title"><div><h3>Aprovações pendentes</h3><p>Revise os materiais enviados pela equipe.</p></div></div>{pendingApprovals.map((item) => { const comment = approvalNotes[item.id] || ''; const canRequestChanges = canSubmitPortalApprovalDecision('changes_requested', comment, busy); return <article className="cp-activity-row" key={item.id}><FileCheck2 size={15} /><span className="cp-approval-content"><b>{item.title || item.name}</b>{item.project && <small>{item.project}</small>}{item.attachment?.url && <a href={item.attachment.url} target="_blank" rel="noreferrer">Revisar {item.attachment.name || 'arquivo'}</a>}{item.clientComment && <small>{item.clientComment}</small>}<label className="cp-approval-comment"><span>Comentário ou ajuste solicitado</span><textarea aria-label={`Comentário para ${item.title || 'aprovação'}`} maxLength={2000} rows={2} value={comment} onChange={(event) => setApprovalNotes((notes) => ({ ...notes, [item.id]: event.target.value }))} placeholder="Adicione contexto se precisar de uma alteração" aria-describedby={`approval-comment-hint-${item.id}`} /></label><small id={`approval-comment-hint-${item.id}`} className="cp-approval-hint">{comment.trim().length < 3 ? 'Para pedir um ajuste, descreva a mudança (mínimo de 3 caracteres).' : 'Seu comentário será enviado junto com o pedido de ajuste.'}</small></span><button type="button" disabled={!canRequestChanges} className="admin-secondary" onClick={() => decide(item, 'changes_requested')}>Pedir ajuste</button><button type="button" disabled={!canSubmitPortalApprovalDecision('approved', comment, busy)} className="admin-primary" onClick={() => decide(item, 'approved')}><Check size={13} />Aprovar</button></article>;})}</section>}
    {!!approvalHistory.length && <section className="cp-activity cp-approval-history"><div className="cp-section-title"><div><h3>Hist&#243;rico de aprova&#231;&#245;es</h3><p>Decis&#245;es anteriores continuam dispon&#237;veis para consulta.</p></div></div>{approvalHistory.map((item) => { const date = item.decidedAt || item.sent; const parsedDate = date ? new Date(date) : null; return <article className="cp-activity-row" key={item.id}><FileCheck2 size={15} /><span className="cp-approval-content"><b>{item.title || item.name}</b><small>{item.status || 'Sem status'}{parsedDate && !Number.isNaN(parsedDate.valueOf()) ? ` ? ${parsedDate.toLocaleString('pt-BR')}` : ''}</small>{item.project && <small>{item.project}</small>}{item.clientComment && <small>{item.clientComment}</small>}</span></article>;})}</section>}
    <section className="cp-public-message"><div><span className="cp-card-icon indigo"><MessageCircle size={17} /></span><h2>Fale com a equipe</h2><p>As mensagens entram no histórico de atendimento da agência.</p></div><div className="cp-message-conversation">{sentMessages.length > 0 && <div className="cp-sent-messages" aria-live="polite"><h3>Enviadas nesta visita</h3>{sentMessages.map((item) => <article key={item.id}><p>{item.text}</p><small>Enviada para a equipe · {new Date(item.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></article>)}</div>}<form onSubmit={sendMessage}><textarea required maxLength={2000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva sua mensagem…" /><button className="admin-primary" disabled={!canSendPortalMessage(message, busy)}><Send size={14} />{busy ? 'Enviando…' : 'Enviar mensagem'}</button></form></div></section>
  </section>{notice && <div className="cp-toast" role="status">{notice}</div>}</main>;
}
