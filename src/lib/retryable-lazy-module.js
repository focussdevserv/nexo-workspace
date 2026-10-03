export function createRetryableLazyModuleRegistry(createLazy, loaders) {
  const cache = new Map();
  return (name, attempt = 0) => {
    const loader = loaders[name];
    if (typeof loader !== 'function') return null;
    const key = `${name}:${attempt}`;
    if (!cache.has(key)) cache.set(key, createLazy(loader));
    return cache.get(key);
  };
}
