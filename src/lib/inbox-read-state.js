export function buildInboxReadPatch(conversation) {
  const data = Object.fromEntries(Object.entries(conversation || {}).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field)));
  return { ...data, unread: 0 };
}

export async function markInboxConversationRead(conversation, { update, refresh }) {
  await update(buildInboxReadPatch(conversation));
  try {
    await refresh();
    return { refreshed: true };
  } catch {
    return { refreshed: false };
  }
}
