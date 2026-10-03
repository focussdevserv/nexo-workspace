const MIN_INTERVAL = 1;
const MAX_INTERVAL = 24;

const PRESETS = {
  'months:1': { frequency: 'months', frequencyInterval: 1 },
  'months:3': { frequency: 'months', frequencyInterval: 3 },
  'months:6': { frequency: 'months', frequencyInterval: 6 },
  'months:12': { frequency: 'months', frequencyInterval: 12 },
  'days:7': { frequency: 'days', frequencyInterval: 7 },
};

export function subscriptionCycleChoice(frequency, interval) {
  const key = `${frequency}:${Number(interval)}`;
  return PRESETS[key] ? key : 'custom';
}

export function subscriptionCycleFromChoice(choice, current = {}) {
  if (PRESETS[choice]) return { ...PRESETS[choice] };
  if (choice !== 'custom') throw new Error('subscription_frequency_invalid');
  const currentKey = `${current.frequency}:${Number(current.frequencyInterval)}`;
  const currentIsPreset = Boolean(PRESETS[currentKey]);
  return {
    frequency: current.frequency === 'days' ? 'days' : 'months',
    frequencyInterval: !currentIsPreset && Number.isInteger(Number(current.frequencyInterval))
      && Number(current.frequencyInterval) >= MIN_INTERVAL
      && Number(current.frequencyInterval) <= MAX_INTERVAL
      ? Number(current.frequencyInterval)
      : 2,
  };
}

export function validateSubscriptionCycle(frequency, interval) {
  const normalizedInterval = Number(interval);
  if (!['days', 'months'].includes(frequency)) return 'subscription_frequency_invalid';
  if (!Number.isInteger(normalizedInterval) || normalizedInterval < MIN_INTERVAL || normalizedInterval > MAX_INTERVAL) {
    return 'subscription_interval_invalid';
  }
  return '';
}

export function subscriptionCyclePayload(frequency, interval) {
  const error = validateSubscriptionCycle(frequency, interval);
  if (error) throw new Error(error);
  return { frequency, frequencyInterval: Number(interval) };
}
