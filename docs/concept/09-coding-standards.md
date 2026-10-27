# 09 - Coding Standards

The rules source code in this repo must meet, distilled from the AppDev
lecture notes (sessions 2 through 4, 9, 11, and 12) and made specific to this
codebase. The other concept docs already decide what to build (02), how it
looks (07), and in what order (08). This one decides how the code itself is
written and organized, so three people can keep touching the same tree for a
semester without stepping on each other.

Why it exists: the first real screen (search) landed as a single 1018-line
file that carries its own private component kit, three copies of the same
pill button, and a 345-line stylesheet threaded through props into every
child component. It works, it tested clean, and it shipped. But the next
four screens would inherit that shape, and the shared kit the design
language already promises (07 section 4) would never actually exist as code.
These standards stop the pattern before it spreads. The existing drift gets
paid down (section 10), not excused.

Every rule carries an ID (STD-nn) so a review comment can cite the exact
rule the way requirement reviews cite FR and SR IDs. The rules bind all new
code immediately; the current search screen is the named exception until
its split lands.

## 1. Naming

Names are read far more often than they are written. The lecture notes'
conventions (session 9), bound to this repo's shapes.

| ID | Rule | In this repo |
|---|---|---|
| STD-01 | Variables and functions: camelCase, verbs for functions, nouns for data | `normalizeTagInput`, `warFrequencyLabel`, `filtersEqual` |
| STD-02 | Components and their files: PascalCase. Screens end in `Screen` | `TagInput.tsx`, `Dropdown.tsx`, `ClanScreen.tsx` |
| STD-03 | Module-level constants: UPPER_SNAKE_CASE, named after the thing they limit | `SEARCH_STALE_TIME_MS`, `TAG_REJECT_COPY`, `LOCATION_FILTERS` |
| STD-04 | Booleans read as a question | `isFetchingNextPage`, `hasActiveFilters`, `hasNextPage` |
| STD-05 | Handlers: `handle*` or `on*`, named after the event, never `doThing2` | `handleSubmit`, `onSelect`, `onEndReached` |
| STD-06 | No re-abbreviated names. If a reader has to open the file to learn what `d`, `res2`, or `tmpB` holds, the name is wrong. Loop indexes (`i`, `index`) are the one exception | `firstPageAge`, not `fpa` |

## 2. What lives where

The folder map from [01 section 5](./01-tech-stack.md) restated as rules.
Placement is a review gate, not a preference; a file in the wrong folder
hides from the people who own it.

| ID | Rule |
|---|---|
| STD-07 | `src/screens/` holds one file per route. A screen owns layout, composition, and its route's state. It does not define reusable components, and it never holds business math. |
| STD-08 | `src/components/` holds the shared kit (07 section 4) plus anything used by more than one screen. One component per file, named after the component, with its own `createStyles` and its typed props exported for tests. |
| STD-09 | `src/lib/` holds pure helpers with no React imports (the tag rule is the model). `src/engines/` (opens with M2) holds the analysis engines with table-driven tests and the hard no-React boundary from 01 section 5. If logic can be unit-tested without rendering anything, it belongs in one of these, not in a screen. |
| STD-10 | `src/api/` holds one typed client per route pair: the response types, a parse step, and a fetch function that takes an injected `fetch` so tests never hit the network. `api/` and `server/` stay server-side only: no React, no analysis logic. |
| STD-11 | `src/theme/` holds tokens and base styles and nothing else. A new color, spacing step, radius, or font size enters here first, with the matching 07 section 2 change in the same PR. |
| STD-12 | Tests live next to what they test (`*.test.ts(x)` colocated). Fixtures (M2) hold anonymized payloads only. |

## 3. Components and reuse

The lecture notes' component-based architecture (session 2) and React
composition rules (sessions 3 and 4), turned into this repo's promotion
rules.

