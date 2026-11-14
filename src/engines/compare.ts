// The player comparison engine (T-M3-3, FR-13).
//
// Answers the demo question, "who's more rushed, you or me?" (00 section
// "Who it is for"): for each metric in the union of both profiles it builds
// one row carrying both values, the delta, and a direction color
// (better/worse, 05 section 4). The deliberate limitation is load-bearing and
// enforced by the shape of the output: per-metric verdicts only, no single
// overall "winner" number, because summing unlike units into one score is
// false precision and the product will not ship it.
//
// Pure TypeScript: no React, no network, no clock (05 preamble). The metric
// set is the one 05 section 4 names for players: Town Hall, rushed percent
// overall and per category, hero levels, key achievements, war stats. The
// screen (an adapter) trues each player payload plus her rushed verdict into
// the structural {@link PlayerCompareSide} this engine consumes, so the
// engine never sees payload shapes and never imports the rushed engine
// (05 section 5: engines may not import each other's internals).
//
// Missing data is a verdict, not an error: a metric one side cannot answer
// renders the dash and carries no direction, so a clanless or fresh account
// never fakes a zero into the comparison (the same honesty the rushed
// engine's null keeps, 05 section 1).

// ---------- inputs ----------

/** One hero row's compare input: the home-village heroes only. */
export interface CompareHeroLevel {
  name: string;
  level: number;
  /** The hero's global maximum; null when the API has not caught up to
   * brand-new content (the row renders the level alone). */
  maxLevel: number | null;
}

/** One achievement row's compare input. */
export interface CompareAchievement {
  name: string;
  /** Stars already earned, 0 to 3. */
  stars: number;
  /** The achievement's current value (the lifetime counter the row
   * compares; stars are the same on both sides too often to separate
   * maxed accounts). */
  value: number;
}

/**
 * One side of the comparison: everything the metric rows read, already
 * normalized by the screen-side adapter. Numbers are nullable where the
 * player payload itself omits them, so "no data" stays distinguishable
 * from a real zero the same way the identity chips keep it.
 */
export interface PlayerCompareSide {
  name: string;
  tag: string;
  townHallLevel: number;
  expLevel: number;
  /** Lifetime war stars; null when the payload omits the field. */
  warStars?: number | null;
  /** Season attack wins; null when the payload omits the field. */
  attackWins?: number | null;
  /** The rushed engine's overall percentage; null when it answered
   * "not available" (no usable units). Lower is better. */
  rushedPercent?: number | null;
  /** The rushed engine's per-category percentages, label and value, in
   * the order the verdict lists them. A null percent is a category the
   * side cannot answer. Lower is better. */
  rushedCategories?: ReadonlyArray<{ label: string; percent: number | null }>;
  /** Home-village heroes the hero rows compare. */
  heroes?: ReadonlyArray<CompareHeroLevel>;
  /** Home-village achievements the key-achievement rows read. */
  achievements?: ReadonlyArray<CompareAchievement>;
}

/**
 * The key achievements the compare renders (05 section 4 "key
 * achievements"): the game's lifetime counters, every one a cumulative
 * number where more is unambiguously further along. Curated as data, not
 * logic; a name missing from both profiles simply renders no row, so the
 * list drifting out of date degrades quietly instead of throwing.
 *
 * War Hero is deliberately absent: its value is the payload's own warStars,
 * which the war stats already compare once.
 */
export const KEY_ACHIEVEMENTS: readonly string[] = [
  'Gold Grab',
  'Elixir Escapade',
  'Heroic Heist',
  'Friend in Need',
  'Spoils of War',
];

// ---------- verdicts ----------

/** The metric groups the rows organize into, in display order. */
export type CompareGroupId = 'account' | 'rushed' | 'heroes' | 'war' | 'achievements';

/** Display labels for the groups. */
export const COMPARE_GROUP_LABELS: Record<CompareGroupId, string> = {
  account: 'Account',
  rushed: 'Rushed analysis',
  heroes: 'Heroes',
  war: 'War record',
  achievements: 'Key achievements',
};

