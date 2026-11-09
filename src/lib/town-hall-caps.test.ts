import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  BUILDER_CAP_MAX_HALL,
  BUILDER_HERO_CAPS,
  BUILDER_TROOP_CAPS,
  builderCapAtHall,
  builderReferenceMax,
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
import { isSuperTroop } from '../engines/rushed';

// Tests for the Town Hall cap tables (T-M2-6, SR-17). Three edges:
//
// 1. Shape: every row is a dense hall-indexed array, non-decreasing (a
//    cap can never drop when the hall rises), every table is non-empty.
// 2. Evidence: a sample of rows cross-checked against the live payload
//    during the derivation (the API's own global maxLevel equals the
//    TH18 column; a TH9 account's caps match the game's TH9 lab). These
//    are the rows a regression would silently corrupt.
// 3. Totality over the fixtures: every home unit name the fixtures carry
//    resolves in a table, so the rushed engine's SR-17 fallback never
//    quietly misses (the null-maxlevel fixture is the case that needs it).
//
// The live payload this module was derived against: a TH18/BH10 leader
// whose 117 home units and 14 builder units all agreed with the tables.

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../../fixtures');

interface FixtureUnit {
  name: string;
  level: number;
  maxLevel: number | null;
  village: string;
}

function loadFixture(fileName: string): {
  troops?: FixtureUnit[];
  spells?: FixtureUnit[];
  heroes?: FixtureUnit[];
  heroEquipment?: FixtureUnit[];
} {
  return JSON.parse(readFileSync(resolve(fixturesDir, fileName), 'utf8'));
}

const HOME_TABLES = {
  troops: HOME_TROOP_CAPS,
  spells: HOME_SPELL_CAPS,
  siege: HOME_SIEGE_CAPS,
  pets: HOME_PET_CAPS,
  heroes: HOME_HERO_CAPS,
  equipment: HOME_EQUIPMENT_CAPS,
} as const;

describe('table shape', () => {
  it('every home row is TH1..TH18 long and non-decreasing', () => {
    for (const [table, rows] of Object.entries(HOME_TABLES)) {
      expect(Object.keys(rows).length, `${table} is empty`).toBeGreaterThan(0);
      for (const [name, row] of Object.entries(rows)) {
        expect(row, `${table}[${name}] length`).toHaveLength(HOME_CAP_MAX_TOWN_HALL);
        for (let i = 1; i < row.length; i += 1) {
          expect(row[i], `${table}[${name}] drops at index ${i}`).toBeGreaterThanOrEqual(row[i - 1]);
        }
      }
    }
  });

  it('every builder row is BH1..BH10 long and non-decreasing', () => {
    for (const [table, rows] of Object.entries({ troops: BUILDER_TROOP_CAPS, heroes: BUILDER_HERO_CAPS })) {
      expect(Object.keys(rows).length, `${table} is empty`).toBeGreaterThan(0);
      for (const [name, row] of Object.entries(rows)) {
        expect(row, `${table}[${name}] length`).toHaveLength(BUILDER_CAP_MAX_HALL);
        for (let i = 1; i < row.length; i += 1) {
          expect(row[i], `${table}[${name}] drops at index ${i}`).toBeGreaterThanOrEqual(row[i - 1]);
        }
      }
    }
  });

  it('no name appears in two home tables (a unit has one ladder)', () => {
    const seen = new Map<string, string>();
    for (const [table, rows] of Object.entries(HOME_TABLES)) {
      for (const name of Object.keys(rows)) {
        const first = seen.get(name);
        expect(first ?? table, `${name} is in both ${first} and ${table}`).toBe(first ?? table);
        if (!first) seen.set(name, table);
      }
    }
  });

  it('the builder tables are disjoint too', () => {
    for (const name of Object.keys(BUILDER_TROOP_CAPS)) {
      expect(BUILDER_HERO_CAPS, `${name} is in both builder tables`).not.toHaveProperty(name);
    }
  });
});

describe('evidence rows (cross-checked against the live payload)', () => {
  // [table, name, hall, expected cap]. Every row was verified during the
  // derivation against the dataset's own level arrays; the live payload
  // then agreed on all 131 units.
  const cases: ReadonlyArray<[string, string, number, number]> = [
    ['troops', 'Barbarian', 18, 13],
    ['troops', 'Barbarian', 9, 6],
    ['troops', 'Witch', 14, 5],
    ['troops', 'Witch', 18, 8],
    // The lab-binding case: Bat Spell 8 is marked TH17 but needs lab 16,
    // which first exists at TH18, so TH17 reads 7.
    ['spells', 'Bat Spell', 17, 7],
    ['spells', 'Bat Spell', 18, 8],
    ['spells', 'Healing Spell', 12, 7],
    ['spells', 'Lightning Spell', 18, 13],
    ['siege', 'Troop Launcher', 18, 4],
    ['siege', 'Wall Wrecker', 18, 6],
    ['pets', 'L.A.S.S.I', 14, 10],
    ['pets', 'L.A.S.S.I', 15, 15],
    ['pets', 'Greedy Raven', 18, 10],
    ['heroes', 'Barbarian King', 7, 10],
    ['heroes', 'Barbarian King', 18, 110],
    ['heroes', 'Grand Warden', 18, 85],
    ['heroes', 'Dragon Duke', 18, 25],
    ['equipment', 'Giant Gauntlet', 8, 12],
    ['equipment', 'Giant Gauntlet', 16, 27],
    ['equipment', 'Barbarian Puppet', 18, 18],
    ['equipment', 'Metal Pants', 18, 18],
  ];
  it('matches the derivation on every row', () => {
    for (const [table, name, hall, expected] of cases) {
      const rows = HOME_TABLES[table as keyof typeof HOME_TABLES] as Record<string, ReadonlyArray<number>>;
      expect(rows[name], `${table}[${name}] missing`).toBeDefined();
      expect(rows[name][hall - 1], `${table}[${name}]@TH${hall}`).toBe(expected);
    }
  });

  it('the API global maxLevel the live payload reported equals the TH18 column', () => {
    // The strongest derivation check, restated as a test: the live payload
    // carried 117 home units whose reported global maxLevel matched the
    // TH18 cap on every one. A representative set is locked here.
    const th18: ReadonlyArray<[string, string, number]> = [
      ['troops', 'Archer', 14],
      ['troops', 'Giant', 14],
      ['troops', 'P.E.K.K.A', 13],
      ['troops', 'Headhunter', 4],
      ['troops', 'Apprentice Warden', 4],
      ['spells', 'Angry Spell', 4],
      ['spells', 'Totem Spell', 4],
      ['siege', 'Sky Wagon', 4],
    ];
    for (const [table, name, apiMax] of th18) {
      const rows = HOME_TABLES[table as keyof typeof HOME_TABLES] as Record<string, ReadonlyArray<number>>;
      expect(rows[name][17], `${table}[${name}] TH18 vs API maxLevel`).toBe(apiMax);
    }
  });
});

