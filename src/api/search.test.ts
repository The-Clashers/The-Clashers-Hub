import { describe, expect, it } from 'vitest';
import {
  SEARCH_NAME_MIN_CHARS,
  SEARCH_PAGE_LIMIT,
  applyClientFilters,
  buildSearchQuery,
  fetchSearchPage,
  hasClientFilters,
  parseSearchPayload,
  SearchFetchError,
  type SearchClanItem,
} from './search';

describe('buildSearchQuery', () => {
  it('encodes the name and always sets the page limit', () => {
    expect(buildSearchQuery({ name: 'Umbra Lunaria' })).toBe(
      `name=Umbra+Lunaria&limit=${SEARCH_PAGE_LIMIT}`,
    );
  });

  it('omits filters that are not set', () => {
    const query = buildSearchQuery({ name: 'A' });
    expect(query).toBe(`name=A&limit=${SEARCH_PAGE_LIMIT}`);
    expect(query).not.toContain('minMembers');
    expect(query).not.toContain('minClanLevel');
    expect(query).not.toContain('warFrequency');
    expect(query).not.toContain('locationId');
    expect(query).not.toContain('after');
  });

  it('includes every set server-side filter with the values the tier validates', () => {
    const query = buildSearchQuery({
      name: 'A B',
      minMembers: 20,
      maxMembers: 30,
      minClanLevel: 10,
      minClanPoints: 20000,
      warFrequency: 'oncePerWeek',
      locationId: 32000185,
      labelId: 56000013,
    });
    expect(query).toContain('name=A+B');
    expect(query).toContain('minMembers=20');
    expect(query).toContain('maxMembers=30');
    expect(query).toContain('minClanLevel=10');
    expect(query).toContain('minClanPoints=20000');
    expect(query).toContain('warFrequency=oncePerWeek');
    expect(query).toContain('locationId=32000185');
    expect(query).toContain('labelId=56000013');
    expect(query).toContain(`limit=${SEARCH_PAGE_LIMIT}`);
  });

  it('never sends the client-side filters to the tier', () => {
    const query = buildSearchQuery({
      name: 'A',
      clanType: 'open',
      chatLanguage: 'EN',
      maxRequiredTrophies: 2000,
      maxRequiredTownhall: 14,
    });
    expect(query).toBe(`name=A&limit=${SEARCH_PAGE_LIMIT}`);
    expect(query).not.toContain('clanType');
    expect(query).not.toContain('chatLanguage');
    expect(query).not.toContain('requiredTrophies');
    expect(query).not.toContain('requiredTownhall');
  });

  it('appends the cursor when one is given', () => {
    const query = buildSearchQuery({ name: 'A' }, 'eyJwb3MiOjMwfQ');
    expect(query).toContain('after=eyJwb3MiOjMwfQ');
  });

  it('does not append an empty or null cursor', () => {
    expect(buildSearchQuery({ name: 'A' }, null)).not.toContain('after');
    expect(buildSearchQuery({ name: 'A' }, '')).not.toContain('after');
  });
});

describe('parseSearchPayload', () => {
  const item: Record<string, unknown> = {
    tag: '#2CJPGCLUC',
    name: 'UMBRA',
    clanLevel: 3,
    members: 24,
    warFrequency: 'unknown',
    badgeUrls: { small: 's', medium: 'm', large: 'l' },
  };

  it('parses items, the next-page cursor, and the age', () => {
    const page = parseSearchPayload({
      items: [item, { tag: '#X', name: 'No Frills' }],
      paging: { cursors: { after: 'eyJwb3MiOjMwfQ' } },
      age: 12,
    });
    expect(page.after).toBe('eyJwb3MiOjMwfQ');
    expect(page.age).toBe(12);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toEqual({
      tag: '#2CJPGCLUC',
      name: 'UMBRA',
      clanLevel: 3,
      members: 24,
      locationName: undefined,
      warFrequency: 'unknown',
      badgeUrls: { small: 's', medium: 'm', large: 'l' },
    } satisfies SearchClanItem);
    // A minimal entry degrades to defaults instead of throwing.
    expect(page.items[1].clanLevel).toBe(0);
    expect(page.items[1].members).toBe(0);
  });

  it('reads the location name when the entry carries one', () => {
    const page = parseSearchPayload({
      items: [{ ...item, location: { id: 32000249, name: 'United States' } }],
    });
    expect(page.items[0].locationName).toBe('United States');
  });

  it('reads the filter fields the listing carries', () => {
    const page = parseSearchPayload({
      items: [
        {
          ...item,
          type: 'inviteOnly',
          isFamilyFriendly: true,
          requiredTrophies: 1200,
          requiredTownhallLevel: 14,
          chatLanguage: { id: 75000000, name: 'English', languageCode: 'EN' },
        },
      ],
    });
    const parsed = page.items[0];
    expect(parsed.type).toBe('inviteOnly');
    expect(parsed.isFamilyFriendly).toBe(true);
    expect(parsed.requiredTrophies).toBe(1200);
    expect(parsed.requiredTownhallLevel).toBe(14);
    expect(parsed.chatLanguageCode).toBe('EN');
    expect(parsed.chatLanguageName).toBe('English');
  });

  it('treats an exhausted listing (no cursor) as after: null', () => {
    const page = parseSearchPayload({ items: [], paging: { cursors: {} } });
    expect(page.after).toBeNull();
    expect(page.items).toEqual([]);
  });

  it('defaults age and paging when they are absent', () => {
    const page = parseSearchPayload({ items: [item] });
    expect(page.age).toBe(0);
    expect(page.after).toBeNull();
  });

  it('throws the bad_request branch for a non-listing payload', () => {
    expect(() => parseSearchPayload({ error: 'not_found' })).toThrowError(SearchFetchError);
    try {
      parseSearchPayload('nope');
    } catch (error) {
      expect(error).toBeInstanceOf(SearchFetchError);
      expect((error as SearchFetchError).result.kind).toBe('bad_request');
    }
  });
});

