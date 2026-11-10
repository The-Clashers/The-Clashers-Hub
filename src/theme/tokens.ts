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
// Themes: the canvas is cool slate in light mode and deep slate-black in dark mode,
// both carrying the same glow fields; panels are translucent glass with a light top
// highlight edge. Both themes share the spacing, radius, typography, layout, glass,
// shadow, and motion scales; only the color surface changes between them.

export type ColorTokenName =
  // Surface
  | 'canvas'
  | 'canvasVeil'
  | 'panel'
  | 'panelRaised'
  | 'panelBorder'
  | 'panelBorderStrong'
  | 'panelHighlight'
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
  | 'accentInk'
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

// Light canvas: cool slate background, translucent white glass panels, one
// refined gold accent. Lowest-contrast text pair under the glass method:
// textMuted (#556072) on the worst-case panel blend at 5.9:1 (5.8:1 on the bare
// canvas), clear of the 4.5:1 floor with margin. textOnAccent over accent
// is 8.6:1; accentInk on accentSoft is 5.6:1.
export const lightColors: ColorTokens = {
  canvas: '#F3F5F9',
  canvasVeil: 'rgba(255, 255, 255, 0.66)',
  panel: 'rgba(255, 255, 255, 0.62)',
  panelRaised: 'rgba(255, 255, 255, 0.78)',
  panelBorder: 'rgba(15, 23, 42, 0.08)',
  panelBorderStrong: 'rgba(15, 23, 42, 0.18)',
  panelHighlight: 'rgba(255, 255, 255, 0.90)',
  hairline: 'rgba(15, 23, 42, 0.06)',
  fillQuiet: 'rgba(15, 23, 42, 0.07)',

  textPrimary: '#0E1420',
  textSecondary: '#364152',
  textMuted: '#556072',
  textOnAccent: '#1A1300',
  textInverse: '#FFFFFF',

  accent: '#E5A50A',
  accentInk: '#855600',
  accentHover: '#D49605',
  accentPressed: '#B88204',
  accentSoft: '#FCF1D8',
  focusRing: '#E5A50A',

  success: '#17714A',
  successSoft: '#DDF2E7',
  warning: '#985300',
  warningSoft: '#FCEBD3',
  danger: '#B42F2F',
  dangerSoft: '#FBE2E2',
  info: '#245FA6',
  infoSoft: '#E0EAF8',

  seriesGold: '#E5A50A',
  seriesBlue: '#245FA6',
  seriesGreen: '#17714A',
  seriesRed: '#B42F2F',
  seriesMuted: '#8F99AA',

  glowA: 'rgba(232, 163, 23, 0.16)',
  glowB: 'rgba(99, 102, 241, 0.10)',

  shadowColor: '#0F172A',
};

// Dark canvas: deep slate-black background with glow fields, translucent
// slate-glass panels, luminous gold accent. Lowest-contrast text pair under
// the glass method: textMuted (#8F99AA) on the worst-case panel blend at 5.7:1
// (6.8:1 on the bare canvas), clear of the floor.
export const darkColors: ColorTokens = {
  canvas: '#0A0D13',
  canvasVeil: 'rgba(10, 13, 19, 0.66)',
  panel: 'rgba(20, 25, 34, 0.58)',
  panelRaised: 'rgba(28, 34, 46, 0.72)',
  panelBorder: 'rgba(226, 232, 240, 0.08)',
  panelBorderStrong: 'rgba(226, 232, 240, 0.18)',
  panelHighlight: 'rgba(255, 255, 255, 0.06)',
  hairline: 'rgba(226, 232, 240, 0.06)',
  fillQuiet: 'rgba(226, 232, 240, 0.09)',

  textPrimary: '#E9EDF4',
  textSecondary: '#B6BECB',
  textMuted: '#8F99AA',
  textOnAccent: '#1A1300',
  textInverse: '#0A0D13',

  accent: '#F2C14E',
  accentInk: '#F2C14E',
  accentHover: '#F7CD6B',
  accentPressed: '#DBA834',
  accentSoft: '#2E2510',
  focusRing: '#F2C14E',

  success: '#5FCB93',
  successSoft: '#11281D',
  warning: '#EDB45E',
  warningSoft: '#2C2112',
  danger: '#F28B8B',
  dangerSoft: '#2D1719',
  info: '#86AEE6',
  infoSoft: '#142236',

  seriesGold: '#F2C14E',
  seriesBlue: '#86AEE6',
  seriesGreen: '#5FCB93',
  seriesRed: '#F28B8B',
  seriesMuted: '#717C8E',

  glowA: 'rgba(240, 185, 63, 0.14)',
  glowB: 'rgba(129, 140, 248, 0.12)',

  shadowColor: '#000000',
};

