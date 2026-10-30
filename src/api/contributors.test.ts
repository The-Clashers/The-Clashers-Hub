import { describe, expect, it } from 'vitest';
import { fetchContributors, ContributorsFetchError } from './contributors';

// Tests for the contributors client. The parser is exercised through
// fetchContributors with a stubbed fetch, the same approach the game API
// clients take: lock the shape the screen reads.

describe('fetchContributors', () => {
  function stubResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
      headers: new Map(Object.entries(headers ?? {})),
    } as unknown as Response;
  }

  it('parses login, avatar, profile url, and contributions', async () => {
    const payload = [
      {
        login: 'lejxz',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        html_url: 'https://github.com/lejxz',
        contributions: 42,
      },
      {
        login: 'JoshyEyeBa11',
        avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
        html_url: 'https://github.com/JoshyEyeBa11',
        contributions: 7,
      },
    ];
    const contributors = await fetchContributors({ fetchImpl: async () => stubResponse(200, payload) });
    expect(contributors).toEqual([
      {
        login: 'lejxz',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
        profileUrl: 'https://github.com/lejxz',
        contributions: 42,
      },
      {
        login: 'JoshyEyeBa11',
        avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
        profileUrl: 'https://github.com/JoshyEyeBa11',
        contributions: 7,
      },
    ]);
  });

  it('derives the profile url for rows without one and drops rows without a login', async () => {
    const payload = [
      { login: 'ghost', contributions: 3 },
      { contributions: 5 },
      'junk',
    ];
    const contributors = await fetchContributors({ fetchImpl: async () => stubResponse(200, payload) });
    expect(contributors).toEqual([
      {
        login: 'ghost',
        avatarUrl: '',
        profileUrl: 'https://github.com/ghost',
        contributions: 3,
      },
    ]);
  });

  it('treats an empty list as a real answer, not an error', async () => {
    const contributors = await fetchContributors({ fetchImpl: async () => stubResponse(200, []) });
    expect(contributors).toEqual([]);
  });

  it('classifies a 403 as rate_limited', async () => {
    await expect(
      fetchContributors({ fetchImpl: async () => stubResponse(403, { message: 'API rate limit' }) }),
    ).rejects.toMatchObject({ result: { kind: 'rate_limited' } });
  });

  it('wraps failures in ContributorsFetchError', async () => {
    try {
      await fetchContributors({ fetchImpl: async () => stubResponse(500, {}) });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ContributorsFetchError);
    }
  });

  it('classifies a 404 as bad_request and anything else as unreachable', async () => {
    await expect(
      fetchContributors({ fetchImpl: async () => stubResponse(404, {}) }),
    ).rejects.toMatchObject({ result: { kind: 'bad_request' } });
    await expect(
      fetchContributors({ fetchImpl: async () => stubResponse(500, {}) }),
    ).rejects.toMatchObject({ result: { kind: 'unreachable' } });
  });

  it('rejects a non-list success body as bad_request', async () => {
    await expect(
      fetchContributors({ fetchImpl: async () => stubResponse(200, { not: 'a list' }) }),
    ).rejects.toMatchObject({ result: { kind: 'bad_request' } });
  });
});
