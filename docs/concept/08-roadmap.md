# 08 - Roadmap

Ten weeks, three people, part-time. The plan front-loads risk (the request path
in week 1, the flagship engine by week 5) and keeps a full buffer week at the
end. Milestone scope maps to the feature list ([03 §"Feature table"](./03-features-list.md)); nothing
outside P0/P1 is scheduled; stretch features live in the buffer.

## 1. Milestones

| M | Weeks | Ships | Definition of done |
|---|---|---|---|
| **M0: Scaffold & pipeline** | 1 | repo + CI + Vite/RN-Web/TS/Router/Query running; tokens file; API tier with `COC_API_TOKEN` wired through the proxy; a "hello clan" screen (hardcoded tag → real data) | PR checks green on `main`; preview deploy works; the key is provably absent from the client bundle |
| **M1: Search & clan** | 2–3 | F-01, F-02, F-03, F-04, F-05 (search flow, clan detail, roster, donation flags, tag lookup), state matrix + skeletons | Golden path A end-to-end ([03 §3](./03-features-list.md)); donation engine ≥ 90% covered; tag normalization owned by `TagInput` only |
| **M2: Player & analysis** | 4–5 | F-06, F-07, F-08, F-17, F-19 (player detail, rushed engine + super-troop map + reference-data bundle, achievements), heroes panel, progression grid, refresh control | Rushed % stable across the fixture set (incl. maxed account, super troops active, null maxLevel); progression grid renders icons + maxed-for-TH chips from the single player fetch; `/player/:tag` shareable |
| **M3: War & compare** | 6–7 | F-09, F-10, F-11, F-12, F-13, F-18 (current war + preparation-day scouting + per-member impact, war log + efficiency, both compares, recent searches) | Private-log notice designed; scouting mismatch highlighting tested against a preparation-day fixture; compare URLs shareable; radar chart is the cut line if the week compresses |
| **M4: Polish & demo** | 8–9 | a11y pass, perf pass (virtualization, route code-splitting), empty states, favicon + OG tags, demo runbook, report outline | keyboard-only walkthrough of golden path A; Lighthouse-style sanity (contrast, no layout shift from badge loads); grader demo rehearsed |
| | 10 | buffer: bugfixes, report writing, presentation rehearsal | nothing new scheduled, ever |

## 2. Team split (three owners, everyone codes)

| Role | Owns |
|---|---|
| **Platform / API lead** | M0, the serverless tier, caching, CI, deploys, key hygiene |
| **Screens** | search flow, results, clan detail, roster, player detail + progression grid, war screens + scouting view, compare |
| **Engines & design system** | rushed engine + super-troop map, reference data (Town Hall caps, icon map, equipment caps), donation balance, war impact metrics, fixtures, engine tests, tokens, shared components, `Legend` |

The screens/engines split mirrors the app's own boundary (see
[01 §3](./01-tech-stack.md)): one owner owns what the user sees, one owns what
the numbers mean.

Rotation rules that keep the bus factor at ≥ 2 per area: platform lead merges
but never reviews their own PRs; review pairs rotate weekly; in M4 everyone
spends a day on another owner's area. Every PR walks a golden path before
merge (that's the smoke test, manual, on the preview deploy).

## 3. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chart rendering perf on web (SVG + long lists) | medium | medium | virtualize every list from day 1; four chart types max; chart prototype in M3 week 1, not week 2 |
| Upstream 429 during a live demo | low | high (embarrassment) | TTL cache + `upstream_busy` auto-retry + a pre-demo warm visit of the grader's clan |
| Private war log surprises | certain | low | designed state ([04 §6](./04-api-strategy.md)), tested in M3 |
| Cold-start cache misses | certain | negligible | costs one upstream call; accepted by design ([04 §5](./04-api-strategy.md)) |
| Engine edge cases (new content, null maxLevel) | medium | medium | fixture-driven tests from M2 ([05 §5](./05-scoring-engines.md)); reference-data fallback first, "new content skipped" footnote as the last resort |
| Reference data drifts when the game ships new content | medium | low | versioned bundle in the repo; completeness tests fail loudly on drift; the footnote absorbs whatever is still un-mapped |
| API key leak | low | high | env-only, gitignored `.env`, key-check step in CI (grep the built bundle for the token) |
| Scope creep (tracker features, accounts) | high | high | the non-goals in [00 §5](./00-overview.md) are the contract; any such PR gets closed with a link to this doc |
| Member availability drops mid-semester | medium | medium | rotation + ≥ 2 owners per area (§2) |

## 4. Definition of done (every PR, no exceptions)

1. TypeScript strict-clean; ESLint clean; unit tests for any touched engine path.
2. All four states designed for any new screen or data view ([06 §3](./06-data-flow-and-caching.md)).
3. Keyboard-usable; focus visible; roles/labels on interactive elements.
4. Reviewed on the Vercel preview, not on screenshots.
5. If it changes a decision, the matching concept doc changes in the same PR.

## 5. Demo runbook (M4)

1. Open the deployed URL. Type the grader's clan name. (Pre-warmed in the
   cache minutes before, see the risk register.)
2. Land on the roster: point out donation flags, flip "needs attention" sort.
3. Tap a member: rushed gauge, category bars, "what to upgrade next" list,
   and the progression grid (every troop level, one glance).
4. Paste a second tag into compare (P1), the demo moment.
5. Close with the architecture slide: the key boundary and the analysis
   boundary ([01 §3](./01-tech-stack.md)), one diagram, thirty seconds, done.
