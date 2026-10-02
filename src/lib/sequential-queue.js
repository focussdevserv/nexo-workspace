export function createSequentialQueue() {
  let tail = Promise.resolve();

  return {
    enqueue(operation) {
      const result = tail.then(operation);
      tail = result.catch(() => {});
      return result;
    },
  };
}
