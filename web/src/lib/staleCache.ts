/**
 * Muestra cache de inmediato y refresca en red.
 * Si la red falla, no borra lo ya pintado.
 */
export async function hydrateThenRefresh<T>(opts: {
  cancelled: () => boolean;
  readCache: () => Promise<T | null>;
  fetchFresh: () => Promise<T>;
  writeCache?: (data: T) => Promise<void>;
  apply: (data: T) => void;
  isUsable?: (data: T) => boolean;
}): Promise<{ shown: boolean; error?: unknown }> {
  const usable = opts.isUsable ?? ((data: T) => data != null);
  let shown = false;

  try {
    const cached = await opts.readCache();
    if (!opts.cancelled() && cached != null && usable(cached)) {
      opts.apply(cached);
      shown = true;
    }
  } catch {
    /* cache ilegible */
  }

  try {
    const fresh = await opts.fetchFresh();
    if (opts.cancelled()) return { shown };
    opts.apply(fresh);
    shown = true;
    if (opts.writeCache) {
      try {
        await opts.writeCache(fresh);
      } catch {
        /* cache best-effort */
      }
    }
    return { shown };
  } catch (error) {
    return { shown, error };
  }
}
