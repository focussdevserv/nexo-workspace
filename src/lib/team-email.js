/** Normalize the optional operational directory email before duplicate checks. */
export function normalizeTeamEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function hasTeamEmailConflict(people, email, editingId = null) {
  const normalizedEmail = normalizeTeamEmail(email);
  if (!normalizedEmail) return false;
  return (Array.isArray(people) ? people : []).some((person) =>
    String(person?.id) !== String(editingId)
      && normalizeTeamEmail(person?.email) === normalizedEmail,
  );
}
