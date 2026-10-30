import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, createBaseStyles, type BaseStyles } from '../theme';
import {
  lightColors,
  darkColors,
  spacing,
  radius,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  layout,
  motion,
  zIndex,
  type ColorTokenName,
  type ColorTokens,
  type ThemeTokens,
} from '../theme/tokens';

// The token review screen. Every token the product ships with is listed here
// once, grouped by surface, so a reviewer can see the whole system on one
// canvas and verify the contrast pairs and the rhythm at a glance. This is
// the deliverable for subtask 4 of T-M0-2: "Sample screen listing every token
// for review."
//
// The screen itself is also the first real consumer of the base styles, so it
// doubles as the integration test for the wired StyleSheet base.

const COLOR_GROUPS: { title: string; names: ColorTokenName[] }[] = [
  {
    title: 'Surface',
    names: [
      'canvas',
      'panel',
      'panelRaised',
      'panelBorder',
      'panelBorderStrong',
      'hairline',
    ],
  },
  {
    title: 'Text',
    names: ['textPrimary', 'textSecondary', 'textMuted', 'textOnAccent', 'textInverse'],
  },
  {
    title: 'Accent (gold)',
    names: ['accent', 'accentHover', 'accentPressed', 'accentSoft', 'focusRing'],
  },
  {
    title: 'Semantic',
    names: [
      'success',
      'successSoft',
      'warning',
      'warningSoft',
      'danger',
      'dangerSoft',
      'info',
      'infoSoft',
    ],
  },
  {
    title: 'Chart series',
    names: ['seriesGold', 'seriesBlue', 'seriesGreen', 'seriesRed', 'seriesMuted'],
  },
];

const SPACING_STEPS = Object.keys(spacing) as unknown as (keyof typeof spacing)[];
const RADIUS_STEPS = Object.keys(radius) as unknown as (keyof typeof radius)[];
const FONT_SIZE_STEPS = Object.keys(fontSize) as unknown as (keyof typeof fontSize)[];
const FONT_WEIGHT_NAMES = Object.keys(fontWeight) as unknown as (keyof typeof fontWeight)[];
const LINE_HEIGHT_NAMES = Object.keys(lineHeight) as unknown as (keyof typeof lineHeight)[];

