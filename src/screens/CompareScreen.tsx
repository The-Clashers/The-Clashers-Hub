import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigate, useSearchParams } from 'react-router';
import { useTheme, createBaseStyles } from '../theme';
import Breadcrumbs from '../components/Breadcrumbs';
import Glyph from '../components/Glyph';
import PillButton from '../components/PillButton';
import {
  clanRouteFor,
  normalizeTagInput,
  playerRouteFor,
  TAG_REJECT_COPY,
} from '../lib/tag';
import { SEARCH_NAME_MIN_CHARS, SEARCH_NAME_MIN_COPY } from '../api/search';

export type CompareMode = 'players' | 'clans';

export default function CompareScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Initial values can come from URL params (e.g. ?mode=players&a=TAG)
  const initialMode = (searchParams.get('mode') === 'clans' ? 'clans' : 'players') as CompareMode;
  const initialA = searchParams.get('a') ?? '';
  const initialB = searchParams.get('b') ?? '';

  const [mode, setMode] = useState<CompareMode>(initialMode);
  const [firstInput, setFirstInput] = useState(initialA);
  const [secondInput, setSecondInput] = useState(initialB);
  const [firstHint, setFirstHint] = useState<string | null>(null);
  const [secondHint, setSecondHint] = useState<string | null>(null);

  const isPlayer = mode === 'players';

  const validateTarget = (
    raw: string,
    setHint: (h: string | null) => void,
  ): { ok: boolean; path?: string } => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      setHint(isPlayer ? 'Enter a player tag.' : 'Enter a clan name or tag.');
      return { ok: false };
    }

    if (isPlayer) {
      const normalized = normalizeTagInput(trimmed);
      if (!normalized.ok) {
        setHint(normalized.reason === 'empty' ? 'Enter a player tag.' : TAG_REJECT_COPY[normalized.reason]);
        return { ok: false };
      }
      setHint(null);
      return { ok: true, path: playerRouteFor(normalized.tag) };
    }

    // Clan mode
    if (trimmed.startsWith('#')) {
      const normalized = normalizeTagInput(trimmed);
      if (!normalized.ok) {
        setHint(normalized.reason === 'empty' ? 'Enter a clan tag.' : TAG_REJECT_COPY[normalized.reason]);
        return { ok: false };
      }
      setHint(null);
      return { ok: true, path: clanRouteFor(normalized.tag) };
    }

    if (trimmed.length < SEARCH_NAME_MIN_CHARS) {
      setHint(SEARCH_NAME_MIN_COPY);
      return { ok: false };
    }

    setHint(null);
    return { ok: true, path: `/clans?name=${encodeURIComponent(trimmed)}` };
  };

  const handleCompare = () => {
    const resA = validateTarget(firstInput, setFirstHint);
    const resB = validateTarget(secondInput, setSecondHint);

    if (resA.ok && resB.ok) {
      // Comparison route (FR-13)
      if (isPlayer) {
        const tagA = normalizeTagInput(firstInput.trim());
        const tagB = normalizeTagInput(secondInput.trim());
        if (tagA.ok && tagB.ok) {
          navigate(
            `/compare/players?a=${encodeURIComponent(tagA.tag.replace(/^#/, ''))}&b=${encodeURIComponent(tagB.tag.replace(/^#/, ''))}`,
          );
        }
      } else {
        const cleanA = firstInput.trim().replace(/^#/, '');
        const cleanB = secondInput.trim().replace(/^#/, '');
        navigate(
          `/compare/clans?a=${encodeURIComponent(cleanA)}&b=${encodeURIComponent(cleanB)}`,
        );
      }
    }
  };

  const handleModeChange = (newMode: CompareMode) => {
    setMode(newMode);
    setFirstHint(null);
    setSecondHint(null);
  };

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.breadcrumbWrap}>
            <Breadcrumbs
              crumbs={[
                { label: 'Home', route: '/' },
                { label: 'Compare' },
              ]}
            />
          </View>

          <View style={styles.header}>
            <Text style={base.display}>Compare</Text>
            <Text style={base.subtitle}>
              Head-to-head analysis. Compare two players or two clans side by side.
            </Text>
          </View>

          {/* Mode switch tabs */}
          <View style={styles.modeTabs} accessibilityRole="tablist">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isPlayer }}
              accessibilityLabel="Compare Players"
              onPress={() => handleModeChange('players')}
              style={({ pressed }) => [
                styles.modeTab,
                isPlayer && styles.modeTabActive,
                pressed && !isPlayer && styles.modeTabPressed,
              ]}
            >
              <Glyph
                name="user"
                size={16}
                color={isPlayer ? theme.colors.accent : theme.colors.textMuted}
              />
              <Text style={isPlayer ? styles.modeTabTextActive : styles.modeTabText}>
                Compare Players
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: !isPlayer }}
              accessibilityLabel="Compare Clans"
              onPress={() => handleModeChange('clans')}
              style={({ pressed }) => [
                styles.modeTab,
                !isPlayer && styles.modeTabActive,
                pressed && isPlayer && styles.modeTabPressed,
              ]}
            >
              <Glyph
                name="shield"
                size={16}
                color={!isPlayer ? theme.colors.accent : theme.colors.textMuted}
              />
              <Text style={!isPlayer ? styles.modeTabTextActive : styles.modeTabText}>
                Compare Clans
              </Text>
            </Pressable>
          </View>

          {/* Dual Input Comparison Box */}
          <View style={[base.panelRaised, styles.comparePanel]}>
            <View style={styles.inputsRow}>
              {/* Box A */}
              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>
                  {isPlayer ? 'First Player Tag' : 'First Clan Name or Tag'}
                </Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={firstInput}
                    onChangeText={(text) => {
                      setFirstInput(text);
                      if (firstHint) setFirstHint(null);
                    }}
                    onSubmitEditing={handleCompare}
                    placeholder={isPlayer ? 'e.g. #9QQ0R0V' : 'e.g. #2PP or Clan Name'}
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize={isPlayer ? 'characters' : 'none'}
                    autoCorrect={false}
                    maxLength={64}
                    style={styles.textInput}
                    accessibilityLabel={isPlayer ? 'First player tag' : 'First clan name or tag'}
                  />
                </View>
                {firstHint ? (
                  <Text style={styles.inputHint} accessibilityRole="alert">
                    {firstHint}
                  </Text>
                ) : (
                  <Text style={styles.inputSub}>
                    {isPlayer ? 'The # prefix is optional.' : 'Use # for exact tag lookup.'}
                  </Text>
                )}
              </View>

              {/* VS Divider */}
              <View style={styles.vsContainer} aria-hidden>
                <View style={styles.vsCircle}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
              </View>

              {/* Box B */}
              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>
                  {isPlayer ? 'Second Player Tag' : 'Second Clan Name or Tag'}
                </Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={secondInput}
                    onChangeText={(text) => {
                      setSecondInput(text);
                      if (secondHint) setSecondHint(null);
                    }}
                    onSubmitEditing={handleCompare}
                    placeholder={isPlayer ? 'e.g. #2PP0' : 'e.g. #88RG or Clan Name'}
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize={isPlayer ? 'characters' : 'none'}
                    autoCorrect={false}
                    maxLength={64}
                    style={styles.textInput}
                    accessibilityLabel={isPlayer ? 'Second player tag' : 'Second clan name or tag'}
                  />
                </View>
                {secondHint ? (
                  <Text style={styles.inputHint} accessibilityRole="alert">
                    {secondHint}
                  </Text>
                ) : (
                  <Text style={styles.inputSub}>
                    {isPlayer ? 'The # prefix is optional.' : 'Use # for exact tag lookup.'}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.actionRow}>
              <PillButton
                label={isPlayer ? 'Compare Players' : 'Compare Clans'}
                icon="compare"
                onPress={handleCompare}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    column: {
      flex: 1,
    },
    breadcrumbWrap: {
      marginBottom: t.spacing[4],
    },
    header: {
      gap: t.spacing[2],
      marginBottom: t.spacing[5],
    },
    modeTabs: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      marginBottom: t.spacing[4],
    },
    modeTab: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius.pill,
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.panelBorder,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    modeTabActive: {
      backgroundColor: c.accentSoft,
      borderColor: c.accent,
    },
    modeTabPressed: {
      backgroundColor: c.panel,
    },
    modeTabText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textSecondary,
    },
    modeTabTextActive: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.accent,
    },
    comparePanel: {
      gap: t.spacing[5],
      padding: t.spacing[5],
    },
    inputsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: t.spacing[4],
    },
    inputBox: {
      flex: 1,
      minWidth: 260,
      gap: t.spacing[2],
    },
    inputLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    inputWrap: {
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panel,
    },
    textInput: {
      minHeight: 46,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      color: c.textPrimary,
      outlineColor: c.focusRing,
    },
    inputSub: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
    },
    inputHint: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.warning,
    },
    vsContainer: {
      alignSelf: 'center',
      paddingVertical: t.spacing[2],
    },
    vsCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vsText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.bold,
      color: c.accent,
    },
    actionRow: {
      alignItems: 'flex-end',
      paddingTop: t.spacing[2],
    },
  });
}
