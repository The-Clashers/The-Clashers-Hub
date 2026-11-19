# 10 - Database, ISR Caching & CoC-Bound Accounts Architecture

This document defines **Milestone 5 (M5)**: adding a free-tier **Supabase**
database, upgrading the API tier to **four-layer Edge ISR + Supabase SWR
caching**, implementing **user login & account creation (`/auth`) with 1:1
Clash of Clans profile binding**, persisting compact player data within the
**500 MB free-tier ceiling**, and surfacing **database-powered community
statistics** across the app. Every decision here states **what we build and why**
before implementation cards (`T-M5-1` through `T-M5-8`) are pulled from the
backlog.

---

## 1. Why We Activated the Database Tier (From Rung 1 to Rung 2+)

In v1 (`M0`–`M4`), [06 §4](./06-data-flow-and-caching.md) deliberately shipped
without a database, keeping persistence on Rung 1 (`localStorage` recent
searches) while holding Rung 2 (**Hosted Supabase free tier**) in reserve under
[06 §5](./06-data-flow-and-caching.md). Activating M5 climbs that rung cleanly:

- **User login & account creation (`/auth`, `FR-20`).** M5 implements full
  email/password authentication via **Supabase Auth**, pairing every registered
  account with a profile (`public.profiles`) and explicit consent to the Terms
  & Data Privacy Policy (`/terms`), while keeping the public lookup routes
  reachable for direct URL sharing and quick demos.
- **Persistent shared cache across cold starts.** Serverless function memory
  ([server/cache.ts](../../server/cache.ts)) resets on every Vercel cold start
  and does not share entries across regions. Pairing **Vercel Edge ISR** with a
  **Supabase Postgres SWR table** keeps cached game responses warm across
  instances and survives upstream `429` / `5xx` blips via `stale-if-error`.
- **1:1 Verified Clash of Clans account binding (`FR-21`).** Each user account
  binds **one Clash of Clans player account** (1:1 mapping per user, with
  self-service unbind/rebind) using Supercell's official in-game
  `POST /players/{playerTag}/verifytoken` handshake — without ever storing the
  rolling in-game API token.
- **High-value, low-footprint player persistence (`FR-22`, `FR-24`).** Instead
  of running scheduled pollers or storing bloated raw JSON histories (which
  would exhaust 500 MB and violate the no-tracker boundary), M5 records
  **250-byte scalar progression snapshots** on-visit for bound accounts,
  cloud-syncs watchlists and saved compare pairs, remembers audit preferences
  (like custom donation ratios), and computes **live platform and Town Hall
  peer benchmarks** (`GET /api/stats`).

---

## 2. Four-Layer ISR & Supabase SWR Caching Architecture

Because The Clashers Hub runs on **Vite + React Native for Web + Vercel
Serverless Functions** ([01-tech-stack.md](./01-tech-stack.md)), Incremental
Static Regeneration (ISR) is implemented as a **layered HTTP Edge ISR +
Supabase Postgres Stale-While-Revalidate (SWR) pipeline** rather than a
framework-coupled Next.js build step.

### 2.1 Request & Revalidation Flow

```text
[Browser] React Native for Web + TanStack Query (L0 Client Cache)
    │  staleTime == route fresh TTL
    │  HIT -> render immediately | MISS ▼
    │  GET /api/... (same origin)
[Vercel Edge Network] (L1 Edge ISR)
    │  Cache-Control: public, max-age=0, s-maxage=<TTL>, stale-while-revalidate=<SWR>
    │  Edge HIT or Edge SWR -> return immediately (Edge revalidates async if stale)
    │  Edge MISS ▼
[Vercel Serverless Function] server/routes.ts
    │  L2 In-Memory TtlCache (128-entry hot instance LRU)
    │  L2 HIT -> return immediately | L2 MISS ▼
[Supabase Postgres] public.api_cache (L3 Shared SWR Store)
    ├─► Fresh (now < fresh_until): return cached JSON (x-cache: SUPABASE-HIT)
    ├─► Stale (fresh_until <= now < swr_until):
    │     return cached JSON immediately (x-cache: SUPABASE-STALE)
    │     AND schedule waitUntil(revalidateFromUpstream)
    └─► Cold Miss (absent or now >= expires_at):
          fetch RoyaleAPI Proxy -> Clash of Clans API
          ├─► 200 OK: strip unused fields (cache-projector.ts), upsert api_cache,
          │           atomically increment entity_stats & platform_stats_daily
          └─► 429 / 5xx: Stale-If-Error fallback -> serve last good row from api_cache
              (if unexpired) or map via 04 §6 error contract
```

