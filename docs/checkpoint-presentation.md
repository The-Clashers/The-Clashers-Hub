# The Clashers Hub — Project Checkpoint Presentation

> **Course:** APPLICATIONS DEVELOPMENT 1 · `2026APPSDEV1`  
> **Instructor:** Prof. Lee Cuizon  
> **Live App:** https://the-clashers-hub.vercel.app/  

---

## 1. Project Name and Purpose

**Project Name:** **The Clashers Hub**  
**Tagline:** *Clan and player analytics for Clash of Clans — live, computed in the browser, and login-free.*

### What Problem Does It Solve?
- **Interpretation over raw dumps:** In-game profiles show raw counters and stat trackers show walls of numbers—access is easy, but interpretation is missing.
- **Rushed progression scoring:** Computes rushed progression vs. Town Hall 7–18 caps across heroes, troops, spells, pets, siege machines, and hero equipment, with super-troop normalization.
- **Donation ratio audits:** Automates 50-member roster donation ratio audits against a configurable target ratio (default `1:1`) and worst-first sorting.
- **War & head-to-head analytics:** Evaluates war attack efficiency (handling CWL seasons and private war logs cleanly) and runs head-to-head Player & Clan comparisons with zero login and zero database.
- **Explicit zero-database architecture (`T-M5-0`, Session 37):** A proposed persistence phase (Supabase) was deliberately cancelled unmerged (`PR #32`) so the live game API stays the single source of truth and `localStorage` handles recent searches.

### Who Is It For? (Target Users)
- **Clan Leaders & Co-Leaders (`SH-01`):** Screen applicants for rushed accounts in one view and audit roster donation balance in seconds.
- **War Organizers (`SH-03`):** Inspect preparation-day Town Hall mismatches, war attack usage, and war log efficiency.
- **Individual Players (`SH-02`):** Self-audit upgrade deficits (*"What should I upgrade next?"* top-10 deficit list and maxed-for-TH grid).
- **Friends & Competitive Clans (`SH-04`):** Compare any two players or two clans metric-by-metric via shareable URLs.

---

## 2. Description

*Theme: Simple at the edge. Smart in the browser.*

### Main Features
- **Clan Search & Roster Audits:** Multi-filter clan search (server-side name ≥ 3 chars, size, level, points, war frequency, location, label; client-side clan type, chat language, trophy/TH caps) with cursor pagination, 6-way sortable roster (`< 768px` responsive card switch), and `Needs Attention` donation ratio tab.
- **Player Profile & Rushed Engine:** Rushed % gauge (`0%` Maxed, `0–5%` Core, `5–15%` Light, `15–30%` Rushed, `30%+` Heavy), category deficit breakdown, top-10 upgrade deficits, super-troop normalization (`17` live super troops mapped to base troops), virtualized ~100-unit Progression Grid (Home Village & Builder Base), Hero & Equipment panel, and Achievements list with progress rails.
- **War Center & Head-to-Head Compare:** Live Current War state banner, dual standings cards, and per-member attack tables; War Log efficiency summary + CWL 1-attack season filtering + designed private-log notice; Player & Clan Compare (`/compare/players`, `/compare/clans`) with `ClanSearchPopup` name-to-tag resolver and remodeled compact `Compare` launch UI (`PR #50`).
- **Reference, Freshness & UX:** Interactive TH 7–18 Cap Explorer, `localStorage` Recent Searches (`src/lib/recent-searches.ts`), 60s Manual Refresh control with `cacheAgeSeconds` hints, Light/Dark Glass Themes (`#F3F5F9` light / `#0A0D13` dark with locally bundled `@fontsource-variable/inter`), and live GitHub `/contributors` + maintainer `/tokens` QA route.

### Tools Used
- **Frontend & UI:** React 19 (`19.3.1`), React Native for Web (`0.20.0`), `react-native-svg` (`15.16.1`), TypeScript Strict (`5.6.3`), Vite 5 (`5.4.11`), React Router v7 (`7.18.4`), TanStack Query v5 (`5.62.11`), `@fontsource-variable/inter`
- **Backend, Proxy & Quality:** Vercel Serverless Functions (`/api/*` + `server/*`), RoyaleAPI Proxy (`cocproxy.royaleapi.dev`), Vitest (`2.1.9`), ESLint 9 (`9.39.5`), GitHub Actions CI + bundle secret scanner (`scripts/scan-bundle-secrets.mjs`), KanbanFlow

