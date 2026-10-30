// Table-driven tests for the client's busy retry rule (lib/busy-retry.ts).
// The rule is pure timing policy, so every case is a row: inputs in,
// decision out, no rendering, no timers.

import { describe, expect, it } from 'vitest';
import {
  BUSY_RETRY_ATTEMPTS,
  busyRetryDelayMs,
  shouldRetryBusy,
} from './busy-retry';

describe('shouldRetryBusy', () => {
  it('allows exactly BUSY_RETRY_ATTEMPTS retries, zero-based like TanStack Query', () => {
    expect(BUSY_RETRY_ATTEMPTS).toBe(3);
    expect(shouldRetryBusy(0)).toBe(true);
    expect(shouldRetryBusy(1)).toBe(true);
    expect(shouldRetryBusy(2)).toBe(true);
    expect(shouldRetryBusy(3)).toBe(false);
    expect(shouldRetryBusy(4)).toBe(false);
  });

  it('treats a negative count as retryable rather than rejecting it', () => {
    expect(shouldRetryBusy(-1)).toBe(true);
  });
});

describe('busyRetryDelayMs', () => {
  // retryAfter | failureCount | expected delay | why
  const cases: ReadonlyArray<[number, number, number, string]> = [
    [30, 0, 5_000, 'first wait starts at the base'],
    [30, 1, 10_000, 'second wait doubles'],
    [30, 2, 20_000, 'third wait reaches the cap'],
    [30, 3, 20_000, 'beyond the ladder the cap holds'],
    [30, 9, 20_000, 'a huge count never overflows the cap'],
    [2, 0, 2_000, 'a shorter server retryAfter wins over the base'],
    [2, 1, 2_000, 'the server value keeps winning while it is shorter'],
    [7, 0, 5_000, 'a longer server value is not waited out on the first rung'],
    [7, 2, 7_000, 'once the ladder passes it, the server value is the wait'],
    [0, 0, 5_000, 'a zero retryAfter carries no information, ladder applies'],
    [-5, 1, 10_000, 'a junk negative retryAfter falls back to the ladder'],
    [1, 2, 1_000, 'even a 1 s server value is honored on the last rung'],
  ];

  it.each(cases)(
    'retryAfter %ss after %d failures waits %dms (%s)',
    (retryAfter, failureCount, expected) => {
      expect(busyRetryDelayMs(retryAfter, failureCount)).toBe(expected);
    },
  );
});
