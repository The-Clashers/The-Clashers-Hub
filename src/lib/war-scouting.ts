// Preparation-day scouting helpers (T-M3-6, FR-17, SR-18).
//
// Pure pairing and mismatch logic kept free of React imports (STD-09)
// so it can be unit-tested directly against preparation-day fixtures.
// Both rosters come from the single /api/clan/:tag/war response,
// already ordered by war-map position in api/war.ts.
//
// A pairing is a mismatch when the own member's Town Hall is strictly
// lower than the opponent's at the same map slot (SR-18, AC-08). An
// equal or higher own Town Hall is not a mismatch, and an incomplete
// slot (one side missing or carrying a zero Town Hall) is never flagged.

import type { WarMember } from '../api/war';

/** One paired row in the preparation-day scouting view. */
export interface ScoutingPair {
  /** Stable key for list rendering (STD-18). */
  key: string;
  /** 1-based war-map position for this pairing. */
  position: number;
  /** Viewed clan's member at this slot, or null if the roster is shorter. */
  own: WarMember | null;
  /** Opponent's member at this slot, or null if the roster is shorter. */
  opponent: WarMember | null;
  /** True when the own member faces a higher-Town-Hall opponent. */
  isMismatch: boolean;
  /** Opponent TH minus own TH when both are known (> 0), otherwise 0. */
  townHallDelta: number;
}

/** Complete scouting projection for a preparation-day war. */
export interface ScoutingSummary {
  pairs: ScoutingPair[];
  mismatchCount: number;
}

function resolvePosition(
  own: WarMember | null,
  opponent: WarMember | null,
  index: number,
): number {
  if (own !== null && own.mapPosition > 0) return own.mapPosition;
  if (opponent !== null && opponent.mapPosition > 0) return opponent.mapPosition;
  return index + 1;
}

/**
 * Pairs own and opponent war rosters by map slot and flags every own
 * member facing a higher-Town-Hall opponent.
 */
export function buildScoutingPairs(
  ownMembers: readonly WarMember[],
  opponentMembers: readonly WarMember[],
): ScoutingSummary {
  const count = Math.max(ownMembers.length, opponentMembers.length);
  const pairs: ScoutingPair[] = [];
  let mismatchCount = 0;

  for (let i = 0; i < count; i += 1) {
    const own = ownMembers[i] ?? null;
    const opponent = opponentMembers[i] ?? null;
    const position = resolvePosition(own, opponent, i);

    const hasBothTownHalls =
      own !== null &&
      opponent !== null &&
      own.townHallLevel > 0 &&
      opponent.townHallLevel > 0;

    const townHallDelta = hasBothTownHalls
      ? opponent.townHallLevel - own.townHallLevel
      : 0;
    const isMismatch = hasBothTownHalls && townHallDelta > 0;

    if (isMismatch) {
      mismatchCount += 1;
    }

    pairs.push({
      key: `${own?.tag ?? 'none'}:${opponent?.tag ?? 'none'}:${position}`,
      position,
      own,
      opponent,
      isMismatch,
      townHallDelta,
    });
  }

  return { pairs, mismatchCount };
}
