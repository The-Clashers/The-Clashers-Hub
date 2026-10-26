// Tag input normalization for the browser side.
//
// SR-13 (docs/concept/02-requirements-tracker.md section 6.2) says: the tag
// box accepts a tag with or without the # prefix, normalizes it (uppercase,
// prepend #) in exactly one component, and routes to the tag's detail screen
// with the tag URL-encoded. The game API has no search by player name, so a
// player is reachable by tag only; a clan is reachable both ways, by name
// through the search bar and by tag through this box. This module is the
// "exactly one place" half: the pure normalization function the TagInput
// component calls, plus the route builders for both targets.
//
// The component owns the input field and the navigation; this module owns the
// rule. Splitting them keeps the rule unit-testable without rendering React,
// and keeps the navigation concern out of the rule (the rule does not care
// where the tag goes).
//
// The rule mirrors server/tags.ts so the client and the tier agree on what a
// "canonical tag" looks like: leading #, uppercase, 3 to 20 characters from
// the [0-9A-Z] alphabet. The tier normalizes again cheaply, so a stray
// lowercase still resolves upstream; the client normalization is what we
// display and what we put in the URL.

/**
 * The canonical tag shape: leading `#`, uppercase, 3 to 20 alphanumeric
 * characters. Mirrors {@link server/tags.ts} so the two halves never
 * disagree on what counts as a tag.
 */
const TAG_PATTERN = /^#[0-9A-Z]{3,20}$/;

/**
 * The outcome of normalizing user input. `ok` carries the canonical tag;
 * `invalid` carries a short reason the UI can surface next to the input.
 * The reason is a key, not a sentence, so the component owns the wording.
 */
export type NormalizeTagResult =
  | { ok: true; tag: string }
  | { ok: false; reason: 'empty' | 'too_short' | 'too_long' | 'bad_chars' };

/**
 * What the tag box looks up. Players and clans share the tag alphabet and the
 * normalization rule; only the route differs. The component owns the choice,
 * this type keeps the route builders honest.
 */
export type TagLookupTarget = 'player' | 'clan';

/**
 * Normalizes a raw tag the way SR-13 requires: trim, prepend `#` if the
 * user did not type one, uppercase the rest, and validate against the tag
 * alphabet. Returns the canonical tag on success, or a short reason on
 * failure. Never throws.
 *
 * The function is pure: same input always yields the same output, no I/O.
 * That is what makes it cheap to unit-test and safe to call from render.
 */
export function normalizeTagInput(raw: string): NormalizeTagResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const canonical = withHash.toUpperCase();
  if (canonical.length < 4) {
    // '#' plus fewer than 3 chars: below the minimum tag length.
    return { ok: false, reason: 'too_short' };
  }
  if (canonical.length > 21) {
    // '#' plus more than 20 chars: above the maximum tag length.
    return { ok: false, reason: 'too_long' };
  }
  if (!TAG_PATTERN.test(canonical)) {
    return { ok: false, reason: 'bad_chars' };
  }
  return { ok: true, tag: canonical };
}

/**
 * URL-encodes a canonical tag for a path segment of /player/:tag or
 * /clan/:tag. The `#` becomes `%23` so the router sees one segment, not a
 * fragment. This is the only place the encoding happens on the client; the
 * router and the TagInput both go through it, never scattering
 * encodeURIComponent calls.
 */
export function encodeTagForRoute(tag: string): string {
  return encodeURIComponent(tag);
}

/**
 * Builds the player route for a canonical tag. Kept here so every caller
 * builds the URL the same way: /player/<encoded tag>. The router reads
 * :tag and useParams decodes it back, so the player screen receives the
 * canonical `#ABC123` form.
 */
export function playerRouteFor(tag: string): string {
  return `/player/${encodeTagForRoute(tag)}`;
}

/**
 * Builds the clan route for a canonical tag, the same contract
 * {@link playerRouteFor} gives the player target: /clan/<encoded tag>. The
 * search result cards link through this too, so the clan URL is assembled
 * in exactly one place, the same way the player URL is.
 */
export function clanRouteFor(tag: string): string {
  return `/clan/${encodeTagForRoute(tag)}`;
}

/**
 * The one route builder the tag box calls: maps the selected target to its
 * route. Both branches go through {@link encodeTagForRoute}, so the `#` is
 * always encoded no matter which screen the tag opens.
 */
export function lookupRouteFor(target: TagLookupTarget, tag: string): string {
  return target === 'player' ? playerRouteFor(tag) : clanRouteFor(tag);
}
