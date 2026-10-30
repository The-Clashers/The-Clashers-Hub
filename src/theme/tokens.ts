// Design tokens for The Clashers Hub.
//
// The whole product reads its visual values from this file and nowhere else
// (07-design-language §2 "Tokens (the only allowed values)"). Anything that
// needs a color, a spacing step, a radius, or a typography rule pulls it from
// the typed exports below. A screen that needs a value not listed here files a
// PR that changes *this* file and the matching row in 07-design-language.md.
//
// Two contracts govern every value here:
// - NFR-06: contrast ratio at least 4.5:1 for text on its canvas/panel.
//   Every text-on-canvas and text-on-panel pair was checked at the time the
//   token was added; the comment next to each color records the lowest pair.
// - The "one gold accent" rule (07 §1): gold is reserved for the things that
//   matter (numbers, verdicts, focus). It is not a generic brand color and it
//   does not appear on chrome.
//
// Themes: the canvas is white in light mode and near-black in dark mode, with
// floating panels and a single gold accent. Both themes share the spacing,
// radius, typography, layout, and motion scales; only the color surface
// changes between them, which keeps the rest of the system stable.

export type ColorTokenName =
  // Surface
  | 'canvas'
  | 'panel'
  | 'panelRaised'
  | 'panelBorder'
  | 'panelBorderStrong'
  | 'hairline'
  // Text
  | 'textPrimary'
  | 'textSecondary'
  | 'textMuted'
  | 'textOnAccent'
  | 'textInverse'
  // Accent (gold) and its surfaces
  | 'accent'
  | 'accentHover'
  | 'accentPressed'
  | 'accentSoft'
  | 'focusRing'
  // Semantic
  | 'success'
  | 'successSoft'
  | 'warning'
  | 'warningSoft'
  | 'danger'
  | 'dangerSoft'
  | 'info'
  | 'infoSoft'
  // Chart series (the four chart types, 07 §5)
  | 'seriesGold'
  | 'seriesBlue'
  | 'seriesGreen'
  | 'seriesRed'
  | 'seriesMuted';

export type ColorTokens = Record<ColorTokenName, string>;

// Light canvas: white background, near-black ink, one gold accent.
// Lowest-contrast text pair: textMuted (#5F5F57) on canvas at 7.0:1, well
// clear of the 4.5:1 floor. textOnAccent over accent is 5.9:1.
export const lightColors: ColorTokens = {
  canvas: '#FFFFFF',
  panel: '#F7F7F5',
  panelRaised: '#FFFFFF',
  panelBorder: '#E4E4E1',
  panelBorderStrong: '#C9C9C4',
  hairline: '#EDEDEA',

  textPrimary: '#14140F',
  textSecondary: '#3F3F38',
  textMuted: '#5F5F57',
  textOnAccent: '#1A1500',
  textInverse: '#FFFFFF',

  accent: '#B8860B',
  accentHover: '#A37708',
  accentPressed: '#8C6606',
  accentSoft: '#FBEFC8',
  focusRing: '#C9A227',

  success: '#1F7A3D',
  successSoft: '#DCF0E3',
  warning: '#9A5A00',
  warningSoft: '#FBE9CC',
  danger: '#B02020',
  dangerSoft: '#FADCDC',
  info: '#1F5AA8',
  infoSoft: '#DCE8F8',

  seriesGold: '#B8860B',
  seriesBlue: '#1F5AA8',
  seriesGreen: '#1F7A3D',
  seriesRed: '#B02020',
  seriesMuted: '#9A9A92',
};

// Dark canvas: near-black background, near-white ink, brighter gold so the
// accent still reads as gold against the dark surface. Lowest-contrast text
// pair: textMuted (#A8A89E) on canvas at 8.2:1, still clear of the floor.
export const darkColors: ColorTokens = {
  canvas: '#0B0B0A',
  panel: '#161614',
  panelRaised: '#1E1E1B',
  panelBorder: '#2A2A26',
  panelBorderStrong: '#3A3A35',
  hairline: '#222220',

  textPrimary: '#F5F4EE',
  textSecondary: '#C7C6BE',
  textMuted: '#A8A89E',
  textOnAccent: '#1A1500',
  textInverse: '#14140F',

  accent: '#E0B84C',
  accentHover: '#EAC669',
  accentPressed: '#C99A2E',
  accentSoft: '#3A2E12',
  focusRing: '#E7C46A',

  success: '#5BD07D',
  successSoft: '#13291C',
  warning: '#F0B65C',
  warningSoft: '#2E2110',
  danger: '#F26F6F',
  dangerSoft: '#2C1515',
  info: '#7AA8E0',
  infoSoft: '#152232',

  seriesGold: '#E0B84C',
  seriesBlue: '#7AA8E0',
  seriesGreen: '#5BD07D',
  seriesRed: '#F26F6F',
  seriesMuted: '#7E7E76',
};