/** Which way a metric reads: more is better, or less is better (the
 * rushed percentages invert the direction). */
export type CompareMetric = 'higher' | 'lower';

/** One row's verdict: which side leads ('a' or 'b'), an exact tie, or
 * no verdict because a side cannot answer the metric. */
export type CompareDirection = 'a' | 'b' | 'even' | 'none';

/** One side-by-side metric row, ready to render as data. */
export interface CompareRow {
  /** Stable identity for list keys. */
  id: string;
  group: CompareGroupId;
  /** The row's label (metric or hero/achievement name). */
  label: string;
  /** What each side renders: the value, or the dash when the side cannot
   * answer (the quiet dash the state matrix uses, never a fake zero). */
  aDisplay: string;
  bDisplay: string;
  /** The delta in the metric's own units, a minus b; null when either
   * side is missing (no delta without both halves). */
  delta: number | null;
  /** The delta rendered for display, signed and rounded to the house
   * precision; the empty string when there is nothing to show. */
  deltaDisplay: string;
  direction: CompareDirection;
  /** Which way this metric reads; the row's color rule, not the
   * renderer's guess. */
  metric: CompareMetric;
}

/** One group of rows under its label. */
export interface CompareGroup {
  id: CompareGroupId;
  label: string;
  rows: CompareRow[];
}

// ---------- formatting ----------

/** Rounds to one decimal place, the precision the display shows (the
 * rushed engine's own rule). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Groups a number under 100,000 with commas ("1,959"): deterministic
 * (never locale-dependent, the engine stays pure) and tabular-friendly.
 */
function groupDigits(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const sign = value < 0 ? '-' : '';
  const digits = String(rounded);
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return sign + out;
}

/**
 * Compacts a counter for one cell: "2.15B", "812.4M", "260.5K", "1,959".
 * The threshold keeps four-digit counters readable in full (war stars
 * live there) and switches to K only at 10,000. Billions and millions
 * keep two decimals (the game's own counters read that fine), K keeps
 * one; trailing zeros trim so "2.0B" reads "2B".
 */
export function formatCompactCount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return compact(value, 1e9, 'B', 2);
  if (abs >= 1e6) return compact(value, 1e6, 'M', 2);
  if (abs >= 1e4) return compact(value, 1e3, 'K', 1);
  return groupDigits(value);
}

function compact(value: number, unit: number, suffix: string, decimals: number): string {
  const factor = 10 ** decimals;
  const scaled = Math.round((value / unit) * factor) / factor;
  const text = String(scaled);
  return `${text}${suffix}`;
}

/** The level pair a hero row renders, "87 / 110"; a null maximum renders
 * the level alone (the same treatment the hero panel gives brand-new
 * content, 05 section 1's null rule). */
export function formatHeroLevel(level: number, maxLevel: number | null): string {
  if (maxLevel === null) return String(level);
  return `${level} / ${maxLevel}`;
}

// ---------- the engine ----------

/** The dash every missing value renders. */
const DASH = '\u2014';

/**
 * Resolves one metric's verdict from both sides' raw numbers. Pure and
 * total: any missing side answers 'none' with no delta, an exact tie
 * answers 'even', and otherwise the metric's own direction decides which
 * side's number wins.
 */
export function compareNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  metric: CompareMetric,
): { direction: CompareDirection; delta: number | null } {
  if (a === null || a === undefined || b === null || b === undefined) {
    return { direction: 'none', delta: null };
  }
  if (a === b) return { direction: 'even', delta: 0 };
  const aLeads = metric === 'higher' ? a > b : a < b;
  return { direction: aLeads ? 'a' : 'b', delta: a - b };
}

