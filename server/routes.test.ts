import { describe, expect, it } from 'vitest';
import { classifyUpstream, classifyWarlog, parseSearchQuery, tagFromPath, withAge } from './routes';

describe('tagFromPath', () => {
  it('extracts the decoded tag segment from clan and player paths', () => {
    expect(tagFromPath(new URL('http://x/api/clan/%23AB12CD'), 2)).toBe('#AB12CD');
    expect(tagFromPath(new URL('http://x/api/player/%23XY99'), 2)).toBe('#XY99');
    expect(tagFromPath(new URL('http://x/api/clan/%23AB12CD/war'), 2)).toBe('#AB12CD');
  });

  it('prefers the tag query param the platform passes on dynamic routes', () => {
    expect(tagFromPath(new URL('http://x/api/clan/[tag]?tag=%23AB12CD'), 2)).toBe('#AB12CD');
    expect(tagFromPath(new URL('http://x/api/player/[tag]?tag=XY99&limit=5'), 2)).toBe('XY99');
  });

  it('returns an empty string for a missing segment', () => {
    expect(tagFromPath(new URL('http://x/api/clan/'), 2)).toBe('');
  });

  it('survives a malformed escape sequence', () => {
    expect(tagFromPath(new URL('http://x/api/clan/%ZZ'), 2)).toBe('%ZZ');
  });
});

describe('classifyUpstream', () => {
  it('maps statuses per the error contract', () => {
    expect(classifyUpstream(200, '{}')).toEqual({ kind: 'data', body: '{}' });
    expect(classifyUpstream(404, '')).toEqual({ kind: 'notFound' });
    expect(classifyUpstream(400, '{"reason":"badName"}')).toEqual({ kind: 'badRequest', detail: 'badName' });
    expect(classifyUpstream(403, '')).toEqual({ kind: 'unreachable' });
    expect(classifyUpstream(500, '')).toEqual({ kind: 'unreachable' });
  });

  it('prefers the upstream message sentence over the reason code in a 400 detail', () => {
    expect(
      classifyUpstream(400, '{"reason":"badName","message":"clanName must have at least three characters"}'),
    ).toEqual({ kind: 'badRequest', detail: 'clanName must have at least three characters' });
  });

  it('falls back to a generic detail when the body has no reason or message', () => {
    expect(classifyUpstream(400, 'not json')).toEqual({ kind: 'badRequest', detail: 'upstream rejected the request' });
  });
});

describe('classifyWarlog', () => {
  it('treats the live accessDenied 403 as the private state', () => {
    expect(classifyWarlog(403, '{"reason":"accessDenied"}')).toEqual({ kind: 'private' });
  });

  it('accepts an explicit privateWarLog reason too', () => {
    expect(classifyWarlog(403, '{"reason":"privateWarLog"}')).toEqual({ kind: 'private' });
  });

  it('keeps any other 403 reason an upstream failure', () => {
    expect(classifyWarlog(403, '{"reason":"keyIpBlocked"}')).toEqual({ kind: 'unreachable' });
  });

  it('defers everything else to the default mapping', () => {
    expect(classifyWarlog(200, '{}')).toEqual({ kind: 'data', body: '{}' });
    expect(classifyWarlog(404, '')).toEqual({ kind: 'notFound' });
  });
});

describe('withAge', () => {
  it('injects the seconds since the upstream fetch', () => {
    expect(withAge('{"a":1}', 1_000, 6_500)).toBe('{"a":1,"age":5}');
  });

  it('never reports a negative age for clock skew', () => {
    expect(withAge('{"a":1}', 5_000, 4_000)).toBe('{"a":1,"age":0}');
  });

  it('leaves non-object bodies verbatim', () => {
    expect(withAge('[1,2]', 0, 5_000)).toBe('[1,2]');
    expect(withAge('not json', 0, 5_000)).toBe('not json');
  });
});

describe('parseSearchQuery', () => {
  it('requires a name', () => {
    expect(parseSearchQuery(new URL('http://x/api/search'))).toMatchObject({ ok: false });
    expect(parseSearchQuery(new URL('http://x/api/search?name=%20'))).toMatchObject({ ok: false });
  });

  it('rejects a name shorter than the game API three-character floor', () => {
    const short = parseSearchQuery(new URL('http://x/api/search?name=PH'));
    expect(short).toEqual({ ok: false, detail: 'name must be at least three characters' });
  });

  it('rejects out-of-range filters', () => {
    expect(parseSearchQuery(new URL('http://x/api/search?name=abc&minMembers=999'))).toMatchObject({ ok: false });
    expect(parseSearchQuery(new URL('http://x/api/search?name=abc&maxMembers=0'))).toMatchObject({ ok: false });
    expect(parseSearchQuery(new URL('http://x/api/search?name=abc&minClanPoints=999999'))).toMatchObject({ ok: false });
    expect(parseSearchQuery(new URL('http://x/api/search?name=abc&labelId=0'))).toMatchObject({ ok: false });
    expect(parseSearchQuery(new URL('http://x/api/search?name=abc&limit=0'))).toMatchObject({ ok: false });
  });

  it('rejects an unknown war frequency', () => {
    expect(parseSearchQuery(new URL('http://x/api/search?name=abc&warFrequency=sometimes'))).toMatchObject({ ok: false });
  });

  it('passes the new upstream filters through with distinct cache keys', () => {
    const result = parseSearchQuery(
      new URL('http://x/api/search?name=Clan&maxMembers=10&minClanPoints=20000&labelId=56000013'),
    );
    if (!result.ok) throw new Error('expected the query to parse');
    expect(result.query.upstreamPath).toBe('/clans?name=Clan&maxMembers=10&minClanPoints=20000&labelId=56000013');
    expect(result.query.cacheKey).toContain('maxMembers=10');
    expect(result.query.cacheKey).toContain('minClanPoints=20000');
    expect(result.query.cacheKey).toContain('labelId=56000013');
  });

  it('builds a canonical cache key and the upstream path from valid filters', () => {
    const result = parseSearchQuery(new URL('http://x/api/search?name=Clan&limit=5&after=CUR'));
    if (!result.ok) throw new Error('expected the query to parse');
    expect(result.query.cacheKey).toContain('name=Clan');
    expect(result.query.cacheKey).toContain('limit=5');
    expect(result.query.cacheKey).toContain('after=CUR');
    expect(result.query.upstreamPath).toBe('/clans?name=Clan&limit=5&after=CUR');
  });

  it('distinguishes two different searches in the cache key', () => {
    const first = parseSearchQuery(new URL('http://x/api/search?name=one'));
    const second = parseSearchQuery(new URL('http://x/api/search?name=two'));
    if (!first.ok || !second.ok) throw new Error('expected the queries to parse');
    expect(first.query.cacheKey).not.toBe(second.query.cacheKey);
  });
});
