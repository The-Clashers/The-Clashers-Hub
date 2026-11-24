import { describe, expect, it } from 'vitest';
import {
  attackQuality,
  formatAttackQuality,
  formatStarsPerAttack,
  memberWarImpact,
  orderWarMembersByImpact,
  participantAverageBestQuality,
  warMemberPositions,
} from './war-impact';
import type { WarAttack, WarMember } from '../api/war';

function member(
  tag: string,
  name: string,
  townHallLevel: number,
  mapPosition: number,
  attacks: WarAttack[],
): WarMember {
  return { tag, name, townHallLevel, mapPosition, attacks };
}

function attack(stars: number, destructionPercentage: number): WarAttack {
  return { stars, destructionPercentage };
}

describe('attackQuality', () => {
  it.each([
    { label: 'a perfect attack scores the 400 ceiling', stars: 3, destruction: 100, expected: 400 },
    { label: 'three stars short destruction', stars: 3, destruction: 96, expected: 396 },
    { label: 'two stars mid destruction', stars: 2, destruction: 87, expected: 287 },
    { label: 'one star low destruction', stars: 1, destruction: 42, expected: 142 },
    { label: 'a zero-star failed attack', stars: 0, destruction: 15, expected: 15 },
  ])('scores $label', ({ stars, destruction, expected }) => {
    expect(attackQuality(attack(stars, destruction))).toBe(expected);
  });
});

describe('memberWarImpact', () => {
  it('computes every rate from two used attacks', () => {
    const result = memberWarImpact(
      member('#A1', 'Alpha', 15, 1, [attack(3, 96), attack(2, 80)]),
      2,
    );
    expect(result).toEqual({
      attacksUsed: 2,
      attacksAllowed: 2,
      stars: 5,
      starsPerAttack: 2.5,
      averageDestruction: 88,
      bestAttackQuality: 396,
    });
  });

  it('picks the best attack quality, not the first or the average', () => {
    const result = memberWarImpact(member('#A2', 'Bravo', 14, 2, [attack(2, 90), attack(1, 99)]));
    // 290 versus 199: the two-star attack is the better sheet.
    expect(result.bestAttackQuality).toBe(290);
  });

  it('keeps a member without attacks unjudged: null rates, never zeros', () => {
    const result = memberWarImpact(member('#A3', 'Charlie', 13, 3, []), 2);
    expect(result).toEqual({
      attacksUsed: 0,
      attacksAllowed: 2,
      stars: 0,
      starsPerAttack: null,
      averageDestruction: null,
      bestAttackQuality: null,
    });
  });

  it('leaves the allowance null when the payload does not carry one', () => {
    const result = memberWarImpact(member('#A4', 'Delta', 15, 4, [attack(3, 100)]));
    expect(result.attacksAllowed).toBeNull();
    expect(result.bestAttackQuality).toBe(400);
  });

  it('treats a zero or negative allowance as no data, not as a real limit', () => {
    const result = memberWarImpact(member('#A5', 'Echo', 15, 5, []), 0);
    expect(result.attacksAllowed).toBeNull();
  });

  it('keeps stars per attack honest when the allowance allows thirds', () => {
    const result = memberWarImpact(
      member('#A6', 'Foxtrot', 16, 6, [attack(2, 50), attack(1, 60), attack(0, 70)]),
      3,
    );
    expect(result.starsPerAttack).toBeCloseTo(1, 10);
    expect(result.stars).toBe(3);
  });
});

describe('participantAverageBestQuality', () => {
  it('averages the participants best attacks', () => {
    const roster = [
      member('#A1', 'Alpha', 15, 1, [attack(3, 96)]), // 396
      member('#A2', 'Bravo', 14, 2, [attack(2, 87)]), // 287
    ];
    expect(participantAverageBestQuality(roster)).toBeCloseTo(341.5, 10);
  });

  it('never averages zero-attack members in as zeros', () => {
    const roster = [
      member('#A1', 'Alpha', 15, 1, [attack(3, 96)]), // 396
      member('#A2', 'Bravo', 14, 2, []), // unjudged, not a zero
    ];
    expect(participantAverageBestQuality(roster)).toBe(396);
  });

  it('returns null when nobody has attacked yet', () => {
    const roster = [member('#A1', 'Alpha', 15, 1, []), member('#A2', 'Bravo', 14, 2, [])];
    expect(participantAverageBestQuality(roster)).toBeNull();
  });

  it('returns null for an empty roster', () => {
    expect(participantAverageBestQuality([])).toBeNull();
  });
});

