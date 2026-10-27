import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBaseStyles, useTheme } from '../theme';

// The error state of the state matrix (06 section 3): a tone dot, a title,
// plain-language body copy with a next action (the contract's wording, 04
// section 6), announced politely through role=alert. The busy tone means
// retry in a moment (upstream throttle); gone means something actually
// broke. The user message never carries a key, a token, or personal data.

// The text column keeps a readable measure before it wraps under the tone
// dot on narrow screens.
const TEXT_MIN_WIDTH = 240;

const TONE_DOT_SIZE = 10;

export type ErrorTone = 'busy' | 'gone';

export interface ErrorStateProps {
  tone: ErrorTone;
  title: string;
  body: string;
  /** Optional next action, usually a retry PillButton. */
  action?: ReactNode;
}

export default function ErrorState({ tone, title, body, action }: ErrorStateProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={base.statePanel} accessibilityRole="alert">
      <View style={styles.row}>
        <View style={[styles.dot, tone === 'busy' ? styles.dotBusy : styles.dotGone]} />
        <View style={styles.text}>
          <Text style={base.title}>{title}</Text>
          <Text style={base.body}>{body}</Text>
        </View>
      </View>
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[3],
      flexWrap: 'wrap',
    },
    dot: {
      width: TONE_DOT_SIZE,
      height: TONE_DOT_SIZE,
      borderRadius: t.radius.pill,
      marginTop: t.spacing[2],
    },
    dotBusy: {
      backgroundColor: c.warning,
    },
    dotGone: {
      backgroundColor: c.danger,
    },
    text: {
      flex: 1,
      minWidth: TEXT_MIN_WIDTH,
      gap: t.spacing[2],
    },
    actionWrap: {
      marginTop: t.spacing[2],
    },
  });
}
