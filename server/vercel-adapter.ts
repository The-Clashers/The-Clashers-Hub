// The bridge between the platform's Node launcher and our web-standard
// handlers.
//
// Ground truth from the first live deploy: the platform's Node launcher
// invokes the default export Node-style, as (req, res), no matter what
// shape the module has. A bare web-standard handler crashes there
// (new URL(req.url) is an Invalid URL because req.url is a bare path), and
// the documented fetch-object form crashes too (the launcher calls the
// object itself, which is not a function). The one shape every launcher
// generation has always invoked correctly is a plain exported function
// receiving (req, res).
//
// So this module adapts: nodeHandler wraps a web-standard handler into a
// function that builds a real Request from the Node req, runs the handler,
// and pipes the Response into the Node res. If some future launcher calls
// it web-style instead (a Request and no res), the wrapper detects that and
// passes the Request straight through, so the same file survives either
// contract without changes.
//
// The dev server (scripts/dev-server.ts) relies on that web-style path: it
// calls the default export with a Request, exactly like the platform calls
// it with (req, res). One adapter, both worlds.

import type { IncomingMessage, ServerResponse } from 'node:http';

type WebHandler = (request: Request) => Promise<Response>;

function toWebRequest(req: IncomingMessage): Request {
  // req.url is the path plus query only; the platform terminates TLS and
  // forwards the public host in the host header, so an absolute https URL
  // can always be rebuilt. A missing host falls back to localhost; the
  // handlers only ever read the path, the query, and the method.
  const host = req.headers.host ?? 'localhost';
  return new Request(`https://${host}${req.url ?? '/'}`, {
    method: req.method ?? 'GET',
    headers: req.headers as Record<string, string>,
  });
}

async function sendToRes(res: ServerResponse, response: Response): Promise<void> {
  const body = Buffer.from(await response.arrayBuffer());
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  res.writeHead(response.status, headers);
  res.end(body);
}

function looksLikeRequest(value: unknown): value is Request {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Request).headers?.get === 'function' &&
    typeof (value as Request).text === 'function'
  );
}

/** Wraps a web-standard handler for the platform's Node-style invocation. */
export function nodeHandler(handler: WebHandler) {
  return async function handle(req: unknown, res?: unknown): Promise<Response | void> {
    // Web-style call: a Request and no response object. Pass through.
    if (res === undefined && looksLikeRequest(req)) {
      return handler(req);
    }
    // Node-style call: (IncomingMessage, ServerResponse).
    const response = await handler(toWebRequest(req as IncomingMessage));
    await sendToRes(res as ServerResponse, response);
  };
}
