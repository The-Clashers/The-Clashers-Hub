// The client half of the busy contract (docs/concept/04-api-strategy
// section 6, docs/concept/06-data-flow-and-caching section 3).
//
// When the tier answers 503 upstream_busy it has already retried the
// throttle itself (two quick upstream attempts), so the client must not
// hammer it back. The state matrix wants the busy outcome to degrade to an
// auto-retry with backoff plus a "one moment" note, not an error screen:
// a class demo hitting a cold cache at the worst moment should read
// "one moment", never red.
//
// The pacing rule: wait the server's retryAfter when it is the shorter
// side, otherwise poll on an exponential backoff that stays responsive for
// a live demo (5 s, 10 s, 20 s) instead of honoring a full 30 s wait. Each
// client retry costs the tier one bounded upstream burst, and three
// attempts spread over about half a minute keep the pressure near zero
// while giving a throttled key every chance to clear on its own.
//
// Pure module, no React imports (STD-09): the screens wire it into their
// TanStack Query retry options, the tests drive it as a table.

/** How many times a busy outcome is retried automatically before the
 * screen gives up and renders the busy error state with a manual retry. */
export const BUSY_RETRY_ATTEMPTS = 3;

// The backoff ladder between automatic busy retries: 5 s, 10 s, 20 s,
// then flat. Short enough that a demo recovers inside a minute, long
// enough that a throttled key is not polled tight.
const BUSY_RETRY_BASE_DELAY_MS = 5_000;

// The ceiling on a single wait, so a large retryAfter never parks the
// screen for half the demo.
const BUSY_RETRY_MAX_DELAY_MS = 20_000;

/**
 * Whether a busy outcome should be retried automatically. TanStack Query
 * hands the retry callback a zero-based failureCount (0 on the first
 * failure), so this allows exactly {@link BUSY_RETRY_ATTEMPTS} retries
 * before the busy error state takes over.
 */
export function shouldRetryBusy(failureCount: number): boolean {
  return failureCount < BUSY_RETRY_ATTEMPTS;
}

/**
 * The delay before the next automatic busy retry, in ms. The ladder
 * doubles from the base and caps at the max; a shorter server retryAfter
 * always wins, because when the tier says "2 s" the client must not be
 * the one polling early. A retryAfter of zero or below carries no
 * information (the tier always sends a positive value) and falls back to
 * the ladder.
 */
export function busyRetryDelayMs(retryAfterSeconds: number, failureCount: number): number {
  const rung = Math.min(
    BUSY_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, failureCount),
    BUSY_RETRY_MAX_DELAY_MS,
  );
  const fromServer = Math.max(0, retryAfterSeconds) * 1_000;
  if (fromServer === 0) return rung;
  return Math.min(fromServer, rung);
}