### 2.2 Per-Route ISR & Supabase SWR Windows

| Route | Fresh TTL (`s-maxage` & Client `staleTime`) | Edge ISR Window (`stale-while-revalidate`) | Supabase SWR Window (`swr_until`) | Supabase Hard Expiry (`expires_at`) | Cache & Storage Policy |
|---|---|---|---|---|---|
| `GET /api/search` | `60 s` | `300 s` (5 m) | `900 s` (15 m) | `900 s` (15 m) | Cached for active queries; capped at `2,000` rows in `api_cache` |
| `GET /api/clan/:tag/war` | `120 s` | `600 s` (10 m) | `1,800 s` (30 m) | `7,200 s` (2 h) | Ephemeral live war state; swept aggressively once war concludes |
| `GET /api/clan/:tag` | `180 s` | `1,800 s` (30 m) | `86,400 s` (24 h) | `7 days` | Projected clan + up to 50 roster members (`~8.5 KB`) |
| `GET /api/player/:tag` | `300 s` | `3,600 s` (1 h) | `86,400 s` (24 h) | `7 days` | Projected player profile + unit arrays (`~4.5 KB`) |
| `GET /api/clan/:tag/warlog` | `600 s` | `7,200 s` (2 h) | `86,400 s` (24 h) | `7 days` | Capped to latest 50 wars (`~6.0 KB`) or `{ private: true }` |
| `GET /api/stats` | `300 s` | `1,800 s` (30 m) | `3,600 s` (1 h) | Permanent aggregates | Platform counters, TH benchmarks, trending entities |
| `/api/account/*` | `0 s` | `private, no-store` | Bypassed | Bypassed | Authenticated mutations & exports never enter CDN or `api_cache` |

Rationale for keeping `max-age=0` on the browser while setting `s-maxage` +
`stale-while-revalidate` for Vercel Edge: TanStack Query already owns client-side
freshness (`staleTime`), so the browser never double-caches stale HTTP bodies in
its disk cache, while Vercel's shared Edge POPs absorb traffic spikes and manual
refreshes without cold-starting serverless functions or hitting Supabase on every
read.

### 2.3 Honest Freshness Under Edge ISR (`fetchedAt` vs. Static `age`)

Previously, [server/contract.ts](../../server/contract.ts) emitted
`Cache-Control: no-store`, and [server/routes.ts](../../server/routes.ts)
injected `"age": N` dynamically on every response. Under Edge ISR, a response
body cached at the CDN edge keeps whatever JSON was serialized when the edge
node fetched it — meaning a static `"age": 0` integer would stay frozen at `0`
even 40 seconds later.

**Decision:**

1. Every `200` JSON response from the public read routes injects
   `"fetchedAt": <epoch_ms>` (the timestamp when upstream actually answered),
   alongside `"age"` for backwards compatibility.
2. [src/lib/refresh.ts](../../src/lib/refresh.ts) derives the live age client-side
   via `Math.max(0, Math.floor((now - fetchedAt) / 1000))` whenever `fetchedAt`
   is present, falling back to `age` otherwise.
3. Result: `RefreshControl` (`F-19`, `AC-09`) continues to display an honest
   `"Cached, Ns ago"` hint whether the payload arrived from TanStack Query (L0),
   Vercel Edge ISR (L1), Function Memory (L2), or Supabase Postgres (L3).

---

## 3. Wise 500 MB Free-Tier Storage Engineering

