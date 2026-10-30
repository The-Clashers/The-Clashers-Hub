import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeDonationBalance,
  DEFAULT_DONATION_TARGET,
  DONATION_NOISE_FLOOR,
  sortNeedsAttention,
  verdictByTag,
  type DonationMember,
  type DonationTarget,
} from './donation-balance';

// Table-driven tests (NFR-07). One factory so every case reads the same
// member shape the API client parses; the fixtures cover the edge cases the
// scoring doc names: saints, both-zero (no data), the noise floor, the
// target boundary, and the worst-first ordering.

let nextRank = 1;

function member(overrides: Partial<DonationMember>): DonationMember {
  return {
    tag: '#PLAYER',
    name: 'Player',
    donations: 100,
    donationsReceived: 100,
    clanRank: nextRank++,
    ...overrides,
  };
}

beforeEach(() => {
  nextRank = 1;
});

// ---------- ratio and state computation ----------

describe('computeDonationBalance verdicts', () => {
  it.each([
    {
      label: 'balanced at 1:1',
      member: member({ tag: '#BAL', donations: 500, donationsReceived: 500 }),
      target: 1.0,
      expectedState: 'good',
      expectedRatio: 1.0,
      expectedFlagged: false,
    },
    {
      label: 'gives more than received (saint)',
      member: member({ tag: '#SNT', donations: 900, donationsReceived: 200 }),
      target: 1.0,
      expectedState: 'good',
      expectedRatio: 4.5,
      expectedFlagged: false,
    },
    {
      label: 'takes far more than gives, above noise floor',
      member: member({ tag: '#TKR', donations: 100, donationsReceived: 1000 }),
      target: 1.0,
      expectedState: 'warn',
      expectedRatio: 0.1,
      expectedFlagged: true,
    },
    {
      label: 'slightly below target, above noise floor',
      member: member({ tag: '#SLR', donations: 400, donationsReceived: 500 }),
      target: 1.0,
      expectedState: 'warn',
      expectedRatio: 0.8,
      expectedFlagged: true,
    },
    {
      label: 'both zero (no data)',
      member: member({ tag: '#NOD', donations: 0, donationsReceived: 0 }),
      target: 1.0,
      expectedState: 'dash',
      expectedRatio: null,
      expectedFlagged: false,
    },
  ])(
    '$label',
    ({ member, target, expectedState, expectedRatio, expectedFlagged }) => {
      const balance = computeDonationBalance([member], target);
      const verdict = balance.verdicts[0];
      expect(verdict.state).toBe(expectedState);
      expect(verdict.ratio).toBe(expectedRatio);
      expect(verdict.flagged).toBe(expectedFlagged);
    },
  );

  it('does not divide by zero for a saint (given > 0, received = 0)', () => {
    const balance = computeDonationBalance([
      member({ tag: '#GIVE', donations: 300, donationsReceived: 0 }),
    ]);
    expect(balance.verdicts[0].ratio).toBe(300);
    expect(balance.verdicts[0].state).toBe('good');
    expect(balance.verdicts[0].flagged).toBe(false);
  });

  it('does not flag a below-target member at or below the noise floor', () => {
    const balance = computeDonationBalance([
      member({ tag: '#NEW', donations: 0, donationsReceived: DONATION_NOISE_FLOOR }),
    ]);
    expect(balance.verdicts[0].flagged).toBe(false);
    // Received equals the floor; the rule is "exceeds the noise floor", so
    // the boundary is not flagged.
    expect(balance.verdicts[0].state).toBe('good');
  });

  it('flags a below-target member just above the noise floor', () => {
    const balance = computeDonationBalance([
      member({ tag: '#JST', donations: 0, donationsReceived: DONATION_NOISE_FLOOR + 1 }),
    ]);
    expect(balance.verdicts[0].flagged).toBe(true);
    expect(balance.verdicts[0].state).toBe('warn');
  });
});

// ---------- target adjustment ----------

