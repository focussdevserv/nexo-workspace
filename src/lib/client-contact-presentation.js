function displayText(value) {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? String(value) : '';
}

export function presentClientContact(contact, index = 0) {
  const name = displayText(contact?.name).trim() || 'Contato sem nome';
  return {
    key: displayText(contact?.id ?? contact?.email).trim() || `legacy-contact-${index}`,
    name,
    initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join(''),
    role: displayText(contact?.role).trim() || 'Contato',
    email: displayText(contact?.email).trim(),
    phone: displayText(contact?.phone).trim(),
  };
}
