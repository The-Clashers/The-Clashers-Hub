# 06 - Data Flow & Caching

One request's life, the two cache layers, the state every screen must design,
and the biggest decision in the project: **we run without a database**.

## 1. Request lifecycle

```
[Browser] React Native for Web app
    │  screen mounts → TanStack Query cache
    │  HIT (within staleTime) → render instantly, done
    │  MISS ▼
    │  GET /api/... (same origin, HTTPS + JSON)
[Vercel function]
    │  validate input (tag shape, filter ranges)
    │  TTL cache check (in-memory, per instance)
    │  HIT → return cached JSON, done
    │  MISS ▼
    │  GET proxy → game API (key + allowlisted proxy IP)
[Upstream]
    │  200 → cache + return   |   429/404/403 → mapped per the error contract (04 §6)
    ▼
[Browser] engine re-computation is local & instant → verdicts render
```

Two boundaries carry all the correctness: the **key boundary** (nothing
secret left of the Vercel function) and the **analysis boundary** (nothing
analytical right of it, engines are client-side pure modules).

## 2. Cache layers

| Layer | Where | TTL source | What it protects |
|---|---|---|---|
| Client (TanStack Query) | browser | mirrors the server TTL per route (table below) | the server tier, repeat navigation costs nothing upstream |
| Server (in-memory Map + small LRU) | Vercel function instance | the route's TTL ([04 §5](./04-api-strategy.md)) | the API key, the throttle shield |

Client `staleTime` per route: search 60 s, clan 180 s, player 300 s, current
war 120 s, war log 600 s, always equal to the server TTL so the two layers
decay together instead of fighting. Refetch triggers: window focus (all
routes) and a 60 s interval on the current-war screen only (a war day is the
one place data actually moves minute-to-minute). Every mutation of user intent
(adjusting the donation target, re-sorting) is **local engine re-computation**,
never a refetch.

**Manual refresh (F-19).** Live screens carry a refresh control. It always
re-issues the same GET; the server's TTL decides what happens next: inside
the TTL the tier answers from its cache and the response carries the data's
age, so the screen shows a "cached, Ns ago" hint instead of pretending to be
fresh; past the TTL it is a normal cache miss and one upstream call happens.
The client disables the control for a 60 s cooldown after each use, so a
nervous demo-tapper never reaches the key. The cooldown is pure courtesy,
not correctness: the cache alone already guards the upstream.

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

## 4. The no-database decision

**Decision: there is no database, and that is a feature.**

Rationale:

- The product is a *searcher* over **live** public data ([00 §"Scope"](./00-overview.md)). Every
  question we answer, rushed, donations, war efficiency, is answerable from
  what the API returns *right now*. Nothing needs to accumulate.
- No database means no schema, no migrations, no connection pooling, no
  backups, no "why is the poll down" at 2 a.m., and no line item on the
  free-tier budget ([NFR-01](./02-requirements-tracker.md)). The operational class of problems that comes with
  persistent state simply does not exist here.
- The cost is honest: no trends over time, no "member since", no alerts on
  change. We explicitly give that up ([00 §"Non-goals"](./00-overview.md)), it is the scope line
  between a searcher and a tracker, and we are building the searcher.

## 5. Storage ladder (opt-in, never architecture-by-default)

If coursework requirements push toward persistence, climb one rung at a time;
each rung is independently cuttable:

1. **localStorage** (P1, ships by default): recent searches, and favorites if
   F-14 survives. Nothing but tags the user typed or starred; no personal
   data; clears with browser data.
2. **Hosted Supabase free tier** (only under explicit course requirement):
   a single `watchlist` table keyed by an anonymous device ID. The engines
   never read it; it only remembers tags. If this rung activates, it gets its
   own concept doc before any code.

The rule: the ladder is a response to a requirement, never a default. A rung
that demands scheduled jobs (cron, pollers) is out of bounds for this
project: that is the tracker's problem class, and we are not building a
tracker.

## 6. Privacy

- We display public game data about game accounts, the same data the game
  itself shows any clan visitor.
- No accounts, no cookies, no analytics on users.
- localStorage holds only game tags the user typed or starred (06 §5).
- Fixtures in the repo are anonymized: real structure, placeholder names.