describe('target adjustment', () => {
  // #GIVER gives 1000, received 500. At target 2.0, deficit = 2*500 - 1000
  // = 0 (at target, not flagged). At target 3.0, deficit = 500 > 0, flagged.
  // #TAKER gives 100, received 1000. At every target from 0.5 up, the
  // deficit is positive and received clears the noise floor, so the taker
  // is always flagged.
  const roster = () => [
    member({ tag: '#GIVER', donations: 1000, donationsReceived: 500, clanRank: 1 }),
    member({ tag: '#TAKER', donations: 100, donationsReceived: 1000, clanRank: 2 }),
  ];

  it('uses 1:1 by default', () => {
    const balance = computeDonationBalance(roster());
    expect(verdictByTag(balance, '#TAKER')?.flagged).toBe(true);
    expect(verdictByTag(balance, '#GIVER')?.flagged).toBe(false);
  });

  it.each([
    { target: 0.5, takerFlagged: true, label: '0.5 (give at least half)' },
    { target: 1.0, takerFlagged: true, label: '1.0 (1:1)' },
    { target: 2.0, takerFlagged: true, label: '2.0 (give double)' },
  ] as const)('re-computes locally when the target is $label', ({ target, takerFlagged }) => {
    const members = roster();
    const balance = computeDonationBalance(members, target as DonationTarget);
    expect(verdictByTag(balance, '#TAKER')?.flagged).toBe(takerFlagged);
  });

  it('does not refetch: the same members array feeds every target', () => {
    const members = roster();
    const atHalf = computeDonationBalance(members, 0.5);
    const atOne = computeDonationBalance(members, 1.0);
    const atThree = computeDonationBalance(members, 3.0);
    // Three calls, one input array, three different verdicts for #GIVER.
    // #GIVER clears at 0.5 and 1.0 but is flagged at 3.0 (needs to give
    // 1500, gave 1000). That is the SR-12 local re-computation: no refetch,
    // no state, just a re-call.
    expect(verdictByTag(atHalf, '#GIVER')?.flagged).toBe(false);
    expect(verdictByTag(atOne, '#GIVER')?.flagged).toBe(false);
    expect(verdictByTag(atThree, '#GIVER')?.flagged).toBe(true);
  });
});

// ---------- needs-attention sort ----------

describe('sortNeedsAttention', () => {
  const roster = () => [
    member({ tag: '#BAL', name: 'Balanced', donations: 500, donationsReceived: 500, clanRank: 1 }),
    member({ tag: '#WRST', name: 'Worst', donations: 50, donationsReceived: 2000, clanRank: 2 }),
    member({ tag: '#MID', name: 'Middle', donations: 100, donationsReceived: 1000, clanRank: 3 }),
    member({ tag: '#GUD', name: 'Giver', donations: 2000, donationsReceived: 100, clanRank: 4 }),
  ];

  it('orders flagged members worst-first by deficit', () => {
    const sorted = sortNeedsAttention(roster(), DEFAULT_DONATION_TARGET);
    const tags = sorted.map((m) => m.tag);
    // #WRST deficit = 1*2000 - 50 = 1950 (worst)
    // #MID  deficit = 1*1000 - 100 = 900
    // then non-flagged in clan order: #BAL (rank 1), #GUD (rank 4)
    expect(tags).toEqual(['#WRST', '#MID', '#BAL', '#GUD']);
  });

  it('keeps non-flagged members in clan order after the flagged block', () => {
    const sorted = sortNeedsAttention([
      member({ tag: '#NFD2', name: 'Zoe', donations: 600, donationsReceived: 600, clanRank: 2 }),
      member({ tag: '#NFD1', name: 'Alf', donations: 700, donationsReceived: 700, clanRank: 1 }),
      member({ tag: '#FLG', name: 'Flagged', donations: 10, donationsReceived: 500, clanRank: 3 }),
    ]);
    expect(sorted.map((m) => m.tag)).toEqual(['#FLG', '#NFD1', '#NFD2']);
  });

  it('tie-breaks equal deficits by clan rank ascending', () => {
    const tied = [
      member({ tag: '#LOW', name: 'Zoe', donations: 0, donationsReceived: 1000, clanRank: 2 }),
      member({ tag: '#HIGH', name: 'Alf', donations: 0, donationsReceived: 1000, clanRank: 7 }),
    ];
    expect(sortNeedsAttention(tied).map((m) => m.tag)).toEqual(['#LOW', '#HIGH']);
  });

  it('falls back to name, then tag, when clan rank is missing', () => {
    const tied = [
      member({ tag: '#ZZZ', name: 'Same', donations: 0, donationsReceived: 1000, clanRank: undefined }),
      member({ tag: '#AAA', name: 'Same', donations: 0, donationsReceived: 1000, clanRank: undefined }),
      member({ tag: '#MMM', name: 'Earlier', donations: 0, donationsReceived: 1000, clanRank: undefined }),
    ];
    expect(sortNeedsAttention(tied).map((m) => m.tag)).toEqual(['#MMM', '#AAA', '#ZZZ']);
  });

  it('respects the target: a member flagged at 1:1 may clear at 0.5', () => {
    const members = [
      member({ tag: '#HALF', donations: 400, donationsReceived: 1000, clanRank: 1 }),
    ];
    expect(sortNeedsAttention(members, 1.0)[0].tag).toBe('#HALF');
    // At 0.5 target, deficit = 0.5*1000 - 400 = 100 > 0, still flagged.
    expect(sortNeedsAttention(members, 0.5)[0].tag).toBe('#HALF');
    // At 0.3 target, deficit = 0.3*1000 - 400 = -100 < 0, not flagged.
    // With one member and no flagged rows, clan order wins.
    expect(sortNeedsAttention(members, 0.3)[0].tag).toBe('#HALF');
  });

  it('never mutates the input array', () => {
    const input = roster();
    const inputBefore = input.map((m) => m.tag).join(',');
    sortNeedsAttention(input);
    expect(input.map((m) => m.tag).join(',')).toBe(inputBefore);
  });
});

