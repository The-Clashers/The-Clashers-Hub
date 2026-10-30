# 05 - Scoring Engines

The engines are the product's reason to exist ([00 §"Product pillars" #2](./00-overview.md)). They
turn raw API numbers into verdicts. Each engine is a **pure TypeScript module**:
no React, no network, no clock, data in, judgment out. That rule is what makes
them table-driven-testable to 90%+ coverage ([NFR-07](./02-requirements-tracker.md)) and reusable anywhere.

All engines run **client-side** ([01 §"The analysis boundary"](./01-tech-stack.md)), consuming the
JSON our API tier already fetched.

## 1. Rushed analysis (the flagship)

**Question it answers:** "How developed is this account really, behind the
Town Hall badge?"

**Input:** the player payload's unit arrays. Each unit arrives as
`{ name, level, maxLevel, village }` where `maxLevel` is the unit's **global
maximum** as reported by the API itself; when the API omits it, the bundled
reference data supplies the fallback (below).

**Normalization (the part that makes it honest):**

- *Super troops lie.* A super troop is a temporary boosted variant of a regular
  troop, and the API reports it on the variant's own scale, a player with a
  level-8 Valkyrie who activates Super Valkyrie suddenly shows "Super Valkyrie
  1/12", which reads as an 11-level deficit that does not exist. Before
  analysis, every super troop entry is mapped back to its base troop so the
  player's *real* lab levels are measured:

  | Super troop | Base troop |
  |---|---|
  | Super Barbarian | Barbarian |
  | Super Archer | Archer |
  | Super Giant | Giant |
  | Sneaky Goblin | Goblin |
  | Super Wall Breaker | Wall Breaker |
  | Rocket Balloon | Balloon |
  | Super Wizard | Wizard |
  | Super Witch | Witch |
  | Super Valkyrie | Valkyrie |
  | Inferno Dragon | Dragon |
  | Super Dragon | Dragon |
  | Ice Hound | Lava Hound |

  The map is data (a plain object in `engines/`), not logic. The list above is
  the well-known core; completeness is enforced by a unit test so a new super
  troop can't silently fake someone's rushed score.

- *Reference data backs the numbers.* A small bundle of versioned reference
  files ships with the app: Town Hall cap tables (the maximum level of every
  unit at every Town Hall, per category), the super-troop map above, and hero
  equipment caps. The API's own `maxLevel` stays the primary denominator for
  the rushed formula; the reference tables do two jobs it cannot: they
  resolve units whose `maxLevel` is null (brand-new content the API has not
  caught up to), and they power the **maxed-for-Town-Hall** indicators on the
  progression grid ([F-17](./03-features-list.md)), because a global maximum
  cannot tell a TH14 player whether their lab is done *for TH14*. Updating
  the bundle is a docs-sized PR whenever the game ships new content, and the
  completeness tests below fail loudly when it drifts.

- *Villages are separate.* Units carry a `village` marker (home vs builder
  base). The default analysis is home-village only; builder-base gets its own
  panel, never mixed.

- *Grouping is an adapter's job.* The engine consumes generic
  `UnitLevelEntry { name, level, maxLevel, category }` rows; a thin adapter
  re-buckets the payload's arrays into categories (troops, spells, heroes,
  pets/siege) so engine logic never depends on payload shape details.

**Formula:**

```text
rushed_percent = sum( w_i × max(0, maxLevel_i − level_i) )
                 ────────────────────────────────────────  × 100
                    sum( w_i × maxLevel_i )
```

with equal weights (`w_i = 1`) initially; hero weights can be raised later
without touching the formula's shape.

**Output:** overall percentage; per-category percentage; units counted vs
maxed; per-unit maxed-for-Town-Hall flags (feeding the progression grid
chips); the top-N largest deficits ("what to upgrade next", which answers
[UR-03](./02-requirements-tracker.md) literally).

