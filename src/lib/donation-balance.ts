// Donation balance engine (T-M1-5, FR-05, SR-12, NFR-07).
//
// Answers the question "who takes but never gives?" (UR-02) by computing a
// given/received ratio per member against a configurable target, flagging
// members below target, and ranking the flagged members worst-first so the
// roster's needs-attention toggle has a single source of truth for its order.
//
// Pure TypeScript: no React, no network, no clock. Data in, judgment out
// (05 section 2, STD-09). That is what makes it table-driven-testable to
// 90%+ coverage (NFR-07) and reusable on any roster shape that carries the
// four fields the engine reads. The engine never imports the API client;
// the ClanMember from api/clan.ts satisfies the structural input, and so
// does any test fixture.
//
// Mechanics (05 section 2 "Donation balance"):
//
// - ratio = given / max(received, 1). A saint (given > 0, received = 0) is
//   not a divide-by-zero; its ratio is `given`, displayed as "given : 0".
// - A member is flagged when given < target * received AND received exceeds
//   a noise floor. The noise floor stops new members with tiny counters
//   from being public-shamed before their season has had a chance to
//   balance out.
// - deficit = target * received - given, the ranking key for the
//   needs-attention ordering. Worst first.
// - Both zero is no data: a dash, never a red flag.
// - Clan-level health = share of members at or above target, one number the
//   roster header can show as a chip.
//
// The default target is 1.0 (1:1). The target is adjustable client-side
// (SR-12): because the engine is a pure function, changing the target is a
// re-call with the same members and a different target, no refetch. The
// roster keeps the members from the single clan fetch (SR-09) and
// re-computes locally.

/** The target ratio a member's given/received must meet. 1.0 means 1:1
 * (give at least as much as you receive). 0.5 means give at least half. */
export type DonationTarget = number;

/** The default target: 1:1 (FR-05). */
export const DEFAULT_DONATION_TARGET: DonationTarget = 1.0;

/**
 * The noise floor for received donations. A member whose received is at or
 * below this value is never flagged, no matter how lopsided the ratio: a
 * brand-new member who received 3 troops has not had a season to balance
 * out, and public-shaming them is both noisy and unkind. The value is
 * small enough that any real donor clears it inside a week.
 */
export const DONATION_NOISE_FLOOR = 50;

/**
 * The member fields the engine reads. Structural on purpose: the parsed
 * ClanMember from api/clan.ts satisfies it, and so does any test fixture,
 * without the engine importing the client (the rule stays UI-free,
 * STD-09). Same shape as RosterSortableMember so the roster's sort and the
 * donation engine read from the same row without coupling to each other.
 */
export interface DonationMember {
  tag: string;
  name: string;
  donations: number;
  donationsReceived: number;
  /** Position inside the clan, the API's own roster ordering; the
   * needs-attention sort's tiebreak. Optional: a degraded payload may
   * omit it, and the name/tag tiebreaks take over. */
  clanRank?: number;
}

/** The three states the RatioFlag chip renders (07 section 4). */
export type DonationState = 'good' | 'warn' | 'dash';

/** One member's donation verdict. Carries everything the chip and the
 * needs-attention sort need, pre-computed so the render is a lookup, not
 * a calculation. */
export interface DonationVerdict {
  member: DonationMember;
  given: number;
  received: number;
  /** given / max(received, 1). null when both are zero (no data). */
  ratio: number | null;
  /** target * received - given. Positive for flagged members; the
   * needs-attention sort key. */
  deficit: number;
  /** True when the member is below target and above the noise floor. */
  flagged: boolean;
  /** The chip state: good (at or above target), warn (below target),
   * dash (no data, both zero). */
  state: DonationState;
}

/** Clan-level donation health, the one number the roster header shows.
 * Computed from the verdicts, not re-fetched. */
export interface DonationSummary {
  /** Total members with data (excludes dash / no-data members). */
  membersWithData: number;
  /** Members at or above the target. */
  atOrAboveTarget: number;
  /** Members flagged below target (above the noise floor). */
  flagged: number;
  /** Members with no data (both zero). */
  noData: number;
  /** Share of members-with-data at or above target, 0 to 1. null when no
   * member has data, so the chip renders a dash instead of a misleading 0. */
  healthShare: number | null;
}

