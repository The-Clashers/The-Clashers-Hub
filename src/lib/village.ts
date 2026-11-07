// The village grouping rule, shared by the analysis cards that render the
// player payload's village-marked arrays (achievements today, heroes with
// T-M2-4, the progression grid with T-M2-5).
//
// The rule came out of the achievements card (T-M2-3): the live payload
// interleaves villages (home, builder base, home again, then clan capital),
// and a flat render would mix them, so every card groups its rows under a
// quiet header per village. Groups keep first-appearance order (home first
// on every payload observed), rows keep API order inside their group, and
// the input is never mutated.
//
// The module is pure with no React imports (STD-09), the same split the
// other lib helpers keep; the achievements module delegates here so the
// grouping rule has exactly one owner.

// The quiet labels the cards render above each group. The three villages
// the game API names today plus the tolerant floor: an unknown marker
// renders as itself, so a new village the API invents still gets a header
// instead of being dropped or lumped into home.
const VILLAGE_LABELS: Readonly<Record<string, string>> = {
  home: 'Home Village',
  builderBase: 'Builder Base',
  clanCapital: 'Clan Capital',
};

/** The display label for a village marker ("home" -> "Home Village"); an
 * unknown marker renders as itself, the same tolerant floor the labels
 * keep. */
export function villageLabel(village: string): string {
  return VILLAGE_LABELS[village] ?? village;
}

/** One village's block: the raw marker, the display label, and the rows in
 * API order. Generic over the row type so every card reuses the rule with
 * its own parsed shape. */
export interface VillageGroup<T> {
  /** The raw village marker from the payload ("home", "builderBase",
   * "clanCapital"). */
  village: string;
  /** The display label ("Home Village", "Builder Base", "Clan Capital"). */
  label: string;
  /** The group's rows in API order. */
  rows: T[];
}

/** Groups village-marked rows by their village, first-appearance order for
 * the groups, API order inside each. The input array is never mutated. */
export function groupByVillage<T extends { village: string }>(
  rows: ReadonlyArray<T>,
): VillageGroup<T>[] {
  const groups: VillageGroup<T>[] = [];
  const byVillage = new Map<string, VillageGroup<T>>();
  for (const row of rows) {
    let group = byVillage.get(row.village);
    if (!group) {
      group = {
        village: row.village,
        label: villageLabel(row.village),
        rows: [],
      };
      byVillage.set(row.village, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}
