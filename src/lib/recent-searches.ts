// Recent searches storage helper (F-13, FR-15, T-M3-5, 06 section 5).
//
// Pure TypeScript: no React, no network, no clock (STD-09). Reads and writes
// recent searches in the browser's localStorage. Wrapped in try/catch guards
// so sandboxed iframes or private browsing modes that disable or throw on
// localStorage do not crash the application (STD-37).
//
// Deduplicates lookups (case-insensitively for queries), keeps the most
// recent entry first, and caps each kind to a reasonable size so the strip
// stays compact.

export type SearchKind = 'player' | 'clan';

export interface RecentSearchItem {
  readonly id: string;
  readonly kind: SearchKind;
  readonly query: string;
  readonly label?: string;
  readonly timestamp: number;
}

export const RECENT_SEARCHES_STORAGE_KEY = 'tch_recent_searches';
export const RECENT_SEARCHES_MAX_ITEMS = 8;

let customStorage: Storage | null = null;

/**
 * Injects a custom Storage implementation (used for node test environments).
 */
export function setRecentSearchesStorage(storage: Storage | null): void {
  customStorage = storage;
}

function getStorage(): Storage | null {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage?: Storage }).localStorage ?? null;
    }
  } catch {
    // Sandboxed or security-restricted environment
  }
  return null;
}

/**
 * Reads all recorded recent searches from localStorage.
 * Optionally filters by kind ('player' or 'clan').
 * Returns the most recent entries first.
 */
export function readRecentSearches(kind?: SearchKind): RecentSearchItem[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const items: RecentSearchItem[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        (item.kind === 'player' || item.kind === 'clan') &&
        typeof item.query === 'string' &&
        item.query.trim().length > 0 &&
        typeof item.timestamp === 'number'
      ) {
        if (!kind || item.kind === kind) {
          items.push({
            id: `${item.kind}:${item.query.trim().toUpperCase()}`,
            kind: item.kind,
            query: item.query.trim(),
            label: typeof item.label === 'string' && item.label.trim().length > 0 ? item.label.trim() : undefined,
            timestamp: item.timestamp,
          });
        }
      }
    }
    return items.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/**
 * Records a lookup in localStorage.
 * Moves existing duplicate queries to the front and limits list to RECENT_SEARCHES_MAX_ITEMS.
 */
export function recordRecentSearch(entry: {
  kind: SearchKind;
  query: string;
  label?: string;
  timestamp?: number;
}): void {
  const storage = getStorage();
  if (!storage) return;

  const trimmedQuery = entry.query.trim();
  if (trimmedQuery.length === 0) return;

  try {
    const all = readRecentSearches();
    const normalizedKey = `${entry.kind}:${trimmedQuery.toUpperCase()}`;

    // Remove existing match if present
    const filtered = all.filter((item) => item.id !== normalizedKey);

    const newItem: RecentSearchItem = {
      id: normalizedKey,
      kind: entry.kind,
      query: trimmedQuery,
      label: entry.label?.trim() || undefined,
      timestamp: entry.timestamp ?? Date.now(),
    };

    // Filter to retain at most RECENT_SEARCHES_MAX_ITEMS per kind
    const sameKind = [newItem, ...filtered.filter((item) => item.kind === entry.kind)].slice(
      0,
      RECENT_SEARCHES_MAX_ITEMS,
    );
    const otherKind = filtered.filter((item) => item.kind !== entry.kind);

    const combined = [...sameKind, ...otherKind].sort((a, b) => b.timestamp - a.timestamp);
    storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(combined));
  } catch {
    // Quota exceeded or storage disabled; fail silently
  }
}

/**
 * Removes a specific lookup from localStorage.
 */
export function removeRecentSearch(kind: SearchKind, query: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const all = readRecentSearches();
    const normalizedKey = `${kind}:${query.trim().toUpperCase()}`;
    const filtered = all.filter((item) => item.id !== normalizedKey);
    storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Storage disabled; fail silently
  }
}

/**
 * Clears all recent searches, or all searches of a specified kind.
 */
export function clearRecentSearches(kind?: SearchKind): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    if (!kind) {
      storage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
      return;
    }
    const all = readRecentSearches();
    const remaining = all.filter((item) => item.kind !== kind);
    if (remaining.length === 0) {
      storage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } else {
      storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(remaining));
    }
  } catch {
    // Storage disabled; fail silently
  }
}
