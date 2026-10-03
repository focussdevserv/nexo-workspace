import { buildServiceProject } from '../data/service-project-template.js';

/** Prevents repeated clicks from creating duplicate project/task bundles. */
export async function createServiceProjectOnce(lock, service, client, onCreateProject, { onStart, onFinish } = {}) {
  if (!lock?.acquire || !lock?.release || typeof onCreateProject !== 'function') {
    throw new Error('A gravação de projetos não está disponível no momento.');
  }
  if (!lock.acquire()) return false;
  onStart?.();
  try {
    const records = buildServiceProject(service, client);
    await onCreateProject(records.project, records.tasks);
    return records;
  } finally {
    lock.release();
    onFinish?.();
  }
}
