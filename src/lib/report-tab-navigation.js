export function reportTabForKey(current, key, tabs) {
  const index = tabs.indexOf(current);
  if (index < 0 || !tabs.length) return current;
  if (key === 'Home') return tabs[0];
  if (key === 'End') return tabs[tabs.length - 1];
  if (key === 'ArrowRight') return tabs[(index + 1) % tabs.length];
  if (key === 'ArrowLeft') return tabs[(index - 1 + tabs.length) % tabs.length];
  return current;
}
