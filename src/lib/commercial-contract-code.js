export function commercialContractCode(proposalId, now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const stableProposalId = String(proposalId ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!stableProposalId) throw new TypeError('A proposal id is required to generate a contract code.');
  return `CTR-${date}-${stableProposalId}`;
}