| ID | Rule |
|---|---|
| STD-13 | A component owns its styles. It calls `useTheme()` and builds its own `createStyles(theme)` inside. Components never receive stylesheet objects as props. The `styles: ReturnType<typeof createStyles>` threading in the current search screen is the anti-pattern; `TagInput`, `Dropdown`, and `ThemeToggle` are the model. |
| STD-14 | Props are data and behavior, never a style bag. A component's contract is: values in, rendered UI and callbacks out. Props are read-only; a child never mutates what it is handed. |
| STD-15 | Promotion rule: a UI piece moves from a screen file to `src/components/` the moment any of these is true: a second screen needs it, the 07 section 4 inventory names it, or it has its own state or logic worth testing. Nothing that meets the bar stays private to a screen file. |
| STD-16 | A screen file holds only layout fragments too small or too screen-specific to promote (a header row, a one-off panel wrapper). The test: could another screen ever want this? If yes, it does not belong in the screen file. |
| STD-17 | Interactive elements carry the accessibility floor from 07 section 6: `accessibilityRole`, a label, a hint when the outcome is not obvious from the label, and a visible focus ring. This is already the house habit; the standard keeps it that way. |
| STD-18 | Lists use a stable key from data identity (the game tag, the option value), never the array index when the list can reorder. FlatList gets a `keyExtractor`; mapped rows get a real `key`. |
| STD-19 | Inputs are controlled. The value lives in state, validation runs through a shared rule module, and the validation hint clears on fix (the tag box's clear-on-fix behavior is the pattern). |

## 4. Styles and theming

07 decides which values are allowed; this section decides how those values
reach the DOM. The one-line version: tokens in, chrome from the kit, and
nothing invented in a screen.

| ID | Rule |
|---|---|
| STD-20 | Every color, spacing step, radius, font size, family, and weight comes from `src/theme/tokens.ts`. Raw hex exists in exactly one file in the repo: `tokens.ts`. A screen needing a value the tokens lack adds the token and the 07 section 2 row in the same PR. |
| STD-21 | No magic pixel numbers. A bare number in a style needs one of two things: a name (a local constant or a token) or a comment saying why that exact size. The current offenders are named in section 10 so the fix is bounded. |
| STD-22 | Shared chrome is used, not re-derived. The pill button, the focus ring, the 44 px touch target, and the panel pair exist as base styles or kit components. The current tree re-derives the pill button three times, the focus ring twelve times, and the touch target ten times; that is the debt being paid, not the pattern to follow. |
| STD-23 | Screen-specific styles live in that screen's (or component's) own `createStyles(theme)`, built once per theme with `useMemo`, keys in camelCase grouped by section with a short comment per group. |
| STD-24 | Responsive behavior composes from flexbox the way the filter grid does (one flexBasis, wrapping cells, no breakpoint JS and no media queries). |
| STD-25 | Dark mode is not a second stylesheet. The same style code runs against both themes because every value is a token; if a style needs to know which theme is active beyond what tokens give it, that is a design smell to raise in 07, not a workaround to hide in code. |

## 5. Functions and logic

Session 9's function rules and session 11's clean-code rules.

| ID | Rule |
|---|---|
| STD-26 | A function does one task. If the name needs "and" to stay honest (`validateAndFetchAndFlag`), it is two functions. The submit handler in the search screen (guard, tag branch, name branch) is about the honest maximum for one function. |
| STD-27 | Early returns over nesting. Guard clauses first, the happy path last, and never more than three levels of indentation inside a component body. |
| STD-28 | Named constants for every number with meaning. `SEARCH_STALE_TIME_MS` mirroring the tier's 60 s TTL is the model: the name carries the why, the comment carries the reason it must match the tier. |
| STD-29 | Comments explain why, never what. This repo's comment voice (the minWidth 0 fix explaining the 360 px collapse, the lineBox ratio note) is the asset reviewers protect. A comment that paraphrases the code under it gets deleted in review. |
| STD-30 | DRY with the session 11 caution: two blocks that look alike may be different rules wearing the same shape. Merge the tag rule into one module (done, `lib/tag.ts`); never merge two counters that happen to read similarly. |

## 6. State and data

Session 12's state rules mapped onto this repo's chosen split: TanStack Query
owns server state, hooks own local state.

| ID | Rule |
|---|---|
| STD-31 | Server state goes through TanStack Query only. The query key carries the full request identity (the submitted filters object, not a fragment of it), and `staleTime` mirrors the tier's TTL for that route so the two cache layers decay together. |
| STD-32 | Local UI state is `useState` (or `useReducer` when transitions have rules). Derived values are computed at render (`items`, `dirty`, `hasActiveFilters`), never copied into state. |
| STD-33 | Updates are immutable and use the functional form when the next value depends on the previous one (`setSubmitted(previous => ...)`). |
| STD-34 | Effects are for synchronizing with the outside world only. No effect chains (an effect that sets state another effect watches), and no storing of fetched data into local state. |
| STD-35 | The four-state matrix (06 section 3) is per data view, not per screen: loading, error, empty, success each designed, each with a next action where the state has one. |

