// The progression grid adapter (T-M2-5, FR-16, SR-16).
//
// The progression grid renders every non-hero unit of both villages with its
// icon, current level, and a maxed chip, grouped by village and category.
// Heroes have their own dedicated HeroCard section on the player screen, so
// the progression grid excludes the `heroes` array and splits the remaining
// inventory into five distinct categories: troops, spells, equipments, pets,
// and siege. The grid reads entirely from the same single GET /api/player/:tag
// response the shell already fetched (SR-16): no second call, no second
// loading state, and no network request beyond the player fetch (AC-07).
//
// The adapter here is the bridge between the player payload and the grid's
// render shape: it re-buckets the payload's three non-hero unit arrays
// (troops, spells, heroEquipment) into the five categories, groups them by
// village, and produces one flat list of tiles the grid can render. The
// adapter is pure (no React, no network), the same split the rushed engine
// keeps (STD-09): the rule lives here, the tile and the grid own only the
// paint.
//
// Categorization reuses the rushed engine's reference lists (SIEGE_MACHINE_NAMES,
// PET_NAMES) so the grid and the rushed analysis never disagree about which
// units are siege machines or pets. Super troops are kept in the grid (the
// player can see which super troops are active), where the rushed engine
// drops them (a super troop's level is the boosted variant's scale, not the
// real lab level). The grid is an inventory view; the rushed analysis is a
// verdict.

import type { PlayerUnit, PlayerResponse } from '../api/player';
import {
  SIEGE_MACHINE_NAMES,
  PET_NAMES,
} from '../engines/rushed';

/** The five categories the progression grid groups by (heroes live in their
 * own dedicated HeroCard section). */
export type ProgressionCategory = 'troops' | 'spells' | 'equipments' | 'pets' | 'siege';

/** Display labels for the progression category groups. */
export const PROGRESSION_CATEGORY_LABELS: Record<ProgressionCategory, string> = {
  troops: 'Troops',
  spells: 'Spells',
  equipments: 'Equipments',
  pets: 'Pets',
  siege: 'Siege',
};

/** The order categories render in within each village. */
const CATEGORY_ORDER: ReadonlyArray<ProgressionCategory> = [
  'troops',
  'spells',
  'equipments',
  'pets',
  'siege',
];

/**
 * One tile in the progression grid. Carries everything the tile needs to
 * render: the unit name (for the icon lookup and the accessibility label),
 * the current level, the maxLevel (null when the API has not caught up to
 * brand-new content), the category, and the village.
 *
 * The maxed-for-Town-Hall chip is not on the tile: that indicator comes
 * from the bundled Town Hall cap tables (T-M2-6), which are not bundled yet.
 * Until T-M2-6 ships, the tile renders the level/maxLevel pair (the global
 * maximum the API reports) and a "maxed" chip when level >= maxLevel. When
 * T-M2-6 lands, the tile gains a `maxedForTownHall` boolean the reference
 * table computes, and the chip switches to read it. The tile's shape is
 * designed so that change is a new field, not a rewrite.
 */
export interface ProgressionTile {
  name: string;
  level: number;
  maxLevel: number | null;
  category: ProgressionCategory;
  /** The village marker from the payload ("home", "builderBase"). */
  village: string;
}

/**
 * One village's block of tiles, grouped by category. The grid renders one
 * village section per group, with a quiet category header above each
 * category block.
 */
export interface ProgressionVillageGroup {
  village: string;
  /** The display label ("Home Village", "Builder Base"). */
  label: string;
  /** Category blocks in render order; a category with no tiles is omitted. */
  categories: ProgressionCategoryBlock[];
}

export interface ProgressionCategoryBlock {
  category: ProgressionCategory;
  /** The display label ("Troops", "Spells"). */
  label: string;
  tiles: ProgressionTile[];
}

