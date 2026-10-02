export function ticketAssigneeOptionValue(ticket, members = []) {
  const ownerId = String(ticket?.ownerId || '');
  if (ownerId && members.some((member) => String(member.id) === ownerId)) return ownerId;
  const owner = String(ticket?.owner || '');
  const match = members.find((member) => String(member.name || '').trim() === owner.trim());
  return match ? String(match.id) : owner ? '__legacy__' : '';
}

export function ticketAssigneeFromOption(value, members = [], legacyOwner = '') {
  if (!value) return { owner: '', ownerId: '' };
  if (value === '__legacy__') return { owner: String(legacyOwner || ''), ownerId: '' };
  const member = members.find((item) => String(item.id) === String(value));
  return member ? { owner: String(member.name || ''), ownerId: String(member.id) } : { owner: '', ownerId: '' };
}
