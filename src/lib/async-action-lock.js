export function createAsyncActionLock() {
  let locked = false;

  return {
    get locked() {
      return locked;
    },
    async run(action) {
      if (locked) return { ok: false, skipped: true };
      locked = true;
      try {
        return await action();
      } finally {
        locked = false;
      }
    },
  };
}
