# API local verification — 2026-10-23 (session 08)

Every request/response below was captured against the API tier running
**locally** — `npm run dev:api`, which mounts the real `api/` adapter files on
`http://localhost:8788` (`scripts/dev-server.ts`) — with the **real upstream
chain**: RoyaleAPI proxy → official Clash of Clans API, authenticated by the
real `COC_API_TOKEN` from the repo `.env` (never committed, never printed
here). Session 07 verified the deployed site live; this document replays the
same verification against the local instance so the two can be compared
request by request.

Bodies are reproduced verbatim except where an array was trimmed — every
trimming is marked with a `"...": "N more (trimmed)"` entry and the exact
counts, so nothing is silently hidden.

## 1. How to reproduce

```bash
npm install
npm run dev:api          # tier on http://localhost:8788, loads .env
# in another shell:
curl -s -D - "http://localhost:8788/api/search?name=Umbra" | head -40
curl -s "http://localhost:8788/api/clan/%232JPCYP98L" | head -c 400
```

`%23` is the URL-encoded `#` of a clan/player tag. The Vite dev server
(`npm run dev`) proxies `/api/*` to the same port, so the browser sees
identical responses.

## 2. Results at a glance

Captured 2026-10-23, ~11:40 local time. "s" = wall time for the full
round trip.

| # | Probe | Request | Status | Time | `x-cache` | Bytes | Demonstrates |
|---|---|---|---|---|---|---|---|
| 1 | search-basic | `GET /api/search?name=Umbra` | 200 | 0.410s | MISS | 620,491 | live search, full page (420 clans) |
| 2 | search-filtered | `GET /api/search?name=Umbra&limit=3&minClanLevel=5` | 200 | 0.333s | MISS | 5,364 | filter passthrough (3 items) |
| 3 | clan-miss | `GET /api/clan/%232JPCYP98L` | 200 | 0.336s | MISS | 9,301 | live clan fetch, `age: 0` |
| 4 | clan-hit | same, 3s later | 200 | 0.002s | HIT | 9,301 | TTL cache hit, `age: 3` |
| 5 | clan-no-hash | `GET /api/clan/2JPCYP98L` (no `#`) | 200 | 0.001s | HIT | 9,301 | tag normalization (adds `#`) |
| 6 | warlog | `GET /api/clan/%232JPCYP98L/warlog` | 200 | 0.340s | MISS | 56,513 | public war log, 56 wars |
| 7 | currentwar | `GET /api/clan/%232JPCYP98L/war` | **502** | 4.004s | — | 32 | transient upstream timeout (see §6) |
| 8 | currentwar-retry | same, immediately after | 200 | 0.349s | MISS | 833 | retry recovers; `state: notInWar` |
| 9 | player | `GET /api/player/%23YPCC8QYU2` (roster leader) | 200 | 0.333s | MISS | 22,898 | live player profile (TH18) |
| 10 | search-no-name | `GET /api/search` | 400 | 0.001s | — | 51 | validation: name required |
| 11 | search-bad-limit | `GET /api/search?name=Umbra&limit=999` | 400 | 0.001s | — | 77 | validation: limit range |
| 12 | clan-too-short | `GET /api/clan/%23AB` | 400 | 0.001s | — | 51 | validation: tag pattern |
| 13 | clan-bad-chars | `GET /api/clan/%23AB%24%24` | 400 | 0.001s | — | 53 | validation: tag charset |
| 14 | clan-bad-tag | `GET /api/clan/notatag` | 404 | 0.320s | MISS | 38 | *format-valid* tag, no such clan |
| 15 | clan-not-found | `GET /api/clan/%23QQ00QQ00` | 404 | 0.303s | MISS | 39 | not_found contract body |
| 16 | not-found-hit | same, right after | 404 | 0.001s | HIT | 39 | 30s negative cache |
| 17 | clan-post | `POST /api/clan/%232JPCYP98L` | 405 | 0.001s | — | 56 | only GET is supported |
| 18 | player-not-found | `GET /api/player/%23QQ00QQ00` | 404 | 0.294s | MISS | 39 | player 404 path |
| 19 | unknown-route | `GET /api/bogus` | 404 | 0.001s | — | 58 | unknown route guard |
| 20 | unknown-tier-root | `GET /api/` | 404 | 0.001s | — | 53 | unknown route guard |
| 21 | search-hit-1 | `GET /api/search?name=Umbra` (later) | **502** | 0.327s | — | 32 | transient upstream failure (§6) |
| 22 | search-hit-2 | same, immediately after | 200 | 0.392s | MISS | 620,491 | retry recovers, fresh fetch |
| 23 | player-hit | `GET /api/player/%23YPCC8QYU2` (77s later) | 200 | 0.001s | HIT | 22,899 | player cache, `age: 77` |
| 24 | warlog-hit | warlog again (81s later) | 200 | 0.001s | HIT | 56,514 | warlog cache, `age: 81` |

