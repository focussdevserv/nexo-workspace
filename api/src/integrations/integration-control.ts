/** Integrations default to enabled until an owner explicitly pauses them. */
export function integrationControlAllowsUse(control: { enabled?: unknown } | null | undefined) {
  return control?.enabled !== false;
}
