import { StyleSheet, type ViewStyle } from 'react-native';
import { lightTheme, type ThemeTokens } from './tokens';

// The RN Web StyleSheet base. This is the wired layer the task asks for: the
// tokens stop being abstract values and become the named styles every screen
// starts from. Screens compose these with their own StyleSheet.create; they do
// not re-derive canvas color, panel chrome, or typography from raw tokens.

function lineBox(ratio: number, size: number): number {
  return Math.round(ratio * size);
}

/**
 * The backdrop blur every glass surface shares (07 section 2 "Glass"): one
 * filter string built from the glass scale, returned as a style object.
 */
export function glassSurfaceFilter(t: ThemeTokens): ViewStyle {
  const filter = `blur(${t.glass.blur}px) saturate(${t.glass.saturate})`;
  return {
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
  } as unknown as ViewStyle;
}

/**
 * The light top highlight edge of modern glass surfaces.
 */
export { glassEdge } from './tokens';

export function createBaseStyles(t: ThemeTokens) {
  const c = t.colors;
  return StyleSheet.create({
    appRoot: {
      flex: 1,
      flexGrow: 1,
      flexShrink: 0,
      backgroundColor: c.canvas,
      color: c.textPrimary,
      fontFamily: t.fontFamily.sans,
    },

    screen: {
      flex: 1,
      paddingHorizontal: 0,
      paddingVertical: t.spacing[4],
      backgroundColor: c.canvas,
    },

    contentColumn: {
      width: '100%',
      maxWidth: t.layout.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.sidePaddingDesktop,
    },

    section: {
      marginBottom: t.spacing[6],
    },

    // The glass panel: translucent surface, shared backdrop blur, light top
    // highlight edge, and resting elevation.
    panel: {
      ...glassSurfaceFilter(t),
      backgroundColor: c.panel,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      padding: t.spacing[3],
      shadowColor: c.shadowColor,
      ...t.shadows.resting,
    },

    // The raised glass panel: detail cards and hero surfaces.
    panelRaised: {
      ...glassSurfaceFilter(t),
      backgroundColor: c.panelRaised,
      borderRadius: t.radius[3],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      padding: t.spacing[4],
      shadowColor: c.shadowColor,
      ...t.shadows.lifted,
    },

    panelHeader: {
      marginBottom: t.spacing[3],
      paddingBottom: t.spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },

    // The state matrix panel for idle, empty, and error states.
    statePanel: {
      ...glassSurfaceFilter(t),
      alignSelf: 'stretch',
      gap: t.spacing[3],
      padding: t.spacing[4],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
      shadowColor: c.shadowColor,
      ...t.shadows.resting,
    },

    divider: {
      height: 1,
      backgroundColor: c.hairline,
      marginVertical: t.spacing[3],
    },

    display: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['3xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: lineBox(t.lineHeight.tight, t.fontSize['3xl']),
      letterSpacing: t.letterSpacing.tight,
      color: c.textPrimary,
    },

    heading: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['2xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: lineBox(t.lineHeight.tight, t.fontSize['2xl']),
      letterSpacing: t.letterSpacing.tight,
      color: c.textPrimary,
    },

    title: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xl,
      fontWeight: t.fontWeight.semibold,
      lineHeight: lineBox(t.lineHeight.tight, t.fontSize.xl),
      letterSpacing: t.letterSpacing.tight,
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
      letterSpacing: t.letterSpacing.micro,
      lineHeight: lineBox(t.lineHeight.normal, t.fontSize.xs),
      color: c.textMuted,
    },

    metric: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize['2xl'],
      fontWeight: t.fontWeight.bold,
      lineHeight: lineBox(t.lineHeight.tight, t.fontSize['2xl']),
      letterSpacing: t.letterSpacing.tight,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },

    metricLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      letterSpacing: t.letterSpacing.micro,
      lineHeight: lineBox(t.lineHeight.normal, t.fontSize.xs),
      color: c.textMuted,
    },

    focusSurface: {
      outlineColor: c.focusRing,
      outlineWidth: t.layout.focusRingWidth,
      outlineOffset: t.layout.focusRingOffset,
      outlineStyle: 'solid',
    },
  });
}

export type BaseStyles = ReturnType<typeof createBaseStyles>;

export const baseStyles: BaseStyles = createBaseStyles(lightTheme);
