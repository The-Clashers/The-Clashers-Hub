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

  it('parses the achievements array off the same single response (SR-15)', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#YPCC8QYU2',
        name: 'Yeon',
        townHallLevel: 18,
        expLevel: 220,
        age: 0,
        // Rows mirroring the live payload: a 3-star row past its target, a
        // 2-star row under it, a locked 0-star row, and the duplicate-name
        // row the live payload really carries (Keep Your Account Safe!).
        achievements: [
          { name: 'Gold Grab', stars: 3, value: 2000000000, target: 100000000, info: 'Steal 100000000 Gold', village: 'home' },
          { name: 'Conqueror', stars: 2, value: 3622, target: 5000, info: 'Win 5000 multiplayer battles', village: 'home' },
          { name: 'Keep Your Account Safe!', stars: 0, value: 0, target: 1, info: 'Link your account to a Supercell ID', village: 'home' },
          { name: 'Keep Your Account Safe!', stars: 3, value: 1, target: 1, info: 'Link your account to a Supercell ID', village: 'home' },
          { name: 'Master Engineering', stars: 3, value: 10, target: 5, info: 'Reach builder hall level 5', village: 'builderBase' },
        ],
      })) as typeof fetch;

    const player = await fetchPlayer('#YPCC8QYU2', { fetchImpl });

    expect(player.achievements).toHaveLength(5);
    expect(player.achievements?.[0]).toEqual({
      name: 'Gold Grab',
      stars: 3,
      value: 2_000_000_000,
      target: 100_000_000,
      info: 'Steal 100000000 Gold',
      village: 'home',
    });
    // The duplicate-name rows both parse: the live payload really carries
    // one locked row and one complete row under the same name, so the card
    // keys rows on more than the name and the parse keeps both.
    expect(player.achievements?.[2]).toEqual({
      name: 'Keep Your Account Safe!',
      stars: 0,
      value: 0,
      target: 1,
      info: 'Link your account to a Supercell ID',
      village: 'home',
    });
    expect(player.achievements?.[3]).toEqual({
      name: 'Keep Your Account Safe!',
      stars: 3,
      value: 1,
      target: 1,
      info: 'Link your account to a Supercell ID',
      village: 'home',
    });
    expect(player.achievements?.[4]?.village).toBe('builderBase');
  });

  it('degrades malformed achievement entries to their defaults and drops nameless ones', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Odd Achievements',
        townHallLevel: 9,
        expLevel: 60,
        age: 1,
        achievements: [
          // Missing stars/value/target: the tolerant defaults.
          { name: 'Sparse Row', info: 'Win some battles', village: 'home' },
          // Missing info and village: empty caption, home floor.
          { name: 'Bare Row', stars: 1, value: 4, target: 10 },
          // No name: dropped, the same rule the unit parser keeps.
          { stars: 2, value: 30, target: 50, info: 'Nameless', village: 'home' },
          'not an achievement',
        ],
      })) as typeof fetch;

    const player = await fetchPlayer('#X', { fetchImpl });

    expect(player.achievements).toEqual([
      { name: 'Sparse Row', stars: 0, value: 0, target: 0, info: 'Win some battles', village: 'home' },
      { name: 'Bare Row', stars: 1, value: 4, target: 10, info: '', village: 'home' },
    ]);
  });

  it('leaves achievements undefined when the payload omits the array or sends it empty', async () => {
    const omitted = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'No Achievements',
        townHallLevel: 2,
        expLevel: 8,
        age: 0,
      })) as typeof fetch;
    const playerOmitted = await fetchPlayer('#X', { fetchImpl: omitted });
    expect(playerOmitted.achievements).toBeUndefined();

    const empty = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Empty Achievements',
        townHallLevel: 2,
        expLevel: 8,
        age: 0,
        achievements: [],
      })) as typeof fetch;
    const playerEmpty = await fetchPlayer('#X', { fetchImpl: empty });
    expect(playerEmpty.achievements).toBeUndefined();
  });

  it('parses the heroes array with the equipment the API nests on each entry (SR-15)', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#YPCC8QYU2',
        name: 'Yeon',
        townHallLevel: 18,
        expLevel: 220,
        age: 0,
        // Rows mirroring the live payload: the Barbarian King carries the
        // equipment equipped on him nested inside his own entry, a
        // builder-base hero sits in the same array, and a brand-new hero
        // carries the null-maxLevel shape.
        heroes: [
          {
            name: 'Barbarian King',
            level: 87,
            maxLevel: 110,
            village: 'home',
            equipment: [
              { name: 'Spiky Ball', level: 27, maxLevel: 27, village: 'home' },
              { name: 'Earthquake Boots', level: 18, maxLevel: 18, village: 'home' },
            ],
          },
          {
            name: 'Archer Queen',
            level: 90,
            maxLevel: 90,
            village: 'home',
            equipment: [{ name: 'Giant Gauntlet', level: 20, maxLevel: 27, village: 'home' }],
          },
          // A hero with nothing equipped: no equipment key at all.
          { name: 'Royal Champion', level: 40, maxLevel: 40, village: 'home' },
          // Brand-new content the API has not caught up to.
          { name: 'Minion Prince', level: 9, maxLevel: null, village: 'home' },
          { name: 'Battle Machine', level: 30, maxLevel: 35, village: 'builderBase' },
        ],
      })) as typeof fetch;

    const player = await fetchPlayer('#YPCC8QYU2', { fetchImpl });

    expect(player.heroes).toHaveLength(5);
    expect(player.heroes?.[0]).toEqual({
      name: 'Barbarian King',
      level: 87,
      maxLevel: 110,
      village: 'home',
      equipment: [
        { name: 'Spiky Ball', level: 27, maxLevel: 27, village: 'home' },
        { name: 'Earthquake Boots', level: 18, maxLevel: 18, village: 'home' },
      ],
    });
    // The equipment rides the hero it belongs to; the pair the card
    // renders under the Archer Queen is the nested Giant Gauntlet, not
    // the flat heroEquipment inventory (that array belongs to the
    // progression grid, FR-16).
    expect(player.heroes?.[1].equipment).toEqual([
      { name: 'Giant Gauntlet', level: 20, maxLevel: 27, village: 'home' },
    ]);
    // No equipment key on a hero the payload sends bare.
    expect(player.heroes?.[2].equipment).toBeUndefined();
    // The null maxLevel rides through as null (the card footnotes it).
    expect(player.heroes?.[3].maxLevel).toBeNull();
    expect(player.heroes?.[4]?.village).toBe('builderBase');
  });

  it('degrades malformed hero and equipment entries to their defaults and drops nameless ones', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Odd Heroes',
        townHallLevel: 9,
        expLevel: 60,
        age: 1,
        heroes: [
          // Missing level and village: the tolerant defaults.
          {
            name: 'Sparse Hero',
            maxLevel: 90,
            equipment: [
              // Missing level: defaults to 0; a missing maxLevel floors to null.
              { name: 'Sparse Equipment', village: 'home' },
              // No name: dropped, the same rule the unit parser keeps.
              { level: 12, maxLevel: 27, village: 'home' },
              'not equipment',
            ],
          },
          // No name: the whole hero is dropped, equipment and all.
          { level: 10, maxLevel: 90, village: 'home', equipment: [{ name: 'Orphaned', level: 1, maxLevel: 27 }] },
          'not a hero',
        ],
      })) as typeof fetch;

    const player = await fetchPlayer('#X', { fetchImpl });

    expect(player.heroes).toEqual([
      {
        name: 'Sparse Hero',
        level: 0,
        maxLevel: 90,
        village: 'home',
        equipment: [{ name: 'Sparse Equipment', level: 0, maxLevel: null, village: 'home' }],
      },
    ]);
  });

  it('leaves heroes undefined when the payload omits the array or sends it empty', async () => {
    const omitted = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'No Heroes',
        townHallLevel: 2,
        expLevel: 8,
        age: 0,
      })) as typeof fetch;
    const playerOmitted = await fetchPlayer('#X', { fetchImpl: omitted });
    expect(playerOmitted.heroes).toBeUndefined();

    const empty = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Empty Heroes',
        townHallLevel: 2,
        expLevel: 8,
        age: 0,
        heroes: [],
      })) as typeof fetch;
    const playerEmpty = await fetchPlayer('#X', { fetchImpl: empty });
    expect(playerEmpty.heroes).toBeUndefined();
  });

  it('drops a hero whose equipment array is empty rather than keeping an empty key', async () => {
    // A hero with an empty equipment array (nothing equipped, the API sends
    // [] sometimes) parses without the key: the same convention the unit
    // arrays keep, an omitted array and an empty one mean the same thing.
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Bare Equipment',
        townHallLevel: 9,
        expLevel: 60,
        age: 0,
        heroes: [{ name: 'Grand Warden', level: 65, maxLevel: 65, village: 'home', equipment: [] }],
      })) as typeof fetch;

    const player = await fetchPlayer('#X', { fetchImpl });

    expect(player.heroes).toEqual([
      { name: 'Grand Warden', level: 65, maxLevel: 65, village: 'home' },
    ]);
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
