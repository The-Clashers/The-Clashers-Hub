import { useEffect, useId, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme } from '../theme';

// A select-style dropdown built on RN primitives only (CON-04: no DOM-only
// UI libraries, no native <select>, no extra dependency). The search screen
// filter row uses it: four filters, each a closed set of options, previously
// chip rows. The control keeps the contract the chips had (value in, value
// out) so the screen's apply-on-submit rule is untouched.
//
// ARIA shape: the WAI-ARIA "select-only combobox" pattern. The trigger is a
// role=button with aria-haspopup="listbox" and aria-expanded; the open panel
// is a role=listbox of role=option rows with aria-selected. react-native-web
// forwards every one of those props to the DOM, and its PressResponder gives
// the trigger Enter/Space activation and every option Enter activation for
// free, which is why the options carry tabIndex=-1 (programmatic focus only;
// the tab order stays trigger then out).
//
// Focus and DOM access go through nativeID + getElementById: react-native-web
// maps nativeID to the DOM id, refs on View would fight the RN 0.88 types,
// and the ids double as the aria-controls / aria-labelledby wiring.
//
// Keyboard contract (verified in the browser):
// - Enter or Space on the closed trigger opens the list; ArrowDown/ArrowUp
//   on the closed trigger opens it too, the way a native select behaves.
// - ArrowDown from the trigger moves focus onto the selected option (or the
//   first); arrows then walk the options, Home/End jump.
// - Enter picks the focused option (PressResponder), Space picks it too, and
//   Escape closes and returns focus to the trigger.
// - Pressing outside closes; the listener is document-level because the panel
//   must close even when the press lands on a sibling far away.
//
// The open list renders through a portal at document.body with position:
// fixed. react-native-web gives every View position:relative + zIndex:0, so
// each View is its own stacking context and a z-index inside the panel tree
// can never climb over a later sibling panel (the tag panel, the results).
// A body-level portal sidesteps every stacking context at once; the app's
// page does not scroll (the FlatList owns scrolling and the filter row sits
// above it), so the trigger's viewport coordinates stay stable while open,
// and a window resize simply closes the list.

export interface DropdownOption<V> {
  value: V;
  label: string;
}

interface DropdownProps<V> {
  /** Micro label above the control, e.g. "Minimum members". */
  label: string;
  /** Closed option set; convention is an "Any" (undefined) first option. */
  options: ReadonlyArray<DropdownOption<V>>;
  /** Currently selected value; should match one of the options. */
  value: V;
  /** Fires with the picked option's value. Apply-on-submit stays the screen's rule. */
  onSelect: (value: V) => void;
}

