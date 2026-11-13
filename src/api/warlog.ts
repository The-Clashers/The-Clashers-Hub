// Typed client for our own GET /api/clan/:tag/warlog route.
//
// The serverless tier (server/routes.ts) proxies the game API's
// /clans/{tag}/warlog behind a 600 s cache and maps upstream failures to
// the shared JSON error contract. One tier behavior is unique to this
// route and shapes everything here: a private war log is NOT an error.
// Upstream answers 403 and the tier answers 200 { "private": true, "age":
// N } instead (04 section 6), so the client models privacy as a success
// shape the screen renders as the designed notice (F-09, AC-05, CON-05:
// "private war logs are a designed state, not an error"). Nothing in this
// module throws for a private log.
//
// The parse keeps what the Log tab reads (T-M3-2): per-war results, end
// times, team sizes, and both sides' standings. League seasons (Clan War
// League) ride the same page with cumulative numbers and no verdict, so
// the parse tags them and the efficiency engine in
// lib/war-efficiency.ts sets them apart from single-wars rates. The
// aggregates (win rate, stars per attack, average destruction) are
// computed client-side by that same pure module, never here: the parse
// stays a faithful view model of the payload, the same split api/war.ts
// keeps with lib/war-standings.ts.
//
// The tier forwards the upstream cursor page verbatim but takes no query
// params of its own, so there is no "load more" to model yet; the
// default page carries a clan's whole log in practice (the smoke clan's
// 56 entries arrive on one exhausted cursor). When pagination grows a
// tier param, this client grows the cursor field in the same PR.

import { parseWarTimestamp } from './war';

/** A war's outcome from the viewed clan's side. The game API reports
 * "win", "lose", or "tie" on finished regular wars. Two other readings
 * exist: an entry with no result is a war still being fought ("ongoing"),
 * and an entry whose per-member allowance is 1 is a Clan War League
 * season ("league") — one attack per member per day across seven rounds,
 * so stars and destruction arrive as season totals, no win or loss
 * verdict is ever reported, and the opponent object is degenerate. */
export type WarlogResult = 'win' | 'lose' | 'tie' | 'ongoing' | 'league';

/** One side of a finished or ongoing war: the viewed clan or the
 * opponent. */
export interface WarlogSide {
  tag: string;
  name: string;
  /** The API badge (medium, small as fallback) or null for the quiet
   * block; rendered in a fixed slot so a slow CDN load never reflows. */
  badgeUrl: string | null;
  clanLevel: number;
  /** Stars the side earned in this war. */
  stars: number;
  /** The side's destruction standing. The warlog's own field is already
   * the average per attack used, which is why the efficiency engine can
   * weight it by attacks. */
  destructionPercentage: number;
  /** Attacks the side used. The payload may omit the opponent's count
   * (the live API does); a missing count reads as 0. */
  attackCount: number;
}

/** One war on the log, newest first. */
export interface WarlogEntry {
  result: WarlogResult;
  /** When the war ended (or is scheduled to end), epoch ms; undefined
   * when the payload's timestamp does not parse. */
  endTimeMs: number | undefined;
  /** How many members each side brought. */
  teamSize: number;
  /** Attacks each war member may use: 2 in every regular war, 1 per
   * day in a Clan War League season — the value that tells the two
   * formats apart, since a league entry also arrives with no result and
   * a degenerate opponent. 0 when the payload does not say. */
  attacksPerMember: number;
  /** The viewed clan's side. */
  clan: WarlogSide;
  /** The opponent's side. */
  opponent: WarlogSide;
}

/** Shape of a successful /api/clan/:tag/warlog response: a page of
 * finished (and possibly one ongoing) wars, or the private reading. */
export type WarlogResponse =
  | { private: true; age: number }
  | { private: false; entries: WarlogEntry[]; age: number };

/** Discriminated union for every outcome the contract can hand the
 * client. The private reading is deliberately absent: it is a success
 * shape, not a failure. */
export type WarlogQueryResult =
  | { kind: 'ok'; response: WarlogResponse }
  | { kind: 'not_found'; tag: string }
  | { kind: 'busy'; retryAfter: number }
  | { kind: 'unreachable' }
  | { kind: 'bad_request'; detail: string };

/** Thrown for every non-ok response so TanStack Query sees a single
 * failure path. Mirrors WarFetchError's shape (same contract, same
 * kinds) but stays its own class: a war log fetch failing is the Log
 * tab's own error state, and the types should not blur the routes. */
