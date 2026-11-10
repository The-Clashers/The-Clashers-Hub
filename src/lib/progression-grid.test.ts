import { describe, expect, it } from 'vitest';
import {
  playerToProgressionTiles,
  PROGRESSION_CATEGORY_LABELS,
} from './progression-grid';
import type { PlayerResponse } from '../api/player';

// The progression grid adapter is pure (STD-09): the player payload goes
// in, the village-grouped category-blocked tiles come out. The tests cover
// the four concerns the adapter owns: categorization, village grouping,
// the flat heroEquipment inventory, and the empty-payload floor.

function makePlayer(overrides: Partial<PlayerResponse> = {}): PlayerResponse {
  return {
    tag: '#TEST',
    name: 'Test',
    townHallLevel: 14,
    expLevel: 100,
    age: 0,
    ...overrides,
  };
}

describe('playerToProgressionTiles categorization', () => {
  it('routes siege machines and pets into separate siege and pets categories', () => {
    const player = makePlayer({
      troops: [
        { name: 'Barbarian', level: 10, maxLevel: 12, village: 'home' },
        { name: 'Wall Wrecker', level: 4, maxLevel: 6, village: 'home' },
        { name: 'L.A.S.S.I', level: 10, maxLevel: 15, village: 'home' },
      ],
    });
    const groups = playerToProgressionTiles(player);
    const home = groups.find((g) => g.village === 'home')!;
    const categories = home.categories.map((c) => c.category);
    expect(categories).toEqual(['troops', 'pets', 'siege']);
    const pets = home.categories.find((c) => c.category === 'pets')!;
    expect(pets.tiles.map((t) => t.name)).toEqual(['L.A.S.S.I']);
    const siege = home.categories.find((c) => c.category === 'siege')!;
    expect(siege.tiles.map((t) => t.name)).toEqual(['Wall Wrecker']);
    const troops = home.categories.find((c) => c.category === 'troops')!;
    expect(troops.tiles.map((t) => t.name)).toEqual(['Barbarian']);
  });

  it('keeps super troops in the grid (the grid is an inventory view)', () => {
    const player = makePlayer({
      troops: [
        { name: 'Valkyrie', level: 8, maxLevel: 8, village: 'home' },
        { name: 'Super Valkyrie', level: 1, maxLevel: 12, village: 'home' },
      ],
    });
    const groups = playerToProgressionTiles(player);
    const troops = groups[0].categories.find((c) => c.category === 'troops')!;
    expect(troops.tiles.map((t) => t.name)).toEqual(['Valkyrie', 'Super Valkyrie']);
  });

  it('routes spells into the spells category', () => {
    const player = makePlayer({
      spells: [
        { name: 'Lightning Spell', level: 9, maxLevel: 12, village: 'home' },
        { name: 'Rage Spell', level: 5, maxLevel: 8, village: 'home' },
      ],
    });
    const groups = playerToProgressionTiles(player);
    const spells = groups[0].categories.find((c) => c.category === 'spells')!;
    expect(spells.tiles.map((t) => t.name)).toEqual(['Lightning Spell', 'Rage Spell']);
  });

  it('omits heroes from the progression grid because they have their own HeroCard section', () => {
    const player = makePlayer({
      heroes: [
        { name: 'Barbarian King', level: 80, maxLevel: 80, village: 'home' },
        { name: 'Battle Machine', level: 30, maxLevel: 35, village: 'builderBase' },
      ],
    });
    const groups = playerToProgressionTiles(player);
    expect(groups).toEqual([]);
  });

  it('routes the flat heroEquipment array into the equipments category', () => {
    const player = makePlayer({
      heroEquipment: [
        { name: 'Giant Gauntlet', level: 20, maxLevel: 27, village: 'home' },
        { name: 'Snake Bracelet', level: 12, maxLevel: 27, village: 'home' },
      ],
    });
    const groups = playerToProgressionTiles(player);
    const equipments = groups[0].categories.find((c) => c.category === 'equipments')!;
    expect(equipments.label).toBe('Equipments');
    expect(equipments.tiles.map((t) => t.name)).toEqual(['Giant Gauntlet', 'Snake Bracelet']);
  });
});

describe('playerToProgressionTiles village grouping', () => {
  it('groups by village in first-appearance order', () => {
    const player = makePlayer({
      troops: [
        { name: 'Barbarian', level: 10, maxLevel: 12, village: 'home' },
        { name: 'Raged Barbarian', level: 18, maxLevel: 20, village: 'builderBase' },
        { name: 'Archer', level: 9, maxLevel: 12, village: 'home' },
      ],
    });
    const groups = playerToProgressionTiles(player);
    expect(groups.map((g) => g.village)).toEqual(['home', 'builderBase']);
  });

  it('renders the display label for each village', () => {
    const player = makePlayer({
      troops: [
        { name: 'Barbarian', level: 10, maxLevel: 12, village: 'home' },
        { name: 'Raged Barbarian', level: 18, maxLevel: 20, village: 'builderBase' },
      ],
    });
    const groups = playerToProgressionTiles(player);
    expect(groups.map((g) => g.label)).toEqual(['Home Village', 'Builder Base']);
  });

  it('renders categories in the fixed order regardless of payload order', () => {
    const player = makePlayer({
      heroEquipment: [{ name: 'Giant Gauntlet', level: 20, maxLevel: 27, village: 'home' }],
      troops: [
        { name: 'Wall Wrecker', level: 4, maxLevel: 6, village: 'home' },
        { name: 'L.A.S.S.I', level: 10, maxLevel: 15, village: 'home' },
        { name: 'Barbarian', level: 10, maxLevel: 12, village: 'home' },
      ],
      spells: [{ name: 'Rage Spell', level: 5, maxLevel: 8, village: 'home' }],
    });
    const groups = playerToProgressionTiles(player);
    const categories = groups[0].categories.map((c) => c.category);
    expect(categories).toEqual(['troops', 'spells', 'equipments', 'pets', 'siege']);
  });
});

describe('playerToProgressionTiles edge cases', () => {
  it('returns an empty array when the payload carries no units', () => {
    const player = makePlayer({});
    const groups = playerToProgressionTiles(player);
    expect(groups).toEqual([]);
  });

  it('omits categories with no tiles', () => {
    const player = makePlayer({
      troops: [{ name: 'Barbarian', level: 10, maxLevel: 12, village: 'home' }],
    });
    const groups = playerToProgressionTiles(player);
    const categories = groups[0].categories.map((c) => c.category);
    expect(categories).toEqual(['troops']);
  });

  it('preserves the null maxLevel on the tile (the chip renders "Lv N")', () => {
    const player = makePlayer({
      troops: [{ name: 'Brand New Troop', level: 3, maxLevel: null, village: 'home' }],
    });
    const groups = playerToProgressionTiles(player);
    const tile = groups[0].categories[0].tiles[0];
    expect(tile.maxLevel).toBe(null);
  });

  it('does not mutate the input player', () => {
    const player = makePlayer({
      troops: [{ name: 'Barbarian', level: 10, maxLevel: 12, village: 'home' }],
    });
    const snapshot = JSON.parse(JSON.stringify(player));
    playerToProgressionTiles(player);
    expect(JSON.parse(JSON.stringify(player))).toEqual(snapshot);
  });
});

describe('PROGRESSION_CATEGORY_LABELS', () => {
  it('every category has a display label', () => {
    for (const key of ['troops', 'spells', 'equipments', 'pets', 'siege'] as const) {
      expect(PROGRESSION_CATEGORY_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});
