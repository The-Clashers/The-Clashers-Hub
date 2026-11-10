import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme, createBaseStyles } from '../theme';
import LookupSearch from '../components/LookupSearch';
import RecentSearchesStrip from '../components/RecentSearchesStrip';
import Gauge from '../components/Gauge';
import CategoryBars, { type CategoryBarRow } from '../components/CategoryBars';
import RatioFlag from '../components/RatioFlag';
import type { DonationVerdict } from '../lib/donation-balance';
import { clanRouteFor, playerRouteFor } from '../lib/tag';
import type { RecentSearchItem } from '../lib/recent-searches';

// The quick-link cards: where each goes and the one line that says what
// the visitor will find there.
const QUICK_LINKS: ReadonlyArray<{ title: string; body: string; route: string }> = [
  {
    title: 'Clans',
    body: 'Search by clan name or #tag, narrow it with filters, open the roster.',
    route: '/clans',
  },
  {
    title: 'Players',
    body: 'Look a player up by tag: profile, rushed analysis, progression.',
    route: '/players',
  },
  {
    title: 'Compare',
    body: 'Head-to-head analysis. Compare two players or two clans side by side.',
    route: '/compare',
  },
  {
    title: 'Contributors',
    body: 'The people building The Clashers Hub, straight from the repo.',
    route: '/contributors',
  },
];

const SAMPLE_GOOD_VERDICT: DonationVerdict = {
  member: { tag: '#M1', name: 'Balanced Member', donations: 2500, donationsReceived: 1000 },
  given: 2500,
  received: 1000,
  ratio: 2.5,
  deficit: 0,
  flagged: false,
  state: 'good',
};