export class WarlogFetchError extends Error {
  readonly result: Exclude<WarlogQueryResult, { kind: 'ok' }>;
  constructor(result: Exclude<WarlogQueryResult, { kind: 'ok' }>) {
    super(`warlog fetch failed: ${result.kind}`);
    this.name = 'WarlogFetchError';
    this.result = result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A payload number, or the fallback when the field is absent or not a
 * number. Warlog counters are honest 0-to-N values; a missing one reads
 * as 0 rather than undefined so the view never branches on arithmetic. */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The raw "result" field plus the entry's allowance narrowed to the
 * five the view renders. The format check runs first: the league's own
 * one attack per member per day marks a Clan War League season no
 * matter what verdict the payload carries — the live API does report an
 * occasional tie on a season, and its season-total figures must never
 * reach the per-war view. A regular war is always two attacks per
 * member, so the format check cannot swallow one. What remains maps its
 * verdict, and a missing verdict on a regular war reads as ongoing —
 * never as a fabricated win or loss. */
function toResult(value: unknown, attacksPerMember: number): WarlogResult {
  if (attacksPerMember === 1) return 'league';
  if (value === 'win' || value === 'lose' || value === 'tie') return value;
  return 'ongoing';
}

function toWarlogSide(parsed: unknown): WarlogSide {
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
  };
}

function toWarlogEntry(parsed: unknown): WarlogEntry | null {
  if (!isRecord(parsed)) return null;
  const clan = toWarlogSide(parsed.clan);
  // An entry without our side's tag is not a war this clan fought; the
  // upstream page never carries one, and a stray object is skipped
  // rather than rendered as a blank row.
  if (clan.tag === '') return null;
  const opponent = toWarlogSide(parsed.opponent);
  const attacksPerMember = numberOr(parsed.attacksPerMember, 0);
  return {
    result: toResult(parsed.result, attacksPerMember),
    endTimeMs: parseWarTimestamp(parsed.endTime),
    teamSize: numberOr(parsed.teamSize, 0),
    attacksPerMember,
    clan,
    opponent,
  };
}

/** Entries the payload did not give an end time to sort on fall to the
 * end in payload order (Array#sort is stable); otherwise the newest war
 * leads, the order the game's own war log keeps and the one the summary
 * sample label depends on. The descending sort needs the unknown key to
 * be the smallest, the mirror of the ascending sorts' MAX_SAFE_INTEGER
 * sentinels. */
const UNKNOWN_END_TIME = -1;

function toWarlogResponse(parsed: unknown): WarlogResponse {
  if (!isRecord(parsed)) {
    throw new WarlogFetchError({ kind: 'bad_request', detail: 'response was not a JSON object' });
  }
  const age = typeof parsed.age === 'number' ? parsed.age : 0;
  // The tier's private body (04 section 6): a designed state, returned
  // as a success so the screen renders the notice, never an error.
  if (parsed.private === true) {
    return { private: true, age };
  }
  const entries: WarlogEntry[] = [];
  if (Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      const entry = toWarlogEntry(item);
      if (entry !== null) entries.push(entry);
    }
  }
  entries.sort((a, b) => {
    const aEnd = a.endTimeMs ?? UNKNOWN_END_TIME;
    const bEnd = b.endTimeMs ?? UNKNOWN_END_TIME;
    return bEnd - aEnd;
  });
  return { private: false, entries, age };
}

function classifyError(status: number, body: unknown): WarlogFetchError {
  if (status === 404) {
    const tag = isRecord(body) && typeof body.tag === 'string' ? body.tag : '';
    return new WarlogFetchError({ kind: 'not_found', tag });
  }
  if (status === 503) {
    const retryAfter = isRecord(body) && typeof body.retryAfter === 'number' ? body.retryAfter : 30;
    return new WarlogFetchError({ kind: 'busy', retryAfter });
  }
  if (status === 502) {
    return new WarlogFetchError({ kind: 'unreachable' });
  }
  const detail = isRecord(body) && typeof body.detail === 'string' ? body.detail : `status ${status}`;
  return new WarlogFetchError({ kind: 'bad_request', detail });
}

/**
 * Fetches the war log for a clan tag from the same-origin tier and
 * returns the parsed response or throws {@link WarlogFetchError} for any
 * non-200 outcome. A private log resolves to `{ private: true }` — the
 * designed state, not a throw. The tag is taken in canonical form
 * (leading #); the `%23` encoding for the tier request path happens here
 * and only here, exactly like the clan and war clients.
 */
export async function fetchWarlog(
  tag: string,
  init: { fetchImpl?: typeof fetch } = {},
): Promise<WarlogResponse> {
  const doFetch = init.fetchImpl ?? fetch;
  const encoded = encodeURIComponent(tag);
  const response = await doFetch(`/api/clan/${encoded}/warlog`, {
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
  return toWarlogResponse(parsed);
}
