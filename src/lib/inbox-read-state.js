export function buildInboxReadPatch() {
  // Workspace PATCH merges this partial object into the latest stored record.
  // Sending the selected conversation's full snapshot here could overwrite a
  // message/history or assignment saved after the list was loaded.
  return { unread: 0 };
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
