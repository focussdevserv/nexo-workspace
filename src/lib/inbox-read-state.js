export function buildInboxReadPatch(conversation) {
  const data = Object.fromEntries(Object.entries(conversation || {}).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field)));
  return { ...data, unread: 0 };
}
