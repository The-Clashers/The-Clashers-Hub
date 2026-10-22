// The JSON error contract (docs/concept/04-api-strategy section 6). Every
// response the tier sends goes through one of these helpers so headers stay
// uniform: JSON content type, and no-store so nothing between the client and
// the tier (browser cache, CDN) silently double-caches.

const JSON_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function jsonResponse(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

/** Serves an already-serialized JSON body (cached entries, aged bodies). */
export function rawJson(status: number, body: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

export function upstreamBusy(retryAfterSeconds: number): Response {
  return jsonResponse(503, { error: 'upstream_busy', retryAfter: retryAfterSeconds });
}

export function upstreamUnreachable(): Response {
  return jsonResponse(502, { error: 'upstream_unreachable' });
}

export function badRequest(detail: string): Response {
  return jsonResponse(400, { error: 'bad_request', detail });
}

export function methodNotAllowed(): Response {
  return jsonResponse(405, { error: 'bad_request', detail: 'only GET is supported' });
}

export function internalError(): Response {
  return jsonResponse(500, { error: 'internal_error' });
}
