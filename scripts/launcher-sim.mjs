// Launcher simulator: loads a BUILT function artifact (.vercel/output
// .../api/*.js) the way the platform's Node launcher does — dynamic import,
// unwrap .default up to five times, then call it Node-style (req, res) —
// and serves it on a plain http port so curl can exercise it end to end.
//
// Usage: node scripts/launcher-sim.mjs <path-to-built-function.js> [port]

import { createServer } from 'node:http';

const target = process.argv[2];
const port = Number(process.argv[3] ?? 8790);

const mod = await import(target);
let listener = mod;
for (let i = 0; i < 5 && listener.default; i += 1) {
  listener = listener.default;
}
console.log('loaded', target);
console.log('resolved handler type:', typeof listener);
if (typeof listener !== 'function') {
  console.error('launcher would fail: handler is not a function');
  process.exit(1);
}

createServer((req, res) => {
  Promise.resolve(listener(req, res)).catch((error) => {
    console.error('[launcher-sim] invocation failed:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error', sim: String(error) }));
    } else {
      res.destroy();
    }
  });
}).listen(port, () => {
  console.log(`launcher sim on http://localhost:${port}`);
});
