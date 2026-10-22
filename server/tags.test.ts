import { describe, expect, it } from 'vitest';
import { encodeTag, normalizeTag } from './tags';

describe('normalizeTag', () => {
  it('uppercases and adds the hash', () => {
    expect(normalizeTag('abc123')).toBe('#ABC123');
  });

  it('accepts an existing hash and trims spaces', () => {
    expect(normalizeTag('  #abC9  ')).toBe('#ABC9');
  });

  it('rejects empty and too-short input', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('#AB')).toBeNull();
  });

  it('rejects characters outside the tag alphabet', () => {
    expect(normalizeTag('#A B')).toBeNull();
    expect(normalizeTag('#ABC!')).toBeNull();
    expect(normalizeTag('#ABC-DEF')).toBeNull();
  });
});

describe('encodeTag', () => {
  it('encodes the hash for the upstream path', () => {
    expect(encodeTag('#ABC123')).toBe('%23ABC123');
  });
});
