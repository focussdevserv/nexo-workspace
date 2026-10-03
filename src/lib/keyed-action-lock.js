export function createKeyedActionLock() {
  const locks = new Map();

  return {
    run(key, action) {
      const normalizedKey = String(key ?? '');
      if (!normalizedKey || typeof action !== 'function') return Promise.resolve({ ok: false, skipped: true });
      let lock = locks.get(normalizedKey);
      if (!lock) {
        let locked = false;
        lock = {
          run: async (callback) => {
            if (locked) return { ok: false, skipped: true };
            locked = true;
            try { return await callback(); }
            finally { locked = false; }
          },
        };
        locks.set(normalizedKey, lock);
      }
      return lock.run(action);
    },
  };
}