### How the System Works
1. **Serverless Proxy Tier (`/api/*` + `server/*`)**
   - `api/` holds thin 2-line Vercel route adapters over shared web-standard `Request -> Response` handlers in `server/routes.ts` (allowing identical execution on Vercel, local `npm run dev:api` on port `8788`, and key-less mock upstream on port `8787`).
   - `COC_API_TOKEN` is isolated strictly server-side and routed through `cocproxy.royaleapi.dev`.
   - Per-route in-memory LRU TTL cache mirroring client `staleTime`: `/api/search` (`60s`), `/api/war` (`120s`), `/api/clan` (`180s`), `/api/player` (`300s`), `/api/warlog` (`600s`), plus `30s` negative caching for 404s and `age` injected into every `200` body.
   - Server-side `429` auto-retry with quick fixed backoff (`500ms`, `1500ms`, 3 attempts, `4s` per-attempt timeout) and a normalized JSON error contract (`403 accessDenied` / `privateWarLog` on `/api/warlog` mapped to `200 { private: true }`).
2. **Client-Side Scoring Engines (`src/engines/*`, `src/lib/*`)**
   - Pure TypeScript modules with a strict no-React / no-network boundary (`src/engines/rushed.ts`, `src/engines/compare.ts`, `src/lib/donation-balance.ts`, `src/lib/war-efficiency.ts`, `src/lib/war-standings.ts`, `src/lib/achievement-progress.ts`).
   - Zero database — computes all verdicts in the browser from live JSON responses and `localStorage` recent tags.
3. **Bundled Reference Data (`src/lib/town-hall-caps.ts`, `src/lib/icon-map.ts`, `src/lib/unit-icons.ts`)**
   - 8 hall-indexed TH 7–18 / BH 1–10 cap tables derived through building upgrade ladders (Laboratory, Pet House, Hero Hall, Blacksmith, Star Lab), cross-checked against 131 live-payload checks (117 Home + 14 Builder), plus 17-entry super-troop map and Fankit-aligned unit/equipment icon maps.

---

## 3. Team Members

*One codebase. Three domains. (Under Prof. Lee Cuizon)*

In the project roadmap (`docs/concept/08-roadmap.md`), the team rotates PR reviews weekly and enforces a two-owners-per-area rule (the platform lead merges PRs but never reviews their own unreviewed code). Across the repository history (`PR #1`–`PR #50`):

| Member | GitHub Handle | Role | Owned Deliverables, PRs & Sessions |
| :--- | :--- | :--- | :--- |
| **Lejuene Delantar** | `lejxz` | **Platform / API Lead & Core Screens Owner** | Repo & unit assets (`D-1`), API key & proxy allowlist (`T-M0-0`), app scaffold (`T-M0-1`, `PR #1`), serverless API proxy & TTL cache (`T-M0-3`, `PR #5`), Vercel deploy fixes (`PR #7–9`), Clan Search (`T-M1-1`, `PR #12`, `PR #14`, `PR #31`, `PR #34`), Roster Table (`T-M1-4`, `PR #17`, `PR #19`), Player Detail Shell (`T-M2-1`, `PR #24`), Hero & Equipment Panel (`T-M2-4`, `PR #27`, `PR #28`), Manual Refresh Control (`T-M2-7`, `PR #35`), Glass Token Redesign & Prototype Rework (`PR #36–41`), Home/Players Cap Explorer & Footer (`PR #42–45`), Player Compare (`T-M3-3`, `PR #48`), and Prep-Day Scouting / Polish (`T-M3-6`, `T-M4-3`). |
| **Joshua Salvador Mararac** | `JoshyEyeBa11` | **Analysis Engines & Feature Screens Developer** | Base Light/Dark Design Tokens (`T-M0-2`, `PR #3`), Hello Clan live data proof (`T-M0-5`, `PR #6`), Tag Search Box & `#TAG` normalization (`T-M1-2`, `PR #13`), Donation Balance Engine (`T-M1-5`, `PR #18`), Rushed Analysis Engine (`T-M2-2`, `PR #25`), Progression Grid (`T-M2-5`, `PR #29`), Current War View (`T-M3-1`, `PR #46`), Clan Compare + `ClanSearchPopup` (`T-M3-4`, `PR #49`), Compare Landing Rework & Global Sticky Footer (`PR #50`, Session 55), and War Impact Metrics (`T-M3-7`). |
| **Kent Benedict Bertulfo** | `kentbenedictbertulfo24-del` | **CI/CD, Reference Data & Clan/War Views Developer** | GitHub Actions CI & bundle secret scan (`T-M0-4`, `PR #10`), Clan Detail Screen (`T-M1-3`, `PR #16`), 4-State Matrix & Busy-Retry Skeletons (`T-M1-6`, `PR #20`), Achievements List (`T-M2-3`, `PR #26`), Reference Data Bundle (`T-M2-6` — TH 7–18 cap tables, 17-entry super-troop map, hero equipment caps & trued icon map, Session 33), War Log View & Efficiency Engine (`T-M3-2`, `PR #47`), Recent Searches verification (`T-M3-5`), and Performance Pass (`T-M4-2`). |

