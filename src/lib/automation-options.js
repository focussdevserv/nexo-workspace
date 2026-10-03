export function automationActionsForTrigger(trigger, templates = []) {
  return [...new Set((Array.isArray(templates) ? templates : [])
    .filter((template) => template?.trigger === trigger && typeof template.action === 'string' && template.action.trim())
    .map((template) => template.action))];
}

export function defaultAutomationAction(trigger, templates = []) {
  return automationActionsForTrigger(trigger, templates)[0] || '';
}

export function automationDraftForEdit(item, fallbackTrigger, templates = []) {
  const trigger = item?.trigger || fallbackTrigger || '';
  return {
    name: item?.name || '',
    detail: item?.detail || '',
    trigger,
    action: item?.action || defaultAutomationAction(trigger, templates),
  };
}

export function automationActionOptions(trigger, currentAction, templates = []) {
  const actions = automationActionsForTrigger(trigger, templates);
  if (currentAction && !actions.includes(currentAction)) actions.push(currentAction);
  return actions;
}
