// War efficiency helpers (T-M3-2, FR-12).
//
// The war log's computed judgments, kept pure so they are table-testable
// without rendering anything (STD-09, the same split as
// lib/war-standings.ts and lib/donation-balance.ts): the summary the Log
// tab renders above the entries, plus the formatters its cells read. The
// engine never imports the API client's functions; the WarlogEntry shape
// from api/warlog.ts satisfies the structural input, and so does any
// test fixture.
//
// The metrics are the engine doc's own list (05 section 3): win rate
// over the loaded wars, stars per attack (attack efficiency, not just
// volume), and average destruction per attack. Three edge rules come
// from the same section and the live payload, and are honored, not
// approximated:
// - Clan War League seasons are set apart from every rate: their stars
//   and destruction accumulate across seven rounds (a season's
//   "destruction" runs past any percentage), and no verdict exists to
//   win or lose. They still render as log rows; the sample caption
//   names how many were set apart.
// - Wars with zero attacks are excluded from the rates, never counted
//   as zeros: they add nothing to either side of a star-per-attack or
//   destruction quotient, and a weighted mean gives them no weight.
// - The sample size is labeled ("last 51 wars") so nobody over-reads a
//   short window; the summary carries the counts and the view sets the
//   label, so a later "load more" only widens the window.
//
// Win rate is wins over decided wars (wins + losses + ties); an ongoing
// war has no verdict yet and stays out of the quotient. Per the no-fake-
// zero rule the SR-19 family keeps, an empty or all-ongoing log reads
// null for every rate and renders the quiet dash, never a lying 0%.

import type { WarlogEntry } from '../api/warlog';

/** The efficiency summary the Log tab renders. Every rate is null when
 * the loaded wars cannot answer it, so the view shows the dash instead
 * of inventing a zero. */
export interface WarEfficiencySummary {
  /** Wars the summary covers: the loaded regular wars (decided and
   * ongoing), leagues excluded. */
  wars: number;
  wins: number;
  losses: number;
  ties: number;
  /** Regular wars still being fought (no verdict yet). */
  ongoing: number;
  /** Clan War League seasons on the page. They render as log rows but
   * join no rate: their stars and destruction accumulate across seven
   * rounds and are not comparable to a single war. */
  leagues: number;
  /** Wars with a verdict: wins + losses + ties, the win rate's
   * denominator. */
  decided: number;
  /** Wins over decided wars, 0 to 1; null when nothing is decided. */
  winRate: number | null;
  /** Total stars over total attacks across the covered wars; null when
   * no attacks were used at all. */
  starsPerAttack: number | null;
  /** Attack-weighted mean of the per-war destruction percentages (each
   * war's own value is already an average per attack, so weighting by
   * attacks is the honest clan-wide average); null when no attacks. */
  averageDestruction: number | null;
}

/**
 * Aggregates a page of war log entries into the efficiency summary.
 * League seasons are set apart before any quotient runs: they carry
 * season-total stars, destruction beyond any percentage, and no
 * verdict, so folding one into a per-war rate would poison it (the
 * sample-size caption names how many were set apart). The entries
 * arrive newest first from the parse; the order does not matter to the
 * math, only to the table under it.
 */
export function summarizeWarEfficiency(entries: readonly WarlogEntry[]): WarEfficiencySummary {
  let wars = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let ongoing = 0;
  let leagues = 0;
  let totalAttacks = 0;
  let totalStars = 0;
  let weightedDestruction = 0;

  for (const entry of entries) {
    if (entry.result === 'league') {
      leagues += 1;
      continue;
    }
    wars += 1;
    switch (entry.result) {
      case 'win':
        wins += 1;
        break;
      case 'lose':
        losses += 1;
        break;
      case 'tie':
        ties += 1;
        break;
      case 'ongoing':
        ongoing += 1;
        break;
    }
    // The zero-attack rule: a war nobody attacked in contributes to no
    // quotient. Zero attacks adds zero stars and zero destruction
    // weight, so no explicit branch is needed — the arithmetic excludes
    // it on its own.
    totalAttacks += entry.clan.attackCount;
    totalStars += entry.clan.stars;
    weightedDestruction += entry.clan.destructionPercentage * entry.clan.attackCount;
  }

  const decided = wins + losses + ties;
  return {
    wars,
    wins,
    losses,
    ties,
    ongoing,
    leagues,
    decided,
    winRate: decided > 0 ? wins / decided : null,
    starsPerAttack: totalAttacks > 0 ? totalStars / totalAttacks : null,
    averageDestruction: totalAttacks > 0 ? weightedDestruction / totalAttacks : null,
  };
}

/** A win rate at the precision the summary reads: a whole percentage,
 * no decimals (a 7-of-10 window does not support finer reading). */
export function formatWinRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * A stars-per-attack figure at the precision the design language allows
 * fractional metrics (07 section 5): one decimal at most, trailing
 * zeros trimmed so a perfect sheet reads "3", not "3.0".
 */
export function formatStarsPerAttack(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded);
}

/**
 * The war record as one terse line, "7W · 2L · 1T", the summary's fourth
 * cell. An ongoing war in the window is named for what it is rather
 * than folded into a count that has no verdict yet.
 */
export function formatRecord(summary: WarEfficiencySummary): string {
  const parts = [`${summary.wins}W`, `${summary.losses}L`];
  if (summary.ties > 0) parts.push(`${summary.ties}T`);
  if (summary.ongoing > 0) parts.push(`${summary.ongoing} ongoing`);
  return parts.join(' \u00b7 ');
}

/**
 * A war's end date as the log rows read it: month, day, and year, in
 * the visitor's own locale. The locale and time zone are injectable so
 * the unit tests stay deterministic; production always calls it with
 * the visitor's defaults. The same contract formatWarClock keeps.
 */
export function formatWarLogDate(ms: number, locale?: string | string[], timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(timeZone !== undefined ? { timeZone } : {}),
  }).format(new Date(ms));
}