Supabase Free Tier enforces a **500 MB total Postgres database size** (table
heaps + JSONB TOAST + B-tree indexes + `auth` schema + system catalogs) and
automatically pauses projects after **7 days of database inactivity**. Our
storage plan caps worst-case operational footprint at **303.5 MB (`60.7%`)**,
reserving **196.5 MB (`39.3%`)** of headroom for Postgres WAL, `VACUUM`, and
index churn.

### 3.1 "Strip Before Store" Payload Projection (`server/cache-projector.ts`)

Raw Clash of Clans JSON payloads carry fields the application never reads:
localized achievement requirement prose, legacy `league` objects replaced by
`leagueTier` in the 2025 rank rework ([04 §4](./04-api-strategy.md)), unused
badge size triplicates, and deep nested metadata. Before writing to
`public.api_cache`, a pure server projector (`server/cache-projector.ts`) strips
every field absent from the typed parsers in `src/api/*.ts`:

| Payload Kind | Raw Upstream Size | Projected Size | Savings | What Is Stripped |
|---|---|---|---|---|
| Player (`GET /players/{tag}`) | `~22.0 KB` | `~4.5 KB` | **-79%** | Achievement completion prose, legacy `league`, redundant icon URLs (`small`/`medium` where unused), unused clan war-preference metadata |
| Clan (`GET /clans/{tag}`) | `~34.0 KB` | `~8.5 KB` | **-75%** | Legacy `requiredTrophies`, per-member legacy `league` objects, redundant badge sizes, unused chat language metadata |
| Warlog (`GET /clans/{tag}/warlog`) | `~28.0 KB` | `~6.0 KB` | **-78%** | Capped to latest 50 entries; strips opponent/clan badge URL variants not rendered by `WarlogTable`/`WarlogCard` |
| Current War (`GET /clans/{tag}/currentwar`) | `~18.0 KB` | `~5.5 KB` | **-69%** | Strips unused badge sizes and full per-attack order metadata outside attack count, stars, destruction |

### 3.2 Per-Table Storage Budget (Hard 303.5 MB Ceiling)

| Table | Purpose | Avg Row Size (incl. index + 20% bloat) | Hard Row Cap | Max Storage | Eviction & Cap Mechanism |
|---|---|---|---|---|---|
| `auth.users` & `auth.*` | Supabase Auth accounts & sessions | `~2.5 KB` | `10,000` | **`25.0 MB`** | Unverified accounts older than 30 days pruned |
| `public.profiles` | Display handle, preferences JSONB, ToS consent (`terms_accepted_at`, `terms_version`) | `~0.6 KB` | `10,000` | **`6.0 MB`** | `ON DELETE CASCADE` from `auth.users` |
| `public.linked_coc_accounts` | 1:1 Verified CoC player binding per user (`user_id` PK, unique `player_tag`, `player_name`, `town_hall_level`, `clan_tag`, `verified_at`) | `~0.5 KB` | `10,000` | **`5.0 MB`** | **1:1 constraint (`user_id` PK, `player_tag` unique)** — strictly 1 bound CoC account per user |
| `public.user_saved_entities` | Bookmarked clans/players, role notes, saved compare pairs, cloud recent searches | `~0.35 KB` | `100,000` | **`35.0 MB`** | Trigger enforces max **25 bookmarks + 10 compare pairs + 10 recent searches** per user |
| `public.player_progression_snapshots` | Daily scalar summary for bound accounts (`rushed_pct`, category `%`s, `th_level`, `trophies`, `war_stars`, `donations`, `hero_levels_sum`) | `~0.25 KB` | `250,000` | **`62.5 MB`** | **No raw unit arrays.** Max 1 row/day per bound tag *only when metrics change*; ring-buffer trigger prunes beyond **90 snapshots per tag** |
| `public.api_cache` | Shared L3 SWR cache (`clan`, `player`, `war`, `warlog`, hot `search`) | `~8.0 KB` | `20,000` | **`160.0 MB`** | TTL expiry + LRU eviction by `last_accessed_at` above `20,000` rows (`search` capped at `2,000` rows, 15m TTL) |
| `public.entity_stats` & `public.platform_stats_daily` | In-place counters per observed clan/player + 1 summary row per calendar day | `~0.4 KB` | `25,000` | **`10.0 MB`** | Atomic `INSERT ... ON CONFLICT DO UPDATE` counters; **zero raw event log rows**; stale 1-view rows pruned above 20k |
| **Total Budgeted Ceiling** | **All Auth + App + Cache + Stats Tables** | — | — | **`303.5 MB`** | **`196.5 MB` (`39.3%`) free buffer** below 500 MB |

