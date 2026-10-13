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

TBD

## 3. Layout

- Centered content column, max width 1280, side padding from the spacing scale.
- **Roster table ↔ cards:** ≥ 768px a real sortable table; below, one card per
  member with the same columns stacked. Same data, two presentations.
- **Player detail:** ≥ 1024px two columns (identity + analysis); stacked below.
- Breakpoints come from `useWindowDimensions` into a shared `breakpoints`
  helper, no CSS media queries scattered through components; RN paradigm is
  JS-driven layout.
- Every list that can exceed ~30 rows is virtualized (FlatList), because
  50-member rosters, paginated search results, and the progression grid's
  ~100 unit tiles are the *normal* case.

## 4. Component inventory (shared kit)

| Component | Purpose |
|---|---|
| `AppShell` | top bar (logo, tag-lookup shortcut) + content + footer |
| `SearchBar` + `FilterRow` | home screen query controls |
| `TagInput` | the ONE owner of tag normalization ([03 §2](./03-features-list.md)) |
| `ClanCard` | search result row: badge, level, members, location |
| `StatChip` | label + value pair used on every header |
| `RatioFlag` | donation-balance chip (good/warn/dash states) |
| `RosterTable` / `RosterCard` | the clan roster, table & card presentations |
| `ProgressRail` | achievement value/target bar with star markers |
| `CategoryBars` | rushed per-category horizontal bars |
| `Gauge` | overall rushed % dial (the flagship number) |
| `ProgressionGrid` | player progression tiles: `UnitIcon`, level, maxed-for-Town-Hall chip |
| `UnitIcon` | bundled game-icon lookup with the placeholder fallback, fixed 32 px slot |
| `RefreshControl` | manual refresh with cooldown and the "cached, Ns ago" hint |
| `WarResultChip` | win/loss/tie pill |
| `CompareRow` | metric row with both values + delta arrow |
| `Legend` | the ONE chart legend pattern, all charts use it, no exceptions |
| `Skeleton`, `EmptyState`, `ErrorState` | the state matrix ([06 §3](./06-data-flow-and-caching.md)), shared |

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

## 7. Imagery

Two icon sources, one rule each.

- **API icons:** clan badges and league icons come from the game API's own
  `iconUrls` (public CDN). They are rendered with RN `Image` (an `<img>` on
  web) in fixed layout slots (badge 48, league icon 24) so slow CDN loads
  never reflow the layout.
- **Unit icons:** troops, spells, heroes, pets, siege machines, and hero
  equipment are **bundled locally** from the Supercell Fankit under the
  copy-locally policy ([icons README](../../src/assets/game-icons/README.md)):
  fixed 32 px slot, resolved through the typed icon map,
  `placeholder.svg` when a unit has no bundled icon, never a hotlink to a
  third-party CDN, never a wrong icon standing in for a missing one.
