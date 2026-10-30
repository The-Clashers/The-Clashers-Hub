import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme } from '../theme';
import LookupModePicker, { type LookupMode } from './LookupModePicker';
import {
  clanRouteFor,
  normalizeTagInput,
  playerRouteFor,
  TAG_REJECT_COPY,
} from '../lib/tag';

// The lookup box (07 section 4): one search input with a player/clan mode
// picker, the same box rendered thin in the nav bar and large on the home
// hero. The mode decides what the typed text means:
//
// - Player: a tag, with or without the # prefix (the game API has no
//   player-name search, so a tag is the only way in; TagInput owns the
//   same rule through the same lib/tag.ts module).
// - Clan: a #tag opens the clan detail directly; anything else is a clan
//   name, which lands on /clans with ?name= carrying the text so the
//   clans screen runs the search on arrival. That keeps the nav box
//   honest for names without duplicating the filter row here.
//
// The one normalization rule stays in lib/tag.ts (SR-13); this component
// only calls it. Both variants share the behavior; the sizes differ.

/** Where the box renders; sizes only, behavior is shared. */
export type LookupVariant = 'bar' | 'hero';

export interface LookupSearchProps {
  /** 'bar' for the thin nav row, 'hero' for the home page's big box. */
  variant?: LookupVariant;
  /** Override navigation in tests; defaults to react-router's useNavigate. */
  onNavigate?: (route: string) => void;
}

export default function LookupSearch({ variant = 'bar', onNavigate }: LookupSearchProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, variant), [theme, variant]);
  const navigate = useNavigate();
  const go = onNavigate ?? ((route: string) => navigate(route));

  const [mode, setMode] = useState<LookupMode>('clan');
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const submit = () => {
    const raw = draft.trim();
    if (raw.length < 1) {
      setHint(mode === 'player' ? 'Type a player tag first.' : 'Type a clan name or tag first.');
      return;
    }
    if (mode === 'player') {
      const tag = normalizeTagInput(raw);
      if (tag.ok) {
        setHint(null);
        go(playerRouteFor(tag.tag));
      } else {
        setHint(tag.reason === 'empty' ? 'Type a player tag first.' : TAG_REJECT_COPY[tag.reason]);
      }
      return;
    }
    // Clan mode: a leading # is the one honest way to say "this is a tag,
    // not a name" (bare tags and names share the alphabet). The tag path
    // goes through the same rule and route builder as every other clan
    // link in the app; a name hands the text to the clans screen.
    if (raw.startsWith('#')) {
      const tag = normalizeTagInput(raw);
      if (tag.ok) {
        setHint(null);
        go(clanRouteFor(tag.tag));
      } else {
        setHint(
          tag.reason === 'empty' ? 'Type a clan name or tag first.' : TAG_REJECT_COPY[tag.reason],
        );
      }
      return;
    }
    setHint(null);
    go(`/clans?name=${encodeURIComponent(raw)}`);
  };

  // Clear the hint the moment the problem is fixed, the same
  // clear-on-fix rhythm the tag box and the clan search bar keep: non-blank
  // text clears a name hint, a valid tag clears a tag hint.
  const handleChange = (text: string) => {
    setDraft(text);
    if (hint === null) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    if (mode === 'player' || trimmed.startsWith('#')) {
      if (!normalizeTagInput(trimmed).ok) return;
    }
    setHint(null);
  };

  const placeholder =
    mode === 'player' ? 'Player tag, # optional' : 'Clan name or #tag';

  return (
    <View style={styles.box} accessibilityRole="search">
      <View style={styles.row}>
        <View style={styles.pickerWrap}>
          <LookupModePicker value={mode} onSelect={setMode} />
        </View>
        <TextInput
          value={draft}
          onChangeText={handleChange}
          onSubmitEditing={submit}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={mode === 'player' ? 'Player tag' : 'Clan name or tag'}
          accessibilityHint={
            mode === 'player'
              ? 'Type a player tag and press Go. The # prefix is optional.'
              : 'Type a clan name, or a clan tag starting with #, and press Go.'
          }
          autoCapitalize={mode === 'player' ? 'characters' : 'none'}
          autoCorrect={false}
          maxLength={64}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'player' ? 'Look up player' : 'Look up clan'}
          accessibilityHint={
            mode === 'player'
              ? 'Opens the player detail screen for the tag.'
              : 'Opens the clan directly for a #tag, or the clan search for a name.'
          }
          onPress={submit}
          style={({ pressed }) => [styles.go, pressed && styles.goPressed]}
        >
          <Text style={styles.goText}>Go</Text>
        </Pressable>
      </View>
      {hint !== null ? (
        // Bar variant: the hint floats under the fixed-height nav box
        // instead of growing it. Hero variant: inline, there is room.
        <Text style={styles.hint} accessibilityRole="alert">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme'], variant: LookupVariant) {
  const c = t.colors;
  const hero = variant === 'hero';
  return StyleSheet.create({
    box: {
      // The hero box reserves room for its inline hint so the layout under
      // it never jumps when a hint appears; the bar box floats the hint.
      minWidth: 0,
      flexShrink: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
    },
    pickerWrap: {
      justifyContent: 'center',
      borderRightWidth: 1,
      borderRightColor: c.panelBorder,
    },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: hero ? 52 : t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[2],
      fontFamily: t.fontFamily.sans,
      fontSize: hero ? t.fontSize.md : t.fontSize.sm,
      color: c.textPrimary,
      outlineColor: c.focusRing,
    },
    go: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: hero ? t.spacing[5] : t.spacing[4],
      borderTopRightRadius: t.radius[2],
      borderBottomRightRadius: t.radius[2],
      backgroundColor: c.accent,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    goPressed: {
      backgroundColor: c.accentPressed,
    },
    goText: {
      fontFamily: t.fontFamily.sans,
      fontSize: hero ? t.fontSize.body : t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textOnAccent,
    },
    hint: {
      ...(hero
        ? {
            marginTop: t.spacing[2],
          }
        : {
            // Float below the thin nav row; the box's own width bounds it.
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: t.spacing[1],
          }),
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.warning,
      backgroundColor: c.canvas,
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
      borderRadius: t.radius[1],
      alignSelf: 'flex-start',
    },
  });
}