---

## 4. Your Tasks (Per Member)

### Member 1: Lejuene Delantar (`lejxz`) — Platform / API Lead & Core Screens Owner

#### Assigned Tasks
- **M0 — Foundation & Serverless API Tier**
  - `D-1` Repo & Fankit unit assets; `T-M0-0` CoC API key & RoyaleAPI proxy IP allowlist; `T-M0-1` Vite 5 + React Native for Web + TypeScript strict + React Router v7 + TanStack Query v5 scaffold (`PR #1`)
  - `T-M0-3` Built 5 serverless read routes (`/api/search`, `/api/clan/:tag`, `/api/player/:tag`, `/api/clan/:tag/war`, `/api/clan/:tag/warlog`) with LRU TTL caching, 429 retry, error contract, `36`-check verification script & `33` unit tests (`PR #5`)
- **M1 — Search & Roster Core**
  - `T-M1-1` Clan Search screen (`/clans`) with multi-filter dropdowns, client-side filtering (`N shown of M loaded`), and cursor pagination (`PR #12`, `PR #14`, `PR #31`, `PR #34`)
  - `T-M1-4` 6-column sortable Roster Table (`src/lib/roster-sort.ts`) with `< 768px` card view switch, mobile sort bar, and tap-through to `/player/:tag` (`PR #17`, `PR #19`)
- **M2 — Player Profile, Design System & Freshness**
  - `T-M2-1` Player Detail shell (`/player/:tag`, `PR #24`); `T-M2-4` Hero & Equipment progression panel (`PR #27`, `PR #28`)
  - `T-M2-7` Manual Refresh control (`RefreshControl.tsx` + `src/lib/refresh.ts`, 60s courtesy cooldown + `cacheAgeSeconds` hints, `PR #35`)
  - Prototype layout rework (`PR #36–41`), Glass Token redesign (`PR #40`, Session 45: `#F3F5F9`/`#0A0D13` surfaces, `panelHighlight`, `accentInk` 5.6:1 contrast, local Inter font), Home/Players TH 7–18 Cap Explorer & Footer (`PR #42–45`)
- **M3 & M4 — Compare, Scouting & Polish**
  - `T-M3-3` Player vs. Player Compare engine (`src/engines/compare.ts`) & `PlayerCompareScreen` (`/compare/players`, `PR #48`, Session 53) — *Done*
  - `T-M3-6` Preparation-Day Scouting View & `T-M4-3` Empty States / Favicon / Open Graph meta tags — *Next*

#### Why It Matters to the Project
- **Security & Demo Reliability:** Isolating `COC_API_TOKEN` strictly on the serverless proxy prevents credential leaks, while TTL caching (`60s–600s`) + `429` auto-retry shields live grading demos from upstream rate limits.
- **End-to-End Golden Paths:** The app scaffold, routing, search flow, roster table, player shell, and compare views connect every teammate's scoring engines into shareable URLs.

---

### Member 2: Joshua Salvador Mararac (`JoshyEyeBa11`) — Analysis Engines & Feature Screens Developer

