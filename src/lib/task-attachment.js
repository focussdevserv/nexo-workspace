export function withoutTaskAttachment(task) {
  if (!task || typeof task !== 'object') return task;
  return { ...task, attachment: null, updatedAt: new Date().toISOString() };
}
