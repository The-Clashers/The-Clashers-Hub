import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme, createBaseStyles } from '../theme';
import TagInput from '../components/TagInput';
import RecentSearchesStrip from '../components/RecentSearchesStrip';
import UnitIcon from '../components/UnitIcon';
import LevelRail from '../components/LevelRail';
import { getTownHallCapSummary } from '../lib/reference-stats';
import { playerRouteFor } from '../lib/tag';
import type { RecentSearchItem } from '../lib/recent-searches';

const TH_LADDER: readonly number[] = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const RUSHED_BANDS = [
  { name: 'Core', range: '0–5%', desc: 'Offense and heroes keeping pace with Town Hall.' },
  { name: 'Light', range: '5–15%', desc: 'Minor lab or hero backlog, quick to recover.' },
  { name: 'Rushed', range: '15–30%', desc: 'Noticeable deficit in heroes or key war troops.' },
  { name: 'Heavy', range: '30%+', desc: 'Town Hall far outpaces laboratory and hero development.' },
] as const;

export default function PlayersScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  const [selectedTh, setSelectedTh] = useState<number>(18);
  const capSummary = useMemo(() => getTownHallCapSummary(selectedTh), [selectedTh]);

  const handleRecentSelect = (item: RecentSearchItem) => {
    navigate(playerRouteFor(item.query));
  };

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.header}>
            <Text style={base.display}>Players</Text>
            <Text style={base.subtitle}>
              Look a player up by tag. The game API has no player-name search, so the tag is the
              way in.
            </Text>
          </View>

          {/* Lookup Panel */}
          <View style={[base.panelRaised, styles.lookupPanel]}>
            <TagInput label="Player tag" />
            <RecentSearchesStrip
              kind="player"
              title="Recent Player Lookups"
              onSelect={handleRecentSelect}
            />
          </View>

          {/* Interactive Town Hall Cap Explorer */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionMicro}>Reference Explorer</Text>
              <Text style={styles.sectionTitle}>Town Hall Cap Reference</Text>
              <Text style={styles.sectionDesc}>
                Select a Town Hall level to view maximum hero levels and category upgrade totals.
              </Text>
            </View>

            {/* TH Pills */}
            <View style={styles.thPillsRow} accessibilityRole="tablist">
              {TH_LADDER.map((th) => {
                const isSelected = th === selectedTh;
                return (
                  <Pressable
                    key={th}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Town Hall ${th}`}
                    onPress={() => setSelectedTh(th)}
                    style={({ pressed }) => [
                      styles.thPill,
                      isSelected && styles.thPillSelected,
                      pressed && !isSelected && styles.thPillPressed,
                    ]}
                  >
                    <Text style={isSelected ? styles.thPillTextSelected : styles.thPillText}>
                      TH {th}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Selected TH Summary Bar */}
            <View style={[base.panelRaised, styles.thSummaryBar]}>
              <View style={styles.thSummaryItem}>
                <Text style={styles.thSummaryNum}>
                  {capSummary.totalHeroLevels}
                  <Text style={styles.thSummaryMax}> / 480</Text>
                </Text>
                <Text style={styles.thSummaryLabel}>Max Hero Levels</Text>
              </View>

              <View style={styles.thSummaryItem}>
                <Text style={styles.thSummaryNum}>{capSummary.totalLabLevels} lvls</Text>
                <Text style={styles.thSummaryLabel}>
                  Lab Research ({capSummary.unlockedTroopsCount} troops, {capSummary.unlockedSpellsCount} spells,{' '}
                  {capSummary.unlockedSiegesCount} sieges)
                </Text>
              </View>

              <View style={styles.thSummaryItem}>
                <Text style={styles.thSummaryNum}>{capSummary.totalEquipmentLevels} lvls</Text>
                <Text style={styles.thSummaryLabel}>
                  Blacksmith Gear ({capSummary.unlockedEquipmentCount} pieces)
                </Text>
              </View>

              <View style={styles.thSummaryItem}>
                <Text style={styles.thSummaryNum}>{capSummary.totalPetLevels} lvls</Text>
                <Text style={styles.thSummaryLabel}>
                  Pet House ({capSummary.unlockedPetsCount} pets)
                </Text>
              </View>
            </View>

            {/* Hero Cap Grid */}
            <View style={styles.heroGrid}>
              {capSummary.heroes.map((hero) => {
                const fraction = hero.maxPossible > 0 ? hero.cap / hero.maxPossible : 0;
                return (
                  <View key={hero.name} style={[base.panelRaised, styles.heroCard]}>
                    <View style={styles.heroIconWrap}>
                      <UnitIcon kind="hero" name={hero.name} />
                    </View>
                    <View style={styles.heroDetails}>
                      <View style={styles.heroTitleRow}>
                        <Text style={styles.heroName}>{hero.name}</Text>
                        <Text style={hero.unlocked ? styles.heroCapValue : styles.heroLockedText}>
                          {hero.unlocked ? `Lvl ${hero.cap} / ${hero.maxPossible}` : 'Locked at TH ' + selectedTh}
                        </Text>
                      </View>
                      {hero.unlocked ? (
                        <View style={styles.heroRailWrap}>
                          <LevelRail fill={fraction} />
                        </View>
                      ) : (
                        <Text style={styles.heroLockedDesc}>Hero unlocks at a higher Town Hall.</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Rushed Scale and Tag Guide */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionMicro}>Audit Guide</Text>
              <Text style={styles.sectionTitle}>Rushed Analysis Scale & Tag Lookup</Text>
            </View>

            <View style={styles.guideGrid}>
              {/* Rushed Bands Card */}
              <View style={[base.panelRaised, styles.guideCard]}>
                <Text style={styles.guideCardTitle}>Interpretation Bands</Text>
                <Text style={styles.guideCardSub}>
                  The rushed percentage measures total deficit levels against Town Hall maximums:
                </Text>

                <View style={styles.bandsList}>
                  {RUSHED_BANDS.map((band, idx) => {
                    const badgeColor =
                      idx === 0
                        ? theme.colors.success
                        : idx === 1
                          ? theme.colors.info
                          : idx === 2
                            ? theme.colors.warning
                            : theme.colors.danger;
                    return (
                      <View key={band.name} style={styles.bandRow}>
                        <View style={[styles.bandBadge, { borderColor: badgeColor }]}>
                          <Text style={[styles.bandBadgeText, { color: badgeColor }]}>
                            {band.range}
                          </Text>
                        </View>
                        <View style={styles.bandInfo}>
                          <Text style={styles.bandName}>{band.name}</Text>
                          <Text style={styles.bandDesc}>{band.desc}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Tag Instructions & Normalization Card */}
              <View style={[base.panelRaised, styles.guideCard]}>
                <Text style={styles.guideCardTitle}>How to Find Your Player Tag</Text>
                <View style={styles.stepsList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumCircle}>
                      <Text style={styles.stepNumText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>
                      Open Clash of Clans and tap your XP level badge in the top-left corner.
                    </Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumCircle}>
                      <Text style={styles.stepNumText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>
                      Tap the copy icon right under your player name on the My Profile tab.
                    </Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNumCircle}>
                      <Text style={styles.stepNumText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>
                      Paste into the search box above (# prefix is optional) and tap Search.
                    </Text>
                  </View>
                </View>

                <View style={styles.noteBox}>
                  <Text style={styles.noteTitle}>Super Troop Normalization</Text>
                  <Text style={styles.noteText}>
                    Active Super Troops are automatically normalized back to their base troop lab levels so
                    temporary boosts never inflate your deficit score.
                  </Text>
                </View>
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
    lookupPanel: {
      gap: t.spacing[3],
      borderTopColor: c.panelHighlight,
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
    sectionDesc: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textSecondary,
    },
    thPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[2],
    },
    thPill: {
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
      borderRadius: t.radius.pill,
      backgroundColor: c.panelRaised,
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    thPillSelected: {
      backgroundColor: c.accentSoft,
      borderColor: c.accent,
    },
    thPillPressed: {
      backgroundColor: c.fillQuiet,
    },
    thPillText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
    },
    thPillTextSelected: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.bold,
      color: c.accentInk,
    },
    thSummaryBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[4],
      padding: t.spacing[4],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
    },
    thSummaryItem: {
      flexGrow: 1,
      flexBasis: 160,
      gap: 2,
    },
    thSummaryNum: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.bold,
      color: c.accentInk,
    },
    thSummaryMax: {
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
    },
    thSummaryLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textSecondary,
      lineHeight: 16,
    },
    heroGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[3],
    },
    heroCard: {
      flexGrow: 1,
      flexBasis: 280,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
      padding: t.spacing[3],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
    },
    heroIconWrap: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroDetails: {
      flex: 1,
      gap: 4,
    },
    heroTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    heroCapValue: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.accentInk,
    },
    heroLockedText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    heroLockedDesc: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      color: c.textMuted,
    },
    heroRailWrap: {
      marginTop: 2,
    },
    guideGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[4],
    },
    guideCard: {
      flexGrow: 1,
      flexBasis: 300,
      padding: t.spacing[4],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
      gap: t.spacing[3],
    },
    guideCardTitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.bold,
      color: c.textPrimary,
    },
    guideCardSub: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textSecondary,
      lineHeight: 16,
    },
    bandsList: {
      gap: t.spacing[2],
    },
    bandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
    },
    bandBadge: {
      width: 64,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
      borderRadius: t.radius[1],
      borderWidth: 1,
      backgroundColor: c.panelRaised,
    },
    bandBadgeText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      fontWeight: t.fontWeight.bold,
    },
    bandInfo: {
      flex: 1,
      gap: 1,
    },
    bandName: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    bandDesc: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      color: c.textMuted,
      lineHeight: 15,
    },
    stepsList: {
      gap: t.spacing[2],
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: t.spacing[3],
    },
    stepNumCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    stepNumText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      fontWeight: t.fontWeight.bold,
      color: c.accentInk,
    },
    stepText: {
      flex: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textSecondary,
      lineHeight: 18,
    },
    noteBox: {
      marginTop: t.spacing[1],
      padding: t.spacing[3],
      borderRadius: t.radius[1],
      backgroundColor: c.panelRaised,
      borderWidth: 1,
      borderColor: c.panelBorder,
      gap: 2,
    },
    noteTitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.accentInk,
    },
    noteText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      color: c.textSecondary,
      lineHeight: 16,
    },
  });
}
