// The ranked league ladder (the 2025 rank rework), bundled for the search
// filter row and the requirement chips.
//
// The game API has a GET /leaguetiers endpoint with the full ladder, but our
// tier only proxies the five read routes, so this ships as a bundled table —
// the same call the location and label filters made. Two independent sources
// pin the shape: the ladder ids run 105000000 (Unranked) through 105000036
// (Legend League I), and the names follow "<Theme> League <rank>". Our own
// live captures (session 24, the roster's leagueTier) verified "Witch
// League 18" and "Electro League 31"; the rest of the table is trued against
// a community-maintained ladder map that agrees with both captures and the
// id numbering. Names are labels only: matching and filtering key on the id,
// so a wrong name can never mis-filter, only mislabel.
//
// Truing against a live GET /leaguetiers from an allowlisted machine is a
// one-line edit per row (the same failure-mode visibility the chat-language
// table carries).

/** The id the ladder numbering starts from: tier n has id BASE + n. */
export const RANKED_LEAGUE_TIER_ID_BASE = 105_000_000;

/** The highest tier the ladder covers: Legend League I. */
export const RANKED_LEAGUE_TIER_MAX = 36;

export interface RankedLeagueTier {
  /** The API's league tier id (105000000 + tier). */
  readonly id: number;
  /** The tier's position on the ladder, 0 (Unranked) through 36. */
  readonly tier: number;
  /** The API's own name for the tier. */
  readonly name: string;
}

function row(tier: number, name: string): RankedLeagueTier {
  return { id: RANKED_LEAGUE_TIER_ID_BASE + tier, tier, name };
}

/** The full ranked ladder, Unranked first, Legend League I last. */
export const RANKED_LEAGUE_TIERS: readonly RankedLeagueTier[] = [
  row(0, 'Unranked'),
  row(1, 'Skeleton League 1'),
  row(2, 'Skeleton League 2'),
  row(3, 'Skeleton League 3'),
  row(4, 'Barbarian League 4'),
  row(5, 'Barbarian League 5'),
  row(6, 'Barbarian League 6'),
  row(7, 'Archer League 7'),
  row(8, 'Archer League 8'),
  row(9, 'Archer League 9'),
  row(10, 'Wizard League 10'),
  row(11, 'Wizard League 11'),
  row(12, 'Wizard League 12'),
  row(13, 'Valkyrie League 13'),
  row(14, 'Valkyrie League 14'),
  row(15, 'Valkyrie League 15'),
  row(16, 'Witch League 16'),
  row(17, 'Witch League 17'),
  row(18, 'Witch League 18'),
  row(19, 'Golem League 19'),
  row(20, 'Golem League 20'),
  row(21, 'Golem League 21'),
  row(22, 'P.E.K.K.A League 22'),
  row(23, 'P.E.K.K.A League 23'),
  row(24, 'P.E.K.K.A League 24'),
  row(25, 'Titan League 25'),
  row(26, 'Titan League 26'),
  row(27, 'Titan League 27'),
  row(28, 'Dragon League 28'),
  row(29, 'Dragon League 29'),
  row(30, 'Dragon League 30'),
  row(31, 'Electro League 31'),
  row(32, 'Electro League 32'),
  row(33, 'Electro League 33'),
  row(34, 'Legend League III'),
  row(35, 'Legend League II'),
  row(36, 'Legend League I'),
];

/**
 * The ladder position of a league tier id, or null when the id sits outside
 * the known ladder. Filtering keys on this number, never the name. An id
 * above the table (content newer than this bundle) reads as null so callers
 * can treat it as "a requirement we cannot rank" instead of guessing.
 */
export function leagueTierNumber(id: number): number | null {
  const tier = id - RANKED_LEAGUE_TIER_ID_BASE;
  if (!Number.isInteger(tier) || tier < 0 || tier > RANKED_LEAGUE_TIER_MAX) {
    return null;
  }
  return tier;
}

/** The ladder name of a tier position, or undefined when out of range. */
export function leagueTierName(tier: number): string | undefined {
  return RANKED_LEAGUE_TIERS.find((entry) => entry.tier === tier)?.name;
}
