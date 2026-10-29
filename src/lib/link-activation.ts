// Enter-key activation for Pressable elements that navigate (role=link).
//
// react-native-web's PressResponder deliberately does not call onPress for
// elements whose accessibilityRole is 'link': it assumes a link is a real
// anchor element where the browser synthesizes the click on Enter itself.
// Our links are Pressables (divs with a tabindex), not anchors, so without
// this handler nothing fires when a keyboard user presses Enter on a roster
// row or any other role=link Pressable. The same quirk is why the Dropdown
// adds its own onKeyDown for arrow keys: the responder only ever fully
// serves button-like roles.
//
// One rule, one module (STD-30): every role=link Pressable that should
// activate on Enter goes through here, so the why-comment and the RN Web
// version coupling live in exactly one place. Space is intentionally NOT
// an activation key: native anchors activate on Enter only, and Space
// stays free to scroll the page.
//
// The handler parameter is typed `unknown` because react-native-web types
// its onKeyDown events without a `key` field at all (the Dropdown's
// trigger reads it through a cast); the web KeyboardEvent the runtime
// actually delivers always carries one. A type guard reads the key back
// out safely, and the loose parameter keeps the handler assignable to any
// Pressable's onKeyDown prop without per-callsite casts.
//
// Pure: builds a handler from a callback, no React imports (STD-09), so
// the rule is unit-testable without rendering anything.

/** Reads the `key` off a keydown-ish event, tolerating the RN-typed ones
 * that carry no key at all. Anything unreadable counts as "not Enter". */
function keyOf(event: unknown): string | undefined {
  if (typeof event !== 'object' || event === null || !('key' in event)) {
    return undefined;
  }
  const value = (event as { key: unknown }).key;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Returns a keydown handler that fires {@link onPress} exactly once per
 * Enter press. Hand it straight to a Pressable's `onKeyDown` prop:
 *
 *   onPress={openMember}
 *   onKeyDown={linkEnterActivation(openMember)}
 *
 * The responder's own Enter handling is a no-op for role=link elements, so
 * there is no double activation to guard against.
 */
export function linkEnterActivation(onPress: () => void): (event: unknown) => void {
  return (event) => {
    if (keyOf(event) === 'Enter') {
      onPress();
    }
  };
}
