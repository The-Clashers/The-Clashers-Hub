import { useEffect, useId, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme } from '../theme';

// The lookup mode picker: the small icon dropdown inside the nav search box
// that says whether the typed text is a player tag or a clan name/tag
// (the owner's nav layout: "search box with dropdown player or clan, just
// small icons").
//
// It follows the house Dropdown pattern (07 section 4) closely: the trigger
// is a role=button with aria-haspopup="listbox" and aria-expanded, the open
// panel is a portaled role=listbox of role=option rows with aria-selected,
// and the keyboard contract is the same one (Enter/Space/ArrowDown open,
// arrows walk, Enter picks, Escape closes and returns focus, document-level
// steering while open). It is its own component rather than a Dropdown
// variant because the trigger is an icon, not a label plus value, and the
// options carry icons too; the shared behavior is the ARIA contract, which
// is copied verbatim.
//
// The two icons are drawn from RN primitives (no icon dependency exists in
// the stack, CON-04): the player is a head-and-shoulders mark, the clan is
// a shield. They read at 16 px in both themes because they take the text
// color, and each option repeats its icon beside the word so the listbox
// is self-describing.

export type LookupMode = 'player' | 'clan';

interface LookupModeOption {
  value: LookupMode;
  label: string;
  /** The phrase a screen reader hears for the mode. */
  accessibilityLabel: string;
}

const MODE_OPTIONS: ReadonlyArray<LookupModeOption> = [
  { value: 'player', label: 'Player', accessibilityLabel: 'Player tag lookup' },
  { value: 'clan', label: 'Clan', accessibilityLabel: 'Clan name or tag lookup' },
];

export interface LookupModePickerProps {
  /** The active mode; drives the trigger icon and the selected option. */
  value: LookupMode;
  /** Fires with the picked mode. */
  onSelect: (mode: LookupMode) => void;
}

export default function LookupModePicker({ value, onSelect }: LookupModePickerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const listboxId = useId();
  const triggerId = `${listboxId}-trigger`;

  const [open, setOpen] = useState(false);
  // The keyboard-active option; focus follows it while the list is open.
  const [activeIndex, setActiveIndex] = useState(0);
  // Viewport coordinates of the trigger, captured when the list opens; the
  // portaled listbox anchors to them.
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const selectedIndex = Math.max(
    0,
    MODE_OPTIONS.findIndex((option) => option.value === value),
  );
  const selected = MODE_OPTIONS[selectedIndex];

  const focusTrigger = () => {
    document.getElementById(triggerId)?.focus();
  };

  const focusOption = (index: number) => {
    const node = document.getElementById(`${listboxId}-opt-${index}`);
    if (node) {
      node.focus();
      node.scrollIntoView({ block: 'nearest' });
    }
  };

  const openList = () => {
    const node = document.getElementById(triggerId);
    if (node) {
      const rect = node.getBoundingClientRect();
      setAnchor({ top: rect.bottom + 4, left: rect.left });
    }
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const closeList = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) focusTrigger();
  };

  const select = (option: LookupModeOption) => {
    onSelect(option.value);
    closeList(true);
  };

  // Pressing outside closes, the same document-level listener the Dropdown
  // uses: the press can land anywhere, including far from the nav.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`#${triggerId}`)) return;
      if (target?.closest(`#${listboxId}`)) return;
      closeList(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, triggerId, listboxId]);

  // Keyboard steering while open, the Dropdown's document-level contract:
  // the keydown lands on whichever element inside the control holds focus
  // (trigger or an option), Enter/Space on an option pick through the
  // PressResponder, and this handler owns navigation and Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const trigger = document.getElementById(triggerId);
      const target = event.target;
      const insideTrigger = target instanceof Node && trigger?.contains(target);
      const insideListbox =
        target instanceof Node && document.getElementById(listboxId)?.contains(target);
      if (!insideTrigger && !insideListbox) return;
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          closeList(true);
          return;
        case 'ArrowDown':
          event.preventDefault();
          focusOption((activeIndex + 1) % MODE_OPTIONS.length);
          return;
        case 'ArrowUp':
          event.preventDefault();
          focusOption((activeIndex - 1 + MODE_OPTIONS.length) % MODE_OPTIONS.length);
          return;
        case 'Tab':
          closeList(false);
          return;
        default:
          return;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, activeIndex, listboxId, triggerId]);

  // Arrow keys on the closed trigger open it, the way a native select
  // behaves. onKeyDown is a react-native-web forwarded prop; the RN event
  // type carries no `key`, so it is read through the web KeyboardEvent the
  // runtime actually delivers (the same cast the Dropdown documents).
  const handleTriggerKeyDown = (
    event: Parameters<NonNullable<React.ComponentProps<typeof Pressable>['onKeyDown']>>[0],
  ) => {
    const key = (event as unknown as KeyboardEvent).key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openList();
    }
  };

  return (
    <View>
      <Pressable
        nativeID={triggerId}
        accessibilityRole="button"
        accessibilityLabel={`Search target, ${selected.accessibilityLabel}`}
        accessibilityHint="Opens the choice between player and clan search."
        aria-haspopup="listbox"
        aria-expanded={open}
        onPress={() => (open ? closeList(true) : openList())}
        onKeyDown={handleTriggerKeyDown}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <ModeIcon mode={value} styles={styles} />
      </Pressable>
      {open && anchor
        ? createPortal(
            <View
              nativeID={listboxId}
              accessibilityRole="listbox"
              accessibilityLabel="Search target"
              style={[
                // position:fixed is a react-native-web runtime value the RN
                // types do not carry; the Dropdown makes the same cast for
                // the same reason.
                styles.listbox,
                { top: anchor.top, left: anchor.left },
              ]}
            >
              {MODE_OPTIONS.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    nativeID={`${listboxId}-opt-${index}`}
                    accessibilityRole="option"
                    accessibilityLabel={option.accessibilityLabel}
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onPress={() => select(option)}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <ModeIcon mode={option.value} styles={styles} />
                    <Text style={styles.optionLabel}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>,
            document.body,
          )
        : null}
    </View>
  );
}

