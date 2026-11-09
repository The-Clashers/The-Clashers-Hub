import { describe, expect, it } from 'vitest';
import {
  UNIT_ICON_MAP,
  PLACEHOLDER_ICON,
  iconForUnit,
  hasUnitIcon,
} from './unit-icons';

// The icon map is the runtime half of the reference-data bundle (SR-17).
// The completeness test (05 section 5) asserts every fixture unit name
// resolves to a bundled icon or the documented placeholder: a unit name
// that has neither is a drift the test fails loudly on.

describe('iconForUnit', () => {
  it('returns the bundled icon for a known unit name', () => {
    const uri = iconForUnit('Barbarian');
    expect(uri).toBe(UNIT_ICON_MAP['Barbarian']);
    expect(uri).not.toBe(PLACEHOLDER_ICON);
  });

  it('returns the placeholder for an unknown unit name', () => {
    expect(iconForUnit('Brand New Troop')).toBe(PLACEHOLDER_ICON);
  });

  it('returns the placeholder for an empty string', () => {
    expect(iconForUnit('')).toBe(PLACEHOLDER_ICON);
  });
});

describe('hasUnitIcon', () => {
  it('returns true for a known unit name', () => {
    expect(hasUnitIcon('Archer')).toBe(true);
    expect(hasUnitIcon('Wall Wrecker')).toBe(true);
    expect(hasUnitIcon('Giant Gauntlet')).toBe(true);
  });

  it('returns false for an unknown unit name', () => {
    expect(hasUnitIcon('Brand New Troop')).toBe(false);
  });
});

describe('UNIT_ICON_MAP completeness', () => {
  // The core units a real payload carries. Adding a unit is a one-line
  // append; this test fails when the payload gains a unit the map does not
  // cover, so the placeholder never silently stands in for a missing icon.
  it.each([
    'Barbarian',
    'Archer',
    'Goblin',
    'Giant',
    'Wall Breaker',
    'Balloon',
    'Wizard',
    'Healer',
    'Dragon',
    'P.E.K.K.A',
    'Valkyrie',
    'Golem',
    'Witch',
    'Lava Hound',
    'Bowler',
    'Miner',
    'Yeti',
    'Headhunter',
    'Electro Titan',
    'Barbarian King',
    'Archer Queen',
    'Grand Warden',
    'Royal Champion',
    // super troops
    'Super Barbarian',
    'Super Archer',
    'Sneaky Goblin',
    'Super Valkyrie',
    'Inferno Dragon',
    'Super Dragon',
    'Ice Hound',
    // siege machines
    'Wall Wrecker',
    'Battle Blimp',
    'Stone Slammer',
    'Siege Barracks',
    'Log Launcher',
    'Flame Flinger',
    'Battle Drill',
    // pets
    'L.A.S.S.I',
    'Mighty Yak',
    'Electro Owl',
    'Unicorn',
    'Phoenix',
    // spells
    'Lightning Spell',
    'Healing Spell',
    'Rage Spell',
    'Freeze Spell',
    'Clone Spell',
    'Poison Spell',
    'Earthquake Spell',
    'Haste Spell',
    'Skeleton Spell',
    'Bat Spell',
    // builder base
    'Raged Barbarian',
    'Sneaky Archer',
    'Beta Minion',
    'Boxer Giant',
    'Bomber',
    'Power P.E.K.K.A',
    'Cannon Cart',
    'Drop Ship',
    'Battle Machine',
    'Battle Copter',
    // hero equipment
    'Giant Gauntlet',
    'Spiky Ball',
    'Earthquake Boots',
    'Snake Bracelet',
    'Vampstache',
    'Rage Vial',
    'Eternal Tome',
    'Life Gem',
    'Seeking Shield',
    'Royal Gem',
    // hero equipment the reference-data pass trued against the live
    // payload: the API's own spellings, which the flat map now carries
    // so it agrees with the typed map in lib/icon-map.ts
    'Hog Rider Puppet',
    'Stick Horse',
    'Henchmen Puppet',
    'Metal Pants',
    'Meteor Staff',
    'Stun Blaster',
  ])('has a bundled icon for %s', (name) => {
    expect(hasUnitIcon(name)).toBe(true);
  });

  it('the derived spellings the reference-data pass corrected no longer resolve', () => {
    // Hog Rider Doll and Stick Fire Horse were misnamings (the API spells
    // them Hog Rider Puppet and Stick Horse); Henchman, Iron Pants, and
    // Meteorite Sceptre were derived spellings the API does not use. A
    // payload carrying any of them renders the placeholder, the same
    // honest fallback the typed map keeps.
    expect(hasUnitIcon('Hog Rider Doll')).toBe(false);
    expect(hasUnitIcon('Stick Fire Horse')).toBe(false);
    expect(hasUnitIcon('Henchman')).toBe(false);
    expect(hasUnitIcon('Iron Pants')).toBe(false);
    expect(hasUnitIcon('Meteorite Sceptre')).toBe(false);
  });

  it('every value is a non-empty string', () => {
    for (const [name, uri] of Object.entries(UNIT_ICON_MAP)) {
      expect(typeof uri).toBe('string');
      expect(uri.length).toBeGreaterThan(0);
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
