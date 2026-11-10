import { describe, expect, it } from 'vitest';
import {
  REFRESH_COOLDOWN_MS,
  REFRESH_COOLDOWN_SECONDS,
  cooldownRemainingSeconds,
  dataAgeHint,
} from './refresh';

// The cooldown the concept doc names (06 section 2): the number is the
// rule, not a tuning knob, so the test pins it.
describe('REFRESH_COOLDOWN_MS', () => {
  it('is the 60 s courtesy cooldown the concept doc specifies', () => {
    expect(REFRESH_COOLDOWN_MS).toBe(60_000);
    expect(REFRESH_COOLDOWN_SECONDS).toBe(60);
  });
});

describe('cooldownRemainingSeconds', () => {
  const pressedAt = 1_000_000;

  it.each([
    // The instant of the press reads as the full cooldown, so the label
    // never flashes an un-counted number; from there it counts whole
    // seconds, never fractions.
    ['the press itself', 0, 60],
    ['half a second in', 500, 60],
    ['one second and a millisecond in', 1_001, 59],
    ['half the cooldown in', 30_000, 30],
    ['one second before the end', 59_000, 1],
  ])('leaves %s when %s ms elapsed', (_label, elapsedMs, expected) => {
    expect(cooldownRemainingSeconds(pressedAt, pressedAt + elapsedMs)).toBe(expected);
  });

  it.each([
    ['exactly at the cooldown end', REFRESH_COOLDOWN_MS],
    ['after the cooldown', REFRESH_COOLDOWN_MS + 5_000],
  ])('is ready again %s', (_label, elapsedMs) => {
    expect(cooldownRemainingSeconds(pressedAt, pressedAt + elapsedMs)).toBe(0);
  });

  it('counts down whole seconds, never fractions', () => {
    // 59.999 s elapsed leaves a hair over 0.001 s: that is still 1 second
    // of cooldown to a visitor, and 0 only once the full 60 s passed.
    expect(cooldownRemainingSeconds(pressedAt, pressedAt + 59_999)).toBe(1);
    expect(cooldownRemainingSeconds(pressedAt, pressedAt + 60_001)).toBe(0);
  });

  it('clamps clock skew to the full cooldown, never beyond it', () => {
    // now before the press (a skewed clock) must not invent extra cooldown.
    expect(cooldownRemainingSeconds(pressedAt, pressedAt - 30_000)).toBe(REFRESH_COOLDOWN_SECONDS);
  });
});

describe('dataAgeHint', () => {
  it.each([
    ['a fresh answer', 0, 'Fetched just now'],
    ['a negative age (clock skew)', -5, 'Fetched just now'],
    ['a non-finite age', Number.NaN, 'Fetched just now'],
    ['one second of cache age', 1, 'Cached, 1s ago'],
    ['the last second before a minute', 59, 'Cached, 59s ago'],
    ['an exact minute', 60, 'Cached, 1m ago'],
    ['a minute and change', 75, 'Cached, 1m 15s ago'],
    ['a long warlog TTL worth of age', 600, 'Cached, 10m ago'],
  ])('reads %s as "%s"', (_label, ageSeconds, expected) => {
    expect(dataAgeHint(ageSeconds)).toBe(expected);
  });
});
