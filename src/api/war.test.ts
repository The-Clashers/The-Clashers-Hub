import { describe, expect, it } from 'vitest';
import { attacksLeftFor, fetchCurrentWar, WarFetchError } from './war';

// Tests for the current-war client. The parser is exercised through
// fetchCurrentWar with a stubbed fetch, the same approach the clan and
// search clients take: the tier's response shape is what the screen reads,
// so the tests lock that shape against upstream drift. attacksLeftFor is
// pure, so it gets its own table.

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
    // The opponent's roster is not our concern.
    expect(war.attacksUsedByTag.has('#FOE1')).toBe(false);
  });

  it('degrades a warless payload to an absent state and an empty map', async () => {
    const war = await fetchCurrentWar('#MOCKCLAN', {
      fetchImpl: async () => stubResponse(200, { state: 'notInWar', age: 1 }),
    });
    expect(war.state).toBe('notInWar');
    expect(war.attacksPerMember).toBeUndefined();
    expect(war.attacksUsedByTag.size).toBe(0);
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

describe('attacksLeftFor', () => {
  const war = {
    state: 'inWar',
    attacksPerMember: 2,
    age: 0,
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
