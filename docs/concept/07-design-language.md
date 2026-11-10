# 07 - Design Language

The shared visual system. Its job: make 10+ screens built by 3 people look
like one product, and make dense data feel calm. Decisions here are defaults,
not suggestions, a screen that deviates files a PR that changes *this* doc
too.

## 1. Feel

Clash of Clans is a game of gold and trophies, but a data tool should be
quiet, simple, Clash of Clans inspired: a warm-bone / near-black canvas
(light and dark themes) carrying two soft glow fields, panels of frosted
glass that float over them and blur what passes behind, one gold accent
used sparingly for the things that matter (numbers, verdicts, focus).
Dense but never noisy: micro-labels whisper, values speak.

The glass rework (the owner's prototype pass) turned the flat surfaces into
lit ones: the canvas is no longer a flat color but a field (a gold wash
upper-left, a cool wash lower-right, drawn once by the ambience layer),
and every panel is translucent with the one shared backdrop blur, lifted on
a two-step shadow scale. Translucency lives on the surfaces, never the
text: ink stays full strength, so the quiet comes from the materials, not
from washed-out type.

## 2. Tokens (the only allowed values)

Source of truth: `src/theme/tokens.ts`. A screen that needs a value not
listed here files a PR that changes this file and this section together. The
sample review surface at `/tokens` (T-M0-2) lists every token on one canvas so
the pairs and the rhythm are checkable at a glance.

### 2.1 Color (per theme)

Light canvas is warm bone with near-black ink; dark canvas is near-black
with near-white ink. One gold accent, used sparingly. Panels are
translucent glass over the canvas's glow fields, so the honest contrast
check is text over the worst-case panel blend: the panel composited over
the canvas carrying a full-strength glow blob, the strongest thing that can
sit behind any panel. Every text pair was re-checked under that method
(NFR-06); the lowest pair in each theme is noted next to the table.

| Group | Tokens |
|---|---|
| Surface | `canvas`, `canvasVeil` (the translucent chrome the nav bar and floating hints paint with), `panel`, `panelRaised`, `panelBorder`, `panelBorderStrong`, `hairline`, `fillQuiet` (the quiet fill for things that sit ON a panel: rail tracks, skeleton blocks, neutral chips) |
| Text | `textPrimary`, `textSecondary`, `textMuted`, `textOnAccent`, `textInverse` |
| Accent (gold) | `accent`, `accentHover`, `accentPressed`, `accentSoft`, `focusRing` |
| Semantic | `success` / `successSoft`, `warning` / `warningSoft`, `danger` / `dangerSoft`, `info` / `infoSoft` |
| Chart series | `seriesGold`, `seriesBlue`, `seriesGreen`, `seriesRed`, `seriesMuted` (the four chart types plus a muted series, 07 §5) |
| Glass glow | `glowA` (the gold wash), `glowB` (the cool wash): the canvas fields the ambience layer draws and the panels blur |
| Elevation | `shadowColor`: the ink each theme's two shadow steps draw with |

Lowest-contrast text pair per theme (worst-case panel blend method):

- Light: `textMuted` on the panel blend at 5.8:1 (5.6:1 on the bare
  canvas).
- Dark: `textMuted` on the panel blend at 7.0:1 (8.3:1 on the bare
  canvas).

Both clear the 4.5:1 floor with margin. Gold (`accent`) is not a text
pair: it fills verdict surfaces and carries `textOnAccent` ink (5.9:1 over
`accent` in light, unchanged by the glass pass).

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

### 2.9 Glass and elevation

The glass system the rework shipped: how strongly a surface blurs, and the
two steps it can sit at. Both live in `src/theme/tokens.ts` beside the
colors they tint.

| Token | Value | Used for |
|---|---|---|
| `glass.blur` | 18 | the one backdrop blur radius every glass surface shares |
| `glass.saturate` | 1.6 | the saturation bump that keeps the glow fields lit through the blur |
| `shadows.resting` | opacity 0.07 / radius 14 / offset 4 | the everyday panel and the state surfaces |
| `shadows.lifted` | opacity 0.14 / radius 28 / offset 10 | raised panels, the nav bar, floating chrome |

Where the treatment applies:

- **The big surfaces blur:** the base styles' `panel`, `panelRaised`, and
  `statePanel` carry the translucent color, the shared blur (one cast
  helper, `glassSurfaceFilter`, the theme's single web-only-style cast), and
  their shadow step. The nav bar and the Dropdown's portaled listbox take
  the same filter over `canvasVeil` / `panelRaised`, because content passes
  under them.
- **Small controls do not blur:** pills, chips, inputs, and tiles paint
  with the translucent token colors but skip the filter. Backdrop blur is
  the expensive property in the system; spending it per-panel (roughly ten
  per screen) reads as glass, spending it per-control reads as lag.
- **Nested fills use `fillQuiet`:** anything that paints ON a panel (rail
  tracks, skeleton blocks, neutral chips) uses the quiet fill, because the
  old panel-tone fills would vanish into their now-translucent host.
- **The glow fields are drawn once:** `GlassAmbience` (the kit component)
  renders the two radial gradients in one fixed, pointer-transparent SVG
  behind every screen. Radial gradients are the one thing Views cannot
draw, which is why the ambience layer uses react-native-svg, the chart
  library the stack already blesses.

## 3. Layout

- Centered content column, max width 1280, side padding from the spacing scale.
- **Global nav bar:** a thin fixed row at the top like a tracker site (the
  owner's layout): the brand, the lookup box (its icon-and-label dropdown picks
  player or clan, accompanied by a search glyph), the page links with dedicated
  SVG glyphs (Home, Players, Clans, Compare, Contributors), and
  the theme toggle. The brand is the prototype's shield logo — the
  gold-rimmed shield with its filled field and star, drawn on
  react-native-svg from theme tokens so it follows the accent — beside the
  two-line lockup (name over the "clan and player analytics, live and
  login-free" tagline; the tagline drops off the stacked tiers). The page
  links carry matching icons beside their labels (`home`, `user`, `shield`,
  `compare`, `code`). One row at
  48 px from 1024 px up; below that a two-row
  90 px stack (brand + links + toggle, then the lookup full width) so the
  lookup never squeezes. Fixed, not sticky: a sticky bar is constrained to
  its containing block, which is exactly viewport-height here. The bar is
  the compact exception the tab strip already records (07 section 6): the
  row heights are compact by the owner's call, while every pressable keeps
  the 44 px floor, keyboard focus, and the gold ring. The glass pass made
  it frosted: the canvas veil plus the shared backdrop blur over the
  scrolling page, on the resting shadow.
- **Compare landing screen:** `/compare` provides a head-to-head comparison
  hub with an active mode toggle (`Compare Players` or `Compare Clans`). Each
  mode offers two dedicated input boxes (Entity A and Entity B) divided by
  a central VS badge, complete with tag normalization, helper hints, and
  a launch button navigating to `/compare/players` or `/compare/clans`.
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
  left) with the same 768 px switch to cards. The table carries the roster's
  column width rule verbatim (the owner's consistency note): the # and rank
  columns fixed at the roster's values, the name column flexing from the
  same modest basis, the metric columns growing the same small share, and
  the plain number cell the roster's # column renders, so the two tables
  read as one family. No sort controls: the row order is the engine's
  judgment. Attacks left reads the current-war endpoint and dashes when
  there is no war to count.
- **Player detail:** two columns from 1024 px up (identity + analysis),
  stacked below — the layout the prototype rework tried to replace and the
  owner put back, with the prototype's two actions kept on the card. The
  identity column holds the FR-06 header: the name, the tag with the clan
  name beside it, a hairline, then the stat grid (Town Hall, league with
  the tier icon in the 24 px slot falling back to the classic league
  object, XP level, clan role), two cells per row inside the column and
  four when the card runs full width, then a second hairline and the
  actions block: the compare button (primary gold pill with the compare
  glyph) above the manual refresh control (the ghost pill with the
  refresh glyph and the last-refresh text riding in the cached pill —
  the owner's placement call: freshness lives on the card whose data it
  describes; the clan screen keeps its footer row until its own pass).
  Breadcrumbs `Home › Players › <name>` sit above with the clan card's
  clearance.
  The left column holds the identity card and the two verdict cards: the
  rushed analysis card and the upgrade-next list. The rushed analysis card
  (T-M2-2's card half) centers the `Gauge` dial (the overall deficit
  percentage as a gold arc on a semicircle, the number in its throat,
  "DEFICIT VS TH CEILING" under it), the band chip under the dial, the
  reading's own scale note (units measured, already maxed, the band
  scale), the per-category `CategoryBars` (each bar colored by the band
  that category's own percentage falls into), and the skipped-units
  footnote when the engine counts any (SR-14). The upgrade-next list
  renders the engine's top deficits worst-first: rank circle, name,
  level/maximum pair, and the gap as a warning chip; a maxed account gets
  the designed "nothing to catch up" reading (AC-04), never a fabricated
  todo list.
  The right column stacks the three ledger cards: heroes, the progression
  grid, and achievements last. The hero card (T-M2-4) renders the prototype's hero cards: one compact
  card per hero in measured rows of at least 240 px — the bundled unit
  icon (`UnitIcon`, 32 px slot, the typed map in `lib/icon-map.ts`
  resolving every hero the API names, placeholder.svg for content the map
  has not met), the name with a gold MAX chip when maxed, the "level X of
  Y" sub-line, the equipment the API nests on the hero entry as quiet
  rows under the name line (small 20 px icon, name + pair), and the
  `LevelRail` right-aligned in a fixed 96 px column with the pair under
  it. Rows group by village through the shared rule the achievements
  card established (`lib/village.ts`, first-appearance order), and the
  header count reads "N of M total levels · K maxed". A maxed hero mutes
  its text to the ledger treatment (the MAX chip and the icon keep their
  strength: the chip is the verdict, the picture is identity); a hero
  with a null maxLevel renders its level alone with no rail, and the card
  footnotes the count instead of inventing a maximum.
  The progression grid (T-M2-5) renders the prototype's tile wall for all
  non-hero units (heroes live on their own card above and are excluded here):
  compact tiles in measured rows of at least 76 px — the bundled icon
  centered on top, the name in two quiet lines under it, the level/max
  pair at the bottom, and a gold MAX badge breaking the tile's top-right
  corner when the unit is maxed (the maxed tile's border goes gold too).
  Village and category headers dock above their blocks, with Home Village
  ordered `Troops`, `Spells`, `Equipments`, `Pets`, `Siege` and Builder
  Base carrying `Troops`; each category header carries its "N units · M
  maxed" count line.
  The achievements card (T-M2-3) sits last in the column and pairs a
  filter pill bar (`All`, `In Progress`, `Completed` with counts) with a
  measured multi-column grid of compact achievement tiles (at least 220 px
  wide, the same `onLayout` measurement pattern `HeroGrid` uses) so ~54
  achievements scan as a compact ledger grid instead of a towering
  single-column list. Each tile places the achievement name and star trio
  (`Glyph` stars, gold for earned tiers, quiet for the open ones) on the
  top line, the `ProgressRail` (`showStars={false}`) beside the tabular
  value/target counter on the meter line, and a single-line requirement
  note on in-progress tiles. Stars are the API's count, never derived
  from the fill: the payload proves they are independent (2 stars at 25%
  of the target, 1 star past it). A completed tile (all three stars in)
  mutes to the ledger treatment — secondary name, no requirement line —
  so completed items stay two lines tall while in-progress items draw the
  eye. Tiles group by village under quiet uppercase headers (the payload
  interleaves home, builder base, and clan capital rows) and key on
  village-name-index because the live payload carries duplicate names
  (one locked "Keep Your Account Safe!" beside the completed one).
- Breakpoints come from `useWindowDimensions` into a shared `breakpoints`
  helper, no CSS media queries scattered through components; RN paradigm is
  JS-driven layout.
- Paginated search results render in page flow too (the owner's call,
  retired from virtualization): 30 clans per page land in the document's
  own scroll, and a sentinel under the last card loads the next page when
  it nears the viewport, the same scroll model the roster uses. The
  progression grid's ~100 unit tiles stay virtualized as the normal case:
  the tiles are chunked into grid lines of the measured column count, so
  the FlatList keeps virtualizing the wall.
  Both page-flow lists rely on `scrollbar-gutter: stable` on the document
  root so the scrollbar's appearance never reflows the page (the owner's
  stable-window note).
- The two lookup panels share one shape (the owner's consistency note):
  the /players tag box and the /clans search panel both render the micro
  label above the input, the input with its action button, then one muted
  helper line under the row (the tag box teaching where the tag lives, the
  clan bar teaching the leading-# rule), so the site's two entry controls
  read as one family.

## 4. Component inventory (shared kit)

| Component | Purpose |
|---|---|
| `NavBar` | the thin fixed row every page renders: the shield brand lockup, `LookupSearch`, the page links (Home with its home glyph), the theme toggle, plus the in-flow spacer that reserves its height; frosted glass since the rework (canvas veil + shared blur) |
| `GlassAmbience` | the canvas's two glow fields: one fixed, pointer-transparent SVG behind every screen, the radial gradients Views cannot draw |
| `LookupSearch` + `LookupModePicker` | the one search box (nav-thin and hero-sized): the mode picker is the small icon dropdown that says player or clan; player mode is tag-only, clan mode takes a name or `#tag` |
| `Breadcrumbs` | the location line detail screens render instead of a header: `Home › Clans › <name>`, WAI-ARIA breadcrumb pattern |
| `SearchBar` + `FilterRow` | clans page query controls; the search bar takes a clan name or a `#tag` (names under three characters taught inline), and the filters sit behind one `Filters` disclosure whose toggle carries the applied count: a wrapping grid of `Dropdown`s (clan size, war frequency, location, clan label, clan type, chat language, league required) plus two number boxes (min clan level; Town Hall required, capped at the reference max), two cells per row on a phone and four from tablet up (the cell basis follows the shared breakpoint helper) |
| `Dropdown` | select-style control built on RN primitives: button trigger, portaled `listbox`, keyboard-complete (arrows, Enter, Escape, Home/End); the open list sizes its height to its options and only scrolls when it genuinely overflows |
| `TagInput` | the player tag box: /player/:tag routing, through the one tag module ([03 §2](./03-features-list.md)) |
| `PillButton` | the one pill button: search, retry, and footer-link actions all render it; primary gold, secondary raised panel, ghost (transparent with the strong border, the prototype's quiet action), optional leading `Glyph` (compare, refresh), link role with the trailing arrow for footer-style links |
| `ClanCard` | search result row: badge, level, members, location, and the family-friendly tag on the title row (a property, not a stat, so no chip) |
| `StatChip` | label + value pair used on headers and cards |
| `RatioFlag` | donation-balance chip: shows the member's `ratio : 1` (one decimal), good/warn/dash states |
| `LeagueRank` | the rank cell the roster and attention tables share: tier icon plus the rank number parsed from the tier name, dash when unranked |
| `RosterTable` / `RosterCard` | the clan roster, table & card presentations |
| `AttentionTable` / `AttentionCard` | the Needs Attention tab's worst-first view, table & card presentations |
| `Glyph` | the UI glyph set (the prototype's own paths on react-native-svg): compare, refresh, home, star, user, shield, search, and code — the marks buttons, nav links, mode pickers, and ratings draw |
| `ProgressRail` | achievement value/target bar; the star row beside the track by default, or track-only (`showStars={false}`) when the row renders its star trio in the headline the prototype's layout draws |
| `LevelRail` | the hero panel's level-versus-maximum bar: the fill without star markers, the same 6 px track and gold fill `ProgressRail` draws |
| `CategoryBars` | rushed per-category horizontal bars: label, quiet track, band-colored fill, tabular percentage |
| `Gauge` | overall rushed % dial (the flagship number): a semicircular SVG arc that fills gold with the deficit, built on react-native-svg |
| `ProgressionGrid` | player progression tile wall: measured rows of 76 px-plus tiles, each with `UnitIcon`, the two-line name, the level pair, and the gold MAX corner badge; village and category headers with their count lines |
| `UnitIcon` | bundled game-icon lookup behind `lib/icon-map.ts` with the placeholder fallback, fixed 32 px slot (20 px small variant on quiet rows like the hero panel's equipment); shipped on the hero panel, reused by the `ProgressionGrid` tiles |
| `RefreshControl` | manual refresh with cooldown, the ghost pill with the refresh glyph, and the cached pill carrying the last-refresh text ("Fetched just now" / "Cached, Ns ago"); renders in the player card's actions block on the player screen and the footer row on the clan screen |
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
- The `Gauge` dial is not a series chart: it is a single-value instrument
  (one number, one arc), so the Legend rule and the four-type cap do not
  apply to it. Its reading is labeled in place (the caption under the
  number), which is the legend a one-value dial owes.
- One `Legend` component for every series chart, swatch + label + optional
  footnote, laid out in a row. A chart adding its own legend is a PR that
  gets sent back.
- Numerics: tabular figures, no decimals unless the metric is inherently
  fractional (stars per attack → 1 decimal max).
- No chart junk: no gradients, no 3D, no animations on data changes: data
  tools answer questions, they don't perform. (The glow fields behind the
  glass are ambient light on the canvas, not chart decoration; they sit
  under the panels, never inside a plot.)

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

Four icon sources, one rule each.

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
- **UI glyphs:** the small stroke marks the chrome carries (compare on the
  player card's button, refresh on the refresh control, home on the Home
  link, the filled star on the achievement ratings) are the owner's
  prototype's own paths, drawn by the `Glyph` component on react-native-svg
  and colored from theme tokens — one set, one owner, no ad-hoc inline
  SVGs in components.
- **The brand mark and the favicon:** the shield — gold-rimmed, filled
  field, on-accent star — is the site's logo (the nav bar's lockup draws
  it on react-native-svg from the accent tokens) and its favicon
  (inlined in `index.html` as an SVG data URI, the prototype's own gold
  shield). The mark follows the theme's accent in the chrome; the favicon
  keeps the prototype's fixed gold because a tab icon has no theme to
  read.