#### Assigned Tasks
- **M0 — Design Foundation & Live Data Proof**
  - `T-M0-2` Created initial design tokens (`src/theme/tokens.ts`) and base Light/Dark theme canvas (`NFR-06`, `PR #3`, Session 03)
  - `T-M0-5` Built Hello Clan screen (`PR #6`, Session 06) proving end-to-end live data fetch through `/api/clan/:tag` (later retired once `/clan/:tag` superseded it)
- **M1 — Tag Lookup & Donation Balance Engine**
  - `T-M1-2` Built Tag Search Box (`TagInput`) with single-module `#TAG` normalization in `src/lib/tag.ts` (`FR-02`, `SR-13`, `PR #13`, Session 13)
  - `T-M1-5` Implemented Donation Balance Engine (`src/lib/donation-balance.ts`) with configurable target ratio (default `1:1`), inline ratio flags, worst-first sorting & `90%+` test coverage (`PR #18`, Session 21)
- **M2 — Rushed Engine & Progression Grid**
  - `T-M2-2` Implemented flagship Rushed Analysis Engine (`src/engines/rushed.ts`: pure `computeRushed` core + `playerToUnitEntries` adapter), overall %, category breakdown, top-10 deficits, super-troop normalization, `4` JSON fixtures under `fixtures/`, and `45` table-driven tests (`PR #25`, Session 29)
  - `T-M2-5` Built virtualized ~100-unit Player Progression Grid (`src/lib/progression-grid.ts`) across Home Village (Troops, Spells, Equipment, Pets, Siege) & Builder Base (`PR #29`, Session 34)
- **M3 & M4 — Current War, Clan Compare & War Impact**
  - `T-M3-1` Built Current War View (`src/lib/war-standings.ts` + War tab state banner, standings cards, per-member attack tables; `PR #46`, Session 51) — *Done*
  - `T-M3-4` Built Clan vs. Clan Compare (`computeClanCompare`, `ClanCompareScreen`, `ClanSearchPopup` name-to-tag resolver; `PR #49`, Session 54) & reworked Compare Landing (`PillButton` compact `Compare` button, capture-phase `Escape` fix, and `100vh`/`100dvh` global sticky footer; `PR #50`, Session 55) — *Done*
  - `T-M3-7` Per-Member War Impact Metrics (attacks used, stars/attack, avg destruction, attack quality score, baseline coloring) — *Next*

#### Why It Matters to the Project
- **Analytical Brain of the App:** Transforms raw unit levels, donation counters, war attacks, and clan stats into computed verdicts (rushed %, donation flags, war standings, and clan-vs-clan deltas).
- **Flagship Visuals:** Powers the Rushed Gauge, ~100-tile Progression Grid, Current War view, Clan Compare, and unified Compare landing experience.

---

### Member 3: Kent Benedict Bertulfo (`kentbenedictbertulfo24-del`) — CI/CD, Reference Data & Clan / War Views Developer

#### Assigned Tasks
- **M0 — CI Pipeline & Bundle Secret Hygiene**
  - `T-M0-4` Built GitHub Actions CI running strict `typecheck` (app + server tsconfigs), ESLint 9, Vitest, production Vite build, Vercel preview deploy & bundle secret scan (`scripts/scan-bundle-secrets.mjs`) (`PR #10`, Sessions 09–11)
- **M1 — Clan Detail Shell & Four-State Matrix**
  - `T-M1-3` Created Clan Detail Screen (`/clan/:tag`, `PR #16`, Session 19): identity header (badge, name, tag, level, description, location, requirements), uniform vitals stat grid & tab bar (`Roster`, `War`, `Log`, `Needs Attention`)
  - `T-M1-6` Designed 4-State Matrix (`SkeletonBlock` pulsing skeletons, `ErrorState` with retry, `EmptyState`, Success) and client `busy-retry.ts` backoff for search and clan screens (`PR #20`, Session 23)
- **M2 — Achievements & Reference Data Bundle**
  - `T-M2-3` Built Achievements List (`src/lib/achievement-progress.ts`, `PR #26`, Session 30) with progress rails, star tiers, and category filter pills
  - `T-M2-6` Bundled local Reference Data (`src/lib/town-hall-caps.ts`, `src/lib/icon-map.ts`, Session 33): 8 TH 7–18 / BH 1–10 cap tables resolved via building upgrade gates (verified via 131 live-payload cross-checks), `17`-entry super-troop completeness map, 43-piece hero equipment caps, `SR-17` `null maxLevel` fallback, and API-aligned unit/equipment icon map
