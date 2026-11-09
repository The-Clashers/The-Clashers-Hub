import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  bandFor,
  computeRushed,
  isSuperTroop,
  playerToUnitEntries,
  RUSHED_BAND_LABELS,
  RUSHED_CATEGORY_LABELS,
  SUPER_TROOP_MAP,
  type UnitLevelEntry,
} from './rushed';
import type { PlayerUnit } from '../api/player';

// Table-driven tests (NFR-07). The fixtures under fixtures/ are anonymized
// copies of real game-API payloads (SR-07, STD-12): real structure,
// placeholder names. Every edge case the scoring doc names is covered: a
// fully maxed account (expect 0% and an empty top-deficits list), a rushed
// account (expect a non-zero percentage and a populated top-deficits list),
// a fixture with active super troops (the super-troop entries are dropped
// so the base troop's real level is what the engine measures), and a
// fixture with null maxLevel entries (skipped and counted in the footnote).

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../../fixtures');

function loadFixture(name: string): {
  troops?: PlayerUnit[];
  spells?: PlayerUnit[];
  heroes?: PlayerUnit[];
  heroEquipment?: PlayerUnit[];
} {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf8'));
}

function entry(
  name: string,
  level: number,
  maxLevel: number | null,
  category: UnitLevelEntry['category'] = 'troops',
): UnitLevelEntry {
  return { name, level, maxLevel, category };
}

// ---------- super-troop map ----------

describe('SUPER_TROOP_MAP', () => {
  it('maps every super troop to its base troop', () => {
    expect(SUPER_TROOP_MAP['Super Barbarian']).toBe('Barbarian');
    expect(SUPER_TROOP_MAP['Sneaky Goblin']).toBe('Goblin');
    // The game records Inferno Dragon as Baby Dragon's variant: it arrived
    // with Baby Dragon's ladder and its live maxLevel (12) matches Baby
    // Dragon's, not Dragon's 13.
    expect(SUPER_TROOP_MAP['Inferno Dragon']).toBe('Baby Dragon');
    expect(SUPER_TROOP_MAP['Ice Hound']).toBe('Lava Hound');
  });

  it('carries no invented entries: every name exists in the game', () => {
    // The two names below were plausible-sounding fabrications the first
    // map shipped; the game has no such super troops, and a payload never
    // carries them. If a future payload does, this row fails and the name
    // earns its place.
    expect(SUPER_TROOP_MAP).not.toHaveProperty('Super Ice Hound');
    expect(SUPER_TROOP_MAP).not.toHaveProperty('Super Inferno Dragon');
  });

  it('is total over the live payload roster: every super-troop name the payload carries is a key', () => {
    // The completeness test the scoring doc demands (05 section 5): the
    // names below are every super troop the live proxy served during this
    // pass (17 names, a TH18 player with every boost the game runs today).
    const liveSuperTroops = [
      'Super Barbarian',
      'Super Archer',
      'Super Giant',
      'Sneaky Goblin',
      'Super Wall Breaker',
      'Rocket Balloon',
      'Super Wizard',
      'Super Witch',
      'Super Valkyrie',
      'Inferno Dragon',
      'Super Dragon',
      'Ice Hound',
      'Super Miner',
      'Super Minion',
      'Super Bowler',
      'Super Hog Rider',
      'Super Yeti',
    ];
    for (const name of liveSuperTroops) {
      expect(isSuperTroop(name), `${name} is not in the map`).toBe(true);
    }
  });

  it('every value is a non-empty string', () => {
    for (const [superName, baseName] of Object.entries(SUPER_TROOP_MAP)) {
      expect(baseName.length).toBeGreaterThan(0);
      expect(superName.length).toBeGreaterThan(0);
    }
  });
});

describe('isSuperTroop', () => {
  it('returns true for super troop names', () => {
    expect(isSuperTroop('Super Barbarian')).toBe(true);
    expect(isSuperTroop('Sneaky Goblin')).toBe(true);
  });

  it('returns false for base troop names and unknowns', () => {
    expect(isSuperTroop('Barbarian')).toBe(false);
    expect(isSuperTroop('Dragon')).toBe(false);
    expect(isSuperTroop('Brand New Troop')).toBe(false);
  });
});

// ---------- adapter ----------

