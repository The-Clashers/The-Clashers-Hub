// Hero panel math for the hero card (T-M2-4, FR-09).
//
// The card renders one row per hero: the name, the level-versus-maximum
// pair in tabular figures, a level rail without star markers, and the
// equipment the game API nests on the hero entry where it exposes it. The
// rail is a display surface, not a calculation: the fill and the maxed
// flag are pre-computed here so the render stays a lookup and the rules
// are testable without React (STD-09), the same split the achievements
// card keeps against lib/achievement-progress.
//
// The heroes' judgments are simpler than the achievements': a hero has no
// stars, only a level against a maximum, so the fill IS the progress and
// the maxed flag IS the verdict (a hero at its maximum is done in a way
// an achievement at 2 of 3 stars is not). The one tolerant case is the
// null maxLevel: brand-new content the API has not caught up to (SR-14's
// shape) renders its level alone with no rail and no pair, and the card
// counts such rows in a quiet footnote instead of inventing a maximum.

import type { PlayerHero } from '../api/player';

/** The rail's fill ratio, 0 to 1: the level over the maximum, clamped. A
 * level past the maximum (the API can lag a live upgrade) reads as a full
 * rail; so does a 0-maximum row, the tolerant floor for a malformed entry
 * (a rail that can never fill would read as broken, not empty). */
export function heroFill(level: number, maxLevel: number): number {
  if (maxLevel <= 0) return 1;
  return Math.min(1, Math.max(0, level / maxLevel));
}

/** One hero row's display data, everything the card renders except the
 * texts (name, equipment) it reads straight off the parsed entry. A
 * discriminated union on `hasMax`: the maxed branch carries the maximum
 * it judged against (so the row renders its pair off the display data,
 * never re-reading the raw entry), and the no-max branch carries the
 * level-only reading brand-new content gets. */
export type HeroProgress = HeroProgressWithMax | HeroProgressWithoutMax;

/** A hero whose entry exposes a maximum: the ordinary case. */
export interface HeroProgressWithMax {
  /** Discriminant: the entry carries a maximum. */
  hasMax: true;
  /** The rail fill, 0 to 1. */
  fill: number;
  /** True when the hero sits at its maximum: the row's quiet ledger
   * treatment (the same mute the completed achievement row takes). */
  isMaxed: boolean;
  /** The maximum the fill was judged against. */
  maxLevel: number;
}

/** A hero whose entry's maxLevel is null: brand-new content the API has
 * not caught up to. The row renders the level alone, no rail and no
 * pair, and the card footnotes the count instead of inventing a
 * maximum. */
export interface HeroProgressWithoutMax {
  /** Discriminant: no maximum exposed. */
  hasMax: false;
  fill: 0;
  isMaxed: false;
}

/** The display data for one hero row. */
export function heroProgress(
  hero: Pick<PlayerHero, 'level' | 'maxLevel'>,
): HeroProgress {
  if (hero.maxLevel === null) {
    return { hasMax: false, fill: 0, isMaxed: false };
  }
  return {
    hasMax: true,
    fill: heroFill(hero.level, hero.maxLevel),
    isMaxed: hero.level >= hero.maxLevel,
    maxLevel: hero.maxLevel,
  };
}

/** The level/maximum pair the row renders beside the rail, "87 / 110":
 * plain integers over each other, tabular-friendly. No thousands
 * separators and no decimals: hero levels top out in the low hundreds and
 * the pair is a scale, not a counter. */
export function formatLevelPair(level: number, maxLevel: number): string {
  return `${Math.round(Math.max(0, level))} / ${Math.round(Math.max(0, maxLevel))}`;
}
