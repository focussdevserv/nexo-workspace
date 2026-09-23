import React, { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, CircleDollarSign, Clock3, Copy, FileText, MessageCircle, Paperclip, Send, Settings2, ShieldCheck, X } from 'lucide-react';
import './client-portal.css';

const clientList = [
  { id: 'clinica-vidamais', name: 'Clínica VidaMais', contact: 'Camila Oliveira', initials: 'CV', project: 'Site institucional', progress: 68, delivery: '28 set 2026', document: 'Nova homepage', payment: 'R$ 800,00', due: '10 out 2026', tone: 'rose' },
  { id: 'novaera-imoveis', name: 'NovaEra Imóveis', contact: 'Rafael Costa', initials: 'RC', project: 'Landing page de lançamentos', progress: 42, delivery: '12 out 2026', document: 'Página de imóveis', payment: 'R$ 1.600,00', due: '22 out 2026', tone: 'blue' },
  { id: 'doce-ponto', name: 'Doce Ponto', contact: 'Juliana Martins', initials: 'JM', project: 'Identidade visual', progress: 84, delivery: '02 out 2026', document: 'Aplicações da marca', payment: 'R$ 1.250,00', due: '16 out 2026', tone: 'lilac' },
];
const VISIBILITY_KEY = 'nexo.portal.visibility.v1';
const ACTIVITY_KEY = 'nexo.portal.activity.v1';
const APPROVAL_KEY = 'nexo.portal.approvals.v1';
function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; } }
function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage is best effort for this front-end preview */ } }

