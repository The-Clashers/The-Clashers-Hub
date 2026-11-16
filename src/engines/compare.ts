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
// The clan half (T-M3-4) reads the same doc's clan list literally — size,
// level, war record, average TH, donation health — through a sibling
// {@link ClanCompareSide} and {@link computeClanCompare}. One metric in
// that list, roster size, carries no better/worse reading (a 30-member
// clan is not a worse 50-member clan), so the engine's metric kinds grow a
// 'fact': both values render, the delta is the gap, and neither side
// colors. The adapter that feeds the clan side imports the donation
// engine for the health figure; this engine still imports nobody.
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
 * One side of the clan comparison: everything the clan metric rows read,
 * already normalized by the screen-side adapter (05 section 4's clan list:
 * size, level, war record, average TH, donation health). Numbers are
 * nullable where the source cannot answer them, so "no data" stays
 * distinguishable from a real zero — a private war log answers no rate,
 * and a roster nobody donated on answers no health.
 */
export interface ClanCompareSide {
  name: string;
  tag: string;
  /** Roster size, the clan payload's own members count. */
  members: number | null;
  /** Clan level; higher unlocks more clan perks. */
  clanLevel: number | null;
  /** Mean Town Hall across the roster, one decimal; null when the member
   * list is missing or empty (the clan payload always carries one, but a
   * degraded answer must not fake a zero). */
  averageTownHall: number | null;
  /** Share of members-with-data at or above the donation target, 0 to 1;
   * null when no member has donation data (the donation engine's own
   * no-data rule, computed by the adapter). */
  donationHealth: number | null;
  /** Lifetime war wins, the clan payload's own counter. */
  warWins: number | null;
  /** Active war win streak. */
  warWinStreak: number | null;
  // ---- the war log rates (null when the log is private or answers
  // nothing; computed by the adapter through lib/war-efficiency) ----
  /** Wins over decided wars in the loaded log window; null when nothing
   * is decided. */
  winRate: number | null;
  /** Total stars over total attacks in the window; null when no attacks. */
  starsPerAttack: number | null;
  /** Attack-weighted mean destruction per attack; null when no attacks. */
  averageDestruction: number | null;
  /** Regular wars the rates cover (the sample-size honesty, 05 section 3);
   * null when the log is private. */
  warLogWars: number | null;
  /** Clan War League seasons set apart from the rates; null when private. */
  warLogLeagues: number | null;
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

/** The metric groups the rows organize into, in display order. The player
 * groups cover Account through Key achievements; 'roster' is the clan
 * compare's own group (size, average TH, donation health), and 'war' is
 * shared by both compares with the same label. */
export type CompareGroupId =
  | 'account'
  | 'rushed'
  | 'heroes'
  | 'war'
  | 'achievements'
  | 'roster';

/** Display labels for the groups. */
export const COMPARE_GROUP_LABELS: Record<CompareGroupId, string> = {
  account: 'Account',
  rushed: 'Rushed analysis',
  heroes: 'Heroes',
  war: 'War record',
  achievements: 'Key achievements',
  roster: 'Roster stats',
};

/** Which way a metric reads: more is better, less is better (the rushed
 * percentages invert the direction), or a fact with no better/worse
 * reading (roster size: the row shows the gap, not a verdict). */
export type CompareMetric = 'higher' | 'lower' | 'fact';

/** One row's verdict: which side leads ('a' or 'b'), an exact tie, no
 * verdict because a side cannot answer the metric, or a comparable fact
 * whose values differ (no side colors; the delta is the gap). */
export type CompareDirection = 'a' | 'b' | 'even' | 'fact' | 'none';

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

/** One group of rows under its label. The optional note is a quiet line
 * under the rows (the war record's sample-size honesty, 05 section 3);
 * the player compare sets none. */
export interface CompareGroup {
  id: CompareGroupId;
  label: string;
  rows: CompareRow[];
  note?: string;
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
  if (metric === 'fact') return { direction: 'fact', delta: a - b };
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

// ---------- the clan half (T-M3-4) ----------

/**
 * Builds the comparison groups for two clans (05 section 4's clan list,
 * read literally): Roster stats (Members as a fact with the gap, Average
 * Town Hall, Donation health) then War record (War wins and Win streak
 * from the clan payload, Win rate, Stars per attack, and Average
 * destruction from the war log window). Pure: the same two sides always
 * yield the same rows, and a rate one side cannot answer (a private war
 * log) renders the dash, never a fake zero.
 *
 * The war record group carries the sample-size note the engine doc
 * demands (05 section 3): the rates read each clan's own log window, and
 * a private log keeps no rate. The note is data the view renders quiet;
 * it is not a row and carries no verdict.
 */
export function computeClanCompare(a: ClanCompareSide, b: ClanCompareSide): CompareGroup[] {
  const rows: CompareRow[] = [];

  // Roster stats: size is a fact (the gap, no verdict), the other two
  // are higher-better judgments.
  pushNumberRow(rows, 'roster', 'Members', a.members, b.members, 'fact');
  rows.push(oneDecimalRow('roster', 'Average Town Hall', a.averageTownHall, b.averageTownHall));
  rows.push(percentShareRow('roster', 'Donation health', a.donationHealth, b.donationHealth));

  // War record: the payload's own counters first, then the log rates.
  pushCounterRow(rows, 'war', 'War wins', a.warWins, b.warWins);
  pushNumberRow(rows, 'war', 'Win streak', a.warWinStreak, b.warWinStreak, 'higher');
  rows.push(percentShareRow('war', 'Win rate', a.winRate, b.winRate));
  rows.push(starsPerAttackRow('war', a, b));
  rows.push(destructionRow('war', a, b));

  return [
    {
      id: 'roster',
      label: COMPARE_GROUP_LABELS.roster,
      rows: rows.filter((row) => row.group === 'roster'),
    },
    {
      id: 'war',
      label: COMPARE_GROUP_LABELS.war,
      rows: rows.filter((row) => row.group === 'war'),
      note: warRecordNote(a, b),
    },
  ];
}

/** One one-decimal number row (average Town Hall): the mean carries real
 * decimals, so the value and the delta both render at the rushed engine's
 * own precision (round1), the one the percents keep everywhere else. */
function oneDecimalRow(
  group: CompareGroupId,
  label: string,
  a: number | null | undefined,
  b: number | null | undefined,
): CompareRow {
  return quantizedRow(group, label, a, b, (value) => round1(value));
}

/** One 0-to-1 share row (donation health, win rate): the value renders a
 * whole percent and the delta is percentage points, the precision a
 * share of members supports (the roster header's own health chip and the
 * war log's win rate keep it: a 7-of-10 window does not read finer). */
function percentShareRow(
  group: CompareGroupId,
  label: string,
  a: number | null | undefined,
  b: number | null | undefined,
): CompareRow {
  const row = quantizedRow(
    group,
    label,
    a,
    b,
    (value) => Math.round(value * 100),
    // The delta is already percentage points once the shares quantize.
    (value) => Math.round(value),
  );
  return {
    ...row,
    aDisplay: row.aDisplay === DASH ? DASH : `${row.aDisplay}%`,
    bDisplay: row.bDisplay === DASH ? DASH : `${row.bDisplay}%`,
  };
}

/** Stars per attack keeps the war log's own one-decimal precision (the
 * trailing-zero trim formatStarsPerAttack keeps, mirrored here so the
 * compare cell and the Log tab never disagree about the same number). */
function starsPerAttackRow(group: CompareGroupId, a: ClanCompareSide, b: ClanCompareSide): CompareRow {
  return quantizedRow(
    group,
    'Stars per attack',
    a.starsPerAttack,
    b.starsPerAttack,
    (value) => Math.round(value * 10) / 10,
  );
}

/** Average destruction keeps formatWarPercent's one decimal; the delta
 * is percentage points at the same precision. */
function destructionRow(group: CompareGroupId, a: ClanCompareSide, b: ClanCompareSide): CompareRow {
  const row = quantizedRow(
    group,
    'Avg destruction',
    a.averageDestruction,
    b.averageDestruction,
    (value) => Math.round(value * 10) / 10,
  );
  return {
    ...row,
    aDisplay: row.aDisplay === DASH ? DASH : `${row.aDisplay}%`,
    bDisplay: row.bDisplay === DASH ? DASH : `${row.bDisplay}%`,
  };
}

/** The shared body of every decimal-carrying clan row: quantize both
 * sides through one formatter, then compare the quantized values so the
 * verdict, the two displays, and the delta all agree at the precision
 * the visitor actually reads. A row that compares at finer precision
 * than it displays can render "+0 ahead" under two identical values,
 * which contradicts itself (the live browser pass caught exactly that on
 * two win rates that both read 44%). */
function quantizedRow(
  group: CompareGroupId,
  label: string,
  a: number | null | undefined,
  b: number | null | undefined,
  quantize: (value: number) => number,
  formatDelta: (value: number) => number = quantize,
): CompareRow {
  const qa = a === null || a === undefined ? null : quantize(a);
  const qb = b === null || b === undefined ? null : quantize(b);
  const verdict = compareNumbers(qa, qb, 'higher');
  // The delta formats through its own formatter: the quantized values can
  // still carry float dust (a quantized 15.5 minus a quantized 13.9 is
  // 1.5999...), and a share row's delta already lives in points while its
  // quantizer reads 0-to-1 shares.
  const text = (value: number) => String(formatDelta(value));
  return {
    id: `${group}:${label}`,
    group,
    label,
    aDisplay: qa === null ? DASH : text(qa),
    bDisplay: qb === null ? DASH : text(qb),
    delta: verdict.delta,
    deltaDisplay: deltaText(verdict, text),
    direction: verdict.direction,
    metric: 'higher',
  };
}

/**
 * The war record group's quiet note: the sample-size honesty (05 section
 * 3) applied to a comparison. Both windows public: the sizes, and the
 * league seasons set apart. One private: the dash's own explanation, so a
 * missing rate reads as the designed state it is, not a failure.
 */
function warRecordNote(a: ClanCompareSide, b: ClanCompareSide): string {
  const parts: string[] = [];
  if (a.warLogWars !== null && a.warLogWars !== undefined) {
    parts.push(warWindowLabel(a));
  }
  if (b.warLogWars !== null && b.warLogWars !== undefined) {
    parts.push(warWindowLabel(b));
  }
  const privateSides = [a, b].filter(
    (side) => side.warLogWars === null || side.warLogWars === undefined,
  );
  if (privateSides.length > 0) {
    const names = privateSides.map((side) => side.name).join(' and ');
    parts.push(
      `${names} keep${privateSides.length === 1 ? 's' : ''} a private war log: no rate, just the dash`,
    );
  }
  if (parts.length === 0) {
    // Both sides answered no window without being private (an empty log
    // page): the note stays honest instead of naming windows that do not
    // exist.
    return 'War log rates read each clan\u2019s most recent wars; neither log answered one yet.';
  }
  return `War log rates read ${parts.join('; ')}.`;
}

/** "Umbra Lunaria's last 51 wars (3 leagues set apart)" — the window one
 * side's rates read, in the Log tab's own vocabulary. A public log that
 * answered no wars reads as what it is: none yet, not a zero-war
 * "window" nobody can read. */
function warWindowLabel(side: ClanCompareSide): string {
  const wars = side.warLogWars ?? 0;
  if (wars === 0) {
    return `${side.name}\u2019s log answered no wars yet`;
  }
  const warWord = wars === 1 ? 'war' : 'wars';
  let label = `${side.name}\u2019s last ${wars} ${warWord}`;
  const leagues = side.warLogLeagues ?? 0;
  if (leagues > 0) {
    label += ` (${leagues} league${leagues === 1 ? '' : 's'} set apart)`;
  }
  return label;
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
