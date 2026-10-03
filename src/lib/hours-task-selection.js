export function canCreateTaskFromHours({ tasksLoaded, tasksError, timerRunning, hasActiveTask, canWriteTask }) {
  return tasksLoaded === true && !tasksError && !timerRunning && !hasActiveTask && canWriteTask === true;
}

// Match the API policy for POST /api/workspace/tasks: members may create tasks
// by default, but once a delivery permission object exists, write must be
// explicitly granted. Owner/admin roles are not restricted by this check.
export function canWriteTaskFromHours(role, permissions) {
  if (role !== 'member') return true;
  const delivery = permissions?.delivery;
  return delivery == null || delivery.write === true;
}

export function createdHoursTaskId(saveResult, temporaryId) {
  if (!saveResult?.ok || !Array.isArray(saveResult.records)) return '';
  const id = String(saveResult.createdIds?.[String(temporaryId)] || temporaryId || '');
  return saveResult.records.some((record) => String(record.id) === id) ? id : '';
}
