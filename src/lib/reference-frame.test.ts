import { describe, expect, it } from 'vitest';
import {
  referenceFrameInput,
  resolveFrameMax,
  type FrameUnit,
} from './reference-frame';

// Table-driven tests for the reference frame (the owner's ask, 11-19).
// The frame resolution is the one place that decides which maximum a
// level pair names, so the rules it owns are locked here per village and
// per frame: the latest frame passes the API's own maximum through, the
// Town Hall frame reads the cap tables at the player's own halls, and the
// builder rows keep the global maximum when the payload carries no Builder
// Hall. Cap values quoted below come from lib/town-hall-caps.ts (the
// November 2026 bundle: TH18 / BH10).

const unit = (name: string, maxLevel: number | null, village = 'home'): FrameUnit => ({
  name,
  village,
  maxLevel,
});

describe('resolveFrameMax (latest frame)', () => {
  const input = referenceFrameInput('latest', 14, 9);

  it('passes the API maximum through, numbers and nulls alike', () => {
    // The latest frame is the reading every screen carried before frames
    // existed: the API's own number, untouched, including its nulls (the
    // "the game API has not caught up" treatment).
    expect(resolveFrameMax(unit('Barbarian', 14), input)).toBe(14);
    expect(resolveFrameMax(unit('Barbarian King', 110), input)).toBe(110);
    expect(resolveFrameMax(unit('Minion Prince', null), input)).toBeNull();
  });

  it('ignores the hall levels entirely', () => {
    // A TH1/BH1 input must not change the latest reading: the frame is a
    // lens choice, not data.
    const th1 = referenceFrameInput('latest', 1, 1);
    expect(resolveFrameMax(unit('Barbarian', 14), th1)).toBe(14);
  });
});

describe('resolveFrameMax (townHall frame, home village)', () => {
  const input = referenceFrameInput('townHall', 14, 9);

  it('reads the cap table at the player own Town Hall', () => {
    // TH14 caps from the bundle: Barbarian 10, Barbarian King 85, Rage
    // Spell 6, Spiky Ball 21.
    expect(resolveFrameMax(unit('Barbarian', 14), input)).toBe(10);
    expect(resolveFrameMax(unit('Barbarian King', 110), input)).toBe(85);
    expect(resolveFrameMax(unit('Rage Spell', 8), input)).toBe(6);
    expect(resolveFrameMax(unit('Spiky Ball', 27), input)).toBe(21);
  });

  it('ignores the API maximum the payload carries', () => {
    // The cap table is the only voice in this frame: a payload claiming a
    // different global maximum (the game shipped a newer TH than the
    // bundle) must not leak into the hall reading.
    expect(resolveFrameMax(unit('Barbarian', 999), input)).toBe(10);
  });

  it('reads null for a unit the tables have not met', () => {
    expect(resolveFrameMax(unit('Brand New Troop', 5), input)).toBeNull();
  });

  it('reads null for a unit not unlocked at that hall (cap 0)', () => {
    // Dragon Rider first exists at TH12; at TH11 the table says 0, which
    // is table drift against a payload that carries the unit, not a
    // verdict. Null hands it to the surfaces skip-and-footnote path.
    const th11 = referenceFrameInput('townHall', 11, 9);
    expect(resolveFrameMax(unit('Dragon Rider', 6), th11)).toBeNull();
  });

  it('clamps halls beyond the table to the last column', () => {
    // The cap module own rule (a TH19 payload reads the TH18 caps until
    // the bundle updates); the frame inherits it through the shared
    // lookup surface.
    const th19 = referenceFrameInput('townHall', 19, 9);
    expect(resolveFrameMax(unit('Barbarian', 14), th19)).toBe(13);
  });
});

describe('resolveFrameMax (townHall frame, builder base)', () => {
  it('reads the builder table at the player own Builder Hall', () => {
    const input = referenceFrameInput('townHall', 14, 9);
    // BH9 caps from the bundle: Raged Barbarian 18, Battle Machine 30.
    expect(resolveFrameMax(unit('Raged Barbarian', 20, 'builderBase'), input)).toBe(18);
    expect(resolveFrameMax(unit('Battle Machine', 35, 'builderBase'), input)).toBe(30);
  });

  it('keeps the global maximum when the payload carries no Builder Hall', () => {
    // builderHallLevel 0 means unknown, not hall 1: the frame cannot place
    // the row on the hall scale, so the global maximum stays rather than a
    // fabricated BH1 cap (every builder unit reads 0 there).
    const input = referenceFrameInput('townHall', 14, 0);
    expect(resolveFrameMax(unit('Raged Barbarian', 20, 'builderBase'), input)).toBe(20);
  });

  it('reads null for a builder unit the tables have not met', () => {
    const input = referenceFrameInput('townHall', 14, 9);
    expect(resolveFrameMax(unit('Brand New Builder', 20, 'builderBase'), input)).toBeNull();
  });
});

describe('referenceFrameInput', () => {
  it('carries the frame and both hall levels', () => {
    expect(referenceFrameInput('townHall', 14, 9)).toEqual({
      frame: 'townHall',
      townHallLevel: 14,
      builderHallLevel: 9,
    });
  });
});
