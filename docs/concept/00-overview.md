# 00 - Product Overview

**Project:** The Clashers Hub
**Form:** a web application built with React Native for Web
**Team:** Three developers, one semester
**Budget:** free-tier Vercel server

## 1. The pitch

The Clashers Hub is a **clan and player searcher with the analytics turned on**.
Type a clan name, any clan in the game, and get its live roster with donation
flags. Open any member and get a full account read: how rushed the profile is,
unit-by-unit progression with icons, hero and achievement progress, war
reliability. Put two players or two clans side by side and compare them
metric by metric. Core search and detail routes open directly on live public
game data, while Milestone 5 implements Supabase user accounts and login
(`/auth`) with 1:1 Clash of Clans profile binding, compact progression
snapshots, cloud watchlists, and live community benchmark statistics
([10](./10-database-and-isr-architecture.md)).

## 2. The problem we solve

Clash of Clans is a ten-year-old game with a public developer API, which means
the data for every clan and player is one HTTP call away. But access is not the
problem: **interpretation is**. The in-game profile shows raw counters; stat
websites show walls of numbers. Neither answers the questions people actually
ask:

- A clan leader screening an applicant wants to know *how developed this account
  really is*, not just the Town Hall level on the badge. Is the lab keeping up
  with the Town Hall? Are heroes behind? Are troops still at low levels?
- A co-leader reviewing the roster wants to know *who never donates back*,
  without scrolling 50 rows of two counters and doing division in their head.
- A war organizer wants to know *who actually uses their attacks*, not who is
  merely listed on the roster.
- Players checking their own account want an honest audit: what is maxed, what
  is neglected, and where they stand versus a clan-mate.

All of these are **computed judgments over data the API already returns**. That
is the gap The Clashers Hub fills: we fetch live data and turn it into verdicts.

## 3. Who it is for

| User | Their scenario | What they get |
|---|---|---|
| Clan leaders / co-leaders | Screening an applicant before accepting | Rushed analysis + war reliability in one screen |
| Players auditing themselves | "What should I upgrade next? Am I behind?" | Category-by-category deficit breakdown |
| Groups of friends | "Who's more rushed, you or me?" | Side-by-side compare mode |
| Recruiters for competitive clans | Quick roster health check | Donation balance flags, participation stats |

We build for ourselves first: every teammate plays the game and is user #1.

## 4. Product pillars

1. **Search-first UX.** The home screen is a search box. The product never asks
   the user to configure anything before delivering value.
2. **Analysis, not just display.** Every screen pairs raw numbers with a
   computed verdict (a flag, a percentage, a rank). Display-only screens are a
   missed opportunity in this product category.
3. **Compare anything.** Any two players, any two clans, side by side, metric
   by metric. Comparison is the demo moment.
4. **Shareable web with integrated accounts.** Every public lookup and compare
   screen has a clean shareable URL, and user accounts (`/auth`, `/profile`,
   `/settings`) integrate directly into the navigation chrome for verified 1:1
   CoC binding, progression history, and synced watchlists.

## 5. Scope and non-goals

**In scope:** live, read-only, public game data for any clan or player:
search, clan detail, player detail, war views, compare, plus Milestone 5's
shared Edge ISR + Supabase SWR cache, Supabase user login and 1:1 CoC-bound
accounts (`/auth`, `/profile`, `/settings`, `/terms`), compact on-visit
progression snapshots for bound villages, and aggregated database statistics.
Bundled reference data (Town Hall cap tables, the super-troop map, the unit
icon set) ships with the app.

**Non-goals:**

- **No background polling / auto-scraper.** We do not run scheduled jobs that
  continuously poll Clash of Clans endpoints; progression snapshots and stats
  update strictly on-visit within the free-tier 500 MB Supabase ceiling
  ([10 §3](./10-database-and-isr-architecture.md)).
- **No Supercell ID credentials or persisted in-game tokens.** Account binding
  uses Supercell's official `POST /players/{tag}/verifytoken` handshake and
  discards the rolling in-game API token immediately after verification.
- **No write access to the game.** The official API is read-only anyway; we
  never pretend otherwise.

## 6. Constraints we treat as design principles

- **Free tiers only.** Hosting (Vercel Hobby), database/auth (Supabase Free Tier
  500 MB), CI (GitHub Actions), and the game API cost nothing. Anything that
  would require a paid plan is out of scope by design, and database tables
  enforce strict projection, caps, and watermark pruning ([10 §3](./10-database-and-isr-architecture.md)).
- **The game API is throttled and key-gated.** Every upstream request we make
  goes through a multi-layer cache (TanStack Query, Vercel Edge ISR, in-memory
  LRU, and Supabase Postgres SWR; [04](./04-api-strategy.md), [06](./06-data-flow-and-caching.md),
  [10](./10-database-and-isr-architecture.md)). The app never talks to the game
  API directly, and server secrets never ship to the browser.

## 7. What success looks like

- **The 10-second demo:** a grader types their own clan's name, lands on the
  roster with donation flags, taps themselves, and sees their rushed analysis,
  all within ten seconds and zero explanation from us.
- Every engine is a pure TypeScript module with table-driven unit tests.
- Every profile and clan page is reachable by a pasteable URL.
- The deployed site runs on a free URL; the repo clones and runs locally in
  under ten minutes with two environment variables.
