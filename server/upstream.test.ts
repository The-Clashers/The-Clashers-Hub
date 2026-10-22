import { describe, expect, it } from 'vitest';
import { fetchUpstream, UpstreamBusyError, UpstreamUnreachableError, type FetchLike } from './upstream';

// The upstream client only ever talks to the stubbed fetch; the env points
// at a dummy base so the assertions can pin the exact request URL.
process.env.COC_API_TOKEN = 'test-token';
process.env.COC_API_BASE_URL = 'https://upstream.test/v1';

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function sequenceStub(responses: Array<{ status: number; body?: string; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  let index = 0;
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const spec = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return new Response(spec.body ?? '{}', { status: spec.status, headers: spec.headers });
  };
  return { impl, calls };
}

describe('fetchUpstream', () => {
  it('returns the upstream body on 200 without retrying', async () => {
    const stub = sequenceStub([{ status: 200, body: '{"ok":true}' }]);
    const result = await fetchUpstream('/clans?name=x', { fetchImpl: stub.impl });
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"ok":true}');
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.url).toBe('https://upstream.test/v1/clans?name=x');
    const headers = new Headers(stub.calls[0]?.init?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-token');
  });

  it('retries a 429 automatically and succeeds on the next attempt', async () => {
    const stub = sequenceStub([{ status: 429 }, { status: 200, body: '{"ok":true}' }]);
    const result = await fetchUpstream('/clans', { fetchImpl: stub.impl, backoffMs: [1] });
    expect(result.status).toBe(200);
    expect(stub.calls).toHaveLength(2);
  });

  it('reports the upstream wait when the attempt budget runs out', async () => {
    const stub = sequenceStub([{ status: 429, headers: { 'retry-after': '7' } }]);
    await expect(
      fetchUpstream('/clans', { fetchImpl: stub.impl, backoffMs: [1, 1] }),
    ).rejects.toMatchObject({ retryAfterSeconds: 7 });
    expect(stub.calls).toHaveLength(3);
  });

  it('defaults the busy wait to 30 seconds without a retry-after header', async () => {
    const stub = sequenceStub([{ status: 429 }]);
    await expect(
      fetchUpstream('/clans', { fetchImpl: stub.impl, backoffMs: [1, 1] }),
    ).rejects.toBeInstanceOf(UpstreamBusyError);
  });

  it('maps network failures to unreachable', async () => {
    const impl: FetchLike = async () => {
      throw new Error('boom');
    };
    await expect(fetchUpstream('/clans', { fetchImpl: impl })).rejects.toBeInstanceOf(UpstreamUnreachableError);
  });

  it('aborts a hanging upstream call at the timeout', async () => {
    const impl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await expect(fetchUpstream('/clans', { fetchImpl: impl, timeoutMs: 20 })).rejects.toBeInstanceOf(
      UpstreamUnreachableError,
    );
  });
});
