export function canWriteDeliveryRecords(role, permissions) {
  if (role === 'owner' || role === 'admin') return true;
  if (role !== 'member') return false;
  const delivery = permissions?.delivery;
  // Members can work on delivery records by default. Once a module override
  // exists, writes must be granted explicitly, matching API authorization.
  return delivery == null || delivery.write === true;
}

export function canDeleteTaskRecords(role, permissions) {
  if (role === 'owner' || role === 'admin') return true;
  if (role !== 'member') return false;
  const delivery = permissions?.delivery;
  return delivery == null || delivery.delete === true;
}
