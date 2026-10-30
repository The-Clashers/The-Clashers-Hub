import { describe, expect, it } from 'vitest';
import { leagueNameWithoutRank, leagueRankFromTierName } from './league-rank';

// Table-driven tests (NFR-07): every row is one case, the table mirrors the
// rule. The fixtures are the live tier names the 2025 ladder hands back
// plus the shapes that must degrade to null.

describe('leagueRankFromTierName', () => {
  it('parses the rank out of the live themed tier names', () => {
    const cases: ReadonlyArray<[string, number]> = [
      ['Electro League 31', 31],
      ['Witch League 18', 18],
      ['Bronze League 2', 2],
      ['Legend League 140', 140],
    ];
    cases.forEach(([name, expected]) => {
      expect(leagueRankFromTierName(name)).toBe(expected);
    });
  });

  it('returns null for names without a trailing rank', () => {
    const cases: ReadonlyArray<string> = [
      'Unranked',
      'Electro League',
      'Electro League 31st',
      'Electro31',
      '',
    ];
    cases.forEach((name) => {
      expect(leagueRankFromTierName(name)).toBeNull();
    });
  });

  it('returns null for missing names', () => {
    expect(leagueRankFromTierName(undefined)).toBeNull();
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(leagueRankFromTierName('  Electro League 31  ')).toBe(31);
  });

  it('normalizes leading zeros in the rank', () => {
    expect(leagueRankFromTierName('Bronze League 007')).toBe(7);
  });

  it('does not strip a number that is part of the league word', () => {
    // "League2 9" would break if the rule matched digits glued to letters.
    expect(leagueRankFromTierName('League2 9')).toBe(9);
  });
});

describe('leagueNameWithoutRank', () => {
  it('strips the trailing rank and keeps the league name', () => {
    expect(leagueNameWithoutRank('Electro League 31')).toBe('Electro League');
    expect(leagueNameWithoutRank('Witch League 18')).toBe('Witch League');
  });

  it('returns names without a rank unchanged', () => {
    expect(leagueNameWithoutRank('Unranked')).toBe('Unranked');
    expect(leagueNameWithoutRank('Electro League')).toBe('Electro League');
  });

  it('returns an empty string for a missing name', () => {
    expect(leagueNameWithoutRank(undefined)).toBe('');
    expect(leagueNameWithoutRank('')).toBe('');
  });
});
