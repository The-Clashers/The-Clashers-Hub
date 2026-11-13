import { describe, expect, it } from 'vitest';
import {
  formatRecord,
  formatStarsPerAttack,
  formatWarLogDate,
  formatWinRate,
  summarizeWarEfficiency,
} from './war-efficiency';
import type { WarlogEntry, WarlogResult } from '../api/warlog';

// Table tests for the war efficiency engine (T-M3-2, FR-12), the same
// approach lib/war-standings' tests take: pure functions, fixtures that
// mirror the live payload, and the edge rules from the engine doc (05
// section 3) as explicit cases. The smoke clan's first page (five wars,
// captured live 2026-11-12) doubles as the arithmetic anchor: 74 stars
// over 28 attacks is 2.64 -> "2.6", and the attack-weighted destruction
// mean lands on 99.4857 -> "99.5%".

function entry(overrides: {
  result: WarlogResult;
  attacks: number;
  stars: number;
  destruction: number;
}): WarlogEntry {
  return {
    result: overrides.result,
    endTimeMs: 0,
    teamSize: 5,
    attacksPerMember: overrides.result === 'league' ? 1 : 2,
    clan: {
      tag: '#CLAN',
      name: 'Clan',
      badgeUrl: null,
      clanLevel: 10,
      stars: overrides.stars,
      destructionPercentage: overrides.destruction,
      attackCount: overrides.attacks,
    },
    opponent: {
      tag: '#FOE',
      name: 'Foe',
      badgeUrl: null,
      clanLevel: 10,
      stars: 0,
      destructionPercentage: 0,
      attackCount: 0,
    },
  };
}

/** The smoke clan's real first page: five wars, four wins and a tie. */
function smokeClanPage(): WarlogEntry[] {
  return [
    entry({ result: 'win', attacks: 5, stars: 15, destruction: 100.0 }),
    entry({ result: 'win', attacks: 6, stars: 14, destruction: 97.6 }),
    entry({ result: 'tie', attacks: 5, stars: 15, destruction: 100.0 }),
    entry({ result: 'win', attacks: 5, stars: 15, destruction: 100.0 }),
    entry({ result: 'win', attacks: 7, stars: 15, destruction: 100.0 }),
  ];
}

