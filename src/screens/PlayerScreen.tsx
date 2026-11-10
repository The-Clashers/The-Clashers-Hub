import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme, createBaseStyles, breakpointFor } from '../theme';
import Breadcrumbs from '../components/Breadcrumbs';
import CategoryBars from '../components/CategoryBars';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Gauge from '../components/Gauge';
import Glyph from '../components/Glyph';
import LevelRail from '../components/LevelRail';
import PillButton from '../components/PillButton';
import ProgressRail from '../components/ProgressRail';
import ProgressionGrid from '../components/ProgressionGrid';
import RefreshControl from '../components/RefreshControl';
import SkeletonBlock, { useSkeletonPulse } from '../components/SkeletonBlock';
import UnitIcon from '../components/UnitIcon';
import { fetchPlayer, PlayerFetchError, type PlayerResponse } from '../api/player';
import { busyRetryDelayMs, shouldRetryBusy } from '../lib/busy-retry';
import {
  ACHIEVEMENT_FILTER_LABELS,
  achievementProgress,
  filterAchievements,
  formatProgressPair,
  groupAchievementsByVillage,
  type AchievementFilter,
} from '../lib/achievement-progress';
import { heroProgress, formatLevelPair } from '../lib/hero-progress';
import { clanRoleLabel } from '../lib/clan-role';
import { canonicalTagFromRoute } from '../lib/tag';
import { groupByVillage } from '../lib/village';
import { playerToProgressionTiles } from '../lib/progression-grid';
import {
  bandFor,
  computeRushed,
  playerToUnitEntries,
  RUSHED_BAND_LABELS,
  RUSHED_CATEGORY_LABELS,
  type RushedBand,
  type RushedVerdict,
} from '../engines/rushed';

// The player detail shell (T-M2-1, FR-06, FR-14). The roster's tap-through
// and the tag boxes both land here (golden paths A and B), on the shareable
// /player/:tag URL the route map documents. The shell owns the fetch and its
// states and lays out the page the design language fixes: two columns from
// 1024 px up (identity + analysis), stacked below it — the layout the
// prototype rework tried to replace and the owner put back, with the
// prototype's two actions kept on the card.
//
// The identity card carries the FR-06 header: the name, the tag with the
// clan name beside it, then the stat cells (Town Hall, league, XP level,
// clan role). The league cell reads the ranked-ladder tier (leagueTier, the
// same field the roster's rank column reads) with its icon in the 24 px
// slot, falling back to the classic league object when the payload carries
// no tier, so the site's two league displays never disagree about which
// ladder they show. The role label comes from lib/clan-role.ts, the one
// table the roster reads, so "admin" says Elder here too. Under the stat
// grid the card's actions block holds the two buttons the owner took from
// the prototype: the gold compare pill with the compare glyph, and the
// manual refresh control (the ghost pill with the refresh glyph and the
// last-refresh text riding in the cached pill) — freshness belongs to the
// card whose data it describes, beside the compare action.
//
// The two-column desktop layout places the identity card and the two
// verdict cards (rushed analysis and upgrade next) in the left column,
// while the right column holds the three ledger cards: heroes, the
// progression grid, and achievements last. On mobile they stack in the
// same logical order.
//
// Breadcrumbs locate the page the way the clan detail's do (07 section 3):
// Home > Players > <player name>, the tag from the URL until the name is in
// hand so the trail is layout-stable through the loading state. The route
// param carries the bare tag (shareable URLs carry no #, see lib/tag.ts),
// canonicalized back through the tag module so the fetch, the cache key,
// and the on-screen tag all agree on #TAG.

// The client staleTime mirrors the tier's 300 s player TTL (04 section 5) so
// the two cache layers decay together, the same pairing every route keeps.
const PLAYER_STALE_TIME_MS = 300_000;

// The league icon slot (07 section 7): API icon in a fixed box, so a slow
// CDN load never reflows the stat grid.
const LEAGUE_ICON_SLOT = 24;

// Line widths chosen to read as a name and a tag line; the stat cells mirror
// the uniform grid they stand in for.
const SKELETON_NAME_WIDTH = 200;
const SKELETON_META_WIDTH = 170;

// The header stat cells the skeleton draws, matching the grid's count.
const SKELETON_STAT_CELLS = 4;

// Micro-label tracking: the one-off 0.6 px tracking the design language
// pairs with uppercase micro labels (StatChip keeps the same local value).
// It becomes a token the moment a second value needs one.
const LABEL_TRACKING = 0.6;

