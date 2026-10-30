// Tag input normalization for the browser side.
//
// SR-13 (docs/concept/02-requirements-tracker.md section 6.2) says: the tag
// rule lives in exactly one place, this module. The player box accepts a tag
// with or without the # prefix, normalizes it (uppercase, prepend #), and
// routes to /player/:tag. The game API has no search by player name, so a
// tag is the only way to reach a player directly; clans are the flexible
// ones, and the clan search bar takes a name OR a #tag, using the same rule
// here and the same clan route builder when the input is a tag.
//
// Shareable URLs carry the BARE tag (no `#`, no `%23`) so a pasted link
// reads clean in a chat: /player/ABC123, /clan/2JPCYP98L. The `#` still
// exists, but only inside this module: it is re-attached to a route param
// by {@link canonicalTagFromRoute} and encoded to `%23` only on the tier
// request path (api clients), never in the browser's address bar. A legacy
// %23 link still resolves, because the router decodes it back to `#ABC`
// before the canonicalizer sees it.
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
// display and what the tier request is built from.

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
 * Strips the `#` and uppercases, producing the bare-tag form the shareable
 * URL carries: `#ABC123` -> `ABC123`. Tags are [0-9A-Z] after the strip, so
 * the result needs no percent-encoding; this is the only place the bare
 * form is derived, the same way the canonical form is derived only by
 * {@link normalizeTagInput} and {@link canonicalTagFromRoute}.
 */
function bareTagForRoute(tag: string): string {
  const withoutHash = tag.startsWith('#') ? tag.slice(1) : tag;
  return withoutHash.toUpperCase();
}

/**
 * Canonicalizes a route param back to the `#TAG` form: uppercase, prepend
 * `#` when the URL carried the bare tag (the shareable form), keep it when
 * a legacy `%23` link decoded to `#TAG` already. Tolerant on purpose: the
 * shareable URL is human-typed, and old links must keep resolving. Screens
 * read `useParams().tag` through this so the fetch, the cache key, and the
 * on-screen tag all agree on the canonical form in exactly one place.
 */
export function canonicalTagFromRoute(raw: string): string {
  const trimmed = raw.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return withHash.toUpperCase();
}

/**
 * Builds the player route for a canonical tag. Kept here so every caller
 * builds the URL the same way: /player/<bare tag>, the form that reads
 * clean when a link is pasted in a chat. The router reads :tag and the
 * screen canonicalizes it back through {@link canonicalTagFromRoute}, so
 * the player screen receives the canonical `#ABC123` form again.
 */
export function playerRouteFor(tag: string): string {
  return `/player/${bareTagForRoute(tag)}`;
}

/**
 * Builds the clan route for a canonical tag, the same contract
 * {@link playerRouteFor} gives the player target: /clan/<bare tag>. Two
 * callers share it so the clan URL is assembled in exactly one place, the
 * same way the player URL is: the search result cards, and the clan search
 * bar when its input is a #tag instead of a name.
 */
export function clanRouteFor(tag: string): string {
  return `/clan/${bareTagForRoute(tag)}`;
}
