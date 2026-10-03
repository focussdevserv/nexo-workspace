export function averageActiveTeamLoad(people) {
  const activeLoads = (Array.isArray(people) ? people : [])
    .filter((person) => person?.status === 'Ativo')
    .map((person) => Number(person.load))
    .filter(Number.isFinite)
    .map((load) => Math.max(0, Math.min(100, load)));

  if (!activeLoads.length) return null;
  return Math.round(activeLoads.reduce((total, load) => total + load, 0) / activeLoads.length);
}
