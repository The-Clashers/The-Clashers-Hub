# 02 - Requirements

The requirements specification and its status tracker, in one place. The
former root-level specification (written for the Session 7 requirements
lab) and the tracker it fed were merged into this document: every
requirement table carries its own Status column now, so a status change
is a one-file edit and the two can no longer drift apart.

Status values: **Draft** (written, not reviewed) → **Agreed** (team
review done) → **Building** (in a milestone) → **Done** (shipped +
verified). Requirement IDs are stable once assigned, never renumbered;
drop a row by marking it `Dropped` with a reason.

Structure follows the lab deliverable: project overview, stakeholders,
user stories, functional and non-functional requirements, system
requirements for the expanded user stories, acceptance criteria,
constraints, assumptions, and the completed review checklist. Section 11
turns the specification into the task backlog we manage on
kanbanflow.com.

## 1. Project overview

The Clashers Hub is a clan and player searcher with the analytics turned
on. A visitor types a clan name, any clan in the game, and gets its live
roster with donation flags. Opening any member gives a full account read:
rushed percentage, hero and achievement progress, war reliability. Any two
players or clans can be compared metric by metric. No login, no setup,
nothing to install; everything runs on live public game data in the
browser. Full pitch and scope: [00-overview.md](./00-overview.md).

The product exists because access is not the problem, interpretation is.
The game's public API returns raw counters for every clan and player, but
the questions people actually ask are computed judgments over those
counters: is this applicant's account developed, who never donates back,
who actually uses their war attacks. We fetch live data and turn it into
verdicts.

Scope and non-goals (the contract): live, read-only, public data for any
clan or player (search, clan detail, player detail, war views, compare)
plus browser-side analysis engines. The app ships with its own bundled
reference data and game icons (Town Hall cap tables, the super-troop map,
the unit icon set), so no third-party requests happen at runtime beyond
the game API proxy. Not a tracker (no history, no polling,
no snapshot database). No accounts (no sign-up, no auth; saved tags live
in local storage). No write access to the game. Success is the
ten-second demo: a grader types their own clan's name, lands on the roster
with donation flags, taps themselves, and sees their rushed analysis, all
within ten seconds and zero explanation.

## 2. Stakeholders and needs

The lab asks for at least three; six are identified because each shapes a
different part of the product. The first four are end users and drove the
feature list; the last two are project stakeholders and shaped the process.

| ID | Stakeholder | Need or concern |
|---|---|---|
| SH-01 | Clan leaders and co-leaders | Screen an applicant in one screen, and see who never donates back; needs the rushed verdict and donation flags to be trustworthy and current |
| SH-02 | Players auditing their own account | An honest read of what is maxed, what is neglected, and what to upgrade next |
| SH-03 | War organizers | See who actually uses their war attacks, and how efficient the clan's recent wars are |
| SH-04 | Recruiters for competitive clans | A quick roster health check before approving a merge or an alliance |
| SH-05 | The development team (three students) | A scope that fits one semester part-time, runs on free tiers only, and demos well for the grade |
| SH-06 | Course instructor / grader | Requirements that are specific, measurable, traceable, and verifiable in a live demo |

## 3. User stories

The lab asks for at least four; six are specified. Priorities come from
[03-features-list.md](./03-features-list.md). UR-01, UR-03 and UR-04 are
expanded in section 6 below.

| ID | User story | Covers | Priority | Status |
|---|---|---|---|---|
| UR-01 | As a clan leader, I want to screen an applicant's account in one screen, so that I can decide on a join request without guessing | F-01, F-04, F-05, F-06 | P0 | Draft |
| UR-02 | As a clan co-leader, I want to see which members never donate back, ranked worst-first, so that I can address imbalances before they demoralize the givers | F-05, F-07 | P0 | Draft |
| UR-03 | As a player, I want to audit my own account, so that I can decide what to upgrade next | F-03, F-06 | P0 | Draft |
| UR-04 | As a war organizer, I want to see who actually uses their war attacks, so that I can build a reliable war roster | F-08, F-09 | P1 | Draft |
| UR-05 | As a visitor, I want to use the site with no account and no tutorial, so that I get value in seconds | F-01, F-12 | P0 | Draft |
| UR-06 | As a student demoing the project, I want to search the grader's own clan live and get a result in seconds, so that the demo lands | F-01, F-02, F-12 | P0 | Draft |

