export function shouldCloseTeamDialog(key, busy) {
  return key === 'Escape' && !busy;
}
