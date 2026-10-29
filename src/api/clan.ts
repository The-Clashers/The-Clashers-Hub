// Typed client for our own GET /api/clan/:tag route.
//
// The serverless tier (server/routes.ts) is a dumb cached proxy: it forwards
// the game API's clan payload, injects an `age` field, and maps upstream
// failures to the JSON error contract (docs/concept/04-api-strategy
// section 6). This module is the browser-side counterpart: it owns the fetch,
// parses the JSON into a typed shape that covers only the fields the screens
// actually read, and turns the contract's error bodies into a discriminated
// union so the screen can branch on `kind` instead of re-checking strings.
//
// The full game API payload has 20+ fields; we model only the ones the hello
// screen and the M1 clan detail screen (F-04 / SR-10) read: the identity
// block (badge, name, tag, level, description, location, requirements) and
// the stat chips (members, win streak, war wins, points). A field the app
// does not read stays untyped on purpose so a payload change upstream never
// breaks the build, only the screen that needs the new field. The roster
// (memberList) is opaque here on purpose: T-M1-4 owns the roster table and
// its own typed shape, this client only carries the array reference
// through so the roster tab can read it from the same single fetch (SR-09).

/** Clan tag in canonical form: leading #, uppercase, matches server/tags.ts. */
export type ClanTag = string;

/** The badge URLs the game API hands back; `medium` is the size we render. */
export interface ClanBadgeUrls {
  small: string;
  medium: string;
  large: string;
}

/** The location object the game API nests under `location`. The id is the
 * same one the search filter row uses (src/api/locations.ts); the name is
 * what the identity header renders. */
export interface ClanLocation {
  id: number;
  name: string;
  /** True when the location is a country; false for the International region. */
  isCountry: boolean;
}

/** The join requirements the clan sets. The game API surfaces these on the
 * clan payload directly; the identity header renders them as a small chips
 * row (T-M1-3, F-04). All three are optional in practice: a brand-new clan
 * can have requiredTrophies = 0 and no requiredTownhallLevel. */
export interface ClanRequirements {
  requiredTrophies: number;
  /** Minimum Town Hall level to join. Not every clan sets one; undefined
   * when the API omits it. */
  requiredTownhallLevel?: number;
  /** Raw upstream war-frequency string; the screen maps it to a label
   * through lib/war-frequency.ts so the search filter and the identity
   * header read from the same table. */
  warFrequency?: string;
}

/** Shape of a successful /api/clan/:tag response, stripped to what we read. */
export interface ClanResponse {
  tag: string;
  name: string;
  description?: string;
  clanLevel: number;
  members: number;
  /** The roster the Roster tab renders. Opaque here: T-M1-4 owns the typed
   * member row. Carried through so the roster reads from this one fetch
   * (SR-09: the clan response includes the complete member list). */
  memberList?: unknown[];
  badgeUrls?: ClanBadgeUrls;
  location?: ClanLocation;
  requirements: ClanRequirements;
  /** Active war win streak; 0 is a real value (no streak), never undefined. */
  warWinStreak: number;
  /** Lifetime war wins. */
  warWins: number;
  /** Total clan trophies (clanPoints in the game API). */
  clanPoints: number;
  /** Seconds since the upstream fetch; injected by the tier on every 200. */
  age: number;
}

/** Discriminated union for every outcome the contract can hand the client. */
export type ClanQueryResult =
  | { kind: 'ok'; clan: ClanResponse }
  | { kind: 'not_found'; tag: string }
  | { kind: 'busy'; retryAfter: number }
  | { kind: 'unreachable' }
  | { kind: 'bad_request'; detail: string };

/** Thrown for every non-ok response so TanStack Query sees a single failure
 * path. The discriminated `result` is what the screen branches on. */
