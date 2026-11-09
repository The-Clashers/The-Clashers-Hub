// Typed client for our own GET /api/search route.
//
// Follows the same shape as clan.ts (the browser-side counterpart of the
// tier): own the fetch, parse the JSON into a typed shape covering only the
// fields the result cards read, and turn the contract's error bodies into a
// discriminated union so the screen branches on `kind`. One extra concern is
// unique to search: the listing is cursor-paginated, so a successful fetch
// returns a page (items + the cursor for the next page) rather than a single
// object.

import { leagueTierNumber } from './league-tiers';

/** The five war frequency values the game API (and the tier) accept. */
export type WarFrequency =
  | 'always'
  | 'moreThanOncePerWeek'
  | 'oncePerWeek'
  | 'lessThanOncePerWeek'
  | 'never';

/** The clan membership states the game API reports on search items. */
export type ClanType = 'open' | 'inviteOnly' | 'closed';

/** Search filters, all optional except the name. Undefined means "any".
 *
 * Two kinds live here, deliberately in one shape so the screen's draft and
 * the query key stay a single object:
 * - Server-side filters (min/max members, clan level, war frequency,
 *   location, label) ride the tier request: upstream filters the whole
 *   listing, so pagination and the counts stay exact.
 * - Client-side filters (type, chat language, league and Town Hall join
 *   requirements) have no upstream param, so the tier never sees them;
 *   applyClientFilters narrows the loaded pages and the screen keeps
 *   pagination honest with a "N shown of M loaded" line. */
export interface SearchFilters {
  name: string;
  minMembers?: number;
  maxMembers?: number;
  minClanLevel?: number;
  warFrequency?: WarFrequency;
  locationId?: number;
  labelId?: number;
  clanType?: ClanType;
  chatLanguage?: string;
  maxRequiredLeagueTier?: number;
  maxRequiredTownhall?: number;
}

/** The minimum clan-name length the game API accepts (it rejects shorter
 * names with a 400 badName); the tier mirrors the floor. Both name-input
 * surfaces (the clans screen's bar and the nav lookup box) teach the same
 * sentence before any request is made. */
export const SEARCH_NAME_MIN_CHARS = 3;
export const SEARCH_NAME_MIN_COPY = 'Clan names need at least three characters.';

/** One result card, stripped to the fields the card renders. */
export interface SearchClanItem {
  tag: string;
  name: string;
  clanLevel: number;
  members: number;
  /** Present on roughly two thirds of the listings; absent when the clan
   * never set one, so the card falls back to a muted "No location". */
  locationName?: string;
  /** Raw upstream value; the screen maps it to a short label. */
  warFrequency?: string;
  /** Membership state; the client-side type filter matches it directly. */
  type?: string;
  /** The parental-control flag; the card renders it as a tag, not a stat. */
  isFamilyFriendly?: boolean;
  /** Join gates for the requirement filters ("clans I can actually join").
   * The 2025 rank rework replaced the old trophy threshold with a league
   * requirement: `requiredLeagueTier` carries the ranked ladder tier a clan
   * asks for ("Wizard League 10"), absent when the clan sets none. The
   * Town Hall gate is unchanged. An absent gate passes every cap. */
  requiredLeagueTier?: RequiredLeagueTier;
  requiredTownhallLevel?: number;
  /** The clan's chat language, when it reports one; the language filter
   * matches on the code ("EN"), the card could show the name. */
  chatLanguageCode?: string;
  chatLanguageName?: string;
  badgeUrls?: ClanBadgeUrls;
}

/** A ranked ladder tier as the game API reports it on join requirements. */
export interface RequiredLeagueTier {
  id: number;
  name: string;
}

export interface ClanBadgeUrls {
  small: string;
  medium: string;
  large: string;
}

/** One page of results plus everything pagination needs. */
export interface SearchPage {
  items: SearchClanItem[];
  /** Cursor for the next page, null when the listing is exhausted. */
  after: string | null;
  /** Seconds since the tier fetched this page from upstream. */
  age: number;
}

/** Discriminated union for every outcome the contract can hand the client.
 * Search has no not_found state (a search that matches nothing is a 200 with
 * an empty items array), so the union is one branch shorter than clan's. */
