// Typed client for the GitHub contributors list.
//
// The Contributors page (the owner's nav) credits the people who built the
// repo. GitHub's public REST endpoint serves that list without auth from
// the browser; our tier only proxies the game API, so this client fetches
// api.github.com directly. It is the app's one cross-origin call and it
// carries no secret (the repo is public), which keeps the key boundary
// untouched (01 tech stack: COC_API_TOKEN stays server-side, and this
// token is nobody's).
//
// Rate limiting is the real failure mode (60 requests/hour per IP
// unauthenticated), so the error union carries a distinct `rate_limited`
// kind and the screen's copy says what happened instead of a generic
// retry dead end.

/** One contributor row. */
export interface Contributor {
  /** The GitHub login. */
  login: string;
  /** Avatar URL; GitHub serves these from avatars.githubusercontent.com. */
  avatarUrl: string;
  /** Profile URL, opened in a new tab. */
  profileUrl: string;
  /** Total commits currently attributed to this contributor. */
  contributions: number;
}

/** Discriminated union for every outcome the endpoint can hand us. */
export type ContributorsResult =
  | { kind: 'ok'; contributors: Contributor[] }
  | { kind: 'rate_limited'; retryAfterSeconds?: number }
  | { kind: 'unreachable' }
  | { kind: 'bad_request'; detail: string };

/** Thrown for every non-ok response so TanStack Query sees one failure path. */
export class ContributorsFetchError extends Error {
  readonly result: Exclude<ContributorsResult, { kind: 'ok' }>;
  constructor(result: Exclude<ContributorsResult, { kind: 'ok' }>) {
    super(`contributors fetch failed: ${result.kind}`);
    this.name = 'ContributorsFetchError';
    this.result = result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toContributor(parsed: unknown): Contributor | null {
  if (!isRecord(parsed)) return null;
  const login = typeof parsed.login === 'string' ? parsed.login : '';
  if (login === '') return null;
  const contributions = typeof parsed.contributions === 'number' ? parsed.contributions : 0;
  const avatarUrl = typeof parsed.avatar_url === 'string' ? parsed.avatar_url : '';
  const profileUrl =
    typeof parsed.html_url === 'string' ? parsed.html_url : `https://github.com/${login}`;
  return { login, avatarUrl, profileUrl, contributions };
}

/** The repo the page credits; one constant, no scatter. */
export const CONTRIBUTORS_REPO_URL = 'https://github.com/The-Clashers/The-Clashers-Hub';

const CONTRIBUTORS_ENDPOINT =
  'https://api.github.com/repos/The-Clashers/The-Clashers-Hub/contributors?per_page=100';

/**
 * Fetches the repo's contributor list from GitHub's public API and returns
 * the parsed rows or throws {@link ContributorsFetchError}. An empty list
 * is a real answer (a repo with only bot commits), not an error.
 */
export async function fetchContributors(
  init: { fetchImpl?: typeof fetch } = {},
): Promise<Contributor[]> {
  const doFetch = init.fetchImpl ?? fetch;
  const response = await doFetch(CONTRIBUTORS_ENDPOINT, {
    method: 'GET',
    headers: { accept: 'application/vnd.github+json' },
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      const retryAfterHeader = response.headers?.get?.('x-ratelimit-reset');
      const retryAfterSeconds = retryAfterHeader
        ? Math.max(0, Number.parseInt(retryAfterHeader, 10) - Math.floor(Date.now() / 1000))
        : undefined;
      throw new ContributorsFetchError({
        kind: 'rate_limited',
        retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
      });
    }
    if (response.status === 404) {
      throw new ContributorsFetchError({ kind: 'bad_request', detail: 'repository not found' });
    }
    throw new ContributorsFetchError({ kind: 'unreachable' });
  }
  if (!Array.isArray(parsed)) {
    throw new ContributorsFetchError({ kind: 'bad_request', detail: 'response was not a list' });
  }
  return parsed
    .map(toContributor)
    .filter((entry): entry is Contributor => entry !== null);
}
