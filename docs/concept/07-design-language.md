# 07 - Design Language

The shared visual system. Its job: make 10+ screens built by 3 people look
like one product, and make dense data feel calm. Decisions here are defaults,
not suggestions, a screen that deviates files a PR that changes *this* doc
too.

## 1. Feel

Clash of Clans is a game of gold and trophies, but a data tool should be
quiet, simple, Clash of Clans inspired: a white/black mode canvas (light and
dark themes), panels that float on it, one gold accent used sparingly for the
things that matter (numbers, verdicts, focus). Dense but never noisy:
micro-labels whisper, values speak.

## 2. Tokens (the only allowed values)

Source of truth: `src/theme/tokens.ts`. A screen that needs a value not
listed here files a PR that changes this file and this section together. The
sample review surface at `/tokens` (T-M0-2) lists every token on one canvas so
the pairs and the rhythm are checkable at a glance.

### 2.1 Color (per theme)

Light canvas is white with near-black ink; dark canvas is near-black with
near-white ink. One gold accent, used sparingly. Every text-on-canvas and
text-on-panel pair was checked at 4.5:1 or better (NFR-06); the lowest pair in
each theme is noted next to the table.

| Group | Tokens |
|---|---|
| Surface | `canvas`, `panel`, `panelRaised`, `panelBorder`, `panelBorderStrong`, `hairline` |
| Text | `textPrimary`, `textSecondary`, `textMuted`, `textOnAccent`, `textInverse` |
| Accent (gold) | `accent`, `accentHover`, `accentPressed`, `accentSoft`, `focusRing` |
| Semantic | `success` / `successSoft`, `warning` / `warningSoft`, `danger` / `dangerSoft`, `info` / `infoSoft` |
| Chart series | `seriesGold`, `seriesBlue`, `seriesGreen`, `seriesRed`, `seriesMuted` (the four chart types plus a muted series, 07 §5) |

Lowest-contrast text pair per theme:

- Light: `textMuted` on `canvas` at 7.0:1.
- Dark: `textMuted` on `canvas` at 8.2:1.

Both clear the 4.5:1 floor with margin; `textMuted` on `panel` is the next
pair to watch if a future change shifts either value.

### 2.2 Spacing

4px base. Touch targets (44px floor, 07 §6) compose from these.

| Step | px | | Step | px |
|---|---|---|---|---|
| 0 | 0 | | 7 | 32 |
| 1 | 4 | | 8 | 40 |
| 2 | 8 | | 9 | 48 |
| 3 | 12 | | 10 | 64 |
| 4 | 16 | | 11 | 80 |
| 5 | 20 | | 12 | 96 |
| 6 | 24 | | | |

### 2.3 Radius

| Step | Value | Used for |
|---|---|---|
| 0 | 0 | hairlines, dividers |
| 1 | 4px | chips, small controls |
| 2 | 8px | panels |
| 3 | 12px | hero panels, raised panels |
| 4 | 16px | large surfaces (reserved) |
| pill | 9999 | pills, the theme toggle, link buttons |

### 2.4 Typography

System font stack (no web font fetch, no FOUT). Numbers use `tabular-nums` so
columns of metrics align without decimal noise (07 §5).

