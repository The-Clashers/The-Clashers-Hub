import { describe, expect, it } from 'vitest';
import { formatLevelPair, heroFill, heroProgress } from './hero-progress';

// Table-driven tests (NFR-07) for the hero panel math. The tables mirror
// the real payload shapes the live proxy served while the card was
// designed: a leader with the Barbarian King at 87 of 110 carrying
// "Spiky Ball" 27/27 and "Earthquake Boots" 18/18, plus the four
// fixture heroes (maxed at level, below it, and the null-maxLevel shape
// brand-new content carries).

describe('heroFill', () => {
  it.each([
    // The live payload's own hero: the leader's Barbarian King.
    { level: 87, maxLevel: 110, expected: 87 / 110 },
    // A hero at its maximum reads full.
    { level: 90, maxLevel: 90, expected: 1 },
    // A level past the maximum (the API can lag a live upgrade) caps at full.
    { level: 111, maxLevel: 110, expected: 1 },
    // Equipment climbs read the same way.
    { level: 20, maxLevel: 27, expected: 20 / 27 },
    // A fresh hero reads empty, not negative.
    { level: 0, maxLevel: 90, expected: 0 },
    { level: -5, maxLevel: 90, expected: 0 },
    // A 0-maximum row reads full, the tolerant floor for a malformed
    // entry (a rail that can never fill would read as broken, not empty).
    { level: 3, maxLevel: 0, expected: 1 },
    { level: 3, maxLevel: -1, expected: 1 },
  ])('fills $level of $maxLevel as $expected', ({ level, maxLevel, expected }) => {
    expect(heroFill(level, maxLevel)).toBeCloseTo(expected, 12);
  });
});

describe('heroProgress', () => {
  it('carries the level and maximum through as fill and maxed', () => {
    // The live payload's Barbarian King: climbing, not maxed. The max it
    // judged against rides the display data so the row renders its pair
    // without re-reading the raw entry.
    expect(heroProgress({ level: 87, maxLevel: 110 })).toEqual({
      hasMax: true,
      fill: 87 / 110,
      isMaxed: false,
      maxLevel: 110,
    });
  });

  it('marks a hero at its maximum maxed', () => {
    // The maxed fixture's shape: every hero at level 90 of 90.
    expect(heroProgress({ level: 90, maxLevel: 90 })).toEqual({
      hasMax: true,
      fill: 1,
      isMaxed: true,
      maxLevel: 90,
    });
  });

  it('marks a level past the maximum maxed with a full rail', () => {
    // The pair never lies about the number; the rail caps its fill.
    const past = heroProgress({ level: 111, maxLevel: 110 });
    expect(past.hasMax).toBe(true);
    if (past.hasMax) {
      expect(past.isMaxed).toBe(true);
      expect(past.fill).toBe(1);
      expect(past.maxLevel).toBe(110);
    }
  });

  it('never judges a null maxLevel maxed, the brand-new-content shape', () => {
    // SR-14's shape: the API omits the maximum when it has not caught up
    // to brand-new content. The row renders its level alone (no rail, no
    // pair) and the card footnotes it; the rule says hasMax false so the
    // render cannot invent a maximum.
    expect(heroProgress({ level: 9, maxLevel: null })).toEqual({
      hasMax: false,
      fill: 0,
      isMaxed: false,
    });
  });
});

describe('formatLevelPair', () => {
  it('renders the level over the maximum, plain integers', () => {
    expect(formatLevelPair(87, 110)).toBe('87 / 110');
    expect(formatLevelPair(20, 27)).toBe('20 / 27');
  });

  it('rounds fractional levels, no decimals', () => {
    // 07 section 5: no decimal noise; levels are whole.
    expect(formatLevelPair(87.4, 110.6)).toBe('87 / 111');
  });

  it('floors a negative level to zero rather than printing a minus', () => {
    expect(formatLevelPair(-3, 110)).toBe('0 / 110');
  });
});
