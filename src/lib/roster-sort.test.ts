import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLAN_ORDER,
  nextRosterSortState,
  sortRoster,
  type RosterSortableMember,
  type RosterSortState,
} from './roster-sort';

// Table-driven tests (NFR-07). One factory so every case reads the same
// member shape the API client parses.

let nextRank = 1;

function member(overrides: Partial<RosterSortableMember>): RosterSortableMember {
  return {
    tag: '#PLAYER',
    name: 'Player',
    role: 'member',
    townHallLevel: 12,
    trophies: 2000,
    donations: 100,
    donationsReceived: 100,
    expLevel: 100,
    clanRank: nextRank++,
    ...overrides,
  };
}

// Reset the auto rank between tests so fixtures stay readable.
beforeEach(() => {
  nextRank = 1;
});

const fixture = () => [
  member({ tag: '#AAA', name: 'Anna', role: 'member', townHallLevel: 10, trophies: 3000, donations: 500, donationsReceived: 900, expLevel: 120, clanRank: 3 }),
  member({ tag: '#BBB', name: 'Ben', role: 'admin', townHallLevel: 14, trophies: 5000, donations: 900, donationsReceived: 200, expLevel: 180, clanRank: 2 }),
  member({ tag: '#CCC', name: 'Cleo', role: 'leader', townHallLevel: 12, trophies: 4000, donations: 700, donationsReceived: 700, expLevel: 150, clanRank: 1 }),
  member({ tag: '#DDD', name: 'Dora', role: 'coLeader', townHallLevel: 16, trophies: 6000, donations: 200, donationsReceived: 400, expLevel: 210, clanRank: 4 }),
];

const tags = (rows: RosterSortableMember[]) => rows.map((row) => row.tag);

describe('sortRoster', () => {
  it.each([
    ['role', 'asc', ['#CCC', '#DDD', '#BBB', '#AAA']],
    ['role', 'desc', ['#AAA', '#BBB', '#DDD', '#CCC']],
    ['townHall', 'asc', ['#AAA', '#CCC', '#BBB', '#DDD']],
    ['townHall', 'desc', ['#DDD', '#BBB', '#CCC', '#AAA']],
    ['trophies', 'asc', ['#AAA', '#CCC', '#BBB', '#DDD']],
    ['trophies', 'desc', ['#DDD', '#BBB', '#CCC', '#AAA']],
    ['donations', 'asc', ['#DDD', '#AAA', '#CCC', '#BBB']],
    ['donations', 'desc', ['#BBB', '#CCC', '#AAA', '#DDD']],
    ['received', 'asc', ['#BBB', '#DDD', '#CCC', '#AAA']],
    ['received', 'desc', ['#AAA', '#CCC', '#DDD', '#BBB']],
    ['xp', 'asc', ['#AAA', '#CCC', '#BBB', '#DDD']],
    ['xp', 'desc', ['#DDD', '#BBB', '#CCC', '#AAA']],
  ] as const)('sorts by %s %s', (key, direction, expected) => {
    const state: RosterSortState = { key, direction };
    expect(tags(sortRoster(fixture(), state))).toEqual(expected);
  });

  it('returns clan order (the API order) when no column is active', () => {
    expect(tags(sortRoster(fixture(), CLAN_ORDER))).toEqual(['#AAA', '#BBB', '#CCC', '#DDD']);
  });

  it('never mutates the input array', () => {
    const input = fixture();
    const inputBefore = tags(input).join(',');
    sortRoster(input, { key: 'trophies', direction: 'desc' });
    expect(tags(input).join(',')).toBe(inputBefore);
  });

  it('returns a new array, not the input reference', () => {
    const input = fixture();
    const sorted = sortRoster(input, CLAN_ORDER);
    expect(sorted).not.toBe(input);
    expect(sorted).toEqual(input);
  });

  it('tie-breaks equal primary values by clan rank ascending in both directions', () => {
    const tied = [
      member({ tag: '#LOWRANK', name: 'Zoe', trophies: 5000, clanRank: 2 }),
      member({ tag: '#HIGHRANK', name: 'Alf', trophies: 5000, clanRank: 7 }),
    ];
    expect(tags(sortRoster(tied, { key: 'trophies', direction: 'asc' }))).toEqual(['#LOWRANK', '#HIGHRANK']);
    expect(tags(sortRoster(tied, { key: 'trophies', direction: 'desc' }))).toEqual(['#LOWRANK', '#HIGHRANK']);
  });

  it('falls back to name, then tag, when clan rank is missing', () => {
    const tied = [
      member({ tag: '#ZZZ', name: 'Same', trophies: 1000, clanRank: undefined }),
      member({ tag: '#AAA', name: 'Same', trophies: 1000, clanRank: undefined }),
      member({ tag: '#MMM', name: 'Earlier', trophies: 1000, clanRank: undefined }),
    ];
    expect(tags(sortRoster(tied, { key: 'trophies', direction: 'desc' }))).toEqual(['#MMM', '#AAA', '#ZZZ']);
  });

  it('sorts an unknown role after every known rank', () => {
    const withNewRole = [
      member({ tag: '#NEW', name: 'New', role: 'brandNewRank' }),
      member({ tag: '#MEM', name: 'Mem', role: 'member' }),
    ];
    expect(tags(sortRoster(withNewRole, { key: 'role', direction: 'asc' }))).toEqual(['#MEM', '#NEW']);
  });
});

describe('nextRosterSortState', () => {
  it('cycles a fresh column through clan order, asc, desc, and back', () => {
    const first = nextRosterSortState('donations', CLAN_ORDER);
    expect(first).toEqual({ key: 'donations', direction: 'asc' });
    const second = nextRosterSortState('donations', first);
    expect(second).toEqual({ key: 'donations', direction: 'desc' });
    const third = nextRosterSortState('donations', second);
    expect(third).toEqual(CLAN_ORDER);
  });

  it('starts a different column at asc regardless of the previous state', () => {
    const donationsDesc: RosterSortState = { key: 'donations', direction: 'desc' };
    expect(nextRosterSortState('trophies', donationsDesc)).toEqual({ key: 'trophies', direction: 'asc' });
  });
});