## 4. Functional requirements

The lab asks for at least six; eighteen are specified. FR-14 through
FR-18 are the team's original additions beyond the lab's example set.

| ID | The system shall... | Feature | Priority | Status |
|---|---|---|---|---|
| FR-01 | allow a visitor to search clans by name, with filters for minimum members, minimum clan level, war frequency, and location, with paginated results | F-01, F-02 | P0 | Draft |
| FR-02 | look up any player directly by pasting a player tag, with or without the # prefix | F-03 | P0 | Draft |
| FR-03 | display a clan detail screen with an identity header (badge, level, description, location, requirements) plus the full roster | F-04 | P0 | Draft |
| FR-04 | provide a roster table with sortable columns (role, Town Hall, trophies, donations given and received, XP level), tapping a row opens that player | F-05 | P0 | Draft |
| FR-05 | compute a donation balance per member against a configurable target ratio (default 1:1), flag members below target, and order them worst-first | F-05, F-07 | P0 | Draft |
| FR-06 | display a player detail screen with profile header, Town Hall, league, XP, and clan role | F-06 | P0 | Draft |
| FR-07 | compute a rushed analysis for any player: overall percentage, per-category breakdown, and top deficits, with super-troop level normalization | F-06 | P0 | Draft |
| FR-08 | list player achievements with progress rails and stars | F-06 | P0 | Draft |
| FR-09 | show a hero panel with levels versus maximum, and equipment where the API exposes it | F-06 | P0 | Draft |
| FR-10 | show the current war: standings and per-member attacks used, stars, and destruction | F-08 | P1 | Draft |
| FR-11 | show the war log for clans with a public log, and a designed notice for private logs | F-09 | P1 | Draft |
| FR-12 | summarize war efficiency: win rate, stars per attack, and average destruction over recent wars | F-09 | P1 | Draft |
| FR-13 | compare player vs player and clan vs clan side by side, metric by metric | F-10, F-11 | P1 | Draft |
| FR-14 | give every screen (search, clan, player, compare) a shareable URL | F-12 | P0 | Draft |
| FR-15 | persist recent searches in the browser's local storage | F-13 | P1 | Draft |
| FR-16 | display a progression grid on the player screen: every unit of both villages (troops, spells, heroes, pets, siege machines, and hero equipment where exposed) with its icon, current level, and a maxed-for-Town-Hall indicator | F-17 | P1 | Draft |
| FR-17 | display a preparation-day scouting view when the clan is in preparation: own and opponent rosters side by side with Town Hall levels and pairwise mismatch highlighting | F-18 | P1 | Draft |
| FR-18 | provide a manual refresh control on live-data screens, guarded by a cooldown that serves cached data with a cached-data hint instead of calling the game API again | F-19 | P1 | Draft |

## 5. Non-functional requirements

The lab asks for at least four covering four different areas; nine are
specified across seven areas (cost, performance, reliability, security,
compatibility, accessibility, maintainability). Every NFR states numbers
or a verification method; vague terms are excluded.

| ID | Category | Requirement | Status |
|---|---|---|---|
| NFR-01 | Cost | Zero paid services: hosting, CI, and game API access all run on free tiers | Draft |
| NFR-02 | Performance | Cached responses render in under 1 s and cold (uncached) responses in under 5 s, measured as the median over ten loads of the clan detail screen on a standard broadband connection against the deployed site | Draft |
| NFR-03 | Reliability | Every game API call passes a server-side TTL cache; the browser never calls the game API directly; an upstream 429 maps to an automatic retry with backoff, not an error screen | Draft |
| NFR-04 | Security | The API key exists only in server-side environment settings; never committed, never in the browser bundle, verified by a CI scan of the built bundle | Draft |
| NFR-05 | Compatibility | Responsive from 360 px (phone web) to 1440 px+ (desktop); the roster switches table to cards below 768 px | Draft |
| NFR-06 | Accessibility | Full keyboard navigation, visible focus states, contrast ratio at least 4.5:1, table semantics via ARIA roles | Draft |
| NFR-07 | Maintainability | Pure TypeScript engines with table-driven unit tests and at least 90% line coverage | Draft |
| NFR-08 | Maintainability | CI gate: typecheck, lint, unit tests, and a production build must pass before merge | Draft |
| NFR-09 | Maintainability | A new developer clones and runs the app in under 10 minutes without the API key (fixtures mode) | Draft |

