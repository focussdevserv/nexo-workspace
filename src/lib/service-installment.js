export function advanceServiceInstallment(charges, serviceId, expectedIndex) {
  if (!Array.isArray(charges)) return null;
  const target = charges.find((charge) => String(charge.serviceId) === String(serviceId));
  if (!target || Number(target.generatedInstallments || 0) !== Number(expectedIndex)) return null;
  return charges.map((charge) => String(charge.serviceId) === String(serviceId)
    ? { ...charge, generatedInstallments: Number(expectedIndex) + 1 }
    : charge);
}
