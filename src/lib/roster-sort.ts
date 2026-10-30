// Roster sorting (T-M1-4, FR-04, SR-11).
//
// The sortable columns the requirements name: role, Town Hall, trophies,
// donations given, donations received, XP. The rule lives here, not in the
// roster components, so it is pure and table-testable without rendering
// anything (STD-09, same split as lib/tag.ts). The components own the
// presses; this module owns what a press means for the row order.
//
// Three deliberate choices:
//
// - The default is the clan's own order. The game API returns memberList
//   ordered by clan rank (trophy position inside the clan), and that order
//   is familiar to every player who has opened the in-game roster, so the
//   table starts there and only re-orders once a column is pressed.
// - Pressing a column cycles asc -> desc -> back to clan order. The third
//   state matters: after sorting by donations a leader still needs a one
//   press way back to the familiar default, not a page reload.
// - Equal rows tie-break deterministically (clan rank, then name, then
//   tag) so flipping a sort direction never shuffles tied rows at random.
//   The tiebreaks are ascending in both directions; only the primary
//   column follows the direction.
//
// The card presentation (below 768 px) has no column headers to press, so
// it drives the same state through a dropdown plus a direction toggle
// instead of the header cycle. Two more rules cover it: selecting a column
// from the dropdown never silently flips a direction the user already
// chose (re-picking the active column is a no-op; a different column
// starts at asc, like the table), and the toggle flips only the direction,
// which is why it renders disabled while the roster is in clan order.

import { clanRoleRank } from './clan-role';

/** The six sortable columns (FR-04). Keys are column ids; the field each
 * one reads off a member row is documented on {@link RosterSortableMember}. */
export type RosterSortKey = 'role' | 'townHall' | 'trophies' | 'donations' | 'received' | 'xp';

export type RosterSortDirection = 'asc' | 'desc';

/** Sort state for the roster table. `key: null` means clan order (the
 * order the game API returned), the default before any column is pressed. */
export interface RosterSortState {
  key: RosterSortKey | null;
  direction: RosterSortDirection;
}

/** The default state: clan order, no column active. */
export const CLAN_ORDER: RosterSortState = { key: null, direction: 'asc' };

/**
 * The member fields the sort reads. Structural on purpose: the parsed
 * ClanMember from api/clan.ts satisfies it, and so does any test fixture,
 * without the sort importing the client (the rule stays UI-free).
 */
export interface RosterSortableMember {
  tag: string;
  name: string;
  /** Raw API role string; ranked through lib/clan-role.ts. */
  role: string;
  townHallLevel: number;
  trophies: number;
  donations: number;
  donationsReceived: number;
  expLevel: number;
  /** Position inside the clan, the API's own ordering; optional because a
   * degraded payload may omit it, and the name/tag tiebreaks take over. */
  clanRank?: number;
}

/**
 * The press cycle for a column header: clan order -> asc -> desc -> clan
 * order. Pressing a different column starts that column fresh at asc,
 * whatever the previous column was doing.
 */
export function nextRosterSortState(pressed: RosterSortKey, current: RosterSortState): RosterSortState {
  if (current.key !== pressed) {
    return { key: pressed, direction: 'asc' };
  }
  if (current.direction === 'asc') {
    return { key: pressed, direction: 'desc' };
  }
  return CLAN_ORDER;
}

/** A dropdown selection: the clan-order reset or one of the six columns.
 * The value type of the card presentation's sort dropdown. */
export type RosterSortSelection = 'clan' | RosterSortKey;

/**
 * What picking an option in the card presentation's sort dropdown means:
 * "Clan order" resets, the active column re-picked is a no-op (the
 * direction is the toggle's job, so a re-pick never silently reverses
 * it), and any other column starts fresh at asc, the same start the
 * table's cycle gives a newly pressed column.
 */
export function rosterSortForSelection(
  selection: RosterSortSelection,
  current: RosterSortState,
): RosterSortState {
  if (selection === 'clan') {
    return CLAN_ORDER;
  }
  if (current.key === selection) {
    return current;
  }
  return { key: selection, direction: 'asc' };
}

/**
 * What the direction toggle means: flip the direction of the active
 * column. In clan order there is no direction to flip, so the state
 * comes back untouched (the toggle renders disabled there anyway; this
 * branch just keeps the rule total).
 */
export function flipRosterSortDirection(current: RosterSortState): RosterSortState {
  if (current.key === null) {
    return current;
  }
  return { key: current.key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

function memberValue(member: RosterSortableMember, key: RosterSortKey): number {
  switch (key) {
    case 'role':
      return clanRoleRank(member.role);
    case 'townHall':
      return member.townHallLevel;
    case 'trophies':
      return member.trophies;
    case 'donations':
      return member.donations;
    case 'received':
      return member.donationsReceived;
    case 'xp':
      return member.expLevel;
  }
}

/** Deterministic tiebreak chain: clan rank, then name, then tag. Ascending
 * in both sort directions so tied rows keep a stable order. */
function tieBreak(a: RosterSortableMember, b: RosterSortableMember): number {
  if (a.clanRank !== undefined && b.clanRank !== undefined && a.clanRank !== b.clanRank) {
    return a.clanRank - b.clanRank;
  }
  const byName = a.name.localeCompare(b.name);
  if (byName !== 0) return byName;
  return a.tag.localeCompare(b.tag);
}

/**
 * Returns the members ordered by the given state. Pure: the input array is
 * untouched and a new array comes back, so the caller can hand the same
 * query data to every render without copying it first (STD-33).
 */
export function sortRoster<M extends RosterSortableMember>(members: readonly M[], state: RosterSortState): M[] {
  if (state.key === null) {
    return [...members];
  }
  // Narrowed to a local so the comparator closure keeps the non-null type.
  const key = state.key;
  const sign = state.direction === 'asc' ? 1 : -1;
  return [...members].sort((a, b) => {
    const primary = (memberValue(a, key) - memberValue(b, key)) * sign;
    if (primary !== 0) return primary;
    return tieBreak(a, b);
  });
}
