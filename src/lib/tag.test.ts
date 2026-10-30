import { describe, expect, it } from 'vitest';
import {
  canonicalTagFromRoute,
  clanRouteFor,
  normalizeTagInput,
  playerRouteFor,
  TAG_REJECT_COPY,
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

describe('canonicalTagFromRoute', () => {
  it('re-attaches the hash to the bare tag the shareable URL carries', () => {
    expect(canonicalTagFromRoute('JGYCPCUJ')).toBe('#JGYCPCUJ');
  });

  it('keeps the hash a legacy %23 link decoded to, so old links still resolve', () => {
    expect(canonicalTagFromRoute('#JGYCPCUJ')).toBe('#JGYCPCUJ');
  });

  it('uppercases and trims whatever shape the param arrives in', () => {
    expect(canonicalTagFromRoute(' jgycpcuj ')).toBe('#JGYCPCUJ');
  });
});

describe('playerRouteFor', () => {
  it('builds /player/<bare tag>, no hash and no %23 in the shareable URL', () => {
    expect(playerRouteFor('#JGYCPCUJ')).toBe('/player/JGYCPCUJ');
  });

  it('keeps the hash out of the path so the router never sees a fragment', () => {
    expect(playerRouteFor('#ABC')).not.toContain('#');
    expect(playerRouteFor('#ABC')).not.toContain('%23');
  });

  it('round-trips through canonicalTagFromRoute back to the canonical tag', () => {
    const tag = '#JGYCPCUJ';
    const bare = playerRouteFor(tag).split('/').pop() as string;
    expect(canonicalTagFromRoute(bare)).toBe(tag);
  });
});

describe('clanRouteFor', () => {
  it('builds /clan/<bare tag>, no hash and no %23 in the shareable URL', () => {
    expect(clanRouteFor('#2JPCYP98L')).toBe('/clan/2JPCYP98L');
  });

  it('keeps the hash out of the path so the router never sees a fragment', () => {
    expect(clanRouteFor('#ABC')).not.toContain('#');
    expect(clanRouteFor('#ABC')).not.toContain('%23');
  });

  it('round-trips through canonicalTagFromRoute back to the canonical tag', () => {
    const tag = '#2CJPGCLUC';
    const bare = clanRouteFor(tag).split('/').pop() as string;
    expect(canonicalTagFromRoute(bare)).toBe(tag);
  });
});

describe('TAG_REJECT_COPY', () => {
  it('words every rule-based reject reason (the empty prompt is per-box)', () => {
    // The keys mirror the normalizer's non-empty reasons; the empty case is
    // deliberately each box's own sentence, so it must NOT be in the table.
    expect(Object.keys(TAG_REJECT_COPY).sort()).toEqual(['bad_chars', 'too_long', 'too_short']);
    for (const sentence of Object.values(TAG_REJECT_COPY)) {
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence.endsWith('.')).toBe(true);
    }
  });
});