export type SearchQueryResult =
  | { kind: 'busy'; retryAfter: number }
  | { kind: 'unreachable' }
  | { kind: 'bad_request'; detail: string };

/** Thrown for every non-ok response so TanStack Query sees a single failure
 * path. The discriminated `result` is what the screen branches on. */
export class SearchFetchError extends Error {
  readonly result: SearchQueryResult;
  constructor(result: SearchQueryResult) {
    super(`search fetch failed: ${result.kind}`);
    this.name = 'SearchFetchError';
    this.result = result;
  }
}

/** Page size for every search request. Small enough that a cold fetch stays
 * well inside the 5 s acceptance budget (AC-01), large enough that a first
 * screenful of cards renders without a second round trip. */
export const SEARCH_PAGE_LIMIT = 30;

/**
 * Builds the query string for a search request. Pure and unit-tested: the
 * screen and the infinite query both go through it, so the request shape
 * (which filters appear, where the cursor goes) is decided in exactly one
 * place. Server-side filters that are undefined are omitted, never sent as
 * empty; the client-side filters never appear here at all — the tier has no
 * corresponding upstream params, so they ride the query key only and
 * applyClientFilters does the narrowing.
 */
export function buildSearchQuery(filters: SearchFilters, after?: string | null): string {
  const params = new URLSearchParams();
  params.set('name', filters.name.trim());
  if (filters.minMembers !== undefined) params.set('minMembers', String(filters.minMembers));
  if (filters.maxMembers !== undefined) params.set('maxMembers', String(filters.maxMembers));
  if (filters.minClanLevel !== undefined) params.set('minClanLevel', String(filters.minClanLevel));
  if (filters.warFrequency !== undefined) params.set('warFrequency', filters.warFrequency);
  if (filters.locationId !== undefined) params.set('locationId', String(filters.locationId));
  if (filters.labelId !== undefined) params.set('labelId', String(filters.labelId));
  params.set('limit', String(SEARCH_PAGE_LIMIT));
  if (after) params.set('after', after);
  return params.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toSearchClanItem(parsed: unknown): SearchClanItem {
  // Tolerant per item, like toClanResponse: a malformed entry degrades to
  // defaults rather than failing the whole page.
  if (!isRecord(parsed)) {
    return { tag: '', name: '', clanLevel: 0, members: 0 };
  }
  const badgeUrls = isRecord(parsed.badgeUrls)
    ? {
        small: String(parsed.badgeUrls.small ?? ''),
        medium: String(parsed.badgeUrls.medium ?? ''),
        large: String(parsed.badgeUrls.large ?? ''),
      }
    : undefined;
  const location = isRecord(parsed.location) && typeof parsed.location.name === 'string'
    ? parsed.location.name
    : undefined;
  const chatLanguage = isRecord(parsed.chatLanguage) ? parsed.chatLanguage : undefined;
  const requiredLeagueTier = isRecord(parsed.requiredLeagueTier)
    ? {
        id: typeof parsed.requiredLeagueTier.id === 'number' ? parsed.requiredLeagueTier.id : 0,
        name:
          typeof parsed.requiredLeagueTier.name === 'string' ? parsed.requiredLeagueTier.name : '',
      }
    : undefined;
  return {
    tag: typeof parsed.tag === 'string' ? parsed.tag : '',
    name: typeof parsed.name === 'string' ? parsed.name : '',
    clanLevel: typeof parsed.clanLevel === 'number' ? parsed.clanLevel : 0,
    members: typeof parsed.members === 'number' ? parsed.members : 0,
    locationName: location,
    warFrequency: typeof parsed.warFrequency === 'string' ? parsed.warFrequency : undefined,
    type: typeof parsed.type === 'string' ? parsed.type : undefined,
    isFamilyFriendly: typeof parsed.isFamilyFriendly === 'boolean' ? parsed.isFamilyFriendly : undefined,
    requiredLeagueTier,
    requiredTownhallLevel:
      typeof parsed.requiredTownhallLevel === 'number' ? parsed.requiredTownhallLevel : undefined,
    chatLanguageCode:
      typeof chatLanguage?.languageCode === 'string' ? chatLanguage.languageCode : undefined,
    chatLanguageName: typeof chatLanguage?.name === 'string' ? chatLanguage.name : undefined,
    badgeUrls,
  };
}

/**
 * Parses a successful search payload into a page. Exported for tests. Throws
 * {@link SearchFetchError} (bad_request) when the payload is not a search
 * listing at all, which only happens if the tier changes shape.
 */
export function parseSearchPayload(parsed: unknown): SearchPage {
  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    throw new SearchFetchError({ kind: 'bad_request', detail: 'response was not a search payload' });
  }
  const paging = isRecord(parsed.paging) ? parsed.paging : {};
  const cursors = isRecord(paging.cursors) ? paging.cursors : {};
  const after =
    typeof cursors.after === 'string' && cursors.after.length > 0 ? cursors.after : null;
  const age = typeof parsed.age === 'number' ? parsed.age : 0;
  return {
    items: parsed.items.map(toSearchClanItem),
    after,
    age,
  };
}

