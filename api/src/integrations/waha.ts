export function classifyWahaQrResponse(status: number, contentType = ''): 'pending' | 'error' | 'image' {
  if ([204, 404, 422].includes(status)) return 'pending';
  if (status < 200 || status >= 300) return 'error';
  return contentType.split(';')[0]?.trim().toLowerCase().startsWith('image/') ? 'image' : 'pending';
}
