// Typed client for our own GET /api/player/:tag route.
//
// The serverless tier (server/routes.ts) is a dumb cached proxy: it forwards
// the game API's player payload, injects an `age` field, and maps upstream
// failures to the JSON error contract (docs/concept/04-api-strategy
// section 6). This module is the browser-side counterpart, the same shape
// src/api/clan.ts gives the clan route: it owns the fetch, parses the JSON
// into a typed shape covering only the fields the screens actually read, and
// turns the contract's error bodies into a discriminated union so the screen
// branches on `kind` instead of re-checking strings.
//
// The full game API player payload is the biggest one in the product (unit
// arrays, heroes, spells, achievements, builder-base stats). The M2 shell
// (T-M2-1, FR-06) reads only the identity block: name, tag, Town Hall, the
// league display, XP, the clan block, and the role. The analysis cards that
// follow (rushed engine, heroes, achievements, progression grid) will grow
// this module rather than replace it, the same promise the war client makes.

/** Player tag in canonical form: leading #, uppercase, matches server/tags.ts. */
export type PlayerTag = string;

/** The icon URLs the game API nests inside a league or league tier. Only the
 * `small` size is read: the header renders it in the 24 px slot (07
 * section 7), so the larger sizes stay untyped on purpose. */
export interface LeagueIconUrls {
  small: string;
}

/** The ranked-ladder tier the game API returns as `leagueTier`: a themed
 * league name with the rank baked into it ("Electro League 31"), the same
 * field the roster's rank column reads. The header shows the tier's icon
 * with its full name. An "Unranked" tier is a real tier with its own name
 * and icon, not a missing value, so it parses like any other tier. */
export interface PlayerLeagueTier {
  name: string;
  iconUrls?: LeagueIconUrls;
}

/** The classic trophy league the game API returns as `league` (the legacy
 * object it still sends alongside the new ladder, e.g. Legend League for a
 * player who qualified). The header reads it as the fallback display when
 * the ranked tier is absent; the tier stays the primary reading so the
 * player header and the roster never disagree about which ladder they show. */
export interface PlayerLeague {
  name: string;
  iconUrls?: LeagueIconUrls;
}

/** The clan block the player payload carries. The header renders the clan
 * name beside the tag; the tag is kept for the cards that will want a path
 * back to the clan. Absent when the player is clanless. */
export interface PlayerClan {
  tag: string;
  name: string;
}

/** One unit entry from the player payload's unit arrays (troops, spells,
 * heroes). The game API returns the same shape for every unit type: a
 * name, the player's current level, the unit's global maximum level
 * (null when the API has not caught up to brand-new content), and the
 * village marker (home vs builderBase). The rushed engine (T-M2-2) reads
 * these to compute the verdict; the progression grid (T-M2-5) reads them
 * to render every unit tile. */
export interface PlayerUnit {
  name: string;
  level: number;
  /** The unit's global maximum level as reported by the API. Null when the
   * API omits it (brand-new content); the bundled reference data (T-M2-6)
   * supplies the fallback, and a unit absent from both is skipped with a
   * footnote (SR-14, SR-17). */
  maxLevel: number | null;
  /** "home" for the home village, "builderBase" for the builder base. The
   * rushed analysis is home-village only (05 section 1); the builder base
   * gets its own panel, never mixed. */
  village: string;
}

/** Shape of a successful /api/player/:tag response, stripped to what the
 * shell and the analysis engines read (FR-06, FR-07, FR-16). The identity
 * block feeds the header; the unit arrays feed the rushed engine and the
 * progression grid. */
export interface PlayerResponse {
  tag: string;
  name: string;
  townHallLevel: number;
  /** XP level, the header's XP cell. */
  expLevel: number;
  /** Raw API role string ("leader" | "coLeader" | "admin" | "member").
   * Undefined when the player is clanless; lib/clan-role.ts owns the label
   * and the seniority order, the same table the roster reads. */
  role?: string;
  /** The player's clan; undefined when clanless. */
  clan?: PlayerClan;
  /** The ranked-ladder tier (the new league set); undefined when the payload
   * omits it entirely. */
  leagueTier?: PlayerLeagueTier;
  /** The classic trophy league; undefined when the payload omits it. */
  league?: PlayerLeague;
  /** Home-village troops, super troops, siege machines, and pets, all mixed
   * in the game API's `troops` array. The rushed engine's adapter sorts them
   * into categories; the client just parses the shape. Builder-base units
   * carry village="builderBase" and are excluded from the home-village
   * rushed analysis (05 section 1). */
  troops?: PlayerUnit[];
  /** Home-village and builder-base spells. Same shape as troops. */
  spells?: PlayerUnit[];
  /** Home-village heroes (Barbarian King, Archer Queen, Grand Warden, Royal
   * Champion, etc.). */
  heroes?: PlayerUnit[];
  /** Hero equipment (the equipment slots on each hero). Read by the
   * progression grid (FR-16); the rushed engine counts them in the overall
   * percentage when maxLevel is present. */
  heroEquipment?: PlayerUnit[];
  /** Seconds since the upstream fetch; injected by the tier on every 200. */
  age: number;
}

/** Discriminated union for every outcome the contract can hand the client. */
export type PlayerQueryResult =
  | { kind: 'ok'; player: PlayerResponse }
  | { kind: 'not_found'; tag: string }
  | { kind: 'busy'; retryAfter: number }
  | { kind: 'unreachable' }
  | { kind: 'bad_request'; detail: string };

/** Thrown for every non-ok response so TanStack Query sees a single failure
 * path. The discriminated `result` is what the screen branches on. */