## 6. System requirements for the expanded user stories

UR-01 and UR-03 were chosen because together they walk the product's two
golden paths (the clan-first journey and the tag shortcut) and exercise
the full request path, both cache layers, and the flagship engine. UR-04
joins them with the war-view scope: the scouting view and the per-member
impact metrics (SR-18, SR-19). The architecture-level requirements
SR-01 to SR-07 open the section; the story-level detail series runs
SR-08 to SR-19.

**Architecture level (SR-01 to SR-07).**

| ID | System requirement | Status |
|---|---|---|
| SR-01 | The system is a static React-Native-for-Web bundle plus serverless functions on one origin (no CORS) | Draft |
| SR-02 | The API tier forwards game-API calls through the RoyaleAPI proxy with per-endpoint TTL caching | Draft |
| SR-03 | The API tier maps upstream errors to a documented JSON error contract ([04 §"Error contract"](./04-api-strategy.md)) | Draft |
| SR-04 | Analysis engines are pure TypeScript modules with no framework or network imports | Draft |
| SR-05 | Routing uses React Router with a documented URL map ([03 §"Screens & URLs"](./03-features-list.md)) | Draft |
| SR-06 | CI runs on every PR via GitHub Actions; `main` is always deployable and auto-deploys | Draft |
| SR-07 | Test fixtures are anonymized copies of game-API payloads stored under version control | Draft |

### 6.1 UR-01: a clan leader screens an applicant

| ID | System requirement | Status |
|---|---|---|
| SR-08 | A clan-name search submits to GET /api/search with the filters as query parameters; the tier calls the game API's clan search through the proxy, caches the response for 60 s, and returns JSON; results render as a virtualized card list (badge, level, member count, location, war frequency) with cursor pagination | Draft |
| SR-09 | Selecting a clan opens GET /api/clan/:tag (180 s TTL); the clan response includes the complete member list, so the roster renders from a single request with no per-member fetches | Draft |
| SR-10 | The clan detail screen renders the identity block (badge, name, tag, level, description, location, requirements) and stat chips (members, win streak, war wins, points) above the tabbed content | Draft |
| SR-11 | The roster table sorts by role, Town Hall, trophies, donations given, donations received, and XP; each row links to that member's player detail; below 768 px the table renders as cards | Draft |
| SR-12 | The donation balance engine computes the given/received ratio per member against the target (default 1:1, adjustable client-side), flags members below target with a chip, supports a needs-attention worst-first ordering, and re-computes locally when the target changes without any refetch | Draft |

### 6.2 UR-03: a player audits their own account

| ID | System requirement | Status |
|---|---|---|
| SR-13 | The tag box on the home screen accepts a tag with or without the # prefix, normalizes it (uppercase, prepend #) in exactly one component, and routes to /player/:tag with the tag URL-encoded | Draft |
| SR-14 | The player screen fetches GET /api/player/:tag (300 s TTL) and computes the rushed analysis client-side: overall percentage, per-category breakdown, top-deficit list, with super-troop levels normalized against their base troop and entries lacking a maxLevel skipped with a footnote | Draft |
| SR-15 | The player screen renders the hero grid (level versus maximum, equipment where the API exposes it) and the achievements list with progress rails and stars, all from the single player response | Draft |
| SR-16 | The progression grid renders entirely from the same single GET /api/player/:tag response: unit icons resolve through the bundled static icon map with the placeholder fallback, and maxed-for-Town-Hall indicators come from the bundled Town Hall cap reference tables; no request beyond the player fetch is made | Draft |
| SR-17 | The analysis engines are backed by reference data bundled with the app and versioned in the repository: Town Hall cap tables per unit category, the super-troop-to-base-troop map, and hero equipment caps; a unit whose API maxLevel is null falls back to the reference maximum, and only a unit absent from both is skipped and counted in the footnote | Draft |

### 6.3 UR-04: a war organizer reads the war

