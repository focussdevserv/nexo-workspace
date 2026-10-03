/** Settings that currently affect billing behavior in the running product. */
export const billingSettingCapabilities = Object.freeze({
  defaultDueDays: true,
  pix: true,
  boleto: true,
  card: true,
  autoRenew: true,
  lateFee: false,
  interest: false,
  reminderDays: false,
});

export function isBillingSettingAvailable(field) {
  return billingSettingCapabilities[field] === true;
}
