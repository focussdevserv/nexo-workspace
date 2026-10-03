const editableConversationFields = ['status', 'owner', 'assigneeId'];

/** Keep inbox metadata PATCHes partial so new messages/history cannot be replaced by a stale list snapshot. */
export function buildInboxConversationPatch(patch = {}) {
  return Object.fromEntries(editableConversationFields
    .filter((field) => Object.hasOwn(patch, field))
    .map((field) => [field, patch[field]]));
}
