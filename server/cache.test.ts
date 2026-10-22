import { describe, expect, it } from 'vitest';
import { TtlCache } from './cache';

function fakeClock(start = 1_000_000) {
  let now = start;
  return {
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

describe('TtlCache', () => {
  it('returns null on a miss', () => {
    const cache = new TtlCache();
    expect(cache.get('missing')).toBeNull();
  });

  it('serves an entry within its ttl and expires it after', () => {
    const clock = fakeClock();
    const cache = new TtlCache({ now: clock.now });
    cache.set('k', { status: 200, body: '{}', storedAt: clock.now() }, 1_000);
    expect(cache.get('k')?.body).toBe('{}');
    clock.advance(999);
    expect(cache.get('k')).not.toBeNull();
    clock.advance(2);
    expect(cache.get('k')).toBeNull();
  });

  it('keeps a different ttl per entry (negative vs positive caching)', () => {
    const clock = fakeClock();
    const cache = new TtlCache({ now: clock.now });
    cache.set('data', { status: 200, body: 'a', storedAt: clock.now() }, 5_000);
    cache.set('gone', { status: 404, body: 'b', storedAt: clock.now() }, 30_000);
    clock.advance(6_000);
    expect(cache.get('data')).toBeNull();
    expect(cache.get('gone')?.body).toBe('b');
  });

  it('evicts the least recently used entry at capacity', () => {
    const clock = fakeClock();
    const cache = new TtlCache({ maxEntries: 2, now: clock.now });
    cache.set('a', { status: 200, body: 'a', storedAt: clock.now() }, 60_000);
    cache.set('b', { status: 200, body: 'b', storedAt: clock.now() }, 60_000);
    cache.get('a'); // bump a: b becomes the oldest
    cache.set('c', { status: 200, body: 'c', storedAt: clock.now() }, 60_000);
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')?.body).toBe('a');
    expect(cache.get('c')?.body).toBe('c');
  });

  it('overwrites an existing key without growing', () => {
    const clock = fakeClock();
    const cache = new TtlCache({ maxEntries: 2, now: clock.now });
    cache.set('a', { status: 200, body: 'old', storedAt: clock.now() }, 60_000);
    cache.set('a', { status: 200, body: 'new', storedAt: clock.now() }, 60_000);
    expect(cache.size).toBe(1);
    expect(cache.get('a')?.body).toBe('new');
  });
});
