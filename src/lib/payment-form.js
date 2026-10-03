export function updatePaymentField(form, field, value) {
  return { ...form, [field]: value };
}

export function updatePaymentAddress(form, field, value) {
  return {
    ...form,
    address: {
      ...form.address,
      [field]: value,
    },
  };
}
