// War standings helpers (T-M3-1, FR-10).
//
// The current-war view's computed judgments, kept pure so they are
// table-testable without rendering anything (STD-09, the same split as
// lib/donation-balance.ts): which side leads a live war (and who won a
// finished one), what each member's attacks add up to, and the two
// formatters the war view reads. The engine never imports the API
// client's functions; the WarClan and WarMember shapes from api/war.ts
// satisfy the structural inputs, and so does any test fixture.
//
// The lead rule is the game's own: stars first, destruction percentage as
// the tiebreak. That is how Clash of Clans decides a war, so it is how
// the standings chip must read; inventing a different ranking here would
// make the view disagree with the game's result screen.
//
// Per-member destruction is the average across the attacks the member
// actually used, and a member with zero attacks has no average at all:
// null, rendered as a dash. Averaging them in as zeros would drag the
// clan's numbers toward "attacked and missed", which is a lie the
// payload does not tell (SR-19's rule, applied to the raw view too).

import type { WarClan, WarMember } from '../api/war';

/** Which side the standings favor. */
export type WarVerdict = 'clan' | 'opponent' | 'tie';

/**
 * The side leading a war in progress, or the winner of a finished one:
 * stars first, then the destruction percentage, the game's own order. A
 * war with no attacks yet (preparation day) reads as a tie.
 */
export function leadingSide(clan: WarClan, opponent: WarClan): WarVerdict {
  if (clan.stars > opponent.stars) return 'clan';
  if (opponent.stars > clan.stars) return 'opponent';
  if (clan.destructionPercentage > opponent.destructionPercentage) return 'clan';
  if (opponent.destructionPercentage > clan.destructionPercentage) return 'opponent';
  return 'tie';
}

/** The stars a member earned across the attacks they used. */
export function memberStars(member: WarMember): number {
  let total = 0;
  for (const attack of member.attacks) {
    total += attack.stars;
  }
  return total;
}

/**
 * A member's average destruction across their used attacks, or null when
 * they have not attacked: no attacks means no destruction to average,
 * never a zero (a zero reads as "attacked and missed").
 */
export function memberAverageDestruction(member: WarMember): number | null {
  if (member.attacks.length === 0) return null;
  let total = 0;
  for (const attack of member.attacks) {
    total += attack.destructionPercentage;
  }
  return total / member.attacks.length;
}

/**
 * A destruction percentage at the precision the war view reads: one
 * decimal at most (the API's own standings carry one), trailing zeros
 * trimmed so a clean sweep reads "100%", not "100.0%".
 */
export function formatWarPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}

/**
 * A war clock instant as the banner reads it: weekday, month, day, and
 * time in the visitor's own locale. The locale and time zone are
 * injectable so the unit tests stay deterministic; production always
 * calls it with the visitor's defaults.
 */
export function formatWarClock(ms: number, locale?: string | string[], timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone !== undefined ? { timeZone } : {}),
  }).format(new Date(ms));
}
