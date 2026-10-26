import { describe, expect, it } from 'vitest';
import {
  clanRouteFor,
  encodeTagForRoute,
  lookupRouteFor,
  normalizeTagInput,
  playerRouteFor,
  type NormalizeTagResult,
} from './tag';

describe('normalizeTagInput', () => {
  it('uppercases and adds the hash when the user omits it', () => {
    expect(normalizeTagInput('abc123')).toEqual({ ok: true, tag: '#ABC123' });
  });

  it('accepts an existing hash and trims surrounding whitespace', () => {
    expect(normalizeTagInput('  #abC9  ')).toEqual({ ok: true, tag: '#ABC9' });
  });

  it('rejects empty and whitespace-only input', () => {
    expect(normalizeTagInput('')).toEqual<NormalizeTagResult>({ ok: false, reason: 'empty' });
    expect(normalizeTagInput('   ')).toEqual<NormalizeTagResult>({ ok: false, reason: 'empty' });
  });

  it('rejects tags shorter than three characters after the hash', () => {
    expect(normalizeTagInput('#AB')).toEqual<NormalizeTagResult>({ ok: false, reason: 'too_short' });
    expect(normalizeTagInput('AB')).toEqual<NormalizeTagResult>({ ok: false, reason: 'too_short' });
  });

  it('rejects tags longer than twenty characters after the hash', () => {
    const long = 'A'.repeat(21);
    expect(normalizeTagInput(long)).toEqual<NormalizeTagResult>({ ok: false, reason: 'too_long' });
  });

  it('rejects characters outside the tag alphabet', () => {
    expect(normalizeTagInput('#A B')).toEqual<NormalizeTagResult>({ ok: false, reason: 'bad_chars' });
    expect(normalizeTagInput('#ABC!')).toEqual<NormalizeTagResult>({ ok: false, reason: 'bad_chars' });
    expect(normalizeTagInput('#ABC-DEF')).toEqual<NormalizeTagResult>({ ok: false, reason: 'bad_chars' });
  });

  it('accepts the boundary lengths (3 and 20 chars after the hash)', () => {
    expect(normalizeTagInput('#ABC')).toEqual({ ok: true, tag: '#ABC' });
    expect(normalizeTagInput('#' + 'A'.repeat(20))).toEqual({
      ok: true,
      tag: '#' + 'A'.repeat(20),
    });
  });

  it('is pure: same input always yields the same output', () => {
    const first = normalizeTagInput('jgycpcuj');
    const second = normalizeTagInput('jgycpcuj');
    expect(first).toEqual(second);
  });
});

describe('encodeTagForRoute', () => {
  it('encodes the hash so the router sees one path segment', () => {
    expect(encodeTagForRoute('#ABC123')).toBe('%23ABC123');
  });

  it('round-trips through decodeURIComponent back to the canonical tag', () => {
    const tag = '#JGYCPCUJ';
    expect(decodeURIComponent(encodeTagForRoute(tag))).toBe(tag);
  });
});

describe('playerRouteFor', () => {
  it('builds /player/<encoded tag> with the hash encoded', () => {
    expect(playerRouteFor('#JGYCPCUJ')).toBe('/player/%23JGYCPCUJ');
  });

  it('keeps the hash out of the path so the router never sees a fragment', () => {
    expect(playerRouteFor('#ABC')).not.toContain('#');
  });
});

describe('clanRouteFor', () => {
  it('builds /clan/<encoded tag> with the hash encoded', () => {
    expect(clanRouteFor('#2CJPGCLUC')).toBe('/clan/%232CJPGCLUC');
  });

  it('keeps the hash out of the path so the router never sees a fragment', () => {
    expect(clanRouteFor('#ABC')).not.toContain('#');
  });
});

describe('lookupRouteFor', () => {
  it('routes the player target to the player screen', () => {
    expect(lookupRouteFor('player', '#ABC123')).toBe('/player/%23ABC123');
  });

  it('routes the clan target to the clan screen', () => {
    expect(lookupRouteFor('clan', '#ABC123')).toBe('/clan/%23ABC123');
  });

  it('agrees with the single-purpose builders for both targets', () => {
    expect(lookupRouteFor('player', '#JGYCPCUJ')).toBe(playerRouteFor('#JGYCPCUJ'));
    expect(lookupRouteFor('clan', '#2CJPGCLUC')).toBe(clanRouteFor('#2CJPGCLUC'));
  });
});