export default function Dropdown<V>({ label, options, value, onSelect }: DropdownProps<V>) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const listboxId = useId();
  const triggerId = `${listboxId}-trigger`;
  const labelId = `${listboxId}-label`;

  const [open, setOpen] = useState(false);
  // The keyboard-active option; focus follows it while the list is open.
  // Mouse hover gets no highlight on purpose: pressed and selected states
  // carry the feedback, and RN 0.88's Pressable types carry no mouse events.
  const [activeIndex, setActiveIndex] = useState(0);
  // Viewport coordinates of the trigger, captured when the list opens; the
  // portaled listbox anchors to them.
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[selectedIndex] ?? { value, label: String(value) };

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
      setAnchor({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const closeList = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) focusTrigger();
  };

  const select = (option: DropdownOption<V>) => {
    onSelect(option.value);
    closeList(true);
  };

  // Close on outside press. mousedown, not click: the panel should be gone
  // before the press lands on whatever sits underneath it. Also close on
  // window resize: the portaled panel is anchored to stale coordinates
  // otherwise.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const listbox = document.getElementById(listboxId);
      const trigger = document.getElementById(triggerId);
      const target = event.target;
      if (
        target instanceof Node &&
        !listbox?.contains(target) &&
        !trigger?.contains(target)
      ) {
        closeList(false);
      }
    };
    const onResize = () => closeList(false);
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open, listboxId, triggerId]);

  // Keyboard steering while open. Document-level: the keydown lands on
  // whichever element inside the control holds focus (trigger or an option),
  // and react-native-web's PressResponder has already consumed Enter/Space
  // for the element it sits on, so this handler owns navigation and Escape.
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
          focusOption((activeIndex + 1) % options.length);
          return;
        case 'ArrowUp':
          event.preventDefault();
          focusOption((activeIndex - 1 + options.length) % options.length);
          return;
        case 'Home':
          event.preventDefault();
          focusOption(0);
          return;
        case 'End':
          event.preventDefault();
          focusOption(options.length - 1);
          return;
        case ' ':
          // Space would scroll the page on role=option elements; we own the
          // key and make it pick. Only when an option holds focus: on the
          // trigger the PressResponder already treats Space as a toggle.
          if (insideListbox) {
            event.preventDefault();
            select(options[activeIndex]);
          }
          return;
        case 'Tab':
          // Let the browser move focus; the open list is stale after that.
          closeList(false);
          return;
        default:
          return;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, activeIndex, options, listboxId, triggerId]);

  // Arrow keys on the closed trigger open the list first. onKeyDown is a
  // react-native-web forwarded prop; the RN event type carries no `key`, so
  // it is read through the web KeyboardEvent the runtime actually delivers.
  const handleTriggerKeyDown = (
    event: Parameters<NonNullable<React.ComponentProps<typeof Pressable>['onKeyDown']>>[0],
  ) => {
    const key = (event as unknown as KeyboardEvent).key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openList();
    }
  };

  // The portaled listbox: fixed-positioned under the trigger, at the overlay
  // level so nothing in the app tree paints over it.
  const listbox = open && anchor ? (
    <View
      nativeID={listboxId}
      accessibilityRole="listbox"
      aria-labelledby={labelId}
      style={[
        styles.listbox,
        { top: anchor.top + theme.spacing[2], left: anchor.left, width: anchor.width },
      ]}
    >
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const isActive = index === activeIndex;
        return (
          <Pressable
            key={option.label}
            nativeID={`${listboxId}-opt-${index}`}
            accessibilityRole="option"
            aria-selected={isSelected}
            tabIndex={-1}
            accessibilityLabel={option.label}
            onPress={() => select(option)}
            onFocus={() => setActiveIndex(index)}
            style={({ pressed }) => [
              styles.option,
              isSelected && styles.optionSelected,
              isActive && !isSelected && styles.optionActive,
              pressed && styles.optionPressed,
            ]}
          >
            <View style={styles.optionDotSlot}>
              {isSelected ? <View style={styles.optionDot} /> : null}
            </View>
            <Text
              style={[styles.optionText, isSelected && styles.optionTextSelected]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  return (
    <View style={styles.wrap}>
      <Text nativeID={labelId} style={styles.label}>
        {label}
      </Text>
      <Pressable
        nativeID={triggerId}
        accessibilityRole="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        accessibilityLabel={`${label}: ${selectedOption.label}`}
        accessibilityHint="Opens a list of options. Arrow keys move, Enter picks."
        onPress={() => (open ? closeList(false) : openList())}
        onKeyDown={handleTriggerKeyDown}
        style={({ pressed }) => [
          styles.trigger,
          open && styles.triggerOpen,
          pressed && styles.triggerPressed,
        ]}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedOption.label}
        </Text>
        <View style={open ? styles.chevronUp : styles.chevronDown} aria-hidden />
      </Pressable>
      {listbox ? createPortal(listbox, document.body) : null}
    </View>
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    wrap: {
      gap: t.spacing[2],
      // The anchor for the absolutely positioned listbox.
      position: 'relative',
    },
    label: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    // The trigger reads as the same control family as the name input: input
    // chrome, 44px tall, no pill, value text left-aligned.
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing[3],
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[2],
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    triggerOpen: {
      borderColor: c.accent,
    },
    triggerPressed: {
      backgroundColor: c.panel,
    },
    triggerText: {
      flexShrink: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.medium,
      color: c.textPrimary,
    },
    // Chevron drawn with borders so it stays crisp at any zoom and never
    // pulls in an icon dependency. Flips when the list is open.
    chevronDown: {
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderBottomWidth: 6,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: c.textMuted,
    },
    chevronUp: {
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 6,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: c.textMuted,
    },
    // The portaled listbox. position:fixed is a react-native-web runtime
    // value; the RN 0.88 style types only know absolute/relative, hence the
    // cast. zIndex at the overlay level beats anything in the app tree.
    listbox: {
      position: 'fixed' as unknown as 'relative',
      zIndex: t.zIndex.overlay,
      maxHeight: 288,
      borderRadius: t.radius[2],
      borderWidth: 1,
      borderColor: c.panelBorderStrong,
      backgroundColor: c.panelRaised,
      overflow: 'scroll',
      paddingBottom: t.spacing[1],
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      minHeight: t.layout.touchTargetMin,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[2],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    optionSelected: {
      backgroundColor: c.accentSoft,
    },
    optionActive: {
      backgroundColor: c.panel,
    },
    optionPressed: {
      opacity: 0.7,
    },
    // Fixed dot slot so selected and unselected rows keep the same rhythm.
    optionDotSlot: {
      width: 8,
      alignItems: 'center',
    },
    optionDot: {
      width: 8,
      height: 8,
      borderRadius: 9999,
      backgroundColor: c.accent,
    },
    optionText: {
      flexShrink: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.regular,
      color: c.textPrimary,
    },
    optionTextSelected: {
      fontWeight: t.fontWeight.semibold,
    },
  });
}