// ---------- the two mode marks ----------

/** The player mark: a head-and-shoulders silhouette from two Views. */
function PlayerMark({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.mark}>
      <View style={styles.markHead} />
      <View style={styles.markShoulders} />
    </View>
  );
}

/** The clan mark: a shield, rounded at the top and curved at the point. */
function ClanMark({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.mark}>
      <View style={styles.markShield} />
    </View>
  );
}

function ModeIcon({
  mode,
  styles,
}: {
  mode: LookupMode;
  styles: ReturnType<typeof createStyles>;
}) {
  return mode === 'player' ? <PlayerMark styles={styles} /> : <ClanMark styles={styles} />;
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    // The trigger sits flush inside the lookup box's left edge: no border
    // of its own, the 44 px touch floor carried by the height.
    trigger: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      minHeight: t.layout.touchTargetMin,
      borderRadius: t.radius[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    triggerPressed: {
      backgroundColor: c.panel,
    },

    // The portaled listbox: fixed at the trigger's viewport coordinates,
    // body-level so no sibling stacking context can bury it (the same
    // reason the Dropdown portals).
    listbox: {
      position: 'fixed' as unknown as 'relative',
      zIndex: t.zIndex.overlay,
      minWidth: 168,
      padding: t.spacing[1],
      backgroundColor: c.panelRaised,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      // boxShadow, not the deprecated shadow* props react-native-web warns
      // about: the same drop the Dropdown's portaled panel casts.
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.18)',
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[3],
      paddingHorizontal: t.spacing[3],
      minHeight: t.layout.touchTargetMin,
      borderRadius: t.radius[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    optionSelected: {
      backgroundColor: c.panel,
    },
    optionPressed: {
      opacity: 0.7,
    },
    optionLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
    },

    // The marks: 16 px tall, drawn from primitives, taking the primary
    // text color so both themes read.
    mark: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      width: 16,
      height: 16,
    },
    markHead: {
      width: 7,
      height: 7,
      borderRadius: 9999,
      backgroundColor: c.textPrimary,
      marginBottom: 1,
    },
    markShoulders: {
      width: 14,
      height: 6,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      backgroundColor: c.textPrimary,
    },
    markShield: {
      width: 13,
      height: 15,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      borderBottomLeftRadius: 5,
      borderBottomRightRadius: 5,
      borderWidth: 1.5,
      borderColor: c.textPrimary,
    },
  });
}
