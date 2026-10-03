export function createInboxSendLock() {
  let locked = false;
  return {
    get locked() { return locked; },
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() { locked = false; },
  };
}