**Edge cases:** units with a null `maxLevel` fall back to the reference
table's maximum for that unit; a unit missing from both the API and the
reference bundle (brand-new content) is excluded and counted in a "new
content skipped" footnote; a payload with zero usable units returns `null`
("not available") rather than 0.

**Interpretation bands (display copy, not judgments of humans):**
0–5 *core*, 5–15 *light*, 15–30 *rushed*, 30+ *heavy*.

## 2. Donation balance

**Question:** "Who takes but never gives?" ([UR-02](./02-requirements-tracker.md))

**Input:** a clan's `memberList`, every member carries lifetime-season
`donations` and `donationsReceived`.

**Mechanics:**

- `ratio = given / max(received, 1)`, displayed on the chip as `ratio : 1`
  (one decimal at most; a saint reads `∞ : 1`, no data reads as a dash). The
  raw given/received counters stay in their own roster columns instead of
  being repeated inside the chip.
- Target ratio `R` (default 1.0, adjustable client-side with instant
  re-computation, the engine is local, so no refetch).
- A member is **flagged** when `given < R × received` and `received` exceeds a
  noise floor (new members with tiny counters are not public shamed).
- Ranking = deficit `R × received − given`, worst first, the "needs attention"
  ordering on the roster ([F-05](./03-features-list.md)).
- Clan-level health = share of members at-or-above target, shown as one chip
  on the clan header.

**Edge cases:** given > 0 with received = 0 is a saint, not a divide-by-zero;
both zero is *no data*, displayed as a dash, never as a red flag.

## 3. War efficiency

**Question:** "Does this clan (or this member) actually show up for wars?"

**From the war log (per clan):**

- win rate over the most recent N wars;
- stars per attack = `stars / attacks` (attack efficiency, not just volume);
- average destruction per attack;
- "perfect sheets" count (wars where the clan took maximum stars for its team
  size) as a P2 garnish.

**From the current war (per member):**

- attacks used vs allowed (participation, UR-04);
- stars, stars per attack, and average destruction per used attack (impact);
- attack quality: each attack scores `stars × 100 + destructionPercent`
  (a perfect three-star full-destruction attack is 400, the ceiling); a
  member's quality is their best attack, and the participant average sets
  the baseline the table colors against;
- roster table ordered by impact among participants, non-participants listed
  after.

**Edge cases:** wars with zero attacks (fresh roster) are excluded from rates,
not counted as zeros; the engine labels sample size ("last 10 wars") so nobody
over-reads a 3-war window.

## 4. Compare mode

**Question:** "Who's more rushed, you or me?" The demo moment
([00 §"Who it is for"](./00-overview.md)).

**Mechanics:** for each metric in the union of both profiles, render a row
with both values, the delta, and a direction color (better/worse). Player
compare: TH, rushed % overall + per category, hero levels, key achievements,
war stats. Clan compare: size, level, war record, average TH, donation health.

**Deliberate limitation:** per-metric verdicts only, **no single overall
"winner" number**, summing unlike units into one score is false precision
and we will not ship it.

## 5. Testing strategy

- Every engine gets **table-driven unit tests** over `fixtures/`, anonymized
  copies of real payloads ([SR-07](./02-requirements-tracker.md)), including deliberately weird ones: a fully
  maxed account (expect 0%), a fresh TH-limited account, super troops active,
  null `maxLevel` fields (resolved by the reference fallback), zero-donation
  rosters, and a current-war payload mixing participants with zero-attack
  members.
- Property checks where cheap: rushed % always ∈ [0, 100]; the super-troop map
  is total over the fixture set; donation flags never fire below the noise
  floor; the Town Hall cap table covers every Town Hall appearing in the
  fixtures; the icon map resolves every fixture unit name or falls back to
  the documented placeholder.
- Engines may not import React, the router, the API client, or each other's
  internals, enforced by a lint boundary rule, kept honest by CI ([NFR-08](./02-requirements-tracker.md)).
