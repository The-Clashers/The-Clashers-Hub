// Achievement progress math for the achievements card (T-M2-3, FR-08).
//
// The card renders one row per achievement: the name, the requirement text,
// a value/target progress rail with star markers, and the stars the player
// holds. The rail is a display surface, not a calculation: the fill and the
// star slots are pre-computed here so the render stays a lookup and the
// rules are testable without React (STD-09), the same split RatioFlag keeps
// against lib/donation-balance.
//
// The village grouping the card also needs moved to its own module
// (lib/village.ts) when the hero card (T-M2-4) needed the identical rule;
// see the bottom of this file for the delegation.

import type { PlayerAchievement } from '../api/player';
//
// The one rule that matters most: stars are the API's truth. The game earns
// stars at in-game thresholds the payload does not expose, so the fraction
// value/target does not predict them (a player can hold 2 stars at 25% of
// the way to the final target, or 1 star with the value already past it).
// This module therefore never derives stars from the fraction; it carries
// the API count through and decides only what the rail shows.

/** The maximum stars the game awards per achievement. The API counts 0-3. */
export const ACHIEVEMENT_MAX_STARS = 3;

/** The rail's fill ratio, 0 to 1. A completed achievement (stars 3, value at
 * or past target) reads as a full rail; so does a 0-target row, the tolerant
 * floor for a malformed entry (a rail that can never fill would read as a
 * broken state, not an empty one). */
export function railFill(value: number, target: number): number {
  if (target <= 0) return 1;
  return Math.min(1, Math.max(0, value / target));
}

/** The star slots the rail draws beside the fill, always the full count so
 * a column of rails aligns. Each slot is either earned or open; the display
 * maps them to filled and quiet markers. */
export interface StarSlots {
  /** The total number of slots (always ACHIEVEMENT_MAX_STARS). */
  total: number;
  /** Slots the player has earned. */
  earned: number;
}

/** The star slots for one achievement: earned floored and clamped into
 * 0..total, the API count carried through, never derived from the fraction.
 * A fractional count (the API sends integers) floors to the earned marker
 * count, so the display never has to draw half a star. */
export function starSlots(stars: number): StarSlots {
  const earned = Math.min(ACHIEVEMENT_MAX_STARS, Math.max(0, Math.floor(stars)));
  return { total: ACHIEVEMENT_MAX_STARS, earned };
}

/** One achievement row's display data, everything the card renders except
 * the texts (name, info) it reads straight off the parsed entry. */
export interface AchievementProgress {
  /** The rail fill, 0 to 1. */
  fill: number;
  /** The star slots (total 3, earned 0-3). */
  stars: StarSlots;
  /** True when the achievement is complete: all stars in. Used for the
   * row's quiet completed treatment (no open star markers, full rail). */
  isComplete: boolean;
}

/** The display data for one achievement row. */
export function achievementProgress(input: {
  value: number;
  target: number;
  stars: number;
}): AchievementProgress {
  const stars = starSlots(input.stars);
  const fill = railFill(input.value, input.target);
  return {
    fill,
    stars,
    isComplete: stars.earned >= ACHIEVEMENT_MAX_STARS,
  };
}

/** The value/target pair the row renders beside the rail, "7,139 / 500":
 * tabular-friendly integers, thousands separated, the value the player
 * holds over the target that completes the achievement. Values past the
 * target render as-is (the game keeps counting); the rail caps its fill,
 * the pair never lies about the number. */
export function formatProgressPair(value: number, target: number): string {
  return `${formatInteger(value)} / ${formatInteger(target)}`;
}

/** An integer with thousands separators, the way the game renders its own
 * counters. No decimals: achievement counters are whole numbers. */
function formatInteger(value: number): string {
  return Math.round(Math.max(0, value)).toLocaleString('en-US');
}

// ---------- village grouping ----------

// The grouping rule lives in lib/village.ts now: the hero card (T-M2-4)
// groups village-marked rows with the identical first-appearance-order
// rule the achievements card established, and the progression grid (T-M2-5)
// will too, so the rule has exactly one owner. The re-export below keeps
// the achievements card's imports unchanged.

export { groupByVillage as groupAchievementsByVillage } from './village';

import type { VillageGroup } from './village';

/** The achievements card's village group: the shared group type with its
 * rows typed to the parsed achievement shape (a type-only import, so the
 * module still has no runtime dependency on the client). */
export type AchievementGroup = VillageGroup<PlayerAchievement>;
