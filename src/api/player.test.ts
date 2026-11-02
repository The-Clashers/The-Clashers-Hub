import { describe, expect, it } from 'vitest';
import { fetchPlayer, PlayerFetchError, type PlayerResponse } from './player';

// Tests for the player client (T-M2-1). The parser is exercised through
// fetchPlayer with a stubbed fetch, the same approach the clan test takes:
// the tier's response shape is what the screen reads, so the tests lock
// that shape against upstream drift. Every optional field (role, clan,
// leagueTier, league) has a test for both present and absent, and the
// fixtures mirror the three real payload shapes the live proxy served
// while the card was built: a clan member with both league objects, a
// clanless player with neither, and a clan member whose only tier is the
// real "Unranked" one.

describe('fetchPlayer', () => {
  function stubResponse(status: number, body: unknown): Response {
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  const fullPayload = {
    tag: '#YPCC8QYU2',
    name: 'Yeon',
    townHallLevel: 18,
    expLevel: 220,
    trophies: 617,
    bestTrophies: 5558,
    warStars: 1959,
    attackWins: 13,
    defenseWins: 3,
    role: 'leader',
    warPreference: 'in',
    donations: 3496,
    donationsReceived: 3455,
    clanCapitalContributions: 1629485,
    clan: {
      tag: '#2JPCYP98L',
      name: 'Umbra Lunaria',
      clanLevel: 11,
      badgeUrls: {
        small: 'c-s.png',
        large: 'c-l.png',
        medium: 'c-m.png',
      },
    },
    // The legacy league object (the classic trophy league) still arrives
    // alongside the new ladder tier; the client keeps both so the header
    // can fall back, but only the small icon size is typed.
    league: {
      id: 29000022,
      name: 'Legend League',
      iconUrls: {
        small: 'l-s.png',
        tiny: 'l-t.png',
        medium: 'l-m.png',
      },
    },
    leagueTier: {
      id: 105000031,
      name: 'Electro League 31',
      iconUrls: {
        small: 't-s.png',
        large: 't-l.png',
      },
    },
    age: 12,
  };

  it('requests the encoded tag and parses the identity block, both league shapes, and age', async () => {
    let requested = '';
    const fetchImpl = (async (input: RequestInfo | URL) => {
      requested = String(input);
      return stubResponse(200, fullPayload);
    }) as typeof fetch;

    const player = await fetchPlayer('#YPCC8QYU2', { fetchImpl });

    // The tier request path encodes the # so the server route sees one
    // segment, not a fragment. This encoding lives on the tier request only:
    // the shareable browser URL carries the bare tag (lib/tag.ts).
    expect(requested).toBe('/api/player/%23YPCC8QYU2');

    expect(player).toEqual({
      tag: '#YPCC8QYU2',
      name: 'Yeon',
      townHallLevel: 18,
      expLevel: 220,
      role: 'leader',
      clan: { tag: '#2JPCYP98L', name: 'Umbra Lunaria' },
      leagueTier: { name: 'Electro League 31', iconUrls: { small: 't-s.png' } },
      league: { name: 'Legend League', iconUrls: { small: 'l-s.png' } },
      age: 12,
    } satisfies PlayerResponse);
  });

  it('defaults optional fields when the payload omits them', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#ABC',
        name: 'No Frills',
        townHallLevel: 3,
        expLevel: 12,
        age: 0,
      })) as typeof fetch;

    const player = await fetchPlayer('#ABC', { fetchImpl });

    expect(player.role).toBeUndefined();
    expect(player.clan).toBeUndefined();
    expect(player.leagueTier).toBeUndefined();
    expect(player.league).toBeUndefined();
    expect(player.townHallLevel).toBe(3);
    expect(player.expLevel).toBe(12);
    expect(player.age).toBe(0);
  });

  it('parses the clanless shape the live proxy serves (nulls and no role)', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#L8YYY8CGY',
        name: 'Wanderer',
        townHallLevel: 16,
        expLevel: 141,
        trophies: 3120,
        clan: null,
        league: null,
        leagueTier: null,
        age: 4,
      })) as typeof fetch;

    const player = await fetchPlayer('#L8YYY8CGY', { fetchImpl });

    expect(player.clan).toBeUndefined();
    expect(player.league).toBeUndefined();
    expect(player.leagueTier).toBeUndefined();
    expect(player.role).toBeUndefined();
  });

  it('parses a real Unranked tier like any other tier', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#LURG82P98',
        name: 'Steady Hand',
        townHallLevel: 18,
        expLevel: 215,
        role: 'coLeader',
        clan: { tag: '#2JPCYP98L', name: 'Umbra Lunaria', clanLevel: 11 },
        leagueTier: {
          id: 29000000,
          name: 'Unranked',
          iconUrls: { small: 'u-s.png', large: 'u-l.png' },
        },
        age: 2,
      })) as typeof fetch;

    const player = await fetchPlayer('#LURG82P98', { fetchImpl });

    // "Unranked" is a named tier with its own icon, not the quiet fallback,
    // so it stays in the parsed shape for the header to render like any
    // other league.
    expect(player.leagueTier).toEqual({ name: 'Unranked', iconUrls: { small: 'u-s.png' } });
    expect(player.role).toBe('coLeader');
  });

  it('keeps a league without icons and drops a clan without a tag', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Odd Shapes',
        townHallLevel: 9,
        expLevel: 60,
        role: 'member',
        clan: { name: 'No Tag Clan' },
        leagueTier: { name: 'Goblin League 5' },
        league: { name: 'Gold League', iconUrls: {} },
        age: 1,
      })) as typeof fetch;

    const player = await fetchPlayer('#X', { fetchImpl });

    expect(player.clan).toBeUndefined();
    expect(player.leagueTier).toEqual({ name: 'Goblin League 5', iconUrls: undefined });
    expect(player.league).toEqual({ name: 'Gold League', iconUrls: undefined });
  });

  it('parses empty tier and league objects to undefined', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Empty Leagues',
        townHallLevel: 2,
        expLevel: 8,
        leagueTier: {},
        league: {},
        age: 0,
      })) as typeof fetch;

    const player = await fetchPlayer('#X', { fetchImpl });

    expect(player.leagueTier).toBeUndefined();
    expect(player.league).toBeUndefined();
  });

  it('maps a 404 with the tag to the not_found branch', async () => {
    const fetchImpl = (async () => stubResponse(404, { error: 'not_found' })) as typeof fetch;
    await expect(fetchPlayer('#NOPE', { fetchImpl })).rejects.toThrowError(PlayerFetchError);
    try {
      await fetchPlayer('#NOPE', { fetchImpl });
    } catch (error) {
      expect((error as PlayerFetchError).result).toEqual({ kind: 'not_found', tag: '' });
    }
  });

  it('maps a 503 with a retryAfter to the busy branch, defaulting to 30s', async () => {
    const fetchImpl = (async () =>
      stubResponse(503, { error: 'upstream_busy', retryAfter: 42 })) as typeof fetch;
    try {
      await fetchPlayer('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as PlayerFetchError).result).toEqual({ kind: 'busy', retryAfter: 42 });
    }
  });

  it('defaults retryAfter to 30 when the 503 body omits it', async () => {
    const fetchImpl = (async () => stubResponse(503, { error: 'upstream_busy' })) as typeof fetch;
    try {
      await fetchPlayer('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as PlayerFetchError).result).toEqual({ kind: 'busy', retryAfter: 30 });
    }
  });

  it('maps a 502 to the unreachable branch', async () => {
    const fetchImpl = (async () => stubResponse(502, { error: 'upstream_unreachable' })) as typeof fetch;
    try {
      await fetchPlayer('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as PlayerFetchError).result).toEqual({ kind: 'unreachable' });
    }
  });

  it('maps a 400 with its detail to the bad_request branch', async () => {
    const fetchImpl = (async () =>
      stubResponse(400, { error: 'bad_request', detail: 'tag is malformed' })) as typeof fetch;
    try {
      await fetchPlayer('#!', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as PlayerFetchError).result).toEqual({
        kind: 'bad_request',
        detail: 'tag is malformed',
      });
    }
  });

  it('throws bad_request when the 200 body is not a JSON object', async () => {
    const fetchImpl = (async () => stubResponse(200, ['not', 'an', 'object'])) as typeof fetch;
    try {
      await fetchPlayer('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as PlayerFetchError).result.kind).toBe('bad_request');
    }
  });

  it('survives a body that is not JSON at all', async () => {
    const fetchImpl = (async () => ({
      status: 200,
      ok: true,
      text: async () => 'not json',
    } as unknown as Response)) as typeof fetch;
    try {
      await fetchPlayer('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      // Non-JSON parses to null, which is not a record, so the parser
      // throws the bad_request branch rather than crashing the screen.
      expect((error as PlayerFetchError).result.kind).toBe('bad_request');
    }
  });
});
