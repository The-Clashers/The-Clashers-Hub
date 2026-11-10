import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import StatChip from './StatChip';
import { warFrequencyLabel } from '../lib/war-frequency';
import { linkEnterActivation } from '../lib/link-activation';
import type { SearchClanItem } from '../api/search';

// The search result row (07 section 4): badge, name + tag, and the four
// stat chips. It was promoted out of the search screen file (STD-15)
// because the design language names it as shared kit and the compare and
// clan surfaces will want the same row shape.

// The API badge icon renders into a fixed slot (07 section 7) so a slow CDN
// load never reflows the card; a missing badge gets a quiet block instead.
const BADGE_SLOT = 40;

export interface ClanCardProps {
  clan: SearchClanItem;
  onPress: () => void;
}

export default function ClanCard({ clan, onPress }: ClanCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const badgeUri = clan.badgeUrls?.medium || clan.badgeUrls?.small;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${clan.name}, level ${clan.clanLevel}, ${clan.members} members`}
      accessibilityHint="Opens the clan detail screen."
      onPress={onPress}
      // Enter activation for the keyboard golden path: the responder never
      // calls onPress for role=link elements (lib/link-activation.ts).
      onKeyDown={linkEnterActivation(onPress)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {badgeUri ? (
        <Image
          source={{ uri: badgeUri }}
          style={styles.badge}
          accessibilityLabel={`${clan.name} clan badge`}
        />
      ) : (
        <View style={[styles.badge, styles.badgeEmpty]} accessibilityLabel={`${clan.name} clan badge`} />
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {clan.name}
          </Text>
          {clan.isFamilyFriendly ? (
            // The parental-control flag renders as a tag on the title row,
            // not a stat chip: it is a property of the clan, not a number it
            // earned. Only true renders — most clans are false and the row
            // should not carry a permanent "no".
            <Text style={styles.familyTag}>Family friendly</Text>
          ) : null}
          <Text style={styles.tag} numberOfLines={1}>
            {clan.tag}
          </Text>
        </View>
        <View style={styles.statRow}>
          <StatChip label="Level" value={String(clan.clanLevel)} />
          <StatChip label="Members" value={String(clan.members)} />
          <StatChip label="Location" value={clan.locationName ?? 'No location'} />
          <StatChip label="War" value={warFrequencyLabel(clan.warFrequency)} />
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3],
      padding: t.spacing[3],
      marginBottom: t.spacing[2],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panelRaised,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    cardPressed: {
      backgroundColor: c.panel,
      borderColor: c.panelBorderStrong,
    },
    badge: {
      width: BADGE_SLOT,
      height: BADGE_SLOT,
      borderRadius: t.radius[2],
      backgroundColor: c.panel,
    },
    badgeEmpty: {
      backgroundColor: c.hairline,
    },
    body: {
      flex: 1,
      gap: t.spacing[2],
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3],
    },
    name: {
      flexShrink: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    tag: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    familyTag: {
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      flexShrink: 0,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[5],
      rowGap: t.spacing[2],
    },
  });
}
