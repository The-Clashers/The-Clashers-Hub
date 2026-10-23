// The inner entry for the platform simulator (bundled by platform-sim.mjs).
// Imports the api default exports and calls them Node-style (req, res) with
// NO web-standard Request anywhere in the call path, mirroring the
// deployed launcher. The adapters must bridge on their own.

import { createServer } from 'node:http';
import apiSearch from '../api/search';
import apiClan from '../api/clan/[tag]';
import apiPlayer from '../api/player/[tag]';
import apiWar from '../api/clan/[tag]/war';
import apiWarlog from '../api/clan/[tag]/warlog';

const PORT = Number(process.env.PORT ?? 8789);

// Node-style invocation, exactly like the platform launcher: the exported
// function receives (req, res) and owns the response. Dynamic segments are
// dispatched the way the routing manifest does on the platform: the path is
// rewritten to the function file with the segment as a `tag` query param,
// which is how the deployed function actually receives it.
function dispatch(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const rest = url.search ? url.search.slice(1) : '';
  const dyn = (file, capture) => {
    req.url = `/api/${file}?tag=${capture}${rest ? `&${rest}` : ''}`;
    return null;
  };
  if (/^\/api\/search$/.test(path)) return apiSearch(req, res);
  let m;
  if ((m = path.match(/^\/api\/player\/([^/]+)$/))) {
    dyn('player/[tag]', m[1]);
    return apiPlayer(req, res);
  }
  if ((m = path.match(/^\/api\/clan\/([^/]+)\/warlog$/))) {
    dyn('clan/[tag]/warlog', m[1]);
    return apiWarlog(req, res);
  }
  if ((m = path.match(/^\/api\/clan\/([^/]+)\/war$/))) {
    dyn('clan/[tag]/war', m[1]);
    return apiWar(req, res);
  }
  if ((m = path.match(/^\/api\/clan\/([^/]+)$/))) {
    dyn('clan/[tag]', m[1]);
    return apiClan(req, res);
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found', detail: `unknown route: ${path}` }));
}

createServer((req, res) => {
  // A launcher-level crash must still surface as a 500 JSON, never a dead
  // socket: everything the adapter returns is a promise we can catch.
  Promise.resolve(dispatch(req, res)).catch((error) => {
    console.error('[platform-sim] invocation failed:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error', sim: String(error) }));
    } else {
      res.destroy();
    }
  });
}).listen(PORT, () => {
  console.log(`platform simulator on http://localhost:${PORT} (Node-style invocation)`);
});
