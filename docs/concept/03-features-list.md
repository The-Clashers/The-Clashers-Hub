# 03 - Features List

Priorities: **P0** = the MVP (must ship), **P1** = should ship, **P2** =
stretch, cut without guilt when the semester compresses. Requirement IDs
cross-reference the tracker in [02](./02-requirements-tracker.md).

## 1. Feature table

| ID | Feature | Priority | Req | Notes |
|---|---|---|---|---|
| F-01 | Clan search: name or #tag + filters (min members, min clan level, war frequency, location) | P0 | FR-01 | a leading # routes straight to the clan by tag; filters are optional and narrow name searches; empty name = browse top clans; lives on `/clans`, and the nav lookup hands it names through `?name=` |
| F-02 | Search results: virtualized card list, badge, level, members, location, war frequency; cursor pagination | P0 | FR-01 | |
| F-03 | Tag lookup: paste-a-tag box (accepts `#ABC123` or `ABC123`, normalized) | P0 | FR-02 | lives on `/players` and inside the nav/home lookup's player mode; the only way to reach a player without a clan; the game has no player search by name |
| F-04 | Clan detail: two-column identity/stats card + roster | P0 | FR-03 | tabs: Roster / War / Log / Needs Attention; the nav's breadcrumbs locate the page |
| F-05 | Roster table: sortable, tap-through to player; league rank beside the member; needs-attention view as its own tab | P0 | FR-04, FR-05 | switches to cards below 768px; the cards keep the six sorts through a "Sort by" dropdown and direction toggle (07 section 3) |
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

Every page renders the global nav bar (07 section 3): the lookup box
(its small icon dropdown picks player or clan), the page links, and the
theme toggle, fixed in a thin row at the top like a tracker site.

| Route | Screen | Contents |
|---|---|---|
| `/` | Home | hero lookup box (player/clan), quick links to Clans / Players / Contributors |
| `/clans` | Clan search | search bar (name or #tag), filter row, cursor-paginated results; `?name=` seeds a search once for the nav lookup |
| `/players` | Player tag lookup | the tag box (F-03), tag-only, with the why explained |
| `/contributors` | Contributors | the repo's contributor list, read live from GitHub |
| `/clan/:tag` | Clan detail | two-column details card; breadcrumbs `Home › Clans › <name>`; tabs: Roster (default) / War / Log / Needs Attention; tab via `?tab=` |
| `/player/:tag` | Player detail | identity header, rushed analysis, heroes, achievements |
| `/compare/players?a=:tag&b=:tag` | Player compare | P1 |
| `/compare/clans?a=:tag&b=:tag` | Clan compare | P1 |

The lookup box's two modes keep the API's honest split: player mode is
tag-only (validated like every other tag through the one module), clan
mode takes a name (to `/clans?name=...`) or a `#tag` (straight to the
clan).

Notes on tags: game tags start with `#`, but the shareable URL carries the
bare tag (`/player/ABC123`, `/clan/2JPCYP98L`) so a pasted link reads clean
in a chat. The `#` stays hidden: `lib/tag.ts` re-attaches it to a route
param in exactly one place (`canonicalTagFromRoute`), and `%23` appears only
on the tier request path, never in the browser's address bar. Legacy `%23`
links still resolve, because the router decodes them before the
canonicalizer sees them. Normalization (uppercase, prepend `#`) owns one
module, never scattered.

## 3. The two golden paths

These are the flows that must never break; every demo and every smoke test
walks them.

**Golden path A, the clan-first journey:**
search a clan name → results list → clan detail → roster with the league
rank beside each member → tap a member → player detail with rushed analysis
→ back to roster (scroll position preserved).

**Golden path B, the tag shortcut:**
paste a player tag on `/players` (or the nav lookup's player mode) → player
detail directly → compare with a second tag (P1).

## 4. Screen inventory (what each screen must design)

Every screen specifies four states before it is considered designed (see
[06 §"State matrix"](./06-data-flow-and-caching.md)): loading (skeleton),
error (upstream busy / not found), empty
(no results / private war log), and success.

- **Search:** bar + filters + results; handles "no results" with relaxed-filter
  suggestions.
- **Clan detail:** two-column details card (the owner's layout): identity on
  the left (badge, name, tag/level/location, description clamped to two
  lines), a hairline divider, and the stat chips plus join requirements
  centered on the right; stacked below 768 px. Breadcrumbs above the card
  (`Home › Clans › <clan name>`) replace the old header and back button.
- **Roster:** columns rank / member / role / TH / trophies / donations /
  received / XP (war-preference is not in the clan response, and SR-09 forbids
  per-member fetches, so it renders only where the player payload is
  already in hand); the rank column reads the ranked-ladder tier
  (`leagueTier`, the new themed league set) as its icon plus the rank number
  parsed from the tier name, sitting beside the member the way the game
  shows it; the six FR-04 sorts; the roster renders in page flow, the
  browser scrollbar owning the scrolling, no inner scroll window.
- **Needs Attention tab:** the worst-first donation view with its own table
  (number, rank, name, role, donated, received, ratio chip, attacks left),
  the ratio target's two number boxes, and the clan health line; trophies,
  XP, and TH are deliberately absent. Attacks left reads the current-war
  endpoint (`/api/clan/:tag/war`, fetched only while the tab is open) and
  renders a dash when the clan is not in a war.
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
