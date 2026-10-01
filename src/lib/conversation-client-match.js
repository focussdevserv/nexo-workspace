function normalizedEmail(value) {
  return String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLocaleLowerCase('en-US') || '';
}

function normalizedPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? digits : '';
}

export function matchConversationClient(clients = [], contacts = [], conversation = {}) {
  const email = normalizedEmail(conversation.email || conversation.from || conversation.address || '');
  const phone = normalizedPhone(conversation.phone || conversation.telephone || '');
  const clientIdsByEmail = new Set();
  const clientIdsByPhone = new Set();
  for (const client of clients) {
    const emails = [client.email, ...(Array.isArray(client.contacts) ? client.contacts.map((item) => item.email) : [])].map(normalizedEmail).filter(Boolean);
    const phones = [client.phone, client.mobile, ...(Array.isArray(client.contacts) ? client.contacts.map((item) => item.phone) : [])].map(normalizedPhone).filter(Boolean);
    if (email && emails.includes(email)) clientIdsByEmail.add(String(client.id));
    if (phone && phones.includes(phone)) clientIdsByPhone.add(String(client.id));
  }
  for (const contact of contacts) {
    const clientId = contact.clientId || contact.workspaceClientId || contact.clientRecordId;
    if (!clientId) continue;
    if (email && normalizedEmail(contact.email) === email) clientIdsByEmail.add(String(clientId));
    if (phone && normalizedPhone(contact.phone) === phone) clientIdsByPhone.add(String(clientId));
  }
  const matches = clientIdsByEmail.size ? clientIdsByEmail : clientIdsByPhone;
  if (matches.size !== 1) return null;
  const id = [...matches][0];
  return clients.find((client) => String(client.id) === id) || null;
}
