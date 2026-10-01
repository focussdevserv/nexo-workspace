const MAX_LOGO_DATA_URL_LENGTH = 40_000;

export function safeClientPortalBranding(value: unknown): { logo?: string } {
  if (typeof value !== 'string' || value.length > MAX_LOGO_DATA_URL_LENGTH) return {};
  if (!/^data:image\/webp;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return {};
  return { logo: value };
}