| ID | System requirement | Status |
|---|---|---|
| SR-18 | The preparation-day scouting view renders from the single current-war response: own and opponent rosters side by side with Town Hall levels, and a pairing where the own member's Town Hall is lower than the opponent's is highlighted as a mismatch | Draft |
| SR-19 | The current-war view computes per-member impact client-side from the single war response: attacks used versus allowed, stars, average destruction, stars per attack, and a best-attack quality value; members with zero attacks are listed after participants and never averaged in as zeros | Draft |

## 7. Acceptance criteria

The lab asks for at least two criteria for one user requirement; nine are
given, covering both expanded stories, the war-view additions, and the
riskiest behaviors (private war logs, key hygiene).

| ID | Given / When / Then | Verifies |
|---|---|---|
| AC-01 | Given a visitor on the search screen, when they type a clan name and submit, then matching clans render as result cards within 2 s from cache, or 5 s on a cold cache | UR-01, FR-01, NFR-02 |
| AC-02 | Given a clan detail screen with the roster loaded, when the needs-attention toggle is switched on, then members below the donation target are re-ordered worst-first and every flagged row shows the ratio chip | UR-02, FR-05 |
| AC-03 | Given the tag box on the home screen, when a player tag is pasted without the # prefix, then the app navigates to that player's detail screen and the rushed analysis renders | UR-03, FR-02, FR-07 |
| AC-04 | Given the maxed-account fixture, when the rushed analysis runs, then the overall verdict reads maxed with an empty top-deficit list; given a fixture with an active super troop, the normalized level is used | UR-03, FR-07 |
| AC-05 | Given a clan whose war log is private, when the Log tab opens, then the designed private-log notice is displayed instead of an error state | UR-04, FR-11 |
| AC-06 | Given the production client bundle, when it is scanned for the API key string, then there are zero occurrences | NFR-04 |
| AC-07 | Given the player screen for any player, when the progression grid renders, then every unit of both villages shows its icon, level, and maxed-for-Town-Hall indicator, and no network request occurs beyond the single player fetch | UR-03, FR-16 |
| AC-08 | Given a clan in preparation day, when the War tab opens, then both rosters render side by side with Town Hall levels and every own member facing a higher-Town-Hall opponent is highlighted | UR-04, FR-17 |
| AC-09 | Given a screen whose cached data is younger than the route TTL, when the visitor clicks refresh, then the cached response is served with a cached-data hint and no upstream call is made | UR-05, FR-18, NFR-03 |

## 8. Constraints

Constraints are imposed from outside; they are not chosen and not beliefs
that could turn out false (those are the assumptions in section 9).

| ID | Constraint |
|---|---|
| CON-01 | Free tiers only: hosting, CI, and API access cost nothing; anything that would require a paid plan is out of scope by design |
| CON-02 | One semester, ten weeks, three developers part-time; the roadmap runs M0 to M4 with a buffer week, and nothing outside P0/P1 is scheduled |
| CON-03 | The game API is key-gated and throttled with an unpublished per-key ceiling, and keys are locked to registered static IPs; all upstream calls route through the RoyaleAPI community proxy (whose IP is allowlisted on the key) and the server-side TTL cache |
| CON-04 | The UI is built with React Native for Web components only; DOM-only UI libraries are excluded, and there is no Expo toolchain |
| CON-05 | The product is read-only over public game data; no write path to the game, and private war logs are a designed state, not an error |
| CON-06 | No database in v1; the live API behind the cache is the data source, and browser storage holds only tags the user typed or starred |

## 9. Assumptions

Assumptions are beliefs that could turn out false. None is treated as a
confirmed fact until verified; each is cheap to re-check.

| ID | Assumption |
|---|---|
| ASM-01 | The game API and the RoyaleAPI community proxy remain available throughout the development window |
| ASM-02 | Public clan and player data remains accessible without end-user authentication; war log visibility varies per clan and is handled as a designed state |
| ASM-03 | The free tiers (Vercel hosting, GitHub Actions CI, the game API key) remain free at their current limits for the semester |
| ASM-04 | All three team members remain available; the rotation plan keeps at least two owners per area |
| ASM-05 | Anonymized fixtures captured from real API payloads represent the real data shapes, including edge cases such as a missing maxLevel |

## 10. Requirements review checklist

The step 7 checklist from the lab, completed against this specification.

