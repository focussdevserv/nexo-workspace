/** A site can be safely removed only after its schedules have loaded. */
export function canRemoveSiteAsset({ monitorsLoading = false, monitorsError = '' } = {}) {
  return !monitorsLoading && !monitorsError;
}
