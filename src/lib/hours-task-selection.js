export function canCreateTaskFromHours({ tasksLoaded, tasksError, timerRunning, hasActiveTask, canWriteTask }) {
  return tasksLoaded === true && !tasksError && !timerRunning && !hasActiveTask && canWriteTask === true;
}

export function createdHoursTaskId(saveResult, temporaryId) {
  if (!saveResult?.ok || !Array.isArray(saveResult.records)) return '';
  const id = String(saveResult.createdIds?.[String(temporaryId)] || temporaryId || '');
  return saveResult.records.some((record) => String(record.id) === id) ? id : '';
}
