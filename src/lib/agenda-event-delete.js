export async function deleteAgendaEvent({ event, removeLocal, deleteGoogle }) {
  const googleOnly = event?.calendarSource === 'google';
  const googleEventId = String(event?.googleEventId || '');

  if (googleOnly) {
    if (!googleEventId) return { ok: false, reason: 'missing_google_id' };
    try {
      await deleteGoogle(googleEventId);
      return { ok: true, googleOnly: true, googleEventId };
    } catch (error) {
      return { ok: false, reason: 'google_delete_failed', error };
    }
  }

  const local = await removeLocal(String(event.id));
  if (!local?.ok) return { ok: false, reason: 'local_delete_failed', error: local?.error };

  if (!googleEventId) return { ok: true, googleOnly: false, googleEventId: '' };
  try {
    await deleteGoogle(googleEventId);
    return { ok: true, googleOnly: false, googleEventId };
  } catch (error) {
    // The local record is already gone; the Google event can be retried from
    // the calendar as a Google-only event without leaving a stale local link.
    return { ok: true, googleOnly: false, googleEventId, remotePending: true, error };
  }
}
