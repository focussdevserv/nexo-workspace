const forbiddenKey = /password|secret|token|apikey|accesskey|privatekey/i;
const unsafeObjectKeys = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_SERIALIZED_BYTES = 64_000;
const MAX_DEPTH = 32;
const MAX_NODES = 5_000;

/** Reject credentials and prototype-sensitive keys anywhere in generic workspace data. */
export function isSafeWorkspaceData(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (!current.value || typeof current.value !== 'object') continue;
    if (++visited > MAX_NODES || current.depth > MAX_DEPTH) return false;

    for (const [key, child] of Object.entries(current.value)) {
      // This is a revocation counter, not a credential; the portal writes it on clients.
      if ((key !== 'portalTokenVersion' && forbiddenKey.test(key)) || unsafeObjectKeys.has(key)) return false;
      if (child && typeof child === 'object') stack.push({ value: child, depth: current.depth + 1 });
    }
  }

  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_SERIALIZED_BYTES;
  } catch {
    return false;
  }
}