export function ClientPortalAdmin({ notify }) {
  const [clientId, setClientId] = useState(clientList[0].id);
  const [visibilityByClient, setVisibilityByClient] = useState(() => readJSON(VISIBILITY_KEY, {}));
  const [customizing, setCustomizing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState('');
  const client = clientList.find((item) => item.id === clientId) || clientList[0];
  const visibility = { project: true, files: true, payments: true, support: true, ...(visibilityByClient[clientId] || {}) };
  const approvalState = readJSON(APPROVAL_KEY, {})[clientId] || 'Aguardando revisão';
  const activity = readJSON(ACTIVITY_KEY, {})[clientId] || [
    { title: 'Briefing aprovado', time: 'Ontem, 15:40' },
    { title: 'Arquivo enviado pela agência', time: '22 set, 10:18' },
  ];
  const publicUrl = `${window.location.origin}/portal/${client.id}`;
  const addActivity = (title) => {
    const all = readJSON(ACTIVITY_KEY, {});
    const next = { ...all, [clientId]: [{ title, time: new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }, ...(all[clientId] || activity)].slice(0, 8) };
    saveJSON(ACTIVITY_KEY, next);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); notify('Link do portal copiado.'); }
    catch { window.prompt('Copie o link do portal:', publicUrl); }
  };
  const decide = (status) => {
    const states = readJSON(APPROVAL_KEY, {}); states[clientId] = status; saveJSON(APPROVAL_KEY, states);
    addActivity(status === 'Aprovada' ? `${client.document} aprovado pelo cliente` : `Alteração solicitada em ${client.document}`);
    setReviewOpen(false); notify(status === 'Aprovada' ? 'Aprovação registrada na prévia do portal.' : 'Pedido de alteração registrado na prévia.');
  };
  const sendMessage = (event) => { event.preventDefault(); if (!message.trim()) return; addActivity(`Mensagem do cliente: ${message.trim()}`); setMessage(''); setMessageOpen(false); notify('Mensagem adicionada à prévia do histórico.'); };
  const updateVisibility = (key) => setVisibilityByClient((current) => { const next = { ...current, [clientId]: { ...visibility, [key]: !visibility[key] } }; saveJSON(VISIBILITY_KEY, next); return next; });

  return <div className="client-portal-admin">
    <div className="cp-admin-toolbar"><label>Prévia do cliente<select value={clientId} onChange={(event) => setClientId(event.target.value)}>{clientList.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div><button className="admin-secondary" onClick={() => setCustomizing((value) => !value)}><Settings2 size={14} />Personalizar portal</button><button className="admin-secondary" onClick={copyLink}><Copy size={14} />Copiar link</button><a className="admin-primary" href={publicUrl} target="_blank" rel="noreferrer">Abrir portal <ArrowRight size={14} /></a></div></div>
    {customizing && <section className="cp-customize"><div><b>Seções visíveis para {client.name}</b><small>As mudanças atualizam a prévia e ficam guardadas neste navegador.</small></div><div>{[['project', 'Projeto e progresso'], ['files', 'Arquivos e aprovações'], ['payments', 'Pagamentos'], ['support', 'Mensagens e suporte']].map(([key, label]) => <label key={key}><input type="checkbox" checked={visibility[key]} onChange={() => updateVisibility(key)} />{label}</label>)}</div></section>}
    <section className="cp-preview-shell"><header className="cp-preview-bar"><span className="cp-brand"><span className="brand-glyph"><i /><b /><em /></span>nexo <i /> Portal do cliente</span><span className="cp-client-chip"><span className={`cp-avatar ${client.tone}`}>{client.initials}</span>{client.contact} · {client.name}</span></header>
      <div className="cp-welcome"><div><span className="cp-overline">ÁREA DO CLIENTE</span><h2>Olá, {client.contact.split(' ')[0]} 👋</h2><p>Acompanhe o andamento dos seus serviços e fale com a equipe.</p></div><span className="cp-online"><i /> Equipe disponível</span></div>
      <div className="cp-client-content">
        <div className="cp-cards-grid">
          {visibility.project && <article className="cp-info-card cp-project-card"><div className="cp-card-heading"><span className="cp-card-icon green"><CheckCircle2 size={17} /></span><small>PROJETO EM ANDAMENTO</small><button onClick={() => notify(`Abrindo detalhes de ${client.project}.`)}>Ver detalhes <ArrowRight size={12} /></button></div><h3>{client.project}</h3><p>Próxima entrega prevista para {client.delivery}</p><div className="cp-project-progress"><div><i style={{ width: `${client.progress}%` }} /></div><b>{client.progress}%</b></div><small className="cp-muted">Design aprovado · Desenvolvimento em andamento</small></article>}
          {visibility.files && <article className="cp-info-card"><div className="cp-card-heading"><span className="cp-card-icon blue"><FileText size={17} /></span><small>DOCUMENTO PARA REVISAR</small></div><h3>{client.document}</h3><p>Enviado pela agência · Hoje às 09:20</p><div className="cp-approval-row"><span className={`cp-approval-state ${approvalState === 'Aprovada' ? 'approved' : approvalState === 'Alteração solicitada' ? 'changes' : ''}`}><i />{approvalState}</span><button className="cp-action-button" onClick={() => setReviewOpen(true)}>{approvalState === 'Aguardando revisão' ? 'Revisar documento' : 'Ver decisão'} <ArrowRight size={12} /></button></div></article>}
          {visibility.payments && <article className="cp-info-card"><div className="cp-card-heading"><span className="cp-card-icon amber"><CircleDollarSign size={17} /></span><small>PRÓXIMO PAGAMENTO</small></div><strong className="cp-payment-amount">{client.payment}</strong><p>Vencimento em {client.due}</p><button className="cp-action-button" onClick={() => notify('A área de pagamento será ligada ao Mercado Pago depois do backend.')}>Ver cobrança <ArrowRight size={12} /></button></article>}
        </div>
        <div className="cp-lower-grid"><section className="cp-activity"><div className="cp-section-title"><div><h3>Atividade recente</h3><p>Atualizações compartilhadas com o cliente.</p></div><button onClick={() => setMessageOpen(true)}><MessageCircle size={14} />Falar com a agência</button></div>{activity.map((entry, index) => <div className="cp-activity-row" key={`${entry.title}-${index}`}><span className="cp-activity-icon"><CheckCircle2 size={14} /></span><b>{entry.title}</b><time>{entry.time}</time></div>)}</section>{visibility.support && <aside className="cp-contact-card"><span className="cp-card-icon indigo"><MessageCircle size={17} /></span><h3>Precisa de ajuda?</h3><p>Envie uma mensagem e nossa equipe continua o atendimento por aqui.</p><button className="admin-primary" onClick={() => setMessageOpen(true)}><Send size={14} />Enviar mensagem</button><small><ShieldCheck size={12} />Resposta registrada no histórico do cliente</small></aside>}</div>
      </div>
    </section>
    <div className="cp-preview-note">Prévia interativa · aprovações e mensagens são demonstrações locais.</div>
    {reviewOpen && <div className="cp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewOpen(false); }}><section className="cp-modal"><header><div><span className="cp-overline">REVISÃO DO CLIENTE</span><h2>{client.document}</h2></div><button aria-label="Fechar" onClick={() => setReviewOpen(false)}><X size={17} /></button></header><div className="cp-file-preview"><FileText size={30} /><b>{client.document}.pdf</b><small>Prévia do documento para aprovação</small></div><p>Confira o material enviado. Você pode aprovar ou pedir ajustes; a ação será registrada no histórico de demonstração.</p><footer><button className="admin-secondary" onClick={() => decide('Alteração solicitada')}>Solicitar alteração</button><button className="admin-primary" onClick={() => decide('Aprovada')}><Check size={14} />Aprovar documento</button></footer></section></div>}
    {messageOpen && <div className="cp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessageOpen(false); }}><form className="cp-modal" onSubmit={sendMessage}><header><div><span className="cp-overline">MENSAGEM DO CLIENTE</span><h2>Falar com a agência</h2></div><button type="button" aria-label="Fechar" onClick={() => setMessageOpen(false)}><X size={17} /></button></header><label className="cp-message-field">Mensagem<textarea required maxLength={500} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva sua mensagem..." /></label><small className="cp-modal-note">A mensagem será adicionada ao histórico desta prévia.</small><footer><button type="button" className="admin-secondary" onClick={() => setMessageOpen(false)}>Cancelar</button><button className="admin-primary" type="submit"><Send size={14} />Enviar mensagem</button></footer></form></div>}
  </div>;
}

export function PublicClientPortal({ slug }) {
  const client = clientList.find((item) => item.id === slug);
  const activeClient = client || clientList[0];
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [status, setStatus] = useState(() => readJSON(APPROVAL_KEY, {})[activeClient.id] || 'Aguardando revisão');
  const [reviewOpen, setReviewOpen] = useState(false);
  const flash = (text) => { setToast(text); window.setTimeout(() => setToast(''), 2600); };
  const allVisibility = readJSON(VISIBILITY_KEY, {});
  const visibility = { project: true, files: true, payments: true, support: true, ...(allVisibility[activeClient.id] || {}) };
  const addEntry = (title) => { const all = readJSON(ACTIVITY_KEY, {}); all[client.id] = [{ title, time: new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), fromClient: true }, ...(all[client.id] || [])].slice(0, 8); saveJSON(ACTIVITY_KEY, all); };
  const send = (event) => { event.preventDefault(); if (!message.trim()) return; addEntry(`Mensagem do cliente: ${message.trim()}`); setMessage(''); flash('Mensagem enviada nesta demonstração.'); };
  const decide = (nextStatus) => { const values = readJSON(APPROVAL_KEY, {}); values[client.id] = nextStatus; saveJSON(APPROVAL_KEY, values); setStatus(nextStatus); addEntry(nextStatus === 'Aprovada' ? `${client.document} aprovado` : `Ajustes solicitados em ${client.document}`); setReviewOpen(false); flash(nextStatus === 'Aprovada' ? 'Documento aprovado.' : 'Pedido de alteração enviado.'); };
  if (!client) return <main className="cp-public-page"><header className="cp-public-header"><span className="cp-brand"><span className="brand-glyph"><i /><b /><em /></span>nexo</span></header><section className="cp-not-found"><span className="cp-card-icon blue"><ShieldCheck size={18} /></span><h1>Este link do portal não é válido</h1><p>Peça à equipe da agência um novo link de acesso.</p></section></main>;
  return <main className="cp-public-page"><header className="cp-public-header"><span className="cp-brand"><span className="brand-glyph"><i /><b /><em /></span>nexo <i /> Portal do cliente</span><span className="cp-client-chip"><span className={`cp-avatar ${client.tone}`}>{client.initials}</span>{client.name}</span></header><section className="cp-public-welcome"><span className="cp-overline">ÁREA DO CLIENTE</span><h1>Olá, {client.contact.split(' ')[0]} 👋</h1><p>Este é o espaço para acompanhar seus serviços com a Nexo.</p></section><section className="cp-public-content"><div className="cp-public-grid">{visibility.project && <article className="cp-info-card cp-project-card"><div className="cp-card-heading"><span className="cp-card-icon green"><CheckCircle2 size={17} /></span><small>PROJETO EM ANDAMENTO</small></div><h3>{client.project}</h3><p>Entrega prevista para {client.delivery}</p><div className="cp-project-progress"><div><i style={{ width: `${client.progress}%` }} /></div><b>{client.progress}%</b></div><small className="cp-muted">Design aprovado · Desenvolvimento em andamento</small></article>}{visibility.files && <article className="cp-info-card"><div className="cp-card-heading"><span className="cp-card-icon blue"><FileText size={17} /></span><small>DOCUMENTO PARA REVISAR</small></div><h3>{client.document}</h3><p>Arquivo enviado pela equipe Nexo</p><div className="cp-approval-row"><span className={`cp-approval-state ${status === 'Aprovada' ? 'approved' : status === 'Alteração solicitada' ? 'changes' : ''}`}><i />{status}</span><button className="cp-action-button" onClick={() => setReviewOpen(true)}>Revisar <ArrowRight size={12} /></button></div></article>}{visibility.payments && <article className="cp-info-card"><div className="cp-card-heading"><span className="cp-card-icon amber"><CircleDollarSign size={17} /></span><small>PRÓXIMO PAGAMENTO</small></div><strong className="cp-payment-amount">{client.payment}</strong><p>Vencimento em {client.due}</p><button className="cp-action-button" onClick={() => flash('A consulta de cobranças será ativada quando o financeiro estiver conectado.')}>Ver cobrança <ArrowRight size={12} /></button></article>}</div><section className={visibility.support ? "cp-public-message" : "cp-public-message hidden"}><div><span className="cp-card-icon indigo"><MessageCircle size={17} /></span><h2>Fale com a equipe</h2><p>Envie dúvidas ou atualizações para o seu atendimento.</p></div><form onSubmit={send}><textarea rows={3} required maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva sua mensagem..." /><button className="admin-primary" type="submit"><Send size={14} />Enviar mensagem</button></form></section></section>{reviewOpen && <div className="cp-modal-backdrop" role="presentation"><section className="cp-modal"><header><div><span className="cp-overline">REVISÃO DO CLIENTE</span><h2>{client.document}</h2></div><button aria-label="Fechar" onClick={() => setReviewOpen(false)}><X size={17} /></button></header><div className="cp-file-preview"><Paperclip size={26} /><b>{client.document}.pdf</b><small>Documento compartilhado pela agência</small></div><p>Depois de revisar o documento, aprove ou solicite ajustes.</p><footer><button className="admin-secondary" onClick={() => decide('Alteração solicitada')}>Solicitar alteração</button><button className="admin-primary" onClick={() => decide('Aprovada')}><Check size={14} />Aprovar documento</button></footer></section></div>}{toast && <div className="cp-toast" role="status">{toast}</div>}</main>;
}
