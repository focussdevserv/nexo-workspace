export function ticketActivityAuthor(user, fallback = 'Equipe') {
  const name = String(user?.name || '').trim();
  return name || fallback;
}