export class ClanFetchError extends Error {
  readonly result: Exclude<ClanQueryResult, { kind: 'ok' }>;
  constructor(result: Exclude<ClanQueryResult, { kind: 'ok' }>) {
    super(`clan fetch failed: ${result.kind}`);
    this.name = 'ClanFetchError';
    this.result = result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toClanLocation(parsed: unknown): ClanLocation | undefined {
  if (!isRecord(parsed)) return undefined;
  const id = typeof parsed.id === 'number' ? parsed.id : 0;
  const name = typeof parsed.name === 'string' ? parsed.name : '';
  if (id === 0 && name === '') return undefined;
  return {
    id,
    name,
    isCountry: typeof parsed.isCountry === 'boolean' ? parsed.isCountry : false,
  };
}

function toClanRequirements(parsed: unknown): ClanRequirements {
  // parsed is the clan object itself: requiredTrophies and warFrequency live
  // at the top level, alongside requiredTownhallLevel when the clan sets one.
  const source = isRecord(parsed) ? parsed : {};
  return {
    requiredTrophies: typeof source.requiredTrophies === 'number' ? source.requiredTrophies : 0,
    requiredTownhallLevel:
      typeof source.requiredTownhallLevel === 'number' ? source.requiredTownhallLevel : undefined,
    warFrequency: typeof source.warFrequency === 'string' ? source.warFrequency : undefined,
  };
}

function toClanResponse(parsed: unknown): ClanResponse {
  if (!isRecord(parsed)) {
    throw new ClanFetchError({ kind: 'bad_request', detail: 'response was not a JSON object' });
  }
  const tag = typeof parsed.tag === 'string' ? parsed.tag : '';
  const name = typeof parsed.name === 'string' ? parsed.name : '';
  const clanLevel = typeof parsed.clanLevel === 'number' ? parsed.clanLevel : 0;
  const members = typeof parsed.members === 'number' ? parsed.members : 0;
  const memberList = Array.isArray(parsed.memberList) ? parsed.memberList : undefined;
  const description = typeof parsed.description === 'string' ? parsed.description : undefined;
  const age = typeof parsed.age === 'number' ? parsed.age : 0;
  const badgeUrls = isRecord(parsed.badgeUrls)
    ? {
        small: String(parsed.badgeUrls.small ?? ''),
        medium: String(parsed.badgeUrls.medium ?? ''),
        large: String(parsed.badgeUrls.large ?? ''),
      }
    : undefined;
  const location = toClanLocation(parsed.location);
  const requirements = toClanRequirements(parsed);
  const warWinStreak = typeof parsed.warWinStreak === 'number' ? parsed.warWinStreak : 0;
  const warWins = typeof parsed.warWins === 'number' ? parsed.warWins : 0;
  const clanPoints = typeof parsed.clanPoints === 'number' ? parsed.clanPoints : 0;
  return {
    tag,
    name,
    description,
    clanLevel,
    members,
    memberList,
    badgeUrls,
    location,
    requirements,
    warWinStreak,
    warWins,
    clanPoints,
    age,
  };
}

function classifyError(status: number, body: unknown): ClanFetchError {
  if (status === 404) {
    const tag = isRecord(body) && typeof body.tag === 'string' ? body.tag : '';
    return new ClanFetchError({ kind: 'not_found', tag });
  }
  if (status === 503) {
    const retryAfter = isRecord(body) && typeof body.retryAfter === 'number' ? body.retryAfter : 30;
    return new ClanFetchError({ kind: 'busy', retryAfter });
  }
  if (status === 502) {
    return new ClanFetchError({ kind: 'unreachable' });
  }
  const detail = isRecord(body) && typeof body.detail === 'string' ? body.detail : `status ${status}`;
  return new ClanFetchError({ kind: 'bad_request', detail });
}

/**
 * Fetches a clan by tag from the same-origin tier and returns the parsed
 * response or throws {@link ClanFetchError} for any non-200 outcome.
 *
 * The tag is taken in canonical form (leading #, uppercase); the tier
 * normalizes again cheaply so a stray lowercase still resolves, but the
 * canonical form is what we display and what we put in the URL.
 */
export async function fetchClan(
  tag: ClanTag,
  init: { fetchImpl?: typeof fetch } = {},
): Promise<ClanResponse> {
  const doFetch = init.fetchImpl ?? fetch;
  const encoded = encodeURIComponent(tag);
  const response = await doFetch(`/api/clan/${encoded}`, {
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
  return toClanResponse(parsed);
}
