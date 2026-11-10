import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRecentSearches,
  readRecentSearches,
  recordRecentSearch,
  removeRecentSearch,
  setRecentSearchesStorage,
  RECENT_SEARCHES_MAX_ITEMS,
  RECENT_SEARCHES_STORAGE_KEY,
} from './recent-searches';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('recent-searches', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    setRecentSearchesStorage(storage);
  });

  it('starts empty when nothing is stored', () => {
    expect(readRecentSearches()).toEqual([]);
    expect(readRecentSearches('player')).toEqual([]);
    expect(readRecentSearches('clan')).toEqual([]);
  });

  it('records and reads a player lookup', () => {
    recordRecentSearch({ kind: 'player', query: '#9QQ0R0V', label: 'Chief Pat', timestamp: 1000 });
    const items = readRecentSearches();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: 'player:#9QQ0R0V',
      kind: 'player',
      query: '#9QQ0R0V',
      label: 'Chief Pat',
      timestamp: 1000,
    });
  });

  it('deduplicates lookups case-insensitively and puts latest first', () => {
    recordRecentSearch({ kind: 'player', query: '#abc', timestamp: 1000 });
    recordRecentSearch({ kind: 'player', query: '#def', timestamp: 2000 });
    recordRecentSearch({ kind: 'player', query: '#ABC', label: 'Updated Label', timestamp: 3000 });

    const items = readRecentSearches('player');
    expect(items).toHaveLength(2);
    expect(items[0].query).toBe('#ABC');
    expect(items[0].label).toBe('Updated Label');
    expect(items[0].timestamp).toBe(3000);
    expect(items[1].query).toBe('#def');
  });

  it('filters by kind correctly', () => {
    recordRecentSearch({ kind: 'player', query: '#PLAYER1', timestamp: 1000 });
    recordRecentSearch({ kind: 'clan', query: 'Reddit Kings', timestamp: 2000 });

    expect(readRecentSearches('player')).toHaveLength(1);
    expect(readRecentSearches('player')[0].query).toBe('#PLAYER1');

    expect(readRecentSearches('clan')).toHaveLength(1);
    expect(readRecentSearches('clan')[0].query).toBe('Reddit Kings');

    expect(readRecentSearches()).toHaveLength(2);
  });

  it('caps each kind to RECENT_SEARCHES_MAX_ITEMS', () => {
    for (let i = 0; i < RECENT_SEARCHES_MAX_ITEMS + 5; i++) {
      recordRecentSearch({ kind: 'player', query: `#TAG${i}`, timestamp: 1000 + i });
    }
    const players = readRecentSearches('player');
    expect(players).toHaveLength(RECENT_SEARCHES_MAX_ITEMS);
    expect(players[0].query).toBe(`#TAG${RECENT_SEARCHES_MAX_ITEMS + 4}`);
  });

  it('removes a specific item by kind and query', () => {
    recordRecentSearch({ kind: 'player', query: '#P1', timestamp: 1000 });
    recordRecentSearch({ kind: 'player', query: '#P2', timestamp: 2000 });

    removeRecentSearch('player', '#p1');
    const items = readRecentSearches('player');
    expect(items).toHaveLength(1);
    expect(items[0].query).toBe('#P2');
  });

  it('clears specific kind or all items', () => {
    recordRecentSearch({ kind: 'player', query: '#P1', timestamp: 1000 });
    recordRecentSearch({ kind: 'clan', query: 'Clan1', timestamp: 2000 });

    clearRecentSearches('player');
    expect(readRecentSearches('player')).toHaveLength(0);
    expect(readRecentSearches('clan')).toHaveLength(1);

    clearRecentSearches();
    expect(readRecentSearches()).toHaveLength(0);
  });

  it('handles invalid json or corrupted storage gracefully', () => {
    storage.setItem(RECENT_SEARCHES_STORAGE_KEY, '{ bad json');
    expect(readRecentSearches()).toEqual([]);
  });

  it('handles null storage gracefully', () => {
    setRecentSearchesStorage(null);
    expect(readRecentSearches()).toEqual([]);
    recordRecentSearch({ kind: 'player', query: '#P1' });
    removeRecentSearch('player', '#P1');
    clearRecentSearches();
  });
});
