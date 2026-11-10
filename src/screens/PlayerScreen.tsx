import { useMemo } from 'react';
import {
  Image,
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
  achievementProgress,
  formatProgressPair,
  groupAchievementsByVillage,
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
// states and lays out the page the prototype rework fixed: a full-width
// identity card, then the analysis in two two-column grids.
//
// The identity card carries the FR-06 header the prototype drew: the avatar
// monogram, the name with the Town Hall / tag / role chips beside it, the
// season chips (league with its icon, trophies, war stars, attack wins, XP,
// the donation pair), and an actions column on the right holding the
// compare button and the manual refresh control. The refresh control moved
// here from the page footer (the owner's placement call): freshness belongs
// to the card whose data it describes, the same corner the clan screen's
// footer row occupies but one card closer to the numbers.
//
// The analysis grids (from 1024 px up, stacked below):
// - Grid one, the verdict: the rushed analysis card (the flagship dial and
//   its category bars, T-M2-2's card half) beside the upgrade-next list
//   (the engine's top deficits as "what to fix first").
// - Grid two, the ledgers: the hero and achievements cards in one column,
//   the progression grid in the other. Long lists left, the tall tile grid
//   right, the same balance the prototype struck.
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
// CDN load never reflows the chip row. The identity chips read the small
// size at 16 px, half the header's old 24 px slot, chips are one line tall.
const LEAGUE_ICON_SLOT = 16;

// The avatar monogram's slot (the prototype's avatar-lg): a fixed circle the
// initials sit in, gold-ringed on the accent-soft field.
const AVATAR_SIZE = 56;

// Line widths chosen to read as a name and a chips line; the identity
// skeleton mirrors the card's real shapes so the first paint holds the
// layout the data lands into (06 section 3).
const SKELETON_NAME_WIDTH = 200;

// The analysis blocks the skeleton draws, matching the five panels the
// success state renders (rushed, upgrade next, heroes, achievements,
// progression).
const SKELETON_SECTIONS = 5;

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

// ---------- success: identity card + analysis grids ----------

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

  // The two-column rule (07 section 3): the analysis grids pair up from
  // 1024 px up, stacked below it. Read through useWindowDimensions into the
  // breakpoints helper, never CSS media queries.
  const { width } = useWindowDimensions();
  const twoColumns = breakpointFor(width) === 'desktop';

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

  // The identity card the prototype drew: avatar, name + chips, season
  // chips, and the actions column (compare, refresh) on the right.
  const identityCard = (
    <View
      style={[base.panelRaised, styles.identityCard]}
      accessibilityLabel={`${player.name} player detail`}
    >
      <View style={styles.identityRow}>
        <View style={styles.avatar} aria-hidden>
          <Text style={styles.avatarText}>{monogramFor(player.name)}</Text>
        </View>

        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <Text style={base.title} numberOfLines={1}>
              {player.name}
            </Text>
            <View style={styles.chipRow}>
              <View style={styles.chipGold}>
                <Text style={styles.chipGoldText}>{`TH ${player.townHallLevel}`}</Text>
              </View>
              <View style={styles.chipTag}>
                <Text style={styles.chipTagText}>{player.tag}</Text>
              </View>
              {player.role ? (
                <View style={roleChipStyle(styles, player.role)}>
                  <Text style={roleChipTextStyle(styles, player.role)}>
                    {clanRoleLabel(player.role)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.metaRow}>
            <LeagueChip
              name={(player.leagueTier ?? player.league)?.name}
              iconUri={(player.leagueTier ?? player.league)?.iconUrls?.small}
            />
            <MetaChip label={`${formatCount(player.trophies)} trophies`} present={player.trophies !== undefined} />
            <MetaChip label={`${formatCount(player.warStars)} war stars`} present={player.warStars !== undefined} />
            <MetaChip label={`${formatCount(player.attackWins)} attack wins`} present={player.attackWins !== undefined} />
            <MetaChip label={`XP ${player.expLevel}`} present />
            {player.donations !== undefined || player.donationsReceived !== undefined ? (
              <MetaChip
                label={`${formatCount(player.donations ?? 0)} : ${formatCount(player.donationsReceived ?? 0)} this season`}
                present
              />
            ) : null}
          </View>
        </View>

        <View style={styles.actionsColumn}>
          <PillButton
            label="Compare this player"
            onPress={() => navigate('/compare')}
            hint="Opens the compare screen. Player versus player pairing lands with the compare cards."
          />
          <RefreshControl
            onRefresh={onRefresh}
            ageSeconds={player.age}
            isRefreshing={isRefreshing}
          />
        </View>
      </View>
    </View>
  );

  const rushedCard = <RushedAnalysisCard verdict={verdict} townHallLevel={player.townHallLevel} />;
  const upgradeCard = <UpgradeNextCard verdict={verdict} />;
  const heroCard = <HeroCard heroes={player.heroes} />;
  const achievementsCard = <AchievementsCard achievements={player.achievements} />;
  const progressionCard = <ProgressionCard player={player} />;

  if (!twoColumns) {
    return (
      <View style={styles.detailWrap}>
        {identityCard}
        <View style={styles.columnStack}>
          {rushedCard}
          {upgradeCard}
          {heroCard}
          {achievementsCard}
          {progressionCard}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.detailWrap}>
      {identityCard}
      <View style={styles.columnStack}>
        <View style={styles.gridRow}>
          <View style={styles.gridColumn}>{rushedCard}</View>
          <View style={styles.gridColumn}>{upgradeCard}</View>
        </View>
        <View style={styles.gridRow}>
          <View style={styles.gridColumn}>
            {heroCard}
            {achievementsCard}
          </View>
          <View style={styles.gridColumn}>{progressionCard}</View>
        </View>
      </View>
    </View>
  );
}

// ---------- identity chip helpers ----------

/** The avatar's initials: the first letter of the first two name segments. */
function monogramFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) return '#';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** The house number format (lib/achievement-progress.ts keeps the same). */
function formatCount(value: number | undefined): string {
  return Math.max(0, value ?? 0).toLocaleString('en-US');
}

/** The league chip: the tier icon beside the tier name, Unranked when none. */
function LeagueChip({ name, iconUri }: { name?: string; iconUri?: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createChipStyles(theme), [theme]);

  return (
    <View style={styles.chipMeta} accessibilityLabel={name ? `League, ${name}` : 'Unranked'}>
      {iconUri ? (
        <Image
          source={{ uri: iconUri }}
          style={styles.leagueIcon}
          accessibilityLabel={`${name} league icon`}
        />
      ) : null}
      <Text style={styles.chipMetaValue} numberOfLines={1}>
        {name ?? 'Unranked'}
      </Text>
    </View>
  );
}

/** One season chip; a counter the payload omitted renders nothing at all. */
function MetaChip({ label, present }: { label: string; present: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createChipStyles(theme), [theme]);

  if (!present) return null;
  return (
    <View style={styles.chipMeta}>
      <Text style={styles.chipMetaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// The role chip's tone: the leader takes the gold reserve, the senior
// roles take the info tone, a plain member stays quiet. The classes ride
// the styles object so the mapping stays style-only.
function roleChipStyle(
  styles: ReturnType<typeof createStyles>,
  role: string,
) {
  if (role === 'leader') return styles.chipGold;
  if (role === 'coLeader' || role === 'admin') return styles.chipInfo;
  return styles.chipQuiet;
}

function roleChipTextStyle(
  styles: ReturnType<typeof createStyles>,
  role: string,
) {
  if (role === 'leader') return styles.chipGoldText;
  if (role === 'coLeader' || role === 'admin') return styles.chipInfoText;
  return styles.chipQuietText;
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
// Rows group by village under quiet headers (the grouping rule the
// achievements card established, now shared through lib/village.ts): home
// heroes and builder-base heroes never mix, groups keep
// first-appearance order, rows keep API order. One row per hero: the
// bundled unit icon anchors the name line (lib/icon-map.ts resolves the
// hero's picture, placeholder.svg when the game ships content the map
// has not met), the name and the level/maximum pair share the line beside it
// (heroes carry no requirement text the way achievements do, so the line
// has room), the LevelRail under it, and the equipment the API nests on
// the hero entry as quiet indented rows below with their own smaller
// icons — equipment renders under the hero it is equipped
// on, the only place the payload exposes it per hero; the flat
// heroEquipment inventory belongs to the progression grid (FR-16).
//
// A maxed hero mutes to the ledger treatment the completed achievement
// row takes (secondary name, muted pair), so the heroes still climbing
// draw the eye; on a maxed account the card reads as a quiet ledger. A
// hero with a null maxLevel (brand-new content the API has not caught up
// to, SR-14's shape) renders its level alone with no rail and no pair,
// and the card footnotes the count instead of inventing a maximum.
//
// Rows key on village-name-index, the same stable identity the
// achievement rows key on (STD-18): the payload could carry duplicate
// names, and the name alone is not a stable identity.
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

  return (
    <View
      style={[base.panelRaised, styles.heroCard]}
      accessibilityLabel={`Heroes, ${heroes.length} rows`}
    >
      <View style={styles.heroHeader}>
        <Text style={base.title}>Heroes</Text>
        <Text style={styles.heroCount}>
          {formatProgressPair(maxedCount, heroes.length)} maxed
        </Text>
      </View>

      {groups.map((group, groupIndex) => (
        <View key={group.village} style={styles.heroGroup}>
          {groupIndex > 0 ? <View style={styles.heroDivider} aria-hidden /> : null}
          <Text style={styles.heroGroupLabel}>{group.label}</Text>
          <View style={styles.heroRows}>
            {group.rows.map((hero, index) => (
              <HeroRow
                key={`${group.village}-${hero.name}-${index}`}
                hero={hero}
              />
            ))}
          </View>
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

interface HeroRowProps {
  hero: NonNullable<PlayerResponse['heroes']>[number];
}

function HeroRow({ hero }: HeroRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const progress = heroProgress(hero);

  // The row's own label: the name with the level/maximum pair (and the
  // maxed verdict when it holds). The rail adds its fill percent; the
  // equipment rows carry their own labels.
  const rowLabel = progress.hasMax
    ? `${hero.name}, level ${hero.level} of ${progress.maxLevel}${progress.isMaxed ? ', maxed' : ''}`
    : `${hero.name}, level ${hero.level}`;

  return (
    <View style={styles.heroRow} accessibilityLabel={rowLabel}>
      <View style={styles.heroLine}>
        <UnitIcon kind="hero" name={hero.name} />
        <View style={styles.heroText}>
          <Text style={progress.isMaxed ? styles.heroNameDone : styles.heroName} numberOfLines={1}>
            {hero.name}
          </Text>
          <Text style={progress.isMaxed ? styles.heroPairDone : styles.heroPair} numberOfLines={1}>
            {progress.hasMax ? formatLevelPair(hero.level, progress.maxLevel) : `Lv ${hero.level}`}
          </Text>
        </View>
      </View>
      {progress.hasMax ? <LevelRail fill={progress.fill} /> : null}
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
              <View style={styles.equipmentText}>
                <Text style={styles.equipmentName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.equipmentPair} numberOfLines={1}>
                  {item.maxLevel !== null
                    ? formatLevelPair(item.level, item.maxLevel)
                    : `Lv ${item.level}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
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

// The achievements list with progress rails and stars. The rows come off
// the player response the shell already fetched: no second call, no second
// loading state, the fetch is the shell's own (SR-15).
//
// The rows group by village under quiet headers: the live payload
// interleaves home, builder base, and clan capital rows, and a flat render
// would mix them. A completed row (all three stars in) mutes to the quiet
// treatment — secondary name, no requirement text, no open star — so the
// in-progress rows draw the eye; on a maxed account the card reads as a
// quiet ledger, which is the honest reading of a finished list.
//
// Rows key on village-name-index: the live payload carries duplicate names
// (one locked "Keep Your Account Safe!" beside the completed one), so the
// name alone is not a stable identity (STD-18).
function AchievementsCard({ achievements }: AchievementsCardProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!achievements || achievements.length === 0) {
    return (
      <EmptyState
        title="No achievements in this payload"
        body="The game API returned no achievements for this player. Refresh in a moment; a brand-new account can genuinely hold none."
      />
    );
  }

  const groups = groupAchievementsByVillage(achievements);

  return (
    <View
      style={[base.panelRaised, styles.achievementsCard]}
      accessibilityLabel={`Achievements, ${achievements.length} rows`}
    >
      <View style={styles.achievementsHeader}>
        <Text style={base.title}>Achievements</Text>
        <Text style={styles.achievementsCount}>
          {formatProgressPair(
            achievements.filter((entry) => entry.stars >= 3).length,
            achievements.length,
          )}{' '}
          complete
        </Text>
      </View>

      {groups.map((group, groupIndex) => (
        <View key={group.village} style={styles.achievementsGroup}>
          {groupIndex > 0 ? <View style={styles.achievementsDivider} aria-hidden /> : null}
          <Text style={styles.achievementsGroupLabel}>{group.label}</Text>
          <View style={styles.achievementsRows}>
            {group.rows.map((achievement, index) => (
              <AchievementRow
                key={`${group.village}-${achievement.name}-${index}`}
                achievement={achievement}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

interface AchievementRowProps {
  achievement: NonNullable<PlayerResponse['achievements']>[number];
}

function AchievementRow({ achievement }: AchievementRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const progress = achievementProgress(achievement);
  const isComplete = progress.isComplete;

  // The completed row's quiet treatment: the name demoted to secondary, the
  // requirement line dropped (its target is met, the row is a record, not a
  // todo), and the stars all gold with no open marker beside them.
  const rowLabel = isComplete
    ? `${achievement.name}, complete, ${progress.stars.earned} of ${progress.stars.total} stars, ${formatProgressPair(achievement.value, achievement.target)}`
    : `${achievement.name}, ${achievement.info}, ${formatProgressPair(achievement.value, achievement.target)}, ${progress.stars.earned} of ${progress.stars.total} stars`;

  return (
    <View style={styles.achievementRow} accessibilityLabel={rowLabel}>
      <View style={styles.achievementText}>
        <Text style={isComplete ? styles.achievementNameDone : styles.achievementName} numberOfLines={1}>
          {achievement.name}
        </Text>
        {!isComplete ? (
          <Text style={styles.achievementInfo} numberOfLines={2}>
            {achievement.info}
          </Text>
        ) : null}
      </View>
      <View style={styles.achievementRailWrap}>
        <Text style={isComplete ? styles.achievementPairDone : styles.achievementPair}>
          {formatProgressPair(achievement.value, achievement.target)}
        </Text>
        <ProgressRail progress={progress} />
      </View>
    </View>
  );
}

// ---------- progression card (T-M2-5, FR-16, SR-16) ----------

interface ProgressionCardProps {
  player: PlayerResponse;
}

// The progression grid card. Every unit of both villages with its icon,
// current level, and a maxed chip, grouped by village and category. The
// grid renders entirely from the same single player response the shell
// already fetched (SR-16): no second call, no second loading state, and
// no network request beyond the player fetch (AC-07). The grid is
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
        body="The game API returned no troops, spells, heroes, or equipment for this player. Refresh in a moment; even a brand-new account carries its opening units."
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
      <View style={styles.identityRow}>
        <View style={styles.avatarSkeleton} aria-hidden />
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <SkeletonBlock width={SKELETON_NAME_WIDTH} height={theme.fontSize.xl} pulse={pulse} />
            <View style={styles.chipRow}>
              {Array.from({ length: 3 }, (_, index) => (
                <SkeletonBlock key={index} width={56} height={20} pulse={pulse} />
              ))}
            </View>
          </View>
          <View style={styles.metaRow}>
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonBlock key={index} width={92} height={20} pulse={pulse} />
            ))}
          </View>
        </View>
        <View style={styles.actionsColumn}>
          <SkeletonBlock width={150} height={36} radiusStep="pill" pulse={pulse} />
          <SkeletonBlock width={110} height={36} radiusStep="pill" pulse={pulse} />
        </View>
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

  return (
    <View style={styles.detailWrap}>
      {identityCard}
      <View style={styles.columnStack} aria-hidden>
        {twoColumns ? (
          <>
            {/* The verdict grid: rushed beside upgrade next. */}
            <View style={styles.gridRow}>
              <View style={styles.gridColumn}>{sectionBlock('sk-rushed')}</View>
              <View style={styles.gridColumn}>{sectionBlock('sk-upgrade')}</View>
            </View>
            {/* The ledgers grid: heroes above achievements in one column,
                the tall progression grid in the other. */}
            <View style={styles.gridRow}>
              <View style={styles.gridColumn}>
                {sectionBlock('sk-heroes')}
                {sectionBlock('sk-achievements')}
              </View>
              <View style={styles.gridColumn}>{sectionBlock('sk-progression')}</View>
            </View>
          </>
        ) : (
          Array.from({ length: SKELETON_SECTIONS }, (_, index) => sectionBlock(`sk-${index}`))
        )}
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

// The identity chips' own small sheet: LeagueChip and MetaChip are components
// (STD-13: they own their styles), but they do not need the whole screen
// sheet to draw one chip, so they build this lightweight one instead.
function createChipStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    chipMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[1],
      backgroundColor: c.fillQuiet,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[2],
      paddingVertical: 3,
    },
    chipMetaText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    chipMetaValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    leagueIcon: {
      width: LEAGUE_ICON_SLOT,
      height: LEAGUE_ICON_SLOT,
    },
  });
}

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

    // The prototype layout: the full-width identity card above, then the
    // analysis in two two-column grids (stacked below 1024). The wrap and
    // the column stack carry the vertical rhythm.
    detailWrap: {
      gap: t.spacing[4],
    },
    columnStack: {
      gap: t.spacing[4],
    },
    gridRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: t.spacing[4],
    },
    gridColumn: {
      flexBasis: '48%',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      gap: t.spacing[4],
    },

    // The identity card: avatar, text block, actions column in one row that
    // wraps when the window cannot hold it.
    identityCard: {
      gap: t.spacing[4],
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[4],
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: c.accentSoft,
      borderWidth: 2,
      borderColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xl,
      fontWeight: t.fontWeight.bold,
      color: c.accent,
    },
    avatarSkeleton: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: c.fillQuiet,
    },
    identityText: {
      flex: 1,
      minWidth: 240,
      gap: t.spacing[3],
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[2],
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[2],
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[2],
    },
    // The actions column: the compare action and the refresh control,
    // stacked on the card's right edge; wraps under the text block on
    // narrow windows.
    actionsColumn: {
      alignItems: 'flex-end',
      gap: t.spacing[2],
    },
    loadingCaption: {
      marginTop: t.spacing[1],
    },

    // ---------- chips (the identity card's vocabulary) ----------
    // The TH chip takes the gold reserve (the badge's one glance fact); the
    // tag chip stays quiet mono; the role chip tones by seniority; the
    // season chips are the quiet meta row.
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
    chipTag: {
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
    },
    chipTagText: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
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
    heroRows: {
      gap: t.spacing[4],
    },
    // One row: the icon + name line on top, the level rail full width
    // under it, the equipment rows indented below.
    heroRow: {
      gap: t.spacing[2],
    },
    // The name line: the hero's unit icon anchors it (32 px slot, 07
    // section 4), the text block takes the remaining width. Center-aligned
    // so the icon sits level with the name whatever the pair's digits.
    heroLine: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
      minWidth: 0,
    },
    // The name and the pair share the line beside the icon (heroes carry
    // no requirement text the way achievements do, so the line has room);
    // the block flexes so the pair right-aligns to the card's edge, not
    // the icon's, and the tabular figures stack down the card.
    heroText: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      columnGap: t.spacing[3],
      flex: 1,
      minWidth: 0,
    },
    heroName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    // The maxed row's demotion: secondary ink, the ledger treatment the
    // completed achievement row takes.
    heroNameDone: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textSecondary,
    },
    heroPair: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    heroPairDone: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    // The equipment block: indented one step so the rows read as
    // belonging to the hero above them, never as peers of the hero rows.
    heroEquipment: {
      paddingLeft: t.spacing[4],
      gap: t.spacing[1],
    },
    // The equipment row: the small icon slot (20 px, the quiet variant)
    // beside the name + pair line, center-aligned the way the hero line
    // keeps, one scale down.
    equipmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    // The name and pair share the remaining line; the pair right-aligns
    // to the same card edge the hero pairs stack against.
    equipmentText: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      columnGap: t.spacing[2],
      flex: 1,
      minWidth: 0,
    },
    // Equipment rows keep the quiet treatment always (secondary name,
    // muted pair): they are inventory detail under their hero, and the
    // pair itself carries the maxed reading ("27 / 27").
    equipmentName: {
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
    // The quiet footnote for heroes without an exposed maximum.
    heroFootnote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      lineHeight: Math.round(t.lineHeight.normal * t.fontSize.xs),
      color: c.textMuted,
    },

    // ---------- achievements card ----------
    // The card carries the panelRaised chrome the identity card uses, so the
    // analysis surfaces read as one family once the other two cards land.
    achievementsCard: {
      gap: t.spacing[5],
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
    achievementsGroup: {
      gap: t.spacing[3],
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
    achievementsRows: {
      gap: t.spacing[4],
    },
    // One row: the text block on top, the pair + rail under it. The rail
    // pair right-aligns with the rail's track so the numbers read as the
    // bar's own scale.
    achievementRow: {
      gap: t.spacing[2],
    },
    achievementText: {
      gap: t.spacing[1],
      minWidth: 0,
    },
    achievementName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    // The completed row's demotion: secondary ink, the ledger treatment.
    achievementNameDone: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textSecondary,
    },
    achievementInfo: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      lineHeight: Math.round(t.lineHeight.normal * t.fontSize.xs),
      color: c.textMuted,
    },
    achievementRailWrap: {
      gap: t.spacing[2],
    },
    // The value/target pair: tabular figures so the columns of pairs align
    // down the card; the size is the pair the roster's number cells keep.
    achievementPair: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    achievementPairDone: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },

    // progression card (T-M2-5)
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
  });
}
