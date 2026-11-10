import { describe, expect, it } from 'vitest';
import {
  densityFor,
  themeFor,
  glassEdge,
  letterSpacing,
  radius,
  fontFamily,
  lightColors,
  darkColors,
} from './tokens';

// Relative luminance per WCAG 2.1 formula
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('design tokens: density', () => {
  it('assigns compact density at and above 768px tablet breakpoint', () => {
    expect(densityFor(768)).toBe('compact');
    expect(densityFor(1024)).toBe('compact');
    expect(densityFor(1440)).toBe('compact');
  });

  it('assigns comfortable density below 768px for mobile and small screens', () => {
    expect(densityFor(767)).toBe('comfortable');
    expect(densityFor(480)).toBe('comfortable');
    expect(densityFor(360)).toBe('comfortable');
  });

  it('adapts controlHeight by density', () => {
    const compactTheme = themeFor('light', 'compact');
    const comfortableTheme = themeFor('light', 'comfortable');

    expect(compactTheme.layout.controlHeight).toBe(36);
    expect(comfortableTheme.layout.controlHeight).toBe(44);
    expect(compactTheme.layout.touchTargetMin).toBe(44);
    expect(comfortableTheme.layout.touchTargetMin).toBe(44);
  });
});

describe('design tokens: colors and contrast', () => {
  it('defines panelHighlight and accentInk on both light and dark themes', () => {
    expect(lightColors.panelHighlight).toBeDefined();
    expect(darkColors.panelHighlight).toBeDefined();
    expect(lightColors.accentInk).toBeDefined();
    expect(darkColors.accentInk).toBeDefined();
  });

  it('guarantees WCAG AA (>= 4.5:1) contrast for accentInk on accentSoft', () => {
    const lightRatio = contrastRatio(lightColors.accentInk, lightColors.accentSoft);
    const darkRatio = contrastRatio(darkColors.accentInk, darkColors.accentSoft);

    expect(lightRatio).toBeGreaterThanOrEqual(4.5);
    expect(darkRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('guarantees WCAG AA (>= 4.5:1) contrast for accentInk on canvas', () => {
    const lightRatio = contrastRatio(lightColors.accentInk, lightColors.canvas);
    const darkRatio = contrastRatio(darkColors.accentInk, darkColors.canvas);

    expect(lightRatio).toBeGreaterThanOrEqual(4.5);
    expect(darkRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('guarantees WCAG AA (>= 4.5:1) contrast for primary text on canvas', () => {
    const lightRatio = contrastRatio(lightColors.textPrimary, lightColors.canvas);
    const darkRatio = contrastRatio(darkColors.textPrimary, darkColors.canvas);

    expect(lightRatio).toBeGreaterThanOrEqual(4.5);
    expect(darkRatio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('design tokens: typography and glass helpers', () => {
  it('includes Inter Variable in the primary sans font stack', () => {
    expect(fontFamily.sans).toContain('Inter Variable');
  });

  it('exports tightened letter spacing scale', () => {
    expect(letterSpacing.tight).toBe(-0.2);
    expect(letterSpacing.normal).toBe(0);
    expect(letterSpacing.micro).toBe(0.6);
  });

  it('exports refined radius scale', () => {
    expect(radius[1]).toBe(6);
    expect(radius[2]).toBe(10);
    expect(radius[3]).toBe(14);
    expect(radius[4]).toBe(20);
    expect(radius.pill).toBe(9999);
  });

  it('creates glassEdge with panelHighlight top border', () => {
    const theme = themeFor('light', 'compact');
    const edge = glassEdge(theme);
    expect(edge.borderTopColor).toBe(theme.colors.panelHighlight);
  });
});
