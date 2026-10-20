import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

// The theme toggle. Surfaces the canvas choice (light/dark) on any screen
// that wants it; the TokenScreen uses it in its header, later screens will
// place it in the AppShell. Built as a Pressable so it carries the RN
// accessibility role and the gold focus ring the design language requires
// (07 §6: 2px gold focus ring, touch targets >= 44px).
interface ThemeToggleProps {
  accessibilityLabel?: string;
}

function ThemeToggleImpl({ accessibilityLabel }: ThemeToggleProps) {
  const { name, toggle, theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const label = name === 'light' ? 'Go dark' : 'Go light';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? `Switch to ${name === 'light' ? 'dark' : 'light'} canvas`
      }
      onPress={toggle}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
    >
      <View style={styles.dot} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export const ThemeToggle = memo(ThemeToggleImpl);

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      paddingHorizontal: t.spacing[4],
      // 44px touch target floor (07 §6).
      minHeight: t.layout.touchTargetMin,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      // Gold focus ring (07 §6).
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    containerPressed: {
      backgroundColor: c.panel,
      borderColor: c.accent,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 9999,
      // The dot itself carries the gold accent so the control is identifiable
      // at a glance; in dark mode it brightens so it still reads.
      backgroundColor: c.accent,
    },
    label: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
    },
  });
}