export class PlayerFetchError extends Error {
  readonly result: Exclude<PlayerQueryResult, { kind: 'ok' }>;
  constructor(result: Exclude<PlayerQueryResult, { kind: 'ok' }>) {
    super(`player fetch failed: ${result.kind}`);
    this.name = 'PlayerFetchError';
    this.result = result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toLeagueIconUrls(parsed: unknown): LeagueIconUrls | undefined {
  // Both league shapes nest iconUrls; only `small` is read (the 24 px slot),
  // so the rest of the sizes the API sends never enter the typed shape.
  if (!isRecord(parsed)) return undefined;
  const small = typeof parsed.small === 'string' ? parsed.small : '';
  if (small === '') return undefined;
  return { small };
}

function toPlayerLeagueTier(parsed: unknown): PlayerLeagueTier | undefined {
  // The same tolerance the clan member tier parser keeps: an empty or
  // missing object is "no tier" (the header falls back), a named tier is a
  // real tier even when its icons are absent.
  if (!isRecord(parsed)) return undefined;
  const name = typeof parsed.name === 'string' ? parsed.name : '';
  if (name === '') return undefined;
  return { name, iconUrls: toLeagueIconUrls(parsed.iconUrls) };
}

function toPlayerLeague(parsed: unknown): PlayerLeague | undefined {
  if (!isRecord(parsed)) return undefined;
  const name = typeof parsed.name === 'string' ? parsed.name : '';
  if (name === '') return undefined;
  return { name, iconUrls: toLeagueIconUrls(parsed.iconUrls) };
}

function toPlayerClan(parsed: unknown): PlayerClan | undefined {
  if (!isRecord(parsed)) return undefined;
  const tag = typeof parsed.tag === 'string' ? parsed.tag : '';
  const name = typeof parsed.name === 'string' ? parsed.name : '';
  // A clan block without a tag cannot be linked back to, so it is dropped
  // rather than rendered as a name with no destination. Everything else
  // degrades to defaults, the same tolerance the clan fields get.
  if (tag === '') return undefined;
  return { tag, name };
}

function toPlayerUnit(parsed: unknown): PlayerUnit | null {
  if (!isRecord(parsed)) return null;
  const name = typeof parsed.name === 'string' ? parsed.name : '';
  if (name === '') return null;
  const level = typeof parsed.level === 'number' ? parsed.level : 0;
  // maxLevel is null in the raw payload when the API has not caught up to
  // brand-new content; the engine handles the fallback (SR-14, SR-17).
  const maxLevel =
    typeof parsed.maxLevel === 'number' ? parsed.maxLevel : null;
  const village = typeof parsed.village === 'string' ? parsed.village : 'home';
  return { name, level, maxLevel, village };
}

function toPlayerUnitArray(parsed: unknown): PlayerUnit[] | undefined {
  if (!Array.isArray(parsed)) return undefined;
  const units = parsed
    .map(toPlayerUnit)
    .filter((unit): unit is PlayerUnit => unit !== null);
  return units.length > 0 ? units : undefined;
}

function toPlayerResponse(parsed: unknown): PlayerResponse {
  if (!isRecord(parsed)) {
    throw new PlayerFetchError({ kind: 'bad_request', detail: 'response was not a JSON object' });
  }
  const tag = typeof parsed.tag === 'string' ? parsed.tag : '';
  const name = typeof parsed.name === 'string' ? parsed.name : '';
  const townHallLevel = typeof parsed.townHallLevel === 'number' ? parsed.townHallLevel : 0;
  const expLevel = typeof parsed.expLevel === 'number' ? parsed.expLevel : 0;
  const role = typeof parsed.role === 'string' && parsed.role !== '' ? parsed.role : undefined;
  return {
    tag,
    name,
    townHallLevel,
    expLevel,
    role,
    clan: toPlayerClan(parsed.clan),
    leagueTier: toPlayerLeagueTier(parsed.leagueTier),
    league: toPlayerLeague(parsed.league),
    troops: toPlayerUnitArray(parsed.troops),
    spells: toPlayerUnitArray(parsed.spells),
    heroes: toPlayerUnitArray(parsed.heroes),
    heroEquipment: toPlayerUnitArray(parsed.heroEquipment),
    age: typeof parsed.age === 'number' ? parsed.age : 0,
  };
}

function classifyError(status: number, body: unknown): PlayerFetchError {
  if (status === 404) {
    const tag = isRecord(body) && typeof body.tag === 'string' ? body.tag : '';
    return new PlayerFetchError({ kind: 'not_found', tag });
  }
  if (status === 503) {
    const retryAfter = isRecord(body) && typeof body.retryAfter === 'number' ? body.retryAfter : 30;
    return new PlayerFetchError({ kind: 'busy', retryAfter });
  }
  if (status === 502) {
    return new PlayerFetchError({ kind: 'unreachable' });
  }
  const detail = isRecord(body) && typeof body.detail === 'string' ? body.detail : `status ${status}`;
  return new PlayerFetchError({ kind: 'bad_request', detail });
}

/**
 * Fetches a player by tag from the same-origin tier and returns the parsed
 * response or throws {@link PlayerFetchError} for any non-200 outcome.
 *
 * The tag is taken in canonical form (leading #, uppercase); the tier
 * normalizes again cheaply so a stray lowercase still resolves. The
 * canonical form is what we display and what goes into the tier request
 * path (`%23`-encoded there); the shareable browser URL carries the bare
 * tag and is built by lib/tag.ts, not here.
 */
export async function fetchPlayer(
  tag: PlayerTag,
  init: { fetchImpl?: typeof fetch } = {},
): Promise<PlayerResponse> {
  const doFetch = init.fetchImpl ?? fetch;
  const encoded = encodeURIComponent(tag);
  const response = await doFetch(`/api/player/${encoded}`, {
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
  return toPlayerResponse(parsed);
}