- **M3 & M4 — War Log Efficiency, Recent Searches & Performance**
  - `T-M3-2` Built War Log View & Efficiency Engine (`src/lib/war-efficiency.ts` + `ResultChip`, `WarlogSummary`, `WarlogTable`, `WarlogCard`; `PR #47`, Session 52) with 1-attack-per-member CWL filtering, attack-weighted average destruction, and designed `200 { private: true }` notice — *Done*
  - `T-M3-5` Verify `localStorage` Recent Searches across all lookup flows & `T-M4-2` Performance Pass — *Next*

#### Why It Matters to the Project
- **Ground-Truth Reference Data:** Bundled Town Hall cap tables and unit icon maps make zero-extra-fetch client-side analysis possible and detect upstream game-content drift via completeness tests.
- **Quality & Resilience:** Automated CI checks and secret scanning protect every PR, while the Clan Detail shell, War Log analytics, and 4-state skeletons anchor the clan experience.

---

## 5. Completed So Far

**Progress:** **26 / 37 KanbanFlow Cards Complete** *(M0, M1, M2 complete; M3 nearly complete with 50 merged PRs through Session 55 on Nov 16, 2026; only `T-M3-6`, `T-M3-7`, and M4 polish/verification tasks remain)*

> **[ACTION NEEDED BEFORE SUBMISSION — SCREENSHOTS]:** The Canva deck (`DAHbEFJy_5A`) does not contain embedded screenshots. Capture and insert screenshots from https://the-clashers-hub.vercel.app/ for the completed features below before submitting.

### How We Built Our Completed Tasks (M0–M3)
- **Serverless Proxy, CI & Freshness (`T-M0-3`, `T-M0-4`, `T-M2-7`):**
  - Built 5 Vercel endpoints (`/api/search`, `/clan`, `/player`, `/war`, `/warlog`) as 2-line adapters over `server/routes.ts` routing through `cocproxy.royaleapi.dev`, with per-route LRU TTL caches (`60s`–`600s`, `30s` negative 404 cache), 3-attempt `429` backoff (`500ms`/`1500ms`), `age` timestamps on every `200`, and a local mock upstream (`localhost:8787`) + local API dev server (`8788`) for key-less development.
  - Wired GitHub Actions CI to gate every PR on `typecheck`, `eslint`, `vitest`, `vite build`, preview deploy, and `scripts/scan-bundle-secrets.mjs`.
  - Mounted `RefreshControl` (`src/lib/refresh.ts`) on live-data screens with a timestamp-derived `60s` courtesy cooldown and honest `"Cached, Xs ago"` / `"Fetched just now"` indicators.
- **Search, Clan Detail & Donation Engine (`T-M1-1` to `T-M1-6`):**
  - Built multi-filter Clan Search with cursor pagination, stacked Clan Detail vitals, 6-way sortable Roster Table (`< 768px` card switch), and the pure Donation Balance Engine powering inline ratio chips and the worst-first `Needs Attention` tab.
  - Implemented the 4-state matrix (`SkeletonBlock`, `ErrorState`, `EmptyState`, Success) and `busy-retry.ts` across screens.
- **Player Shell, Rushed Engine & Reference Bundle (`T-M2-1` to `T-M2-6`):**
  - Derived 8 dense TH 7–18 / BH 1–10 cap tables from building upgrade ladders (`131` live cross-checks) and trued the `17`-entry super-troop map and Fankit icon map against live payloads.
  - Connected `src/engines/rushed.ts` (`computeRushed` + `playerToUnitEntries`), the virtualized ~100-unit Progression Grid, Hero & Equipment panels, Achievements list, and interactive Home/Players TH Cap Explorer.
- **War Center, Head-to-Head Compare & UI Rework (`T-M3-1` to `T-M3-5`, `PR #46`–`#50`):**
  - Shipped Current War standings and map-ordered attack tables (`PR #46`), War Log efficiency summary excluding 1-attack CWL seasons + designed private-log notice (`PR #47`), Player Compare (`PR #48`), Clan Compare + `ClanSearchPopup` (`PR #49`, treating `Members` as a neutral `'fact'` row and quantizing rates before comparing), and the Compare Landing UI rework + sticky `100dvh` footer (`PR #50`).

