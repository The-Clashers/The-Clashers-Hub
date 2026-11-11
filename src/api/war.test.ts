import { describe, expect, it } from 'vitest';
import { attacksLeftFor, fetchCurrentWar, parseWarTimestamp, WarFetchError } from './war';
import type { CurrentWarResponse } from './war';

// Tests for the current-war client. The parser is exercised through
// fetchCurrentWar with a stubbed fetch, the same approach the clan and
// search clients take: the tier's response shape is what the screens
// read, so the tests lock that shape against upstream drift. The pure
// lookups (attacksLeftFor, parseWarTimestamp) get their own tables.

describe('fetchCurrentWar', () => {
  function stubResponse(status: number, body: unknown): Response {
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  it('parses the state, the allowance, and the attacks-used map', async () => {
    const payload = {
      state: 'inWar',
      teamSize: 15,
      attacksPerMember: 2,
      age: 4,
      clan: {
        tag: '#MOCKCLAN',
        name: 'Mock Clan',
        members: [
          { tag: '#MOCKPLAY', name: 'Mock Player', attacks: [{ stars: 3 }, { stars: 2 }] },
          { tag: '#MOCKTWO', name: 'Mock Second', attacks: [{ stars: 1 }] },
          { tag: '#MOOKIDLE', name: 'Mock Idle' },
        ],
      },
      opponent: { tag: '#MOCKFOE', members: [{ tag: '#FOE1', attacks: [{ stars: 0 }] }] },
    };
    const war = await fetchCurrentWar('#MOCKCLAN', {
      fetchImpl: async () => stubResponse(200, payload),
    });
    expect(war.state).toBe('inWar');
    expect(war.attacksPerMember).toBe(2);
    expect(war.age).toBe(4);
    expect(war.attacksUsedByTag.get('#MOCKPLAY')).toBe(2);
    expect(war.attacksUsedByTag.get('#MOCKTWO')).toBe(1);
    // A war member with no attacks array has used zero.
    expect(war.attacksUsedByTag.get('#MOOKIDLE')).toBe(0);
    // The opponent's roster is not the attacks-left projection's concern.
    expect(war.attacksUsedByTag.has('#FOE1')).toBe(false);
  });

  it('parses both clans with their standings, rosters, and attack detail', async () => {
    const payload = {
      state: 'inWar',
      teamSize: 5,
      attacksPerMember: 2,
      startTime: '20261111T101500.000Z',
      endTime: '20261112T101500.000Z',
      clan: {
        tag: '#MOCKCLAN',
        name: 'Mock Clan',
        badgeUrls: { small: 'https://example.com/s.png', medium: 'https://example.com/m.png' },
        clanLevel: 9,
        attacks: 7,
        stars: 12,
        destructionPercentage: 71.5,
        members: [
          {
            tag: '#P2',
            name: 'Second Base',
            townhallLevel: 15,
            mapPosition: 2,
            attacks: [{ stars: 3, destructionPercentage: 98 }],
          },
          {
            tag: '#P1',
            name: 'First Base',
            townhallLevel: 17,
            mapPosition: 1,
            attacks: [
              { stars: 2, destructionPercentage: 64.32 },
              { stars: 3, destructionPercentage: 100 },
            ],
          },
        ],
      },
      opponent: {
        tag: '#MOCKFOE',
        name: 'Mock Foe',
        clanLevel: 4,
        attacks: 5,
        stars: 6,
        destructionPercentage: 44.2,
        members: [{ tag: '#FOE1', name: 'Foe One', townhallLevel: 16, mapPosition: 1 }],
      },
    };
    const war = await fetchCurrentWar('#MOCKCLAN', {
      fetchImpl: async () => stubResponse(200, payload),
    });

    expect(war.teamSize).toBe(5);
    expect(war.startTimeMs).toBe(Date.UTC(2026, 10, 11, 10, 15, 0));
    expect(war.endTimeMs).toBe(Date.UTC(2026, 10, 12, 10, 15, 0));

    expect(war.clan.tag).toBe('#MOCKCLAN');
    expect(war.clan.name).toBe('Mock Clan');
    expect(war.clan.badgeUrl).toBe('https://example.com/m.png');
    expect(war.clan.clanLevel).toBe(9);
    expect(war.clan.stars).toBe(12);
    expect(war.clan.destructionPercentage).toBe(71.5);
    expect(war.clan.attackCount).toBe(7);

    // The roster renders in war-map order, not payload order.
    expect(war.clan.members.map((member) => member.mapPosition)).toEqual([1, 2]);
    const firstBase = war.clan.members[0];
    expect(firstBase.name).toBe('First Base');
    expect(firstBase.townHallLevel).toBe(17);
    expect(firstBase.attacks).toEqual([
      { stars: 2, destructionPercentage: 64.32 },
      { stars: 3, destructionPercentage: 100 },
    ]);

    expect(war.opponent.tag).toBe('#MOCKFOE');
    expect(war.opponent.stars).toBe(6);
    expect(war.opponent.members).toHaveLength(1);
    expect(war.opponent.members[0].attacks).toEqual([]);
    // No badge urls on the opponent: null, the quiet block's trigger.
    expect(war.opponent.badgeUrl).toBeNull();
  });

  it('degrades a warless payload to an absent state and empty sides', async () => {
    const war = await fetchCurrentWar('#MOCKCLAN', {
      fetchImpl: async () =>
        stubResponse(200, {
          state: 'notInWar',
          age: 1,
          clan: { badgeUrls: {}, clanLevel: 0, attacks: 0, stars: 0, destructionPercentage: 0 },
          opponent: { badgeUrls: {}, clanLevel: 0, attacks: 0, stars: 0, destructionPercentage: 0 },
        }),
    });
    expect(war.state).toBe('notInWar');
    expect(war.attacksPerMember).toBeUndefined();
    expect(war.attacksUsedByTag.size).toBe(0);
    // Both sides parse to their empty shape so the view never branches on
    // absent objects, only on the state.
    expect(war.clan.members).toEqual([]);
    expect(war.opponent.members).toEqual([]);
    expect(war.clan.tag).toBe('');
    expect(war.clan.badgeUrl).toBeNull();
  });

  it('narrows an unrecognized state to undefined instead of trusting it', async () => {
    const war = await fetchCurrentWar('#MOCKCLAN', {
      fetchImpl: async () => stubResponse(200, { state: 'somethingNew', age: 0 }),
    });
    expect(war.state).toBeUndefined();
  });

  it('drops member rows without a tag instead of keying junk', async () => {
    const payload = {
      state: 'inWar',
      attacksPerMember: 2,
      clan: { members: [{ name: 'No Tag' }, { tag: '#OK', attacks: [] }] },
    };
    const war = await fetchCurrentWar('#MOCKCLAN', {
      fetchImpl: async () => stubResponse(200, payload),
    });
    expect(war.attacksUsedByTag.size).toBe(1);
    expect(war.attacksUsedByTag.has('#OK')).toBe(true);
    expect(war.clan.members).toHaveLength(1);
  });

  it('sorts members without a map position to the end in payload order', async () => {
    const payload = {
      state: 'inWar',
      clan: {
        members: [
          { tag: '#NOPOS', name: 'No Position', mapPosition: 0 },
          { tag: '#POS2', name: 'Position Two', mapPosition: 2 },
          { tag: '#POS1', name: 'Position One', mapPosition: 1 },
        ],
      },
    };
    const war = await fetchCurrentWar('#MOCKCLAN', {
      fetchImpl: async () => stubResponse(200, payload),
    });
    expect(war.clan.members.map((member) => member.tag)).toEqual(['#POS1', '#POS2', '#NOPOS']);
  });

  it('maps the contract errors to the union kinds', async () => {
    const cases: ReadonlyArray<[number, unknown, string]> = [
      [404, { error: 'not_found', tag: '#GONE' }, 'not_found'],
      [503, { error: 'upstream_busy', retryAfter: 12 }, 'busy'],
      [502, { error: 'upstream_unreachable' }, 'unreachable'],
      [400, { error: 'bad_request', detail: 'invalid tag' }, 'bad_request'],
    ];
    for (const [status, body, kind] of cases) {
      await expect(
        fetchCurrentWar('#MOCKCLAN', {
          fetchImpl: async () => stubResponse(status, body),
        }),
      ).rejects.toMatchObject({ result: { kind } });
    }
  });

  it('wraps failures in WarFetchError', async () => {
    try {
      await fetchCurrentWar('#MOCKCLAN', {
        fetchImpl: async () => stubResponse(503, { error: 'upstream_busy', retryAfter: 5 }),
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(WarFetchError);
    }
  });

  it('rejects a non-object success body as bad_request', async () => {
    await expect(
      fetchCurrentWar('#MOCKCLAN', {
        fetchImpl: async () => stubResponse(200, [1, 2, 3]),
      }),
    ).rejects.toMatchObject({ result: { kind: 'bad_request' } });
  });

  it('encodes the canonical tag onto the tier path', async () => {
    let calledPath = '';
    await fetchCurrentWar('#2JPCYP98L', {
      fetchImpl: async (input: RequestInfo | URL) => {
        calledPath = String(input);
        return stubResponse(200, { state: 'notInWar', age: 0 });
      },
    });
    expect(calledPath).toBe('/api/clan/%232JPCYP98L/war');
  });
});

describe('parseWarTimestamp', () => {
  it('parses the API basic-format timestamps into epoch instants', () => {
    expect(parseWarTimestamp('20261016T091952.000Z')).toBe(Date.UTC(2026, 9, 16, 9, 19, 52));
    expect(parseWarTimestamp('20270102T235959.000Z')).toBe(Date.UTC(2027, 0, 2, 23, 59, 59));
  });

  it('returns undefined for anything the shape does not cover', () => {
    expect(parseWarTimestamp('2026-10-16T09:19:52.000Z')).toBeUndefined();
    expect(parseWarTimestamp(1760611192)).toBeUndefined();
    expect(parseWarTimestamp('')).toBeUndefined();
    expect(parseWarTimestamp(undefined)).toBeUndefined();
  });
});

describe('attacksLeftFor', () => {
  const war: CurrentWarResponse = {
    state: 'inWar',
    attacksPerMember: 2,
    age: 0,
    clan: { tag: '', name: '', badgeUrl: null, clanLevel: 0, stars: 0, destructionPercentage: 0, attackCount: 0, members: [] },
    opponent: { tag: '', name: '', badgeUrl: null, clanLevel: 0, stars: 0, destructionPercentage: 0, attackCount: 0, members: [] },
    attacksUsedByTag: new Map([
      ['#SPENT', 2],
      ['#HALF', 1],
      ['#IDLE', 0],
    ]),
  };

  it('counts down from the allowance per member', () => {
    expect(attacksLeftFor(war, '#SPENT')).toBe(0);
    expect(attacksLeftFor(war, '#HALF')).toBe(1);
    expect(attacksLeftFor(war, '#IDLE')).toBe(2);
  });

  it('returns null for a member not on the war roster', () => {
    expect(attacksLeftFor(war, '#ABSENT')).toBeNull();
  });

  it('returns null without a war', () => {
    expect(attacksLeftFor(undefined, '#HALF')).toBeNull();
  });

  it('returns null outside preparation and battle day', () => {
    expect(attacksLeftFor({ ...war, state: 'notInWar' }, '#HALF')).toBeNull();
    expect(attacksLeftFor({ ...war, state: 'ended' }, '#HALF')).toBeNull();
  });

  it('still counts during preparation day, where no attacks exist yet', () => {
    expect(attacksLeftFor({ ...war, state: 'preparation' }, '#HALF')).toBe(1);
  });

  it('falls back to the 2-attack allowance when upstream omits it', () => {
    const withoutAllowance = { ...war, attacksPerMember: undefined };
    expect(attacksLeftFor(withoutAllowance, '#HALF')).toBe(1);
    expect(attacksLeftFor(withoutAllowance, '#IDLE')).toBe(2);
  });
});
