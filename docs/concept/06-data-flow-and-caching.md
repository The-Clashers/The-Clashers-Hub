# 06 - Data Flow & Caching

One request's life, the four-layer ISR + SWR cache architecture, the state
every screen must design, and the evolution from v1's zero-database baseline to
**M5's 500 MB free-tier Supabase architecture** ([10](./10-database-and-isr-architecture.md)).

## 1. Request lifecycle

```
[Browser] React Native for Web app
    │  screen mounts → TanStack Query cache (L0)
    │  HIT (within staleTime) → render instantly, done
    │  MISS ▼
    │  GET /api/... (same origin, HTTPS + JSON)
[Vercel Edge Network] (L1 Edge ISR)
    │  Cache-Control: public, max-age=0, s-maxage=TTL, stale-while-revalidate=SWR
    │  HIT or SWR → return immediately
    │  MISS ▼
[Vercel function]
    │  validate input (tag shape, filter ranges)
    │  L2 In-Memory TTL cache check → HIT returns JSON
    │  MISS ▼
[Supabase Postgres] public.api_cache (L3 Shared SWR Store)
    │  Fresh → return JSON | Stale → return JSON + waitUntil(revalidate)
    │  MISS ▼
    │  GET proxy → game API (key + allowlisted proxy IP)
[Upstream]
    │  200 → project/strip fields, upsert api_cache + entity_stats, return
    │  429/5xx → stale-if-error fallback from api_cache or error contract (04 §6)
    ▼
[Browser] engine re-computation is local & instant → verdicts render
```

Two boundaries carry all the correctness: the **key boundary** (nothing
secret like `COC_API_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY` left of the Vercel
function) and the **analysis boundary** (engines stay pure client-side modules;
`server/` reuses the pure `computeRushed` helper only when seeding scalar
snapshots on CoC binding or player stats updates).

## 2. Cache layers

| Layer | Where | TTL source | What it protects |
|---|---|---|---|
| Client (TanStack Query, L0) | browser | mirrors the server fresh TTL per route (table below) | the edge & tier; repeat navigation costs nothing |
| Edge CDN (Vercel Edge ISR, L1) | Vercel POPs | `s-maxage=TTL, stale-while-revalidate=SWR` ([10 §2](./10-database-and-isr-architecture.md)) | serverless function invocations & cold starts |
| Server (in-memory Map + small LRU, L2) | Vercel function instance | the route's TTL ([04 §5](./04-api-strategy.md)) | Supabase read units inside warm instances |
| Database (Supabase `api_cache`, L3) | Supabase Postgres (500 MB free tier) | `fresh_until`, `swr_until`, `expires_at` ([10 §2–3](./10-database-and-isr-architecture.md)) | the API key across cold starts & upstream `429`/`5xx` blips |

Client `staleTime` per route: search 60 s, clan 180 s, player 300 s, current
war 120 s, war log 600 s, stats 300 s — always equal to the server fresh TTL
so the layers decay together instead of fighting. Refetch triggers: window focus
(all routes) and a 60 s interval on the current-war screen only (a war day is
the one place data actually moves minute-to-minute). Every mutation of user
intent (adjusting the donation target, re-sorting) is **local engine
re-computation**, never a refetch.

**Manual refresh (F-19).** Live screens carry a refresh control. It always
re-issues the same GET; the Edge ISR + tier TTL decides what happens next:
inside the TTL the response answers from cache carrying `"fetchedAt"` (epoch ms)
alongside `"age"`, so [src/lib/refresh.ts](../../src/lib/refresh.ts) computes
the live elapsed seconds accurately even when served from Vercel Edge ISR and
shows `"Cached, Ns ago"` instead of pretending to be fresh; past the TTL it is a
normal cache miss (or background SWR revalidation) and an upstream call updates
the snapshot. The client disables the control for a 60 s cooldown after each
use, so a nervous demo-tapper never reaches the key. The cooldown is pure
courtesy, not correctness: the multi-layer cache already guards the upstream.

