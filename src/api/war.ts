// Typed client for our own GET /api/clan/:tag/war route (the current war).
//
// The serverless tier (server/routes.ts) proxies the game API's
// /clans/{tag}/currentwar and maps upstream failures to the same JSON
// error contract the clan route uses. Two screens read this module now:
// the War tab (T-M3-1, FR-10) renders the whole payload — the state
// banner, both clans' standings, and the per-member attack tables — and
// the needs-attention tab reads one projection from it: how many war
// attacks each member still holds (attacksPerMember minus the member's
// attacks array length), which only exists while the clan is in a war
// (preparation or battle day).
//
// The parse keeps what those views read and nothing else: the state, the
// team size, the per-member allowance, the war clock (start and end
// instants, parsed out of the API's basic-format timestamps), both clans'
// identity and standings, and each member's raw attacks. The display
// aggregates (star totals, average destruction, the lead/winner verdict)
// are computed client-side by pure helpers in lib/war-standings.ts, never
// here: the parse stays a faithful view model of the payload.
//
// The failure union mirrors ClanFetchError's shape (same contract, same
// kinds) but stays its own class: a war fetch failing quietly (dashes in
// the attacks column) is a different screen decision than a clan fetch
// failing (an error state), and the types should not blur that.

/** The war states the game API reports. A clan with no war answers a
 * degenerate object whose state reads "notInWar". */
export type WarState = 'notInWar' | 'preparation' | 'inWar' | 'ended';

const WAR_STATES: ReadonlySet<string> = new Set(['notInWar', 'preparation', 'inWar', 'ended']);

/** One attack a war member used. */
export interface WarAttack {
  /** Stars the attack earned, 0 to 3. */
  stars: number;
  /** How much of the defender's base it destroyed, 0 to 100. */
  destructionPercentage: number;
}

/** One member on a war roster. */
export interface WarMember {
  tag: string;
  name: string;
  /** The member's Town Hall during this war. */
  townHallLevel: number;
  /** The member's position on the war map, 1-based; 0 when the payload
   * does not carry one. */
  mapPosition: number;
  /** The attacks the member used, in the order the payload lists them. */
  attacks: WarAttack[];
}

/** One side of the war: the viewed clan or the opponent. */
export interface WarClan {
  tag: string;
  name: string;
  /** The API badge (medium, small as fallback) or null for the quiet
   * block; rendered in a fixed slot so a slow CDN load never reflows. */
  badgeUrl: string | null;
  clanLevel: number;
  /** Stars the side has earned. */
  stars: number;
  /** The side's destruction standing: the game averages the best
   * destruction landed on each enemy base. */
  destructionPercentage: number;
  /** Attacks the side has used so far. */
  attackCount: number;
  /** The side's war roster, ordered by map position. */
  members: WarMember[];
}

/** Shape of a successful /api/clan/:tag/war response. */
export interface CurrentWarResponse {
  /** Raw upstream state string, narrowed to the known four; undefined
   * when the payload does not carry a recognizable one. */
  state?: WarState;
  /** How many members each side brought to the map. */
  teamSize?: number;
  /** Attacks each war member may use, 2 in every real war. */
  attacksPerMember?: number;
  /** When battle day starts (preparation's finish line), epoch ms. */
  startTimeMs?: number;
  /** When the war ends, epoch ms. */
  endTimeMs?: number;
  /** Seconds since the upstream fetch; injected by the tier. */
  age: number;
  /** The viewed clan's side of the war. */
  clan: WarClan;
  /** The opponent's side of the war. */
  opponent: WarClan;
  /** Attacks used so far, keyed by member tag, our side only. Members
   * not in the war roster are absent, which is how "did not war" is told
   * apart from "used zero attacks". */
  attacksUsedByTag: Map<string, number>;
}

/** Discriminated union for every outcome the contract can hand the client. */
export type WarQueryResult =
  | { kind: 'ok'; war: CurrentWarResponse }
  | { kind: 'not_found'; tag: string }
  | { kind: 'busy'; retryAfter: number }
  | { kind: 'unreachable' }
  | { kind: 'bad_request'; detail: string };

/** Thrown for every non-ok response so TanStack Query sees a single
 * failure path. */
