function activityTime(conversation) {
  const candidates = [conversation?.lastMessageAt, conversation?.updatedAt, conversation?.timestamp, conversation?.createdAt, conversation?.time];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value < 10_000_000_000 ? value * 1000 : value;
    const clock = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (clock) return Date.UTC(2000, 0, 1, Number(clock[1]), Number(clock[2]));
    const parsed = Date.parse(String(value || ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function dashboardInboxConversations(conversations, limit = 3) {
  if (!Array.isArray(conversations)) return [];
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  return conversations
    .map((conversation, index) => ({ conversation, index, activity: activityTime(conversation) }))
    .filter(({ conversation }) => conversation && typeof conversation === 'object' && !Array.isArray(conversation) && conversation.id != null)
    .sort((left, right) => {
      if (left.activity === null && right.activity === null) return left.index - right.index;
      if (left.activity === null) return 1;
      if (right.activity === null) return -1;
      return right.activity - left.activity || left.index - right.index;
    })
    .slice(0, safeLimit)
    .map(({ conversation }) => conversation);
}
