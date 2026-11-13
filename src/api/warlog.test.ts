import { describe, expect, it } from 'vitest';
import { fetchWarlog, WarlogFetchError } from './warlog';

// Tests for the war log client (T-M3-2). The parser is exercised through
// fetchWarlog with a stubbed fetch, the same approach the clan, search,
// and war clients take: the tier's response shape is what the Log tab
// reads, so the tests lock that shape against upstream drift. The
// private reading gets its own block because it is the route's one
// designed state: it must resolve as a success, never throw.

/** The smoke clan's first warlog page shape, trimmed to the fields the
 * parse reads (captured live through the proxy 2026-11-12). */
function liveLikeItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    result: 'win',
    endTime: '20261016T091952.000Z',
    teamSize: 5,
    attacksPerMember: 2,
    clan: {
      tag: '#2JPCYP98L',
      name: 'Umbra Lunaria',
      badgeUrls: { small: 's.png', medium: 'm.png' },
      clanLevel: 11,
      attacks: 5,
      stars: 15,
      destructionPercentage: 100.0,
    },
    opponent: {
      tag: '#2JUCJ28J0',
      name: 'Gorilla',
      badgeUrls: { small: 'os.png' },
      clanLevel: 12,
      stars: 4,
      destructionPercentage: 33.8,
    },
    ...overrides,
  };
}

describe('fetchWarlog', () => {
  function stubResponse(status: number, body: unknown): Response {
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  it('parses a public page: results, sides, allowance, and the age', async () => {
    const response = await fetchWarlog('#2JPCYP98L', {
      fetchImpl: async () =>
        stubResponse(200, {
          items: [liveLikeItem()],
          paging: { cursors: { after: 'eyJwb3MiOjV9' } },
          age: 12,
        }),
    });
    expect(response.private).toBe(false);
    if (response.private) return;
    expect(response.age).toBe(12);
    expect(response.entries).toHaveLength(1);
    const entry = response.entries[0];
    expect(entry.result).toBe('win');
    expect(entry.endTimeMs).toBe(Date.UTC(2026, 9, 16, 9, 19, 52));
    expect(entry.teamSize).toBe(5);
    expect(entry.attacksPerMember).toBe(2);
    expect(entry.clan.stars).toBe(15);
    expect(entry.clan.attackCount).toBe(5);
    expect(entry.clan.destructionPercentage).toBe(100);
    expect(entry.clan.badgeUrl).toBe('m.png');
    expect(entry.opponent.name).toBe('Gorilla');
    // The live API omits the opponent's attack count; it reads as 0.
    expect(entry.opponent.attackCount).toBe(0);
    // The small badge is the fallback when medium is absent.
    expect(entry.opponent.badgeUrl).toBe('os.png');
  });

  it('maps win, lose, and tie, and reads a missing result by the allowance', async () => {
    const response = await fetchWarlog('#CLAN', {
      fetchImpl: async () =>
        stubResponse(200, {
          items: [
            liveLikeItem({ result: 'lose' }),
            liveLikeItem({ result: 'tie' }),
            // A regular war with no verdict yet: the allowance is 2.
            liveLikeItem({ result: undefined }),
            // A league season: one attack per member per day, the
            // signature that tells the formats apart (live capture:
            // 30 members, 182 attacks, 559.5 "destruction", no result).
            liveLikeItem({ result: undefined, attacksPerMember: 1, teamSize: 30 }),
            // The live API occasionally reports a verdict on a season
            // all the same; the format wins, or the season's totals
            // would reach the per-war view.
            liveLikeItem({ result: 'tie', attacksPerMember: 1, teamSize: 30 }),
          ],
          age: 0,
        }),
    });
    expect(response.private).toBe(false);
    if (response.private) return;
    expect(response.entries.map((entry) => entry.result)).toEqual([
      'lose',
      'tie',
      'ongoing',
      'league',
      'league',
    ]);
  });

  it('orders the wars newest first and keeps unknown end times last', async () => {
    const response = await fetchWarlog('#CLAN', {
      fetchImpl: async () =>
        stubResponse(200, {
          items: [
            liveLikeItem({ endTime: '20261001T000000.000Z', result: 'win' }),
            liveLikeItem({ endTime: '20261016T091952.000Z', result: 'lose' }),
            liveLikeItem({ endTime: 'not-a-timestamp', result: 'tie' }),
          ],
          age: 0,
        }),
    });
    expect(response.private).toBe(false);
    if (response.private) return;
    const [newest, older, unknown] = response.entries;
    expect(newest.result).toBe('lose');
    expect(older.result).toBe('win');
    expect(unknown.result).toBe('tie');
    expect(unknown.endTimeMs).toBeUndefined();
  });

  it('skips entries our side does not carry a tag on', async () => {
    const response = await fetchWarlog('#CLAN', {
      fetchImpl: async () =>
        stubResponse(200, {
          items: [liveLikeItem(), { result: 'win', clan: { name: 'No Tag' } }, 'not-an-object'],
          age: 0,
        }),
    });
    expect(response.private).toBe(false);
    if (response.private) return;
    expect(response.entries).toHaveLength(1);
  });

  it('resolves the tier private body as a success, never a throw', async () => {
    const response = await fetchWarlog('#PRIVATE', {
      fetchImpl: async () => stubResponse(200, { private: true, age: 3 }),
    });
    expect(response).toEqual({ private: true, age: 3 });
  });

  it('degrades a malformed success body to the empty public page', async () => {
    const response = await fetchWarlog('#CLAN', {
      fetchImpl: async () => stubResponse(200, { items: 'nope' }),
    });
    expect(response).toEqual({ private: false, entries: [], age: 0 });
  });

  it.each([
    [404, { error: 'not_found', tag: '#GONE' }, { kind: 'not_found', tag: '#GONE' }],
    [503, { error: 'upstream_busy', retryAfter: 45 }, { kind: 'busy', retryAfter: 45 }],
    [502, { error: 'upstream_unreachable' }, { kind: 'unreachable' }],
    [400, { error: 'bad_request', detail: 'invalid tag' }, { kind: 'bad_request', detail: 'invalid tag' }],
  ])('maps the contract error %i to %j', async (status, body, expected) => {
    // The fetch rejects by contract; the catch keeps the rejection so
    // the instanceof assertion below proves the class, and the cast is
    // only for reading `.result` off it.
    const error = (await fetchWarlog('#CLAN', {
      fetchImpl: async () => stubResponse(status, body),
    }).catch((caught: unknown) => caught)) as WarlogFetchError;
    expect(error).toBeInstanceOf(WarlogFetchError);
    expect(error.result).toEqual(expected);
  });

  it('requests the encoded tag path exactly once per fetch', async () => {
    const urls: string[] = [];
    await fetchWarlog('#2JPCYP98L', {
      fetchImpl: async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return stubResponse(200, { items: [] });
      },
    });
    expect(urls).toEqual(['/api/clan/%232JPCYP98L/warlog']);
  });

  it('throws bad_request for a non-object 200 body', async () => {
    const attempt = fetchWarlog('#CLAN', {
      fetchImpl: async () => stubResponse(200, 'plain text'),
    });
    await expect(attempt).rejects.toMatchObject({
      name: 'WarlogFetchError',
      result: { kind: 'bad_request' },
    });
  });
});
