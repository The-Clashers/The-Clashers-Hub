import { StyleSheet } from 'react-native';
import { lightTheme, type ThemeTokens } from './tokens';

// The RN Web StyleSheet base. This is the wired layer the task asks for: the
// tokens stop being abstract values and become the named styles every screen
// starts from. Screens compose these with their own StyleSheet.create; they do
// not re-derive canvas color, panel chrome, or typography from raw tokens,
// because that is how the look drifts.
//
// Usage pattern:
//
//   const { theme } = useTheme();
//   const styles = useMemo(() => createBaseStyles(theme), [theme]);
//
// `createBaseStyles(theme)` returns a fresh StyleSheet bound to that theme.
// `baseStyles` is the light-theme default, kept for stories and tooling that
// render outside the provider.

// RN Web reads a numeric lineHeight as pixels, not as a ratio: `lineHeight:
// 1.2` compiles to `line-height: 1.2px`, which collapses the line box and
// stacks sibling texts on top of each other. The tokens keep the design
// ratios; this helper is the one place that turns a ratio into the pixel
// value the platform actually wants.
function lineBox(ratio: number, size: number): number {
  return Math.round(ratio * size);
}

export function createBaseStyles(t: ThemeTokens) {
  const c = t.colors;
  return StyleSheet.create({
    appRoot: {
      flex: 1,
      backgroundColor: c.canvas,
      color: c.textPrimary,
      // The system font stack lives on tokens; RN Web honors fontFamily on the
      // root View and inherits it to Text children.
      fontFamily: t.fontFamily.sans,
    },

    screen: {
      flex: 1,
      // The content column owns horizontal padding; the screen just provides
      // vertical rhythm and the canvas color bleed.
      paddingHorizontal: 0,
      paddingVertical: t.spacing[6],
      backgroundColor: c.canvas,
    },

    contentColumn: {
      width: '100%',
      maxWidth: t.layout.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.sidePaddingDesktop,
    },

    section: {
      marginBottom: t.spacing[8],
    },

    panel: {
      backgroundColor: c.panel,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: t.spacing[5],
    },

    panelRaised: {
      backgroundColor: c.panelRaised,
      borderRadius: t.radius[3],
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: t.spacing[6],
    },

    panelHeader: {
      marginBottom: t.spacing[3],
      paddingBottom: t.spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },

    // The state matrix panel (06 section 3): the quiet panel every idle,
    // empty, and error state renders on. The kit state components
    // (EmptyState, ErrorState) compose it with their own layout styles.
    statePanel: {
      alignSelf: 'stretch',
      gap: t.spacing[3],
      padding: t.spacing[6],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      backgroundColor: c.panel,
    },

    divider: {
      height: 1,
      backgroundColor: c.hairline,
      marginVertical: t.spacing[4],
    },

    display: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['3xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: lineBox(t.lineHeight.tight, t.fontSize['3xl']),
      color: c.textPrimary,
    },

    heading: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['2xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: lineBox(t.lineHeight.tight, t.fontSize['2xl']),
      color: c.textPrimary,
    },

    title: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xl,
      fontWeight: t.fontWeight.semibold,
      lineHeight: lineBox(t.lineHeight.tight, t.fontSize.xl),
      color: c.textPrimary,
    },

    subtitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.lg,
      fontWeight: t.fontWeight.regular,
      lineHeight: lineBox(t.lineHeight.normal, t.fontSize.lg),
      color: c.textSecondary,
    },

    body: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.regular,
      lineHeight: lineBox(t.lineHeight.normal, t.fontSize.body),
      color: c.textPrimary,
    },

    bodyStrong: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      lineHeight: lineBox(t.lineHeight.normal, t.fontSize.body),
      color: c.textPrimary,
    },

    caption: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      lineHeight: lineBox(t.lineHeight.normal, t.fontSize.sm),
      color: c.textSecondary,
    },

    micro: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      // uppercase + tracking is set by the consumer via textTransform and
      // letterSpacing; we keep the base font and color here so a micro label
      // still reads on either theme.
      lineHeight: lineBox(t.lineHeight.normal, t.fontSize.xs),
      color: c.textMuted,
    },

    // Tabular figures for the numbers that matter (07 §5). The metric value
    // speaks; the metric label whispers underneath.
    metric: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['2xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: lineBox(t.lineHeight.tight, t.fontSize['2xl']),
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },

    metricLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      lineHeight: lineBox(t.lineHeight.normal, t.fontSize.xs),
      color: c.textMuted,
    },

    // A surface that carries the gold focus ring (07 §6). Components wrap
    // focusable elements with this style, or read layout.focusRingWidth and
    // layout.focusRingOffset to build their own; both are valid, the value
    // comes from one place either way.
    focusSurface: {
      // RN Web maps outlineColor/outlineWidth/outlineOffset to the CSS focus
      // outline, which is the keyboard-visible focus the design language
      // requires (2px gold ring).
      outlineColor: c.focusRing,
      outlineWidth: t.layout.focusRingWidth,
      outlineOffset: t.layout.focusRingOffset,
      outlineStyle: 'solid',
    },
  });
}

export type BaseStyles = ReturnType<typeof createBaseStyles>;

export const baseStyles: BaseStyles = createBaseStyles(lightTheme);