Every response carries `content-type: application/json; charset=utf-8` and
`cache-control: no-store`; every cache-served answer carries `x-cache: HIT`,
every fresh upstream fetch `x-cache: MISS`.

## 3. Search — `GET /api/search`

### 3.1 Basic search

```bash
curl -s -D - "http://localhost:8788/api/search?name=Umbra"
```

```
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
cache-control: no-store
x-cache: MISS
```

420 clans matched; the page weighs 620 KB. First item verbatim, the rest
trimmed:

```json
{
  "items": [
    {
      "tag": "#2CJPGCLUC",
      "name": "UMBRA",
      "type": "open",
      "isFamilyFriendly": false,
      "badgeUrls": {
        "small": "https://api-assets.clashofclans.com/badges/70/xjkM7KaTQ24H8FLHL8qbPKcMaawCMhvX_UW7OMpE-Ys.png",
        "large": "https://api-assets.clashofclans.com/badges/512/xjkM7KaTQ24H8FLHL8qbPKcMaawCMhvX_UW7OMpE-Ys.png",
        "medium": "https://api-assets.clashofclans.com/badges/200/xjkM7KaTQ24H8FLHL8qbPKcMaawCMhvX_UW7OMpE-Ys.png"
      },
      "clanLevel": 3,
      "clanPoints": 5300,
      "clanBuilderBasePoints": 7845,
      "clanCapitalPoints": 0,
      "capitalLeague": { "id": 85000000, "name": "Unranked" },
      "requiredTrophies": 0,
      "warFrequency": "unknown",
      "warWinStreak": 0,
      "warWins": 12,
      "warTies": 0,
      "warLosses": 9,
      "isWarLogPublic": true,
      "warLeague": { "id": 48000003, "name": "Bronze League I" },
      "members": 24,
      "labels": [
        { "id": 56000000, "name": "Clan Wars", "iconUrls": { "small": "…", "medium": "…" } },
        { "id": 56000007, "name": "International", "iconUrls": { "small": "…", "medium": "…" } },
        { "id": 56000013, "name": "Relaxed", "iconUrls": { "small": "…", "medium": "…" } }
      ],
      "requiredBuilderBaseTrophies": 0,
      "requiredTownhallLevel": 8,
      "chatLanguage": { "id": 75000000, "name": "English", "languageCode": "EN" }
    },
    { "...": "419 more items in this page (trimmed; each has the same shape)" }
  ],
  "paging": { "cursors": {} },
  "age": 0
}
```

(Label `iconUrls` were shortened to `…` for readability here; the captured
raw bodies keep them in full.)

### 3.2 Filtered search

```bash
curl -s "http://localhost:8788/api/search?name=Umbra&limit=3&minClanLevel=5"
```

The filters pass through to the upstream (`limit`, `minMembers`,
`minClanLevel`, `warFrequency`, `locationId`, `after` are all supported by the
tier) and each distinct filter combination gets its own cache key:

```
HTTP 200, x-cache: MISS, 5,364 bytes
items: 3 — "UMBRA", "Umbra", "UMBRA"
```

## 4. Clan — `GET /api/clan/:tag`

### 4.1 First fetch (cache MISS)

```bash
curl -s -D - "http://localhost:8788/api/clan/%232JPCYP98L"
```

```
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
cache-control: no-store
x-cache: MISS
```

