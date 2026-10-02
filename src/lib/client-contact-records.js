export function removeClientContact(client, contactId) {
  if (!client?.id || contactId == null || (typeof contactId !== 'object' && String(contactId).trim() === '')) throw new Error('client_contact_invalid');
  const contacts = Array.isArray(client.contacts) ? client.contacts : [];
  const index = typeof contactId === 'object'
    ? contacts.findIndex((contact) => contact === contactId || (contactId.id != null && String(contact?.id) === String(contactId.id)))
    : contacts.findIndex((contact) => String(contact?.id) === String(contactId));
  if (index < 0) throw new Error('client_contact_not_found');
  const remaining = contacts.filter((_, contactIndex) => contactIndex !== index);
  return { ...client, contacts: remaining };
}