describe('lookups', () => {
  it('homeCapAtTownHall reads the row at the hall, clamping beyond the table', () => {
    expect(homeCapAtTownHall('Barbarian', 18)).toBe(13);
    expect(homeCapAtTownHall('Barbarian', 9)).toBe(6);
    expect(homeCapAtTownHall('Barbarian', 19)).toBe(13); // clamped, nothing is known about TH19
    expect(homeCapAtTownHall('Barbarian', 0)).toBe(1); // floored to TH1
    expect(homeCapAtTownHall('Not A Unit', 18)).toBeNull();
  });

  it('builderCapAtHall mirrors the home rule', () => {
    expect(builderCapAtHall('Raged Barbarian', 10)).toBe(20);
    expect(builderCapAtHall('Battle Machine', 5)).toBe(5);
    expect(builderCapAtHall('Battle Copter', 8)).toBe(25);
    expect(builderCapAtHall('Not A Unit', 10)).toBeNull();
  });

  it('referenceMax reads the last column (the SR-17 fallback number)', () => {
    expect(homeReferenceMax('Barbarian')).toBe(13);
    expect(homeReferenceMax('Giant Gauntlet')).toBe(27);
    expect(homeReferenceMax('Not A Unit')).toBeNull();
    expect(builderReferenceMax('Battle Machine')).toBe(35);
    expect(builderReferenceMax('Not A Unit')).toBeNull();
  });

  it('a 0 cap means not-unlocked-yet, and the lookup says so without null', () => {
    expect(homeCapAtTownHall('Barbarian King', 6)).toBe(0); // the hero hall does not exist yet
    expect(homeCapAtTownHall('Giant Gauntlet', 7)).toBe(0); // the blacksmith does not exist yet
  });
});

describe('totality over the fixtures (the SR-17 fallback never quietly misses)', () => {
  it('every real unit name in every fixture resolves in a table', () => {
    // The null-maxlevel fixture deliberately carries invented names
    // ("Brand New Troop" and friends) that no table should resolve; the
    // other three fixtures carry real names, and every one of them must
    // resolve so the SR-17 fallback has a number to plug in.
    for (const fileName of [
      'maxed-player.json',
      'rushed-player.json',
      'super-troop-player.json',
    ]) {
      const payload = loadFixture(fileName);
      const names: Array<[string, string]> = [];
      for (const unit of payload.troops ?? []) {
        // Super troops are variants, not ladders: the engine drops them
        // before it ever reads a cap, so the tables deliberately do not
        // carry them (the fixture's roster includes them for exactly this
        // reason).
        if (unit.village === 'home' && !isSuperTroop(unit.name)) names.push(['troops fixture', unit.name]);
      }
      for (const unit of payload.spells ?? []) {
        if (unit.village === 'home') names.push(['spells fixture', unit.name]);
      }
      for (const unit of payload.heroes ?? []) {
        if (unit.village === 'home') names.push(['heroes fixture', unit.name]);
      }
      for (const unit of payload.heroEquipment ?? []) {
        if (unit.village === 'home') names.push(['equipment fixture', unit.name]);
      }
      for (const [kind, name] of names) {
        expect(homeReferenceMax(name), `${fileName}: ${kind} ${name} not in any table`).not.toBeNull();
      }
    }
  });

  it('the null-maxlevel fixture carries only names the tables cannot resolve', () => {
    // The fixture's three null rows are "Brand New Troop", "Another New
    // Troop", and "New Spell": names chosen precisely because no table
    // carries them, so the fallback cannot resolve them and the footnote
    // keeps counting them (SR-14). If a future bundle update adds a real
    // name that collides, this row fails and the fixture earns new names.
    const payload = loadFixture('null-maxlevel-player.json');
    for (const unit of payload.troops ?? []) {
      if (unit.village === 'home' && unit.maxLevel === null) {
        expect(homeReferenceMax(unit.name), `${unit.name} unexpectedly resolved`).toBeNull();
      }
    }
    for (const unit of payload.spells ?? []) {
      if (unit.village === 'home' && unit.maxLevel === null) {
        expect(homeReferenceMax(unit.name), `${unit.name} unexpectedly resolved`).toBeNull();
      }
    }
  });
});