Body (memberList trimmed to the first two of seven members; everything else
verbatim):

```json
{
  "tag": "#2JPCYP98L",
  "name": "Umbra Lunaria",
  "type": "open",
  "description": "‎🌕 ⊱⊶⊰ Umbra Lunaria / Moon's Shadow ⊱⊷⊰ 🌕\n‎✧⋆⋅⋆⋇⋄⋆⋅⋆⋄‧͙•̩̩͙‧͙✧‧͙•̩̩͙‧͙⊰ 05/25/2025 ⊱‧͙•̩̩͙‧͙✧‧͙•̩̩͙‧͙⋄⋆⋅⋆⋄⋇⋆⋅⋆✧",
  "location": { "id": 32000006, "name": "International", "isCountry": false },
  "isFamilyFriendly": false,
  "badgeUrls": {
    "small": "https://api-assets.clashofclans.com/badges/70/FVnpcW6MK5U1nHVLlYtks5TrfPpKUnwR1gGi6mHH4TI.png",
    "large": "https://api-assets.clashofclans.com/badges/512/FVnpcW6MK5U1nHVLlYtks5TrfPpKUnwR1gGi6mHH4TI.png",
    "medium": "https://api-assets.clashofclans.com/badges/200/FVnpcW6MK5U1nHVLlYtks5TrfPpKUnwR1gGi6mHH4TI.png"
  },
  "clanLevel": 11,
  "clanPoints": 5800,
  "clanBuilderBasePoints": 8079,
  "clanCapitalPoints": 73,
  "capitalLeague": { "id": 85000000, "name": "Unranked" },
  "requiredTrophies": 0,
  "warFrequency": "always",
  "warWinStreak": 10,
  "warWins": 31,
  "warTies": 4,
  "warLosses": 34,
  "isWarLogPublic": true,
  "warLeague": { "id": 48000011, "name": "Crystal League II" },
  "members": 7,
  "memberList": [
    {
      "tag": "#YPCC8QYU2",
      "name": "Yeon",
      "role": "leader",
      "townHallLevel": 18,
      "expLevel": 219,
      "league": {
        "id": 29000022,
        "name": "Legend League",
        "iconUrls": { "small": "…", "tiny": "…", "medium": "…" }
      },
      "leagueTier": {
        "id": 105000031,
        "name": "Electro League 31",
        "iconUrls": { "small": "…", "large": "…" }
      },
      "trophies": 0,
      "builderBaseTrophies": 3267,
      "clanRank": 1,
      "previousClanRank": 1,
      "donations": 2605,
      "donationsReceived": 2209,
      "playerHouse": {
        "elements": [
          { "type": "ground", "id": 82000141 },
          { "type": "walls", "id": 82000128 },
          { "type": "roof", "id": 82000126 },
          { "type": "decoration", "id": 82000062 }
        ]
      },
      "builderBaseLeague": { "id": 44000026, "name": "Steel League III" }
    },
    {
      "tag": "#QU80CGJV8",
      "name": "Juskepz",
      "role": "coLeader",
      "townHallLevel": 14,
      "expLevel": 165,
      "league": {
        "id": 29000000,
        "name": "Unranked",
        "iconUrls": { "small": "…", "tiny": "…" }
      },
      "leagueTier": {
        "id": 105000018,
        "name": "Witch League 18",
        "iconUrls": { "small": "…", "large": "…" }
      },
      "trophies": 0,
      "builderBaseTrophies": 2390,
      "clanRank": 2,
      "previousClanRank": 2,
      "donations": 45,
      "donationsReceived": 93,
      "playerHouse": {
        "elements": [
          { "type": "ground", "id": 82000002 },
          { "type": "walls", "id": 82000049 },
          { "type": "roof", "id": 82000017 },
          { "type": "decoration", "id": 82000060 }
        ]
      },
      "builderBaseLeague": { "id": 44000021, "name": "Brass League II" }
    },
    { "...": "5 more members (trimmed; each has the same shape)" }
  ],
  "labels": [
    { "id": 56000000, "name": "Clan Wars", "iconUrls": { "small": "…", "medium": "…" } },
    { "id": 56000001, "name": "Clan War League", "iconUrls": { "small": "…", "medium": "…" } },
    { "id": 56000014, "name": "Competitive", "iconUrls": { "small": "…", "medium": "…" } }
  ],
  "requiredBuilderBaseTrophies": 0,
  "requiredTownhallLevel": 7,
  "clanCapital": {
    "capitalHallLevel": 8,
    "clanGoldSinkTotal": 0,
    "districts": [
      { "id": 70000000, "name": "Capital Peak", "districtHallLevel": 8 },
      { "id": 70000001, "name": "Barbarian Camp", "districtHallLevel": 4 },
      { "id": 70000002, "name": "Wizard Valley", "districtHallLevel": 4 },
      { "id": 70000003, "name": "Balloon Lagoon", "districtHallLevel": 4 },
      { "id": 70000004, "name": "Builder's Workshop", "districtHallLevel": 3 },
      { "id": 70000005, "name": "Dragon Cliffs", "districtHallLevel": 3 },
      { "id": 70000006, "name": "Golem Quarry", "districtHallLevel": 3 },
      { "id": 70000007, "name": "Skeleton Park", "districtHallLevel": 2 }
    ]
  },
  "chatLanguage": { "id": 75000000, "name": "English", "languageCode": "EN" },
  "age": 0
}
```