export default function TokenScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createScreenStyles(theme), [theme]);
  const base = useMemo(() => createBaseStyles(theme), [theme]);

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={base.contentColumn}>
          <View style={styles.header}>
            <View>
              <Text style={base.micro}>T-M0-2 review</Text>
              <Text style={base.display}>Design tokens</Text>
              <Text style={base.subtitle}>
                The only allowed values. Flip the canvas (nav bar) to verify both
                themes.
              </Text>
            </View>
          </View>

          <Section title="Color tokens" base={base} styles={styles}>
            <Text style={[base.caption, styles.sectionNote]}>
              Active canvas: <Text style={styles.themeName}>{theme.name}</Text>.
              The swatch below each name is the token in the active theme; the
              small square next to it is the same token in the other theme, so
              the pair is reviewable side by side. Contrast pairs (text on
              canvas, text on panel) clear the 4.5:1 floor (NFR-06).
            </Text>
            {COLOR_GROUPS.map((group) => (
              <View key={group.title} style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <View style={styles.swatchGrid}>
                  {group.names.map((name) => (
                    <ColorSwatch
                      key={name}
                      name={name}
                      active={theme.colors}
                      other={
                        theme.name === 'light' ? darkColors : lightColors
                      }
                      styles={styles}
                    />
                  ))}
                </View>
              </View>
            ))}
          </Section>

          <Section title="Spacing" base={base} styles={styles}>
            <Text style={[base.caption, styles.sectionNote]}>
              4px base. Touch targets compose from these (44px floor, 07 §6).
            </Text>
            <View style={styles.group}>
              {SPACING_STEPS.map((step) => (
                <SpacingRow
                  key={String(step)}
                  step={step}
                  value={spacing[step]}
                  styles={styles}
                />
              ))}
            </View>
          </Section>

          <Section title="Radius" base={base} styles={styles}>
            <Text style={[base.caption, styles.sectionNote]}>
              Chips and small controls take 1, panels take 2, hero panels take
              3, pills take the round value.
            </Text>
            <View style={styles.radiusGrid}>
              {RADIUS_STEPS.map((step) => (
                <RadiusBox
                  key={String(step)}
                  step={step}
                  value={radius[step]}
                  theme={theme}
                  styles={styles}
                />
              ))}
            </View>
          </Section>

          <Section title="Typography" base={base} styles={styles}>
            <Text style={[base.caption, styles.sectionNote]}>
              System font stack. Numbers use tabular figures; weights are
              limited to the four below.
            </Text>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>Font family</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>sans: {fontFamily.sans}</Text>
              </View>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>mono: {fontFamily.mono}</Text>
              </View>
            </View>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>Font size</Text>
              {FONT_SIZE_STEPS.map((step) => (
                <View key={String(step)} style={styles.typographyRow}>
                  <Text
                    style={[
                      styles.typographySample,
                      { fontSize: fontSize[step] },
                    ]}
                  >
                    The rushed verdict sits at 72%.
                  </Text>
                  <Text style={styles.typographyMeta}>
                    {String(step)} · {fontSize[step]}px
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>Font weight</Text>
              {FONT_WEIGHT_NAMES.map((step) => (
                <View key={String(step)} style={styles.typographyRow}>
                  <Text
                    style={[
                      styles.typographySample,
                      { fontWeight: fontWeight[step] },
                    ]}
                  >
                    Donations 1,240 given, 1,180 received
                  </Text>
                  <Text style={styles.typographyMeta}>
                    {String(step)} · {fontWeight[step]}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>Line height</Text>
              {LINE_HEIGHT_NAMES.map((step) => (
                <View key={String(step)} style={styles.typographyRow}>
                  <Text
                    style={[
                      styles.typographySample,
                      { lineHeight: lineHeight[step] * fontSize.body },
                    ]}
                  >
                    A roster of 50 members fits one screen, sortable by role,
                    Town Hall, and donations.
                  </Text>
                  <Text style={styles.typographyMeta}>
                    {String(step)} · {lineHeight[step]}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>Numeric variant</Text>
              <View style={styles.typographyRow}>
                <Text style={[styles.typographySample, styles.tabular]}>
                  1,234,567 · 89.0% · 4.5
                </Text>
                <Text style={styles.typographyMeta}>tabular-nums</Text>
              </View>
            </View>
          </Section>

          <Section title="Layout" base={base} styles={styles}>
            <View style={styles.group}>
              <KeyValue label="contentMaxWidth" value={`${layout.contentMaxWidth}px`} styles={styles} />
              <KeyValue label="sidePaddingDesktop" value={`${layout.sidePaddingDesktop}px`} styles={styles} />
              <KeyValue label="sidePaddingTablet" value={`${layout.sidePaddingTablet}px`} styles={styles} />
              <KeyValue label="sidePaddingMobile" value={`${layout.sidePaddingMobile}px`} styles={styles} />
              <KeyValue label="sidePaddingSmall" value={`${layout.sidePaddingSmall}px`} styles={styles} />
              <KeyValue label="touchTargetMin" value={`${layout.touchTargetMin}px`} styles={styles} />
              <KeyValue label="rosterCardBreakpoint" value={`${layout.rosterCardBreakpoint}px`} styles={styles} />
              <KeyValue label="playerTwoColumnBreakpoint" value={`${layout.playerTwoColumnBreakpoint}px`} styles={styles} />
              <KeyValue label="focusRingWidth" value={`${layout.focusRingWidth}px`} styles={styles} />
              <KeyValue label="focusRingOffset" value={`${layout.focusRingOffset}px`} styles={styles} />
            </View>
          </Section>

          <Section title="Motion" base={base} styles={styles}>
            <View style={styles.group}>
              <KeyValue label="fast" value={`${motion.fast}ms`} styles={styles} />
              <KeyValue label="normal" value={`${motion.normal}ms`} styles={styles} />
              <KeyValue label="slow" value={`${motion.slow}ms`} styles={styles} />
              <KeyValue label="ease" value={motion.ease} styles={styles} />
            </View>
          </Section>

          <Section title="Z-index" base={base} styles={styles}>
            <View style={styles.group}>
              <KeyValue label="base" value={String(zIndex.base)} styles={styles} />
              <KeyValue label="raised" value={String(zIndex.raised)} styles={styles} />
              <KeyValue label="sticky" value={String(zIndex.sticky)} styles={styles} />
              <KeyValue label="overlay" value={String(zIndex.overlay)} styles={styles} />
              <KeyValue label="toast" value={String(zIndex.toast)} styles={styles} />
            </View>
          </Section>

          <View style={styles.footer}>
            <Text style={base.caption}>
              Tokens are the only allowed values (07 §2). A screen needing a
              value not listed here files a PR that changes this list and the
              matching row in docs/concept/07-design-language.md.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Sections compose the base panel styles; they do not invent their own chrome.
interface SectionProps {
  title: string;
  base: BaseStyles;
  styles: ReturnType<typeof createScreenStyles>;
  children: ReactNode;
}

function Section({ title, base, styles, children }: SectionProps) {
  return (
    <View style={[base.panel, styles.sectionPanel]}>
      <View style={base.panelHeader}>
        <Text style={base.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

interface ColorSwatchProps {
  name: ColorTokenName;
  active: ColorTokens;
  other: ColorTokens;
  styles: ReturnType<typeof createScreenStyles>;
}

function ColorSwatch({ name, active, other, styles }: ColorSwatchProps) {
  return (
    <View style={styles.swatchCell}>
      <View style={styles.swatchPair}>
        <View
          style={[
            styles.swatchMain,
            { backgroundColor: active[name] },
          ]}
        />
        <View
          style={[
            styles.swatchOther,
            { backgroundColor: other[name] },
          ]}
        />
      </View>
      <Text style={styles.swatchName}>{name}</Text>
      <Text style={styles.swatchValue}>{active[name]}</Text>
    </View>
  );
}

interface SpacingRowProps {
  step: keyof typeof spacing;
  value: number;
  styles: ReturnType<typeof createScreenStyles>;
}

function SpacingRow({ step, value, styles }: SpacingRowProps) {
  return (
    <View style={styles.spacingRow}>
      <View style={styles.spacingLabelCol}>
        <Text style={styles.spacingLabel}>{String(step)}</Text>
        <Text style={styles.spacingValue}>{value}px</Text>
      </View>
      <View style={styles.spacingBarTrack}>
        <View
          style={[styles.spacingBar, { width: Math.max(value, 2) }]}
        />
      </View>
    </View>
  );
}

interface RadiusBoxProps {
  step: keyof typeof radius;
  value: number;
  theme: ThemeTokens;
  styles: ReturnType<typeof createScreenStyles>;
}

function RadiusBox({ step, value, theme, styles }: RadiusBoxProps) {
  const display =
    value >= 9999 ? 'pill' : value <= 0 ? '0' : `${value}px`;
  return (
    <View style={styles.radiusCell}>
      <View
        style={[
          styles.radiusBox,
          {
            borderRadius: Math.min(value, 40),
            backgroundColor: theme.colors.accentSoft,
            borderColor: theme.colors.accent,
          },
        ]}
      />
      <Text style={styles.radiusLabel}>{String(step)}</Text>
      <Text style={styles.radiusValue}>{display}</Text>
    </View>
  );
}

interface KeyValueProps {
  label: string;
  value: string;
  styles: ReturnType<typeof createScreenStyles>;
}

function KeyValue({ label, value, styles }: KeyValueProps) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

// Screen-specific styles compose the base; the base owns chrome, this owns
// the layout of the review grid.
function createScreenStyles(t: ThemeTokens) {
  const c = t.colors;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: t.spacing[4],
      marginBottom: t.spacing[7],
    },
    themeName: {
      fontWeight: t.fontWeight.semibold,
      color: c.accent,
    },
    sectionPanel: {
      marginBottom: t.spacing[6],
    },
    sectionNote: {
      marginBottom: t.spacing[4],
      maxWidth: 720,
    },
    group: {
      marginBottom: t.spacing[5],
    },
    groupTitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: c.textMuted,
      marginBottom: t.spacing[3],
    },
    swatchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[3],
    },
    swatchCell: {
      width: 140,
      gap: t.spacing[2],
    },
    swatchPair: {
      flexDirection: 'row',
      gap: t.spacing[1],
      height: 56,
      borderRadius: t.radius[2],
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    swatchMain: {
      flex: 1,
    },
    swatchOther: {
      width: 16,
      borderLeftWidth: 1,
      borderLeftColor: c.panelBorder,
    },
    swatchName: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textPrimary,
    },
    swatchValue: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    spacingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[4],
      paddingVertical: t.spacing[1],
    },
    spacingLabelCol: {
      width: 96,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: t.spacing[2],
    },
    spacingLabel: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textPrimary,
    },
    spacingValue: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    spacingBarTrack: {
      flex: 1,
      height: 12,
      borderRadius: 9999,
      backgroundColor: c.hairline,
    },
    spacingBar: {
      height: 12,
      borderRadius: 9999,
      backgroundColor: c.accent,
    },
    radiusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[4],
    },
    radiusCell: {
      width: 96,
      gap: t.spacing[2],
      alignItems: 'flex-start',
    },
    radiusBox: {
      width: 64,
      height: 64,
      borderWidth: 2,
    },
    radiusLabel: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textPrimary,
    },
    radiusValue: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    codeRow: {
      paddingVertical: t.spacing[1],
    },
    codeText: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textSecondary,
      lineHeight: t.lineHeight.normal * t.fontSize.xs,
    },
    typographyRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: t.spacing[4],
      paddingVertical: t.spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    typographySample: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      color: c.textPrimary,
      flex: 1,
    },
    typographyMeta: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    tabular: {
      fontVariant: ['tabular-nums'],
      fontWeight: t.fontWeight.semibold,
    },
    kvRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingVertical: t.spacing[1],
      gap: t.spacing[4],
    },
    kvLabel: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textPrimary,
    },
    kvValue: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      textAlign: 'right',
    },
    footer: {
      marginTop: t.spacing[6],
      marginBottom: t.spacing[8],
    },
  });
}

// (no trailing exports; the canonical surface lives in src/theme/index.ts)
