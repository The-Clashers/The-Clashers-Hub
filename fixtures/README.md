# fixtures/

Anonymized copies of real game-API payloads, used by the engine tests
(SR-07, STD-12). Real structure, placeholder names: no real player tags,
no real clan tags, no personal data (06 section 6 "Privacy").

| File | Shape | Used by |
|---|---|---|
| `maxed-player.json` | Every unit at maxLevel; the engine returns the maxed band with an empty top-deficits list (AC-04) | `src/engines/rushed.test.ts` |
| `rushed-player.json` | Several units below maxLevel; the engine returns a non-zero percentage and a populated top-deficits list | `src/engines/rushed.test.ts` |
| `super-troop-player.json` | Every super troop active at level 1; the engine drops them (the base troop entries carry the real levels) so the verdict reads maxed (AC-04) | `src/engines/rushed.test.ts` |
| `null-maxlevel-player.json` | Three units with `maxLevel: null` (brand-new content the API has not caught up to); the engine skips them and counts them in the footnote (SR-14) | `src/engines/rushed.test.ts` |

The fixtures are the only test data the engines read; the unit tests never
hit the network (NFR-07). Adding a fixture is a docs-sized PR; the
completeness tests fail loudly when the reference data drifts (05 section 5).
