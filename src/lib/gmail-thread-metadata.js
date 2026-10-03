export function mergeGmailThreadMetadata(threads, records) {
  const byThreadId = new Map((Array.isArray(records) ? records : [])
    .filter((record) => record?.gmailMetadata === true && record.channel === 'Gmail' && record.threadId)
    .map((record) => [String(record.threadId), record]));
  return (Array.isArray(threads) ? threads : []).map((thread) => {
    const metadata = byThreadId.get(String(thread.threadId || thread.id));
    if (!metadata) return thread;
    const newMessageAfterResolution = metadata.status === 'closed' && Date.parse(thread.time || '') > Date.parse(metadata.resolvedAt || '');
    return { ...thread, owner: metadata.owner || '', assigneeId: metadata.assigneeId || '', status: newMessageAfterResolution ? 'open' : metadata.status || 'open', resolvedAt: newMessageAfterResolution ? '' : metadata.resolvedAt || '', emailMetadataId: metadata.id };
  });
}

export function gmailThreadMetadataRecord(thread, patch = {}, existing = {}) {
  return {
    channel: 'Gmail',
    gmailMetadata: true,
    threadId: String(thread.threadId || thread.id),
    name: thread.name || '',
    company: thread.company || '',
    email: thread.email || '',
    owner: patch.owner ?? existing.owner ?? '',
    assigneeId: patch.assigneeId ?? existing.assigneeId ?? '',
    status: patch.status ?? existing.status ?? 'open',
    resolvedAt: patch.status === 'closed' ? new Date().toISOString() : patch.status === 'open' ? '' : existing.resolvedAt || '',
  };
}

/** Existing metadata rows need partial writes so concurrent assignment and status
 * updates merge at the API instead of overwriting each other with stale snapshots. */
export function inboxEmailMetadataWrite(row, patch, existingId) {
  if (!existingId) return row;
  const data = {};
  if (Object.hasOwn(patch || {}, 'owner')) data.owner = row.owner;
  if (Object.hasOwn(patch || {}, 'assigneeId')) data.assigneeId = row.assigneeId;
  if (Object.hasOwn(patch || {}, 'status')) {
    data.status = row.status;
    data.resolvedAt = row.resolvedAt;
  }
  return data;
}

export function mergeHostingerThreadMetadata(threads, records) {
  const byThreadId = new Map((Array.isArray(records) ? records : [])
    .filter((record) => record?.hostingerMetadata === true && record.channel === 'E-mail' && record.threadId)
    .map((record) => [String(record.threadId), record]));
  return (Array.isArray(threads) ? threads : []).map((thread) => {
    const metadata = byThreadId.get(String(thread.threadId || thread.id));
    if (!metadata) return thread;
    const newer = metadata.status === 'closed' && Date.parse(thread.time || '') > Date.parse(metadata.resolvedAt || '');
    return { ...thread, owner: metadata.owner || '', assigneeId: metadata.assigneeId || '', status: newer ? 'open' : metadata.status || 'open', resolvedAt: newer ? '' : metadata.resolvedAt || '', emailMetadataId: metadata.id };
  });
}

export function hostingerThreadMetadataRecord(thread, patch = {}, existing = {}) {
  return {
    channel: 'E-mail', hostingerMetadata: true,
    threadId: String(thread.threadId || thread.id),
    name: thread.name || '', company: thread.company || '', email: thread.email || '',
    owner: patch.owner ?? existing.owner ?? '',
    assigneeId: patch.assigneeId ?? existing.assigneeId ?? '',
    status: patch.status ?? existing.status ?? 'open',
    resolvedAt: patch.status === 'closed' ? new Date().toISOString() : patch.status === 'open' ? '' : existing.resolvedAt || '',
  };
}
