import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme } from '../theme';

// Breadcrumbs (07 section 3): the location line the detail screens render
// instead of a "Clan / <name>" header, since the name already speaks on
// the card itself (the owner's call). "Home > Clans > Umbra Lunaria" tells
// a visitor where they are AND where the back path goes, which is what the
// removed back-to-search button used to do, without spending a button on
// it.
//
// ARIA shape: the WAI-ARIA breadcrumb pattern. The wrapper is a
// role=navigation with an aria-label, the last crumb carries
// aria-current="page", and the separator chevrons are aria-hidden so a
// screen reader hears "Home, Clans, Umbra Lunaria" with no punctuation
// noise. Earlier crumbs are links; the current crumb is plain text.

export interface Breadcrumb {
  /** The visible text. */
  label: string;
  /** The route this crumb links to; absent on the current (last) crumb. */
  route?: string;
}

export interface BreadcrumbsProps {
  /** The trail, first to last. The last entry renders as the current page. */
  crumbs: ReadonlyArray<Breadcrumb>;
}

export default function Breadcrumbs({ crumbs }: BreadcrumbsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  return (
    <View style={styles.wrap} accessibilityRole="navigation" accessibilityLabel="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <View key={`${crumb.label}-${index}`} style={styles.crumbRow}>
            {index > 0 ? (
              <Text style={styles.separator} aria-hidden>
                {'\u203A'}
              </Text>
            ) : null}
            {isLast || crumb.route === undefined ? (
              <Text style={styles.current} numberOfLines={1} aria-current="page">
                {crumb.label}
              </Text>
            ) : (
              <Pressable
                accessibilityRole="link"
                onPress={() => navigate(crumb.route as string)}
                style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
              >
                <Text style={styles.linkText} numberOfLines={1}>
                  {crumb.label}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
      rowGap: t.spacing[1],
    },
    crumbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minWidth: 0,
    },
    separator: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    link: {
      borderRadius: t.radius[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    linkPressed: {
      opacity: 0.7,
    },
    linkText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    current: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textSecondary,
    },
  });
}
