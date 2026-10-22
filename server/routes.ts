// The five read routes (docs/concept/04-api-strategy section 5). Each
// handler: validate input, check the TTL cache, maybe call upstream through
// the proxy, map the outcome to the error contract, and answer with the
// data's age. Handlers are web-standard Request -> Response functions, so
// the same code runs on the function platform and in the local dev server.

import { TtlCache } from './cache';
import { fetchUpstream, UpstreamBusyError, UpstreamUnreachableError } from './upstream';
import { encodeTag, normalizeTag } from './tags';
import * as contract from './contract';

export type RouteHandler = (request: Request) => Promise<Response>;

// Route TTLs in ms, mirroring the client staleTime values so the two cache
// layers decay together (docs/concept/06-data-flow-and-caching section 2).
const TTL = {
  search: 60_000,
  clan: 180_000,
  player: 300_000,
  war: 120_000,
  warlog: 600_000,
} as const;

// 404 answers cache briefly so a nonexistent tag is not hammered by retries
// (docs/concept/06-data-flow-and-caching section 2).
const NEGATIVE_TTL_MS = 30_000;

const PRIVATE_WARLOG_BODY = JSON.stringify({ private: true });

type Outcome =
  | { kind: 'data'; body: string }
  | { kind: 'private' }
  | { kind: 'notFound' }
  | { kind: 'busy'; retryAfterSeconds: number }
  | { kind: 'unreachable' }
  | { kind: 'badRequest'; detail: string };

type Classifier = (status: number, body: string) => Outcome;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function upstreamReason(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (isRecord(parsed) && typeof parsed.reason === 'string') {
      return parsed.reason;
    }
  } catch {
    // fall through to the generic detail
  }
  return 'upstream rejected the request';
}

/** Default upstream mapping per the error contract. */
export function classifyUpstream(status: number, body: string): Outcome {
  if (status === 200) return { kind: 'data', body };
  if (status === 404) return { kind: 'notFound' };
  if (status === 400) return { kind: 'badRequest', detail: upstreamReason(body) };
  return { kind: 'unreachable' };
}

/** Warlog mapping: a 403 there is the private state, a state, not an error.
 * The live API answers a private log with reason accessDenied (verified
 * tag-dependent on the real endpoint); privateWarLog is accepted too in case
 * the reason string is ever made explicit. Any other 403 reason stays an
 * upstream failure. */
export function classifyWarlog(status: number, body: string): Outcome {
  if (status === 403) {
    const reason = upstreamReason(body);
    return reason === 'accessDenied' || reason === 'privateWarLog' ? { kind: 'private' } : { kind: 'unreachable' };
  }
  return classifyUpstream(status, body);
}

/** Injects the age field (seconds since the upstream fetch) into a success body. */
export function withAge(body: string, storedAt: number, now: number = Date.now()): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (isRecord(parsed)) {
      parsed.age = Math.max(0, Math.floor((now - storedAt) / 1_000));
      return JSON.stringify(parsed);
    }
  } catch {
    // Not a JSON object: serve the body verbatim rather than failing.
  }
  return body;
}

// ---------- search input ----------

export interface SearchQuery {
  cacheKey: string;
  upstreamPath: string;
}

const WAR_FREQUENCIES = new Set([
  'always',
  'moreThanOncePerWeek',
  'oncePerWeek',
  'lessThanOncePerWeek',
  'never',
]);

function optionalInt(url: URL, name: string, min: number, max: number): number | undefined | string {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    return `${name} must be an integer between ${min} and ${max}`;
  }
  return value;
}

/**
 * Validates the search filters and builds both the canonical cache key
 * (every distinguishing input included, so two searches never alias) and the
 * upstream path. Returns a detail string when validation fails.
 */
