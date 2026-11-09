// The rushed analysis engine (T-M2-2, FR-07, SR-14, NFR-07).
//
// The flagship engine. Answers "how developed is this account really, behind
// the Town Hall badge?" (UR-03) by computing an overall rushed percentage,
// a per-category breakdown, and a top-deficits list ("what to upgrade
// next"), with super-troop levels normalized against their base troop so a
// boosted variant never fakes a deficit.
//
// Pure TypeScript: no React, no network, no clock (05 section 1, STD-09).
// Data in, judgment out. That is what makes it table-driven-testable to
// 90%+ coverage (NFR-07) and reusable on any player payload that carries the
// unit arrays the engine reads.
//
// Architecture (05 section 1 "Grouping is an adapter's job"):
//
// - The engine CORE consumes generic UnitLevelEntry rows and produces the
//   verdict. It never sees the raw payload shape.
// - The ADAPTER re-buckets the player payload's arrays (troops, spells,
//   heroes, heroEquipment) into the four categories the analysis groups by
//   (troops, spells, heroes, petsSiege). It also normalizes super troops:
//   every super troop entry is dropped, because its base troop entry (which
//   always coexists in the same array) carries the player's real lab level.
//   The super-troop map is data, not logic.
//
// The formula (05 section 1):
//
//   rushed_percent = sum( max(0, maxLevel - level) ) / sum( maxLevel ) * 100
//
// with equal weights. A unit with a null maxLevel falls back to the
// reference table's maximum (SR-17, wired in the adapter); only a unit
// absent from both the payload and the reference bundle is skipped and
// counted in a footnote (SR-14). A payload with zero usable units returns
// null ("not available") rather than 0.

import type { PlayerUnit } from '../api/player';
import { homeReferenceMax } from '../lib/town-hall-caps';

// ---------- reference data: the super-troop map ----------
//
// Reference data version: the game as of November 2026, 17 super troops.
// Updating the map is a docs-sized PR whenever the game ships a new
// boost; the completeness test over the live payload roster fails loudly
// first.

/**
 * Maps every super troop name to its base troop name (05 section 1). A super
 * troop is a temporary boosted variant of a regular troop, and the API
 * reports it on the variant's own scale: a player with a level-12 Valkyrie
 * who activates Super Valkyrie suddenly shows "Super Valkyrie 1/12", which
 * reads as an 11-level deficit that does not exist. The adapter drops every
 * super troop entry; the base troop entry (which always coexists, because
 * the game requires the base troop to unlock the super) carries the real
 * level.
 *
 * The list is trued against the dataset the reference bundle derives from
 * (T-M2-6): every super troop the game API can name today, mapped to the
 * base troop the game itself records for it. Completeness is enforced by a
 * unit test over the live payload's roster and the cap tables' troop list
 * so a new super troop cannot silently fake someone's rushed score.
 */
export const SUPER_TROOP_MAP: Readonly<Record<string, string>> = {
  'Super Barbarian': 'Barbarian',
  'Super Archer': 'Archer',
  'Super Giant': 'Giant',
  'Sneaky Goblin': 'Goblin',
  'Super Wall Breaker': 'Wall Breaker',
  'Rocket Balloon': 'Balloon',
  'Super Wizard': 'Wizard',
  'Super Witch': 'Witch',
  'Super Valkyrie': 'Valkyrie',
  // The game records Inferno Dragon as Baby Dragon's variant (it arrived
  // with Baby Dragon's ladder; its live maxLevel 12 matches Baby Dragon's
  // 12, not Dragon's 13). Mapping it to Dragon inflated the dragon deficit
  // for every player running the boost.
  'Inferno Dragon': 'Baby Dragon',
  'Super Dragon': 'Dragon',
  'Ice Hound': 'Lava Hound',
  'Super Miner': 'Miner',
  'Super Minion': 'Minion',
  'Super Bowler': 'Bowler',
  'Super Hog Rider': 'Hog Rider',
  'Super Yeti': 'Yeti',
};

/** True when the unit name is a super troop variant. */
export function isSuperTroop(name: string): boolean {
  return name in SUPER_TROOP_MAP;
}

/**
 * The siege machine names, bundled as reference data (05 section 1). The
 * game API mixes siege machines into the `troops` array without a category
 * tag, so the adapter needs this list to route them into the petsSiege
 * category instead of the troops category.
 */
export const SIEGE_MACHINE_NAMES: ReadonlySet<string> = new Set([
  'Wall Wrecker',
  'Battle Blimp',
  'Stone Slammer',
  'Siege Barracks',
  'Log Launcher',
  'Flame Flinger',
  'Battle Drill',
  'Sky Wagon',
  // The newest siege machine; the live payload carries it and the cap
  // tables list it (T-M2-6). Without it the adapter routed the row into
  // the troops category.
  'Troop Launcher',
]);

/**
 * The pet names, bundled as reference data (05 section 1). Pets are mixed
 * into the `troops` array too; this list routes them into the petsSiege
 * category.
 */