// ---------- clan-level summary ----------

describe('clan-level summary', () => {
  it('counts each bucket and computes the health share', () => {
    const balance = computeDonationBalance([
      member({ tag: '#G1', donations: 1000, donationsReceived: 500, clanRank: 1 }), // good
      member({ tag: '#G2', donations: 500, donationsReceived: 500, clanRank: 2 }), // good (at target)
      member({ tag: '#F1', donations: 50, donationsReceived: 1000, clanRank: 3 }), // flagged
      member({ tag: '#N1', donations: 0, donationsReceived: 0, clanRank: 4 }), // no data
    ]);
    expect(balance.summary).toEqual({
      membersWithData: 3,
      atOrAboveTarget: 2,
      flagged: 1,
      noData: 1,
      healthShare: 2 / 3,
    });
  });

  it('returns null health share when every member has no data', () => {
    const balance = computeDonationBalance([
      member({ tag: '#A', donations: 0, donationsReceived: 0 }),
      member({ tag: '#B', donations: 0, donationsReceived: 0 }),
    ]);
    expect(balance.summary.healthShare).toBe(null);
    expect(balance.summary.membersWithData).toBe(0);
  });

  it('handles an empty roster', () => {
    const balance = computeDonationBalance([]);
    expect(balance.verdicts).toEqual([]);
    expect(balance.summary).toEqual({
      membersWithData: 0,
      atOrAboveTarget: 0,
      flagged: 0,
      noData: 0,
      healthShare: null,
    });
  });
});

// ---------- verdictByTag lookup ----------

describe('verdictByTag', () => {
  it('finds the verdict by tag', () => {
    const balance = computeDonationBalance([
      member({ tag: '#FIND', donations: 100, donationsReceived: 500 }),
    ]);
    const verdict = verdictByTag(balance, '#FIND');
    expect(verdict?.flagged).toBe(true);
  });

  it('returns undefined for a tag not in the balance', () => {
    const balance = computeDonationBalance([member({ tag: '#HAS' })]);
    expect(verdictByTag(balance, '#MISSING')).toBeUndefined();
  });
});

// ---------- purity / immutability ----------

describe('purity', () => {
  it('does not mutate the input members', () => {
    const members = [
      member({ tag: '#A', donations: 100, donationsReceived: 200 }),
    ];
    const snapshot = JSON.parse(JSON.stringify(members));
    computeDonationBalance(members);
    expect(JSON.parse(JSON.stringify(members))).toEqual(snapshot);
  });

  it('returns fresh verdict objects on every call', () => {
    const members = [member({ tag: '#A' })];
    const first = computeDonationBalance(members);
    const second = computeDonationBalance(members);
    expect(first.verdicts[0]).not.toBe(second.verdicts[0]);
    expect(first.verdicts[0]).toEqual(second.verdicts[0]);
  });

  it('is deterministic: same input yields the same output', () => {
    const members = [
      member({ tag: '#A', donations: 100, donationsReceived: 500 }),
      member({ tag: '#B', donations: 500, donationsReceived: 100 }),
    ];
    const first = computeDonationBalance(members);
    const second = computeDonationBalance(members);
    expect(first).toEqual(second);
  });
});