### 3.3 Three-Tier Watermark Guard & 7-Day Pause Prevention

Even with per-table row caps, varying payload sizes or TOAST bloat could push
database size upward. A single idempotent SQL RPC,
`public.run_storage_maintenance()`, inspects `pg_database_size(current_database())`
and enforces three watermarks:

| Watermark Zone | Database Size | Automated Action |
|---|---|---|
| **Green** | `< 350 MB` (`< 70%`) | Delete expired `api_cache` rows (`now() >= expires_at`); keep top `20,000` `api_cache` rows by `last_accessed_at` (`2,000` max for `search`); keep latest `90` rows per tag in `player_progression_snapshots`. |
| **Yellow** | `350 MB – 425 MB` (`70% – 85%`) | All Green sweeps, plus purge all `search` and `war` rows from `api_cache` immediately and tighten `api_cache` LRU cap from `20,000` to `10,000` rows. |
| **Red** | `> 425 MB` (`> 85%`) | Emergency shedding: trim `api_cache` to top `2,500` most-accessed `clan`/`player` rows, trim `player_progression_snapshots` to `30` per tag, prune `entity_stats` rows with `view_count = 1` older than 14 days, and report `storagePressure: 'high'` in `/api/stats`. |

**Execution schedule & keepalive:**
1. Supabase `pg_cron` executes `SELECT public.run_storage_maintenance();` daily
   at `03:00 UTC`.
2. A lightweight GitHub Actions schedule (`.github/workflows/supabase-keepalive.yml`)
   calls `GET /api/stats?maintenance=1` (authenticated with a server-side
   `CRON_SECRET` header) every **3 days** so the free-tier database never pauses
   from Supabase's 7-day inactivity rule.

---

## 4. Recommended Player & Community Data Beyond Auth

To give registered players and clan leaders meaningful utility without risking
the 500 MB ceiling, M5 stores **four ultra-compact datasets** alongside
`auth.users`, `profiles`, and `linked_coc_accounts`:

| Dataset | Why We Store It (vs. Alternative) | Footprint | User-Facing Surface |
|---|---|---|---|
| **1. Scalar Progression Snapshots (`player_progression_snapshots`)** | Storing raw 22 KB player JSONs daily would fill 500 MB in ~22,000 snapshots. Storing **only the computed engine output scalars** (`rushed_pct`, 5 category `%`s, `th_level`, `trophies`, `war_stars`, `hero_levels_sum`, `donations`) costs **250 bytes/row** (`~90×` smaller) and only inserts when a bound profile is viewed and its metrics changed. | `~250 B/row` (`22.5 KB` max per bound tag) | `/profile` and `/player/:tag`: *"30-Day Delta: Rushed deficit improved by -2.4% · +14 Hero levels"* |
| **2. Cloud Watchlist, Role Notes & Compare Pairs (`user_saved_entities`)** | Clan leaders screening applicants or tracking war rivals can bookmark up to **25 Players/Clans** with a 32-char tag (`"Applicant"`, `"War Rival"`, `"Main Clan"`, `"Alt"`), save **10 Compare pairs**, and sync **10 Recent Searches** across devices (merging with `localStorage`). | `~350 B/row` (`< 16 KB` max per user) | `/profile`, `/`, `/clans`, `/compare`, `/player/:tag`, `/clan/:tag` |
| **3. Persistent Audit Preferences (`profiles.preferences` JSONB)** | Persists the co-leader's custom Donation Balance target ratio (e.g. `1.5 : 1` instead of resetting to `1 : 1` on reload), default village tab, theme choice, and anonymous benchmark opt-out (`show_on_community_stats`). | `~200 B` (in `profiles`) | `/settings` & `/clan/:tag` (`Needs Attention` tab) |
| **4. Aggregated TH Benchmarks & Entity Popularity (`entity_stats` + `platform_stats_daily`)** | Every proxy fetch atomically updates one 400-byte summary row (`tag`, `kind`, `name`, `th_or_level`, `rushed_pct`, `donation_health_pct`, `view_count`, `compare_count`, `last_seen_at`) and increments daily counters — **zero raw analytics event logs**. | `~400 B/row` (`<= 10 MB` max) | `/` (Platform Pulse & Trending), `/players`, `/player/:tag` (TH Peer Percentile), `/clans`, `/compare` |

