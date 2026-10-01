export type ClientApprovalData = Record<string, unknown>;

export function portalApprovalRecord(id: string, data: ClientApprovalData) {
  const candidate = data.attachment && typeof data.attachment === 'object' ? data.attachment as Record<string, unknown> : {};
  let attachment: { name: string; url: string; mimeType: string } | null = null;
  if (candidate.publicAccess === true && typeof candidate.url === 'string') {
    try {
      const url = new URL(candidate.url);
      if (url.protocol === 'https:' && url.hostname === 'drive.google.com' && url.pathname.startsWith('/file/d/')) {
        attachment = { name: typeof candidate.name === 'string' ? candidate.name : '', url: url.toString(), mimeType: typeof candidate.mimeType === 'string' ? candidate.mimeType : '' };
      }
    } catch { /* invalid provider URLs are never exposed in the public portal */ }
  }
  return {
    id,
    title: String(data.title ?? data.name ?? ''),
    project: String(data.project ?? ''),
    kind: String(data.kind ?? ''),
    status: String(data.status ?? ''),
    sent: String(data.sent ?? data.createdAt ?? ''),
    decidedAt: typeof data.decidedAt === 'string' ? data.decidedAt : null,
    clientComment: typeof data.clientComment === 'string' ? data.clientComment : '',
    attachment,
  };
}

export function isClientApprovalPending(status: unknown) {
  const normalized = String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return !['aprovada', 'aprovado', 'concluida', 'concluido'].includes(normalized);
}
