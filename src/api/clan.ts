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
// rows (memberList) are typed here as ClanMember since T-M1-4: the roster
// tab reads them from this same single fetch (SR-09), so the member shape
// is part of this client's contract, parsed with the same tolerance for
// missing optional fields the rest of the response gets.

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

/** The icon URLs the game API nests inside a league tier. Tier icons come in
 * two sizes (`small` 125 px, `large` 326 px); the roster renders `small` in
 * its 24 px slot. */
export interface LeagueTierIconUrls {
  small: string;
  large: string;
}

/** The ranked-ladder tier the game API nests inside each member row as
 * `leagueTier`. The 2025 ladder rework replaced the old trophy leagues
 * (Bronze..Legend, the legacy `league` object the API still returns for
 * compatibility) with a themed league set plus a rank number baked into the
 * name ("Electro League 31", "Witch League 18"), which is what the game
 * shows and what the roster's League column reads. Unranked members carry
 * the "Unranked" tier; a missing or empty object parses to undefined so the
 * roster renders its own "Unranked" quiet value. */
export interface ClanMemberLeagueTier {
  name: string;
  iconUrls?: LeagueTierIconUrls;
}

/** One roster row (T-M1-4, FR-04). Only the fields the roster table reads:
 * identity (tag, name), the sortable columns (role, Town Hall, trophies,
 * donations, received, XP), and the league display column. The raw role
 * string is kept as-is; lib/clan-role.ts owns its label and sort rank. */
export interface ClanMember {
  tag: string;
  name: string;
  /** Raw API role string ("leader" | "coLeader" | "admin" | "member"). */
  role: string;
  /** XP level, the sortable XP column. */
  expLevel: number;
  townHallLevel: number;
  trophies: number;
  donations: number;
  donationsReceived: number;
  /** Position inside the clan, the API's own roster ordering; the sort's
   * primary tiebreak. Optional: a degraded payload may omit it. */
  clanRank?: number;
  /** The ranked-ladder tier (new league set + rank). Undefined when the
   * member carries no tier at all. The legacy `league` object is not read. */
  leagueTier?: ClanMemberLeagueTier;
}

/** Shape of a successful /api/clan/:tag response, stripped to what we read. */
export interface ClanResponse {
  tag: string;
  name: string;
  description?: string;
  clanLevel: number;
  members: number;
  /** The roster the Roster tab renders (SR-09: the clan response includes
   * the complete member list, one fetch, no per-member requests). */
  memberList?: ClanMember[];
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

function toClanMemberLeagueTier(parsed: unknown): ClanMemberLeagueTier | undefined {
  if (!isRecord(parsed)) return undefined;
  const name = typeof parsed.name === 'string' ? parsed.name : '';
  // A member without a tier (or with an empty object) has nothing to
  // display, so the row renders its quiet "Unranked" value instead. The
  // real Unranked tier arrives with a name and its own icon and renders
  // like any other tier.
  if (name === '') return undefined;
  const iconUrls = isRecord(parsed.iconUrls)
    ? {
        small: String(parsed.iconUrls.small ?? ''),
        large: String(parsed.iconUrls.large ?? ''),
      }
    : undefined;
  return { name, iconUrls };
}

function toClanMember(parsed: unknown): ClanMember | null {
  if (!isRecord(parsed)) return null;
  const tag = typeof parsed.tag === 'string' ? parsed.tag : '';
  // A member row without a tag cannot be linked, keyed, or tie-broken, so
  // it is dropped rather than rendered as a blank unusable row. Everything
  // else degrades to defaults, the same tolerance the clan fields get.
  if (tag === '') return null;
  const leagueTier = toClanMemberLeagueTier(parsed.leagueTier);
  return {
    tag,
    name: typeof parsed.name === 'string' ? parsed.name : '',
    role: typeof parsed.role === 'string' ? parsed.role : 'member',
    expLevel: typeof parsed.expLevel === 'number' ? parsed.expLevel : 0,
    townHallLevel: typeof parsed.townHallLevel === 'number' ? parsed.townHallLevel : 0,
    trophies: typeof parsed.trophies === 'number' ? parsed.trophies : 0,
    donations: typeof parsed.donations === 'number' ? parsed.donations : 0,
    donationsReceived: typeof parsed.donationsReceived === 'number' ? parsed.donationsReceived : 0,
    clanRank: typeof parsed.clanRank === 'number' ? parsed.clanRank : undefined,
    leagueTier,
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
  const memberList = Array.isArray(parsed.memberList)
    ? parsed.memberList
        .map(toClanMember)
        .filter((entry): entry is ClanMember => entry !== null)
    : undefined;
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
 * normalizes again cheaply so a stray lowercase still resolves. The
 * canonical form is what we display and what goes into the tier request
 * path (`%23`-encoded there); the shareable browser URL carries the bare
 * tag and is built by lib/tag.ts, not here.
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