---

## 5. Postgres Schema, Indexes, Triggers & RLS Policies

All application tables live in `public`, enable **Row-Level Security (RLS)**,
and isolate user-owned rows via `auth.uid() = user_id`. The cache and aggregate
tables (`api_cache`, `entity_stats`, `platform_stats_daily`) are written
exclusively by the Vercel serverless tier using `SUPABASE_SERVICE_ROLE_KEY`.

```sql
-- 1. User profiles (1:1 with auth.users; cascades on delete)
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  terms_accepted_at timestamptz not null,
  terms_version text not null default '2026-11-v1',
  show_on_community_stats boolean not null default true,
  preferences jsonb not null default '{"donationRatio": 1.0, "defaultVillage": "home", "theme": "system"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Verified Clash of Clans account binding (strict 1:1 per user account)
create table public.linked_coc_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_tag text not null unique,
  player_name text not null,
  town_hall_level smallint not null,
  clan_tag text,
  clan_name text,
  verified_at timestamptz not null default now()
);

create index idx_linked_coc_tag on public.linked_coc_accounts (player_tag);

alter table public.linked_coc_accounts enable row level security;
create policy "Users read own binding" on public.linked_coc_accounts
  for select using (auth.uid() = user_id);
create policy "Users delete own binding" on public.linked_coc_accounts
  for delete using (auth.uid() = user_id);
-- Inserts/rebinds are gated through POST /api/account/bind-coc (service role) after CoC verifytoken succeeds.

-- 3. Cloud-synced bookmarks, compare pairs, and recent searches
create table public.user_saved_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('player_bookmark', 'clan_bookmark', 'compare_pair', 'recent_search')),
  target_key text not null,          -- e.g. '#2JPCYP98L' or 'players:#AAA|#BBB'
  label text,                        -- cached display name
  note text check (char_length(note) <= 48),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, target_key)
);

create index idx_saved_user_kind on public.user_saved_entities (user_id, kind, updated_at desc);

alter table public.user_saved_entities enable row level security;
create policy "Users manage own saved entities" on public.user_saved_entities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Compact scalar progression snapshots for bound tags (ring buffer max 90/tag)
create table public.player_progression_snapshots (
  player_tag text not null,
  snapshot_date date not null default current_date,
  town_hall_level smallint not null,
  rushed_pct numeric(5,2) not null,
  heroes_pct numeric(5,2),
  troops_pct numeric(5,2),
  spells_pct numeric(5,2),
  equipment_pct numeric(5,2),
  pets_siege_pct numeric(5,2),
  hero_levels_sum smallint not null default 0,
  trophies integer not null default 0,
  war_stars integer not null default 0,
  donations integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (player_tag, snapshot_date)
);

alter table public.player_progression_snapshots enable row level security;
create policy "Users read snapshots for own bound tags" on public.player_progression_snapshots
  for select using (
    exists (
      select 1 from public.linked_coc_accounts a
      where a.player_tag = player_progression_snapshots.player_tag
        and a.user_id = auth.uid()
    )
  );

-- 5. Shared L3 SWR Cache (server-only via service role)
create table public.api_cache (
  cache_key text primary key,        -- e.g. 'clan|#2JPCYP98L'
  route_kind text not null check (route_kind in ('search', 'clan', 'player', 'war', 'warlog')),
  status smallint not null,
  payload jsonb not null,
  byte_size integer not null,
  fetched_at timestamptz not null,
  fresh_until timestamptz not null,
  swr_until timestamptz not null,
  expires_at timestamptz not null,
  last_accessed_at timestamptz not null default now()
);

create index idx_api_cache_evict on public.api_cache (route_kind, last_accessed_at asc);
create index idx_api_cache_expires on public.api_cache (expires_at asc);
alter table public.api_cache enable row level security;
-- No public policies: accessed solely by Vercel functions via SUPABASE_SERVICE_ROLE_KEY.

-- 6. In-place entity & Town Hall benchmark aggregates (no raw event rows)
create table public.entity_stats (
  entity_key text primary key,       -- e.g. 'player|#ABC' or 'clan|#XYZ'
  kind text not null check (kind in ('player', 'clan')),
  tag text not null,
  name text not null,
  th_or_level smallint not null,     -- townHallLevel for player, clanLevel for clan
  rushed_pct numeric(5,2),           -- populated on player detail/bind
  donation_health_pct numeric(5,2),  -- populated on clan detail
  members_count smallint,
  view_count integer not null default 1,
  compare_count integer not null default 0,
  is_verified_bound boolean not null default false,
  last_seen_at timestamptz not null default now()
);

create index idx_entity_stats_trending on public.entity_stats (kind, view_count desc, last_seen_at desc);
create index idx_entity_stats_th on public.entity_stats (kind, th_or_level, rushed_pct) where rushed_pct is not null;
alter table public.entity_stats enable row level security;
create policy "Public read entity stats" on public.entity_stats for select using (true);

-- 7. Daily platform summary counters (1 row per UTC day)
create table public.platform_stats_daily (
  stat_date date primary key default current_date,
  player_audits integer not null default 0,
  clan_audits integer not null default 0,
  comparisons_run integer not null default 0,
  cache_hits integer not null default 0,
  upstream_calls integer not null default 0
);

alter table public.platform_stats_daily enable row level security;
create policy "Public read daily platform stats" on public.platform_stats_daily for select using (true);
```

