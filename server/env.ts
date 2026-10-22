// The two server-side-only environment variables (docs/concept/04-api-strategy
// section 7). Only the api functions and the local dev server import this
// module; nothing under src/ may ever gain access to the token.

const DEFAULT_BASE_URL = 'https://cocproxy.royaleapi.dev/v1';

export interface UpstreamConfig {
  token: string;
  baseUrl: string;
}

export function upstreamConfig(): UpstreamConfig {
  const token = process.env.COC_API_TOKEN;
  if (!token) {
    throw new Error('COC_API_TOKEN is not set (server-side environment only)');
  }
  const baseUrl = (process.env.COC_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return { token, baseUrl };
}
