// The reference frame (the owner's ask, 11-19): which maximum a unit's
// reading is judged against. Two frames exist:
//
// - "latest": the unit's global maximum as the game API reports it (the
//   furthest Town Hall's cap, whatever the game ships today). This is the
//   reading every screen carried before the frame existed, and it stays
//   the default: the API's own number is always current, even when the
//   bundled cap tables lag a new Town Hall.
// - "townHall": the maximum at the player's own hall, read from the
//   bundled cap tables (lib/town-hall-caps.ts). This is the "maxed for my
//   Town Hall" reading the concept always intended for the progression
//   grid's chips (FR-16, SR-16): a global maximum cannot tell a TH14
//   player whether their lab is done for TH14.
//
// Pure TypeScript (STD-09): a unit plus the frame's inputs go in, the
// unit's maximum for that frame comes out. The rushed engine's adapter,
// the progression grid's adapter, and the hero card all resolve through
// this one function so the three surfaces can never disagree about which
// maximum a level pair names.
//
// The fallback rules, per frame:
//
// - latest: the unit's own maxLevel passes through untouched, null
//   included (the existing "the game API has not caught up to it yet"
//   treatment; the rushed engine additionally resolves nulls through the
//   reference tables, its own SR-17 concern).
// - townHall, home village: the cap table is the only voice. A unit the
//   tables have not met has no honest hall cap, so it reads null (the
//   surfaces footnote it, SR-14's shape) rather than borrowing the global
//   maximum, which would mix two yardsticks inside one verdict. A cap of
//   0 (the tables say the unit is not unlocked at that hall while the
//   payload carries it) reads null for the same reason: table drift, not
//   a verdict.
// - townHall, builder base: the builder tables cap at the player's own
//   Builder Hall when the payload carries one. A payload without the
//   level (0) cannot place its builder rows on the hall scale, so those
//   rows keep the global maximum: the honest fallback when the hall is
//   unknown, documented here so the mixed reading is a decision, not an
//   accident.

import { builderCapAtHall, homeCapAtTownHall } from './town-hall-caps';

/** Which maximum a reading is judged against. */
export type ReferenceFrame = 'latest' | 'townHall';

/** Everything a frame resolution needs beyond the unit itself: the frame
 * and the player's own hall levels off the single player response. */
export interface ReferenceFrameInput {
  frame: ReferenceFrame;
  /** The player's Town Hall level (0 when a malformed payload omits it;
   * the Town Hall frame then reads everything as unknown). */
  townHallLevel: number;
  /** The player's Builder Hall level, 0 when the payload carries none. */
  builderHallLevel: number;
}

/** The unit shape the resolver reads: the name (the cap tables' key), the
 * village marker, and the unit's own global maximum as the API reports
 * it. Every parsed unit type (troop, spell, hero, equipment) satisfies
 * it. */
export interface FrameUnit {
  name: string;
  village: string;
  maxLevel: number | null;
}

/** Builds the frame input from the pieces the player response carries.
 * One call site shape so the screen, the adapters, and the tests all
 * assemble the input the same way. */
export function referenceFrameInput(
  frame: ReferenceFrame,
  townHallLevel: number,
  builderHallLevel: number,
): ReferenceFrameInput {
  return { frame, townHallLevel, builderHallLevel };
}

/**
 * The maximum one unit's reading should name in the given frame, or null
 * when the frame has no honest answer for the unit (see the module
 * comment for the fallback rules). Pure: the unit is untouched.
 */
export function resolveFrameMax(unit: FrameUnit, input: ReferenceFrameInput): number | null {
  if (input.frame === 'latest') {
    return unit.maxLevel;
  }

  if (unit.village === 'builderBase') {
    // The builder rows need the player's Builder Hall; without it the
    // frame cannot place them on the hall scale and the global maximum
    // stays (an unknown hall is not hall 1).
    if (input.builderHallLevel < 1) return unit.maxLevel;
    const cap = builderCapAtHall(unit.name, input.builderHallLevel);
    return cap !== null && cap > 0 ? cap : null;
  }

  // The home village (and any village the cap tables do not carry, which
  // reads as not-met): the Town Hall cap table is the only voice.
  const cap = homeCapAtTownHall(unit.name, input.townHallLevel);
  return cap !== null && cap > 0 ? cap : null;
}