Row-cap triggers (`enforce_max_saved_entities` capping `25` bookmarks / `10`
compare pairs / `10` recent searches per `user_id`, and
`trim_progression_ring_buffer` keeping the newest `90` snapshots per
`player_tag`) execute inside `T-M5-1` migrations alongside the 1:1
`linked_coc_accounts` constraints and `public.run_storage_maintenance()`.

---

## 6. Official Clash of Clans Account Binding (`POST /players/{playerTag}/verifytoken`)

Supercell exposes an official third-party player verification endpoint on the
Clash of Clans Developer API. Unlike OAuth, the player proves ownership by
generating an ephemeral rolling token inside the game client.

### 6.1 Step-by-Step Binding Handshake

1. **In-Game Token Retrieval**: Inside Clash of Clans, the user opens
   **Settings (gear icon) → More Settings → API Token → Show** and copies the
   short verification string.
2. **Client Submission**: On `/profile` (signed in), the user submits their
   `playerTag` (normalized via [src/lib/tag.ts](../../src/lib/tag.ts)) and
   `apiToken` to `POST /api/account/bind-coc` with their Supabase session JWT in
   `Authorization: Bearer <access_token>`.
3. **Server Verification**:
   - The Vercel serverless handler validates the Supabase JWT using
     `SUPABASE_SERVICE_ROLE_KEY`.
   - It calls `POST ${COC_API_BASE_URL}/players/${encodeTag(tag)}/verifytoken`
     through the RoyaleAPI proxy with header `Authorization: Bearer ${COC_API_TOKEN}`
     and JSON body `{ "token": apiToken }`.
