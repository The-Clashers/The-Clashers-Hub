# 02 - Requirements Tracker

Living tracker for the course report. Status values: **Draft** (written, not
reviewed) → **Agreed** (team review done) → **Building** (in a milestone) →
**Done** (shipped + verified). Requirement IDs are stable once assigned,
never renumbered; drop a row by marking it `Dropped` with a reason.

Session 7 snapshot: [requirements.md](../../requirements.md) at the repo
root holds the complete lab-structure specification (stakeholders SH,
acceptance criteria AC, constraints CON, assumptions ASM, detail system
requirements SR-08 to SR-19, and the KanbanFlow task breakdown). Status
lives here; the spec of record lives there.

# Functional Requirements

| ID | Details | Status |
| :-: | --- | :-: |
| FR-01 | Search clans by name, with filters: minimum members, minimum clan level, war frequency, location; paginated results | Draft |
| FR-02 | Look up any player directly by pasting a player tag (with or without `#`) | Draft |
| FR-03 | Clan detail screen: identity header (badge, level, description, location, requirements) plus full roster | Draft |
| FR-04 | Roster table: sortable columns (role, Town Hall, trophies, donations given/received, XP level); tap a row to open the player | Draft |
| FR-05 | Donation balance engine: per-member ratio vs a configurable target (default 1:1), flags, worst-first "needs attention" ordering | Draft |
| FR-06 | Player detail screen: profile header, Town Hall, league, XP, clan role | Draft |
| FR-07 | Rushed analysis on any player: overall percentage, per-category breakdown, top deficits, super-troop normalization | Draft |
| FR-08 | Player achievements list with progress rails and stars | Draft |
| FR-09 | Hero panel: levels vs max, equipment where the API exposes it | Draft |
| FR-10 | Current war view: standings, per-member attacks used / stars / destruction | Draft |
| FR-11 | War log view for clans with a public log; explicit, designed notice for private logs | Draft |
| FR-12 | War efficiency summary: win rate, stars per attack, average destruction over recent wars | Draft |
| FR-13 | Compare mode: player vs player and clan vs clan, side by side, metric by metric | Draft |
| FR-14 | Shareable URL for every screen (search, clan, player, compare) | Draft |
| FR-15 | Recent searches persisted in the browser (local storage) | Draft |
| FR-16 | Progression grid on the player screen: every unit of both villages with icon, level, maxed-for-Town-Hall indicator | Draft |
| FR-17 | Preparation-day scouting view: side-by-side rosters with Town Hall levels and mismatch highlighting | Draft |
| FR-18 | Manual refresh control on live-data screens, guarded by a cooldown serving cached data with a hint | Draft |

# Non-functional Requirements

| ID | Details | Status |
| :-: | --- | :-: |
| NFR-01 | Zero paid services: hosting, CI, and game API access all run on free tiers | Draft |
| NFR-02 | Perceived latency: cached responses render in under 1s; cold (uncached) responses under 5s | Draft |
| NFR-03 | Upstream protection: every game-API call passes a server-side TTL cache; the browser never calls the game API | Draft |
| NFR-04 | Secrets: the API key exists only in server-side environment settings; never committed, never in the browser bundle | Draft |
| NFR-05 | Responsive from 360px (phone web) to 1440px+ (desktop); roster switches table → cards | Draft |
| NFR-06 | Accessibility: full keyboard navigation, visible focus states, contrast ratio ≥ 4.5:1, table semantics via ARIA roles | Draft |
| NFR-07 | Engine quality: pure-TypeScript engines with table-driven unit tests, ≥ 90% line coverage | Draft |
| NFR-08 | CI gate: typecheck, lint, unit tests, and production build must pass before merge | Draft |
| NFR-09 | Local setup: clone → running app in under 10 minutes without the API key (fixtures mode) | Draft |

# User-Requirements

| ID | Details | Status |
| :-: | --- | :-: |
| UR-01 | As a clan leader, I can screen an applicant's account in one screen so I can decide on a join request | Draft |
| UR-02 | As a clan co-leader, I can see which members never donate back, ranked worst-first | Draft |
| UR-03 | As a player, I can audit my own account to decide what to upgrade next | Draft |
| UR-04 | As a war organizer, I can see who actually uses their war attacks | Draft |
| UR-05 | As a visitor, I can use the site with no account and no tutorial | Draft |
| UR-06 | As a student demoing the project, I can search the grader's own clan live and get a result in seconds | Draft |

# System-Requirements

| ID | Details | Status |
| :-: | --- | :-: |
| SR-01 | The system is a static React-Native-for-Web bundle plus serverless functions on one origin (no CORS) | Draft |
| SR-02 | The API tier forwards game-API calls through the RoyaleAPI proxy with per-endpoint TTL caching | Draft |
| SR-03 | The API tier maps upstream errors to a documented JSON error contract ([04 §"Error contract"](./04-api-strategy.md)) | Draft |
| SR-04 | Analysis engines are pure TypeScript modules with no framework or network imports | Draft |
| SR-05 | Routing uses React Router with a documented URL map ([03 §"Screens & URLs"](./03-features-list.md)) | Draft |
| SR-06 | CI runs on every PR via GitHub Actions; `main` is always deployable and auto-deploys | Draft |
| SR-07 | Test fixtures are anonymized copies of game-API payloads stored under version control | Draft |
