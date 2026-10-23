# api/ — Vercel serverless functions (the proxy tier)

This folder is a **platform convention, not a choice**: Vercel auto-detects
`api/` at the *project root* and deploys each file in it as a serverless
function served under `/api/*`. Moving it anywhere else (e.g. into `src/`)
breaks that auto-detection, so root is where it lives — the same way the
static site's `public/` assets live at the root. See
[docs/concept/01-tech-stack.md §3](../docs/concept/01-tech-stack.md) for the
architecture sketch.

| File | Deployed route | Handler |
|---|---|---|
| `search.ts` | `GET /api/search?name=…` | `handleSearch` |
| `clan/[tag].ts` | `GET /api/clan/:tag` | `handleClan` |
| `clan/[tag]/war.ts` | `GET /api/clan/:tag/war` (current war) | `handleWar` |
| `clan/[tag]/warlog.ts` | `GET /api/clan/:tag/warlog` | `handleWarlog` |
| `player/[tag].ts` | `GET /api/player/:tag` | `handlePlayer` |

Every file here is a **two-line thin adapter**: it wires the platform's
Node-style invocation into the shared web-standard handler from
`server/vercel-adapter.ts` (`nodeHandler`). All real logic — validation, the
TTL cache, the upstream client, the error contract — lives in
[`server/`](../server/). The tier holds the game API key; the browser never
sees it.

> Not to be confused with [`src/api/`](../src/api/) — that is the
> **browser-side** typed client that *calls* these routes from the React app.

Local dev: `npm run dev:api` mounts these exact files on
`http://localhost:8788` (see `scripts/dev-server.ts`); the Vite dev server
proxies `/api/*` to it, so local and deployed shapes are identical.
