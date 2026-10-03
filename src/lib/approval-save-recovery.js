export function approvalWasRecoveredAfterSaveFailure(saved, expected) {
  if (saved?.ok) return true;
  const rows = Array.isArray(saved?.records) ? saved.records : [];
  const sent = String(expected?.sent || '');
  return rows.some((row) => String(row.id) === String(expected?.id)
    || (sent && String(row.sent || '') === sent
      && String(row.clientId || '') === String(expected?.clientId || '')
      && String(row.title || '') === String(expected?.title || '')
      && String(row.status || '') === String(expected?.status || '')));
}

export async function recoverApprovalShareAfterSaveFailure({ saved, approval, shared }, revokeShare) {
  if (approvalWasRecoveredAfterSaveFailure(saved, approval)) {
    return { approvalSaved: true, accessRevoked: false, accessMayRemain: false };
  }
  if (saved?.recovered === false) {
    return { approvalSaved: false, accessRevoked: false, accessMayRemain: Boolean(shared?.shared), saveOutcomeUnknown: true };
  }

  if (!shared?.shared) {
    return { approvalSaved: false, accessRevoked: false, accessMayRemain: false };
  }
  if (!shared.created || !shared.permissionId) {
    return { approvalSaved: false, accessRevoked: false, accessMayRemain: true };
  }

  try {
    await revokeShare(shared.permissionId);
    return { approvalSaved: false, accessRevoked: true, accessMayRemain: false };
  } catch (error) {
    return { approvalSaved: false, accessRevoked: false, accessMayRemain: true, cleanupError: error };
  }
}