---

## 6. UI / Screens

> **[ACTION NEEDED BEFORE SUBMISSION — SCREENSHOTS]:** The Canva deck (`DAHbEFJy_5A`) does not contain embedded UI screenshots. Capture screenshots of the 4 key screen groups below from https://the-clashers-hub.vercel.app/ before submitting.

### Key Screens & What Each Does
1. **Home (`/`) & Players (`/players`)** — `HomeScreen.tsx`, `PlayersScreen.tsx`
   - Search-first hero lookup (Player `#tag` or Clan name/`#tag`), `localStorage` Recent Searches chips (`src/lib/recent-searches.ts`), live verdict previews (reusing `Gauge`, `CategoryBars`, `RatioFlag`), and interactive Town Hall 7–18 Cap Explorer with hero level rails and interpretation band guide.
2. **Clan Search (`/clans`) & Clan Detail (`/clan/:tag`)** — `SearchScreen.tsx`, `ClanScreen.tsx`
   - Multi-filter clan search with paginated cards (`N shown of M loaded`); Clan Detail vitals grid + 4 tabs: `Roster` (6-way sort, `< 768px` cards), `Needs Attention` (adjustable target ratio audit), `War` (live current war standings & attack table), and `Log` (efficiency summary, CWL filtering & private-log notice).
3. **Player Detail (`/player/:tag`)** — `PlayerScreen.tsx`
   - Profile header, Rushed % gauge + category deficit bars + top-10 upgrade deficits, virtualized ~100-unit Progression Grid (Home Village & Builder Base), Hero & Equipment panel, and filterable Achievements list.
4. **Compare Hub (`/compare`, `/compare/players`, `/compare/clans`)** — `CompareScreen.tsx`, `PlayerCompareScreen.tsx`, `ClanCompareScreen.tsx`
   - Unified dual-entity selector with compact `Compare` pill launch button (`PR #50`), `ClanSearchPopup` name-to-tag resolver (with capture-phase `Escape` close), identity cards linking to full profiles, and side-by-side metric comparison rows with semantic direction coloring (and neutral `'fact'` styling for roster size).
5. **Supporting Routes (`/contributors`, `/tokens`)** — `ContributorsScreen.tsx`, `TokenScreen.tsx`
   - Live GitHub repository contributors list (`/contributors`) and maintainer design-token review surface (`/tokens`).
   - All data-fetching screens implement the **4-state matrix** (`Skeleton`, `Error`, `Empty`, `Success`).

### How Users Move Between Screens (*Movement Stays Predictable*)
- **Global Navigation Chrome (`NavBar.tsx`, `Footer.tsx`):**
  - Persistent Top NavBar on every route with instant Player/Clan lookup mode selector, primary route links (`Home`, `Clans`, `Players`, `Compare`, `Contributors`), and Light/Dark theme toggle; global Footer pinned to viewport bottom via `#root` `100vh`/`100dvh` flex layout (`PR #50`).
  - Contextual breadcrumbs (`Home › Clans › <Clan Name>`) orient deep views.
  - Single-module tag canonicalization (`src/lib/tag.ts`) keeps shareable URLs clean with bare tags (`/clan/2JPCYP98L`, `/player/ABC123`) while encoding `#` only on server requests.
- **Golden Path A — The Clan-First Journey:**
  - Search clan name on `/` or `/clans` → click result card to open `/clan/:tag` → switch across `Roster`, `Needs Attention`, `War`, and `Log` tabs → tap any member row to open `/player/:tag` → browser Back returns to roster with scroll preserved.
- **Golden Path B — Direct Tag & Compare Journey:**
  - Paste player tag on `/players` (or select Players/Clans on `/compare` using the `ClanSearchPopup` name resolver) → inspect metric deltas on `/compare/players?a=TAG&b=TAG` or `/compare/clans?a=TAG&b=TAG` → tap either identity card to jump directly to `/player/:tag` or `/clan/:tag`.

---

## 7. Next Week's Plan (Nov 16–23, 2026)