export const PET_NAMES: ReadonlySet<string> = new Set([
  'L.A.S.S.I',
  'Mighty Yak',
  'Electro Owl',
  'Unicorn',
  'Phoenix',
  'Poison Lizard',
  'Diggy',
  'Frosty',
  'Spirit Fox',
  'Angry Jelly',
  'Sneezy',
  'Greedy Raven',
]);

// ---------- categories and entries ----------

/** The four categories the rushed analysis groups by (05 section 1). */
export type RushedCategory = 'troops' | 'spells' | 'heroes' | 'petsSiege';

/** Display labels for the category breakdown. */
export const RUSHED_CATEGORY_LABELS: Record<RushedCategory, string> = {
  troops: 'Troops',
  spells: 'Spells',
  heroes: 'Heroes',
  petsSiege: 'Pets & Siege',
};

/**
 * The generic entry the engine core consumes (05 section 1 "Grouping is an
 * adapter's job"). Structural so the adapter and the test fixtures both
 * satisfy it without the engine importing the API client.
 */
export interface UnitLevelEntry {
  name: string;
  level: number;
  /** The unit's global maximum level. Null when the API omits it; the engine
   * skips null-maxLevel entries and counts them in the footnote (SR-14). */
  maxLevel: number | null;
  category: RushedCategory;
}

// ---------- verdict types ----------

/** One unit's contribution to the rushed score. */
export interface UnitDeficit {
  name: string;
  level: number;
  maxLevel: number;
  /** maxLevel - level, clamped to 0. The deficit the formula sums. */
  deficit: number;
  category: RushedCategory;
}

/** The per-category breakdown row. */
export interface RushedCategoryBreakdown {
  category: RushedCategory;
  /** The rushed percentage for this category, 0 to 100. */
  percent: number;
  unitsCounted: number;
  unitsMaxed: number;
}

/** The interpretation band the overall percentage falls into (05 section 1). */
export type RushedBand = 'maxed' | 'core' | 'light' | 'rushed' | 'heavy';

/** Display labels for the bands (05 section 1 "display copy, not judgments
 * of humans"). */
export const RUSHED_BAND_LABELS: Record<RushedBand, string> = {
  maxed: 'Maxed',
  core: 'Core',
  light: 'Light',
  rushed: 'Rushed',
  heavy: 'Heavy',
};

/** The full engine output (05 section 1 "Output"). */
export interface RushedVerdict {
  /** Overall rushed percentage, 0 to 100. Null when no usable units (the
   * engine returns "not available" rather than a misleading 0). */
  overallPercent: number | null;
  /** The interpretation band the overall percentage falls into. Null when
   * no usable units. */
  band: RushedBand | null;
  /** Per-category breakdown, one row per category that has at least one
   * usable unit. */
  categories: RushedCategoryBreakdown[];
  /** The top-N largest deficits, worst first. Empty when the account is
   * maxed (AC-04). */
  topDeficits: UnitDeficit[];
  /** How many units the engine counted (non-null maxLevel, home village). */
  unitsCounted: number;
  /** How many of those are maxed (level >= maxLevel). */
  unitsMaxed: number;
  /** How many units were skipped (null maxLevel, counted in the footnote). */
  unitsSkipped: number;
  /** The names of the skipped units, for the "new content skipped" footnote
   * (SR-14). */
  skippedNames: string[];
}

// ---------- the adapter ----------

/**
 * Converts the player payload's unit arrays into the generic entries the
 * engine core consumes. The adapter owns three concerns so the engine core
 * never depends on payload shape details:
 *
 * - Village filter: only home-village units enter the rushed analysis (05
 *   section 1 "Villages are separate"). Builder-base units are dropped.
 * - Super-troop normalization: every super troop entry is dropped; its base
 *   troop entry (which always coexists) carries the real lab level.
 * - Categorization: the troops array is split into troops, petsSiege (siege
 *   machines + pets) using the bundled reference lists; spells and heroes
 *   keep their own categories; hero equipment is counted as heroes.
 *
 * Pure: the input arrays are untouched, a fresh entry array comes back.
 */
