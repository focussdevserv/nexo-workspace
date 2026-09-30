export function googleCalendarTestDisposition(status: number): 'connected' | 'setup_required' | 'error' {
  if (status >= 200 && status < 300) return 'connected';
  if (status === 403) return 'setup_required';
  return 'error';
}