export function parseSearchQuery(url: URL): { ok: true; query: SearchQuery } | { ok: false; detail: string } {
  const upstream = new URLSearchParams();
  const cacheParts: string[] = [];

  const name = (url.searchParams.get('name') ?? '').trim();
  if (name.length < 1) return { ok: false, detail: 'name is required' };
  if (name.length > 64) return { ok: false, detail: 'name is too long' };
  upstream.set('name', name);
  cacheParts.push(`name=${name}`);

  const minMembers = optionalInt(url, 'minMembers', 1, 50);
  if (typeof minMembers === 'string') return { ok: false, detail: minMembers };
  if (minMembers !== undefined) {
    upstream.set('minMembers', String(minMembers));
    cacheParts.push(`minMembers=${minMembers}`);
  }

  const minClanLevel = optionalInt(url, 'minClanLevel', 1, 30);
  if (typeof minClanLevel === 'string') return { ok: false, detail: minClanLevel };
  if (minClanLevel !== undefined) {
    upstream.set('minClanLevel', String(minClanLevel));
    cacheParts.push(`minClanLevel=${minClanLevel}`);
  }

  const warFrequency = url.searchParams.get('warFrequency');
  if (warFrequency !== null) {
    if (!WAR_FREQUENCIES.has(warFrequency)) {
      return { ok: false, detail: 'warFrequency must be one of always, moreThanOncePerWeek, oncePerWeek, lessThanOncePerWeek, never' };
    }
    upstream.set('frequency', warFrequency);
    cacheParts.push(`frequency=${warFrequency}`);
  }

  const locationId = optionalInt(url, 'locationId', 0, 99_999_999);
  if (typeof locationId === 'string') return { ok: false, detail: locationId };
  if (locationId !== undefined) {
    upstream.set('locationId', String(locationId));
    cacheParts.push(`locationId=${locationId}`);
  }

  const limit = optionalInt(url, 'limit', 1, 100);
  if (typeof limit === 'string') return { ok: false, detail: limit };
  if (limit !== undefined) {
    upstream.set('limit', String(limit));
    cacheParts.push(`limit=${limit}`);
  }

  const after = url.searchParams.get('after');
  if (after !== null) {
    if (after.length < 1 || after.length > 256) {
      return { ok: false, detail: 'after must be a paging cursor' };
    }
    upstream.set('after', after);
    cacheParts.push(`after=${after}`);
  }

  return {
    ok: true,
    query: {
      cacheKey: `search|${cacheParts.join('|')}`,
      upstreamPath: `/clans?${upstream.toString()}`,
    },
  };
}

// ---------- shared serving engine ----------

interface RouteDefinition {
  cache: TtlCache;
  ttlMs: number;
  negativeTtlMs: number;
  cacheKey: string;
  upstreamPath: string;
  /** Included in not_found bodies for tag routes. */
  tag?: string;
  classify: Classifier;
}

async function serve(definition: RouteDefinition): Promise<Response> {
  const cached = definition.cache.get(definition.cacheKey);
  if (cached) {
    if (cached.status === 200) {
      return contract.rawJson(200, withAge(cached.body, cached.storedAt), { 'x-cache': 'HIT' });
    }
    return contract.rawJson(cached.status, cached.body, { 'x-cache': 'HIT' });
  }

  let outcome: Outcome;
  try {
    const response = await fetchUpstream(definition.upstreamPath);
    outcome = definition.classify(response.status, response.body);
  } catch (error) {
    if (error instanceof UpstreamBusyError) {
      outcome = { kind: 'busy', retryAfterSeconds: error.retryAfterSeconds };
    } else if (error instanceof UpstreamUnreachableError) {
      outcome = { kind: 'unreachable' };
    } else {
      throw error;
    }
  }

  switch (outcome.kind) {
    case 'data': {
      const storedAt = Date.now();
      definition.cache.set(definition.cacheKey, { status: 200, body: outcome.body, storedAt }, definition.ttlMs);
      return contract.rawJson(200, withAge(outcome.body, storedAt), { 'x-cache': 'MISS' });
    }
    case 'private': {
      const storedAt = Date.now();
      definition.cache.set(definition.cacheKey, { status: 200, body: PRIVATE_WARLOG_BODY, storedAt }, definition.ttlMs);
      return contract.rawJson(200, withAge(PRIVATE_WARLOG_BODY, storedAt), { 'x-cache': 'MISS' });
    }
    case 'notFound': {
      const body = JSON.stringify(
        definition.tag === undefined ? { error: 'not_found' } : { error: 'not_found', tag: definition.tag },
      );
      definition.cache.set(
        definition.cacheKey,
        { status: 404, body, storedAt: Date.now() },
        definition.negativeTtlMs,
      );
      return contract.rawJson(404, body, { 'x-cache': 'MISS' });
    }
    case 'busy':
      return contract.upstreamBusy(outcome.retryAfterSeconds);
    case 'unreachable':
      return contract.upstreamUnreachable();
    case 'badRequest':
      return contract.badRequest(outcome.detail);
  }
}

