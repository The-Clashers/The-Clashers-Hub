// League rank parsing for the ranked ladder (T-M1-4 follow-up).
//
// The 2025 ladder rework gives every member a `leagueTier` whose name
// carries the league and the rank in one string ("Electro League 31",
// "Witch League 18"). The roster's Rank column and the needs-attention
// table's Rank column both want the rank as a number next to the tier
// icon, so the one parse rule lives here next to the other pure tables
// (STD-09): string in, number out, no React, no network.
//
// The rule is deliberately narrow: the rank is a trailing integer after a
// space. Anything else ("Unranked", a name with no number, junk) parses to
// null and the cell renders its quiet dash. When the game API splits the
// rank into its own field, api/clan.ts grows that field and this module
// retires; until then this is the single owner of the parse.

/** Matches a trailing " <integer>" on a tier name. The capture is the rank. */
const TRAILING_RANK = /\s(\d+)$/;

/**
 * The rank number baked into a league tier name, or null when the name
 * carries none. "Electro League 31" -> 31; "Unranked" -> null; an empty
 * or missing name -> null. Leading zeros are accepted and normalized by
 * the parseInt ("League 007" -> 7); a huge number stays as-is because the
 * game has not said what the ceiling is.
 */
export function leagueRankFromTierName(name: string | undefined): number | null {
  if (!name) return null;
  const match = TRAILING_RANK.exec(name.trim());
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The tier name with the rank stripped: "Electro League 31" -> "Electro
 * League". The accessibility labels read this so a screen reader hears
 * "rank 31 in Electro League" instead of repeating the number twice.
 * Names without a rank come back unchanged.
 */
export function leagueNameWithoutRank(name: string | undefined): string {
  if (!name) return '';
  return name.trim().replace(TRAILING_RANK, '');
}