describe('summarizeWarEfficiency', () => {
  it('aggregates the smoke clan page: 80% win rate, 2.64 stars, 99.49% destruction', () => {
    const summary = summarizeWarEfficiency(smokeClanPage());
    expect(summary.wars).toBe(5);
    expect(summary.wins).toBe(4);
    expect(summary.losses).toBe(0);
    expect(summary.ties).toBe(1);
    expect(summary.ongoing).toBe(0);
    expect(summary.decided).toBe(5);
    expect(summary.winRate).toBeCloseTo(0.8, 10);
    expect(summary.starsPerAttack).toBeCloseTo(74 / 28, 10);
    expect(summary.averageDestruction).toBeCloseTo(2785.6 / 28, 10);
  });

  it('excludes ongoing wars from the win rate but keeps them in the sample', () => {
    const summary = summarizeWarEfficiency([
      entry({ result: 'win', attacks: 5, stars: 15, destruction: 100.0 }),
      entry({ result: 'ongoing', attacks: 2, stars: 6, destruction: 60.0 }),
    ]);
    expect(summary.wars).toBe(2);
    expect(summary.decided).toBe(1);
    expect(summary.winRate).toBe(1);
    // The ongoing war's attacks still count toward the attack rates:
    // stars and destruction are facts of the attacks, not the verdict.
    expect(summary.starsPerAttack).toBeCloseTo(21 / 7, 10);
    expect(summary.averageDestruction).toBeCloseTo((500 + 120) / 7, 10);
  });

  it('excludes zero-attack wars from the rates, never as zeros', () => {
    const summary = summarizeWarEfficiency([
      entry({ result: 'win', attacks: 5, stars: 15, destruction: 100.0 }),
      entry({ result: 'lose', attacks: 0, stars: 0, destruction: 0.0 }),
    ]);
    expect(summary.decided).toBe(2);
    expect(summary.winRate).toBe(0.5);
    expect(summary.starsPerAttack).toBe(3);
    expect(summary.averageDestruction).toBe(100);
  });

  it('sets league seasons apart from every rate, counted for the caption', () => {
    // The live capture's shape: a 30-member season with 182 attacks,
    // 516 stars, and 559.5 cumulative "destruction" would poison any
    // per-war quotient it touched.
    const season = entry({ result: 'league', attacks: 182, stars: 516, destruction: 559.5 });
    const summary = summarizeWarEfficiency([
      entry({ result: 'win', attacks: 5, stars: 15, destruction: 100.0 }),
      season,
      entry({ result: 'lose', attacks: 5, stars: 10, destruction: 80.0 }),
    ]);
    expect(summary.leagues).toBe(1);
    // The rates read the two regular wars only.
    expect(summary.wars).toBe(2);
    expect(summary.winRate).toBe(0.5);
    expect(summary.starsPerAttack).toBe(2.5);
    expect(summary.averageDestruction).toBe(90);
  });

  it('reads null rates for an empty log, not lying zeros', () => {
    const summary = summarizeWarEfficiency([]);
    expect(summary).toEqual({
      wars: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      ongoing: 0,
      leagues: 0,
      decided: 0,
      winRate: null,
      starsPerAttack: null,
      averageDestruction: null,
    });
  });

  it('reads a null win rate when every war is still ongoing', () => {
    const summary = summarizeWarEfficiency([
      entry({ result: 'ongoing', attacks: 4, stars: 10, destruction: 80.0 }),
    ]);
    expect(summary.winRate).toBeNull();
    expect(summary.decided).toBe(0);
    expect(summary.starsPerAttack).toBe(2.5);
  });
});

describe('formatters', () => {
  it('formats a win rate as a whole percentage', () => {
    expect(formatWinRate(0.8)).toBe('80%');
    expect(formatWinRate(1)).toBe('100%');
    expect(formatWinRate(0)).toBe('0%');
    // 7 of 9 rounds to 78%, the precision a short window supports.
    expect(formatWinRate(7 / 9)).toBe('78%');
  });

  it('formats stars per attack with one decimal at most, trailing zeros trimmed', () => {
    expect(formatStarsPerAttack(74 / 28)).toBe('2.6');
    expect(formatStarsPerAttack(3)).toBe('3');
    expect(formatStarsPerAttack(2.5)).toBe('2.5');
  });

  it('formats the record line and names ongoing wars for what they are', () => {
    const decided = summarizeWarEfficiency(smokeClanPage());
    expect(formatRecord(decided)).toBe('4W \u00b7 0L \u00b7 1T');
    const withOngoing = summarizeWarEfficiency([
      ...smokeClanPage(),
      entry({ result: 'ongoing', attacks: 2, stars: 5, destruction: 50.0 }),
    ]);
    expect(formatRecord(withOngoing)).toBe('4W \u00b7 0L \u00b7 1T \u00b7 1 ongoing');
    // A clean sheet drops the tie term entirely.
    const clean = summarizeWarEfficiency([
      entry({ result: 'win', attacks: 5, stars: 15, destruction: 100.0 }),
      entry({ result: 'lose', attacks: 5, stars: 10, destruction: 80.0 }),
    ]);
    expect(formatRecord(clean)).toBe('1W \u00b7 1L');
  });

  it('formats a war end date in the injected locale, deterministically', () => {
    const ms = Date.UTC(2026, 9, 16, 9, 19, 52);
    expect(formatWarLogDate(ms, 'en-US', 'UTC')).toBe('Oct 16, 2026');
    expect(formatWarLogDate(ms, 'en-GB', 'UTC')).toBe('16 Oct 2026');
  });
});