// Spacing scale. A 4px base with the steps the layout actually needs.
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

// Radius scale. Modernized curve: radius.1 (6) for chips, radius.2 (10) for panels,
// radius.3 (14) for raised cards, radius.4 (20) for large surfaces, pill for pills.
export const radius = {
  0: 0,
  1: 6,
  2: 10,
  3: 14,
  4: 20,
  pill: 9999,
} as const;

export type RadiusStep = keyof typeof radius;

// The glass scale: slightly stronger blur and saturation for crisp, lit glass.
export const glass = {
  blur: 20,
  saturate: 1.8,
} as const;

// The shadow scale: tighter and softer elevation steps.
export const shadows = {
  resting: {
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  lifted: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
} as const;

export type ShadowStep = keyof typeof shadows;

// Typography. Bundled Inter via @fontsource-variable/inter with system font fallback.
export const fontFamily = {
  sans: '"Inter Variable", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, Consolas, monospace',
} as const;

// Modernized type scale.
export const fontSize = {
  xs: 11,
  sm: 12,
  body: 14,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
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
  normal: 1.45,
  relaxed: 1.6,
} as const;

export type LineHeightName = keyof typeof lineHeight;

export const letterSpacing = {
  tight: -0.2,
  normal: 0,
  micro: 0.6,
} as const;

export type LetterSpacingName = keyof typeof letterSpacing;

// Density mode: compact on desktop/tablet (>=768px), comfortable on mobile (<768px).
export type Density = 'compact' | 'comfortable';

export function densityFor(width: number): Density {
  return width >= 768 ? 'compact' : 'comfortable';
}

// Layout scale parameterized by density.
export function createLayout(density: Density = 'compact') {
  const isCompact = density === 'compact';
  return {
    contentMaxWidth: 1280,
    sidePaddingDesktop: spacing[6],
    sidePaddingTablet: spacing[5],
    sidePaddingMobile: spacing[4],
    sidePaddingSmall: spacing[3],
    touchTargetMin: 44,
    controlHeight: isCompact ? 36 : 44,
    navHeightDesktop: 44,
    navHeightStacked: 84,
    rosterCardBreakpoint: 768,
    playerTwoColumnBreakpoint: 1024,
    focusRingWidth: 2,
    focusRingOffset: 2,
  } as const;
}

export const layout = createLayout('compact');

// Motion.
export const motion = {
  fast: 120,
  normal: 180,
  slow: 240,
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)' as const,
  pulse: 1200,
} as const;

// Z-index scale.
export const zIndex = {
  base: 0,
  raised: 1,
  sticky: 10,
  overlay: 100,
  toast: 1000,
} as const;

// Breakpoints helper.
export type Breakpoint = 'small' | 'mobile' | 'tablet' | 'desktop';

export function breakpointFor(width: number): Breakpoint {
  if (width < layout.rosterCardBreakpoint) {
    if (width < 480) return 'small';
    return 'mobile';
  }
  if (width < layout.playerTwoColumnBreakpoint) return 'tablet';
  return 'desktop';
}

// The full theme shape.
export interface ThemeTokens {
  readonly name: 'light' | 'dark';
  readonly density: Density;
  readonly colors: ColorTokens;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly glass: typeof glass;
  readonly shadows: typeof shadows;
  readonly fontFamily: typeof fontFamily;
  readonly fontSize: typeof fontSize;
  readonly fontWeight: typeof fontWeight;
  readonly lineHeight: typeof lineHeight;
  readonly letterSpacing: typeof letterSpacing;
  readonly layout: ReturnType<typeof createLayout>;
  readonly motion: typeof motion;
  readonly zIndex: typeof zIndex;
}

export function themeFor(name: 'light' | 'dark', density: Density = 'compact'): ThemeTokens {
  return {
    name,
    density,
    colors: name === 'light' ? lightColors : darkColors,
    spacing,
    radius,
    glass,
    shadows,
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    layout: createLayout(density),
    motion,
    zIndex,
  };
}

export const lightTheme: ThemeTokens = themeFor('light', 'compact');
export const darkTheme: ThemeTokens = themeFor('dark', 'compact');

export function themeByName(name: 'light' | 'dark'): ThemeTokens {
  return themeFor(name, 'compact');
}

/**
 * Glass edge highlight helper: returns the crisp top border highlight
 * that gives elevated panels and controls their glass-like illuminated rim.
 */
export function glassEdge(t: ThemeTokens) {
  return {
    borderTopColor: t.colors.panelHighlight,
  } as const;
}