describe('orderWarMembersByImpact', () => {
  it('lists participants by impact first and zero-attack members after', () => {
    const roster = [
      member('#A1', 'Idle One', 15, 1, []),
      member('#A2', 'Two Star', 15, 2, [attack(2, 60)]),
      member('#A3', 'Three Star', 14, 3, [attack(3, 88)]),
      member('#A4', 'Idle Two', 13, 4, []),
    ];
    const ordered = orderWarMembersByImpact(roster);
    expect(ordered.map((m) => m.tag)).toEqual(['#A3', '#A2', '#A1', '#A4']);
  });

  it('breaks a stars tie on best-attack quality', () => {
    const roster = [
      member('#A1', 'Wide But Low', 15, 1, [attack(2, 50), attack(2, 40)]), // 5 stars, best 250
      member('#A2', 'Narrow But High', 15, 2, [attack(2, 95), attack(2, 40)]), // 5 stars, best 295
    ];
    const ordered = orderWarMembersByImpact(roster);
    expect(ordered.map((m) => m.tag)).toEqual(['#A2', '#A1']);
  });

  it('breaks stars and quality ties on average destruction, then map order', () => {
    const roster = [
      member('#A1', 'Lower Average', 15, 1, [attack(2, 70)]),
      member('#A2', 'Higher Average', 15, 2, [attack(2, 90)]),
      member('#A3', 'Exact Tie', 15, 3, [attack(2, 90)]),
    ];
    const ordered = orderWarMembersByImpact(roster);
    // #A2 and #A3 tie on everything; the stable sort keeps the map's
    // own order between them.
    expect(ordered.map((m) => m.tag)).toEqual(['#A2', '#A3', '#A1']);
  });

  it('keeps zero-attack members in map order after the participants', () => {
    const roster = [
      member('#A1', 'Second Idle', 15, 2, []),
      member('#A2', 'First Idle', 15, 1, []),
      member('#A3', 'Attacker', 15, 3, [attack(1, 30)]),
    ];
    const ordered = orderWarMembersByImpact(roster);
    expect(ordered.map((m) => m.tag)).toEqual(['#A3', '#A2', '#A1']);
  });

  it('returns a new array and leaves the input untouched', () => {
    const roster = [member('#A1', 'Idle', 15, 1, []), member('#A2', 'Attacker', 15, 2, [attack(3, 100)])];
    const ordered = orderWarMembersByImpact(roster);
    expect(ordered).not.toBe(roster);
    expect(roster.map((m) => m.tag)).toEqual(['#A1', '#A2']);
    expect(ordered.map((m) => m.tag)).toEqual(['#A2', '#A1']);
  });

  it('passes an all-idle roster through in map order', () => {
    const roster = [
      member('#A1', 'One', 15, 1, []),
      member('#A2', 'Two', 15, 2, []),
    ];
    expect(orderWarMembersByImpact(roster).map((m) => m.tag)).toEqual(['#A1', '#A2']);
  });
});

describe('warMemberPositions', () => {
  it('keeps the war map number for members the payload positions', () => {
    const roster = [
      member('#A1', 'One', 15, 7, []),
      member('#A2', 'Two', 15, 3, []),
    ];
    const positions = warMemberPositions(roster);
    expect(positions.get('#A1')).toBe(7);
    expect(positions.get('#A2')).toBe(3);
  });

  it('falls back to the payload index when no map position came back', () => {
    const roster = [
      member('#A1', 'One', 15, 0, []),
      member('#A2', 'Two', 15, 0, []),
    ];
    const positions = warMemberPositions(roster);
    expect(positions.get('#A1')).toBe(1);
    expect(positions.get('#A2')).toBe(2);
  });
});

describe('formatters', () => {
  it.each([
    { value: 2.5, expected: '2.5' },
    { value: 3, expected: '3' },
    { value: 5 / 3, expected: '1.67' },
    { value: 1.25, expected: '1.25' },
  ])('formats stars per attack $value as $expected', ({ value, expected }) => {
    expect(formatStarsPerAttack(value)).toBe(expected);
  });

  it.each([
    { value: 396, expected: '396' },
    { value: 400, expected: '400' },
    { value: 286.4, expected: '286' },
  ])('formats attack quality $value as $expected', ({ value, expected }) => {
    expect(formatAttackQuality(value)).toBe(expected);
  });
});
