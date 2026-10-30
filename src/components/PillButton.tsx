import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';
import { linkEnterActivation } from '../lib/link-activation';

// The one pill button (07 section 4). Search, the retry actions, and the
// footer links were three copies of the same accent pill inside the search
// screen; this is that button, once. Primary is the gold accent with
// on-accent ink, secondary is a raised panel with a border for the quieter
// actions, and the arrow variant renders the trailing " ->" mark the
// footer-style links carry.
//
// The component owns its styles (STD-13): callers pass a label and
// behavior, never a stylesheet. Focus visibility is the same outline pair
// every interactive kit piece uses (07 section 6), and the 44 px touch
// floor comes from the layout token.
//
// Link-role instances carry linkEnterActivation so Enter fires onPress:
// react-native-web's responder assumes role=link elements are real anchors
// and never calls onPress for them (lib/link-activation.ts owns the why).
// Button-role instances need nothing; the responder serves them natively.

export interface PillButtonProps {
  /** Button text; doubles as the accessibility label. */
  label: string;
  onPress: () => void;
  /** Primary (gold) or secondary (raised panel). Defaults to primary. */
  variant?: 'primary' | 'secondary';
  /** ARIA role: buttons act, links navigate. Defaults to 'button'. */
  role?: 'button' | 'link';
  /** Extra instruction for screen readers when the label alone is not enough. */
  hint?: string;
  /** Renders the trailing arrow mark the footer-style links carry. */
  arrow?: boolean;
  /** Lets the button fill its row's cross axis, the way the Search button
   * stretches to match the name input's height. */
  stretch?: boolean;
  disabled?: boolean;
}

export default function PillButton({
  label,
  onPress,
  variant = 'primary',
  role = 'button',
  hint,
  arrow = false,
  stretch = false,
  disabled = false,
}: PillButtonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const secondary = variant === 'secondary';

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      // Guarded by disabled: the responder ignores clicks on a disabled
      // Pressable, but a raw onKeyDown still fires, so the Enter path has
      // to respect the disabled flag itself.
      onKeyDown={role === 'link' && !disabled ? linkEnterActivation(onPress) : undefined}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        stretch && styles.buttonStretch,
        secondary && styles.buttonSecondary,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.text, secondary && styles.textSecondary]}>{label}</Text>
      {arrow ? (
        <Text style={[styles.arrow, secondary && styles.textSecondary]} aria-hidden>
          {' ->'}
        </Text>
      ) : null}
    </Pressable>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing[2],
      alignSelf: 'flex-start',
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[5],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius.pill,
      backgroundColor: c.accent,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    buttonStretch: {
      alignSelf: 'stretch',
    },
    buttonSecondary: {
      backgroundColor: c.panelRaised,
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
    },
    buttonPressed: {
      backgroundColor: c.accentPressed,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    text: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.semibold,
      color: c.textOnAccent,
    },
    textSecondary: {
      color: c.textPrimary,
    },
    arrow: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.body,
      fontWeight: t.fontWeight.bold,
      color: c.textOnAccent,
    },
  });
}
