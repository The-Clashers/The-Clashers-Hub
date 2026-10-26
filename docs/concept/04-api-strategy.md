# 04 - API Strategy

How The Clashers Hub talks to the official Clash of Clans API safely, cheaply,
and within its rules. This is the doc that keeps the API key alive and the app
un-banned.

## 1. The upstream in plain terms

The official Clash of Clans developer API (<https://developer.clashofclans.com>)
is free, REST+JSON, and authenticated with a per-developer-account JWT key.
Two properties shape everything below:

1. **Per-key throttling.** Rate limits are unpublished and per key. We design as
   if the ceiling is low: cache aggressively, never fan out, and treat a 429 as
   a first-class state, not a crash.
2. **Static-IP allowlist.** A key is locked to the IP addresses you register on
   it. Serverless platforms egress from dynamic IPs, you cannot allowlist what
   changes on every cold start.

## 2. The allowlist problem and the proxy

We cannot put our serverless functions' egress IPs on the key (they are
dynamic), so all upstream calls route through the **RoyaleAPI community proxy**
(`cocproxy.royaleapi.dev`): a free, widely-used relay whose own IP is stable
and published. We allowlist *the proxy's IP* on our key and point
`COC_API_BASE_URL` at the proxy. When creating the key, enter the proxy's
current IP (listed on its page) in the allowed-IP field; a fresh key on the
same proxy is the normal setup. Requests then flow:

our function → proxy (allowlisted IP) → game API (our key) → back.

The proxy is transport only: it holds no credentials and sees nothing the key
doesn't already authorize. It is the standard community solution to exactly
this allowlist problem.

**Our project gets its own key**, created from the team's designated game
account. It is never shared with any other project, so revoking it at the end
of the semester touches nothing but this app.

## 3. Endpoints we use

| Endpoint | Gives us | Notes |
|---|---|---|
| `GET /clans` | clan search by name + filters (`minMembers`, `minClanLevel`, `warFrequency`, `locationId`, `limit`, `after`) | the only "search by name" the API has |
| `GET /clans/{tag}` | full clan profile **including the whole roster inline** (`memberList`: role, TH, trophies, league, donations, donations received, XP, war preference) | roster + donation data in ONE call |
| `GET /players/{tag}` | player profile: unit arrays with `level` + `maxLevel`, heroes, spells, achievements, league | everything the rushed engine needs ([05](./05-scoring-engines.md)) |
| `GET /clans/{tag}/currentwar` | live war state, both clans' stars/destruction, per-member attacks | works for every clan |
| `GET /clans/{tag}/warlog` | war history with results | **only for clans with a public log**, 403 otherwise |
| `GET /locations` | the location list for the search filter | near-static data, cache long |
| `GET /clans/{tag}/capitalraidseasons` | capital raid history | P2, only if F-16 survives the cut line |

## 4. Facts that shaped the UX (and one trap we avoid)

- **There is no player search by name.** Players are fetchable by exact tag
  only, so the paste-a-tag box ([F-03](./03-features-list.md)) is the only
  direct route to a player. Clans are the flexible ones: searchable by name
  through `GET /clans` and fetchable by exact tag through `GET /clans/{tag}`,
  so the search bar takes both and a leading `#` is what says "tag, not
  name" (bare tags and names share the same alphabet). We never promise
  name-based player search.
- **Tags start with `#`** and must be URL-encoded (`%23`). Exactly one
  module owns the tag rule and its wording; exactly one layer owns
  encoding.
- **`memberList` is complete.** The roster screen needs no per-member fetches:
  donations, trophies, and XP all arrive with the clan call. This is why the
  clan screen is one cached request, not fifty.
- **Private war logs are a state, not an error.** The API's response tells us
  when a log is private; we show a designed notice ([F-09](./03-features-list.md)), never a crash.

## 5. Our API surface (the thin tier)

The serverless tier exposes five routes. Each one: validate input → check the
TTL cache → maybe call upstream through the proxy → return JSON.

| Route | Upstream | TTL |
|---|---|---|
| `GET /api/search?name=&minMembers=&minClanLevel=&limit=&after=` | `/clans` | 60 s |
| `GET /api/clan/:tag` | `/clans/{tag}` | 180 s |
| `GET /api/player/:tag` | `/players/{tag}` | 300 s |
| `GET /api/clan/:tag/war` | `/clans/{tag}/currentwar` | 120 s (attacks land in bursts) |
| `GET /api/clan/:tag/warlog` | `/clans/{tag}/warlog` | 600 s |

The cache is an in-memory `Map` per function instance with a small LRU
wrapper ([06 §"Cache layers"](./06-data-flow-and-caching.md)). Every response
carries an `age` field (seconds since the upstream fetch) so the client can
show how fresh its data is, honestly, next to the manual refresh control
([06 §"Manual refresh"](./06-data-flow-and-caching.md)). Serverless
cold starts reset the cache; that is acceptable: a
cold start costs exactly one upstream call, which is the same call a cache
miss would have made anyway. A shared Redis tier would make the cache sticky
across instances, but it is deliberately out of scope; see the storage ladder
in [06](./06-data-flow-and-caching.md).

## 6. Error contract

The client never sees raw upstream errors; the tier maps everything to a small
JSON contract:

| Upstream | Our response | Client behavior |
|---|---|---|
| 404 / invalid tag | `404 { "error": "not_found", "tag": "..." }` | "No clan/player with this tag" + tag-correction hint |
| 429 | `503 { "error": "upstream_busy", "retryAfter": 30 }` | auto-retry with backoff + "trying again" toast |
| 403 on warlog (private) | `200 { "private": true, "age": N }` | designed private-log notice |
| 5xx / network | `502 { "error": "upstream_unreachable" }` | error state with manual retry |
| our own validation | `400 { "error": "bad_request", "detail": ... }` | developer-facing; should never surface in normal use |

`upstream_busy` is the one the client handles gracefully by design, a class
demo hitting a cold cache at the worst moment degrades to "one moment…" not
a red screen.

## 7. Key hygiene

- `COC_API_TOKEN` and `COC_API_BASE_URL` live **only** in the Vercel project's
  environment settings. Never in code, never in a committed `.env`, never in a
  client `import.meta.env` variable (client env is bundle-visible by definition).
- `.env*` is gitignored from the first commit; CI never needs the key because
  tests run on fixtures ([01 §"Development workflow"](./01-tech-stack.md)).
- The key is generated from the team's designated account, used only here, and
  revoked at the end of the course.
- Optional hardening (P2, only if the deploy is shared widely): a shared-secret
  header on `/api/*` routes. It guards against drive-by scraping of our deploy,
  not against anything serious, the tier holds no user data.

## 8. Throttle math (why the cache is enough)

Worst realistic case, a 30-person class demo, everyone browsing at once:
every screen is served from a cache with a 60–600 s TTL, so distinct upstream
calls ≈ distinct clans viewed (~30) + players opened (~50) ≈ 80 calls over
several minutes, i.e. a sustained rate well under 1 request/second. Repeat
visits hit either the client cache or the function cache and cost the key
nothing. Even counting every cold start as a miss, we sit orders of magnitude
below any plausible per-key ceiling. If we ever *do* see 429s, the fixes are,
in order: raise TTLs → add the courtesy per-IP cap → cut features. Not "buy
something".