describe('SEARCH_NAME_MIN_CHARS', () => {
  it('matches the game API three-character floor the tier mirrors', () => {
    expect(SEARCH_NAME_MIN_CHARS).toBe(3);
  });
});

describe('applyClientFilters', () => {
  const clans: SearchClanItem[] = [
    { tag: '#A', name: 'A', clanLevel: 1, members: 20, type: 'open', requiredTrophies: 0, chatLanguageCode: 'EN' },
    { tag: '#B', name: 'B', clanLevel: 2, members: 30, type: 'inviteOnly', requiredTrophies: 1500, chatLanguageCode: 'ES', requiredTownhallLevel: 12 },
    { tag: '#C', name: 'C', clanLevel: 3, members: 40 },
  ];

  it('returns the items untouched when no client filter is set', () => {
    expect(applyClientFilters(clans, { name: 'x' })).toHaveLength(3);
    expect(hasClientFilters({ name: 'x', minMembers: 20 })).toBe(false);
  });

  it('filters by clan type', () => {
    const shown = applyClientFilters(clans, { name: 'x', clanType: 'open' });
    expect(shown.map((c) => c.tag)).toEqual(['#A']);
  });

  it('filters by chat language code', () => {
    const shown = applyClientFilters(clans, { name: 'x', chatLanguage: 'ES' });
    expect(shown.map((c) => c.tag)).toEqual(['#B']);
  });

  it('treats an absent join gate as passing every trophy and Town Hall threshold', () => {
    const shown = applyClientFilters(clans, { name: 'x', maxRequiredTrophies: 1000, maxRequiredTownhall: 10 });
    // #A has no gates, #C reports neither field, #B asks 1500/TH12.
    expect(shown.map((c) => c.tag)).toEqual(['#A', '#C']);
  });

  it('selects exactly the gate-less clans at threshold zero (the None option)', () => {
    const shown = applyClientFilters(clans, { name: 'x', maxRequiredTrophies: 0 });
    expect(shown.map((c) => c.tag)).toEqual(['#A', '#C']);
  });

  it('combines client filters and ignores server-side ones', () => {
    const shown = applyClientFilters(clans, {
      name: 'x',
      minMembers: 25, // would drop #A upstream; not applied here
      clanType: 'open',
      chatLanguage: 'EN',
    });
    expect(shown.map((c) => c.tag)).toEqual(['#A']);
  });
});

describe('fetchSearchPage', () => {
  function stubResponse(status: number, body: unknown): Response {
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  const payload = {
    items: [{ tag: '#2CJPGCLUC', name: 'UMBRA', clanLevel: 3, members: 24 }],
    paging: { cursors: { after: 'eyJwb3MiOjMwfQ' } },
    age: 0,
  };

  it('requests the built query and returns the parsed page', async () => {
    let requested = '';
    const fetchImpl = (async (input: RequestInfo | URL) => {
      requested = String(input);
      return stubResponse(200, payload);
    }) as typeof fetch;

    const page = await fetchSearchPage(
      { name: 'A', minMembers: 20 },
      'eyJwb3MiOjMwfQ',
      { fetchImpl },
    );

    expect(requested).toBe(
      `/api/search?name=A&minMembers=20&limit=${SEARCH_PAGE_LIMIT}&after=eyJwb3MiOjMwfQ`,
    );
    expect(page.items[0].name).toBe('UMBRA');
    expect(page.after).toBe('eyJwb3MiOjMwfQ');
  });

  it('maps a 503 with a retryAfter to the busy branch', async () => {
    const fetchImpl = (async () =>
      stubResponse(503, { error: 'upstream_busy', retryAfter: 42 })) as typeof fetch;
    await expect(fetchSearchPage({ name: 'A' }, null, { fetchImpl })).rejects.toThrowError(
      SearchFetchError,
    );
    try {
      await fetchSearchPage({ name: 'A' }, null, { fetchImpl });
    } catch (error) {
      expect((error as SearchFetchError).result).toEqual({ kind: 'busy', retryAfter: 42 });
    }
  });

  it('maps a 502 to the unreachable branch', async () => {
    const fetchImpl = (async () => stubResponse(502, { error: 'upstream_unreachable' })) as typeof fetch;
    try {
      await fetchSearchPage({ name: 'A' }, null, { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as SearchFetchError).result).toEqual({ kind: 'unreachable' });
    }
  });

  it('maps a 400 with its detail to the bad_request branch', async () => {
    const fetchImpl = (async () =>
      stubResponse(400, { error: 'bad_request', detail: 'name is required' })) as typeof fetch;
    try {
      await fetchSearchPage({ name: 'A' }, null, { fetchImpl });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as SearchFetchError).result).toEqual({
        kind: 'bad_request',
        detail: 'name is required',
      });
    }
  });
});
