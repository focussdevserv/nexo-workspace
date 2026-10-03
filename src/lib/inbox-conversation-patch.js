const editableConversationFields = ['status', 'owner', 'assigneeId'];

/** Keep inbox metadata PATCHes partial so new messages/history cannot be replaced by a stale list snapshot. */
export function buildInboxConversationPatch(patch = {}) {
  return Object.fromEntries(editableConversationFields
    .filter((field) => Object.hasOwn(patch, field))
    .map((field) => [field, patch[field]]));
}

/** A committed metadata update stays committed even if the follow-up read fails. */
export async function saveInboxConversationMetadata({ save, updateLocal, refresh }) {
  const result = await save();
  updateLocal();
  try {
    await refresh();
    return { result, refreshed: true };
  } catch {
    return { result, refreshed: false };
  }
}
