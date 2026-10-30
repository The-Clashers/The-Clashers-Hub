import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme, createBaseStyles } from '../theme';
import LookupSearch from '../components/LookupSearch';

// The home screen (F-01, the owner's nav revision): the landing the nav
// bar's Home link points at. It carries the big lookup box (the same
// player/clan control the nav renders, sized for the hero), one honest
// line about what the site does, and the three quick links (Clans,
// Players, Contributors) as cards. The filter row and the results list
// live on the Clans page now; this screen is the front door, not the
// search engine, so it owns no query state at all.
//
// Every state here is success-state chrome: the lookup's own hint is the
// only failure surface, and it is the component's, not the screen's.

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
    title: 'Contributors',
    body: 'The people building The Clashers Hub, straight from the repo.',
    route: '/contributors',
  },
];

export default function HomeScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

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

          <View style={[base.panelRaised, styles.heroPanel]}>
            <LookupSearch variant="hero" />
            <Text style={styles.heroCaption}>
              Clans by name or #tag. Players by tag: the game API has no player-name search.
            </Text>
          </View>

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
    },
    header: {
      gap: t.spacing[2],
      marginBottom: t.spacing[6],
    },
    heroPanel: {
      gap: t.spacing[4],
    },
    heroCaption: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
    // The quick-link cards: one row of three from tablet up, stacked
    // below it; the cards flex so the row stays even at any width.
    linkRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: t.spacing[4],
      rowGap: t.spacing[4],
      marginTop: t.spacing[6],
    },
    linkCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 220,
      gap: t.spacing[2],
      padding: t.spacing[5],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
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
      color: c.accent,
      marginTop: t.spacing[1],
    },
  });
}
