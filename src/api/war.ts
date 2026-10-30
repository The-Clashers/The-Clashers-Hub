// Typed client for our own GET /api/clan/:tag/war route (the current war).
//
// The serverless tier (server/routes.ts) proxies the game API's
// /clans/{tag}/currentwar and maps upstream failures to the same JSON
// error contract the clan route uses. The M3 war view is the main future
// consumer; today the needs-attention tab reads one projection from it:
// how many war attacks each member still holds (attacksPerMember minus
// the member's attacks array length), which only exists while the clan is
// in a war (preparation or battle day). The parse keeps the state, the
// per-member allowance, and the attacks-used map, and nothing else, so
// the M3 screen will grow this module rather than replace it.
//
// The failure union mirrors ClanFetchError's shape (same contract, same
// kinds) but stays its own class: a war fetch failing quietly (dashes in
// the attacks column) is a different screen decision than a clan fetch
// failing (an error state), and the types should not blur that.

/** Shape of a successful /api/clan/:tag/war response, stripped to what
 * the needs-attention tab reads. */
export interface CurrentWarResponse {
  /** Raw upstream state string: "preparation" | "inWar" | "ended" ...
   * Optional because a clan with no war answers a degenerate object. */
  state?: string;
  /** Attacks each war member may use, 2 in every real war. */
  attacksPerMember?: number;
  /** Seconds since the upstream fetch; injected by the tier. */
  age: number;
  /** Attacks used so far, keyed by member tag. Members not in the war
   * roster are absent, which is how "did not war" is told apart from
   * "used zero attacks". */
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

function toAttacksUsedByTag(parsed: unknown): Map<string, number> {
  const map = new Map<string, number>();
  // The game API nests the war roster under clan.members; the opponent's
  // roster carries attacks too but no member of THIS clan is on it, so
  // only our side is read.
  const clan = isRecord(parsed) && isRecord(parsed.clan) ? parsed.clan : {};
  const members = Array.isArray(clan.members) ? clan.members : [];
  for (const entry of members) {
    if (!isRecord(entry)) continue;
    const tag = typeof entry.tag === 'string' ? entry.tag : '';
    if (tag === '') continue;
    const attacks = Array.isArray(entry.attacks) ? entry.attacks.length : 0;
    map.set(tag, attacks);
  }
  return map;
}

function toCurrentWarResponse(parsed: unknown): CurrentWarResponse {
  if (!isRecord(parsed)) {
    throw new WarFetchError({ kind: 'bad_request', detail: 'response was not a JSON object' });
  }
  const state = typeof parsed.state === 'string' ? parsed.state : undefined;
  const attacksPerMember =
    typeof parsed.attacksPerMember === 'number' ? parsed.attacksPerMember : undefined;
  const age = typeof parsed.age === 'number' ? parsed.age : 0;
  return { state, attacksPerMember, age, attacksUsedByTag: toAttacksUsedByTag(parsed) };
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