/**
 * Builds the comparison groups for two players (05 section 4). Pure: the
 * same two sides always yield the same rows. Group order is display
 * order: Account, Rushed analysis, Heroes, War record, Key achievements.
 *
 * The hero rows take the union of both sides' hero names (in first
 * appearance order, A's heroes then B's extras), so a hero one player
 * has not unlocked still renders, against the dash. The key-achievement
 * rows take only the curated names present on at least one side.
 */
export function computePlayerCompare(a: PlayerCompareSide, b: PlayerCompareSide): CompareGroup[] {
  const rows: CompareRow[] = [];

  // Account: Town Hall and XP level, both higher-better.
  pushNumberRow(rows, 'account', 'Town Hall', a.townHallLevel, b.townHallLevel, 'higher');
  pushNumberRow(rows, 'account', 'XP level', a.expLevel, b.expLevel, 'higher');

  // Rushed: overall first, then the categories in the sides' own order
  // (the adapter lists them in the verdict's order), lower-better.
  pushPercentRow(rows, 'rushed', 'Rushed overall', a.rushedPercent, b.rushedPercent);
  const categoryLabels = unionLabels(a.rushedCategories, b.rushedCategories);
  for (const label of categoryLabels) {
    pushPercentRow(
      rows,
      'rushed',
      label,
      findPercent(a.rushedCategories, label),
      findPercent(b.rushedCategories, label),
    );
  }

  // Heroes: the union of both sides' home-village heroes.
  for (const name of unionHeroNames(a.heroes, b.heroes)) {
    const aHero = findHero(a.heroes, name);
    const bHero = findHero(b.heroes, name);
    const verdict = compareNumbers(
      aHero?.level ?? null,
      bHero?.level ?? null,
      'higher',
    );
    rows.push({
      id: `heroes:${name}`,
      group: 'heroes',
      label: name,
      aDisplay: aHero ? formatHeroLevel(aHero.level, aHero.maxLevel) : DASH,
      bDisplay: bHero ? formatHeroLevel(bHero.level, bHero.maxLevel) : DASH,
      delta: verdict.delta,
      deltaDisplay: deltaText(verdict, (value) => String(value)),
      direction: verdict.direction,
      metric: 'higher',
    });
  }

  // War record: lifetime war stars and season attack wins.
  pushCounterRow(rows, 'war', 'War stars', a.warStars, b.warStars);
  pushCounterRow(rows, 'war', 'Attack wins', a.attackWins, b.attackWins);

  // Key achievements: the curated names present on at least one side,
  // compared on the lifetime value.
  for (const name of KEY_ACHIEVEMENTS) {
    const aEntry = findAchievement(a.achievements, name);
    const bEntry = findAchievement(b.achievements, name);
    if (!aEntry && !bEntry) continue;
    const verdict = compareNumbers(
      aEntry ? aEntry.value : null,
      bEntry ? bEntry.value : null,
      'higher',
    );
    rows.push({
      id: `achievements:${name}`,
      group: 'achievements',
      label: name,
      aDisplay: aEntry ? formatCompactCount(aEntry.value) : DASH,
      bDisplay: bEntry ? formatCompactCount(bEntry.value) : DASH,
      delta: verdict.delta,
      deltaDisplay: deltaText(verdict, formatCompactCount),
      direction: verdict.direction,
      metric: 'higher',
    });
  }

  return orderGroups().map((id) => ({
    id,
    label: COMPARE_GROUP_LABELS[id],
    rows: rows.filter((row) => row.group === id),
  }));
}

function orderGroups(): CompareGroupId[] {
  return ['account', 'rushed', 'heroes', 'war', 'achievements'];
}

/** One plain-integer row (levels): the delta renders as a bare integer. */
function pushNumberRow(
  rows: CompareRow[],
  group: CompareGroupId,
  label: string,
  a: number | null | undefined,
  b: number | null | undefined,
  metric: CompareMetric,
): void {
  const verdict = compareNumbers(a, b, metric);
  rows.push({
    id: `${group}:${label}`,
    group,
    label,
    aDisplay: a === null || a === undefined ? DASH : String(a),
    bDisplay: b === null || b === undefined ? DASH : String(b),
    delta: verdict.delta,
    deltaDisplay: deltaText(verdict, (value) => String(value)),
    direction: verdict.direction,
    metric,
  });
}

