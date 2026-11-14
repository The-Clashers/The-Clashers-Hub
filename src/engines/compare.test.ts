// Table-driven tests for the player comparison engine (T-M3-3, 05 section 4).
//
// The engine is pure, so every case is data in, rows out: directions and
// deltas per metric, the missing-data dash (never a fake zero), the hero
// union, the key-achievement curation, and the compact counter formatting.
// The deliberate limitation is asserted structurally: the output carries
// groups of rows and nothing that could be read as one overall winner.

import { describe, expect, it } from 'vitest';
import {
  COMPARE_GROUP_LABELS,
  compareNumbers,
  computePlayerCompare,
  formatCompactCount,
  formatHeroLevel,
  KEY_ACHIEVEMENTS,
  type CompareGroup,
  type CompareRow,
  type PlayerCompareSide,
} from './compare';

function row(groups: CompareGroup[], id: string): CompareRow {
  for (const group of groups) {
    const found = group.rows.find((candidate) => candidate.id === id);
    if (found) return found;
  }
  throw new Error(`row not found: ${id}`);
}

/** A well-filled side: the numbers the account, rushed, hero, war, and
 * achievement rows all answer. */
function sideA(): PlayerCompareSide {
  return {
    name: 'A Player',
    tag: '#AAAAAAA',
    townHallLevel: 14,
    expLevel: 189,
    warStars: 1959,
    attackWins: 88,
    rushedPercent: 8.4,
    rushedCategories: [
      { label: 'Troops', percent: 7.2 },
      { label: 'Spells', percent: 12.6 },
      { label: 'Heroes', percent: 4.1 },
      { label: 'Pets & Siege', percent: 9.8 },
    ],
    heroes: [
      { name: 'Barbarian King', level: 80, maxLevel: 80 },
      { name: 'Archer Queen', level: 21, maxLevel: 80 },
      { name: 'Minion Prince', level: 9, maxLevel: null },
    ],
    achievements: [
      { name: 'Gold Grab', stars: 3, value: 2_150_000_000 },
      { name: 'Friend in Need', stars: 3, value: 260_500 },
      { name: 'Heroic Heist', stars: 1, value: 96_300 },
      { name: 'Keep Your Account Safe', stars: 3, value: 1 },
    ],
  };
}

/** The contrasting side: lower account, less developed, different heroes,
 * a different achievement set, and a higher (worse) rushed percent. */
function sideB(): PlayerCompareSide {
  return {
    name: 'B Player',
    tag: '#BBBBBBB',
    townHallLevel: 13,
    expLevel: 142,
    warStars: 864,
    attackWins: 41,
    rushedPercent: 15.7,
    rushedCategories: [
      { label: 'Troops', percent: 18.3 },
      { label: 'Spells', percent: 11.9 },
      { label: 'Heroes', percent: 6.4 },
    ],
    heroes: [
      { name: 'Barbarian King', level: 45, maxLevel: 80 },
      { name: 'Archer Queen', level: 60, maxLevel: 80 },
      { name: 'Grand Warden', level: 30, maxLevel: 65 },
    ],
    achievements: [
      { name: 'Gold Grab', stars: 2, value: 812_400_000 },
      { name: 'Friend in Need', stars: 2, value: 52_300 },
      { name: 'Elixir Escapade', stars: 1, value: 310_200_000 },
      { name: 'Spoils of War', stars: 1, value: 8_450_000 },
    ],
  };
}

describe('compareNumbers', () => {
  it.each([
    [14, 13, 'higher', 'a'],
    [13, 14, 'higher', 'b'],
    [8.4, 15.7, 'lower', 'a'],
    [15.7, 8.4, 'lower', 'b'],
    [12, 12, 'higher', 'even'],
    [null, 12, 'higher', 'none'],
    [12, undefined, 'lower', 'none'],
  ])(
    '(%s, %s, %s) resolves direction %s',
    (a, b, metric, direction) => {
      const verdict = compareNumbers(a as number | null, b as number | null, metric as 'higher' | 'lower');
      expect(verdict.direction).toBe(direction);
    },
  );

  it('carries the signed delta only when both sides answer', () => {
    expect(compareNumbers(14, 13, 'higher').delta).toBe(1);
    expect(compareNumbers(13, 14, 'higher').delta).toBe(-1);
    expect(compareNumbers(12, 12, 'higher').delta).toBe(0);
    expect(compareNumbers(null, 12, 'higher').delta).toBeNull();
  });
});

