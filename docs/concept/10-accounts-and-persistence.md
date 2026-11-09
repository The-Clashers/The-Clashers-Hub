# 10 - Accounts & Persistence (the Supabase phase)

**Status: Draft proposal** (session 36, 11-09-2026). No code rides with this
doc; it is the plan of record for review. The storage ladder promised rung 2
"its own concept doc before any code" ([06 §"Storage ladder"](./06-data-flow-and-caching.md));
this is that doc. On activation it amends the five decisions listed in
[section 13](#13-what-this-amends-on-activation), in the same PR as the first
line of code, per the definition of done ([08 §4](./08-roadmap.md)).

## 1. Why this doc exists

The owner's ask, four parts: user accounts, binding a Clash of Clans account
through the in-game code, analytics on the home screen, and a players screen
that is more than a box and a footnote. v1 answered all four with "no": no
accounts, no tracker, live data only, tag-only lookup ([00 §5](./00-overview.md)).
That was the semester contract and it shipped. The risk register's scope-creep
row was written to stop *drift*, features creeping in without a decision; this
is not drift. This is the owner deciding, on the record, to climb the storage
ladder one rung, and paying the toll the ladder demands: the concept doc
before the code ([T-P-3](./02-requirements-tracker.md)).

What v1 built is not thrown away. The line we keep, in three sentences:

- **No login wall.** Every v1 feature keeps working for an anonymous visitor.
  Accounts are opt-in memory, never a gate.
- **Read-only toward the game.** Binding verifies that a visitor owns a
  village; it never writes to Supercell and never pretends to ([CON-05](./02-requirements-tracker.md)).
- **The searcher stays the product.** Analytics augment the screens that
  exist; they do not replace search as the front door ([00 §4](./00-overview.md),
  pillar 1).

## 2. Why Supabase

The ladder already chose it ([06 §5](./06-data-flow-and-caching.md), rung 2:
"hosted Supabase free tier"), and the choice holds up against the
alternatives on the constraint that decides everything here, free tier plus
minimum moving parts:

| Need | Supabase free tier (verified 11-2026) | Our expected use |
|---|---|---|
| Database | 500 MB Postgres, 2 active projects | ~50 member rows per clan per day; years from the cap ([section 9](#9-schema-v1)) |
| Auth | 50,000 monthly active users | a clan, its friends, a class demo |
| Scheduled compute | 500,000 Edge Function invocations | 0 if the Vercel cron runs the sync ([section 10](#10-the-sync-job)) |
| Egress | 5 GB | a read-heavy community site, orders below |
| The catch | projects pause after 1 week of inactivity | the daily sync is the heartbeat that keeps it awake |

One box answers auth, Postgres, row level security, and scheduling, each of
which the alternatives would make us assemble separately: Firebase gives auth
plus a document store with no SQL story for roster diffs; PocketBase is
self-hosting, the ops class of problem the no-database decision existed to
avoid ([06 §4](./06-data-flow-and-caching.md)); Neon or Vercel Postgres is a
database only, leaving auth, cron, and row security as more parts to own.
Supabase is also the one name the ladder already blessed, which matters for
review cost: nobody has to re-litigate the vendor, only the schema.

## 3. Architecture: the third boundary

```
Browser
  │   React Native for Web app (unchanged shape)
  │   TanStack Query + supabase-js (project URL + anon key, RLS-guarded)
  │   same origin for game data, HTTPS + JSON to Supabase for account data
  ▼
Vercel functions (the tier, same job plus three routes)
  │   existing: /api/search  /api/clan/:tag  /api/player/:tag
  │             /api/clan/:tag/war  /api/clan/:tag/warlog
  │   new:      POST /api/link/verify        (binding, section 5)
  │             GET  /api/clan/:tag/capital  (capital raids, section 6)
  │             POST /api/sync               (cron + shared secret, section 10)
  │   env: COC_API_TOKEN, COC_API_BASE_URL  (unchanged)
  │        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNC_SHARED_SECRET (new)
  ▼                        ▼
RoyaleAPI proxy ──► game API    Supabase (auth, profiles, bindings, snapshots)
```

The key boundary ([01 §3](./01-tech-stack.md)) grows from one rule to three
keys with three rules, because Supabase's design is that one of its keys is
public on purpose:

| Key | Where it lives | Why |
|---|---|---|
| `COC_API_TOKEN` | server env only, as today | the throttle-and-ban surface ([04 §7](./04-api-strategy.md)) |
| `SUPABASE_SERVICE_ROLE_KEY` | server env only, same rule | bypasses RLS; the tier's writes use it, the browser never does |
| Supabase anon key | the client bundle, by design | guarded by RLS, the documented Supabase model |

That third row is the one that changes a v1 sentence. "Never in a client
`import.meta.env` variable" ([04 §7](./04-api-strategy.md)) stays true for
*secrets*; the anon key is not one, and pretending it is would be worse than
naming it. The bundle scan's definition of secret therefore changes from "any
key-shaped string" to a named list: the CoC key and the service key are fatal
findings, the anon key is an explicit allowlist entry. NFR-04's rule
generalizes instead of weakening.

The analysis boundary ([01 §3](./01-tech-stack.md)) is untouched: engines stay
client-side pure TypeScript modules, no framework or network imports. The new
snapshot math (donation deltas, roster diffs, trend series) is new engine
code in `src/engines/` under the same rule, fed by rows fetched with
supabase-js the way screens today fetch tier JSON.

## 4. Accounts (ask 1)

**Decision: Supabase Auth, two doors, sign-in always optional.**

- **Door one, Discord OAuth.** The audience lives on Discord, it asks for no
  email, and it sidesteps the free tier's hardest limit: the built-in email
  provider sends **2 emails per hour, project-wide** (confirmations plus
  resets; verified against the Supabase rate-limit docs). A class demo where
  thirty people sign up with passwords in the same five minutes would exhaust
  that before it started.
- **Door two, email and password.** Kept, with the limit stated in the UI's
  expectation, not hidden: confirmation and reset mail can be slow on the
  free tier. If it ever hurts in practice the fix is a custom SMTP
  configuration, which is a settings change, not code; until then email is
  the secondary door, not the front one.

The profile row is minimal on purpose: `id` (the auth user), a display name,
timestamps. No avatar service, no bio, no settings beyond the game binding;
the product is not a social network, and every stored field is a field to
defend. The row is created by a trigger on `auth.users` so an account can
never exist without its profile.

**Screens.** Two new routes join the map ([03 §2](./03-features-list.md)):
`/login` (both doors, plus the state matrix every screen owes) and
`/settings`. The NavBar grows an account chip beside the theme toggle, the
same 44 px floor, showing "Sign in" or the display name. `/settings` hosts
the binding flow of [section 5](#5-binding-a-clash-of-clans-account-ask-2)
and, later, saved-player management. What an account unlocks is exactly the
list in [section 7](#7-the-players-screen-ask-4) plus the personal home strip
of [section 6](#6-home-analytics-ask-3); nothing that works today stops
working signed out.

## 5. Binding a Clash of Clans account (ask 2)

**The "CoC code" is the game's own API token**, and the game already tells
the player where it is: Settings > More Settings > scroll to the bottom >
Show next to **API Token** > Copy. It is the same mechanism the community's
Discord bots use to verify members, it cannot be used to steal or control
the account (it only proves identity to third-party services), it resets
periodically, and it invalidates after use, so a failed verification's first
hint is always "show the token again in game and re-copy it".

**The flow, four steps:**

1. The user types their player tag into `/settings`. The screen shows a
   preview from the existing `/api/player/:tag` route (name, Town Hall,
   clan) so they confirm the right village before anything is verified.
2. The user pastes the in-game API token.
3. The app calls **`POST /api/link/verify`** on our tier with the tag and
   token. The tier calls the official `POST /players/{tag}/verifytoken`
   upstream through the proxy, the only place the CoC key ever lives. The
   browser can never make this call itself without shipping the key.
4. On `status: "ok"` the tier inserts the binding with the service key
   ([section 3](#3-architecture-the-third-boundary)); anything else renders
   the failure state with the regenerate-token hint.

**Live observations from session 36** (through the proxy, the real key):
an unknown tag answers `200 {"status":"invalid"}`, while a real tag with a
wrong token answered `500 {"reason":"unknownException"}` on every format
tried. So the tier maps *both* shapes to one clean "did not verify" outcome
instead of trusting the upstream to be consistent, and the happy path, a
real in-game token answering `status: "ok"`, gets one live confirmation when
the binding card is built. That check is written on the card (T-M5-3), not
assumed here.

**The write and its rules.**

- One binding per player tag (`unique (player_tag)`): a village belongs to
  one account. Minis are additional rows under the same user, with
  `is_primary` marking the main.
- The browser never writes bindings. RLS makes that true by enforcement:
  `coc_accounts` is owner-read only, no client-side insert policy at all.
  The tier's service-key insert is the single write path.
- Unbinding deletes the row. Snapshots are keyed by tag, not user
  ([section 9](#9-schema-v1)), so the village's history survives an unbind,
  and an account deletion cascades profile and bindings while leaving the
  public history alone.
- Re-verification happens at bind time only. Reads are public game data
  either way; a later "prove it again" button is a stretch item, not a
  promise.

## 6. Home analytics (ask 3)

**Principle: the home stays a search-first front door.** The hero lookup and
the quick links stay above the fold exactly as they are; analytics render
below them as a "Clan at a glance" section, and every card links into the
existing clan screen rather than growing a new one. **Which clan**: signed in
with a binding, the bound clan; anonymous, the last-viewed clan in
localStorage, falling back to the project's own clan (Umbra Lunaria) as the
showcase, so the section never renders empty on a first visit.

The proposal splits in two phases, because the game API returns history for
wars and capital raids but nothing time-based for rosters: trends over
members are the only thing that truly needs the database.

**Phase A, live data, ships without snapshots** (four of the five widgets
read routes that already exist):

| # | Widget | Reads | Notes |
|---|---|---|---|
| A1 | Vitals strip: badge, level, members, points, war league, the W-T-L record, the win streak | `/api/clan/:tag` | one cached call; the numbers the clan screen already shows, digested |
| A2 | War log digest: last ten outcomes as W/L/T chips, win rate, average stars, average destruction | `/api/clan/:tag/warlog` | history arrives free from the API; no snapshot needed |
| A3 | Roster composition: Town Hall distribution, role split, league spread | `/api/clan/:tag` memberList | no extra fetch; SR-09's no-per-member rule holds |
| A4 | Donation health: top givers, worst ratios against the target | memberList + the donation engine (T-M1-5) | the engine already exists; this is a new consumer |
| A5 | Capital season: total loot, raids completed, districts destroyed, top contributors | **new** `/api/clan/:tag/capital` | the sixth tier route, 600 s TTL, the endpoint [04 §3](./04-api-strategy.md) deferred to P2 |

**Phase B, snapshot-backed, needs [section 10](#10-the-sync-job):**

| # | Widget | Reads | Notes |
|---|---|---|---|
| B1 | Weekly donation leaderboard | member snapshot deltas | the number members actually compete on |
| B2 | Joiners and leavers feed | roster diffs | the question every leader asks first |
| B3 | Trophy and points trends | clan and member snapshots | sparklines, react-native-svg, the sanctioned chart layer ([01 §1](./01-tech-stack.md)) |
| B4 | Town Hall upgrade feed | member snapshot diffs | "who is rushing up" as a feed |
| B5 | Activity watch | donation deltas | the API has no last-seen; an unmoved donation counter is the honest proxy, labeled as one |

Cut line for a compressed phase: A1 through A4 are the card; A5 and B1-B3
should ship; B4-B5 are stretch, cut without guilt ([03 §1](./03-features-list.md)
conventions).

## 7. The players screen (ask 4)

The game API's rule does not move: **no player search by name upstream**, a
tag is the only direct route to a player, and we never promise otherwise
([04 §4](./04-api-strategy.md)). What changes is everything around the tag
box, because the screen's honest emptiness is a placement problem, not a
data problem:

1. **The tag box stays the hero control**, TagInput unchanged (T-M1-2).
2. **Recent searches land here at last** (F-13): localStorage, tag, name,
   when; clearable; the screen's designed non-empty state for the anonymous
   visitor.
3. **Your accounts** (signed in): the bound tags as cards carrying the
   binding's snapshot identity, each opening `/player/:tag`.
4. **Clan directory**, the substantive one: the bound clan's roster fetched
   through the existing `/api/clan/:tag` route and **searched by name in the
   browser**. Name search over a roster we already hold is honest; it is not
   the global name search the API forbids, and the section's caption says
   so in one sentence. The sorts reuse `roster-sort`, the rows reuse the
   roster's card shape below 768 px.
5. **Saved players** (per account, the database): F-14's watchlist graduates
   from a P2 localStorage idea to an account feature, tags starred from any
   player screen.

## 8. Requirement deltas and task cards

Proposed rows for the tracker ([02](./02-requirements-tracker.md)), landing
in its tables at activation, IDs assigned to continue the series:

| ID | The system shall... | Priority |
|---|---|---|
| FR-19 | offer optional sign-in (Discord OAuth, email and password) with a minimal profile, where every feature that works for an anonymous visitor keeps working signed out | P0 |
| FR-20 | bind a Clash of Clans account by player tag plus the in-game API token, verified server-side through the tier's verify route, one binding per player tag, removable by the owner | P0 |
| FR-21 | render a clan-at-a-glance section on the home screen: live vitals, war log digest, roster composition, and donation health (phase A), plus snapshot-backed trends once the sync runs (phase B) | P1 |
| FR-22 | list the bound clan's roster on the players screen as a name-searchable directory alongside the tag box, recent searches, and saved players | P1 |
| FR-23 | snapshot the watched clans' rosters and clan stats once daily through a shared-secret sync route, with the watched set capped and old rows pruned | P1 |
| NFR-10 | run the persistence tier on the Supabase free plan, with the service key server-side only and the anon key explicitly allowlisted in the bundle scan | P0 |

The phase's board, mirroring [02 §11](./02-requirements-tracker.md)
conventions (owner labels, pomodoro estimates):

| ID | Task | Owner | Estimate | Covers |
|---|---|---|---|---|
| T-M5-1 | Supabase project, schema v1 as a reviewed migration, env wiring, scan-script key rules | Platform | 10 | NFR-10 |
| T-M5-2 | Auth doors, `/login`, `/settings`, the NavBar account chip, session-aware query client | Screens | 12 | FR-19 |
| T-M5-3 | The binding flow: `/api/link/verify` on the tier, the settings UI, the live happy-path smoke | Platform + Screens | 10 | FR-20 |
| T-M5-4 | Home phase A: the five live widgets and the new capital tier route | Screens | 12 | FR-21 |
| T-M5-5 | The sync job and snapshot tables, then phase B widgets and the diff engines | Platform + Engines | 14 | FR-23, FR-21 |
| T-M5-6 | Players screen surface: recents, your accounts, the clan directory, saved players | Screens | 10 | FR-22 |
| T-M5-7 | Docs reconciliation: the five amendments of section 13 plus the 02 rows above | All | 4 | T-P-3 |

## 9. Schema v1

```sql
-- One row per auth user, trigger-created so an account never exists
-- without its profile.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A verified game-account binding. Written only by the tier (service key);
-- the browser has no insert path, RLS enforces it.
create table public.coc_accounts (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  player_tag         text not null,            -- canonical '#UPPERCASE'
  is_primary         boolean not null default false,
  verified_at        timestamptz not null default now(),
  snapshot_name      text,                     -- last known identity, rendered
  snapshot_town_hall int,                      -- without a refetch
  snapshot_clan_tag  text,
  snapshot_clan_name text,
  created_at         timestamptz not null default now(),
  unique (player_tag),                        -- a village belongs to one account
  unique (user_id, player_tag)
);

-- The daily accumulator: what the clan was, so trends become computable.
create table public.clan_snapshots (
  id             bigint generated always as identity primary key,
  clan_tag       text not null,
  captured_at    timestamptz not null default now(),
  members        int,
  clan_points    int,
  capital_points int,
  war_wins       int,
  war_ties       int,
  war_losses     int,
  war_win_streak int,
  war_league     text,
  unique (clan_tag, captured_at)
);

create table public.member_snapshots (
  id                     bigint generated always as identity primary key,
  clan_tag               text not null,
  captured_at            timestamptz not null default now(),
  player_tag             text not null,
  name                   text,
  role                   text,
  town_hall              int,
  trophies               int,
  builder_base_trophies  int,
  donations              int,
  donations_received     int,
  exp_level              int,
  league_tier            text,
  clan_rank              int,
  previous_clan_rank     int,
  unique (clan_tag, player_tag, captured_at)
);

create index on public.member_snapshots (clan_tag, captured_at);
create index on public.member_snapshots (player_tag);

-- Row level security: the rules stated as enforcement, not convention.
alter table public.profiles        enable row level security;
alter table public.coc_accounts    enable row level security;
alter table public.clan_snapshots  enable row level security;
alter table public.member_snapshots enable row level security;

create policy "profiles are public read"
  on public.profiles for select using (true);
create policy "own profile write"
  on public.profiles for update using (auth.uid() = id);

-- Bindings: the owner reads them; nobody writes them client-side.
create policy "bindings are owner read"
  on public.coc_accounts for select using (auth.uid() = user_id);

-- Snapshots are public game data (06 section 6's stance, unchanged):
-- public read, service-role write only.
create policy "clan snapshots are public read"
  on public.clan_snapshots for select using (true);
create policy "member snapshots are public read"
  on public.member_snapshots for select using (true);
```

Volume math, so the free tier stays a fact rather than a hope: one clan of
50 members snapshot daily is ~18,000 member rows a year, a few megabytes
with indexes; the 500 MB cap is years away even with the cap of watched
clans at five. The sync route prunes member snapshots older than 18 months
in the same run, one statement, so retention is a line of code instead of a
policy document.

## 10. The sync job

**Decision: a Vercel cron, once daily, calling a secret-guarded tier route.**
The Hobby plan allows two cron jobs and caps them at once per day (verified),
which is not a constraint but a match: daily is exactly the cadence a clan's
roster deserves.

- `POST /api/sync`, guarded by the `SYNC_SHARED_SECRET` header. This is the
  [04 §7](./04-api-strategy.md) optional hardening finally earning its keep;
  an unauthenticated route that triggers upstream calls would be a scraper's
  free lever.
- The job reuses the tier's own upstream client and cache internally, no
  HTTP self-calls, fetches each watched clan's clan, warlog, and
  capital-raid payloads, and writes the snapshot rows with the service key.
  Failures map through the existing error contract; the next day's run
  heals a missed day, and the gap renders as a gap, not a lie.
- **The watched set**: clans with at least one active binding, the home clan
  always included, capped at five while the throttle math stays boring
  ([04 §8](./04-api-strategy.md)).
- The alternative, a Supabase scheduled Edge Function calling the tier, is
  noted and declined: it would work, but the Vercel cron keeps every key in
  one place, and key locality is the boundary this project defends.

## 11. Privacy, updated

[06 §6](./06-data-flow-and-caching.md)'s stance generalizes instead of
reversing:

- **Account data is minimal**: an email or a Discord identity, a display
  name, the bound tags. Nothing else is stored, because everything else is
  a breach liability with no product value.
- **Snapshots are public game data**, the same numbers the game shows any
  clan visitor, keyed by tag with no account linkage.
- **Deletion is real**: unbind removes the binding row; account deletion
  cascades profile and bindings; the village's public history in snapshots
  survives, as it would on any stats site.
- **The scan script's allowlist** names the anon key; the CoC key and the
  service key remain fatal findings, and the service key lives under the
  same env discipline the CoC key already has.

## 12. Risks

New rows for [08 §3](./08-roadmap.md), joining the register rather than
replacing it:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free project pauses after a week of inactivity | low | medium (auth + reads stop) | the daily sync is the heartbeat; a paused project also pauses the cron's writes, so the failure is visible in the data, not silent |
| RLS misconfiguration leaks or blocks wrongly | medium | high | the activation PR walks a policy checklist: anon read, second-user read, client insert attempts, each expected to fail or pass on record |
| verifytoken's wrong-token 500 (observed live) | certain | low | the tier maps it to the same clean failure as `status: invalid`; the happy path gets its live smoke on the card |
| Email rate limit (2 per hour, built-in provider) | certain while email is a front door | low | Discord is the front door; email stays secondary; custom SMTP is a settings change if it ever matters |
| Snapshot scope creep (many watched clans) | medium | medium (throttle + storage) | the watched-set cap of five and the 18-month prune; raising the cap is a docs-sized decision |
| The old scope-creep risk itself | high | high | the line of [section 1](#1-why-this-doc-exists): no login wall, read-only toward the game, the searcher stays the product; any PR that blurs it gets closed with a link here |

## 13. What this amends on activation

Five decisions change, each in the same PR as the first code that needs it
(the definition of done's rule 5). Until that PR lands, the v1 text stands
exactly as written, and the pointer notes added alongside this proposal
mark where the change will land:

1. [00 §5](./00-overview.md): "no accounts" becomes "no login wall";
   "not a tracker" becomes "one daily snapshot job, capped and pruned".
2. [01 §4](./01-tech-stack.md): the budget table's Database row changes
   from none to the Supabase line with its limits.
3. [CON-06](./02-requirements-tracker.md): restated as v1-scoped; the
   phase adds the database under CON-01's free-only rule, which still holds.
4. [06 §4 and §5](./06-data-flow-and-caching.md): the no-database decision
   becomes the v1 decision record; rung 2 is activated by this doc.
5. [08 §3](./08-roadmap.md): the scope-creep row's mitigation gains the
   clause "the ladder is climbable by owner decision with a concept doc
   first", because that is what happened.

**Activation checklist** (the first code PR, T-M5-1, carries it): create the
Supabase project; land schema v1 as a reviewed migration; set the three new
Vercel env vars; teach the scan script its named keys; amend the five
decisions above in that PR; land the 02 rows of [section 8](#8-requirement-deltas-and-task-cards);
smoke the verify happy path with a real in-game token (T-M5-3's first
check). Nothing in this doc ships a line of code before that PR exists.