/** True when any client-side filter is in force (the ones with no upstream
 * param). The screen uses it to switch the meta line to "N shown of M
 * loaded" and to keep pagination alive through an emptied view. */
export function hasClientFilters(filters: SearchFilters): boolean {
  return (
    filters.clanType !== undefined ||
    filters.chatLanguage !== undefined ||
    filters.maxRequiredLeagueTier !== undefined ||
    filters.maxRequiredTownhall !== undefined
  );
}

/**
 * Narrows loaded search pages by the client-side filters. Pure and
 * unit-tested: the screen memoizes it over the accumulated pages and the
 * submitted filters. A clan that reports no join gate passes every
 * requirement threshold — "no requirement" is the easiest clan to join, so
 * it is always an honest match; a threshold of 0 (the "None" option) then
 * selects exactly those gate-less clans. The league cap reads the ladder
 * position off the tier id (never the name); an id outside the known ladder
 * is a requirement we cannot rank, so it is not provably at-or-below any
 * cap and drops out while a cap is in force.
 */
export function applyClientFilters(
  items: ReadonlyArray<SearchClanItem>,
  filters: SearchFilters,
): SearchClanItem[] {
  if (!hasClientFilters(filters)) return [...items];
  return items.filter((item) => {
    if (filters.clanType !== undefined && item.type !== filters.clanType) return false;
    if (filters.chatLanguage !== undefined && item.chatLanguageCode !== filters.chatLanguage) {
      return false;
    }
    if (filters.maxRequiredLeagueTier !== undefined) {
      const tier =
        item.requiredLeagueTier === undefined ? 0 : leagueTierNumber(item.requiredLeagueTier.id);
      if (tier === null || tier > filters.maxRequiredLeagueTier) return false;
    }
    if (
      filters.maxRequiredTownhall !== undefined &&
      (item.requiredTownhallLevel ?? 0) > filters.maxRequiredTownhall
    ) {
      return false;
    }
    return true;
  });
}

function classifyError(status: number, body: unknown): SearchFetchError {
  if (status === 503) {
    const retryAfter = isRecord(body) && typeof body.retryAfter === 'number' ? body.retryAfter : 30;
    return new SearchFetchError({ kind: 'busy', retryAfter });
  }
  if (status === 502) {
    return new SearchFetchError({ kind: 'unreachable' });
  }
  const detail = isRecord(body) && typeof body.detail === 'string' ? body.detail : `status ${status}`;
  return new SearchFetchError({ kind: 'bad_request', detail });
}

/**
 * Fetches one page of search results from the same-origin tier. `after` is
 * the cursor from the previous page (null for the first). Returns the parsed
 * page or throws {@link SearchFetchError} for any non-200 outcome.
 */
export async function fetchSearchPage(
  filters: SearchFilters,
  after?: string | null,
  init: { fetchImpl?: typeof fetch } = {},
): Promise<SearchPage> {
  const doFetch = init.fetchImpl ?? fetch;
  const query = buildSearchQuery(filters, after);
  const response = await doFetch(`/api/search?${query}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    throw classifyError(response.status, parsed);
  }
  return parseSearchPayload(parsed);
}
