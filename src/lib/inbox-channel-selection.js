export function inboxChannelSelection(selections, channel, rows = []) {
  const selectedId = String(selections?.[channel] || '');
  if (selectedId && rows.some((row) => String(row.id) === selectedId)) return selectedId;
  return String(rows[0]?.id || '');
}

export function setInboxChannelSelection(selections, channel, id) {
  return { ...selections, [channel]: String(id || '') };
}
