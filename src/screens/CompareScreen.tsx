import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigate, useSearchParams } from 'react-router';
import { useTheme, createBaseStyles, breakpointFor } from '../theme';
import Glyph from '../components/Glyph';
import PillButton from '../components/PillButton';
import ClanSearchPopup from '../components/ClanSearchPopup';
import type { SearchClanItem } from '../api/search';
import {
  normalizeTagInput,
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

  // The clan picker (T-M3-4): which side the popup picks for, or null
  // when closed. A name cannot be compared until it resolves to one
  // exact clan, so submitting a name opens the picker seeded with it
  // instead of navigating; the picked clan's #TAG lands in that side's
  // input. The Compare press is the one opener now: the input boxes
  // carry no inline affordance, so both modes share the identical box
  // chrome and the helper copy teaches the name flow.
  const [pickerSide, setPickerSide] = useState<'first' | 'second' | null>(null);

  const isPlayer = mode === 'players';

  // The middle button seats between the boxes from tablet up; below that
  // the boxes stack and the button takes its own centered row, the same
  // breakpoint family the compare face-off band keeps (07 section 3),
  // read through useWindowDimensions, never CSS media queries.
  const { width } = useWindowDimensions();
  const sideBySide =
    breakpointFor(width) === 'tablet' || breakpointFor(width) === 'desktop';

  // Player mode is tag-only (the game has no player search by name), so
  // every side validates through the one tag module.
  const validatePlayerTarget = (
    raw: string,
    setHint: (h: string | null) => void,
  ): { ok: boolean; tag?: string } => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      setHint('Enter a player tag.');
      return { ok: false };
    }
    const normalized = normalizeTagInput(trimmed);
    if (!normalized.ok) {
      setHint(normalized.reason === 'empty' ? 'Enter a player tag.' : TAG_REJECT_COPY[normalized.reason]);
      return { ok: false };
    }
    setHint(null);
    return { ok: true, tag: normalized.tag };
  };

  // Clan mode reads each side as one of three things: a #tag (ready to
  // compare), a name of three characters or more (the picker resolves
  // it to one exact clan), or a teaching moment (empty, too short, or a
  // malformed #tag) that stays inline. A bare alphanumeric string is a
  // name here, the same call the clan search bar makes.
  const readClanSide = (
    raw: string,
    setHint: (h: string | null) => void,
  ): { kind: 'tag'; tag: string } | { kind: 'name'; name: string } | { kind: 'invalid' } => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      setHint('Enter a clan name or tag.');
      return { kind: 'invalid' };
    }
    if (trimmed.startsWith('#')) {
      const normalized = normalizeTagInput(trimmed);
      if (!normalized.ok) {
        setHint(normalized.reason === 'empty' ? 'Enter a clan tag.' : TAG_REJECT_COPY[normalized.reason]);
        return { kind: 'invalid' };
      }
      setHint(null);
      return { kind: 'tag', tag: normalized.tag };
    }
    if (trimmed.length < SEARCH_NAME_MIN_CHARS) {
      setHint(SEARCH_NAME_MIN_COPY);
      return { kind: 'invalid' };
    }
    setHint(null);
    return { kind: 'name', name: trimmed };
  };

  const handleCompare = () => {
    if (isPlayer) {
      const resA = validatePlayerTarget(firstInput, setFirstHint);
      const resB = validatePlayerTarget(secondInput, setSecondHint);
      if (resA.ok && resB.ok && resA.tag && resB.tag) {
        navigate(
          `/compare/players?a=${encodeURIComponent(resA.tag.replace(/^#/, ''))}&b=${encodeURIComponent(resB.tag.replace(/^#/, ''))}`,
        );
      }
      return;
    }

    // Clan mode: tags compare, names pick. The first side that needs
    // the picker opens it seeded with what was typed; the other side
    // gets its turn after the pick.
    const sideA = readClanSide(firstInput, setFirstHint);
    const sideB = readClanSide(secondInput, setSecondHint);
    if (sideA.kind === 'tag' && sideB.kind === 'tag') {
      navigate(
        `/compare/clans?a=${encodeURIComponent(sideA.tag.replace(/^#/, ''))}&b=${encodeURIComponent(sideB.tag.replace(/^#/, ''))}`,
      );
      return;
    }
    if (sideA.kind === 'name') {
      setPickerSide('first');
    } else if (sideB.kind === 'name') {
      setPickerSide('second');
    }
  };

  // A pick from the popup fills its side's input with the clan's tag
  // and hands the flow on: if the other side still holds a name, the
  // picker reopens for that side seeded with it; if both sides are tags
  // now, the original submit completes and the comparison opens.
  const handlePick = (clan: SearchClanItem) => {
    const tag = clan.tag;
    const pickedFirst = pickerSide === 'first';
    if (pickedFirst) {
      setFirstInput(tag);
      setFirstHint(null);
    } else {
      setSecondInput(tag);
      setSecondHint(null);
    }

    const otherRaw = pickedFirst ? secondInput.trim() : firstInput.trim();
    const otherRead = readClanSide(otherRaw, () => {});
    if (otherRead.kind === 'name') {
      setPickerSide(pickedFirst ? 'second' : 'first');
      return;
    }
    setPickerSide(null);
    if (otherRead.kind === 'tag') {
      const otherTag = otherRead.tag.replace(/^#/, '');
      navigate(
        `/compare/clans?a=${encodeURIComponent(pickedFirst ? tag.replace(/^#/, '') : otherTag)}&b=${encodeURIComponent(pickedFirst ? otherTag : tag.replace(/^#/, ''))}`,
      );
    }
  };

  const handleModeChange = (newMode: CompareMode) => {
    setMode(newMode);
    setFirstHint(null);
    setSecondHint(null);
    // The picker belongs to clan mode alone; switching modes closes it.
    setPickerSide(null);
  };

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
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
                size={15}
                color={isPlayer ? theme.colors.accentInk : theme.colors.textMuted}
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
                size={15}
                color={!isPlayer ? theme.colors.accentInk : theme.colors.textMuted}
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
                    {isPlayer
                      ? 'The # prefix is optional.'
                      : 'Paste a #tag, or press Compare to search names.'}
                  </Text>
                )}
              </View>

              {/* The launch action, seated where the VS badge sat: one
                  compact gold pill between the two boxes, level with the
                  input line at tablet up (the pill keeps the control
                  height, so it centers on the same band the boxes' inputs
                  occupy) and on its own centered row below, where the
                  boxes stack. Both modes press the same button; the mode's
                  own submit logic (tags compare, names pick) stays in
                  handleCompare. */}
              <View style={[styles.compareSlot, !sideBySide && styles.compareSlotStacked]}>
                <PillButton
                  label="Compare"
                  icon="compare"
                  compact
                  onPress={handleCompare}
                  hint={
                    isPlayer
                      ? 'Compares the two player tags.'
                      : 'Compares the two clans. A name opens the clan picker.'
                  }
                />
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
                    {isPlayer
                      ? 'The # prefix is optional.'
                      : 'Paste a #tag, or press Compare to search names.'}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* The clan picker: names resolve to one exact clan before any
              comparison can run (the game API searches clans by name,
              players it does not, which is why player mode never opens
              it). Portaled over the page; see the component. */}
          <ClanSearchPopup
            visible={pickerSide !== null}
            sideLabel={pickerSide === 'first' ? 'First clan' : 'Second clan'}
            initialQuery={
              pickerSide === 'first' ? firstInput : pickerSide === 'second' ? secondInput : ''
            }
            onPick={handlePick}
            onClose={() => setPickerSide(null)}
          />
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
      minHeight: t.layout.controlHeight,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
      borderRadius: t.radius.pill,
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
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
      color: c.accentInk,
    },
    comparePanel: {
      gap: t.spacing[4],
      padding: t.spacing[4],
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
      letterSpacing: t.letterSpacing.micro,
    },
    inputWrap: {
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      borderTopColor: c.panelHighlight,
      backgroundColor: c.panel,
    },
    textInput: {
      minHeight: t.layout.controlHeight,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
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
    // The launch action's seat between the two boxes: centered on the
    // row's cross axis, which lands the control-height pill level with
    // the input boxes (their labels sit above, their helpers below, so
    // the row's midpoint is the inputs' band).
    compareSlot: {
      alignSelf: 'center',
      paddingVertical: t.spacing[1],
    },
    // Below tablet the boxes stack, so the seat takes its own full-width
    // row and centers the pill on it; the wrap already forces the boxes
    // onto their own lines at these widths. The centering is the row's
    // own justifyContent, not alignItems: the pill's base style carries
    // alignSelf 'flex-start', which would win against a column's
    // alignItems and pin the button to the seat's left edge.
    compareSlotStacked: {
      alignSelf: 'auto',
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
    },
  });
}