// ---------- tag helpers ----------

export function tagFromPath(url: URL, segmentIndex: number): string {
  // Leading '/' produces an empty first segment; strip it so index 2 is the
  // tag for /api/clan/:tag and /api/player/:tag alike.
  const segments = url.pathname.replace(/^\//, '').split('/');
  const segment = segments[segmentIndex] ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// ---------- the five routes ----------

const searchCache = new TtlCache({ maxEntries: 128 });
const clanCache = new TtlCache();
const playerCache = new TtlCache();
const warCache = new TtlCache();
const warlogCache = new TtlCache();

export const handleSearch: RouteHandler = async (request) => {
  if (request.method !== 'GET') return contract.methodNotAllowed();
  try {
    const parsed = parseSearchQuery(new URL(request.url));
    if (!parsed.ok) return contract.badRequest(parsed.detail);
    return await serve({
      cache: searchCache,
      ttlMs: TTL.search,
      negativeTtlMs: NEGATIVE_TTL_MS,
      cacheKey: parsed.query.cacheKey,
      upstreamPath: parsed.query.upstreamPath,
      classify: classifyUpstream,
    });
  } catch (error) {
    console.error('[search]', error);
    return contract.internalError();
  }
};

async function serveTagRoute(
  request: Request,
  cache: TtlCache,
  ttlMs: number,
  routeName: 'clan' | 'player' | 'war' | 'warlog',
): Promise<Response> {
  const rawTag = tagFromPath(new URL(request.url), 2);
  const tag = normalizeTag(rawTag);
  if (!tag) return contract.badRequest(`invalid tag: ${rawTag || '(empty)'}`);

  const tagPath = routeName === 'player' ? `/players/${encodeTag(tag)}` : `/clans/${encodeTag(tag)}`;
  // The game API calls the live war endpoint currentwar, not war.
  const suffix = routeName === 'war' ? '/currentwar' : routeName === 'warlog' ? '/warlog' : '';

  try {
    return await serve({
      cache,
      ttlMs: ttlMs,
      negativeTtlMs: NEGATIVE_TTL_MS,
      cacheKey: `${routeName}|${tag}`,
      upstreamPath: `${tagPath}${suffix}`,
      tag,
      classify: routeName === 'warlog' ? classifyWarlog : classifyUpstream,
    });
  } catch (error) {
    console.error(`[${routeName}]`, error);
    return contract.internalError();
  }
}

export const handleClan: RouteHandler = async (request) => {
  if (request.method !== 'GET') return contract.methodNotAllowed();
  return serveTagRoute(request, clanCache, TTL.clan, 'clan');
};

export const handlePlayer: RouteHandler = async (request) => {
  if (request.method !== 'GET') return contract.methodNotAllowed();
  return serveTagRoute(request, playerCache, TTL.player, 'player');
};

export const handleWar: RouteHandler = async (request) => {
  if (request.method !== 'GET') return contract.methodNotAllowed();
  return serveTagRoute(request, warCache, TTL.war, 'war');
};

export const handleWarlog: RouteHandler = async (request) => {
  if (request.method !== 'GET') return contract.methodNotAllowed();
  return serveTagRoute(request, warlogCache, TTL.warlog, 'warlog');
};
