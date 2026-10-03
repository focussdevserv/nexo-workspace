const baselinePermissions = {
  delivery: { read: false, write: false, delete: false },
  support: { read: true, write: true, delete: false },
};

export function canWriteWorkRecords(role, permissions, module) {
  if (role === 'owner' || role === 'admin') return true;
  if (role !== 'member') return false;
  const override = permissions?.[module];
  const baseline = baselinePermissions[module];
  if (!baseline) return false;
  return override ? override.write === true : baseline.write;
}

export function canDeleteWorkRecords(role, permissions, module) {
  if (role === 'owner' || role === 'admin') return true;
  if (role !== 'member') return false;
  const override = permissions?.[module];
  const baseline = baselinePermissions[module];
  if (!baseline) return false;
  return override ? override.delete === true : baseline.delete;
}
