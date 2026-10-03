/** A Drive file must not be linked until workspace records can be checked for duplicates. */
export function driveFileLinkState({ driveFileId, files = [], filesLoaded = false, filesError = '', linkingId = '' } = {}) {
  if (!driveFileId) return 'invalid_file';
  if (!filesLoaded) return 'workspace_loading';
  if (filesError) return 'workspace_error';
  if (files.some((file) => String(file.driveFileId || '') === String(driveFileId))) return 'already_linked';
  if (String(linkingId) === String(driveFileId)) return 'linking';
  return 'ready';
}