| Checklist item | Status | Evidence |
|---|---|---|
| Every requirement has an ID and is clear and specific | Pass | UR, FR, NFR, SR, AC, CON, ASM series; IDs stable, never renumbered |
| Functional requirements describe behavior; non-functional describe quality | Pass | Section 4 vs section 5, with a category per NFR |
| Non-functional requirements are measurable or verifiable where practical | Pass | NFR-02 states thresholds and protocol; NFR-04 verified by CI scan; NFR-07 states a coverage floor |
| System requirements add detail to user requirements | Pass | SR-08 to SR-12 expand UR-01; SR-13 to SR-17 expand UR-03; SR-18 and SR-19 expand UR-04 |
| Constraints are distinguished from assumptions | Pass | Sections 8 and 9 are separate; constraints imposed, assumptions to verify |
| Requirements do not contradict one another | Pass | Priorities and cut line come from one feature list; no-database constraint matches the non-goals |
| At least one requirement has acceptance criteria | Pass | Nine criteria in section 7 cover five URs, eight FRs, and NFR-04 |
| User requirements describe stakeholder needs | Pass | Every UR traces to a stakeholder in section 2 and features in section 4 |

## 11. KanbanFlow task board

This section is the source for the board on kanbanflow.com. The board is
the working surface; this document is the source of truth. When a card
and this document disagree, this document wins and the card is corrected.

Board setup:

1. Create the board "The Clashers Hub" with columns Backlog, Ready, In
   Progress, Review, Done.
2. Add swimlanes M0, M1, M2, M3, M4, and Process.
3. Add the labels platform, screens, engines, docs.
4. Create one card per task row below; title it with the task ID and short
   title (for example, "T-M1-4 Roster table").
5. Paste the task description plus the covered requirement IDs into the
   card description; attach the matching acceptance criteria from section 7.
6. Set the pomodoro estimate from the table (one pomodoro is 25 minutes of
   focused work; eight pomodoros is roughly one focused day) and the owner
   label.
7. Pull cards into Ready at the weekly review; nothing enters In Progress
   straight from Backlog. Work-in-progress limit: one card per developer.
8. At the weekly review, update estimates and record actuals on completed
   cards to calibrate the next milestone.

Card conventions. Every card inherits the definition of done from
[08-roadmap.md](./08-roadmap.md): TypeScript strict-clean,
ESLint clean, unit tests for any touched engine path, all four screen
states designed (loading, error, empty, success), keyboard-usable, and
reviewed on the preview deploy rather than on screenshots. If a card
changes a decision, the matching concept doc changes in the same PR.

### 11.4 M0: scaffold and pipeline (week 1)

M0 kills risk early: the request path, the key boundary, and the deploy
pipeline all work before any feature lands.

| ID | Task | Owner | Estimate | Covers |
|---|---|---|---|---|
| T-M0-1 | Scaffold the app: Vite, React Native for Web, TypeScript strict, React Router, TanStack Query | Platform | 12 | SR-01, SR-05 |
| T-M0-2 | Design tokens file and base theme for the light and dark canvas | Engines | 6 | NFR-06 |
| T-M0-3 | Serverless API tier: the five routes, COC_API_TOKEN through the proxy, in-memory TTL cache, error contract | Platform | 16 | SR-02, SR-03 |
| T-M0-4 | CI pipeline: typecheck, lint, tests, build on every PR, preview deploy, key-absence scan of the bundle | Platform | 10 | NFR-04, NFR-08, SR-06 |
| T-M0-5 | Hello clan screen: a hardcoded tag rendered from live data through the tier | Screens | 6 | SR-02 |

### 11.5 M1: search and clan (weeks 2 to 3)

M1 delivers golden path A end to end: search a clan name, land on the
roster with donation flags, tap through to a member.

| ID | Task | Owner | Estimate | Covers |
|---|---|---|---|---|
| T-M1-1 | Search screen with the filter row and a virtualized results list with cursor pagination | Screens | 14 | FR-01, SR-08 |
| T-M1-2 | Tag lookup box with normalization owned by one component | Screens | 4 | FR-02, SR-13 |
| T-M1-3 | Clan detail screen: identity header, stat chips, tab bar | Screens | 10 | FR-03, SR-10 |
| T-M1-4 | Roster table: sortable columns, tap-through to the player, card switch below 768 px | Screens | 14 | FR-04, SR-11, NFR-05 |
| T-M1-5 | Donation balance engine with table-driven tests at 90%+ coverage, inline flags, needs-attention sort | Engines | 12 | FR-05, SR-12, NFR-07 |
| T-M1-6 | State matrix and skeletons for the search and clan screens | Screens | 8 | NFR-02, SR-03 |

