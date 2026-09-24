export type ProposalEmail = {
  title?: unknown;
  client?: unknown;
  code?: unknown;
  value?: unknown;
  service?: unknown;
  scope?: unknown;
  deadline?: unknown;
  paymentTerms?: unknown;
};

export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

export function renderProposalEmail(proposal: ProposalEmail) {
  const rows = [
    ['Cliente', proposal.client], ['Investimento', proposal.value], ['Serviço', proposal.service],
    ['Prazo estimado', proposal.deadline], ['Condições de pagamento', proposal.paymentTerms],
  ].filter(([, value]) => value != null && String(value).trim() !== '');
  const title = escapeHtml(proposal.title || 'Proposta comercial');
  const scope = escapeHtml(proposal.scope || 'Escopo a detalhar');
  const code = escapeHtml(proposal.code || '');
  const text = [
    String(proposal.title || 'Proposta comercial'),
    String(proposal.client || ''),
    ...rows.map(([label, value]) => `${label}: ${String(value)}`),
    `Escopo: ${String(proposal.scope || 'Escopo a detalhar')}`,
    'Para aprovar ou solicitar ajustes, responda a este e-mail.',
  ].filter(Boolean).join('\n');
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body style="margin:0;background:#f4f6fa;color:#172033;font:16px Arial,sans-serif"><main style="max-width:640px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e3e8f0;border-radius:16px"><p style="margin:0 0 8px;color:#5572a1;font-size:12px;font-weight:700;letter-spacing:.08em">PROPOSTA COMERCIAL${code ? ` · ${code}` : ''}</p><h1 style="font-size:24px;margin:0 0 24px">${title}</h1><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><th align="left" style="padding:12px 8px;border-bottom:1px solid #e8edf4;color:#64748b;font-size:13px">${escapeHtml(label)}</th><td align="right" style="padding:12px 8px;border-bottom:1px solid #e8edf4;font-weight:600">${escapeHtml(value)}</td></tr>`).join('')}</table><h2 style="font-size:16px;margin:24px 0 8px">Escopo</h2><p style="margin:0;line-height:1.6;white-space:pre-wrap">${scope}</p><p style="margin:24px 0 0;color:#64748b;font-size:13px">Para aprovar ou solicitar ajustes, responda a este e-mail.</p></main></body></html>`;
  return { html, text };
}
