export function ticketActivityForDisplay(activity, showAll = false, recentLimit = 8) {
  if (!Array.isArray(activity)) return [];
  const ordered = activity.slice().reverse();
  if (showAll || ordered.length <= recentLimit) return ordered;
  return ordered.slice(0, recentLimit);
}
