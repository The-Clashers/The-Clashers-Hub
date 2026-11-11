import { describe, expect, it } from 'vitest';
import {
  formatWarClock,
  formatWarPercent,
  leadingSide,
  memberAverageDestruction,
  memberStars,
} from './war-standings';
import type { WarClan, WarMember } from '../api/war';

// Table-driven tests for the war standings helpers (05 section 5, the
// same split every lib module keeps): the lead rule over both standings
// dimensions, the per-member aggregates over participation mixes, and the
// two formatters at their precision edges.

function clan(overrides: Partial<WarClan> = {}): WarClan {
  return {
    tag: '#CLAN',
    name: 'Clan',
    badgeUrl: null,
    clanLevel: 1,
    stars: 0,
    destructionPercentage: 0,
    attackCount: 0,
    members: [],
    ...overrides,
  };
}

function member(overrides: Partial<WarMember> = {}): WarMember {
  return {
    tag: '#MEMBER',
    name: 'Member',
    townHallLevel: 15,
    mapPosition: 1,
    attacks: [],
    ...overrides,
  };
}

describe('leadingSide', () => {
  it('favors the side with more stars', () => {
    expect(leadingSide(clan({ stars: 12 }), clan({ stars: 6 }))).toBe('clan');
    expect(leadingSide(clan({ stars: 3 }), clan({ stars: 9 }))).toBe('opponent');
  });

  it('breaks star ties on destruction percentage', () => {
    expect(leadingSide(clan({ stars: 10, destructionPercentage: 82.4 }), clan({ stars: 10, destructionPercentage: 81.9 }))).toBe('clan');
    expect(leadingSide(clan({ stars: 10, destructionPercentage: 44.2 }), clan({ stars: 10, destructionPercentage: 51 }))).toBe('opponent');
  });

  it('calls an even war a tie', () => {
    expect(
      leadingSide(
        clan({ stars: 10, destructionPercentage: 80 }),
        clan({ stars: 10, destructionPercentage: 80 }),
      ),
    ).toBe('tie');
  });

  it('reads a fresh preparation-day war as a tie without inventing a leader', () => {
    expect(leadingSide(clan(), clan())).toBe('tie');
  });
});

describe('memberStars', () => {
  it('sums the stars across every attack the member used', () => {
    const participant = member({
      attacks: [
        { stars: 3, destructionPercentage: 100 },
        { stars: 2, destructionPercentage: 64 },
      ],
    });
    expect(memberStars(participant)).toBe(5);
  });

  it('reads zero for a member who has not attacked', () => {
    expect(memberStars(member())).toBe(0);
  });
});

describe('memberAverageDestruction', () => {
  it('averages the destruction across used attacks', () => {
    const participant = member({
      attacks: [
        { stars: 3, destructionPercentage: 98 },
        { stars: 2, destructionPercentage: 64.32 },
      ],
    });
    expect(memberAverageDestruction(participant)).toBeCloseTo(81.16, 2);
  });

  it('carries a single attack through unchanged', () => {
    const single = member({ attacks: [{ stars: 1, destructionPercentage: 40 }] });
    expect(memberAverageDestruction(single)).toBe(40);
  });

  it('returns null for zero attacks, never a zero average', () => {
    expect(memberAverageDestruction(member())).toBeNull();
  });
});

describe('formatWarPercent', () => {
  it("keeps one decimal at most, the precision the API's own standings carry", () => {
    expect(formatWarPercent(33.8)).toBe('33.8%');
    expect(formatWarPercent(87.34)).toBe('87.3%');
    expect(formatWarPercent(44.25)).toBe('44.3%');
  });

  it('trims a clean percentage instead of showing a decimal zero', () => {
    expect(formatWarPercent(100)).toBe('100%');
    expect(formatWarPercent(0)).toBe('0%');
  });
});

describe('formatWarClock', () => {
  // The instant is fixed and the locale and time zone are injected, so
  // the expectation is deterministic on every machine and CI runner.
  const instant = Date.UTC(2026, 10, 14, 18, 30, 0);

  it('formats the weekday, date, and time in the given locale', () => {
    expect(formatWarClock(instant, 'en-US', 'UTC')).toBe('Sat, Nov 14, 6:30 PM');
  });

  it('respects the injected time zone', () => {
    expect(formatWarClock(instant, 'en-US', 'Asia/Manila')).toBe('Sun, Nov 15, 2:30 AM');
  });
});
