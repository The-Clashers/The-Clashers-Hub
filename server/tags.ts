// Tag handling for the tier. The client owns normalization of user input (one
// component, per the concept docs); the tier normalizes again, cheaply, so a
// pasted 'ABC' still resolves. Encoding for the upstream path happens in
// exactly one place: encodeTag.

const TAG_PATTERN = /^#[0-9A-Z]{3,20}$/;

export function normalizeTag(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const normalized = withHash.toUpperCase();
  return TAG_PATTERN.test(normalized) ? normalized : null;
}

export function encodeTag(tag: string): string {
  return encodeURIComponent(tag);
}