### 11.6 M2: player and analysis (weeks 4 to 5)

M2 delivers the analysis centerpiece: the player detail screen, the
rushed engine with its fixture suite, the bundled reference data it leans
on, the full progression grid, and the manual refresh control.

| ID | Task | Owner | Estimate | Covers |
|---|---|---|---|---|
| T-M2-1 | Player detail shell: header, layout, shareable URL | Screens | 10 | FR-06, FR-14 |
| T-M2-2 | Rushed engine: overall percentage, category breakdown, top deficits, super-troop normalization, fixture suite | Engines | 20 | FR-07, SR-14 |
| T-M2-3 | Achievements list with progress rails and stars | Screens | 8 | FR-08 |
| T-M2-4 | Hero panel: levels versus maximum, equipment where exposed | Screens | 8 | FR-09 |
| T-M2-5 | Progression grid: every unit with icon, level, and maxed-for-Town-Hall chip, grouped by village and category | Screens | 10 | FR-16, SR-16 |
| T-M2-6 | Reference data bundle: Town Hall cap tables, super-troop map, hero equipment caps, unit icon map | Engines | 6 | FR-16, SR-17 |
| T-M2-7 | Manual refresh control with cooldown and cached-data hint | Screens | 3 | FR-18 |

### 11.7 M3: war and compare (weeks 6 to 7)

M3 adds the war views (current war with preparation-day scouting and
per-member impact metrics, war log with efficiency) and both compare
modes; the war views ship together or not at all, per the feature list
cut line.

| ID | Task | Owner | Estimate | Covers |
|---|---|---|---|---|
| T-M3-1 | Current war view: state banner, both clans, per-member attack table | Screens | 12 | FR-10 |
| T-M3-2 | War log with result chips, efficiency summary, and the designed private-log notice | Screens | 12 | FR-11, FR-12 |
| T-M3-3 | Compare player vs player, metric by metric with direction coloring | Screens | 12 | FR-13 |
| T-M3-4 | Compare clan vs clan: roster stats and war record | Screens | 8 | FR-13 |
| T-M3-5 | Recent searches persisted in local storage | Screens | 4 | FR-15 |
| T-M3-6 | Preparation-day scouting view: side-by-side rosters with Town Hall levels and mismatch highlighting | Screens | 8 | FR-17, SR-18 |
| T-M3-7 | Per-member war impact: attacks used, stars per attack, average destruction, attack quality | Engines | 6 | FR-10, FR-12, SR-19 |

### 11.8 M4: polish and demo (weeks 8 to 9)

M4 hardens the product for the grade. Week 10 is buffer and is never
scheduled.

| ID | Task | Owner | Estimate | Covers |
|---|---|---|---|---|
| T-M4-1 | Accessibility pass: keyboard walkthrough of golden path A, focus states, contrast, ARIA roles | All | 10 | NFR-06 |
| T-M4-2 | Performance pass: list virtualization and route code-splitting | Platform | 8 | NFR-02 |
| T-M4-3 | Empty states, favicon, and Open Graph tags | Screens | 6 | UR-05 |
| T-M4-4 | Demo runbook, rehearsal, and the report outline | All | 8 | UR-06 |

### 11.9 Process lane (recurring)

Recurring cards live in the Process lane; they are never done, only
current.

| ID | Task | Owner | Estimate | Covers |
|---|---|---|---|---|
| T-P-1 | Golden-path smoke walkthrough on every PR, manually on the preview deploy | All | 1 per PR | Definition of done |
| T-P-2 | Weekly review: rotate review pairs, check the two-owners-per-area rule, update estimates | All | 1 weekly | CON-02 |
| T-P-3 | Keep the concept docs in the same PR as the matching code change | All | included | Definition of done |

### 11.10 Capacity check

The milestone tasks sum to about 270 pomodoros, roughly 34 focused
developer days. A conservative capacity estimate for three developers
over ten part-time weeks is about 600 pomodoros, which leaves room for
code review, rework, the course report, and the buffer week without
committing the team to overtime. The buffer exists to absorb the
semester's surprises; it is never pre-scheduled with feature work.

