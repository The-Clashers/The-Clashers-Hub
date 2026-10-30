import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, createBaseStyles } from '../theme';
import TagInput from '../components/TagInput';

// The players page (the owner's nav revision): the home of the player tag
// lookup, golden path B's front door. The game API draws a hard line the
// UI must not blur, there is no player search by name, so a tag is the
// only way in, and this page says so out loud instead of hiding the rule
// in a placeholder. The lookup itself is TagInput (T-M1-2, SR-13): the
// one component that owns tag normalization, reused here unchanged.
//
// The page owns no fetch: TagInput is purely client-side and navigates to
// /player/:tag, where the player screen owns the fetch and its states.

export default function PlayersScreen() {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={base.appRoot}>
      <View style={base.screen}>
        <View style={[base.contentColumn, styles.column]}>
          <View style={styles.header}>
            <Text style={base.display}>Players</Text>
            <Text style={base.subtitle}>
              Look a player up by tag. The game API has no player-name search, so the tag is the
              way in.
            </Text>
          </View>

          <View style={[base.panelRaised, styles.lookupPanel]}>
            <TagInput label="Player tag" />
            <Text style={styles.footnote}>
              Find the tag on the player's in-game profile: it starts with #. The # prefix is
              optional here.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    column: {
      flex: 1,
    },
    header: {
      gap: t.spacing[2],
      marginBottom: t.spacing[6],
    },
    lookupPanel: {
      gap: t.spacing[4],
    },
    footnote: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },
  });
}
