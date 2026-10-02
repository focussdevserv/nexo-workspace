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
  const normalized = String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return ['aguardando', 'alteracoes solicitadas', 'ajustes solicitados'].includes(normalized);
}

export function clientApprovalDecisionHasValidComment(decision: unknown, comment: unknown) {
  if (decision !== 'changes_requested') return decision === 'approved';
  return typeof comment === 'string' && comment.trim().length >= 3;
}

export function clientPortalApprovalDecisionRecord(
  data: ClientApprovalData,
  clientId: string,
  decision: 'approved' | 'changes_requested',
  comment: string | undefined,
  decidedAt: string,
) {
  const references = [data.clientId, data.workspaceClientId, data.clientRecordId]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (!references.length || references.some((value) => value !== clientId) || !isClientApprovalPending(data.status)) return null;
  if (!clientApprovalDecisionHasValidComment(decision, comment)) return null;
  return {
    ...data,
    status: decision === 'approved' ? 'Aprovada' : 'Alterações solicitadas',
    clientComment: comment?.trim() ?? '',
    decidedAt,
  };
}
