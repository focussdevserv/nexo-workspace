/** Saves pipeline edits and only reports success when the caller confirms persistence. */
export async function persistPipelineLeadDeal(onUpdate, lead, draft) {
  const { stage, ...fields } = draft || {};
  const saved = await onUpdate?.(lead, { ...fields, stage });
  return saved === true;
}
