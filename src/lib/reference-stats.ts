// Game reference and cap aggregation helpers (STD-09).
//
// Pure TypeScript: no React, no network, no clock. Aggregates data from
// town-hall-caps, rushed engine super-troop mappings, and league-tier tables
// to provide instant, zero-cost reference metrics for the Home and Players screens.

import {
  BUILDER_CAP_MAX_HALL,
  BUILDER_HERO_CAPS,
  BUILDER_TROOP_CAPS,
  HOME_CAP_MAX_TOWN_HALL,
  HOME_EQUIPMENT_CAPS,
  HOME_HERO_CAPS,
  HOME_PET_CAPS,
  HOME_SIEGE_CAPS,
  HOME_SPELL_CAPS,
  HOME_TROOP_CAPS,
  homeCapAtTownHall,
  homeReferenceMax,
} from './town-hall-caps';
import { SUPER_TROOP_MAP } from '../engines/rushed';
import { RANKED_LEAGUE_TIER_MAX } from '../api/league-tiers';

export interface GlobalReferenceSummary {
  readonly maxTownHall: number;
  readonly maxBuilderHall: number;
  readonly homeTroopsCount: number;
  readonly builderTroopsCount: number;
  readonly spellsCount: number;
  readonly siegesCount: number;
  readonly petsCount: number;
  readonly homeHeroesCount: number;
  readonly builderHeroesCount: number;
  readonly equipmentCount: number;
  readonly totalUnitsAndGearCount: number;
  readonly superTroopsCount: number;
  readonly rankedLeagueTiersCount: number;
}

export interface HeroCapEntry {
  readonly name: string;
  readonly cap: number;
  readonly unlocked: boolean;
  readonly maxPossible: number;
}

export interface TownHallCapSummary {
  readonly townHall: number;
  readonly heroes: readonly HeroCapEntry[];
  readonly totalHeroLevels: number;
  readonly maxHeroLevelsPossible: number;
  readonly unlockedTroopsCount: number;
  readonly totalTroopLevels: number;
  readonly unlockedSpellsCount: number;
  readonly totalSpellLevels: number;
  readonly unlockedSiegesCount: number;
  readonly totalSiegeLevels: number;
  readonly unlockedPetsCount: number;
  readonly totalPetLevels: number;
  readonly unlockedEquipmentCount: number;
  readonly totalEquipmentLevels: number;
  readonly totalLabLevels: number;
}

const HOME_HERO_NAMES: readonly string[] = [
  'Barbarian King',
  'Archer Queen',
  'Minion Prince',
  'Grand Warden',
  'Royal Champion',
  'Dragon Duke',
];

/**
 * Computes high-level counts and totals across the entire bundled reference data set.
 */
export function getGlobalReferenceSummary(): GlobalReferenceSummary {
  const homeTroopsCount = Object.keys(HOME_TROOP_CAPS).length;
  const builderTroopsCount = Object.keys(BUILDER_TROOP_CAPS).length;
  const spellsCount = Object.keys(HOME_SPELL_CAPS).length;
  const siegesCount = Object.keys(HOME_SIEGE_CAPS).length;
  const petsCount = Object.keys(HOME_PET_CAPS).length;
  const homeHeroesCount = Object.keys(HOME_HERO_CAPS).length;
  const builderHeroesCount = Object.keys(BUILDER_HERO_CAPS).length;
  const equipmentCount = Object.keys(HOME_EQUIPMENT_CAPS).length;

  const totalUnitsAndGearCount =
    homeTroopsCount +
    builderTroopsCount +
    spellsCount +
    siegesCount +
    petsCount +
    homeHeroesCount +
    builderHeroesCount +
    equipmentCount;

  return {
    maxTownHall: HOME_CAP_MAX_TOWN_HALL,
    maxBuilderHall: BUILDER_CAP_MAX_HALL,
    homeTroopsCount,
    builderTroopsCount,
    spellsCount,
    siegesCount,
    petsCount,
    homeHeroesCount,
    builderHeroesCount,
    equipmentCount,
    totalUnitsAndGearCount,
    superTroopsCount: Object.keys(SUPER_TROOP_MAP).length,
    rankedLeagueTiersCount: RANKED_LEAGUE_TIER_MAX,
  };
}

function sumCategoryCaps(
  capsTable: Readonly<Record<string, ReadonlyArray<number>>>,
  townHall: number,
): { count: number; totalLevels: number } {
  const thIndex = Math.min(Math.max(1, Math.floor(townHall)), HOME_CAP_MAX_TOWN_HALL) - 1;
  let count = 0;
  let totalLevels = 0;

  for (const row of Object.values(capsTable)) {
    const val = row[thIndex] ?? 0;
    if (val > 0) {
      count++;
      totalLevels += val;
    }
  }

  return { count, totalLevels };
}

/**
 * Computes cap totals, hero level limits, and unlocked counts for a specific Town Hall level.
 */
export function getTownHallCapSummary(townHallInput: number): TownHallCapSummary {
  const townHall = Math.min(Math.max(1, Math.floor(townHallInput)), HOME_CAP_MAX_TOWN_HALL);

  const heroes: HeroCapEntry[] = HOME_HERO_NAMES.map((name) => {
    const cap = homeCapAtTownHall(name, townHall) ?? 0;
    const maxPossible = homeReferenceMax(name) ?? 0;
    return {
      name,
      cap,
      unlocked: cap > 0,
      maxPossible,
    };
  });

  const totalHeroLevels = heroes.reduce((sum, h) => sum + h.cap, 0);
  const maxHeroLevelsPossible = heroes.reduce((sum, h) => sum + h.maxPossible, 0);

  const troops = sumCategoryCaps(HOME_TROOP_CAPS, townHall);
  const spells = sumCategoryCaps(HOME_SPELL_CAPS, townHall);
  const sieges = sumCategoryCaps(HOME_SIEGE_CAPS, townHall);
  const pets = sumCategoryCaps(HOME_PET_CAPS, townHall);
  const equipment = sumCategoryCaps(HOME_EQUIPMENT_CAPS, townHall);

  return {
    townHall,
    heroes,
    totalHeroLevels,
    maxHeroLevelsPossible,
    unlockedTroopsCount: troops.count,
    totalTroopLevels: troops.totalLevels,
    unlockedSpellsCount: spells.count,
    totalSpellLevels: spells.totalLevels,
    unlockedSiegesCount: sieges.count,
    totalSiegeLevels: sieges.totalLevels,
    unlockedPetsCount: pets.count,
    totalPetLevels: pets.totalLevels,
    unlockedEquipmentCount: equipment.count,
    totalEquipmentLevels: equipment.totalLevels,
    totalLabLevels: troops.totalLevels + spells.totalLevels + sieges.totalLevels,
  };
}