*Theme: Finish, then refine.*

| Target Date | Assignee | Task ID / Scope | Status / Specific Details |
| :--- | :--- | :--- | :--- |
| **Nov 16, 2026** | **Lejuene Delantar** & **Joshua Salvador Mararac** | `T-M3-4` | Clan Compare final preview QA & Compare UI remodel (`PR #49` & `PR #50` merged Nov 16; move card to Done) |
| **Nov 17, 2026** | **Kent Benedict Bertulfo** | `T-M3-5` | Verify `localStorage` Recent Searches persistence across all lookup flows (building on `src/lib/recent-searches.ts` shipped in `PR #43`) |
| **Nov 18, 2026** | **Lejuene Delantar** (`lejxz`) | `T-M3-6` | Build Preparation-Day Scouting View in War tab (side-by-side rosters + Town Hall mismatch highlighting; `FR-17`, `SR-18`) |
| **Nov 19, 2026** | **Joshua Salvador Mararac** | `T-M3-7` | Add Per-Member War Impact Metrics (attacks used, stars/attack, avg destruction, best-attack quality score, participants-first ordering, baseline coloring; `SR-19`) |
| **Nov 20, 2026** | **Lejuene Delantar** (`lejxz`) | `T-M4-3` & UI Polish | Finalize empty states, favicon & Open Graph meta tags (`UR-05`) |
| **Nov 21, 2026** | **Joshua Salvador Mararac** | UI Design Improvement & `NFR-02` | UI Design Improvement & `NFR-02` latency verification (`< 1s` cached, `< 5s` cold median over 10 loads) |
| **Nov 21, 2026** | **Kent Benedict Bertulfo** | `T-M4-2` | Run Performance Pass — verify list virtualization on long rosters, route-level code-splitting & deploy timings |
| **Nov 22–23, 2026** | **All Team Members** | `T-M4-1` & `T-P-1` | Run full Accessibility Pass (keyboard walkthrough of Golden Path A, visible focus rings, `>= 4.5:1` contrast, ARIA roles) & PR smoke walkthroughs |

---

## 8. Teammates' Tasks & System Integration

*Theme: Three owners. One continuous system.*

```text
Serverless API Tier (Lejuene) → Reference Data & CI (Kent) → Pure Scoring Engines (Joshua) → Connected UI Screens (All Three)
```

- **Lejuene ↔ Joshua (Screens & Engines):**
  - Joshua's Donation Balance Engine (`T-M1-5`, `src/lib/donation-balance.ts`) plugs into Lejuene's Roster Table (`T-M1-4`) for inline ratio flags & worst-first sorting.
  - Joshua's Rushed Engine (`T-M2-2`, `src/engines/rushed.ts`) and Progression Grid (`T-M2-5`) mount inside Lejuene's Player Detail Shell (`T-M2-1`) and feed Lejuene's Player Compare (`T-M3-3`).
- **Shared War & Compare Architecture:**
  - Lejuene's Player Compare (`T-M3-3`) and Joshua's Clan Compare (`T-M3-4`) share `src/engines/compare.ts` and `CompareMetricRows.tsx` (following the pure-adapter pattern so `engines/` never imports React or network modules).
  - Joshua's Current War View (`T-M3-1`, `src/lib/war-standings.ts`) consumes Lejuene's `/api/clan/:tag/war` route and hosts Lejuene's upcoming Preparation-Day Scouting View (`T-M3-6`), while Joshua's upcoming `T-M3-7` upgrades the shared war tables.
- **Kent ↔ Lejuene & Joshua (Data, Clan & CI):**
  - Kent's Reference Data Bundle (`T-M2-6`: `town-hall-caps.ts`, `icon-map.ts`) powers Joshua's Rushed Engine & Progression Grid and Lejuene's Hero Panel (`T-M2-4`) & Home/Players TH Cap Explorer.
  - Kent's Clan Detail (`T-M1-3`), 4-State Matrix & Busy-Retry (`T-M1-6`) & War Log (`T-M3-2`, `src/lib/war-efficiency.ts`) wrap Lejuene's Roster Table, `RefreshControl`, and `/warlog` route; Kent's GitHub Actions CI (`T-M0-4`) verifies strict types, tests, and bundle secret hygiene on every PR.