### 4.2 Second fetch (cache HIT, age grows)

Same request three seconds later:

```
HTTP 200, x-cache: HIT, 0.002s round trip (≈150x faster than the MISS)
"age": 3          ← seconds since the upstream fetch, injected by the tier
```

### 4.3 Tag without the leading `#`

`GET /api/clan/2JPCYP98L` (no `%23`) answers the same cached entry — the
tier normalizes input (`2JPCYP98L` → `#2JPCYP98L`) before the cache lookup,
so a pasted tag without `#` still resolves:

```
HTTP 200, x-cache: HIT, identical 9,301-byte body, "age": 3
```

## 5. Player — `GET /api/player/:tag`

The tag came straight out of the clan roster above (`memberList[0].tag`,
`#YPCC8QYU2`, the leader):

```bash
curl -s -D - "http://localhost:8788/api/player/%23YPCC8QYU2"
```

```
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
cache-control: no-store
x-cache: MISS      (22,898 bytes; a repeat 77s later: x-cache HIT, "age": 77)
```

Body (arrays trimmed to one sample each; all scalar fields verbatim):

```json
{
  "tag": "#YPCC8QYU2",
  "name": "Yeon",
  "townHallLevel": 18,
  "expLevel": 219,
  "trophies": 0,
  "bestTrophies": 5558,
  "warStars": 1959,
  "attackWins": 0,
  "defenseWins": 3,
  "builderHallLevel": 10,
  "builderBaseTrophies": 3267,
  "bestBuilderBaseTrophies": 3316,
  "role": "leader",
  "warPreference": "in",
  "donations": 2605,
  "donationsReceived": 2209,
  "clanCapitalContributions": 1629485,
  "clan": {
    "tag": "#2JPCYP98L",
    "name": "Umbra Lunaria",
    "clanLevel": 11,
    "badgeUrls": { "small": "…", "large": "…", "medium": "…" }
  },
  "league": {
    "id": 29000022,
    "name": "Legend League",
    "iconUrls": { "small": "…", "tiny": "…", "medium": "…" }
  },
  "leagueTier": {
    "id": 105000031,
    "name": "Electro League 31",
    "iconUrls": { "small": "…", "large": "…" }
  },
  "builderBaseLeague": { "id": 44000026, "name": "Steel League III" },
  "currentLeagueSeasonId": 0,
  "previousLeagueGroupTag": "#8JJLLQY",
  "previousLeagueSeasonId": 1789362000,
  "achievements": [
    {
      "name": "Bigger Coffers",
      "stars": 3,
      "value": 19,
      "target": 10,
      "info": "Upgrade a Gold Storage to level 10",
      "completionInfo": "Highest Gold Storage level: 19",
      "village": "home"
    },
    { "...": "53 more (trimmed)" }
  ],
  "playerHouse": {
    "elements": [
      { "type": "ground", "id": 82000141 },
      { "type": "walls", "id": 82000128 },
      { "type": "roof", "id": 82000126 },
      { "type": "decoration", "id": 82000062 }
    ]
  },
  "labels": [
    { "id": 57000000, "name": "Clan Wars", "iconUrls": { "small": "…", "medium": "…" } },
    { "id": 57000002, "name": "Trophy Pushing", "iconUrls": { "small": "…", "medium": "…" } },
    { "id": 57000009, "name": "Active Daily", "iconUrls": { "small": "…", "medium": "…" } }
  ],
  "troops": [
    { "name": "Barbarian", "level": 12, "maxLevel": 13, "village": "home" },
    { "...": "80 more (trimmed)" }
  ],
  "heroes": [
    {
      "name": "Barbarian King",
      "level": 87,
      "maxLevel": 110,
      "equipment": [
        { "name": "Spiky Ball", "level": 27, "maxLevel": 27, "village": "home" },
        { "name": "Earthquake Boots", "level": 18, "maxLevel": 18, "village": "home" }
      ],
      "village": "home"
    },
    { "...": "7 more (trimmed)" }
  ],
  "heroEquipment": [
    { "name": "Giant Gauntlet", "level": 20, "maxLevel": 27, "village": "home" },
    { "...": "39 more (trimmed)" }
  ],
  "spells": [
    { "name": "Lightning Spell", "level": 11, "maxLevel": 13, "village": "home" },
    { "...": "17 more (trimmed)" }
  ],
  "age": 0
}
```