export default function PlayerScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const params = useParams();
  const navigate = useNavigate();

  const tag = canonicalTagFromRoute(params.tag ?? '');

  const query = useQuery({
    queryKey: ['player', tag] as const,
    queryFn: () => fetchPlayer(tag),
    staleTime: PLAYER_STALE_TIME_MS,
    retry: (failureCount, error) => {
      // A 404 is permanent for a tag the user navigated to (the player left
      // the game or the URL is stale); retrying burns no upstream calls
      // thanks to the 30 s negative cache, but it cannot fix anything, so
      // we stop. A 400 is our URL being wrong; retrying the same request
      // cannot fix it. The busy outcome auto-retries with backoff (06
      // section 3): the tier already retried the throttle itself, so the
      // client paces itself through lib/busy-retry and the screen keeps
      // its skeleton with a "one moment" note instead of flipping to an
      // error screen. Everything else gets the single default retry.
      if (error instanceof PlayerFetchError) {
        if (error.result.kind === 'not_found' || error.result.kind === 'bad_request') {
          return false;
        }
        if (error.result.kind === 'busy') {
          return shouldRetryBusy(failureCount);
        }
      }
      return failureCount < 1;
    },
    retryDelay: (failureCount, error) => {
      if (error instanceof PlayerFetchError && error.result.kind === 'busy') {
        return busyRetryDelayMs(error.result.retryAfter, failureCount);
      }
      // Only the single default retry ever waits on this: the library's
      // own first backoff.
      return 1_000;
    },
  });

  // True while the first load is auto-retrying a busy answer: the skeleton
  // stays up and its caption switches to the "one moment" note (06
  // section 3), so a throttled demo reads as a slow fetch, not an error.
  const busyRetrying =
    query.isPending &&
    query.failureReason instanceof PlayerFetchError &&
    query.failureReason.result.kind === 'busy';

  // The breadcrumb's current crumb: the player name once it is in hand, the
  // tag from the URL until then (and on error), which keeps the trail
  // layout-stable through the loading state.
  const currentCrumb = query.data?.name ?? tag;

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.breadcrumbWrap}>
            <Breadcrumbs
              crumbs={[
                { label: 'Home', route: '/' },
                { label: 'Players', route: '/players' },
                { label: currentCrumb },
              ]}
            />
          </View>

          {query.isPending ? (
            <PlayerLoading busyRetrying={busyRetrying} />
          ) : query.isError ? (
            <View style={[base.panelRaised, styles.detailPanel]}>
              <PlayerError
                error={query.error as PlayerFetchError | Error}
                onRetry={() => void query.refetch()}
                onLookup={() => navigate('/players')}
                isRetrying={query.isFetching}
                tag={tag}
              />
            </View>
          ) : (
            <PlayerSuccess
              player={query.data}
              onRefresh={() => void query.refetch()}
              isRefreshing={query.isFetching}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// ---------- success: identity card + analysis sections ----------

interface PlayerSuccessProps {
  player: PlayerResponse;
  /** Re-issues the same GET: handed to the card's refresh control. */
  onRefresh: () => void;
  /** True while that re-issued request is in flight. */
  isRefreshing: boolean;
}

function PlayerSuccess({ player, onRefresh, isRefreshing }: PlayerSuccessProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  // The two-column rule (07 section 3): identity + analysis from 1024 px up,
  // stacked below it. Read through useWindowDimensions into the breakpoints
  // helper, never CSS media queries.
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  const twoColumns = breakpoint === 'desktop';

  // The rushed verdict (the flagship engine, T-M2-2): computed here once
  // from the same single response the shell fetched, then handed to the
  // analysis cards as data. Pure engine call, no second fetch (SR-14).
  const verdict = useMemo(
    () => computeRushed(playerToUnitEntries(
      player.troops,
      player.spells,
      player.heroes,
      player.heroEquipment,
    )),
    [player.troops, player.spells, player.heroes, player.heroEquipment],
  );

  // The header reads the ranked-ladder tier (the same field the roster's
  // rank column reads) and falls back to the classic league object when
  // the payload carries no tier, so the player header and the roster never
  // disagree about which ladder they show.
  const league = player.leagueTier ?? player.league;

  // The FR-06 header cells. The values speak (tabular figures), the labels
  // whisper, the same rhythm the clan detail card's stat grid keeps. The
  // league cell pairs the tier icon with the tier name; a clanless player
  // renders the quiet dash in the clan role cell, and a player with no
  // league at all renders Unranked as text.
  const stats: ReadonlyArray<HeaderStat> = [
    { label: 'Town Hall', value: String(player.townHallLevel) },
    { label: 'League', value: league?.name ?? 'Unranked', iconUri: league?.iconUrls?.small },
    { label: 'XP level', value: String(player.expLevel) },
    { label: 'Clan role', value: player.role ? clanRoleLabel(player.role) : '\u2014' },
  ];

  // The stat grid wraps two cells per row inside the identity column (the
  // column the two-column layout gives the card is too narrow for four),
  // and follows the clan card's own rule when the card runs full width:
  // four per row from tablet up, two below.
  const cellBasis = twoColumns || breakpoint === 'mobile' || breakpoint === 'small'
    ? styles.statCellHalf
    : styles.statCellQuarter;

  // The identity card: the FR-06 header (name, tag | clan, stat grid) the
  // design language has always fixed, with the prototype's two actions
  // riding at the card's foot — the compare pill and the refresh control
  // share the actions block under a second hairline.
  const identityCard = (
    <View
      style={[base.panelRaised, styles.identityCard]}
      accessibilityLabel={`${player.name} player detail`}
    >
      <View style={styles.identityText}>
        <Text style={base.title} numberOfLines={1}>
          {player.name}
        </Text>
        <View style={styles.identityMeta}>
          <Text style={styles.tagLine}>{player.tag}</Text>
          {player.clan ? (
            <>
              <Text style={styles.metaDot} aria-hidden>
                |
              </Text>
              <Text style={styles.clanLine} numberOfLines={1}>
                {player.clan.name}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.statDivider} aria-hidden />

      <View style={styles.statGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statCell, cellBasis]}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            {stat.iconUri ? (
              <View style={styles.statValueRow}>
                <Image
                  source={{ uri: stat.iconUri }}
                  style={styles.leagueIcon}
                  accessibilityLabel={`${stat.value} league icon`}
                />
                <Text style={styles.statValue} numberOfLines={1}>
                  {stat.value}
                </Text>
              </View>
            ) : (
              <Text style={styles.statValue} numberOfLines={1}>
                {stat.value}
              </Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.statDivider} aria-hidden />

      {/* The actions block (the owner's prototype placement): the compare
          action above the refresh control, both on the card whose data
          they act on. */}
      <View style={styles.cardActions}>
        <PillButton
          label="Compare this player"
          icon="compare"
          onPress={() =>
            navigate(
              `/compare?mode=players&a=${encodeURIComponent(player.tag.replace(/^#/, ''))}`,
            )
          }
          hint="Opens the compare screen with this player pre-selected."
          stretch
        />
        <RefreshControl
          onRefresh={onRefresh}
          ageSeconds={player.age}
          isRefreshing={isRefreshing}
        />
      </View>
    </View>
  );

  const rushedCard = (
    <RushedAnalysisCard verdict={verdict} townHallLevel={player.townHallLevel} />
  );
  const upgradeNextCard = <UpgradeNextCard verdict={verdict} />;
  const heroCard = <HeroCard heroes={player.heroes} />;
  const progressionCard = <ProgressionCard player={player} />;
  const achievementsCard = <AchievementsCard achievements={player.achievements} />;

  return twoColumns ? (
    <View style={styles.columns}>
      <View style={styles.identityColumn}>
        {identityCard}
        {rushedCard}
        {upgradeNextCard}
      </View>
      <View style={styles.analysisColumn}>
        {heroCard}
        {progressionCard}
        {achievementsCard}
      </View>
    </View>
  ) : (
    <View style={styles.stackedColumn}>
      {identityCard}
      <View style={styles.sectionStack}>
        {rushedCard}
        {upgradeNextCard}
        {heroCard}
        {progressionCard}
        {achievementsCard}
      </View>
    </View>
  );
}

/** One header stat cell: a label, a value, and (the league cell only) the
 * API icon that pairs with the value. */
interface HeaderStat {
  label: string;
  value: string;
  iconUri?: string;
}

// ---------- rushed analysis card (T-M2-2, FR-07, SR-14) ----------

interface RushedAnalysisCardProps {
  verdict: RushedVerdict;
  townHallLevel: number;
}

// The flagship card the engine has been waiting for: the overall dial, the
// band chip, the reading's own scale note, and the per-category bars. The
// dial fills with the deficit percentage (gold, the verdict reserve); the
// bars carry each category's band color so the neglected category reads at
// a glance. The verdict itself is the engine's (src/engines/rushed.ts);
// this card only displays it (STD-09).
function RushedAnalysisCard({ verdict, townHallLevel }: RushedAnalysisCardProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const c = theme.colors;

  const percent = verdict.overallPercent;
  const band = verdict.band;

  // The bars' rows: one per measured category, colored by the band that
  // category's own percentage falls into, the same vocabulary the overall
  // chip keeps so the card reads as one judgment.
  const barRows = verdict.categories.map((category) => ({
    key: category.category,
    label: RUSHED_CATEGORY_LABELS[category.category],
    percent: category.percent,
    color: bandColor(c, bandFor(category.percent)),
  }));

  return (
    <View
      style={[base.panelRaised, styles.analysisCard]}
      accessibilityLabel={
        percent === null
          ? 'Rushed analysis, not available'
          : `Rushed analysis, ${Math.round(percent)} percent, ${RUSHED_BAND_LABELS[band as RushedBand]}`
      }
    >
      <View style={styles.cardHeader}>
        <Text style={base.title}>Rushed analysis</Text>
        <Text style={styles.cardHeaderMicro}>the flagship engine</Text>
      </View>

      <View style={styles.gaugeWrap}>
        <Gauge
          percent={percent}
          caption="DEFICIT VS TH CEILING"
          accessibilityLabel={
            percent === null
              ? 'Rushed percentage dial, not available'
              : `Rushed percentage dial, ${Math.round(percent)} percent`
          }
        />
        <View style={[band === null ? styles.chipQuiet : bandChipStyle(styles, band)]}>
          <Text style={band === null ? styles.chipQuietText : bandChipTextStyle(styles, band)}>
            {band === null ? 'not available' : RUSHED_BAND_LABELS[band]}
          </Text>
        </View>
        <Text style={styles.gaugeSub}>
          {percent === null
            ? 'The game API returned no units with a known maximum for this player.'
            : `${verdict.unitsCounted} units measured against the TH${townHallLevel} ceiling \u00B7 ${verdict.unitsMaxed} already maxed \u00B7 band scale 0 / 5 / 15 / 30%`}
        </Text>
      </View>

      {barRows.length > 0 ? (
        <View style={styles.catBars}>
          <CategoryBars rows={barRows} />
        </View>
      ) : null}

      {verdict.unitsSkipped > 0 ? (
        <Text style={styles.footnote}>
          {verdict.unitsSkipped === 1
            ? `1 unit was skipped (new content the reference tables have not met): ${verdict.skippedNames.join(', ')}.`
            : `${verdict.unitsSkipped} units were skipped (new content the reference tables have not met): ${verdict.skippedNames.join(', ')}.`}
        </Text>
      ) : null}
    </View>
  );
}

/** The band's fill color: the semantic tone its label carries. */
function bandColor(
  c: ReturnType<typeof useTheme>['theme']['colors'],
  band: RushedBand | null,
): string {
  if (band === null) return c.seriesMuted;
  switch (band) {
    case 'maxed':
    case 'core':
      return c.success;
    case 'light':
      return c.info;
    case 'rushed':
      return c.warning;
    case 'heavy':
      return c.danger;
  }
}

function bandChipStyle(styles: ReturnType<typeof createStyles>, band: RushedBand) {
  switch (band) {
    case 'maxed':
    case 'core':
      return styles.chipSuccess;
    case 'light':
      return styles.chipInfo;
    case 'rushed':
      return styles.chipWarning;
    case 'heavy':
      return styles.chipDanger;
  }
}

function bandChipTextStyle(styles: ReturnType<typeof createStyles>, band: RushedBand) {
  switch (band) {
    case 'maxed':
    case 'core':
      return styles.chipSuccessText;
    case 'light':
      return styles.chipInfoText;
    case 'rushed':
      return styles.chipWarningText;
    case 'heavy':
      return styles.chipDangerText;
  }
}

// ---------- upgrade next card (the engine's top deficits) ----------

interface UpgradeNextCardProps {
  verdict: RushedVerdict;
}

// The engine's "what to upgrade next" list (UR-03's literal answer): the
// largest deficits first, each with its rank circle, its level/maximum
// pair, and the gap behind as a warning chip. A maxed account gets the
// designed empty reading (AC-04), never a fabricated todo list.
function UpgradeNextCard({ verdict }: UpgradeNextCardProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const deficits = verdict.topDeficits;

  return (
    <View
      style={[base.panelRaised, styles.analysisCard]}
      accessibilityLabel={`Upgrade next, ${deficits.length} deficits`}
    >
      <View style={styles.cardHeader}>
        <Text style={base.title}>Upgrade next</Text>
        <Text style={styles.cardHeaderMicro}>largest deficits first</Text>
      </View>

      {deficits.length === 0 ? (
        <Text style={styles.maxedLine}>
          Nothing to catch up. This account is maxed for its Town Hall.
        </Text>
      ) : (
        <View style={styles.deficitList}>
          {deficits.map((deficit, index) => (
            <View
              key={deficit.name}
              style={styles.deficitRow}
              accessibilityLabel={`${deficit.name}, level ${deficit.level} of ${deficit.maxLevel}, ${deficit.deficit} behind`}
            >
              <View style={styles.deficitRank} aria-hidden>
                <Text style={styles.deficitRankText}>{index + 1}</Text>
              </View>
              <Text style={styles.deficitName} numberOfLines={1}>
                {deficit.name}
              </Text>
              <Text style={styles.deficitPair}>
                <Text style={styles.deficitPairLevel}>{deficit.level}</Text>
                {` of ${deficit.maxLevel}`}
              </Text>
              <View style={styles.chipWarning}>
                <Text style={styles.chipWarningText}>{`${deficit.deficit} behind`}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footnote}>
        The rushed score weights every unit equally and measures against the cap table for this Town Hall, so a maxed-for-TH account reads 0% no matter its level.
      </Text>
    </View>
  );
}

// ---------- hero card (T-M2-4, FR-09, SR-15) ----------

interface HeroCardProps {
  /** The parsed heroes from the single player response. Undefined only
   * when the payload carries none; the card renders its quiet empty
   * notice then, the same within-success degradation the achievements
   * card keeps. */
  heroes: PlayerResponse['heroes'];
}

// The hero panel: levels versus maximum, and equipment where the game API
// exposes it. The rows come off the player response the shell already
// fetched: no second call, no second loading state, the fetch is the
// shell's own (SR-15).
//
// The hero cards follow the owner's prototype layout: one compact card per
// hero, the bundled unit icon anchoring it (lib/icon-map.ts resolves the
// hero's picture, placeholder.svg when the game ships content the map has
// not met), the name with a gold MAX chip beside it when the hero is
// maxed, the "level X of Y" line under the name, and the level rail
// right-aligned in a fixed-width column with the pair under it — the
// long-grind reading at a glance. The cards wrap in measured rows of at
// least 240 px, the prototype's heroes grid.
//
// Cards group by village under quiet headers (the grouping rule the
// achievements card established, now shared through lib/village.ts): home
// heroes and builder-base heroes never mix, groups keep first-appearance
// order, cards keep API order. The equipment the API nests on the hero
// entry renders as quiet rows under the hero's name line with their own
// smaller icons — equipment renders under the hero it is equipped on, the
// only place the payload exposes it per hero; the flat heroEquipment
// inventory belongs to the progression grid (FR-16).
//
// A maxed hero mutes its text to the ledger treatment the completed
// achievement row takes (secondary name, muted sub-line), but the MAX chip
// stays gold and the icon stays at full strength: the chip is the verdict,
// the picture is identity, and dimming either would read as broken, not
// quiet. A hero with a null maxLevel (brand-new content the API has not
// caught up to, SR-14's shape) renders its level alone with no rail, and
// the card footnotes the count instead of inventing a maximum.
//
// Cards key on village-name-index, the same stable identity the
// achievement rows key on (STD-18): the payload could carry duplicate
// names, and the name alone is not a stable identity.

// The hero grid's gap between cards.
const HERO_CARD_GAP = 10;

function HeroCard({ heroes }: HeroCardProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!heroes || heroes.length === 0) {
    return (
      <EmptyState
        title="No heroes in this payload"
        body="The game API returned no heroes for this player. Refresh in a moment; even a brand-new account reaches its first hero within the opening quests."
      />
    );
  }

  const groups = groupByVillage(heroes);
  const maxedCount = heroes.filter((hero) => heroProgress(hero).isMaxed).length;
  const withoutMaxCount = heroes.filter((hero) => hero.maxLevel === null).length;

  // The header's count line, the prototype's reading: total levels banked
  // against the total ceiling, with the maxed count beside it.
  const totalLevels = heroes.reduce((sum, hero) => sum + hero.level, 0);
  const totalCeiling = heroes.reduce((sum, hero) => sum + (hero.maxLevel ?? 0), 0);

  return (
    <View
      style={[base.panelRaised, styles.heroCard]}
      accessibilityLabel={`Heroes, ${heroes.length} rows`}
    >
      <View style={styles.heroHeader}>
        <Text style={base.title}>Heroes</Text>
        <Text style={styles.heroCount}>
          {`${totalLevels} of ${totalCeiling} total levels \u00B7 ${formatProgressPair(maxedCount, heroes.length)} maxed`}
        </Text>
      </View>

      {groups.map((group, groupIndex) => (
        <View key={group.village} style={styles.heroGroup}>
          {groupIndex > 0 ? <View style={styles.heroDivider} aria-hidden /> : null}
          <Text style={styles.heroGroupLabel}>{group.label}</Text>
          <HeroGrid heroes={group.rows} village={group.village} />
        </View>
      ))}

      {withoutMaxCount > 0 ? (
        <Text style={styles.heroFootnote}>
          {withoutMaxCount === 1
            ? '1 hero is shown without a maximum: the game API has not caught up to it yet.'
            : `${withoutMaxCount} heroes are shown without a maximum: the game API has not caught up to them yet.`}
        </Text>
      ) : null}
    </View>
  );
}

/** One village group's hero grid: renders two columns on desktop and tablet
 * viewports, collapsing to a single column on narrow mobile devices. */
function HeroGrid({
  heroes,
  village,
}: {
  heroes: NonNullable<PlayerResponse['heroes']>;
  village: string;
}) {
  const [width, setWidth] = useState(0);

  // 2 columns whenever container is at least 380 px; 1 column on narrow mobile.
  // Defaults to 2 columns before layout measurement to avoid layout jump.
  const columns = width > 0 ? (width >= 380 ? 2 : 1) : 2;
  const basis = width > 0
    ? Math.floor((width - (columns - 1) * HERO_CARD_GAP) / columns)
    : null;

  return (
    <View
      style={heroGridStyle}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {heroes.map((hero, index) => (
        <HeroUnit
          key={`${village}-${hero.name}-${index}`}
          hero={hero}
          basis={basis}
        />
      ))}
    </View>
  );
}

// The hero grid's own shape is theme-free (a wrapping row with the grid's
// gap), so it is one static style sheet, not a per-theme one.
const heroGridStyle = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HERO_CARD_GAP,
  },
}).grid;

interface HeroUnitProps {
  hero: NonNullable<PlayerResponse['heroes']>[number];
  /** The measured column width the card takes, or null before the grid
   * has measured itself. */
  basis: number | null;
}

function HeroUnit({ hero, basis }: HeroUnitProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const progress = heroProgress(hero);

  // The card's own label: the name with the level/maximum pair (and the
  // maxed verdict when it holds). The rail adds its fill percent; the
  // equipment rows carry their own labels.
  const rowLabel = progress.hasMax
    ? `${hero.name}, level ${hero.level} of ${progress.maxLevel}${progress.isMaxed ? ', maxed' : ''}`
    : `${hero.name}, level ${hero.level}`;

  return (
    <View
      style={[
        styles.heroUnit,
        basis !== null
          ? { width: basis, maxWidth: basis, flexBasis: basis }
          : { flexBasis: '48%', flexGrow: 1 },
      ]}
      accessibilityLabel={rowLabel}
    >
      <UnitIcon kind="hero" name={hero.name} />
      <View style={styles.heroUnitText}>
        <View style={styles.heroNameRow}>
          <Text style={progress.isMaxed ? styles.heroNameDone : styles.heroName} numberOfLines={1}>
            {hero.name}
          </Text>
          {progress.isMaxed ? (
            <View style={styles.chipGold}>
              <Text style={styles.chipGoldText}>MAX</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.heroSub} numberOfLines={1}>
          {progress.hasMax
            ? `level ${hero.level} of ${progress.maxLevel}`
            : `level ${hero.level}`}
        </Text>
        {hero.equipment ? (
          <View style={styles.heroEquipment}>
            {hero.equipment.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                style={styles.equipmentRow}
                accessibilityLabel={
                  item.maxLevel !== null
                    ? `${item.name}, level ${item.level} of ${item.maxLevel}`
                    : `${item.name}, level ${item.level}`
                }
              >
                <UnitIcon kind="equipment" name={item.name} size="sm" />
                <Text style={styles.equipmentName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.equipmentPair} numberOfLines={1}>
                  {item.maxLevel !== null
                    ? formatLevelPair(item.level, item.maxLevel)
                    : `Lv ${item.level}`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {progress.hasMax ? (
        <View style={styles.heroRailColumn}>
          <LevelRail fill={progress.fill} />
          <Text style={styles.heroRailPair}>
            {formatLevelPair(hero.level, progress.maxLevel)}
          </Text>
        </View>
      ) : (
        // The rail column keeps its width even without a maximum, so a
        // null-max hero does not reflow its siblings' text.
        <View style={styles.heroRailColumn} aria-hidden />
      )}
    </View>
  );
}

// ---------- progression card (T-M2-5, FR-16, SR-16) ----------

interface ProgressionCardProps {
  player: PlayerResponse;
}

// The progression grid card. Every non-hero unit of both villages with its
// icon, current level, and a maxed chip, grouped by village and category
// (Home Village: Troops, Spells, Equipments, Pets, Siege; Builder Base:
// Troops). Heroes live on their own dedicated card above and are excluded
// here. The grid renders entirely from the same single player response the
// shell already fetched (SR-16): no second call, no second loading state,
// and no network request beyond the player fetch (AC-07). The grid is
// virtualized because a real account carries ~100 unit tiles across both
// villages (07 section 3).
//
// The card wraps the ProgressionGrid in the same panelRaised chrome the
// hero and achievements cards use, so the three analysis surfaces read as
// one family. A payload with no units renders the quiet empty notice, the
// same within-success degradation the other cards keep.
function ProgressionCard({ player }: ProgressionCardProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const groups = useMemo(() => playerToProgressionTiles(player), [player]);
  const tileCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.categories.reduce((s, b) => s + b.tiles.length, 0), 0),
    [groups],
  );

  if (tileCount === 0) {
    return (
      <EmptyState
        title="No units in this payload"
        body="The game API returned no troops, spells, equipment, pets, or siege machines for this player. Refresh in a moment; even a brand-new account carries its opening units."
      />
    );
  }

  return (
    <View
      style={[base.panelRaised, styles.progressionCard]}
      accessibilityLabel={`Progression grid, ${tileCount} units`}
    >
      <View style={styles.progressionHeader}>
        <Text style={base.title}>Progression</Text>
        <Text style={styles.progressionCount}>{tileCount} units</Text>
      </View>
      <ProgressionGrid groups={groups} />
    </View>
  );
}

// ---------- achievements card (T-M2-3, FR-08, SR-15) ----------

interface AchievementsCardProps {
  /** The parsed achievements from the single player response. Undefined
   * only when the payload carries none; the card renders its quiet empty
   * notice then, a within-success degradation the way a missing badge is
   * on the clan card. */
  achievements: PlayerResponse['achievements'];
}

// The achievements ledger card with filter pills, progress rails, and stars.
// The rows come off the player response the shell already fetched: no second
// call, no second loading state, the fetch is the shell's own (SR-15).
//
// Because a live payload carries ~54 achievements across three villages, a
// single-column vertical list creates an overly long scroll. Instead, the
// card pairs a filter bar (All / In Progress / Completed) with a responsive
// multi-column grid of compact achievement tiles (measured through onLayout
// just like HeroGrid). Each tile places the achievement name and star trio
// on the top line, the progress rail beside the tabular value/target counter
// on the meter line, and a single-line requirement note on in-progress tiles
// only. Completed tiles (all three stars in) mute their text and omit the
// requirement line so finished items take minimal height while in-progress
// items draw the eye.
//
// Tiles group by village under quiet headers: the live payload interleaves
// home, builder base, and clan capital rows, and a flat render would mix
// them. Tiles key on village-name-index because the live payload carries
// duplicate names (STD-18).

// The achievement tile grid's gap.
const ACHIEVEMENT_CARD_GAP = 8;

const ACHIEVEMENT_FILTERS: ReadonlyArray<AchievementFilter> = [
  'all',
  'inProgress',
  'complete',
];

function AchievementsCard({ achievements }: AchievementsCardProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [filter, setFilter] = useState<AchievementFilter>('all');

  if (!achievements || achievements.length === 0) {
    return (
      <EmptyState
        title="No achievements in this payload"
        body="The game API returned no achievements for this player. Refresh in a moment; a brand-new account can genuinely hold none."
      />
    );
  }

  const completedCount = achievements.filter((entry) => entry.stars >= 3).length;
  const inProgressCount = achievements.length - completedCount;
  const filterCounts: Record<AchievementFilter, number> = {
    all: achievements.length,
    inProgress: inProgressCount,
    complete: completedCount,
  };

  const filtered = filterAchievements(achievements, filter);
  const groups = groupAchievementsByVillage(filtered);

  return (
    <View
      style={[base.panelRaised, styles.achievementsCard]}
      accessibilityLabel={`Achievements, ${achievements.length} rows`}
    >
      <View style={styles.achievementsHeader}>
        <Text style={base.title}>Achievements</Text>
        <Text style={styles.achievementsCount}>
          {formatProgressPair(completedCount, achievements.length)} complete
        </Text>
      </View>

      <View
        style={styles.achievementsFilters}
        accessibilityRole="toolbar"
        accessibilityLabel="Filter achievements"
      >
        {ACHIEVEMENT_FILTERS.map((mode) => {
          const active = filter === mode;
          const label = ACHIEVEMENT_FILTER_LABELS[mode];
          const count = filterCounts[mode];
          return (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}, ${count} achievements`}
              onPress={() => setFilter(mode)}
              style={({ pressed }) => [
                styles.achievementFilterPill,
                active && styles.achievementFilterPillActive,
                pressed && !active && styles.achievementFilterPillPressed,
              ]}
            >
              <Text
                style={
                  active
                    ? styles.achievementFilterTextActive
                    : styles.achievementFilterText
                }
              >
                {label}
              </Text>
              <Text
                style={
                  active
                    ? styles.achievementFilterCountActive
                    : styles.achievementFilterCount
                }
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {groups.length === 0 ? (
        <Text style={styles.achievementsEmptyFilter}>
          {filter === 'inProgress'
            ? 'Every achievement in this payload is already complete.'
            : 'No achievements are completed yet.'}
        </Text>
      ) : (
        groups.map((group, groupIndex) => (
          <View key={group.village} style={styles.achievementsGroup}>
            {groupIndex > 0 ? <View style={styles.achievementsDivider} aria-hidden /> : null}
            <Text style={styles.achievementsGroupLabel}>{group.label}</Text>
            <AchievementGrid achievements={group.rows} village={group.village} />
          </View>
        ))
      )}
    </View>
  );
}

/** One village group's achievement grid: renders two columns on desktop and
 * tablet viewports, collapsing to a single column on narrow mobile devices. */
function AchievementGrid({
  achievements,
  village,
}: {
  achievements: NonNullable<PlayerResponse['achievements']>;
  village: string;
}) {
  const [width, setWidth] = useState(0);

  // 2 columns whenever container is at least 380 px; 1 column on narrow mobile.
  // Defaults to 2 columns before layout measurement to avoid layout jump.
  const columns = width > 0 ? (width >= 380 ? 2 : 1) : 2;
  const basis = width > 0
    ? Math.floor((width - (columns - 1) * ACHIEVEMENT_CARD_GAP) / columns)
    : null;

  return (
    <View
      style={achievementGridStyle}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {achievements.map((achievement, index) => (
        <AchievementRow
          key={`${village}-${achievement.name}-${index}`}
          achievement={achievement}
          basis={basis}
        />
      ))}
    </View>
  );
}

const achievementGridStyle = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ACHIEVEMENT_CARD_GAP,
  },
}).grid;

interface AchievementRowProps {
  achievement: NonNullable<PlayerResponse['achievements']>[number];
  /** The measured column width the tile takes, or null before the grid
   * has measured itself. */
  basis: number | null;
}

function AchievementRow({ achievement, basis }: AchievementRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const c = theme.colors;

  const progress = achievementProgress(achievement);
  const isComplete = progress.isComplete;

  // The completed tile's quiet treatment: the name demoted to secondary and
  // the requirement line dropped (its target is met, the tile is a record,
  // not a todo); the stars stay in the headline, all gold, because the
  // rating is the tile's verdict.
  const rowLabel = isComplete
    ? `${achievement.name}, complete, ${progress.stars.earned} of ${progress.stars.total} stars, ${formatProgressPair(achievement.value, achievement.target)}`
    : `${achievement.name}, ${achievement.info}, ${formatProgressPair(achievement.value, achievement.target)}, ${progress.stars.earned} of ${progress.stars.total} stars`;

  return (
    <View
      style={[
        styles.achievementRow,
        basis !== null
          ? { width: basis, maxWidth: basis, flexBasis: basis }
          : { flexBasis: '48%', flexGrow: 1 },
      ]}
      accessibilityLabel={rowLabel}
    >
      {/* Top line: the achievement name flexes on the left, the star trio
          rates it on the right. */}
      <View style={styles.achievementTop}>
        <Text style={isComplete ? styles.achievementNameDone : styles.achievementName} numberOfLines={1}>
          {achievement.name}
        </Text>
        <View style={styles.achievementStars} aria-hidden>
          {Array.from({ length: progress.stars.total }, (_, index) => (
            <Glyph
              key={index}
              name="star"
              color={index < progress.stars.earned ? c.accent : c.panelBorderStrong}
            />
          ))}
        </View>
      </View>
      {/* Meter line: the progress rail stretches beside the tabular
          value/target counter so both fit on a single compact row without
          crowding the achievement title. */}
      <View style={styles.achievementMeterRow}>
        <View style={styles.achievementRailWrap}>
          <ProgressRail progress={progress} showStars={false} />
        </View>
        <Text style={isComplete ? styles.achievementPairDone : styles.achievementPair}>
          {formatProgressPair(achievement.value, achievement.target)}
        </Text>
      </View>
      {!isComplete ? (
        <Text style={styles.achievementInfo} numberOfLines={1}>
          {achievement.info}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- loading skeleton (06 section 3) ----------

interface PlayerLoadingProps {
  /** True while a busy answer is being auto-retried; swaps the caption to
   * the "one moment" note so a throttled upstream reads as a slow fetch. */
  busyRetrying: boolean;
}

// The skeleton mirrors the whole success layout, not just the identity
// card: without the analysis sections' shapes below, the first paint would
// hold only the header's height and the page would visibly grow and reflow
// the moment data landed (the layout-matched rule, 06 section 3). Every
// size here mirrors a real element; if the success layout changes, this
// follows in the same PR.
function PlayerLoading({ busyRetrying }: PlayerLoadingProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useSkeletonPulse();

  const { width } = useWindowDimensions();
  const twoColumns = breakpointFor(width) === 'desktop';

  const identityCard = (
    <View
      style={[base.panelRaised, styles.identityCard]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading player"
    >
      {/* The header the data lands into: the name line, the tag + clan
          line, then the four stat cells the grid draws. */}
      <View style={styles.identityText}>
        <SkeletonBlock width={SKELETON_NAME_WIDTH} height={theme.fontSize.xl} pulse={pulse} />
        <SkeletonBlock width={SKELETON_META_WIDTH} height={theme.fontSize.sm} pulse={pulse} />
      </View>
      <View style={styles.statDivider} aria-hidden />
      <View style={styles.statGrid}>
        {Array.from({ length: SKELETON_STAT_CELLS }, (_, index) => (
          <View key={index} style={[styles.statCell, styles.statCellQuarter]}>
            <SkeletonBlock width={64} height={theme.fontSize.xs} pulse={pulse} />
            <SkeletonBlock width="80%" height={theme.fontSize.sm} pulse={pulse} />
          </View>
        ))}
      </View>
      <View style={styles.statDivider} aria-hidden />
      {/* The actions block: the compare pill above the refresh row. */}
      <View style={styles.cardActions}>
        <SkeletonBlock width={170} height={36} radiusStep="pill" pulse={pulse} />
        <SkeletonBlock width={130} height={28} radiusStep="pill" pulse={pulse} />
      </View>
      <Text style={[base.caption, styles.loadingCaption]}>
        {busyRetrying
          ? 'The game API is busy. One moment, retrying automatically…'
          : 'Fetching through the tier…'}
      </Text>
    </View>
  );

  const sectionBlock = (key: string) => (
    // Each block mirrors the panel it stands in for: the shared state
    // panel with a title line and a body line.
    <View key={key} style={base.statePanel}>
      <SkeletonBlock width="55%" height={theme.fontSize.xl} pulse={pulse} />
      <SkeletonBlock width="92%" height={theme.fontSize.body} pulse={pulse} />
    </View>
  );

  const rushedBlock = sectionBlock('sk-rushed');
  const upgradeBlock = sectionBlock('sk-upgrade');
  const heroBlock = sectionBlock('sk-heroes');
  const progressionBlock = sectionBlock('sk-progression');
  const achievementsBlock = sectionBlock('sk-achievements');

  return twoColumns ? (
    <View style={styles.columns} aria-hidden>
      {/* The identity column holds the card skeleton plus the rushed and
          upgrade-next skeletons; the analysis column holds the hero,
          progression, and achievements skeletons. */}
      <View style={styles.identityColumn}>
        {identityCard}
        {rushedBlock}
        {upgradeBlock}
      </View>
      <View style={styles.analysisColumn}>
        {heroBlock}
        {progressionBlock}
        {achievementsBlock}
      </View>
    </View>
  ) : (
    <View style={styles.stackedColumn} aria-hidden>
      {identityCard}
      <View style={styles.sectionStack}>
        {rushedBlock}
        {upgradeBlock}
        {heroBlock}
        {progressionBlock}
        {achievementsBlock}
      </View>
    </View>
  );
}

// ---------- error ----------

interface PlayerErrorProps {
  error: PlayerFetchError | Error;
  onRetry: () => void;
  onLookup: () => void;
  isRetrying: boolean;
  tag: string;
}

function PlayerError({ error, onRetry, onLookup, isRetrying, tag }: PlayerErrorProps) {
  // The contract (04 section 6) gives the player route the same four real
  // states the clan route has. Each gets its own copy and a next action,
  // never a dead end (06 section 3). The retry action is shared; the
  // not_found branch surfaces "tag lookup" as its own primary action since
  // retry cannot fix a tag that no longer resolves, and its body carries
  // the tag-correction hint the state matrix asks for: what a well-formed
  // tag looks like, so a typo'd URL can be fixed by hand.
  if (error instanceof PlayerFetchError) {
    const result = error.result;
    if (result.kind === 'not_found') {
      return (
        <ErrorState
          tone="gone"
          title="No player with this tag"
          body={`The tag ${tag} did not resolve. The player left the game, or the tag has a typo: tags are 3 to 20 letters and numbers after the #. Try the tag lookup instead.`}
          action={<PillButton label="Tag lookup" role="link" arrow onPress={onLookup} />}
        />
      );
    }
    if (result.kind === 'busy') {
      return (
        <ErrorState
          tone="busy"
          title="The game API is busy"
          body={`Upstream answered 429 and automatic retries have not cleared it yet. Trying again now may work, or wait about ${result.retryAfter}s and retry.`}
          action={
            <PillButton
              label={isRetrying ? 'Retrying…' : 'Retry now'}
              onPress={onRetry}
              disabled={isRetrying}
            />
          }
        />
      );
    }
    if (result.kind === 'unreachable') {
      return (
        <ErrorState
          tone="gone"
          title="Can't reach the game API"
          body="The proxy or the game API did not answer. This is usually transient; retry in a moment."
          action={
            <PillButton
              label={isRetrying ? 'Retrying…' : 'Retry'}
              onPress={onRetry}
              disabled={isRetrying}
            />
          }
        />
      );
    }
    return (
      <ErrorState
        tone="gone"
        title="The tag is malformed"
        body={`The tier rejected the tag ${tag}: ${result.detail}. Tags start with # and use letters and numbers only.`}
      />
    );
  }
  return (
    <ErrorState
      tone="gone"
      title="Something went wrong"
      body={error.message || 'An unexpected error happened while fetching the player.'}
      action={
        <PillButton
          label={isRetrying ? 'Retrying…' : 'Retry'}
          onPress={onRetry}
          disabled={isRetrying}
        />
      }
    />
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    column: {
      flex: 1,
    },
    // The crumbs sit a full step above the content, the same clearance the
    // clan detail card keeps (the owner's spacing note), so the loading and
    // error states keep it too.
    breadcrumbWrap: {
      marginBottom: t.spacing[4],
    },
    // The error panel's own gap, mirroring the clan screen's detail panel.
    detailPanel: {
      gap: t.spacing[5],
    },

    // The two-column rule (07 section 3): identity + analysis from 1024 px
    // up. The columns top-align; the identity card is a fixed shape and the
    // analysis sections carry the variable content, so neither stretches to
    // match the other's height.
    columns: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: t.spacing[5],
    },
    // The identity card keeps about a third of the row and never grows into
    // the analysis column's room; it may shrink a little on the narrower
    // desktop viewports, where its stat grid already wraps two per row.
    identityColumn: {
      flexBasis: '38%',
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      gap: t.spacing[4],
    },
    analysisColumn: {
      flexBasis: '58%',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      gap: t.spacing[4],
    },
    stackedColumn: {
      gap: t.spacing[5],
    },
    sectionStack: {
      gap: t.spacing[4],
    },

    // The identity card: name, the tag + clan line, a hairline, the stat
    // grid, a second hairline, then the actions block. The card carries the
    // panelRaised chrome the clan detail card uses, so the site's two
    // detail headers read as one family.
    identityCard: {
      gap: t.spacing[5],
    },
    identityText: {
      gap: t.spacing[1],
    },
    identityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[1],
    },
    tagLine: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    metaDot: {
      fontSize: t.fontSize.xs,
      color: c.hairline,
    },
    clanLine: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    statDivider: {
      height: 1,
      backgroundColor: c.hairline,
    },
    // The stat grid, the same wrap the clan detail card renders: cells flex
    // within their row so the grid stays even at any width.
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[4],
    },
    statCell: {
      flexGrow: 1,
      flexShrink: 1,
      gap: t.spacing[1],
    },
    // The basis sits under a half row so the wrap lands on even columns
    // while flexGrow fills each line to the edges; the quarter basis is the
    // clan card's four-up form, used only when the card runs full width.
    statCellHalf: {
      flexBasis: '46%',
    },
    statCellQuarter: {
      flexBasis: '22%',
    },
    statLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: LABEL_TRACKING,
    },
    statValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    statValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    // The league icon slot (07 section 7): fixed 24 px box.
    leagueIcon: {
      width: LEAGUE_ICON_SLOT,
      height: LEAGUE_ICON_SLOT,
    },
    // The actions block at the card's foot (the owner's prototype
    // placement): the compare pill above the refresh control, both on the
    // card whose data they act on.
    cardActions: {
      gap: t.spacing[2],
    },
    loadingCaption: {
      marginTop: t.spacing[1],
    },

    // ---------- chips (the cards' vocabulary) ----------
    // The MAX chip takes the gold reserve (the badge's one glance fact);
    // the band and deficit chips tone by verdict.
    chipGold: {
      backgroundColor: c.accentSoft,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
    },
    chipGoldText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.accent,
      fontVariant: ['tabular-nums'],
    },
    chipInfo: {
      backgroundColor: c.infoSoft,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
    },
    chipInfoText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.info,
    },
    chipQuiet: {
      backgroundColor: c.fillQuiet,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
    },
    chipQuietText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
    },
    chipSuccess: {
      backgroundColor: c.successSoft,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
    },
    chipSuccessText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.success,
    },
    chipWarning: {
      backgroundColor: c.warningSoft,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
    },
    chipWarningText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.warning,
      fontVariant: ['tabular-nums'],
    },
    chipDanger: {
      backgroundColor: c.dangerSoft,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
    },
    chipDangerText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.danger,
    },

    // ---------- analysis cards (rushed, upgrade next) ----------
    analysisCard: {
      gap: t.spacing[4],
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
    },
    cardHeaderMicro: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: LABEL_TRACKING,
    },
    gaugeWrap: {
      alignItems: 'center',
      gap: t.spacing[2],
    },
    gaugeSub: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      lineHeight: Math.round(t.lineHeight.normal * t.fontSize.xs),
      color: c.textMuted,
      textAlign: 'center',
      maxWidth: 300,
    },
    catBars: {
      alignSelf: 'stretch',
    },
    footnote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      lineHeight: Math.round(t.lineHeight.normal * t.fontSize.xs),
      color: c.textMuted,
    },
    maxedLine: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
    },
    deficitList: {
      alignSelf: 'stretch',
    },
    deficitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      paddingVertical: t.spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
      minHeight: t.layout.touchTargetMin,
    },
    deficitRank: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    deficitRankText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 10,
      fontWeight: t.fontWeight.bold,
      color: c.accent,
      fontVariant: ['tabular-nums'],
    },
    deficitName: {
      flex: 1,
      minWidth: 0,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
    },
    deficitPair: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
      flexShrink: 0,
    },
    deficitPairLevel: {
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },

    // ---------- hero card ----------
    // The card carries the panelRaised chrome the identity and
    // achievements cards use, so the analysis surfaces read as one family.
    heroCard: {
      gap: t.spacing[5],
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
    },
    // The "2 / 5 maxed" line: tabular figures, the count that matters at
    // a glance. "Maxed" whispers beside it, the same voice the
    // achievements count keeps.
    heroCount: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    heroGroup: {
      gap: t.spacing[3],
    },
    heroDivider: {
      height: 1,
      backgroundColor: c.hairline,
    },
    // The group header: the shell's micro-label treatment (uppercase,
    // tracked, muted), the same voice the stat cells keep.
    heroGroupLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: LABEL_TRACKING,
    },
    // One hero card (the prototype's layout): the icon anchoring the left
    // edge, the name + sub-line + equipment block filling the middle, and
    // the rail column pinned right with the pair under it.
    heroUnit: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderRadius: t.radius[2],
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      minWidth: 0,
    },
    heroUnitText: {
      flex: 1,
      minWidth: 0,
      gap: t.spacing[1],
    },
    heroNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    heroName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    // The maxed card's text demotion: secondary ink, the ledger treatment
    // the completed achievement row takes. The MAX chip beside the name
    // stays gold and the icon keeps its full strength — the chip is the
    // verdict, the picture is identity.
    heroNameDone: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textSecondary,
    },
    // The "level X of Y" sub-line under the name.
    heroSub: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    // The equipment block: quiet rows under the hero's name line with
    // their own smaller icons, so equipment reads as belonging to its
    // hero without breaking the card's single-glance shape.
    heroEquipment: {
      gap: t.spacing[1],
      marginTop: t.spacing[1],
    },
    // The equipment row: the small icon slot (20 px, the quiet variant)
    // beside the name, the pair right-aligned to the card's rail edge.
    equipmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    // Equipment rows keep the quiet treatment always (secondary name,
    // muted pair): they are inventory detail under their hero, and the
    // pair itself carries the maxed reading ("27 / 27").
    equipmentName: {
      flex: 1,
      minWidth: 0,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textSecondary,
    },
    equipmentPair: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    // The rail column (compact 84 px): the level rail with the pair under
    // it, fitting cleanly within 2-column hero cards without crowding equipment.
    heroRailColumn: {
      width: 84,
      gap: t.spacing[1],
      flexShrink: 0,
    },
    heroRailPair: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    // The quiet footnote for heroes without an exposed maximum.
    heroFootnote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      lineHeight: Math.round(t.lineHeight.normal * t.fontSize.xs),
      color: c.textMuted,
    },

    // ---------- progression card (T-M2-5) ----------
    progressionCard: {
      gap: t.spacing[4],
    },
    progressionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
    },
    progressionCount: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },

    // ---------- achievements card ----------
    // The card carries the panelRaised chrome the identity and hero cards
    // use, so the analysis surfaces read as one family.
    achievementsCard: {
      gap: t.spacing[4],
    },
    achievementsHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      columnGap: t.spacing[3],
    },
    // The "35 / 54 complete" line: tabular figures, the count that matters
    // at a glance. "Complete" whispers beside it.
    achievementsCount: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    // Filter pills (All / In Progress / Completed): 44 px minimum touch
    // target and focus ring per STD-17, wrapping cleanly on narrow screens.
    achievementsFilters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[2],
    },
    achievementFilterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
      borderRadius: t.radius.pill,
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.panelBorder,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    achievementFilterPillActive: {
      backgroundColor: c.accentSoft,
      borderColor: c.accent,
    },
    achievementFilterPillPressed: {
      backgroundColor: c.panel,
    },
    achievementFilterText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
    },
    achievementFilterTextActive: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.accent,
    },
    achievementFilterCount: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    achievementFilterCountActive: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.accent,
      fontVariant: ['tabular-nums'],
    },
    achievementsEmptyFilter: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
    },
    achievementsGroup: {
      gap: t.spacing[2],
    },
    achievementsDivider: {
      height: 1,
      backgroundColor: c.hairline,
    },
    // The group header: the shell's micro-label treatment (uppercase,
    // tracked, muted), the same voice the stat cells keep.
    achievementsGroupLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: LABEL_TRACKING,
    },
    // One compact achievement tile inside the measured multi-column grid:
    // quiet fill, hairline border, tight internal rhythm so 54 rows read as
    // a scannable ledger grid rather than a towering single-column list.
    achievementRow: {
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderRadius: t.radius[2],
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      gap: t.spacing[1],
      minWidth: 0,
    },
    achievementTop: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    achievementName: {
      flex: 1,
      minWidth: 0,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    // The completed tile's demotion: secondary ink, the ledger treatment.
    achievementNameDone: {
      flex: 1,
      minWidth: 0,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textSecondary,
    },
    // The star trio: the rating glyphs from the kit's Glyph set, gold for
    // earned tiers, the strong border tone for the open ones.
    achievementStars: {
      flexDirection: 'row',
      columnGap: 2,
      flexShrink: 0,
    },
    achievementMeterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    achievementRailWrap: {
      flex: 1,
      minWidth: 0,
    },
    achievementInfo: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      lineHeight: Math.round(t.lineHeight.normal * t.fontSize.xs),
      color: c.textMuted,
    },
    // The value/target pair: tabular figures beside the rail.
    achievementPair: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
      flexShrink: 0,
    },
    achievementPairDone: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
      flexShrink: 0,
    },
  });
}