4. **Outcome Handling**:
   - **`200 { "status": "ok" }`**:
     - Fetch the player profile (reusing L2/L3 cache or `/players/{tag}`) to read
       `name`, `townHallLevel`, and `clan` (`tag`, `name`).
     - Compute the initial `computeRushed(...)` scalar summary server-side (from
       the verified response payload via a shared pure engine call — see note
       below), upsert the user's **1:1 binding** into `public.linked_coc_accounts`
       (on `user_id`), and insert the initial row into
       `public.player_progression_snapshots`.
     - **Discard `apiToken` immediately** — it is never written to Postgres,
       never cached, and never logged.
   - **`400 invalidToken` / `403 accessDenied` / non-`ok` status**:
     - Return `422 { "error": "invalid_coc_token", "tag": "#..." }` so the UI
       displays a clear retry prompt pointing back to in-game **More Settings**.
   - **Tag already bound to a different user account (`unique (player_tag)`)**:
     - Return `409 { "error": "bad_request", "detail": "This Clash of Clans tag is already bound to another account" }`
       until the prior user unbinds it. Users may unbind/rebind their own
       1:1 village from `/profile` at any time via `DELETE /api/account/bind-coc`.

> **Boundary Note (`01 §3`):** To preserve the rule that `src/engines/` stays
> pure TypeScript with zero framework/network imports, `server/` may import the
> pure `computeRushed` and `playerToUnitEntries` functions during `bind-coc` /
> `player` stats recording without duplicating any scoring math.

---

## 7. Database-Powered Statistics & New Screens

### 7.1 Live Statistics API (`GET /api/stats`) & Surface Integration

`GET /api/stats` serves a compact JSON summary cached with
`Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=1800`
containing:
- `platform`: `{ totalPlayerAudits, totalClanAudits, totalComparisons, verifiedBoundVillages, cacheHitRatePct, storagePressure }`
- `benchmarksByTh`: per-Town-Hall `{ townHallLevel, sampleCount, avgRushedPct, medianRushedPct }`
- `clanBenchmark`: `{ sampleCount, avgDonationHealthPct }`
- `trending`: `{ clans: [...top 5], players: [...top 5] }`

How each screen consumes `/api/stats` and Supabase data:

| Screen | Database-Driven Upgrade | Offline / Fallback Behavior |
|---|---|---|
| **Home (`/`)** ([HomeScreen.tsx](../../src/screens/HomeScreen.tsx)) | 1. **Platform Pulse Strip**: live counts (*Profiles Audited*, *Clans Analyzed*, *Comparisons Run*, *Verified Villages*, *Cache Hit %*).<br/>2. **Engine Showcase Cards**: live community averages inside the 3 showcase cards (*Community Avg Rushed %*, *Avg Clan Donation Health %*, *Trending Matchup*).<br/>3. **Trending Audited Strip**: quick-jump chips to top audited clans & players.<br/>4. **My Bound Village Card** (signed-in users): one-tap *"Audit My Village"* and *"Open My Clan"*. | Falls back seamlessly to the existing sample constants when `/api/stats` is loading or offline. |
| **Players (`/players`, `/player/:tag`)** | 1. **Town Hall Peer Benchmark Chip** on `/player/:tag`: compares the player's rushed % against the Supabase average for their exact TH (*"Better than 74% of audited TH16 profiles"*).<br/>2. **Verified Owner Shield Badge** when `is_verified_bound = true`.<br/>3. **30-Day Progression Delta Banner** for bound villages with `>= 2` snapshots.<br/>4. **Bookmark Toggle** syncing to `user_saved_entities` (or `localStorage` when signed out). | Peer benchmark hides gracefully if sample count `< 5` or offline. |
| **Clans (`/clans`, `/clan/:tag`)** | 1. **Popular & Recently Audited Clans** panel on `/clans` before a search query is submitted.<br/>2. **Community Donation Benchmark** comparison on the `Needs Attention` tab.<br/>3. **Bookmark Clan Toggle** + user's persisted Donation Target Ratio from `profiles.preferences`. | `/clans` shows the standard search prompt when offline; target ratio defaults to `1:1`. |
| **Compare (`/compare`)** | 1. **"Use My Bound Village / Clan"** one-tap fill button on Entity A when signed in.<br/>2. **Saved Compare Pairs** & **Popular Community Matchups** strip below the main launch card. | Works identically to v1 with manual tag/name inputs. |