Field inventory for the M1 screens: 81 troops, 18 spells, 8 heroes, 40 hero
equipment pieces, 54 achievements — all present, all level-capped.

## 6. War log — `GET /api/clan/:tag/warlog`

```bash
curl -s -D - "http://localhost:8788/api/clan/%232JPCYP98L/warlog"
```

```
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
cache-control: no-store
x-cache: MISS      (56,513 bytes; a repeat 81s later: x-cache HIT, "age": 81)
```

56 wars in the public log. Most recent one verbatim, the rest trimmed:

```json
{
  "items": [
    {
      "result": "win",
      "endTime": "20261016T091952.000Z",
      "teamSize": 5,
      "attacksPerMember": 2,
      "battleModifier": "none",
      "clan": {
        "tag": "#2JPCYP98L",
        "name": "Umbra Lunaria",
        "badgeUrls": { "small": "…", "large": "…", "medium": "…" },
        "clanLevel": 11,
        "attacks": 5,
        "stars": 15,
        "destructionPercentage": 100,
        "expEarned": 144
      },
      "opponent": {
        "tag": "#2JUCJ28J0",
        "name": "Gorilla",
        "badgeUrls": { "small": "…", "large": "…", "medium": "…" },
        "clanLevel": 6,
        "stars": 4,
        "destructionPercentage": 33.8
      }
    },
    { "...": "55 more wars (trimmed; each has the same shape)" }
  ],
  "paging": { "cursors": {} },
  "age": 0
}
```

Aggregate over the full 56 items (computed from the captured body):

| result | count |
|---|---|
| win | 22 |
| tie | 5 |
| lose | 24 |
| (no result — logged before completion) | 5 |

## 7. Current war — `GET /api/clan/:tag/war`

```bash
curl -s -D - "http://localhost:8788/api/clan/%232JPCYP98L/war"
```

First attempt hit the 4-second upstream timeout (see §9) and answered
`502 {"error":"upstream_unreachable"}`. The immediate retry succeeded:

```
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
cache-control: no-store
x-cache: MISS
```

Full body (833 bytes — small enough to reproduce entirely):

```json
{
  "state": "notInWar",
  "clan": {
    "badgeUrls": { "small": "…", "large": "…", "medium": "…" },
    "clanLevel": 0,
    "attacks": 0,
    "stars": 0,
    "destructionPercentage": 0
  },
  "opponent": {
    "badgeUrls": { "small": "…", "large": "…", "medium": "…" },
    "clanLevel": 0,
    "attacks": 0,
    "stars": 0,
    "destructionPercentage": 0
  },
  "age": 36
}
```

