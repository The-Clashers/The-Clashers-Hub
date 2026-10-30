import { describe, expect, it } from 'vitest';
import { fetchClan, ClanFetchError, type ClanResponse } from './clan';

// Tests for the clan client (T-M1-3). The parser is exercised through
// fetchClan with a stubbed fetch, the same approach the search test takes:
// the tier's response shape is what the screen reads, so the tests lock that
// shape against upstream drift. Every optional field (description, location,
// requiredTownhallLevel, warFrequency, badgeUrls) has a test for both
// present and absent, so a payload change upstream degrades to defaults
// rather than breaking the build.

describe('fetchClan', () => {
  function stubResponse(status: number, body: unknown): Response {
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  const fullPayload = {
    tag: '#2JPCYP98L',
    name: 'Umbra Lunaria',
    description: 'A clan of shadows and moonlight.',
    clanLevel: 11,
    members: 7,
    memberList: [
      {
        tag: '#YPCC8QYU2',
        name: 'Yeon',
        role: 'coLeader',
        expLevel: 189,
        townHallLevel: 15,
        trophies: 5312,
        donations: 1043,
        donationsReceived: 872,
        clanRank: 2,
        // The 2025 ladder rework: the ranked tier (themed league name plus
        // rank number) rides in leagueTier; the legacy league object still
        // arrives but the roster does not read it.
        league: {
          id: 29000022,
          name: 'Legend League',
          iconUrls: { small: 'legacy-s.png', medium: 'legacy-m.png', large: 'legacy-l.png' },
        },
        leagueTier: {
          id: 105000031,
          name: 'Electro League 31',
          iconUrls: { small: 'tier-s.png', large: 'tier-l.png' },
        },
      },
    ],
    badgeUrls: { small: 's.png', medium: 'm.png', large: 'l.png' },
    location: { id: 32000006, name: 'International', isCountry: false },
    requiredTrophies: 5000,
    requiredTownhallLevel: 14,
    warFrequency: 'always',
    warWinStreak: 10,
    warWins: 31,
    clanPoints: 5800,
    isWarLogPublic: true,
    age: 12,
  };

  it('requests the encoded tag and parses the identity block, requirements, stat fields, and age', async () => {
    let requested = '';
    const fetchImpl = (async (input: RequestInfo | URL) => {
      requested = String(input);
      return stubResponse(200, fullPayload);
    }) as typeof fetch;

    const clan = await fetchClan('#2JPCYP98L', { fetchImpl });

    // The tier request path encodes the # so the server route sees one
    // segment, not a fragment. This encoding lives on the tier request only:
    // the shareable browser URL carries the bare tag (lib/tag.ts).
    expect(requested).toBe('/api/clan/%232JPCYP98L');

    expect(clan).toEqual({
      tag: '#2JPCYP98L',
      name: 'Umbra Lunaria',
      description: 'A clan of shadows and moonlight.',
      clanLevel: 11,
      members: 7,
      memberList: [
        {
          tag: '#YPCC8QYU2',
          name: 'Yeon',
          role: 'coLeader',
          expLevel: 189,
          townHallLevel: 15,
          trophies: 5312,
          donations: 1043,
          donationsReceived: 872,
          clanRank: 2,
          // The ranked tier is what the roster reads; the legacy league
          // object is not part of the parsed shape at all.
          leagueTier: {
            name: 'Electro League 31',
            iconUrls: { small: 'tier-s.png', large: 'tier-l.png' },
          },
        },
      ],
      badgeUrls: { small: 's.png', medium: 'm.png', large: 'l.png' },
      location: { id: 32000006, name: 'International', isCountry: false },
      requirements: {
        requiredTrophies: 5000,
        requiredTownhallLevel: 14,
        warFrequency: 'always',
      },
      warWinStreak: 10,
      warWins: 31,
      clanPoints: 5800,
      isWarLogPublic: true,
      age: 12,
    } satisfies ClanResponse);
  });

  it('defaults optional fields when the payload omits them', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#ABC',
        name: 'No Frills',
        clanLevel: 1,
        members: 1,
        requiredTrophies: 0,
        warWinStreak: 0,
        warWins: 0,
        clanPoints: 0,
        age: 0,
      })) as typeof fetch;

    const clan = await fetchClan('#ABC', { fetchImpl });

    expect(clan.description).toBeUndefined();
    expect(clan.memberList).toBeUndefined();
    expect(clan.badgeUrls).toBeUndefined();
    expect(clan.location).toBeUndefined();
    expect(clan.requirements).toEqual({
      requiredTrophies: 0,
      requiredTownhallLevel: undefined,
      warFrequency: undefined,
    });
    expect(clan.warWinStreak).toBe(0);
    expect(clan.warWins).toBe(0);
    expect(clan.clanPoints).toBe(0);
    // The war log status defaults to private when the payload omits it,
    // the safer read for a clan we know nothing about.
    expect(clan.isWarLogPublic).toBe(false);
  });

  it('degrades member rows whose optional fields are missing', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Sparse',
        clanLevel: 1,
        members: 1,
        requiredTrophies: 0,
        age: 0,
        memberList: [{ tag: '#ONLYTAG' }],
      })) as typeof fetch;

    const clan = await fetchClan('#X', { fetchImpl });

    expect(clan.memberList).toEqual([
      {
        tag: '#ONLYTAG',
        name: '',
        role: 'member',
        expLevel: 0,
        townHallLevel: 0,
        trophies: 0,
        donations: 0,
        donationsReceived: 0,
        leagueTier: undefined,
      },
    ]);
  });

  it('drops member rows that cannot be linked (no tag, or not objects)', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Junky',
        clanLevel: 1,
        members: 3,
        requiredTrophies: 0,
        age: 0,
        memberList: [{ name: 'NoTag' }, 'a string', null, { tag: '#REAL', name: 'Real' }],
      })) as typeof fetch;

    const clan = await fetchClan('#X', { fetchImpl });

    expect(clan.memberList?.map((member) => member.tag)).toEqual(['#REAL']);
  });

  it('parses tier shapes: empty or missing to undefined, named tiers as-is', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Mixed tiers',
        clanLevel: 1,
        members: 4,
        requiredTrophies: 0,
        age: 0,
        memberList: [
          { tag: '#U1', leagueTier: {} },
          { tag: '#U2', leagueTier: null },
          { tag: '#U3', leagueTier: { name: 'Witch League 18' } },
          // The real Unranked tier carries a name and its own icon; it
          // renders like any other tier, not as the quiet fallback.
          {
            tag: '#U4',
            leagueTier: { name: 'Unranked', iconUrls: { small: 'u-s.png', large: 'u-l.png' } },
          },
        ],
      })) as typeof fetch;

    const clan = await fetchClan('#X', { fetchImpl });

    expect(clan.memberList?.map((member) => member.leagueTier)).toEqual([
      undefined,
      undefined,
      { name: 'Witch League 18', iconUrls: undefined },
      { name: 'Unranked', iconUrls: { small: 'u-s.png', large: 'u-l.png' } },
    ]);
  });

  it('keeps an empty memberList as an empty array, not undefined', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'Empty',
        clanLevel: 1,
        members: 0,
        requiredTrophies: 0,
        age: 0,
        memberList: [],
      })) as typeof fetch;

    const clan = await fetchClan('#X', { fetchImpl });

    expect(clan.memberList).toEqual([]);
  });

  it('keeps requiredTrophies and warFrequency readable when only those are set', async () => {
    const fetchImpl = (async () =>
      stubResponse(200, {
        tag: '#X',
        name: 'No TH gate',
        clanLevel: 2,
        members: 5,
        requiredTrophies: 1000,
        warFrequency: 'oncePerWeek',
        age: 3,
      })) as typeof fetch;

    const clan = await fetchClan('#X', { fetchImpl });
    expect(clan.requirements.requiredTrophies).toBe(1000);
    expect(clan.requirements.requiredTownhallLevel).toBeUndefined();
    expect(clan.requirements.warFrequency).toBe('oncePerWeek');
  });

  it('maps a 404 with the tag to the not_found branch', async () => {
    const fetchImpl = (async () => stubResponse(404, { error: 'not_found' })) as typeof fetch;
    await expect(fetchClan('#NOPE', { fetchImpl })).rejects.toThrowError(ClanFetchError);
    try {
      await fetchClan('#NOPE', { fetchImpl });
    } catch (error) {
      expect((error as ClanFetchError).result).toEqual({ kind: 'not_found', tag: '' });
    }
  });

  it('maps a 503 with a retryAfter to the busy branch, defaulting to 30s', async () => {
    const fetchImpl = (async () =>
      stubResponse(503, { error: 'upstream_busy', retryAfter: 42 })) as typeof fetch;
    try {
      await fetchClan('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ClanFetchError).result).toEqual({ kind: 'busy', retryAfter: 42 });
    }
  });

  it('defaults retryAfter to 30 when the 503 body omits it', async () => {
    const fetchImpl = (async () => stubResponse(503, { error: 'upstream_busy' })) as typeof fetch;
    try {
      await fetchClan('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ClanFetchError).result).toEqual({ kind: 'busy', retryAfter: 30 });
    }
  });

  it('maps a 502 to the unreachable branch', async () => {
    const fetchImpl = (async () => stubResponse(502, { error: 'upstream_unreachable' })) as typeof fetch;
    try {
      await fetchClan('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ClanFetchError).result).toEqual({ kind: 'unreachable' });
    }
  });

  it('maps a 400 with its detail to the bad_request branch', async () => {
    const fetchImpl = (async () =>
      stubResponse(400, { error: 'bad_request', detail: 'tag is malformed' })) as typeof fetch;
    try {
      await fetchClan('#!', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ClanFetchError).result).toEqual({
        kind: 'bad_request',
        detail: 'tag is malformed',
      });
    }
  });

  it('throws bad_request when the 200 body is not a JSON object', async () => {
    const fetchImpl = (async () => stubResponse(200, ['not', 'an', 'object'])) as typeof fetch;
    try {
      await fetchClan('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ClanFetchError).result.kind).toBe('bad_request');
    }
  });

  it('survives a body that is not JSON at all', async () => {
    const fetchImpl = (async () => ({
      status: 200,
      ok: true,
      text: async () => 'not json',
    } as unknown as Response)) as typeof fetch;
    try {
      await fetchClan('#X', { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      // Non-JSON parses to null, which is not a record, so the parser
      // throws the bad_request branch rather than crashing the screen.
      expect((error as ClanFetchError).result.kind).toBe('bad_request');
    }
  });
});
