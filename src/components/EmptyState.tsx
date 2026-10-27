import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBaseStyles, useTheme } from '../theme';

// The idle and empty states of the state matrix (06 section 3): a title,
// plain-language body, and an optional next action. Never a dead end; when
// the state has a fix (clear the filters, check the spelling) the action
// says it. Renders on the shared state panel from the base styles.

export interface EmptyStateProps {
  title: string;
  body: string;
  /** Optional next action, usually a PillButton. */
  action?: ReactNode;
}

export default function EmptyState({ title, body, action }: EmptyStateProps) {
  const { theme } = useTheme();
  const base = useMemo(() => createBaseStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={base.statePanel}>
      <Text style={base.title}>{title}</Text>
      <Text style={base.body}>{body}</Text>
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    actionWrap: {
      marginTop: t.spacing[2],
    },
  });
}
