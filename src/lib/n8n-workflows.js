export function appendUniqueN8nWorkflows(current = [], next = []) {
  const result = Array.isArray(current) ? [...current] : [];
  const seen = new Set(result.map((workflow) => workflow?.id).filter(Boolean));
  for (const workflow of Array.isArray(next) ? next : []) {
    if (!workflow?.id || seen.has(workflow.id)) continue;
    seen.add(workflow.id);
    result.push(workflow);
  }
  return result;
}