describe('playerToUnitEntries', () => {
  it('converts the four unit arrays into categorized entries', () => {
    const entries = playerToUnitEntries(
      [{ name: 'Barbarian', level: 10, maxLevel: 14, village: 'home' }],
      [{ name: 'Rage Spell', level: 5, maxLevel: 8, village: 'home' }],
      [{ name: 'Barbarian King', level: 65, maxLevel: 90, village: 'home' }],
      [{ name: 'Giant Gauntlet', level: 18, maxLevel: 27, village: 'home' }],
    );
    expect(entries).toEqual([
      { name: 'Barbarian', level: 10, maxLevel: 14, category: 'troops' },
      { name: 'Rage Spell', level: 5, maxLevel: 8, category: 'spells' },
      { name: 'Barbarian King', level: 65, maxLevel: 90, category: 'heroes' },
      { name: 'Giant Gauntlet', level: 18, maxLevel: 27, category: 'heroes' },
    ]);
  });

  it('drops super troop entries (the base troop carries the real level)', () => {
    const entries = playerToUnitEntries(
      [
        { name: 'Valkyrie', level: 12, maxLevel: 12, village: 'home' },
        { name: 'Super Valkyrie', level: 1, maxLevel: 12, village: 'home' },
      ],
      [],
      [],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Valkyrie');
    expect(entries[0].level).toBe(12);
  });

  it('routes siege machines and pets into the petsSiege category', () => {
    const entries = playerToUnitEntries(
      [
        { name: 'Barbarian', level: 14, maxLevel: 14, village: 'home' },
        { name: 'Wall Wrecker', level: 6, maxLevel: 6, village: 'home' },
        { name: 'L.A.S.S.I', level: 15, maxLevel: 15, village: 'home' },
      ],
      [],
      [],
      [],
    );
    const byName = Object.fromEntries(entries.map((e) => [e.name, e.category]));
    expect(byName['Barbarian']).toBe('troops');
    expect(byName['Wall Wrecker']).toBe('petsSiege');
    expect(byName['L.A.S.S.I']).toBe('petsSiege');
  });

  it('drops builder-base units (the rushed analysis is home-village only)', () => {
    const entries = playerToUnitEntries(
      [
        { name: 'Barbarian', level: 14, maxLevel: 14, village: 'home' },
        { name: 'Raged Barbarian', level: 20, maxLevel: 20, village: 'builderBase' },
      ],
      [],
      [],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Barbarian');
  });

  it('handles empty arrays and undefined', () => {
    expect(playerToUnitEntries()).toEqual([]);
    expect(playerToUnitEntries([], [], [], [])).toEqual([]);
  });
});

// ---------- engine core: overall percentage ----------

describe('computeRushed overall percentage', () => {
  it('returns 0% for a maxed account', () => {
    const entries = [
      entry('Barbarian', 14, 14),
      entry('Archer', 14, 14),
      entry('Rage Spell', 8, 8, 'spells'),
      entry('Barbarian King', 90, 90, 'heroes'),
    ];
    const verdict = computeRushed(entries);
    expect(verdict.overallPercent).toBe(0);
    expect(verdict.band).toBe('maxed');
  });

  it('computes the weighted deficit percentage', () => {
    // 4 units, max 10 each, levels 10, 8, 6, 4.
    // deficit = 0 + 2 + 4 + 6 = 12, max = 40, percent = 30.0
    const entries = [
      entry('A', 10, 10),
      entry('B', 8, 10),
      entry('C', 6, 10),
      entry('D', 4, 10),
    ];
    const verdict = computeRushed(entries);
    expect(verdict.overallPercent).toBe(30);
    expect(verdict.band).toBe('heavy');
  });

  it('clamps individual deficits to 0 (level above max does not help)', () => {
    const entries = [
      entry('A', 12, 10), // over-leveled: deficit 0, not negative
      entry('B', 5, 10),  // deficit 5
    ];
    const verdict = computeRushed(entries);
    // deficit = 0 + 5 = 5, max = 20, percent = 25.0
    expect(verdict.overallPercent).toBe(25);
  });

  it('returns null when no usable units exist', () => {
    const verdict = computeRushed([]);
    expect(verdict.overallPercent).toBe(null);
    expect(verdict.band).toBe(null);
    expect(verdict.topDeficits).toEqual([]);
  });
});

// ---------- engine core: category breakdown ----------

describe('computeRushed category breakdown', () => {
  it('produces one row per category that has usable units', () => {
    const entries = [
      entry('Barbarian', 10, 14, 'troops'),
      entry('Archer', 14, 14, 'troops'),
      entry('Rage Spell', 5, 8, 'spells'),
      entry('Barbarian King', 90, 90, 'heroes'),
      entry('Wall Wrecker', 6, 6, 'petsSiege'),
    ];
    const verdict = computeRushed(entries);
    const categories = verdict.categories.map((c) => c.category);
    expect(categories).toEqual(['troops', 'spells', 'heroes', 'petsSiege']);
  });

  it('omits categories with no usable units', () => {
    const entries = [
      entry('Barbarian', 10, 14, 'troops'),
      entry('Rage Spell', 5, 8, 'spells'),
    ];
    const verdict = computeRushed(entries);
    const categories = verdict.categories.map((c) => c.category);
    expect(categories).toEqual(['troops', 'spells']);
  });

  it('computes the per-category percentage and counts', () => {
    const entries = [
      entry('Barbarian', 14, 14, 'troops'),
      entry('Archer', 10, 14, 'troops'),
      entry('Rage Spell', 8, 8, 'spells'),
    ];
    const verdict = computeRushed(entries);
    const troops = verdict.categories.find((c) => c.category === 'troops')!;
    // deficit = 0 + 4 = 4, max = 14 + 14 = 28, percent = 4/28*100 = 14.3
    expect(troops.percent).toBe(14.3);
    expect(troops.unitsCounted).toBe(2);
    expect(troops.unitsMaxed).toBe(1);
    const spells = verdict.categories.find((c) => c.category === 'spells')!;
    expect(spells.percent).toBe(0);
    expect(spells.unitsMaxed).toBe(1);
  });
});

// ---------- engine core: top deficits ----------

describe('computeRushed top deficits', () => {
  it('returns the deficits sorted worst-first', () => {
    const entries = [
      entry('A', 8, 10),  // deficit 2
      entry('B', 4, 10),  // deficit 6
      entry('C', 6, 10),  // deficit 4
    ];
    const verdict = computeRushed(entries);
    expect(verdict.topDeficits.map((d) => d.name)).toEqual(['B', 'C', 'A']);
  });

  it('limits to the top 10', () => {
    const entries: UnitLevelEntry[] = Array.from({ length: 15 }, (_, i) =>
      entry(`Unit${i}`, 1, 10),
    );
    const verdict = computeRushed(entries);
    expect(verdict.topDeficits).toHaveLength(10);
  });

  it('is empty when the account is maxed', () => {
    const entries = [
      entry('A', 10, 10),
      entry('B', 10, 10),
    ];
    const verdict = computeRushed(entries);
    expect(verdict.topDeficits).toEqual([]);
  });

  it('tie-breaks equal deficits by name', () => {
    const entries = [
      entry('Zoe', 5, 10),
      entry('Alf', 5, 10),
    ];
    const verdict = computeRushed(entries);
    expect(verdict.topDeficits.map((d) => d.name)).toEqual(['Alf', 'Zoe']);
  });
});

// ---------- engine core: null maxLevel ----------

describe('computeRushed null maxLevel', () => {
  it('skips entries with null maxLevel and counts them in the footnote', () => {
    const entries = [
      entry('Barbarian', 14, 14),
      entry('Brand New Troop', 3, null),
      entry('Another New Troop', 1, null),
    ];
    const verdict = computeRushed(entries);
    expect(verdict.unitsCounted).toBe(1);
    expect(verdict.unitsSkipped).toBe(2);
    expect(verdict.skippedNames).toEqual(['Brand New Troop', 'Another New Troop']);
  });

  it('skips entries with maxLevel 0 (defensive)', () => {
    const entries = [
      entry('Barbarian', 14, 14),
      entry('Glitch', 1, 0),
    ];
    const verdict = computeRushed(entries);
    expect(verdict.unitsCounted).toBe(1);
    expect(verdict.unitsSkipped).toBe(1);
  });
});

// ---------- engine core: bands ----------

describe('bandFor', () => {
  it.each([
    [0, 'maxed'],
    [4.9, 'core'],
    [5, 'light'],
    [14.9, 'light'],
    [15, 'rushed'],
    [29.9, 'rushed'],
    [30, 'heavy'],
    [50, 'heavy'],
  ] as const)('maps %s%% to the %s band', (percent, band) => {
    expect(bandFor(percent)).toBe(band);
  });

  it('returns null for null input', () => {
    expect(bandFor(null)).toBe(null);
  });
});

// ---------- fixture-driven tests (AC-04) ----------

describe('fixture: maxed-player.json', () => {
  const fixture = loadFixture('maxed-player.json');
  const entries = playerToUnitEntries(
    fixture.troops ?? [],
    fixture.spells ?? [],
    fixture.heroes ?? [],
    fixture.heroEquipment ?? [],
  );
  const verdict = computeRushed(entries);

  it('reads maxed with an empty top-deficits list', () => {
    expect(verdict.overallPercent).toBe(0);
    expect(verdict.band).toBe('maxed');
    expect(verdict.topDeficits).toEqual([]);
    expect(verdict.unitsSkipped).toBe(0);
  });

  it('counts every unit', () => {
    expect(verdict.unitsCounted).toBeGreaterThan(0);
    expect(verdict.unitsMaxed).toBe(verdict.unitsCounted);
  });
});

describe('fixture: rushed-player.json', () => {
  const fixture = loadFixture('rushed-player.json');
  const entries = playerToUnitEntries(
    fixture.troops ?? [],
    fixture.spells ?? [],
    fixture.heroes ?? [],
    fixture.heroEquipment ?? [],
  );
  const verdict = computeRushed(entries);

  it('returns a non-zero percentage and a populated top-deficits list', () => {
    expect(verdict.overallPercent).toBeGreaterThan(0);
    expect(verdict.overallPercent!).toBeLessThanOrEqual(100);
    expect(verdict.topDeficits.length).toBeGreaterThan(0);
  });

  it('counts fewer maxed units than counted units', () => {
    expect(verdict.unitsMaxed).toBeLessThan(verdict.unitsCounted);
  });

  it('the top deficit is the one with the largest level gap', () => {
    const top = verdict.topDeficits[0];
    expect(top.deficit).toBeGreaterThan(0);
    // Goblin: level 5, max 10, deficit 5 is one of the largest
    // Valkyrie: level 6, max 12, deficit 6
    // Goblin's deficit (5) vs Valkyrie's deficit (6): Valkyrie should be near top
    const allDeficits = verdict.topDeficits.map((d) => d.deficit);
    expect(Math.max(...allDeficits)).toBe(top.deficit);
  });
});

describe('fixture: super-troop-player.json (AC-04)', () => {
  const fixture = loadFixture('super-troop-player.json');
  const entries = playerToUnitEntries(
    fixture.troops ?? [],
    fixture.spells ?? [],
    fixture.heroes ?? [],
    fixture.heroEquipment ?? [],
  );
  const verdict = computeRushed(entries);

  it('drops every super troop entry (the normalized level is used)', () => {
    // No super troop name appears in the entries the engine core sees.
    const names = new Set(entries.map((e) => e.name));
    for (const superName of Object.keys(SUPER_TROOP_MAP)) {
      expect(names.has(superName)).toBe(false);
    }
  });

  it('reads maxed because the base troops carry the real maxed levels', () => {
    // Every base troop in this fixture is maxed; the super troops at level 1
    // do not create a deficit because they are dropped.
    expect(verdict.overallPercent).toBe(0);
    expect(verdict.band).toBe('maxed');
    expect(verdict.topDeficits).toEqual([]);
  });
});

describe('fixture: null-maxlevel-player.json', () => {
  const fixture = loadFixture('null-maxlevel-player.json');
  const entries = playerToUnitEntries(
    fixture.troops ?? [],
    fixture.spells ?? [],
    fixture.heroes ?? [],
    fixture.heroEquipment ?? [],
  );
  const verdict = computeRushed(entries);

  it('skips the three null-maxLevel entries and counts them in the footnote', () => {
    expect(verdict.unitsSkipped).toBe(3);
    expect(verdict.skippedNames).toContain('Brand New Troop');
    expect(verdict.skippedNames).toContain('Another New Troop');
    expect(verdict.skippedNames).toContain('New Spell');
  });

  it('still computes a percentage from the usable units', () => {
    expect(verdict.overallPercent).not.toBe(null);
    expect(verdict.unitsCounted).toBeGreaterThan(0);
  });
});

// ---------- purity ----------

describe('purity', () => {
  it('does not mutate the input array', () => {
    const entries = [entry('A', 5, 10), entry('B', 8, 10)];
    const snapshot = JSON.parse(JSON.stringify(entries));
    computeRushed(entries);
    expect(JSON.parse(JSON.stringify(entries))).toEqual(snapshot);
  });

  it('returns a fresh verdict object on every call', () => {
    const entries = [entry('A', 5, 10)];
    const first = computeRushed(entries);
    const second = computeRushed(entries);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it('is deterministic: same input yields the same output', () => {
    const entries = [entry('A', 5, 10), entry('B', 8, 10), entry('C', 3, 10, 'spells')];
    expect(computeRushed(entries)).toEqual(computeRushed(entries));
  });
});

// ---------- labels ----------

describe('labels', () => {
  it('every category has a display label', () => {
    for (const key of ['troops', 'spells', 'heroes', 'petsSiege'] as const) {
      expect(RUSHED_CATEGORY_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it('every band has a display label', () => {
    for (const key of ['maxed', 'core', 'light', 'rushed', 'heavy'] as const) {
      expect(RUSHED_BAND_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});
