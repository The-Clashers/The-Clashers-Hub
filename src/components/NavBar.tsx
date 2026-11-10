import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocation, useNavigate } from 'react-router';
import { useTheme, breakpointFor, glassSurfaceFilter } from '../theme';
import { ThemeToggle } from './ThemeToggle';
import Glyph from './Glyph';
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
  /** The leading glyph the link carries (the home mark); most links stay
   * text-only. */
  icon?: 'home';
}

const NAV_LINKS: ReadonlyArray<NavLinkSpec> = [
  { label: 'Home', route: '/', matchPrefixes: ['/'], icon: 'home' },
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
            <BrandMark styles={styles} onPress={() => navigate('/')} showMicro={!stacked} />
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

// The brand shield's box (the prototype's 30 px brand mark) and the mark's
// own drawing constants.
const BRAND_SHIELD_SIZE = 30;

function BrandMark({
  styles,
  onPress,
  showMicro,
}: {
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  /** Whether the tagline renders under the name: the desktop row has the
   * height for the two-line lockup, the stacked rows are at their
   * tightest and keep the name alone (the prototype hides the micro line
   * on small screens the same way). */
  showMicro: boolean;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="The Clashers Hub, home"
      onPress={onPress}
      style={({ pressed }) => [styles.brand, pressed && styles.brandPressed]}
    >
      <BrandShield color={theme.colors} />
      <View style={styles.brandTextBlock}>
        <Text style={styles.brandText} numberOfLines={1}>
          The Clashers Hub
        </Text>
        {showMicro ? (
          <Text style={styles.brandMicro} numberOfLines={1}>
            clan and player analytics, live and login-free
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** The brand shield (the owner's prototype logo, verbatim paths): the
 * gold-rimmed shield with the filled inner field and the on-accent star,
 * drawn on react-native-svg the way the Gauge and the glow fields are.
 * Color comes from the theme tokens, never a hard-coded hex, so the mark
 * follows the accent through both themes. */
function BrandShield({ color }: { color: ReturnType<typeof useTheme>['theme']['colors'] }) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={BRAND_SHIELD_SIZE}
      height={BRAND_SHIELD_SIZE}
      style={brandShieldStyle}
      aria-hidden
    >
      <Path
        d="M12 1.5l8.5 3.2v6.4c0 5.3-3.6 9.7-8.5 11.6-4.9-1.9-8.5-6.3-8.5-11.6V4.7z"
        fill="none"
        stroke={color.accent}
        strokeWidth={1.6}
      />
      <Path
        d="M12 5.2l5.2 2v4.2c0 3.3-2.2 6-5.2 7.2-3-1.2-5.2-3.9-5.2-7.2V7.2z"
        fill={color.accent}
      />
      <Path
        d="M12 8.1l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z"
        fill={color.textOnAccent}
      />
    </Svg>
  );
}

// The shield never flexes or shrinks beside the brand text (the same
// flex-none rule the button glyphs keep).
const brandShieldStyle = { flexShrink: 0 } as const;

// ---------- nav link ----------

interface NavLinkProps {
  spec: NavLinkSpec;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

function NavLink({ spec, active, onPress, styles }: NavLinkProps) {
  const { theme } = useTheme();

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
      <View style={styles.linkContent}>
        {spec.icon ? (
          <Glyph
            name={spec.icon}
            size={14}
            color={active ? theme.colors.textPrimary : theme.colors.textMuted}
          />
        ) : null}
        <Text style={[styles.linkText, active && styles.linkTextActive]} numberOfLines={1}>
          {spec.label}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme'], stacked: boolean) {
  const c = t.colors;
  return StyleSheet.create({
    // The fixed bar: pinned to the viewport's top, glass over the scrolling
    // page (the canvas veil plus the shared backdrop blur, 07 section 2
    // "Glass"), lifted on the shadow scale so content visibly passes under
    // it, hairline bottom edge. position:fixed is a react-native-web runtime
    // value the RN types do not carry (the Dropdown makes the same cast for
    // its portaled listbox). Fixed, not sticky, because a sticky bar is
    // constrained to its containing block, which is exactly viewport-height
    // here.
    bar: {
      position: 'fixed' as unknown as 'relative',
      top: 0,
      left: 0,
      right: 0,
      zIndex: t.zIndex.sticky,
      ...glassSurfaceFilter(t),
      backgroundColor: c.canvasVeil,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
      shadowColor: c.shadowColor,
      ...t.shadows.resting,
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
    // The brand's two-line lockup: the name over the tagline, the shield
    // beside them (the prototype's brand block).
    brandTextBlock: {
      minWidth: 0,
      flexShrink: 1,
    },
    brandText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.bold,
      color: c.textPrimary,
      flexShrink: 1,
    },
    // The tagline (the prototype's brand-micro): the caption voice, one
    // step quieter than the name.
    brandMicro: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
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
    // The link's inner row: the glyph (when the link carries one) beside
    // the label, centered.
    linkContent: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[1],
      minWidth: 0,
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