/** The full engine output: one verdict per member plus the clan summary. */
export interface DonationBalance {
  verdicts: DonationVerdict[];
  summary: DonationSummary;
}

/**
 * Computes the donation balance for a roster against a target. Pure: the
 * input array is untouched, every verdict is a fresh object, and the same
 * members + target always yield the same output. Changing the target is a
 * re-call with the same members (SR-12: local re-computation, no refetch).
 */
export function computeDonationBalance<M extends DonationMember>(
  members: readonly M[],
  target: DonationTarget = DEFAULT_DONATION_TARGET,
): DonationBalance {
  const verdicts = members.map((member) => toVerdict(member, target));
  const summary = summarize(verdicts);
  return { verdicts, summary };
}

/**
 * Re-orders verdicts worst-first by deficit (the needs-attention ordering,
 * FR-05 / SR-12). Only flagged members appear; non-flagged members stay in
 * clan order after the flagged block. The tiebreak is the same chain the
 * roster sort uses (clan rank, then name, then tag) so flipping into and
 * out of needs-attention never shuffles tied rows at random.
 *
 * Pure: the input array is untouched, a new array comes back.
 */
export function sortNeedsAttention<M extends DonationMember>(
  members: readonly M[],
  target: DonationTarget = DEFAULT_DONATION_TARGET,
): M[] {
  const verdicts = members.map((member) => ({ member, verdict: toVerdict(member, target) }));
  return [...verdicts].sort((a, b) => {
    // Flagged members come first, worst deficit first.
    const aFlag = a.verdict.flagged ? 1 : 0;
    const bFlag = b.verdict.flagged ? 1 : 0;
    if (aFlag !== bFlag) return bFlag - aFlag;
    if (aFlag === 1) {
      // Both flagged: worst deficit first (descending deficit).
      const byDeficit = b.verdict.deficit - a.verdict.deficit;
      if (byDeficit !== 0) return byDeficit;
      return tieBreak(a.member, b.member);
    }
    // Neither flagged: keep clan order.
    return tieBreak(a.member, b.member);
  }).map((entry) => entry.member);
}

/** Looks up a single member's verdict by tag. Returns undefined when the tag
 * is not in the balance (e.g. the roster was filtered). Pure convenience
 * for the table rows that need the chip without re-indexing. */
export function verdictByTag(balance: DonationBalance, tag: string): DonationVerdict | undefined {
  return balance.verdicts.find((verdict) => verdict.member.tag === tag);
}

// ---------- internals ----------

function toVerdict(member: DonationMember, target: DonationTarget): DonationVerdict {
  const given = member.donations;
  const received = member.donationsReceived;

  if (given === 0 && received === 0) {
    return { member, given, received, ratio: null, deficit: 0, flagged: false, state: 'dash' };
  }

  const ratio = given / Math.max(received, 1);
  const deficit = target * received - given;
  const aboveNoise = received > DONATION_NOISE_FLOOR;
  const flagged = deficit > 0 && aboveNoise;
  const state: DonationState = flagged ? 'warn' : 'good';

  return { member, given, received, ratio, deficit, flagged, state };
}

function summarize(verdicts: DonationVerdict[]): DonationSummary {
  let membersWithData = 0;
  let atOrAboveTarget = 0;
  let flagged = 0;
  let noData = 0;

  for (const verdict of verdicts) {
    if (verdict.state === 'dash') {
      noData += 1;
      continue;
    }
    membersWithData += 1;
    if (verdict.flagged) {
      flagged += 1;
    } else {
      atOrAboveTarget += 1;
    }
  }

  const healthShare = membersWithData > 0 ? atOrAboveTarget / membersWithData : null;

  return { membersWithData, atOrAboveTarget, flagged, noData, healthShare };
}

/** Deterministic tiebreak chain: clan rank, then name, then tag. Ascending
 * in both sort directions so tied rows keep a stable order. Mirrors
 * lib/roster-sort.ts so the two orderings agree on ties. */
function tieBreak(a: DonationMember, b: DonationMember): number {
  if (a.clanRank !== undefined && b.clanRank !== undefined && a.clanRank !== b.clanRank) {
    return a.clanRank - b.clanRank;
  }
  const byName = a.name.localeCompare(b.name);
  if (byName !== 0) return byName;
  return a.tag.localeCompare(b.tag);
}