describe('formatCompactCount', () => {
  it.each([
    [0, '0'],
    [1959, '1,959'],
    [260_500, '260.5K'],
    [8_450_000, '8.45M'],
    [812_400_000, '812.4M'],
    [2_150_000_000, '2.15B'],
    [12_400, '12.4K'],
    [9999, '9,999'],
  ])('formats %d as %s', (value, display) => {
    expect(formatCompactCount(value)).toBe(display);
  });

  it('is deterministic (no locale dependence)', () => {
    expect(formatCompactCount(1234)).toBe(formatCompactCount(1234));
    expect(formatCompactCount(1234)).toBe('1,234');
  });
});

describe('formatHeroLevel', () => {
  it('renders the level pair when the maximum is present', () => {
    expect(formatHeroLevel(87, 110)).toBe('87 / 110');
  });

  it('renders the level alone when the maximum is null', () => {
    expect(formatHeroLevel(9, null)).toBe('9');
  });
});

describe('computePlayerCompare', () => {
  const groups = computePlayerCompare(sideA(), sideB());

  it('returns the groups in display order with labels', () => {
    expect(groups.map((group) => group.id)).toEqual([
      'account',
      'rushed',
      'heroes',
      'war',
      'achievements',
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      COMPARE_GROUP_LABELS.account,
      COMPARE_GROUP_LABELS.rushed,
      COMPARE_GROUP_LABELS.heroes,
      COMPARE_GROUP_LABELS.war,
      COMPARE_GROUP_LABELS.achievements,
    ]);
  });

  it('reads the account rows higher-better with the signed delta', () => {
    const townHall = row(groups, 'account:Town Hall');
    expect(townHall.aDisplay).toBe('14');
    expect(townHall.bDisplay).toBe('13');
    expect(townHall.direction).toBe('a');
    expect(townHall.delta).toBe(1);
    expect(townHall.deltaDisplay).toBe('+1');
    expect(townHall.metric).toBe('higher');

    const xp = row(groups, 'account:XP level');
    expect(xp.direction).toBe('a');
    expect(xp.deltaDisplay).toBe('+47');
  });

  it('reads the rushed rows lower-better, so the smaller deficit leads', () => {
    const overall = row(groups, 'rushed:Rushed overall');
    expect(overall.aDisplay).toBe('8.4%');
    expect(overall.bDisplay).toBe('15.7%');
    expect(overall.direction).toBe('a');
    expect(overall.delta).toBeCloseTo(-7.3);
    // The delta renders the leader's margin, unsigned: A leads by 7.3
    // percentage points, whatever the raw sign of a minus b.
    expect(overall.deltaDisplay).toBe('+7.3');
    expect(overall.metric).toBe('lower');

    // Troops: A 7.2 vs B 18.3, A's smaller deficit leads.
    expect(row(groups, 'rushed:Troops').direction).toBe('a');
    // Spells: A 12.6 vs B 11.9, B's smaller deficit leads.
    expect(row(groups, 'rushed:Spells').direction).toBe('b');
  });

  it('renders the category union, a category one side lacks answering the dash', () => {
    const pets = row(groups, 'rushed:Pets & Siege');
    expect(pets.aDisplay).toBe('9.8%');
    expect(pets.bDisplay).toBe('\u2014');
    expect(pets.direction).toBe('none');
    expect(pets.delta).toBeNull();
    expect(pets.deltaDisplay).toBe('');
  });

  it('renders the hero union with per-hero verdicts', () => {
    const king = row(groups, 'heroes:Barbarian King');
    expect(king.aDisplay).toBe('80 / 80');
    expect(king.bDisplay).toBe('45 / 80');
    expect(king.direction).toBe('a');
    expect(king.deltaDisplay).toBe('+35');

    // A hero only B has: the dash on A's side, no verdict.
    const warden = row(groups, 'heroes:Grand Warden');
    expect(warden.aDisplay).toBe('\u2014');
    expect(warden.bDisplay).toBe('30 / 65');
    expect(warden.direction).toBe('none');

    // A hero with a null maximum renders the level alone on A's side.
    const prince = row(groups, 'heroes:Minion Prince');
    expect(prince.aDisplay).toBe('9');
    expect(prince.bDisplay).toBe('\u2014');
    expect(prince.direction).toBe('none');

    // Equal levels read even with the margin rendered as a tie word.
    const sides: [PlayerCompareSide, PlayerCompareSide] = [
      { ...sideA(), heroes: [{ name: 'Barbarian King', level: 45, maxLevel: 80 }] },
      { ...sideB(), heroes: [{ name: 'Barbarian King', level: 45, maxLevel: 80 }] },
    ];
    const evenRow = row(computePlayerCompare(...sides), 'heroes:Barbarian King');
    expect(evenRow.direction).toBe('even');
    expect(evenRow.deltaDisplay).toBe('Even');
  });

  it('reads the war record rows as counters', () => {
    const warStars = row(groups, 'war:War stars');
    expect(warStars.aDisplay).toBe('1,959');
    expect(warStars.bDisplay).toBe('864');
    expect(warStars.direction).toBe('a');
    expect(warStars.delta).toBe(1095);
    expect(warStars.deltaDisplay).toBe('+1,095');

    expect(row(groups, 'war:Attack wins').bDisplay).toBe('41');
  });

  it('renders only the key achievements present on at least one side', () => {
    const achievementRows = groups
      .find((group) => group.id === 'achievements')!
      .rows.map((entry) => entry.id);
    expect(achievementRows).toEqual([
      'achievements:Gold Grab',
      'achievements:Elixir Escapade',
      'achievements:Heroic Heist',
      'achievements:Friend in Need',
      'achievements:Spoils of War',
    ]);

    const gold = row(groups, 'achievements:Gold Grab');
    expect(gold.aDisplay).toBe('2.15B');
    expect(gold.bDisplay).toBe('812.4M');
    expect(gold.direction).toBe('a');
    expect(gold.deltaDisplay).toBe('+1.34B');

    // An achievement only one side carries: the dash, no verdict.
    const elixir = row(groups, 'achievements:Elixir Escapade');
    expect(elixir.aDisplay).toBe('\u2014');
    expect(elixir.bDisplay).toBe('310.2M');
    expect(elixir.direction).toBe('none');
  });

  it('never carries anything that could be read as one overall winner', () => {
    for (const group of groups) {
      for (const entry of group.rows) {
        // Rows are label + two displays + one delta; there is no aggregate
        // field anywhere in the verdict.
        expect(Object.keys(entry).sort()).toEqual(
          [
            'aDisplay',
            'bDisplay',
            'delta',
            'deltaDisplay',
            'direction',
            'group',
            'id',
            'label',
            'metric',
          ].sort(),
        );
      }
    }
  });

  it('answers every missing optional metric with the dash, never a zero', () => {
    const bareA: PlayerCompareSide = {
      name: 'Bare',
      tag: '#BAREBARE',
      townHallLevel: 11,
      expLevel: 40,
      warStars: null,
      attackWins: null,
      rushedPercent: null,
      rushedCategories: [],
      heroes: [],
      achievements: [],
    };
    const out = computePlayerCompare(bareA, sideB());
    expect(row(out, 'war:War stars').aDisplay).toBe('\u2014');
    expect(row(out, 'war:War stars').direction).toBe('none');
    expect(row(out, 'rushed:Rushed overall').aDisplay).toBe('\u2014');
    expect(row(out, 'rushed:Rushed overall').direction).toBe('none');
    expect(out.find((group) => group.id === 'heroes')!.rows).toHaveLength(3);
    expect(out.find((group) => group.id === 'achievements')!.rows.length).toBeGreaterThan(0);
  });

  it('curates the key list to the lifetime counters', () => {
    expect(KEY_ACHIEVEMENTS).not.toContain('War Hero');
    expect(KEY_ACHIEVEMENTS).toContain('Gold Grab');
  });
});
