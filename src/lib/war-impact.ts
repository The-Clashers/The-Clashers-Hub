// Per-member war impact metrics (T-M3-7, FR-10, FR-12, SR-19).
//
// The current-war view's per-member judgments, kept pure so they are
// table-testable without rendering anything (STD-09, the same split as
// lib/war-standings.ts and lib/war-scouting.ts). Everything here reads
// the single /api/clan/:tag/war response the War tab already holds; no
// member's impact ever costs a second fetch (SR-19's client-side rule).
//
// The metrics are the scoring engines doc's own list (05 section 3,
// "From the current war (per member)"):
//
// - attacks used versus allowed: participation, not impact;
// - stars and stars per attack: `stars / attacksUsed`, a rate, not a
//   volume, so a member who attacked once for two stars does not read
//   as half the contributor of one who attacked twice for four;
// - average destruction per used attack: the war-standings rule, null
//   with no attacks;
// - attack quality: each attack scores `stars x 100 +
//   destructionPercentage` (a perfect three-star full-destruction
//   attack is 400, the ceiling), and a member's quality is their best
//   attack. The participant average of that best quality is the
//   baseline the table colors read against, computed over participants
//   only: a member who has not attacked yet is unjudged, not a zero.
//
// The ordering rule puts impact first: participants ordered by stars,
// then best-attack quality, then average destruction, the war map's own
// order breaking every tie (Array#sort is stable); zero-attack members
// follow after them in map order, listed but never averaged in as
// zeros. The display positions keep each member's war-map number so the
// reordered table still speaks the map's language.

import type { WarAttack, WarMember } from '../api/war';

/** One member's war impact, computed from the single war response. */
export interface WarMemberImpact {
  /** Attacks the member has used so far. */
  attacksUsed: number;
  /** Attacks the member may use, when the payload carries the
   * allowance; null otherwise. */
  attacksAllowed: number | null;
  /** Stars the member earned across their used attacks. */
  stars: number;
  /** Stars per used attack, or null when the member has not attacked. */
  starsPerAttack: number | null;
  /** Average destruction across the used attacks, or null when the
   * member has not attacked (never a zero, SR-19's rule). */
  averageDestruction: number | null;
  /** The member's best attack quality, or null when they have not
   * attacked. */
  bestAttackQuality: number | null;
}

/**
 * One attack's quality: `stars x 100 + destructionPercent`. A perfect
 * three-star full-destruction attack scores 400, the ceiling.
 */
export function attackQuality(attack: WarAttack): number {
  return attack.stars * 100 + attack.destructionPercentage;
}

/**
 * Computes one member's war impact from their raw attacks. A member
 * with zero attacks has no rates at all: null, never a zero, the same
 * honesty the standings and efficiency views keep.
 */
export function memberWarImpact(member: WarMember, attacksPerMember?: number): WarMemberImpact {
  const attacksUsed = member.attacks.length;
  const hasAttacked = attacksUsed > 0;
  let stars = 0;
  let best: number | null = null;
  let destructionTotal = 0;
  for (const attack of member.attacks) {
    stars += attack.stars;
    destructionTotal += attack.destructionPercentage;
    const quality = attackQuality(attack);
    if (best === null || quality > best) best = quality;
  }
  return {
    attacksUsed,
    attacksAllowed:
      attacksPerMember !== undefined && attacksPerMember >= 1 ? attacksPerMember : null,
    stars,
    starsPerAttack: hasAttacked ? stars / attacksUsed : null,
    averageDestruction: hasAttacked ? destructionTotal / attacksUsed : null,
    bestAttackQuality: best,
  };
}

/**
 * The baseline the quality colors read against: the average best-attack
 * quality across a roster's participants. Members without attacks are
 * excluded, never averaged in as zeros; a roster with no participants
 * (fresh war, preparation day) has no baseline at all: null.
 */
export function participantAverageBestQuality(members: readonly WarMember[]): number | null {
  let total = 0;
  let participants = 0;
  for (const member of members) {
    if (member.attacks.length === 0) continue;
    const impact = memberWarImpact(member);
    if (impact.bestAttackQuality === null) continue;
    total += impact.bestAttackQuality;
    participants += 1;
  }
  return participants > 0 ? total / participants : null;
}

/** True when the member has used at least one attack. */
function isParticipant(member: WarMember): boolean {
  return member.attacks.length > 0;
}

/** The war map's slot for the idle-order comparison: unknown positions
 * sort after known ones in payload order (the stable sort keeps them
 * where the payload put them). */
function mapSlot(member: WarMember): number {
  return member.mapPosition > 0 ? member.mapPosition : Number.MAX_SAFE_INTEGER;
}

/** Impact is stars first, then best-attack quality, then average
 * destruction. All three are null-safe: the comparator only runs for
 * participants. */
function impactCompare(a: WarMember, b: WarMember): number {
  const aImpact = memberWarImpact(a);
  const bImpact = memberWarImpact(b);
  if (aImpact.stars !== bImpact.stars) return bImpact.stars - aImpact.stars;
  const aQuality = aImpact.bestAttackQuality ?? 0;
  const bQuality = bImpact.bestAttackQuality ?? 0;
  if (aQuality !== bQuality) return bQuality - aQuality;
  const aDestruction = aImpact.averageDestruction ?? 0;
  const bDestruction = bImpact.averageDestruction ?? 0;
  if (aDestruction !== bDestruction) return bDestruction - aDestruction;
  return 0;
}

/**
 * Orders a war roster for the impact view: participants first, ordered
 * by impact, zero-attack members after them. Every tie and every
 * zero-attack member keeps the war map's own order (the sort is
 * stable), so the table never invents a ranking the payload did not
 * state. Returns a new array; the input is untouched.
 */
export function orderWarMembersByImpact(members: readonly WarMember[]): WarMember[] {
  return [...members].sort((a, b) => {
    const aParticipant = isParticipant(a);
    const bParticipant = isParticipant(b);
    if (aParticipant !== bParticipant) return aParticipant ? -1 : 1;
    if (!aParticipant) {
      // Both idle: the war map's own order, not the payload's whim.
      const aSlot = mapSlot(a);
      const bSlot = mapSlot(b);
      if (aSlot !== bSlot) return aSlot - bSlot;
      return 0;
    }
    return impactCompare(a, b);
  });
}

/**
 * The display position per member tag, resolved from the payload's
 * original roster order before any impact reordering: the member's
 * war-map position when the payload carries one, otherwise the payload
 * index plus one. The reordered table reads these so the position
 * column keeps telling the truth about the war map.
 */
export function warMemberPositions(members: readonly WarMember[]): Map<string, number> {
  const positions = new Map<string, number>();
  members.forEach((member, index) => {
    positions.set(member.tag, member.mapPosition > 0 ? member.mapPosition : index + 1);
  });
  return positions;
}

/**
 * A stars-per-attack rate at the precision the war table reads: at most
 * two decimals (integer stars over integer attacks can land on thirds),
 * trailing zeros gone so a clean rate reads "2.5", not "2.50".
 */
export function formatStarsPerAttack(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** An attack quality at the precision the war table reads: a whole
 * number, since the payload's destruction is a whole percentage. */
export function formatAttackQuality(value: number): string {
  return String(Math.round(value));
}
