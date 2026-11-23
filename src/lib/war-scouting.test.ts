import { describe, expect, it } from 'vitest';
import { buildScoutingPairs } from './war-scouting';
import type { WarMember } from '../api/war';

function member(
  tag: string,
  name: string,
  townHallLevel: number,
  mapPosition: number,
): WarMember {
  return {
    tag,
    name,
    townHallLevel,
    mapPosition,
    attacks: [],
  };
}

describe('buildScoutingPairs', () => {
  it('returns empty pairs and zero mismatches when both rosters are empty', () => {
    expect(buildScoutingPairs([], [])).toEqual({
      pairs: [],
      mismatchCount: 0,
    });
  });

  it.each([
    { label: 'even Town Halls', ownTh: 15, oppTh: 15, expectedMismatch: false, expectedDelta: 0 },
    { label: 'own Town Hall higher', ownTh: 16, oppTh: 14, expectedMismatch: false, expectedDelta: -2 },
    { label: 'own Town Hall lower by 1', ownTh: 14, oppTh: 15, expectedMismatch: true, expectedDelta: 1 },
    { label: 'own Town Hall lower by 3', ownTh: 12, oppTh: 15, expectedMismatch: true, expectedDelta: 3 },
    { label: 'own Town Hall unknown (0)', ownTh: 0, oppTh: 15, expectedMismatch: false, expectedDelta: 0 },
    { label: 'opponent Town Hall unknown (0)', ownTh: 14, oppTh: 0, expectedMismatch: false, expectedDelta: 0 },
  ])('evaluates mismatch for $label', ({ ownTh, oppTh, expectedMismatch, expectedDelta }) => {
    const own = [member('#OWN1', 'Alpha', ownTh, 1)];
    const opp = [member('#OPP1', 'Bravo', oppTh, 1)];

    const result = buildScoutingPairs(own, opp);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].isMismatch).toBe(expectedMismatch);
    expect(result.pairs[0].townHallDelta).toBe(expectedDelta);
    expect(result.mismatchCount).toBe(expectedMismatch ? 1 : 0);
  });

  it('pairs a full preparation-day roster and counts all mismatches', () => {
    const own = [
      member('#O1', 'Lead', 16, 1),
      member('#O2', 'Second', 14, 2),
      member('#O3', 'Third', 14, 3),
      member('#O4', 'Fourth', 13, 4),
      member('#O5', 'Fifth', 12, 5),
    ];
    const opp = [
      member('#E1', 'EnemyLead', 16, 1),
      member('#E2', 'EnemySecond', 15, 2),
      member('#E3', 'EnemyThird', 13, 3),
      member('#E4', 'EnemyFourth', 15, 4),
      member('#E5', 'EnemyFifth', 12, 5),
    ];

    const result = buildScoutingPairs(own, opp);

    expect(result.pairs.map((pair) => pair.position)).toEqual([1, 2, 3, 4, 5]);
    expect(result.pairs.map((pair) => pair.isMismatch)).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(result.mismatchCount).toBe(2);
  });

  it('handles uneven roster lengths without flagging missing slots as mismatches', () => {
    const own = [member('#O1', 'Alpha', 14, 1), member('#O2', 'Beta', 13, 2)];
    const opp = [member('#E1', 'Enemy', 15, 1)];

    const result = buildScoutingPairs(own, opp);

    expect(result.pairs).toHaveLength(2);
    expect(result.pairs[0].isMismatch).toBe(true);
    expect(result.pairs[1].own?.tag).toBe('#O2');
    expect(result.pairs[1].opponent).toBeNull();
    expect(result.pairs[1].isMismatch).toBe(false);
    expect(result.pairs[1].townHallDelta).toBe(0);
    expect(result.mismatchCount).toBe(1);
  });

  it('falls back to 1-based slot index when mapPosition is 0', () => {
    const own = [member('#O1', 'Alpha', 14, 0)];
    const opp = [member('#E1', 'Enemy', 15, 0)];

    const result = buildScoutingPairs(own, opp);

    expect(result.pairs[0].position).toBe(1);
    expect(result.pairs[0].key).toBe('#O1:#E1:1');
  });
});
