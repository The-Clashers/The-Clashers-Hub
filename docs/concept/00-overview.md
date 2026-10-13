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
metric by metric. No login, no setup, nothing to install: everything runs on
live public game data in the browser.

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
4. **Zero-friction web.** No accounts, no onboarding, no install. Every screen
   has a shareable URL you can paste in a chat.

## 5. Scope and non-goals

**In scope:** live, read-only, public game data for any clan or player:
search, clan detail, player detail, war views, compare. Analysis engines that
run in the browser. Bundled reference data (Town Hall cap tables, the
super-troop map, the unit icon set) ships with the app; beyond the game API
proxy, nothing third-party is requested at runtime.

**Non-goals:**

- **Not a tracker.** We do not accumulate history over time, so there is no
  scheduled polling, no snapshot database, and no ops burden. The live API is
  our database.
- **No accounts.** No sign-up, no auth, no user data. Saved tags live in the
  browser's local storage only (see [06 "Storage"](./06-data-flow-and-caching.md)).
- **No write access to the game.** The official API is read-only anyway; we
  never pretend otherwise.

## 6. Constraints we treat as design principles

- **Free tiers only.** Hosting, CI, and the game API cost nothing. Anything
  that would require a paid plan is out of scope by design.
- **The game API is throttled and key-gated.** Every upstream request we make
  goes through a server-side cache with a TTL ([04](./04-api-strategy.md), [06](./06-data-flow-and-caching.md)). The app never talks to
  the game API directly, and the key never ships to the browser.

## 7. What success looks like

- **The 10-second demo:** a grader types their own clan's name, lands on the
  roster with donation flags, taps themselves, and sees their rushed analysis,
  all within ten seconds and zero explanation from us.
- Every engine is a pure TypeScript module with table-driven unit tests.
- Every profile and clan page is reachable by a pasteable URL.
- The deployed site runs on a free URL; the repo clones and runs locally in
  under ten minutes with two environment variables.
