export function appendUniqueN8nWorkflows(current = [], next = []) {
  const result = Array.isArray(current) ? [...current] : [];
  const positions = new Map(result.map((workflow, index) => [workflow?.id, index]).filter(([id]) => Boolean(id)));
  for (const workflow of Array.isArray(next) ? next : []) {
    if (!workflow?.id) continue;
    const existingIndex = positions.get(workflow.id);
    if (existingIndex === undefined) {
      positions.set(workflow.id, result.length);
      result.push(workflow);
    } else {
      // Cursor pages can overlap while a workflow changes. Keep its position,
      // but let the latest provider response drive status and available actions.
      result[existingIndex] = workflow;
    }
  }
  return result;
}
