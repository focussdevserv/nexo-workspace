const terminalLeadStages = new Set(['fechado', 'perdido', 'ganho', 'won', 'lost']);
const approvedProposalStatuses = new Set(['aprovada', 'approved', 'accepted']);

function normalized(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function countLeadsWithoutNextAction(leads = []) {
  return leads.filter((lead) => {
    const stage = normalized(lead?.stage || lead?.status);
    return !terminalLeadStages.has(stage) && !String(lead?.nextAction ?? '').trim();
  }).length;
}

export function averageProposalApprovalDays(proposals = []) {
  let totalMilliseconds = 0;
  let count = 0;

  for (const proposal of proposals) {
    if (!approvedProposalStatuses.has(normalized(proposal?.status))) continue;
    const createdAt = validDate(proposal?.createdAt || proposal?.created_at);
    const acceptedAt = validDate(proposal?.acceptedAt || proposal?.accepted_at);
    if (!createdAt || !acceptedAt || acceptedAt < createdAt) continue;
    totalMilliseconds += acceptedAt.getTime() - createdAt.getTime();
    count += 1;
  }

  return count ? { count, days: totalMilliseconds / count / 86_400_000 } : { count: 0, days: null };
}

export function formatElapsedDays(days) {
  if (!Number.isFinite(days) || days < 0) return '—';
  if (days < 1) return 'menos de 1 dia';
  const rounded = Math.round(days * 10) / 10;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(rounded)} ${rounded === 1 ? 'dia' : 'dias'}`;
}