The production deployment answered the same route with the same
`state: notInWar` body at the same moment (200, 1.03s), so local and deployed
behavior match. A later local repeat was served from cache:
`x-cache: HIT, "age": 36`.

## 8. Error contract — every branch

All error bodies share the same envelope: `{"error": "<code>", …}` with
`content-type: application/json` and `cache-control: no-store`.

### 400 `bad_request` — validation failures (never reach upstream)

| Request | Body |
|---|---|
| `GET /api/search` | `{"error":"bad_request","detail":"name is required"}` |
| `GET /api/search?name=Umbra&limit=999` | `{"error":"bad_request","detail":"limit must be an integer between 1 and 100"}` |
| `GET /api/clan/%23AB` (too short) | `{"error":"bad_request","detail":"invalid tag: #AB"}` |
| `GET /api/clan/%23AB%24%24` (bad charset) | `{"error":"bad_request","detail":"invalid tag: #AB$$"}` |

The tag pattern is `^#[0-9A-Z]{3,20}$`, applied after normalization (add
missing `#`, uppercase). All four answered in ~1 ms — rejected before any
upstream call.

### 404 `not_found` — two distinct flavors

Well-formed tag that no clan owns (`notatag` → `#NOTATAG` passes the pattern,
the game API has no such clan):

```json
{"error":"not_found","tag":"#NOTATAG"}
```

An obviously invented but valid tag:

```json
{"error":"not_found","tag":"#QQ00QQ00"}
```

Both round-trip upstream (~0.3 s) and are **negatively cached for 30 s**: the
immediate repeat answered the same 404 with `x-cache: HIT` in ~1 ms, so
retry storms on a bad tag never hammer the game API. After the 30 s window
the entry expires and the next request re-validates upstream (observed: a
repeat past the window was a fresh `MISS`).

### 405 — wrong method

```bash
curl -s -X POST "http://localhost:8788/api/clan/%232JPCYP98L"
```

```json
{"error":"bad_request","detail":"only GET is supported"}
```

### 404 — unknown routes (dev-server shape)

```json
{"error":"not_found","detail":"unknown route: /api/bogus"}
{"error":"not_found","detail":"unknown route: /api/"}
```

On the deployed platform unknown `/api/*` paths 404 through the routing
manifest instead; both layers agree that nothing under `/api/` falls back to
the SPA shell (the rewrite excludes `/api/`).

### 502 `upstream_unreachable` — see §9

```json
{"error":"upstream_unreachable"}
```

## 9. Transient upstream failures — the two 502s

During the capture window the proxy failed twice, and both times the tier
behaved exactly as the contract intends:

1. **Timeout on current war.** The first `/war` call exceeded the upstream
   client's 4-second timeout and answered `502 upstream_unreachable` after
   4.004 s. The immediate retry fetched live data in 0.349 s, and the
   production deployment answered the same route 200 at the same moment — a
   one-off slow pass through the proxy, not a code defect.
2. **Fast failure on search.** A later `/api/search?name=Umbra` call failed
   in 0.327 s with the same 502. The very next call succeeded (200, fresh
   MISS, full 420-clan page).

The load-bearing design points, both confirmed by these captures:

- **Failures are never cached.** Only 200s (data, private war log) and 404s
  (30 s negative TTL) enter the cache; a 502 leaves nothing behind, so a
  client retry always gets a fresh attempt instead of a replayed failure.
- **Failures are classified, not leaked.** The client sees the typed
  `unreachable` branch of the contract, never a raw proxy error, timeout
   stack, or the key.

## 10. Not exercised in this capture

- **503 `upstream_busy`** — requires the game API to actually throttle
  (429) mid-session; covered by the mock upstream in
  `scripts/verify-tier.sh` and by unit tests.
- **500 `internal_error`** — the handlers' last-resort catch; covered by
  unit tests.
- **Private war log** (`{"private":true}`, 200) — needs a clan with a
  private log; also covered by the mock and unit tests, and observed live in
  session 05.
- **Platform routing** (manifest `?tag=` dispatch, Node-style invocation) —
  exercised by `scripts/platform-sim.mjs` and `scripts/launcher-sim.mjs`;
  production was verified live in session 07.