## 7. Error handling

Session 9's error rules plus this repo's contract.

| ID | Rule |
|---|---|
| STD-36 | API clients throw typed errors carrying the tier's error contract (04 section 6); screens branch on the contract kind and render the designed state. No raw `error.message` passthrough as the user-facing string when a contract kind exists. |
| STD-37 | Users get plain language plus a next action; developers get diagnostics in the console. Neither ever contains the API key, a token, or personal data (NFR-04). Errors are never swallowed silently, and exceptions are never control flow. |
| STD-38 | Validation happens where the rule lives (the shared module), fires before any fetch, and both inputs and screens honor it. Client-side validation is UX, not security; the tier re-validates everything regardless. |

## 8. Code smells that block a review

Session 11's smell list, with this repo's concrete instances. Any of these
in a diff is a blocking review comment citing the STD row, not a nit.

| Smell | This repo's shape | Fixed by |
|---|---|---|
| Long file | A 1018-line screen carrying a screen, seven child components, and a 345-line stylesheet | STD-07, STD-15, section 10 |
| Duplicate code | Three pill-button styles, twelve focus-ring copies, a skeleton card that duplicates the card chrome | STD-22, kit components |
| Style prop threading | Whole stylesheets passed as props so children can paint | STD-13 |
| Magic numbers | 48, 140, 200, 280, 88, 240, 0.6 floating in styles with no name or reason | STD-21, STD-28 |
| God module | A screen that fetches, normalizes, computes, formats, and renders | STD-07, STD-09 |
| Shotgun surgery | A rule change that must be edited in several files (tag wording once lived in two places) | STD-30, one module per rule |
| Dead or stale comments | A comment describing yesterday's behavior | STD-29 |

## 9. The per-PR checklist

The definition of done (08 section 4) already gates every PR. This is the
code-half of that gate, checked before requesting review. Naming and
placement right (STD-01 to STD-12); new UI promoted or honestly private
(STD-13 to STD-19); styles from tokens and the kit (STD-20 to STD-25);
functions single-task with why-comments (STD-26 to STD-30); state in the
right layer with the four states designed (STD-31 to STD-35); errors on
contract with safe copy (STD-36 to STD-38). Typecheck, lint, and tests green
locally, not just in CI, before the PR is opened.

## 10. Paying down the drift

The standards above bind new code now. The existing tree carries known
violations, inventoried here so the debt is visible and bounded rather than
vague:

- `SearchScreen.tsx` (1018 lines): seven reusable pieces trapped in the
  screen file, style threading into every one of them, and the triplicated
  pill button. The 07 section 4 inventory already names `ClanCard`,
  `StatChip`, `Skeleton`, `EmptyState`, and `ErrorState` as shared kit;
  the code has not delivered them yet.
- `HelloClanScreen.tsx` (505 lines) and `TokenScreen.tsx` (591 lines): the
  same threading pattern, at review-surface scale.
- Magic numbers in the search styles: the 48 px badge slot, the 140 filter
  flexBasis, the 200 and 280 px skeleton lines, the 88 and 240 px minimum
  widths, the 0.6 letter-spacing, and one literal 9999 that should be
  `t.radius.pill`.

Pay-down policy, in priority order:

1. The search screen split is its own card before T-M1-3 lands, because the
   clan detail screen built on top of the current file would copy the exact
   shape being paid down. The split moves the promoted pieces into
   `src/components/`, deletes the threading, and collapses the three buttons
   into one kit button. Behavior must not change; the golden path
   walkthrough and the test suite are the proof.
2. Every later screen follows the standards outright; no screen inherits an
   exemption.
3. `HelloClanScreen` and `TokenScreen` are internal review surfaces; their
   cleanup rides the next card that touches each file, and never a dedicated
   card of their own.
4. Magic numbers resolve during the split (they move into the components
   that own them, as named constants or tokens).

Refactoring follows session 11's safe order: understand the behavior, make
one focused change, run the tests, confirm the golden path on the preview
deploy, commit. No big-bang rewrite; the working screen keeps working while
its file gets smaller.
