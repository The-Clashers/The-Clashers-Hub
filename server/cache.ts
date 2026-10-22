// In-memory TTL cache, one instance per route, per function instance
// (docs/concept/04-api-strategy section 5). Map insertion order gives the
// small LRU behavior: a get bumps recency, an overflow evicts from the front.

export interface CacheEntry {
  /** Final HTTP status this entry serves with (200 data, 404 negative). */
  status: number;
  /** Body text to serve. For 200 entries the raw upstream body; age is injected per serve. */
  body: string;
  /** Epoch ms of the upstream fetch, for the age field. */
  storedAt: number;
}

interface StoredEntry extends CacheEntry {
  expiresAt: number;
}

export interface TtlCacheOptions {
  maxEntries?: number;
  now?: () => number;
}

export class TtlCache {
  private readonly entries = new Map<string, StoredEntry>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: TtlCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 128;
    this.now = options.now ?? Date.now;
  }

  get(key: string): CacheEntry | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    // Bump recency so eviction order stays least-recently-used first.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, entry: CacheEntry, ttlMs: number): void {
    this.entries.delete(key);
    this.entries.set(key, { ...entry, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