Cache keys include every distinguishing input (tag, filters, cursor), so two
different searches never alias. 404 responses cache briefly (30 s) too; a
nonexistent tag shouldn't be hammered by retries.

Bundled reference data (Town Hall cap tables, the super-troop map, hero
equipment caps, the unit icon set) is the third, zero-request layer: static
imports at build time, versioned with the code, never fetched, never cached
([05 §1](./05-scoring-engines.md)). It cannot 404, cannot rate-limit, and costs
nothing at runtime.

## 3. State matrix (every screen's four states)

A screen is "designed" only when all four exist ([03 §4](./03-features-list.md)):

| State | Trigger | UX |
|---|---|---|
| Loading | first fetch | layout-matched skeletons, never spinners-only |
| Error, busy | `upstream_busy` (503) | auto-retry with backoff + "one moment…" note |
| Error, gone | `not_found` (404) | "no clan/player with this tag" + tag-correction hint (maybe you meant…) |
| Empty | no results / private war log / no-donation data | designed notices with next actions, never dead ends |
| Success | data | the screen itself |

Offline: the browser's `offline` event toggles a global banner; cached data
stays on screen, actions that need the network are disabled. This is a
nice-to-have polish item, not a PWA, we cache in memory/localStorage, not a
service worker (that would be scope creep).

## 4. Evolution from v1's no-database decision to M5

**v1 (M0–M4) shipped without a database by design**, keeping the live game API
as the single data source while browser `localStorage` held recent searches.

**M5 ([10-database-and-isr-architecture.md](./10-database-and-isr-architecture.md))
activates Rung 2 of the storage ladder** using the **Supabase 500 MB Free Tier**
under strict non-tracker guardrails:

- **Zero background polling / auto-scraping.** All cache refreshes, scalar
  progression snapshots, and entity counter updates happen strictly **on-visit**
  (or via background SWR revalidation triggered by a visitor request).
- **Strict 500 MB discipline.** Every upstream payload is stripped (`~75%`
  smaller) before entering `public.api_cache`, historical tracking stores only
  250-byte scalar rows (`player_progression_snapshots`, max 90/tag for bound
  villages only), and a 3-tier watermark guard (`run_storage_maintenance()`)
  caps total Postgres footprint at `303.5 MB` (`< 61%` of 500 MB).
- **User login & 1:1 CoC binding (`M5`).** Supabase Auth powers `/auth`,
  `/profile`, and `/settings`, allowing each registered user account to bind
  one verified Clash of Clans account (`linked_coc_accounts`) while keeping
  shareable clan/player lookup routes directly accessible.

## 5. Storage ladder (v1 -> M5)

1. **localStorage** (M0–M4, baseline client cache): recent searches, theme
   preference, and browser-local watchlist fallback.
2. **Hosted Supabase Free Tier (500 MB)** (activated in M5,
   [10](./10-database-and-isr-architecture.md)):
   - Shared L3 SWR cache (`public.api_cache`) behind Vercel Edge ISR;
   - Supabase Auth login & user accounts (`/auth`, `/profile`, `/settings`,
     `/terms`) with 1:1 Clash of Clans account binding via
     `POST /players/{tag}/verifytoken`;
   - Compact scalar progression history (`player_progression_snapshots`),
     synced watchlist/compare pairs (`user_saved_entities`), and live
     community/TH benchmark aggregates (`entity_stats`, `platform_stats_daily`).

## 6. Privacy

- Public CoC game data displayed across the app matches what any visitor sees
  in-game.
- Registered users store only email, display name, Terms consent metadata,
  their 1:1 bound CoC tag, compact progression scalars, and explicit
  bookmarks/preferences, with instant self-service JSON export and permanent
  deletion on `/settings` ([/terms specification](./10-database-and-isr-architecture.md)).
- In-game Clash of Clans API verification tokens are validated once via
  `POST /players/{tag}/verifytoken` and immediately discarded — never persisted.
- Fixtures in the repo are anonymized: real structure, placeholder names.
