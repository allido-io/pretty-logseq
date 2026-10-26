interface CacheEntry<V> {
  value: V;
  timestamp: number;
}

/**
 * Minimal time-to-live cache. An entry is returned only while it is younger
 * than `ttlMs`; a stale entry reads as absent. Key normalization (for example
 * lower-casing page names) is the caller's concern, so one implementation
 * serves the v1 and v2 page caches and the link-metadata caches alike.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, CacheEntry<V>>();

  constructor(private readonly ttlMs: number) {}

  /** The cached value, or `undefined` when the key is missing or stale. */
  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (entry && Date.now() - entry.timestamp < this.ttlMs) {
      return entry.value;
    }
    return undefined;
  }

  set(key: string, value: V): void {
    this.entries.set(key, { value, timestamp: Date.now() });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
