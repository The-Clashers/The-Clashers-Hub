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

    divider: {
      height: 1,
      backgroundColor: c.hairline,
      marginVertical: t.spacing[4],
    },

    display: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['3xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: t.lineHeight.tight,
      color: c.textPrimary,
    },

    heading: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['2xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: t.lineHeight.tight,
      color: c.textPrimary,
    },

    title: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xl,
      fontWeight: t.fontWeight.semibold,
      lineHeight: t.lineHeight.tight,
      color: c.textPrimary,
    },

    subtitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.lg,
      fontWeight: t.fontWeight.regular,
      lineHeight: t.lineHeight.normal,
      color: c.textSecondary,
    },

    body: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.regular,
      lineHeight: t.lineHeight.normal,
      color: c.textPrimary,
    },

    bodyStrong: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      lineHeight: t.lineHeight.normal,
      color: c.textPrimary,
    },

    caption: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      lineHeight: t.lineHeight.normal,
      color: c.textSecondary,
    },

    micro: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      // uppercase + tracking is set by the consumer via textTransform and
      // letterSpacing; we keep the base font and color here so a micro label
      // still reads on either theme.
      lineHeight: t.lineHeight.normal,
      color: c.textMuted,
    },

    // Tabular figures for the numbers that matter (07 §5). The metric value
    // speaks; the metric label whispers underneath.
    metric: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['2xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: t.lineHeight.tight,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },

    metricLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      lineHeight: t.lineHeight.normal,
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
