// Tag input normalization for the browser side.
//
// SR-13 (docs/concept/02-requirements-tracker.md section 6.2) says: the tag
// rule lives in exactly one place, this module. The player box accepts a tag
// with or without the # prefix, normalizes it (uppercase, prepend #), and
// routes to /player/:tag with the tag URL-encoded. The game API has no
// search by player name, so a tag is the only way to reach a player
// directly; clans are the flexible ones, and the clan search bar takes a
// name OR a #tag, using the same rule here and the same clan route builder
// when the input is a tag.
//
// The components own their inputs and the navigation; this module owns the
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
 * The reason is a key, not a sentence; the shared sentences for the
 * rule-based reasons live in {@link TAG_REJECT_COPY}.
 */
export type NormalizeTagResult =
  | { ok: true; tag: string }
  | { ok: false; reason: 'empty' | 'too_short' | 'too_long' | 'bad_chars' };

/**
 * The reject reasons that describe the rule itself (length, alphabet), as
 * opposed to `empty`, which only says the box was submitted blank. These
 * are shared by every surface that takes a tag: the player box and the
 * clan search bar's `#tag` branch, so the same broken input gets the same
 * words wherever it was typed.
 */
export type TagRejectReason = Exclude<Exclude<NormalizeTagResult, { ok: true }>['reason'], 'empty'>;

/**
 * User-facing sentences for {@link TagRejectReason}. The `empty` case is
 * deliberately absent: only the box knows what else it accepts (the clan
 * bar also takes names), so each box words its own empty prompt and falls
 * back to this table for everything else.
 */
export const TAG_REJECT_COPY: Record<TagRejectReason, string> = {
  too_short: 'Tags are at least three characters.',
  too_long: 'Tags are at most twenty characters.',
  bad_chars: 'Tags use letters and numbers only.',
};

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
 * {@link playerRouteFor} gives the player target: /clan/<encoded tag>. Two
 * callers share it so the clan URL is assembled in exactly one place, the
 * same way the player URL is: the search result cards, and the clan search
 * bar when its input is a #tag instead of a name.
 */
export function clanRouteFor(tag: string): string {
  return `/clan/${encodeTagForRoute(tag)}`;
}
