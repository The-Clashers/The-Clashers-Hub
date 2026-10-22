// The upstream client: the one place that knows how to call the game API
// through the proxy. Owns the Authorization header, the per-attempt timeout,
// and the 429 retry-with-backoff policy (docs/concept/04-api-strategy
// section 6: a 429 is a first-class state, not a crash).

import { upstreamConfig } from './env';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface UpstreamResponse {
  status: number;
  body: string;
}

export class UpstreamBusyError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`upstream busy, retry after ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class UpstreamUnreachableError extends Error {
  constructor(cause?: unknown) {
    super('upstream unreachable', { cause });
  }
}

export interface UpstreamOptions {
  /** Injectable for tests. */
  fetchImpl?: FetchLike;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Waits between 429 retries. */
  backoffMs?: number[];
  /** Total attempts including the first one. */
  maxAttempts?: number;
}

const DEFAULT_TIMEOUT_MS = 4_000;
// Quick fixed backoffs between 429 retries: the tier retries opportunistically
// and keeps well inside the function time budget. A Retry-After header is
// surfaced to the client (retryAfter on the 503), never waited out here.
const DEFAULT_BACKOFF_MS = [500, 1_500];
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_S = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterFrom(headerValue: string | null): number | null {
  if (headerValue === null) return null;
  const seconds = Number.parseInt(headerValue, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds, MAX_RETRY_AFTER_S);
}

export async function fetchUpstream(path: string, options: UpstreamOptions = {}): Promise<UpstreamResponse> {
  const { token, baseUrl } = upstreamConfig();
  const doFetch: FetchLike = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  let retryAfterSeconds: number | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (cause) {
      // Network failure or our own timeout: same client-facing outcome.
      throw new UpstreamUnreachableError(cause);
    } finally {
      clearTimeout(timer);
    }

    if (response.status !== 429) {
      return { status: response.status, body: await response.text() };
    }

    retryAfterSeconds = retryAfterFrom(response.headers.get('retry-after')) ?? retryAfterSeconds;
    if (attempt === maxAttempts) break;

    const waitMs = backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 500;
    await sleep(waitMs);
  }

  throw new UpstreamBusyError(retryAfterSeconds ?? MAX_RETRY_AFTER_S);
}