const SAMPLE_WARN_VERDICT: DonationVerdict = {
  member: { tag: '#M2', name: 'Needs Attention', donations: 300, donationsReceived: 1000 },
  given: 300,
  received: 1000,
  ratio: 0.3,
  deficit: 700,
  flagged: true,
  state: 'warn',
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  const sampleBars: ReadonlyArray<CategoryBarRow> = useMemo(
    () => [
      { key: 'heroes', label: 'Heroes', percent: 4.8, color: theme.colors.success },
      { key: 'troops', label: 'Troops', percent: 6.2, color: theme.colors.info },
      { key: 'spells', label: 'Spells', percent: 12.5, color: theme.colors.warning },
      { key: 'petsSiege', label: 'Pets & Siege', percent: 9.1, color: theme.colors.info },
    ],
    [theme.colors],
  );

  const handleRecentSelect = (item: RecentSearchItem) => {
    if (item.kind === 'player') {
      navigate(playerRouteFor(item.query));
    } else if (item.query.startsWith('#')) {
      navigate(clanRouteFor(item.query));
    } else {
      navigate(`/clans?name=${encodeURIComponent(item.query)}`);
    }
  };

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.header}>
            <Text style={base.display}>The Clashers Hub</Text>
            <Text style={base.subtitle}>
              Clan and player stats for Clash of Clans, read live from the game API.
            </Text>
          </View>

          {/* Hero search box */}
          <View style={[base.panelRaised, styles.heroPanel]}>
            <LookupSearch variant="hero" actionLabel="Search" />
            <RecentSearchesStrip onSelect={handleRecentSelect} />
          </View>

          {/* Quick link cards */}
          <View style={styles.linkRow}>
            {QUICK_LINKS.map((link) => (
              <Pressable
                key={link.route}
                accessibilityRole="link"
                accessibilityLabel={`${link.title} page`}
                onPress={() => navigate(link.route)}
                style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
              >
                <Text style={styles.linkTitle}>{link.title}</Text>
                <Text style={styles.linkBody}>{link.body}</Text>
                <Text style={styles.linkArrow} aria-hidden>
                  {'Open \u2192'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Analysis Engine Showcase */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionMicro}>Analysis Engines</Text>
              <Text style={styles.sectionTitle}>Verdicts, Not Just Raw Counters</Text>
              <Text style={styles.sectionDescription}>
                Raw game data turned into actionable judgments with zero manual math.
              </Text>
            </View>

            <View style={styles.showcaseGrid}>
              {/* Card 1: Rushed Profile Audit */}
              <View style={[base.panelRaised, styles.showcaseCard]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTag}>FLAGSHIP ENGINE</Text>
                  <Text style={styles.cardHeading}>Rushed Profile Audit</Text>
                </View>
                <View style={styles.gaugeWrap}>
                  <Gauge
                    percent={8.4}
                    caption="8.4% · Light"
                    accessibilityLabel="Sample rushed gauge: 8.4 percent, Light"
                  />
                </View>
                <CategoryBars rows={sampleBars} />
                <Text style={styles.cardBody}>
                  Audits lab, heroes, and pets against Town Hall caps with super-troop normalization.
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Try player audit on Players page"
                  onPress={() => navigate('/players')}
                  style={({ pressed }) => [styles.cardAction, pressed && styles.cardActionPressed]}
                >
                  <Text style={styles.cardActionText}>Try Player Audit {'\u2192'}</Text>
                </Pressable>
              </View>

              {/* Card 2: Donation Balance */}
              <View style={[base.panelRaised, styles.showcaseCard]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTag}>ROSTER HEALTH</Text>
                  <Text style={styles.cardHeading}>Donation Balance</Text>
                </View>
                <View style={styles.donationBlock}>
                  <View style={styles.sampleFlagRow}>
                    <View style={styles.sampleFlagInfo}>
                      <Text style={styles.sampleFlagName}>Balanced Member</Text>
                      <Text style={styles.sampleFlagCounts}>2,500 given · 1,000 received</Text>
                    </View>
                    <RatioFlag verdict={SAMPLE_GOOD_VERDICT} />
                  </View>
                  <View style={styles.sampleFlagRow}>
                    <View style={styles.sampleFlagInfo}>
                      <Text style={styles.sampleFlagName}>Needs Attention</Text>
                      <Text style={styles.sampleFlagCounts}>300 given · 1,000 received</Text>
                    </View>
                    <RatioFlag verdict={SAMPLE_WARN_VERDICT} />
                  </View>
                </View>
                <Text style={styles.cardBody}>
                  Computes individual give/receive ratios against a target ratio (default 1:1) to identify leechers.
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Search clans and inspect roster balance"
                  onPress={() => navigate('/clans')}
                  style={({ pressed }) => [styles.cardAction, pressed && styles.cardActionPressed]}
                >
                  <Text style={styles.cardActionText}>Search Clans {'\u2192'}</Text>
                </Pressable>
              </View>

              {/* Card 3: Head-to-Head Compare */}
              <View style={[base.panelRaised, styles.showcaseCard]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTag}>HEAD-TO-HEAD</Text>
                  <Text style={styles.cardHeading}>Compare Mode</Text>
                </View>
                <View style={styles.compareBlock}>
                  <View style={styles.compareRow}>
                    <Text style={styles.compareMetric}>Town Hall</Text>
                    <Text style={styles.compareValA}>TH 18</Text>
                    <Text style={styles.compareDelta}>+2</Text>
                    <Text style={styles.compareValB}>TH 16</Text>
                  </View>
                  <View style={styles.compareRow}>
                    <Text style={styles.compareMetric}>Hero Levels</Text>
                    <Text style={styles.compareValA}>480</Text>
                    <Text style={styles.compareDelta}>+90</Text>
                    <Text style={styles.compareValB}>390</Text>
                  </View>
                  <View style={styles.compareRow}>
                    <Text style={styles.compareMetric}>Rushed Deficit</Text>
                    <Text style={styles.compareValA}>4.2%</Text>
                    <Text style={styles.compareDeltaWin}>-18.1%</Text>
                    <Text style={styles.compareValB}>22.3%</Text>
                  </View>
                </View>
                <Text style={styles.cardBody}>
                  Puts two players or two clans side-by-side metric-by-metric to settle who is further along.
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Compare players or clans"
                  onPress={() => navigate('/compare')}
                  style={({ pressed }) => [styles.cardAction, pressed && styles.cardActionPressed]}
                >
                  <Text style={styles.cardActionText}>Compare Now {'\u2192'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    column: {
      flex: 1,
      paddingBottom: t.spacing[8],
    },
    header: {
      gap: t.spacing[2],
      marginBottom: t.spacing[4],
    },
    heroPanel: {
      borderTopColor: c.panelHighlight,
      gap: t.spacing[3],
    },
    sectionWrap: {
      marginTop: t.spacing[6],
      gap: t.spacing[3],
    },
    sectionHeader: {
      gap: 2,
    },
    sectionMicro: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.accentInk,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    sectionTitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xl,
      fontWeight: t.fontWeight.bold,
      color: c.textPrimary,
    },
    sectionDescription: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
    },
    linkRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[4],
      marginTop: t.spacing[5],
    },
    linkCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 220,
      gap: t.spacing[2],
      padding: t.spacing[4],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    linkCardPressed: {
      backgroundColor: c.panelRaised,
      borderColor: c.panelBorderStrong,
    },
    linkTitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.lg,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    linkBody: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      lineHeight: Math.round(t.lineHeight.normal * t.fontSize.sm),
      color: c.textSecondary,
    },
    linkArrow: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.accentInk,
      marginTop: t.spacing[1],
    },
    showcaseGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[4],
    },
    showcaseCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 280,
      padding: t.spacing[4],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
      gap: t.spacing[3],
      justifyContent: 'space-between',
    },
    cardHeader: {
      gap: 2,
    },
    cardTag: {
      fontFamily: t.fontFamily.sans,
      fontSize: 10,
      fontWeight: t.fontWeight.semibold,
      color: c.accentInk,
      letterSpacing: t.letterSpacing.micro,
      textTransform: 'uppercase',
    },
    cardHeading: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.bold,
      color: c.textPrimary,
    },
    cardBody: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      lineHeight: 18,
      color: c.textSecondary,
    },
    gaugeWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: t.spacing[1],
    },
    cardAction: {
      alignSelf: 'flex-start',
      paddingVertical: t.spacing[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    cardActionPressed: {
      opacity: 0.7,
    },
    cardActionText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.accentInk,
    },
    donationBlock: {
      gap: t.spacing[2],
      backgroundColor: c.panelRaised,
      padding: t.spacing[3],
      borderRadius: t.radius[1],
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    sampleFlagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sampleFlagInfo: {
      gap: 2,
    },
    sampleFlagName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    sampleFlagCounts: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      color: c.textMuted,
    },
    compareBlock: {
      gap: t.spacing[2],
      backgroundColor: c.panelRaised,
      padding: t.spacing[3],
      borderRadius: t.radius[1],
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    compareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    compareMetric: {
      flex: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
    },
    compareValA: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      width: 44,
      textAlign: 'center',
    },
    compareDelta: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      fontWeight: t.fontWeight.bold,
      color: c.info,
      width: 44,
      textAlign: 'center',
    },
    compareDeltaWin: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      fontWeight: t.fontWeight.bold,
      color: c.success,
      width: 44,
      textAlign: 'center',
    },
    compareValB: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      width: 44,
      textAlign: 'center',
    },
  });
}