export function playerToUnitEntries(
  troops: readonly PlayerUnit[] = [],
  spells: readonly PlayerUnit[] = [],
  heroes: readonly PlayerUnit[] = [],
  heroEquipment: readonly PlayerUnit[] = [],
): UnitLevelEntry[] {
  const entries: UnitLevelEntry[] = [];

  const withFallback = (unit: PlayerUnit, category: RushedCategory): UnitLevelEntry => ({
    name: unit.name,
    level: unit.level,
    // SR-17: the API's own maxLevel stays the primary denominator; the
    // reference table resolves only a null (brand-new content the API has
    // not caught up to). A unit absent from both stays null and the core
    // counts it in the footnote.
    maxLevel: unit.maxLevel ?? homeReferenceMax(unit.name),
    category,
  });

  for (const unit of troops) {
    if (unit.village !== 'home') continue;
    if (isSuperTroop(unit.name)) continue;
    const category: RushedCategory =
      SIEGE_MACHINE_NAMES.has(unit.name) || PET_NAMES.has(unit.name)
        ? 'petsSiege'
        : 'troops';
    entries.push(withFallback(unit, category));
  }

  for (const unit of spells) {
    if (unit.village !== 'home') continue;
    entries.push(withFallback(unit, 'spells'));
  }

  for (const unit of heroes) {
    if (unit.village !== 'home') continue;
    entries.push(withFallback(unit, 'heroes'));
  }

  // Hero equipment is counted in the heroes category (05 section 1 lists
  // hero equipment as part of the analysis; the progression grid (FR-16)
  // names it explicitly).
  for (const unit of heroEquipment) {
    if (unit.village !== 'home') continue;
    entries.push(withFallback(unit, 'heroes'));
  }

  return entries;
}

// ---------- the engine core ----------

/** How many deficits the top-deficits list carries (05 section 1 "top-N"). */
const TOP_DEFICITS_LIMIT = 10;

/** A unit entry with a confirmed non-null maxLevel; what the engine core
 * actually computes over after the adapter skips null-maxLevel entries. */
interface UsableEntry {
  name: string;
  level: number;
  maxLevel: number;
  category: RushedCategory;
}

/**
 * Computes the rushed analysis from generic unit entries. Pure: the input
 * array is untouched, the verdict is a fresh object, and the same entries
 * always yield the same verdict.
 *
 * Entries with a null maxLevel are skipped and counted in the footnote
 * (SR-14). The reference-data fallback (SR-17) plugs in with T-M2-6; the
 * engine is designed so that change is a maxLevel resolver passed to this
 * function, not a re-write of the core.
 */
export function computeRushed(entries: readonly UnitLevelEntry[]): RushedVerdict {
  const usable: UsableEntry[] = [];
  const skippedNames: string[] = [];

  for (const entry of entries) {
    if (entry.maxLevel === null || entry.maxLevel <= 0) {
      skippedNames.push(entry.name);
      continue;
    }
    usable.push({ name: entry.name, level: entry.level, maxLevel: entry.maxLevel, category: entry.category });
  }

  if (usable.length === 0) {
    return {
      overallPercent: null,
      band: null,
      categories: [],
      topDeficits: [],
      unitsCounted: 0,
      unitsMaxed: 0,
      unitsSkipped: skippedNames.length,
      skippedNames,
    };
  }

  let totalDeficit = 0;
  let totalMax = 0;
  let unitsMaxed = 0;
  const deficits: UnitDeficit[] = [];
  const byCategory = new Map<RushedCategory, { deficit: number; max: number; counted: number; maxed: number }>();

  for (const entry of usable) {
    const deficit = Math.max(0, entry.maxLevel - entry.level);
    totalDeficit += deficit;
    totalMax += entry.maxLevel;
    if (deficit === 0) unitsMaxed += 1;

    if (deficit > 0) {
      deficits.push({
        name: entry.name,
        level: entry.level,
        maxLevel: entry.maxLevel,
        deficit,
        category: entry.category,
      });
    }

    const bucket = byCategory.get(entry.category) ?? { deficit: 0, max: 0, counted: 0, maxed: 0 };
    bucket.deficit += deficit;
    bucket.max += entry.maxLevel;
    bucket.counted += 1;
    if (deficit === 0) bucket.maxed += 1;
    byCategory.set(entry.category, bucket);
  }

  const overallPercent = totalMax > 0 ? round1((totalDeficit / totalMax) * 100) : 0;

  const categoryOrder: RushedCategory[] = ['troops', 'spells', 'heroes', 'petsSiege'];
  const categories: RushedCategoryBreakdown[] = categoryOrder
    .filter((category) => byCategory.has(category))
    .map((category) => {
      const bucket = byCategory.get(category)!;
      return {
        category,
        percent: bucket.max > 0 ? round1((bucket.deficit / bucket.max) * 100) : 0,
        unitsCounted: bucket.counted,
        unitsMaxed: bucket.maxed,
      };
    });

  deficits.sort((a, b) => b.deficit - a.deficit || a.name.localeCompare(b.name));
  const topDeficits = deficits.slice(0, TOP_DEFICITS_LIMIT);

  return {
    overallPercent,
    band: bandFor(overallPercent),
    categories,
    topDeficits,
    unitsCounted: usable.length,
    unitsMaxed,
    unitsSkipped: skippedNames.length,
    skippedNames,
  };
}

/** Maps an overall percentage to the interpretation band (05 section 1). */
export function bandFor(percent: number | null): RushedBand | null {
  if (percent === null) return null;
  if (percent === 0) return 'maxed';
  if (percent < 5) return 'core';
  if (percent < 15) return 'light';
  if (percent < 30) return 'rushed';
  return 'heavy';
}

/** Rounds to one decimal place, the precision the display shows (07 section 5). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
