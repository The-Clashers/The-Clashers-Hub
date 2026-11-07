// Achievement progress math for the achievements card (T-M2-3, FR-08).
//
// The card renders one row per achievement: the name, the requirement text,
// a value/target progress rail with star markers, and the stars the player
// holds. The rail is a display surface, not a calculation: the fill and the
// star slots are pre-computed here so the render stays a lookup and the
// rules are testable without React (STD-09), the same split RatioFlag keeps
// against lib/donation-balance.

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

// The quiet labels the card renders above each group. The three villages
// the game API names today plus the tolerant floor: an unknown marker
// renders as itself, so a new village the API invents still gets a header
// instead of being dropped or lumped into home.
const VILLAGE_LABELS: Readonly<Record<string, string>> = {
  home: 'Home Village',
  builderBase: 'Builder Base',
  clanCapital: 'Clan Capital',
};

/** One village's block in the card: the header label and the rows in API
 * order. The row type is the parsed api shape (a type-only import, so the
 * module still has no runtime dependency on the client). */
export interface AchievementGroup {
  /** The raw village marker from the payload ("home", "builderBase",
   * "clanCapital"). */
  village: string;
  /** The display label ("Home Village", "Builder Base", "Clan Capital"). */
  label: string;
  /** The group's rows in API order. */
  rows: ReadonlyArray<PlayerAchievement>;
}

/** Groups the achievements by village for the card. The live payload
 * interleaves villages (home, then builder base, then home again, then clan
 * capital), and a flat render would mix them; grouping puts every row under
 * its own quiet header. Groups keep first-appearance order (home first on
 * every payload observed), rows keep API order inside their group, and the
 * input is never mutated. */
export function groupAchievementsByVillage(
  achievements: ReadonlyArray<PlayerAchievement>,
): AchievementGroup[] {
  const groups: AchievementGroup[] = [];
  const byVillage = new Map<string, AchievementGroup>();
  for (const achievement of achievements) {
    let group = byVillage.get(achievement.village);
    if (!group) {
      group = {
        village: achievement.village,
        label: VILLAGE_LABELS[achievement.village] ?? achievement.village,
        rows: [],
      };
      byVillage.set(achievement.village, group);
      groups.push(group);
    }
    (group.rows as PlayerAchievement[]).push(achievement);
  }
  return groups;
}
