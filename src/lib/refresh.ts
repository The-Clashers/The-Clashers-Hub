// The manual refresh rules (F-19 / FR-18, docs/concept/06-data-flow-and-
// caching section 2). Two rules live here because they are rules, not
// rendering: how long the control stays disabled after each use, and what
// the data-age hint says for the age the tier injected into a response.
// Pure module, no React (STD-09), so the cooldown and the hint wording are
// table-tested without rendering anything.

/** How long the refresh control stays disabled after each use. Pure
 * courtesy, not correctness: the tier's TTL cache alone already guards the
 * upstream, this only keeps a nervous demo-tapper from hammering the
 * button (06 section 2). */
export const REFRESH_COOLDOWN_MS = 60_000;

/** The same cooldown in whole seconds, derived so the two never disagree. */
export const REFRESH_COOLDOWN_SECONDS = REFRESH_COOLDOWN_MS / 1000;

/** Seconds of cooldown left, 0 once the control is ready again. Derived
 * from timestamps instead of a decremented counter: a hidden tab stalls
 * the ticking interval, and a value recomputed from the press timestamp
 * corrects itself on the next tick instead of drifting. */
export function cooldownRemainingSeconds(lastUsedAt: number, now: number): number {
  const elapsedMs = now - lastUsedAt;
  if (elapsedMs >= REFRESH_COOLDOWN_MS) return 0;
  // Clock skew (now before the press) reads as the full cooldown, never
  // more: the worst a skewed clock can do is keep the button honest about
  // the 60 s it promised.
  if (elapsedMs <= 0) return REFRESH_COOLDOWN_SECONDS;
  return Math.ceil((REFRESH_COOLDOWN_MS - elapsedMs) / 1000);
}

/** The hint for a response's age: "Cached, 12s ago" when the tier served
 * its cache (a positive age), "Fetched just now" when upstream answered
 * this very request. The injected age is the signal, so the screen never
 * pretends a cached answer is fresh (06 section 2, AC-09). */
export function dataAgeHint(ageSeconds: number): string {
  if (!Number.isFinite(ageSeconds) || ageSeconds <= 0) return 'Fetched just now';
  const minutes = Math.floor(ageSeconds / 60);
  const seconds = Math.floor(ageSeconds % 60);
  if (minutes === 0) return `Cached, ${seconds}s ago`;
  if (seconds === 0) return `Cached, ${minutes}m ago`;
  return `Cached, ${minutes}m ${seconds}s ago`;
}
