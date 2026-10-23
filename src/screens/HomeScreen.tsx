import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme, createBaseStyles } from '../theme';
import { ThemeToggle } from '../components/ThemeToggle';

// The home screen now reads every visual value from the theme tokens, so it
// is also the first non-review consumer of the wired base styles. The screen
// itself stays a placeholder for the search flow (that lands in M1); the only
// surfaces added here are links to /tokens (the T-M0-2 review surface) and
// /hello (the T-M0-5 smoke surface) so a reviewer can find them from the
// entry route.
//
// Each link is a Pressable + useNavigate instead of react-router's <Link> so
// the styling stays inside the RN paradigm (the design language allows the
// router's link handling as the one DOM exception, but here we do not need
// it; a Pressable with accessibilityRole="link" maps to ARIA on web and keeps
// the chrome consistent). The real shareable-URL routes (clan, player,
// compare) still land with their screens in M1+.
export default function HomeScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={base.contentColumn}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={base.micro}>The Clashers Hub</Text>
              <Text style={base.display}>Search a clan or paste a tag</Text>
              <Text style={base.subtitle}>
                Live data, no login. The search flow lands in M1.
              </Text>
            </View>
            <ThemeToggle />
          </View>

          <View style={[base.panelRaised, styles.linkPanel]}>
            <Text style={base.caption}>
              M0 review surfaces. The token canvas and the live-data smoke
              screen both stay reachable from here until the real screens
              land in their milestones.
            </Text>
            <View style={styles.linkRow}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open the live-data smoke screen"
                accessibilityHint="Opens /hello, a hardcoded clan tag rendered from live data through the tier."
                onPress={() => navigate('/hello')}
                style={({ pressed }) => [
                  styles.link,
                  pressed && styles.linkPressed,
                ]}
              >
                <Text style={styles.linkText}>Hello, clan</Text>
                <Text style={styles.linkArrow} aria-hidden>
                  {' ->'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open the design token review screen"
                accessibilityHint="Opens /tokens, the design token review surface."
                onPress={() => navigate('/tokens')}
                style={[styles.link, styles.linkSecondary]}
              >
                <Text style={[styles.linkText, styles.linkTextSecondary]}>Review the tokens</Text>
                <Text style={[styles.linkArrow, styles.linkTextSecondary]} aria-hidden>
                  {' ->'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: t.spacing[4],
      marginBottom: t.spacing[7],
    },
    headerText: {
      flex: 1,
      gap: t.spacing[2],
    },
    linkPanel: {
      gap: t.spacing[3],
    },
    linkRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[3],
    },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      alignSelf: 'flex-start',
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[5],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius.pill,
      backgroundColor: c.accent,
      // Gold focus ring (07 §6).
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    linkPressed: {
      backgroundColor: c.accentPressed,
    },
    linkSecondary: {
      backgroundColor: c.panelRaised,
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
    },
    linkText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      color: c.textOnAccent,
    },
    linkTextSecondary: {
      color: c.textPrimary,
    },
    linkArrow: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.bold,
      color: c.textOnAccent,
    },
  });
}
