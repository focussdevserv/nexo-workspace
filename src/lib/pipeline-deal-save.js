/** Saves pipeline edits and only reports success when the caller confirms persistence. */
export async function persistPipelineLeadDeal(onUpdate, lead, draft) {
  const { stage, ...fields } = draft || {};
  const saved = await onUpdate?.(lead, { ...fields, stage });
  return saved === true;
}

export function pipelineLeadEditDraft(lead = {}) {
  return {
    stage: lead.stage || 'Novo lead',
    value: lead.value || '',
    chance: lead.chance ?? 50,
    source: lead.source || 'Manual',
    service: lead.service || '',
    owner: lead.owner || '',
    closeDate: lead.closeDate || '',
    nextAction: lead.nextAction || '',
    notes: lead.notes || '',
  };
}
