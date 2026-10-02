const spreadsheetMimeTypes = [
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'text/tab-separated-values',
];

const spreadsheetExtensions = new Set(['csv', 'ods', 'tsv', 'xls', 'xlsx']);
const archiveExtensions = new Set(['7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'zip']);
const documentMimeTypes = new Set([
  'application/vnd.google-apps.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
]);
const documentExtensions = new Set(['doc', 'docx', 'odt', 'rtf', 'txt']);

export function classifyWorkspaceFile(file) {
  const type = String(file?.type || '').toLocaleLowerCase('pt-BR');
  const mimeType = String(file?.mimeType || '').split(';', 1)[0].trim().toLocaleLowerCase('pt-BR');
  const extension = String(file?.name || '').split('.').pop()?.toLocaleLowerCase('pt-BR') || '';

  if (file?.folder || type === 'folder' || mimeType === 'application/vnd.google-apps.folder') return 'folder';
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (mimeType.startsWith('image/') || ['gif', 'heic', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(extension)) return 'image';
  if (spreadsheetMimeTypes.includes(mimeType) || spreadsheetExtensions.has(extension)) return 'sheet';
  if (documentMimeTypes.has(mimeType) || documentExtensions.has(extension)) return 'document';
  if (archiveExtensions.has(extension)) return 'file';
  if (type === 'pdf') return 'pdf';
  if (type === 'image' || type === 'imagem') return 'image';
  if (type === 'sheet' || type === 'planilha') return 'sheet';
  if (type === 'document' || type === 'documento') return 'document';
  return 'file';
}

export function matchesWorkspaceFileFilter(file, filter) {
  if (filter === 'Todos') return true;
  if (filter === 'Pastas') return classifyWorkspaceFile(file) === 'folder';
  return classifyWorkspaceFile(file) === filter;
}
