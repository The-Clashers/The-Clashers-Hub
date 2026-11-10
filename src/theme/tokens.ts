// Design tokens for The Clashers Hub.
//
// The whole product reads its visual values from this file and nowhere else
// (07-design-language §2 "Tokens (the only allowed values)"). Anything that
// needs a color, a spacing step, a radius, or a typography rule pulls it from
// the typed exports below. A screen that needs a value not listed here files a
// PR that changes *this* file and the matching row in 07-design-language.md.
//
// Three contracts govern every value here:
// - NFR-06: contrast ratio at least 4.5:1 for text on its canvas/panel.
//   Panels are translucent under the glass system, so the checked pair is
//   text over the worst-case panel blend: the panel composited over the
//   canvas carrying a full-strength glow blob (the strongest thing that can
//   sit behind any panel). The comment next to each color records the
//   lowest pair under that method.
// - The "one gold accent" rule (07 §1): gold is reserved for the things that
//   matter (numbers, verdicts, focus). It is not a generic brand color and it
//   does not appear on chrome.
// - The glass rule (07 §1): surfaces float. Panels are translucent and blur
//   what passes behind them (the `glass` scale), the canvas carries two soft
//   glow fields (glowA/glowB) that the blur has to play with, and chrome
//   (the nav bar, floating hints) uses the canvas veil. Small controls keep
//   solid enough ink: the translucency lives on the surfaces, not the text.
//
// Themes: the canvas is warm bone in light mode and near-black in dark mode,
// both carrying the same glow fields; panels are translucent white or
// translucent charcoal over them. Both themes share the spacing, radius,
// typography, layout, glass, shadow, and motion scales; only the color
// surface changes between them, which keeps the rest of the system stable.

export type ColorTokenName =
  // Surface
  | 'canvas'
  | 'canvasVeil'
  | 'panel'
  | 'panelRaised'
  | 'panelBorder'
  | 'panelBorderStrong'
  | 'hairline'
  | 'fillQuiet'
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
  | 'seriesMuted'
  // The canvas glow fields (07 §1): the soft color washes that sit behind
  // every translucent panel and give the blur something to catch.
  | 'glowA'
  | 'glowB'
  // Elevation: the shadow ink each theme's shadows draw with.
  | 'shadowColor';

export type ColorTokens = Record<ColorTokenName, string>;

// Light canvas: warm bone background, translucent white glass panels, one
// gold accent. Lowest-contrast text pair under the glass method: textMuted
// (#5F5F57) on the worst-case panel blend at 5.8:1 (5.6:1 on the bare
// canvas), clear of the 4.5:1 floor with margin. textOnAccent over accent
// is 5.9:1, unchanged by the glass pass.
export const lightColors: ColorTokens = {
  canvas: '#F1EFE8',
  // The translucent canvas chrome paints with: the nav bar and the floating
  // hints. Opaque enough to keep their text honest, translucent enough to
  // read as glass over the scrolling page.
  canvasVeil: 'rgba(255, 255, 255, 0.58)',
  panel: 'rgba(255, 255, 255, 0.60)',
  panelRaised: 'rgba(255, 255, 255, 0.76)',
  panelBorder: 'rgba(28, 26, 18, 0.10)',
  panelBorderStrong: 'rgba(28, 26, 18, 0.22)',
  hairline: 'rgba(28, 26, 18, 0.07)',
  // Quiet fills that sit ON a panel (rail tracks, skeleton blocks, neutral
  // chips): strong enough to read through their host panel's translucency,
  // quieter than a border.
  fillQuiet: 'rgba(28, 26, 18, 0.10)',

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

  // The gold wash over the canvas's upper field and the cool wash over its
  // lower one; the ambience layer draws them, the panels blur them.
  glowA: 'rgba(184, 134, 11, 0.12)',
  glowB: 'rgba(31, 90, 168, 0.07)',

  shadowColor: '#14140F',
};

// Dark canvas: near-black background with the same glow fields, translucent
// charcoal glass panels, brighter gold so the accent still reads as gold
// against the dark surface. Lowest-contrast text pair under the glass
// method: textMuted (#A8A89E) on the worst-case panel blend at 7.0:1
// (8.3:1 on the bare canvas), clear of the floor.
export const darkColors: ColorTokens = {
  canvas: '#0A0A09',
  canvasVeil: 'rgba(10, 10, 9, 0.60)',
  panel: 'rgba(23, 23, 21, 0.55)',
  panelRaised: 'rgba(31, 31, 28, 0.70)',
  panelBorder: 'rgba(245, 244, 238, 0.10)',
  panelBorderStrong: 'rgba(245, 244, 238, 0.24)',
  hairline: 'rgba(245, 244, 238, 0.07)',
  fillQuiet: 'rgba(245, 244, 238, 0.12)',

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

  glowA: 'rgba(224, 184, 76, 0.12)',
  glowB: 'rgba(122, 168, 224, 0.08)',

  shadowColor: '#000000',
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
// The glass pass leans on the same scale: translucency makes a panel's
// corners its most visible edge, and radius.3 keeps the raised glass card
// soft enough to read as floating.
export const radius = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  pill: 9999,
} as const;

export type RadiusStep = keyof typeof radius;

// The glass scale (07 section 2 "Glass"): how strongly a surface blurs and
// saturate-shifts whatever passes behind it. Both values ride together in
// one backdrop-filter string built by the theme base styles, so every glass
// surface in the product blurs identically; a surface wanting its own value
// is a PR that changes this scale.
export const glass = {
  // Blur radius in px. Strong enough that page content scrolling under the
  // nav bar or behind a panel reads as soft color, never as legible text
  // fighting the panel's own text.
  blur: 18,
  // Saturation multiplier. The bump is what makes frosted glass feel lit
  // rather than merely fogged: the glow fields keep their warmth through
  // the blur.
  saturate: 1.6,
} as const;

// The shadow scale (07 section 2 "Glass"): the two elevations a surface can
// sit at. `resting` is the everyday panel, a tight soft shadow just clear of
// the panel's edge; `lifted` is the raised panel and floating chrome, wide
// and diffuse, the shadow that makes translucency read as height. The ink
// comes from the per-theme shadowColor token; RN Web maps these to a CSS
// box-shadow.
export const shadows = {
  resting: {
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  lifted: {
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
  },
} as const;

export type ShadowStep = keyof typeof shadows;

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
// roster table swaps to cards at 768px, and the player detail's analysis
// grids go two-up at 1024px; both breakpoints are read through
// useWindowDimensions, not CSS media queries, per the RN paradigm.
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
  readonly glass: typeof glass;
  readonly shadows: typeof shadows;
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
  glass,
  shadows,
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
  glass,
  shadows,
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
