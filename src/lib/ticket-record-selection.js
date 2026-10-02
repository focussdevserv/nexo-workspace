export function findTicketByActionKey(tickets, key) {
  const actionKey = String(key ?? '');
  return tickets.find((ticket) => String(ticket.id ?? '') === actionKey)
    || tickets.find((ticket) => String(ticket.code ?? '') === actionKey);
}
