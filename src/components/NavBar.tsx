import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocation, useNavigate } from 'react-router';
import { useTheme, breakpointFor } from '../theme';
import { ThemeToggle } from './ThemeToggle';
import LookupSearch from './LookupSearch';

// The nav bar (07 section 3, the owner's layout): a thin fixed row like a
// tracker site, carrying the lookup box (player/clan mode picker plus
// input), the page links (Home, Players, Clans, Contributors), and the
// theme toggle. Every screen renders it; it is the app's one global
// chrome, so the per-screen headers stop repeating the brand and the
// theme control.
//
// Positioning: fixed at the top of the viewport (left/right/top pinned)
// so it survives both scroll models the app uses, the clans screen's
// list-owned scrolling and the clan screen's page flow. Fixed, not
// sticky, because a sticky bar is constrained to its containing block
// (#root is exactly viewport-height, so a sticky bar would let go after
// one screenful of roster). The bar is out of flow, so the component also
// renders a spacer of the exact same height in flow; both heights come
// from the same constants and the same breakpoint read, so they cannot
// drift apart.
//
// Layout tiers, both thin (the owner's tracker-row call, recorded as a
// compact exception in 07 section 6 like the tab strip):
// - desktop (>= 1024): one 48 px row, lookup between the brand and links.
// - below 1024: two rows, 90 px total. Row 1 keeps the brand, the links
//   (horizontally scrollable when they do not fit, the standard mobile
//   nav pattern), and the dense theme toggle; row 2 gives the lookup the
//   full width, because the lookup is the primary action.
// The 44 px touch floor holds for every pressable in both tiers; only the
// bar's own height is compact, and keyboard focus plus the gold ring
// apply everywhere.

// The one-row desktop height and the two-row height below 1024. The
// spacer and the fixed bar read the same constants.
const NAV_HEIGHT_DESKTOP = 48;
const NAV_HEIGHT_STACKED = 90;

interface NavLinkSpec {
  label: string;
  route: string;
  /** Active when the pathname is the route itself or a detail under it. */
  matchPrefixes: ReadonlyArray<string>;
}

const NAV_LINKS: ReadonlyArray<NavLinkSpec> = [
  { label: 'Home', route: '/', matchPrefixes: ['/'] },
  { label: 'Players', route: '/players', matchPrefixes: ['/players', '/player/'] },
  { label: 'Clans', route: '/clans', matchPrefixes: ['/clans', '/clan/'] },
  { label: 'Contributors', route: '/contributors', matchPrefixes: ['/contributors'] },
];

function linkActive(spec: NavLinkSpec, pathname: string): boolean {
  return spec.matchPrefixes.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix),
  );
}

export default function NavBar() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const stacked = breakpointFor(width) !== 'desktop';
  const styles = useMemo(() => createStyles(theme, stacked), [theme, stacked]);
  const location = useLocation();
  const navigate = useNavigate();
  const barHeight = stacked ? NAV_HEIGHT_STACKED : NAV_HEIGHT_DESKTOP;

  return (
    <>
      <View
        style={[styles.bar, { height: barHeight }]}
        accessibilityRole="navigation"
        accessibilityLabel="Main navigation"
      >
        <View style={styles.inner}>
          <View style={styles.row}>
            <BrandMark styles={styles} onPress={() => navigate('/')} />
            {stacked ? null : (
              <View style={styles.lookupWrap}>
                <LookupSearch variant="bar" />
              </View>
            )}
            <View style={styles.linksRow}>
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.route}
                  spec={link}
                  active={linkActive(link, location.pathname)}
                  onPress={() => navigate(link.route)}
                  styles={styles}
                />
              ))}
              <ThemeToggle dense={stacked} />
            </View>
          </View>
          {stacked ? (
            <View style={styles.stackedLookupRow}>
              <LookupSearch variant="bar" />
            </View>
          ) : null}
        </View>
      </View>
      {/* The in-flow spacer that reserves the bar's height for the content
          below (the bar itself is fixed and out of flow). */}
      <View style={{ height: barHeight }} aria-hidden />
    </>
  );
}

// ---------- brand mark ----------

function BrandMark({
  styles,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="The Clashers Hub, home"
      onPress={onPress}
      style={({ pressed }) => [styles.brand, pressed && styles.brandPressed]}
    >
      <View style={styles.brandDot} />
      <Text style={styles.brandText} numberOfLines={1}>
        The Clashers Hub
      </Text>
    </Pressable>
  );
}

// ---------- nav link ----------

interface NavLinkProps {
  spec: NavLinkSpec;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

function NavLink({ spec, active, onPress, styles }: NavLinkProps) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={spec.label}
      aria-current={active ? 'page' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        active && styles.linkActive,
        pressed && styles.linkPressed,
      ]}
    >
      <Text style={[styles.linkText, active && styles.linkTextActive]} numberOfLines={1}>
        {spec.label}
      </Text>
    </Pressable>
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme'], stacked: boolean) {
  const c = t.colors;
  return StyleSheet.create({
    // The fixed bar: pinned to the viewport's top, opaque canvas so page
    // content scrolls under it cleanly, hairline bottom edge.
    // position:fixed is a react-native-web runtime value the RN types do
    // not carry (the Dropdown makes the same cast for its portaled
    // listbox). Fixed, not sticky, because a sticky bar is constrained to
    // its containing block, which is exactly viewport-height here.
    bar: {
      position: 'fixed' as unknown as 'relative',
      top: 0,
      left: 0,
      right: 0,
      zIndex: t.zIndex.sticky,
      backgroundColor: c.canvas,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    // The centered content column the screens use, kept in sync with
    // baseStyles.contentColumn: same max width, same side padding.
    inner: {
      width: '100%',
      maxWidth: t.layout.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.sidePaddingDesktop,
      flex: 1,
      justifyContent: 'center',
    },

    // The primary row: brand, then (desktop) the lookup, then links + toggle.
    row: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minHeight: t.layout.touchTargetMin,
      paddingRight: t.spacing[2],
      borderRadius: t.radius[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    brandPressed: {
      opacity: 0.7,
    },
    brandDot: {
      width: 10,
      height: 10,
      borderRadius: 9999,
      backgroundColor: c.accent,
    },
    brandText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.bold,
      color: c.textPrimary,
      flexShrink: 1,
    },

    // Desktop: the lookup flexes between the brand and the links, clamped
    // so it never squeezes the links row off a narrow window.
    lookupWrap: {
      flex: 1,
      maxWidth: 420,
      minWidth: 180,
      marginHorizontal: t.spacing[4],
    },

    // The links row. Stacked: it shares row 1 with the brand and the
    // toggle and scrolls horizontally when the four labels do not fit,
    // the standard mobile pattern, so no link is ever unreachable.
    linksRow: {
      flex: stacked ? 1 : 0,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[1],
      minWidth: 0,
      ...(stacked ? { overflow: 'scroll' } : {}),
    },
    link: {
      paddingHorizontal: stacked ? t.spacing[2] : t.spacing[3],
      minHeight: t.layout.touchTargetMin,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
      ...(stacked ? { flexShrink: 0 } : {}),
    },
    linkActive: {
      backgroundColor: c.panel,
    },
    linkPressed: {
      opacity: 0.7,
    },
    linkText: {
      fontFamily: t.fontFamily.sans,
      fontSize: stacked ? t.fontSize.xs : t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
    },
    linkTextActive: {
      color: c.textPrimary,
      fontWeight: t.fontWeight.semibold,
    },

    // Stacked row 2: the lookup gets the full width, the primary action.
    stackedLookupRow: {
      flex: 1,
      justifyContent: 'center',
    },
  });
}