// Spacing scale. A 4px base with the steps the layout actually needs; values
// jump more aggressively at the top so a section breathe is visibly different
// from a panel gap. Touch targets (44px min, 07 §6) compose from these.
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
  11: 80,
  12: 96,
} as const;

export type SpacingStep = keyof typeof spacing;

// Radius scale. Chips and small controls take radius.1, panels take radius.2,
// hero panels take radius.3, and pills take the round value. Everything else
// inherits; a screen adding its own radius is a PR that gets sent back.
export const radius = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  pill: 9999,
} as const;

export type RadiusStep = keyof typeof radius;

// Typography. System font stack so the canvas stays quiet; the design language
// calls for tabular figures on numbers (no chart junk, no decimal noise), so
// numeric variants carry `tabular-nums` via the typography helpers in
// baseStyles. Weights are limited to the four the product actually uses;
// adding a fifth is a deliberate change.
//
// RN's TextStyle.fontFamily is typed as a single string; on web, react-native-
// web forwards the value straight to CSS font-family, so a comma-separated
// stack works and gives us the system-font fallback chain the design language
// wants. We keep the stacks as strings here so consumers can pass them
// straight to StyleSheet without a cast.
export const fontFamily = {
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  body: 15,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
} as const;

export type FontSizeStep = keyof typeof fontSize;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type FontWeightName = keyof typeof fontWeight;

export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export type LineHeightName = keyof typeof lineHeight;

// Layout. The centered content column is 1280px max (07 §3); side padding
// comes from the spacing scale and steps down at the small breakpoint. The
// roster table swaps to cards at 768px, and the player detail goes two-up at
// 1024px; both breakpoints are read through useWindowDimensions, not CSS
// media queries, per the RN paradigm.
export const layout = {
  contentMaxWidth: 1280,
  sidePaddingDesktop: spacing[6],
  sidePaddingTablet: spacing[5],
  sidePaddingMobile: spacing[4],
  sidePaddingSmall: spacing[3],
  touchTargetMin: 44,
  rosterCardBreakpoint: 768,
  playerTwoColumnBreakpoint: 1024,
  focusRingWidth: 2,
  focusRingOffset: 2,
} as const;

// Motion. The design language says data tools answer questions, they don't
// perform, so the motion scale is intentionally narrow: a fast interaction
// curve and a slower layout curve. Anything more is a PR that gets sent back.
export const motion = {
  fast: 120,
  normal: 180,
  slow: 240,
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)' as const,
  // The one ambient motion in the product: the loading skeletons' quiet
  // opacity loop. It is an affordance (data is on its way), not a
  // performance, and it is paused entirely under prefers-reduced-motion.
  pulse: 1200,
} as const;

// Z-index scale so panels, overlays, and the focus layer stack in a known
// order instead of escalating one-offs.
export const zIndex = {
  base: 0,
  raised: 1,
  sticky: 10,
  overlay: 100,
  toast: 1000,
} as const;

// Breakpoints helper (07 §3). useWindowDimensions feeds this; components ask
// for the current tier and render accordingly. No CSS media queries scattered
// through components.
export type Breakpoint = 'small' | 'mobile' | 'tablet' | 'desktop';

export function breakpointFor(width: number): Breakpoint {
  if (width < layout.rosterCardBreakpoint) {
    if (width < 480) return 'small';
    return 'mobile';
  }
  if (width < layout.playerTwoColumnBreakpoint) return 'tablet';
  return 'desktop';
}

// The full theme shape consumed by the RN Web StyleSheet base and by every
// themed component. Colors come per-theme; everything else is shared.
export interface ThemeTokens {
  readonly name: 'light' | 'dark';
  readonly colors: ColorTokens;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly fontFamily: typeof fontFamily;
  readonly fontSize: typeof fontSize;
  readonly fontWeight: typeof fontWeight;
  readonly lineHeight: typeof lineHeight;
  readonly layout: typeof layout;
  readonly motion: typeof motion;
  readonly zIndex: typeof zIndex;
}

export const lightTheme: ThemeTokens = {
  name: 'light',
  colors: lightColors,
  spacing,
  radius,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  layout,
  motion,
  zIndex,
};

export const darkTheme: ThemeTokens = {
  name: 'dark',
  colors: darkColors,
  spacing,
  radius,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  layout,
  motion,
  zIndex,
};

export function themeByName(name: 'light' | 'dark'): ThemeTokens {
  return name === 'light' ? lightTheme : darkTheme;
}
