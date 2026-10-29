import { describe, expect, it } from 'vitest';
import {
  CLAN_ROLES,
  CLAN_ROLE_LABELS,
  clanRoleLabel,
  clanRoleRank,
} from './clan-role';

// Table-driven tests (NFR-07): every row of the table is one case, and the
// shape of the test mirrors the shape of the rule.

describe('clanRoleRank', () => {
  it('ranks every known role by seniority, leader first', () => {
    CLAN_ROLES.forEach((role, index) => {
      expect(clanRoleRank(role)).toBe(index);
    });
  });

  it('sorts an unknown role after every known rank', () => {
    expect(clanRoleRank('brandNewRole')).toBe(CLAN_ROLES.length);
    expect(clanRoleRank('')).toBe(CLAN_ROLES.length);
  });
});

describe('clanRoleLabel', () => {
  it('labels every known role with its in-game name', () => {
    const expected: Record<string, string> = {
      leader: 'Leader',
      coLeader: 'Co-leader',
      admin: 'Elder',
      member: 'Member',
    };
    CLAN_ROLES.forEach((role) => {
      expect(clanRoleLabel(role)).toBe(expected[role]);
    });
  });

  it('title-cases an unknown role instead of dropping it', () => {
    expect(clanRoleLabel('brandNewRole')).toBe('BrandNewRole');
  });

  it('reads an empty role as Member, not a blank cell', () => {
    expect(clanRoleLabel('')).toBe('Member');
  });

  it('labels table stays in one-to-one sync with the role list', () => {
    expect(Object.keys(CLAN_ROLE_LABELS).sort()).toEqual([...CLAN_ROLES].sort());
  });
});