### 7.2 New Routes & Screens

All four new routes follow [07-design-language.md](./07-design-language.md) and
the 4-state matrix ([06 §3](./06-data-flow-and-caching.md)):

1. **`/auth` (`AuthScreen.tsx`) — Login & Account Creation**:
   - Mode toggle (`Sign In` | `Create Account`), controlled inputs (`Email`,
     `Password`, `Display Name` on sign-up) validated client-side (`STD-19`,
     `STD-38`).
   - Mandatory **Terms & Data Privacy consent checkbox** on account creation
     linking directly to `/terms`, persisting `terms_accepted_at` and
     `terms_version`.
   - `Sign In` / `Profile` navigation controls added to
     [NavBar.tsx](../../src/components/NavBar.tsx) beside `ThemeToggle`.
2. **`/profile` (`ProfileScreen.tsx`) — Profile & 1:1 Bound CoC Account**:
   - Account header (display name, email, joined date, binding status chip).
   - **CoC Account Binding Manager (1:1 per user account)**: Player Tag +
     In-Game API Token form with visual 3-step instructions (*Settings → More
     Settings → API Token → Show*) when unbound, or the user's bound village
     card (*"Audit Village"*, *"Open Clan"*, *"Unbind / Change Village"*).
   - **My Progression Snapshot History**: Table/trend view of the bound
     village's scalar progression snapshots.
   - **Saved Watchlist & Compare Pairs**: Tabbed manager over `user_saved_entities`.
3. **`/settings` (`SettingsScreen.tsx`) — Preferences & Self-Service Data Controls**:
   - Persistent **Audit Preferences** (default Donation Target Ratio, default
     village tab, theme choice).
   - **Privacy Toggle**: `show_on_community_stats` (*"Include my bound village
     in anonymous Town Hall benchmark statistics"*).
   - **Data Rights Controls**: *"Export My Data (JSON)"*, *"Clear Cloud
     History"*, and *"Delete Account & Purge All Data"* (with confirmation dialog
     calling `DELETE /api/account/me` via service role so `auth.users` and all
     cascaded rows vanish immediately).
4. **`/terms` (`TermsScreen.tsx`) — Terms & Conditions About Data**:
   - Plain-language disclosure covering:
     1. Supercell Fan Content Policy & non-affiliation;
     2. Exact inventory of data stored for registered accounts (`profiles`,
        `linked_coc_accounts`, `user_saved_entities`, `player_progression_snapshots`);
     3. Explicit guarantee that **in-game CoC API verification tokens are
        used once and never stored**;
     4. How public CoC API responses are cached under Edge ISR + Supabase SWR
        with automatic 500 MB storage eviction;
     5. Self-service export and instant deletion rights on `/settings`.
   - Linked in [Footer.tsx](../../src/components/Footer.tsx), `AuthScreen.tsx`,
     and `SettingsScreen.tsx`.

---

## 8. Key & Bundle Hygiene (`NFR-04` Extension)

| Variable | Scope | Where Set | Security Rule |
|---|---|---|---|
| `COC_API_TOKEN` | Server-only | Vercel env + `.env` | Never in client bundle; scanned by `scripts/scan-bundle-secrets.mjs` |
| `COC_API_BASE_URL` | Server-only | Vercel env + `.env` | Points at `https://cocproxy.royaleapi.dev/v1` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Vercel env + `.env` | Bypasses RLS for L3 cache writes & `verifytoken` upserts; **added to `scripts/scan-bundle-secrets.mjs`** |
| `CRON_SECRET` | Server-only | Vercel env + GitHub Secrets | Authenticates 3-day keepalive & maintenance sweep |
| `VITE_SUPABASE_URL` | Client-safe public URL | Vercel env + `.env` | Public project endpoint (`import.meta.env`) |
| `VITE_SUPABASE_ANON_KEY` | Client-safe anon key | Vercel env + `.env` | Public anon key; all direct client table access gated by strict Postgres RLS (`auth.uid() = user_id`) |
