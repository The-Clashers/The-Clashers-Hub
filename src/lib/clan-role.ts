// Clan role table for the roster (T-M1-4).
//
// The game API hands the roster rows a raw `role` string: "leader",
// "coLeader", "admin", "member". Two rules read that string and both live
// here so they can never drift:
//
// - The display label. The game's own UI calls the "admin" rank Elder, so
//   the roster says Elder too; a data tool should use the words players
//   actually see in-game, not the API's internal name.
// - The sort order. FR-04 makes role a sortable column, and an alphabetic
//   sort of the raw strings ("admin" < "coLeader" < "leader" < "member")
//   would put the leader last, which reads backwards on every clan screen.
//   The rank here orders by seniority: leader first when ascending.
//
// Same shape as lib/war-frequency.ts: one raw API string in, one table out,
// pure and unit-testable without rendering anything.

/**
 * The raw `role` strings the game API puts on clan member rows, in
 * seniority order (most senior first). This order is the sort order; the
 * labels below are the display side of the same table.
 */
export const CLAN_ROLES = ['leader', 'coLeader', 'admin', 'member'] as const;

export type ClanRole = (typeof CLAN_ROLES)[number];

/**
 * Display labels, using the in-game rank names. "admin" is Elder in the
 * game's UI; everything else maps one-to-one.
 */
export const CLAN_ROLE_LABELS: Record<ClanRole, string> = {
  leader: 'Leader',
  coLeader: 'Co-leader',
  admin: 'Elder',
  member: 'Member',
};

/**
 * Sort rank for a raw role string: 0 for leader through 3 for member.
 * Unknown strings (a future API role, or junk) sort after every known
 * rank instead of throwing, so one odd row cannot break the roster sort.
 */
export function clanRoleRank(role: string): number {
  const index = CLAN_ROLES.indexOf(role as ClanRole);
  return index === -1 ? CLAN_ROLES.length : index;
}

/**
 * Display label for a raw role string. Unknown strings degrade to the
 * raw string itself (title-cased reads better than an empty cell) rather
 * than dropping the column value entirely.
 */
export function clanRoleLabel(role: string): string {
  const known = CLAN_ROLES.includes(role as ClanRole);
  if (known) return CLAN_ROLE_LABELS[role as ClanRole];
  if (role.length === 0) return 'Member';
  return role.charAt(0).toUpperCase() + role.slice(1);
}
