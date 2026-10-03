export function teamPermissionDraftHasChanges(draft, baseline) {
  if (!draft || !baseline) return false;
  return JSON.stringify(draft) !== JSON.stringify(baseline);
}

export function confirmDiscardTeamPermissionDraft({ dirty, confirmDiscard }) {
  if (!dirty) return true;
  return confirmDiscard('Há alterações de permissões não salvas. Descartar essas alterações?');
}
