type HeaderReply = { header: (name: string, value: string) => unknown };

const clientPortalCacheHeaders = [
  ['Cache-Control', 'no-store, private'],
  ['Pragma', 'no-cache'],
  ['Expires', '0'],
] as const;

export function applyClientPortalCachePolicy(reply: HeaderReply) {
  for (const [name, value] of clientPortalCacheHeaders) reply.header(name, value);
}