export class WarFetchError extends Error {
  readonly result: Exclude<WarQueryResult, { kind: 'ok' }>;
  constructor(result: Exclude<WarQueryResult, { kind: 'ok' }>) {
    super(`war fetch failed: ${result.kind}`);
    this.name = 'WarFetchError';
    this.result = result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A payload number, or the fallback when the field is absent or not a
 * number. War payloads are honest 0-to-N counters; a missing one reads
 * as 0 rather than undefined so the view never branches on arithmetic. */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * The API's timestamp shape: "20261016T091952.000Z", an ISO basic format
 * Date cannot parse in every engine, so the fields are picked apart by
 * hand into an epoch instant. Returns undefined for anything else.
 */
export function parseWarTimestamp(raw: unknown): number | undefined {
  if (typeof raw !== 'string') return undefined;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(raw);
  if (!match) return undefined;
  const parsed = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Members the payload did not give a map position to sort on fall to
 * the end of the roster in payload order (Array#sort is stable). */
const UNKNOWN_MAP_POSITION = Number.MAX_SAFE_INTEGER;

function toWarMembers(parsed: unknown): WarMember[] {
  const members: WarMember[] = [];
  if (!Array.isArray(parsed)) return members;
  for (const entry of parsed) {
    if (!isRecord(entry)) continue;
    const tag = typeof entry.tag === 'string' ? entry.tag : '';
    if (tag === '') continue;
    const attacks: WarAttack[] = [];
    if (Array.isArray(entry.attacks)) {
      for (const attack of entry.attacks) {
        if (!isRecord(attack)) continue;
        attacks.push({
          stars: numberOr(attack.stars, 0),
          destructionPercentage: numberOr(attack.destructionPercentage, 0),
        });
      }
    }
    members.push({
      tag,
      name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : tag,
      townHallLevel: numberOr(entry.townhallLevel, 0),
      mapPosition: numberOr(entry.mapPosition, 0),
      attacks,
    });
  }
  // The war map's own order: position 1 is the first base. The roster
  // tables read it the way the game lays the map out.
  members.sort(
    (a, b) => (a.mapPosition || UNKNOWN_MAP_POSITION) - (b.mapPosition || UNKNOWN_MAP_POSITION),
  );
  return members;
}

function toWarClan(parsed: unknown): WarClan {
  const record = isRecord(parsed) ? parsed : {};
  const badgeUrls = isRecord(record.badgeUrls) ? record.badgeUrls : {};
  const medium = typeof badgeUrls.medium === 'string' ? badgeUrls.medium : '';
  const small = typeof badgeUrls.small === 'string' ? badgeUrls.small : '';
  return {
    tag: typeof record.tag === 'string' ? record.tag : '',
    name: typeof record.name === 'string' ? record.name : '',
    badgeUrl: medium !== '' ? medium : small !== '' ? small : null,
    clanLevel: numberOr(record.clanLevel, 0),
    stars: numberOr(record.stars, 0),
    destructionPercentage: numberOr(record.destructionPercentage, 0),
    attackCount: numberOr(record.attacks, 0),
    members: toWarMembers(record.members),
  };
}

function toCurrentWarResponse(parsed: unknown): CurrentWarResponse {
  if (!isRecord(parsed)) {
    throw new WarFetchError({ kind: 'bad_request', detail: 'response was not a JSON object' });
  }
  const state = typeof parsed.state === 'string' && WAR_STATES.has(parsed.state)
    ? (parsed.state as WarState)
    : undefined;
  const teamSize = typeof parsed.teamSize === 'number' ? parsed.teamSize : undefined;
  const attacksPerMember =
    typeof parsed.attacksPerMember === 'number' ? parsed.attacksPerMember : undefined;
  const startTimeMs = parseWarTimestamp(parsed.startTime);
  const endTimeMs = parseWarTimestamp(parsed.endTime);
  const age = typeof parsed.age === 'number' ? parsed.age : 0;
  const clan = toWarClan(parsed.clan);
  const opponent = toWarClan(parsed.opponent);
  // The attacks-used projection the needs-attention tab reads: only our
  // side's roster, because no member of this clan is on the opponent's.
  const attacksUsedByTag = new Map<string, number>();
  for (const member of clan.members) {
    attacksUsedByTag.set(member.tag, member.attacks.length);
  }
  return {
    state,
    teamSize,
    attacksPerMember,
    startTimeMs,
    endTimeMs,
    age,
    clan,
    opponent,
    attacksUsedByTag,
  };
}

function classifyError(status: number, body: unknown): WarFetchError {
  if (status === 404) {
    const tag = isRecord(body) && typeof body.tag === 'string' ? body.tag : '';
    return new WarFetchError({ kind: 'not_found', tag });
  }
  if (status === 503) {
    const retryAfter = isRecord(body) && typeof body.retryAfter === 'number' ? body.retryAfter : 30;
    return new WarFetchError({ kind: 'busy', retryAfter });
  }
  if (status === 502) {
    return new WarFetchError({ kind: 'unreachable' });
  }
  const detail = isRecord(body) && typeof body.detail === 'string' ? body.detail : `status ${status}`;
  return new WarFetchError({ kind: 'bad_request', detail });
}

/**
 * Fetches the current war for a clan tag from the same-origin tier and
 * returns the parsed response or throws {@link WarFetchError} for any
 * non-200 outcome. The tag is taken in canonical form (leading #); the
 * `%23` encoding for the tier request path happens here and only here,
 * exactly like the clan client.
 */
export async function fetchCurrentWar(
  tag: string,
  init: { fetchImpl?: typeof fetch } = {},
): Promise<CurrentWarResponse> {
  const doFetch = init.fetchImpl ?? fetch;
  const encoded = encodeURIComponent(tag);
  const response = await doFetch(`/api/clan/${encoded}/war`, {
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
  return toCurrentWarResponse(parsed);
}

/**
 * The attacks a member still holds in the current war, or null when there
 * is nothing to say: no war, no per-member allowance, or the member is
 * not on the war roster. Null renders as the quiet dash; the state and
 * roster distinctions stay the screen's copy to make.
 */
export function attacksLeftFor(
  war: CurrentWarResponse | undefined,
  memberTag: string,
): number | null {
  if (!war) return null;
  if (war.state !== 'preparation' && war.state !== 'inWar') return null;
  const per = war.attacksPerMember ?? 2;
  if (per < 1) return null;
  const used = war.attacksUsedByTag.get(memberTag);
  if (used === undefined) return null;
  return Math.max(0, per - used);
}
