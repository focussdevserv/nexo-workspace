export function formatDriveFileSize(size) {
  if (size === null || size === undefined || size === '') return 'Não informado';
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Não informado';
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
