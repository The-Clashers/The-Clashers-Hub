import { describe, expect, it } from 'vitest';
import { groupByVillage, villageLabel } from './village';

// Tests for the shared village grouping rule (lib/village.ts). The rule
// was born in the achievements card (T-M2-3) and moved to its own module
// when the hero card (T-M2-4) needed the identical behavior; these tests
// lock the rule against drift for every card that renders village-marked
// rows. The rows are the minimal generic shape (a name plus the village
// marker) so the tests prove the module owns the rule for any payload
// array, not just achievements.

interface Row {
  name: string;
  village: string;
}

// Hand-built rows mirroring the live payload's interleave (home, builder
// base, home again, then clan capital): the grouping tests need rows whose
// village order is the interesting part, not the rest of the shape.
function row(name: string, village: string): Row {
  return { name, village };
}

describe('villageLabel', () => {
  it('labels the three villages the game API names', () => {
    expect(villageLabel('home')).toBe('Home Village');
    expect(villageLabel('builderBase')).toBe('Builder Base');
    expect(villageLabel('clanCapital')).toBe('Clan Capital');
  });

  it('labels an unknown marker as itself, the tolerant floor', () => {
    // A new village the API invents still gets a header instead of being
    // dropped or lumped into home.
    expect(villageLabel('nightCapital')).toBe('nightCapital');
  });
});

describe('groupByVillage', () => {
  it('groups an interleaved payload into village blocks in first-appearance order', () => {
    // The live payload's order: home rows, then builder base, then home
    // again, then clan capital, then home again. One card, three blocks.
    const rows: Row[] = [
      row('Bigger Coffers', 'home'),
      row('Get those Goblins!', 'home'),
      row('Master Engineering', 'builderBase'),
      row('Un-Build It', 'builderBase'),
      row('Keep Your Account Safe!', 'home'),
      row('Aggressive Capitalism', 'clanCapital'),
      row('Bigger & Better', 'home'),
    ];

    const groups = groupByVillage(rows);

    expect(groups.map((group) => group.village)).toEqual([
      'home',
      'builderBase',
      'clanCapital',
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      'Home Village',
      'Builder Base',
      'Clan Capital',
    ]);
  });

  it('keeps API order inside each group', () => {
    const rows: Row[] = [
      row('Bigger Coffers', 'home'),
      row('Master Engineering', 'builderBase'),
      row('Nice and Tidy', 'home'),
    ];

    const groups = groupByVillage(rows);

    expect(groups[0].rows.map((entry) => entry.name)).toEqual([
      'Bigger Coffers',
      'Nice and Tidy',
    ]);
    expect(groups[1].rows.map((entry) => entry.name)).toEqual([
      'Master Engineering',
    ]);
  });

  it('never mutates the input array', () => {
    const rows: Row[] = [
      row('Bigger Coffers', 'home'),
      row('Master Engineering', 'builderBase'),
    ];
    const before = JSON.stringify(rows);

    groupByVillage(rows);

    expect(JSON.stringify(rows)).toBe(before);
  });

  it('labels an unknown village marker as itself, the tolerant floor', () => {
    const groups = groupByVillage([row('Something New', 'nightCapital')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('nightCapital');
  });

  it('returns an empty list for an empty payload', () => {
    expect(groupByVillage([])).toEqual([]);
  });
});