/**
 * Converts the player payload's non-hero unit arrays into the village-grouped,
 * category-blocked tiles the progression grid renders. Pure: the input
 * arrays are untouched, a fresh group array comes back.
 *
 * Super troops are kept (the grid is an inventory view), unlike the rushed
 * engine which drops them. Siege machines and pets are routed into their own
 * siege and pets categories using the rushed engine's reference lists, so the
 * two views agree on unit identities. Builder-base troops are kept (the grid
 * shows both villages, unlike the rushed analysis which is home-village only).
 * Hero equipment from the flat `heroEquipment` array is routed into the
 * equipments category, while heroes themselves are omitted because the
 * HeroCard section already displays them.
 */
export function playerToProgressionTiles(player: PlayerResponse): ProgressionVillageGroup[] {
  const tiles = collectTiles(player);
  return groupTilesByVillage(tiles);
}

// ---------- internal: collect tiles from the three non-hero arrays ----------

function collectTiles(player: PlayerResponse): ProgressionTile[] {
  const tiles: ProgressionTile[] = [];

  const troops = player.troops ?? [];
  const spells = player.spells ?? [];
  const heroEquipment = player.heroEquipment ?? [];

  for (const unit of troops) {
    const category = categorizeTroop(unit.name);
    tiles.push(toTile(unit, category));
  }

  for (const unit of spells) {
    tiles.push(toTile(unit, 'spells'));
  }

  for (const unit of heroEquipment) {
    tiles.push(toTile(unit, 'equipments'));
  }

  return tiles;
}

/** Routes a troops-array unit into troops, pets, or siege using the rushed
 * engine's reference lists, so the grid and the rushed analysis agree. */
function categorizeTroop(name: string): ProgressionCategory {
  if (SIEGE_MACHINE_NAMES.has(name)) {
    return 'siege';
  }
  if (PET_NAMES.has(name)) {
    return 'pets';
  }
  return 'troops';
}

function toTile(unit: PlayerUnit, category: ProgressionCategory): ProgressionTile {
  return {
    name: unit.name,
    level: unit.level,
    maxLevel: unit.maxLevel,
    category,
    village: unit.village,
  };
}

// ---------- internal: group by village, then by category ----------

function groupTilesByVillage(tiles: ProgressionTile[]): ProgressionVillageGroup[] {
  // First-appearance order for villages (home first on every payload
  // observed), the same rule lib/village.ts keeps for the achievements and
  // heroes cards. Re-implemented here rather than imported because the grid
  // needs a second grouping level (category inside village) the village
  // helper does not carry.
  const groups: ProgressionVillageGroup[] = [];
  const byVillage = new Map<string, ProgressionVillageGroup>();

  for (const tile of tiles) {
    let group = byVillage.get(tile.village);
    if (!group) {
      group = {
        village: tile.village,
        label: villageLabelFor(tile.village),
        categories: [],
      };
      byVillage.set(tile.village, group);
      groups.push(group);
    }
    addTileToCategory(group, tile);
  }

  return groups;
}

function addTileToCategory(group: ProgressionVillageGroup, tile: ProgressionTile): void {
  let block = group.categories.find((b) => b.category === tile.category);
  if (!block) {
    block = {
      category: tile.category,
      label: PROGRESSION_CATEGORY_LABELS[tile.category],
      tiles: [],
    };
    group.categories.push(block);
    // Keep the categories in render order, not insertion order, so a
    // payload whose troops appear after heroes still renders troops first.
    group.categories.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  }
  block.tiles.push(tile);
}

// The same quiet labels the village rule keeps (lib/village.ts), inlined
// here so the grid does not depend on the achievements card's helper. A
// shared module would be over-engineering for two labels; if a third
// consumer appears, promote to lib/village.ts.
function villageLabelFor(village: string): string {
  if (village === 'home') return 'Home Village';
  if (village === 'builderBase') return 'Builder Base';
  if (village === 'clanCapital') return 'Clan Capital';
  return village;
}