| Token | Value |
|---|---|
| `fontFamily.sans` | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `fontFamily.mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |

Font size (px): `xs` 11, `sm` 13, `body` 15, `md` 16, `lg` 18, `xl` 22, `2xl`
28, `3xl` 36.

Font weight: `regular` 400, `medium` 500, `semibold` 600, `bold` 700. A fifth
weight is a deliberate change.

Line height: `tight` 1.2, `normal` 1.4, `relaxed` 1.6.

### 2.5 Layout

| Token | Value | Why |
|---|---|---|
| `contentMaxWidth` | 1280 | the centered content column (07 §3) |
| `sidePaddingDesktop` | 24 | spacing.6 |
| `sidePaddingTablet` | 20 | spacing.5 |
| `sidePaddingMobile` | 16 | spacing.4 |
| `sidePaddingSmall` | 12 | spacing.3 |
| `touchTargetMin` | 44 | the touch-target floor (07 §6) |
| `rosterCardBreakpoint` | 768 | table swaps to cards below this (NFR-05) |
| `playerTwoColumnBreakpoint` | 1024 | player detail goes two-up at this |
| `focusRingWidth` | 2 | the gold focus ring (07 §6) |
| `focusRingOffset` | 2 | ring offset so it clears the element edge |

Breakpoints are read through `useWindowDimensions` into the `breakpointFor`
helper; no CSS media queries scattered through components (07 §3).

### 2.6 Motion

| Token | Value |
|---|---|
| `fast` | 120ms |
| `normal` | 180ms |
| `slow` | 240ms |
| `ease` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `pulse` | 1200ms |

Data tools answer questions, they don't perform (07 §1): the scale is
intentionally narrow and a screen adding its own curve is a PR that gets sent
back. `pulse` is the one ambient motion in the product: the loading
skeletons' quiet opacity loop, an affordance that data is on its way, never
a performance. It is paused entirely under `prefers-reduced-motion`, where
the skeleton's layout carries the loading signal alone.

### 2.7 Z-index

| Token | Value |
|---|---|
| `base` | 0 |
| `raised` | 1 |
| `sticky` | 10 |
| `overlay` | 100 |
| `toast` | 1000 |

### 2.8 Theme control

Light or dark; the user can override the system preference and the choice
persists in `localStorage` under `tch.theme` (the same storage surface the
spec already blesses for saved tags, CON-06). `ThemeProvider` tracks
`prefers-color-scheme` only while the user has not pinned a choice, mirrors
the choice to `Appearance.setColorScheme` for RN components that read it, and
paints the document root so the body underneath matches the canvas on
overscroll.

## 3. Layout

- Centered content column, max width 1280, side padding from the spacing scale.
- **Global nav bar:** a thin fixed row at the top like a tracker site (the
  owner's layout): brand, the lookup box (its small icon dropdown picks
  player or clan), the page links (Home, Players, Clans, Contributors), and
  the theme toggle. One row at 48 px from 1024 px up; below that a two-row
  90 px stack (brand + links + toggle, then the lookup full width) so the
  lookup never squeezes. Fixed, not sticky: a sticky bar is constrained to
  its containing block, which is exactly viewport-height here. The bar is
  the compact exception the tab strip already records (07 section 6): the
  row heights are compact by the owner's call, while every pressable keeps
  the 44 px floor, keyboard focus, and the gold ring.
- **Clan detail card:** three stacked bands (the owner's better-layout call
  over the two-column wireframe). The identity row (badge 48, name,
  tag/level/location line), the description at full width clamped to two
  lines, a hairline divider, then a uniform stat grid: label-above-value
  cells, four per row from tablet up and two below, carrying the vitals
  (members, points, war wins, win streak), the war facts (frequency plus
  the log's public/private status), and the join requirements. Breadcrumbs
  (`Home › Clans › <clan name>`) sit above the card with a full spacing
  step of clearance (the owner's spacing note) instead of a screen header,
  and carry the back path the removed back-to-search button used to.
- **Roster table ↔ cards:** ≥ 768px a real sortable table; below, one card per
  member with the same columns stacked and a "Sort by" dropdown plus direction
  toggle riding above the list, because FR-04's six sorts carry no width
  qualifier. Same data, same sort rules (`lib/roster-sort.ts`), two
  presentations. The roster renders in page flow in both presentations: the
  browser scrollbar owns the scrolling, no inner scroll window boxing the
  list to the viewport (a clan caps at 50 members). A leading # column
  carries the member's position in the current order (the owner's call),
  the same shape the needs-attention table opens with; the rank (tier icon
  plus the number parsed from the tier name) sits in its own narrow column
  beside the name, the way the game shows it. The name column flexes from
  a modest basis while the six label/metric columns grow a small share
  each, so wide viewports spread the slack across the row instead of
  pouring it all into the name column (the owner's width note).
- **Needs Attention tab ↔ cards:** the worst-first donation view renders its
  own table (number, rank, name, role, donated, received, ratio, attacks
  left) with the same 768 px switch to cards. No sort controls: the row
  order is the engine's judgment. Attacks left reads the current-war
  endpoint and dashes when there is no war to count.
- **Player detail:** ≥ 1024px two columns (identity + analysis); stacked below.
- Breakpoints come from `useWindowDimensions` into a shared `breakpoints`
  helper, no CSS media queries scattered through components; RN paradigm is
  JS-driven layout.
- Paginated search results render in page flow too (the owner's call,
  retired from virtualization): 30 clans per page land in the document's
  own scroll, and a sentinel under the last card loads the next page when
  it nears the viewport, the same scroll model the roster uses. The
  progression grid's ~100 unit tiles stay virtualized as the normal case.
  Both page-flow lists rely on `scrollbar-gutter: stable` on the document
  root so the scrollbar's appearance never reflows the page (the owner's
  stable-window note).

## 4. Component inventory (shared kit)

| Component | Purpose |
|---|---|
| `NavBar` | the thin fixed row every page renders: brand, `LookupSearch`, the page links, the theme toggle, plus the in-flow spacer that reserves its height |
| `LookupSearch` + `LookupModePicker` | the one search box (nav-thin and hero-sized): the mode picker is the small icon dropdown that says player or clan; player mode is tag-only, clan mode takes a name or `#tag` |
| `Breadcrumbs` | the location line detail screens render instead of a header: `Home › Clans › <name>`, WAI-ARIA breadcrumb pattern |
| `SearchBar` + `FilterRow` | clans page query controls; the search bar takes a clan name or a `#tag`, the filters render as `Dropdown`s |
| `Dropdown` | select-style control built on RN primitives: button trigger, portaled `listbox`, keyboard-complete (arrows, Enter, Escape, Home/End) |
| `TagInput` | the player tag box: /player/:tag routing, through the one tag module ([03 §2](./03-features-list.md)) |
| `PillButton` | the one pill button: search, retry, and footer-link actions all render it; primary gold, secondary raised panel, link role with the trailing arrow for footer-style links |
| `ClanCard` | search result row: badge, level, members, location |
| `StatChip` | label + value pair used on headers and cards |
| `RatioFlag` | donation-balance chip: shows the member's `ratio : 1` (one decimal), good/warn/dash states |
| `LeagueRank` | the rank cell the roster and attention tables share: tier icon plus the rank number parsed from the tier name, dash when unranked |
| `RosterTable` / `RosterCard` | the clan roster, table & card presentations |
| `AttentionTable` / `AttentionCard` | the Needs Attention tab's worst-first view, table & card presentations |
| `ProgressRail` | achievement value/target bar with star markers |
| `CategoryBars` | rushed per-category horizontal bars |
| `Gauge` | overall rushed % dial (the flagship number) |
| `ProgressionGrid` | player progression tiles: `UnitIcon`, level, maxed-for-Town-Hall chip |
| `UnitIcon` | bundled game-icon lookup with the placeholder fallback, fixed 32 px slot |
| `RefreshControl` | manual refresh with cooldown and the "cached, Ns ago" hint |
| `WarResultChip` | win/loss/tie pill |
| `CompareRow` | metric row with both values + delta arrow |
| `Legend` | the ONE chart legend pattern, all charts use it, no exceptions |
| `SkeletonCard` | card-shaped loading skeleton, layout-matched to `ClanCard` |
| `SkeletonBlock` | the skeleton atom every shape composes: one hairline block on the shared pulse (`useSkeletonPulse`, the `pulse` motion token, paused under reduced motion) |
| `EmptyState` | the idle and empty states of the state matrix ([06 §3](./06-data-flow-and-caching.md)): title, body, optional next action |
| `ErrorState` | the error state of the matrix: tone dot, title, body, next action, `role=alert` |

