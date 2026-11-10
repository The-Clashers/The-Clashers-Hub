import { describe, expect, it } from 'vitest';
import {
  achievementProgress,
  ACHIEVEMENT_FILTER_LABELS,
  ACHIEVEMENT_MAX_STARS,
  filterAchievements,
  formatProgressPair,
  groupAchievementsByVillage,
  railFill,
  starSlots,
} from './achievement-progress';
import { groupByVillage } from './village';

import type { PlayerAchievement } from '../api/player';

// Table-driven tests (NFR-07) for the achievement progress math. The tables
// mirror the real payload shapes the live proxy served while the card was
// designed: the counter distributions come from a 54-achievement player.

describe('railFill', () => {
  it('computes the fill from the live payload counters', () => {
    // [value, target, expected fill]
    const cases: ReadonlyArray<[number, number, number]> = [
      // A 2-star row well under the target (Conqueror, live payload).
      [3622, 5000, 0.7244],
      // A 1-star row whose value is already past the target (Dragon Slayer,
      // live payload): stars and fraction are independent; the rail caps.
      [8, 1, 1],
      // A 3-star row past the target (Gold Grab): full rail, no overflow.
      [2_000_000_000, 100_000_000, 1],
      // A locked row at zero (Keep Your Account Safe!, live payload).
      [0, 1, 0],
      // Exactly at the target.
      [1, 1, 1],
    ];
    cases.forEach(([value, target, expected]) => {
      expect(railFill(value, target)).toBeCloseTo(expected, 4);
    });
  });

  it('caps a value past the target at a full rail', () => {
    expect(railFill(64957, 2000)).toBe(1);
  });

  it('treats a zero or negative target as a full rail, the tolerant floor', () => {
    // A malformed entry with no target cannot have a rail that never fills;
    // the row reads complete rather than broken.
    expect(railFill(5, 0)).toBe(1);
    expect(railFill(0, 0)).toBe(1);
    expect(railFill(5, -3)).toBe(1);
  });

  it('clamps a negative value to an empty rail', () => {
    expect(railFill(-10, 100)).toBe(0);
  });
});

describe('starSlots', () => {
  it('carries the API star count through, never deriving it from the fraction', () => {
    // The live payload proves stars and fraction are independent: a row can
    // hold 2 stars at 25% of the target (Sharing is caring) or 1 star with
    // the value past it (Dragon Slayer). The slots read the count only.
    const cases: ReadonlyArray<[number, number, number]> = [
      [3, 3622, 5000], // 3 stars, 72% of target: full stars, partial rail
      [2, 2549, 10000], // 2 stars, 25% of target
      [1, 8, 1], // 1 star, value past target
      [0, 0, 1], // locked row
    ];
    cases.forEach(([stars]) => {
      expect(starSlots(stars).earned).toBe(stars);
    });
  });

  it('always reports the full slot count so rails align', () => {
    expect(starSlots(0).total).toBe(ACHIEVEMENT_MAX_STARS);
    expect(starSlots(2).total).toBe(ACHIEVEMENT_MAX_STARS);
    expect(ACHIEVEMENT_MAX_STARS).toBe(3);
  });

  it('clamps out-of-range counts into the slot span', () => {
    expect(starSlots(7)).toEqual({ total: 3, earned: 3 });
    expect(starSlots(-1)).toEqual({ total: 3, earned: 0 });
    expect(starSlots(2.5)).toEqual({ total: 3, earned: 2 });
  });
});

describe('achievementProgress', () => {
  it('bundles the fill, the slots, and the completed flag', () => {
    const progress = achievementProgress({ value: 3622, target: 5000, stars: 2 });
    expect(progress.fill).toBeCloseTo(0.7244, 4);
    expect(progress.stars).toEqual({ total: 3, earned: 2 });
    expect(progress.isComplete).toBe(false);
  });

  it('marks a 3-star row complete even when the value sits under the target', () => {
    // The live payload has no such row, but the rule is the API's truth: the
    // third star is in, the achievement is done.
    const progress = achievementProgress({ value: 900, target: 1000, stars: 3 });
    expect(progress.isComplete).toBe(true);
  });

  it('marks a 0-target row complete, the tolerant floor again', () => {
    const progress = achievementProgress({ value: 5, target: 0, stars: 0 });
    expect(progress.fill).toBe(1);
    expect(progress.isComplete).toBe(false);
  });
});

describe('formatProgressPair', () => {
  it('renders the value over the target with thousands separators', () => {
    const cases: ReadonlyArray<[number, number, string]> = [
      [7139, 500, '7,139 / 500'],
      [2_000_000_000, 100_000_000, '2,000,000,000 / 100,000,000'],
      [3622, 5000, '3,622 / 5,000'],
      [0, 1, '0 / 1'],
    ];
    cases.forEach(([value, target, expected]) => {
      expect(formatProgressPair(value, target)).toBe(expected);
    });
  });

  it('rounds fractional counters to integers, no decimals', () => {
    // 07 section 5: no decimal noise; achievement counters are whole.
    expect(formatProgressPair(2549.6, 10000.2)).toBe('2,550 / 10,000');
  });

  it('floors negative counters to zero rather than printing a minus', () => {
    expect(formatProgressPair(-10, 100)).toBe('0 / 100');
  });
});

// The village grouping tests moved to lib/village.test.ts when the rule
// moved to its own module (the hero card, T-M2-4, needed the identical
// behavior); what stays here locks the delegation itself so the two cards
// can never drift onto different rules.
describe('village grouping delegation', () => {
  it('re-exports the shared rule from lib/village', () => {
    expect(groupAchievementsByVillage).toBe(groupByVillage);
  });
});

describe('filterAchievements', () => {
  const sample: ReadonlyArray<PlayerAchievement> = [
    { name: 'Empire Builder', stars: 3, value: 4, target: 4, info: 'Upgrade TH', village: 'home' },
    { name: 'Wall Buster', stars: 2, value: 1800, target: 2000, info: 'Destroy walls', village: 'home' },
    { name: 'Keep Your Account Safe!', stars: 0, value: 0, target: 1, info: 'Connect ID', village: 'home' },
    { name: 'Sweet Victory!', stars: 3, value: 3622, target: 1250, info: 'Trophies', village: 'home' },
  ];

  it('returns every row in order under the all filter without mutating the input', () => {
    const frozen = Object.freeze([...sample]);
    const result = filterAchievements(frozen, 'all');
    expect(result.map((row) => row.name)).toEqual([
      'Empire Builder',
      'Wall Buster',
      'Keep Your Account Safe!',
      'Sweet Victory!',
    ]);
  });

  it('returns only rows with fewer than 3 stars under inProgress', () => {
    const result = filterAchievements(sample, 'inProgress');
    expect(result.map((row) => row.name)).toEqual([
      'Wall Buster',
      'Keep Your Account Safe!',
    ]);
  });

  it('returns only rows with 3 or more stars under complete', () => {
    const result = filterAchievements(sample, 'complete');
    expect(result.map((row) => row.name)).toEqual([
      'Empire Builder',
      'Sweet Victory!',
    ]);
  });

  it('exposes labels for all three filter modes', () => {
    expect(ACHIEVEMENT_FILTER_LABELS).toEqual({
      all: 'All',
      inProgress: 'In Progress',
      complete: 'Completed',
    });
  });
});
