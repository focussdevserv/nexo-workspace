export function createCommercialSubmissionLock() {
  let locked = false;
  return {
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
    async run(action) {
      if (!this.acquire()) return false;
      try {
        return await action();
      } finally {
        this.release();
      }
    },
  };
}
