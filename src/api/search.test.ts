import { describe, expect, it } from 'vitest';
import {
  SEARCH_PAGE_LIMIT,
  buildSearchQuery,
  fetchSearchPage,
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

  it('includes every set filter with the values the tier validates', () => {
    const query = buildSearchQuery({
      name: 'A B',
      minMembers: 20,
      minClanLevel: 10,
      warFrequency: 'oncePerWeek',
      locationId: 32000185,
    });
    expect(query).toContain('name=A+B');
    expect(query).toContain('minMembers=20');
    expect(query).toContain('minClanLevel=10');
    expect(query).toContain('warFrequency=oncePerWeek');
    expect(query).toContain('locationId=32000185');
    expect(query).toContain(`limit=${SEARCH_PAGE_LIMIT}`);
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