/** One counter row (war stars, achievements): compact display, compact delta. */
function pushCounterRow(
  rows: CompareRow[],
  group: CompareGroupId,
  label: string,
  a: number | null | undefined,
  b: number | null | undefined,
): void {
  const verdict = compareNumbers(a, b, 'higher');
  rows.push({
    id: `${group}:${label}`,
    group,
    label,
    aDisplay: a === null || a === undefined ? DASH : formatCompactCount(a),
    bDisplay: b === null || b === undefined ? DASH : formatCompactCount(b),
    delta: verdict.delta,
    deltaDisplay: deltaText(verdict, formatCompactCount),
    direction: verdict.direction,
    metric: 'higher',
  });
}

/** One percentage row (the rushed verdict): the delta is percentage
 * points, rendered with the one-decimal precision the percents keep. */
function pushPercentRow(
  rows: CompareRow[],
  group: CompareGroupId,
  label: string,
  a: number | null | undefined,
  b: number | null | undefined,
): void {
  const verdict = compareNumbers(a, b, 'lower');
  const percent = (value: number) => `${round1(value)}%`;
  rows.push({
    id: `${group}:${label}`,
    group,
    label,
    aDisplay: a === null || a === undefined ? DASH : percent(a),
    bDisplay: b === null || b === undefined ? DASH : percent(b),
    delta: verdict.delta,
    deltaDisplay: deltaText(verdict, (value) => String(round1(value))),
    direction: verdict.direction,
    metric: 'lower',
  });
}

/** The delta cell's text: the leader's margin, "+12", in the row's own
 * units and precision; an exact tie reads "Even"; a metric one side
 * cannot answer shows nothing. The margin is unsigned on purpose: the
 * direction color lives on the values (leader success, trailer danger)
 * and on the row's verdict, so a signed delta would give the same row
 * two competing signals on lower-is-better metrics, where a bigger
 * number means a worse side. */
function deltaText(
  verdict: { direction: CompareDirection; delta: number | null },
  format: (value: number) => string,
): string {
  if (verdict.delta === null) return '';
  if (verdict.delta === 0) return 'Even';
  return `+${format(Math.abs(verdict.delta))}`;
}

/** The category labels in first-appearance order across both sides. */
function unionLabels(
  a: ReadonlyArray<{ label: string; percent: number | null }> | undefined,
  b: ReadonlyArray<{ label: string; percent: number | null }> | undefined,
): string[] {
  const out: string[] = [];
  for (const side of [a, b]) {
    for (const entry of side ?? []) {
      if (!out.includes(entry.label)) out.push(entry.label);
    }
  }
  return out;
}

function findPercent(
  side: ReadonlyArray<{ label: string; percent: number | null }> | undefined,
  label: string,
): number | null {
  return side?.find((entry) => entry.label === label)?.percent ?? null;
}

/** The hero names in first-appearance order: A's heroes, then B's extras. */
function unionHeroNames(
  a: ReadonlyArray<CompareHeroLevel> | undefined,
  b: ReadonlyArray<CompareHeroLevel> | undefined,
): string[] {
  const names: string[] = [];
  for (const hero of a ?? []) names.push(hero.name);
  for (const hero of b ?? []) {
    if (!names.includes(hero.name)) names.push(hero.name);
  }
  return names;
}

function findHero(
  side: ReadonlyArray<CompareHeroLevel> | undefined,
  name: string,
): CompareHeroLevel | undefined {
  return side?.find((hero) => hero.name === name);
}

function findAchievement(
  side: ReadonlyArray<CompareAchievement> | undefined,
  name: string,
): CompareAchievement | undefined {
  return side?.find((entry) => entry.name === name);
}
