# 01 - Tech Stack

## 1. Stack at a glance

| Layer | Choice | Why this one | Free-tier note |
|---|---|---|---|
| UI paradigm | **React Native for Web** (`react-native-web`) | The entire UI is written once in the RN component model (View / Text / StyleSheet / Flexbox) and renders to the browser DOM | open source, no cost |
| Build tool | **Vite** | instant dev server + HMR, minimal config, first-class TypeScript support | local dev, free |
| Language | **TypeScript** (strict) | the game API payloads and our engines deserve real contracts | |
| Routing | **React Router** (library mode) | shareable URLs are a product feature (`/player/:tag`) | |
| Data fetching | **TanStack Query** | caching, retries, background refetch, designed loading/error states for free | |
| Charts | **react-native-svg** + small custom chart components | keeps the chart layer inside the RN paradigm; a DOM chart library would break the "written in React Native" story | |
| API tier | **Vercel serverless functions** (Node, `/api/*`) | thin proxy that owns the game API key; deployed on the same origin as the app, so there is no CORS and no client-side env config | Vercel Hobby |
| Game data | **official Clash of Clans API** via the **RoyaleAPI proxy** | solves the API key's static-IP allowlist problem ([04 §"The allowlist problem"](./04-api-strategy.md)) | free |
| Tests | **Vitest** + Testing Library | our engines are pure TS, so table-driven tests are cheap to write and fast to run | |
| CI | **GitHub Actions** | public repo → free minutes | free |

## 2. Why React Native for Web (and what we deliberately avoid)

The course focus is React Native, and our target is the **web**, so the UI layer
is React Native components rendered to the browser through `react-native-web`.
This gives us one component paradigm (Flexbox layout, `View`/`Text`/
`StyleSheet`, RN accessibility props mapping to ARIA on web) while shipping a
normal static site at the end.

Deliberate exclusions:
- **No DOM-only libraries in the UI layer.** Anything that emits raw HTML (`div`,
  `innerHTML`, DOM chart libs) breaks the "written in React Native" story and
  the portability insurance above. The one sanctioned exception is the router's
  link handling, which is navigation plumbing, not UI.

## 3. Architecture sketch

```
Browser
  │   React Native for Web app (Vite build: HTML + JS + CSS)
  │   TanStack Query, client cache + loading/error states
  ▼   same origin, HTTPS + JSON
Vercel serverless functions
  │   /api/search        /api/clan/:tag        /api/player/:tag
  │   /api/clan/:tag/war /api/clan/:tag/warlog
  │   in-memory TTL cache, the throttle shield (04 §"Caching")
  ▼
RoyaleAPI proxy  ──►  Clash of Clans API
                     (API key + allowlisted proxy IP; key never leaves the server)
```

Two boundaries matter:

- **The key boundary.** `COC_API_TOKEN` exists only in the serverless tier's
  environment. The browser bundle contains zero secrets; the client talks to
  our own `/api/*` routes, same origin.
- **The analysis boundary.** The API tier is a *dumb cached proxy*: it forwards
  and caches. All analysis (rushed, donation balance, war efficiency, compare)
  runs **client-side** as pure TypeScript modules. Rationale: the API tier stays
  thin (fewer function-seconds on the free tier), the engines are trivially
  unit-testable without a server, and re-computing an analysis when the user
  changes a setting (e.g. the donation target ratio) is instant with no
  refetch. The trade-off (engine code ships in the bundle) is acceptable:
  it contains no secrets and is only a few KB.

## 4. Free-tier budget

| Resource | Tier | Limits we care about | Our expected use |
|---|---|---|---|
| Vercel | Hobby (non-commercial) | bandwidth + function invocation caps | a course demo, orders of magnitude below |
| GitHub Actions | public repo | free minutes | CI on every PR |
| Clash of Clans API | free developer key | per-key throttling (rates unpublished) | TTL cache keeps us far below any plausible cap ([04 §"Throttle math"](./04-api-strategy.md)) |
| RoyaleAPI proxy | free community service | fair use | all upstream traffic |
| Database | **none** | | by decision ([06 §"The no-database decision"](./06-data-flow-and-caching.md)) |

If any component approaches a cap, the answer is more caching or less
scope, never a credit card.

## 5. Planned repository layout

```
/                  Vite + React Native for Web app
  src/screens/     one folder per screen (03 §"Screens & URLs")
  src/components/  shared UI, the design language (07)
  src/engines/     pure analysis modules + unit tests (05)
  src/api/         typed client for our own /api routes
  api/             Vercel serverless functions (the proxy tier)
  server/          tier code shared by the functions: upstream client, TTL cache, error contract
  scripts/         dev runners: local api server, mock upstream, tier verification
  fixtures/        anonymized game-API payloads for tests
  docs/concept/    this folder, the decision record
```

Exact paths are decided in milestone M0; the hard boundaries are `src/engines`
(no React imports allowed), `api/` (no analysis logic allowed), and
`fixtures/` (no real player names, anonymized copies for tests).

## 6. Development workflow

- **Branches + PRs.** `main` is always deployable; every change goes through a
  PR. Required checks: typecheck, lint, unit tests, build (CI config in M0).
  No direct pushes to `main` once two or more people are committing.
- **Local dev.** `npm install && npm run dev:api && npm run dev`: the first command
  runs the api tier locally on port 8788 (loading `.env`, never committed) and the
  Vite dev server proxies `/api/*` to it, same-origin exactly like the deploy. The
  game API key is optional for local development: without it, the tier can point
  at the mock upstream (`scripts/mock-upstream.mjs`) so teammates without the key
  still get working data.
- **Preview deploys.** Vercel gives every PR a preview URL; design review
  happens on the preview, not on screenshots.
- **Env vars.** Exactly two, both server-side only: `COC_API_TOKEN` and
  `COC_API_BASE_URL`. `.env` files are gitignored from day one, and CI never
  needs either (tests run on fixtures).
