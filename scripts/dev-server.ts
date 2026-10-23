// Local stand-in for the platform's function runtime: mounts the five api
// route files on a plain Node http server so the Vite dev server (which
// proxies /api here) and curl see exactly what the deploy would serve.
// Started by scripts/dev-api.mjs, not run directly.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import apiSearch from '../api/search';
import apiClan from '../api/clan/[tag]';
import apiPlayer from '../api/player/[tag]';
import apiWar from '../api/clan/[tag]/war';
import apiWarlog from '../api/clan/[tag]/warlog';
import { internalError, jsonResponse } from '../server/contract';

const PORT = Number(process.env.PORT ?? 8788);

type Handler = (request: Request) => Promise<Response>;

// The api files export the Vercel web-standard shape (a default object with
// a fetch method), so the dev server calls the same entry point the platform
// does: defaultExport.fetch(request).
const routes: Array<{ match: RegExp; handler: Handler }> = [
  { match: /^\/api\/search$/, handler: apiSearch.fetch },
  { match: /^\/api\/player\/[^/]+$/, handler: apiPlayer.fetch },
  { match: /^\/api\/clan\/[^/]+\/warlog$/, handler: apiWarlog.fetch },
  { match: /^\/api\/clan\/[^/]+\/war$/, handler: apiWar.fetch },
  { match: /^\/api\/clan\/[^/]+$/, handler: apiClan.fetch },
];

function toWebRequest(incoming: IncomingMessage): Request {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (typeof value === 'string') headers[name] = value;
    else if (Array.isArray(value)) headers[name] = value.join(', ');
  }
  return new Request(`http://localhost:${PORT}${incoming.url ?? '/'}`, {
    method: incoming.method ?? 'GET',
    headers,
  });
}

async function sendResponse(outgoing: ServerResponse, response: Response): Promise<void> {
  // Read the body before touching the socket: if reading throws, no bytes
  // have been sent yet and the fallback can still take over cleanly.
  const body = Buffer.from(await response.arrayBuffer());
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  outgoing.writeHead(response.status, headers);
  outgoing.end(body);
}

const server = createServer((incoming, outgoing) => {
  void (async () => {
    const request = toWebRequest(incoming);
    const path = new URL(request.url).pathname;
    const route = routes.find((candidate) => candidate.match.test(path));
    try {
      const response = route
        ? await route.handler(request)
        : jsonResponse(404, { error: 'not_found', detail: `unknown route: ${path}` });
      await sendResponse(outgoing, response);
    } catch (error) {
      console.error('[dev-server]', error);
      if (outgoing.headersSent) {
        outgoing.destroy();
        return;
      }
      await sendResponse(outgoing, internalError());
    }
  })();
});

server.listen(PORT, () => {
  console.log(`api dev server on http://localhost:${PORT}`);
  console.log('routes: /api/search, /api/clan/:tag, /api/player/:tag, /api/clan/:tag/war, /api/clan/:tag/warlog');
  if (!process.env.COC_API_TOKEN) {
    console.log('COC_API_TOKEN is not set: upstream calls will answer 500 internal_error.');
    console.log('Put COC_API_TOKEN and COC_API_BASE_URL in .env at the repo root (never committed).');
  }
});
