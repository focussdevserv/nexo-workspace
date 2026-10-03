export function normalizeNotificationPreferences(preferences = {}) {
  return {
    ...preferences,
    email: false,
    weekly: false,
    whatsapp: false,
    emailConsentVersion: 0,
    emailConsentAt: '',
    emailConsentAddress: '',
  };
}
