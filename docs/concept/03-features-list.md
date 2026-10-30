# 03 - Features List

Priorities: **P0** = the MVP (must ship), **P1** = should ship, **P2** =
stretch, cut without guilt when the semester compresses. Requirement IDs
cross-reference the tracker in [02](./02-requirements-tracker.md).

## 1. Feature table

| ID | Feature | Priority | Req | Notes |
|---|---|---|---|---|
| F-01 | Clan search: name or #tag + filters (min members, min clan level, war frequency, location) | P0 | FR-01 | a leading # routes straight to the clan by tag; filters are optional and narrow name searches; empty name = browse top clans |
| F-02 | Search results: virtualized card list, badge, level, members, location, war frequency; cursor pagination | P0 | FR-01 | |
| F-03 | Tag lookup: paste-a-tag box on the home screen (accepts `#ABC123` or `ABC123`, normalized) | P0 | FR-02 | the only way to reach a player without a clan; the game has no player search by name |
| F-04 | Clan detail: header + stats + roster | P0 | FR-03 | tabs: Roster / War / Log |
| F-05 | Roster table: sortable, tap-through to player; donation flags inline; "needs attention" sort toggle | P0 | FR-04, FR-05 | switches to cards below 768px; the cards keep the six sorts through a "Sort by" dropdown and direction toggle (07 section 3) |
| F-06 | Player detail: profile + rushed analysis + achievements + heroes | P0 | FR-06, FR-07, FR-08, FR-09 | the analysis centerpiece |
| F-07 | Donation balance: per-member flags + clan-level health summary | P0 | FR-05 | target ratio adjustable client-side |
| F-08 | Current war view | P1 | FR-10 | standings + per-member table |
| F-09 | War log view + efficiency summary | P1 | FR-11, FR-12 | designed private-log notice |
| F-10 | Compare: player vs player | P1 | FR-13 | metric-by-metric, direction-colored |
| F-11 | Compare: clan vs clan | P1 | FR-13 | roster stats + war record |
| F-12 | Shareable URLs everywhere | P0 | FR-14 | free with React Router; tag encoding handled |
| F-13 | Recent searches (local storage) | P1 | FR-15 | |
| F-14 | Favorites / watchlist (local storage) | P2 | | see [06 §"Storage ladder"](./06-data-flow-and-caching.md) |
| F-15 | Legend & seasonal stats panels | P2 | | only meaningful for top-tier players |
| F-16 | Clan capital raids view | P2 | | extra endpoint, low analytic value |
| F-17 | Player progression grid: every unit of both villages with icon, current level, and maxed-for-Town-Hall chip | P1 | FR-16 | renders from the single player response; icons from the bundled map |
| F-18 | Preparation-day scouting: own and opponent rosters side by side with Town Hall levels and mismatch highlighting | P1 | FR-17 | a state of the War tab, not a separate route |
| F-19 | Manual refresh with cooldown on live-data screens | P1 | FR-18 | the server cache decides freshness; the screen shows a cached-data hint |

**Cut line for a compressed semester:** F-10, F-11, F-13, F-17, F-18 go
before anything P0 touches. F-08/F-09 are one milestone together, war views
either both ship or neither does; F-19 (refresh) is three pomodoros and
rides along wherever it fits.

## 2. Screens & URLs

| Route | Screen | Contents |
|---|---|---|
| `/` | Search | search bar, filter row, recent searches (F-13), tag-lookup box (F-03) |
| `/clan/:tag` | Clan detail | header + tabs: Roster (default) / War / Log; tab via `?tab=` |
| `/player/:tag` | Player detail | identity header, rushed analysis, heroes, achievements |
| `/compare/players?a=:tag&b=:tag` | Player compare | P1 |
| `/compare/clans?a=:tag&b=:tag` | Clan compare | P1 |

Notes on tags: game tags start with `#` and are URL-encoded as `%23`; the
router and the `TagInput` component own normalization (uppercase, prepend `#`)
in exactly one place each, never scattered.

## 3. The two golden paths

These are the flows that must never break; every demo and every smoke test
walks them.

**Golden path A, the clan-first journey:**
search a clan name → results list → clan detail → roster with donation flags →
tap a member → player detail with rushed analysis → back to roster (scroll
position preserved).

**Golden path B, the tag shortcut:**
paste a player tag on `/` → player detail directly → compare with a second tag
(P1).

## 4. Screen inventory (what each screen must design)

Every screen specifies four states before it is considered designed (see
[06 §"State matrix"](./06-data-flow-and-caching.md)): loading (skeleton),
error (upstream busy / not found), empty
(no results / private war log), and success.

- **Search:** bar + filters + results; handles "no results" with relaxed-filter
  suggestions.
- **Clan detail:** identity block (badge, name, tag, level, description,
  location, requirements, war frequency), stat chips (members, win streak,
  war wins, points), tab bar, roster table.
- **Roster:** columns role / TH / trophies / league / donations / received /
  XP (war-preference is not in the clan response, and SR-09 forbids
  per-member fetches, so it renders only where the player payload is
  already in hand); ratio flag chip per row; summary strip (average TH,
  total donations, flagged count); needs-attention sort.
- **Player detail:** header (name, tag, TH, league, XP, clan role), rushed
  panel (overall gauge + category bars + top-deficit list), progression grid
  (every unit of both villages with icon, level, and maxed-for-Town-Hall
  chip), hero grid, achievements list with progress rails.
- **War (current):** state banner (preparation / in battle / ended), both
  clans' stars + destruction, per-member attack table; during preparation
  day a scouting view: both rosters side by side with Town Hall levels and
  mismatch highlighting.
- **War log:** result chips (win / loss / tie), team size, stars,
  destruction, XP earned per entry; efficiency summary header.
- **Compare:** two columns, one row per metric, delta arrow + color; radar
  chart as P2 garnish only.