## 5. Charts

- Built on **react-native-svg**: bar (donation balance), line (war trend),
  dual-line (compare trend), radar (P2 compare garnish). Four types, maximum.
- One `Legend` component for every chart, swatch + label + optional footnote,
  laid out in a row. A chart adding its own legend is a PR that gets sent back.
- Numerics: tabular figures, no decimals unless the metric is inherently
  fractional (stars per attack → 1 decimal max).
- No chart junk: no gradients, no 3D, no animations on data changes: data
  tools answer questions, they don't perform.

## 6. Accessibility

- Full keyboard path: search → results → roster rows (as links) → player
  detail, all reachable and visible via a 2px gold focus ring.
- RN accessibility props map to ARIA on web: `accessibilityRole` on every
  interactive element; the roster table uses row/cell/grid roles; charts carry
  text alternatives (the legend already lists the series, numbers too).
- Contrast ≥ 4.5:1 checked against the token pairs during M0 review; muted
  text on panels is the pair most likely to fail, so it's verified first.
- Touch targets ≥ 44px on the card presentation (phone web is a real target).
  Two recorded exceptions, both the owner's call to shave chrome height: the
  clan detail tab strip runs compact (padding-driven, ~34 px buttons); the
  nav bar's own rows run thin (48 px desktop / 90 px stacked). Both stay
  keyboard-focusable with the visible gold ring, and every pressable inside
  them keeps the 44 px floor.

## 7. Imagery

Two icon sources, one rule each.

- **API icons:** clan badges and league-tier icons come from the game API's own
  `iconUrls` (public CDN). They are rendered with RN `Image` (an `<img>` on
  web) in fixed layout slots (badge 48, league icon 24) so slow CDN loads
  never reflow the layout.
- **Unit icons:** troops, spells, heroes, pets, siege machines, and hero
  equipment are **bundled locally** from the Supercell Fankit under the
  copy-locally policy ([icons README](../../src/assets/game-icons/README.md)):
  fixed 32 px slot, resolved through the typed icon map,
  `placeholder.svg` when a unit has no bundled icon, never a hotlink to a
  third-party CDN, never a wrong icon standing in for a missing one.
