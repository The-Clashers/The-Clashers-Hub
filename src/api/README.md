# src/api/ — browser-side typed clients for our own tier

This is the **client half** of the API story: typed fetch wrappers that the
React screens use to call *our own* serverless routes (`/api/*`, the
[`api/`](../../api/) folder at the repo root — Vercel's serverless convention).
See [docs/concept/01-tech-stack.md §5](../../docs/concept/01-tech-stack.md)
for the planned layout.

| File | Calls | Used by |
|---|---|---|
| `clan.ts` | `GET /api/clan/:tag` | `screens/ClanScreen.tsx` |
| `player.ts` | `GET /api/player/:tag` | `screens/PlayerScreen.tsx` |
| `war.ts` | `GET /api/clan/:tag/war` | `screens/ClanScreen.tsx` |
| `warlog.ts` | `GET /api/clan/:tag/warlog` (the private body resolves as a success shape) | `screens/ClanScreen.tsx` |
| `search.ts` | `GET /api/search?name=…` (+ server-side filters, cursor) | `screens/SearchScreen.tsx`, `components/LookupSearch.tsx` (the three-character floor constants) |
| `locations.ts` | nothing (bundled filter constants, ids verified live) | `screens/SearchScreen.tsx` |
| `labels.ts` | nothing (bundled clan-label filter constants, ids verified from live captures) | `screens/SearchScreen.tsx` |
| `chat-languages.ts` | nothing (bundled chat-language filter constants, codes matched client-side) | `screens/SearchScreen.tsx` |
| `league-tiers.ts` | nothing (bundled ranked-ladder table, ids 105000000-105000036, names cross-checked against live captures) | `screens/SearchScreen.tsx` (the league-requirement filter), `api/search.ts` (the tier lookup) |

Each client:

- owns the `fetch` and parses the JSON into a shape covering only the fields
  the screens actually read (a payload change upstream never breaks the
  build, only the screen that needs the new field);
- turns the tier's JSON error contract
  ([docs/concept/04-api-strategy.md §6](../../docs/concept/04-api-strategy.md))
  into a **discriminated union** (`{ kind: 'not_found' | 'busy' |
  'unreachable' | 'bad_request' }`) so screens branch on `kind` instead of
  re-checking strings;
- throws a single error type (`ClanFetchError`) so TanStack Query sees one
  failure path.

New screens that need more endpoints add a sibling file here (e.g.
`player.ts`, `warlog.ts`) following the same pattern — the serverless tier
they call is never imported from `src/`; the two trees only meet over HTTP.
