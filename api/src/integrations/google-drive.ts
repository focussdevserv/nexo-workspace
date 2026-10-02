export type GoogleDriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

export type WorkspaceDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedAt: string | null;
  url: string;
};

export function classifyGoogleDriveListFailure(status: number) {
  if (status === 401) return { code: 'google_authorization_required', message: 'A autorização do Google expirou ou foi recusada. Reautorize a conta em Integrações.' };
  if (status === 403) return { code: 'google_drive_access_limited', message: 'O Google Drive recusou a listagem. Verifique se a Google Drive API está habilitada no projeto OAuth e se os arquivos foram criados ou disponibilizados ao Focusshub.' };
  return { code: 'google_drive_list_failed', message: 'O Google Drive não conseguiu listar os arquivos acessíveis ao Focusshub.' };
}

export function googleDriveFilesListUrl(pageToken?: string) {
  if (pageToken !== undefined && (pageToken.length > 2048 || /[\r\n\0]/.test(pageToken))) throw new Error('google_drive_page_token_invalid');
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.search = new URLSearchParams({
    q: 'trashed = false',
    spaces: 'drive',
    pageSize: '100',
    orderBy: 'modifiedTime desc',
    fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    ...(pageToken ? { pageToken } : {}),
  }).toString();
  return url.toString();
}

export function googleDriveFileMetadataUrl(fileId: string) {
  const id = String(fileId || '').trim();
  if (!/^[A-Za-z0-9_-]{5,200}$/.test(id)) throw new Error('google_drive_file_id_invalid');
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`);
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('fields', 'id,name,mimeType,size,modifiedTime,webViewLink');
  return url.toString();
}

export function mapGoogleDriveFile(file: GoogleDriveFile): WorkspaceDriveFile | null {
  const id = String(file.id || '').trim();
  const name = String(file.name || '').trim();
  if (!id || !name || id.length > 200 || /[\r\n\0]/.test(id)) return null;
  const mimeType = String(file.mimeType || 'application/octet-stream').slice(0, 120);
  const rawSize = Number(file.size);
  const size = Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : null;
  const modifiedAt = typeof file.modifiedTime === 'string' && Number.isFinite(Date.parse(file.modifiedTime)) ? file.modifiedTime : null;
  const url = typeof file.webViewLink === 'string' && /^https:\/\/drive\.google\.com\//.test(file.webViewLink)
    ? file.webViewLink
    : `https://drive.google.com/open?id=${encodeURIComponent(id)}`;
  return { id, name: name.slice(0, 180), mimeType, size, modifiedAt, url };
}
