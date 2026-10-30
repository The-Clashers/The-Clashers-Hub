// A tiny stand-in game API for local development and tier verification,
// serving anonymized fixture-shaped payloads on http://localhost:8787.
// Run it next to the tier: COC_API_BASE_URL=http://localhost:8787/v1
// COC_API_TOKEN=mock npm run dev:api
//
// Special tags and names exercise the whole error contract:
//   name contains "fail"        -> 500 (upstream_unreachable path)
//   name contains "busy"        -> 429 with Retry-After (the busy path on search)
//   name contains "empty"       -> 200 with no items (the empty-results state)
//   name contains "failpage"    -> 500 only on the second and later pages
//                                 (the failed-pagination state; page one
//                                 succeeds so a list exists to keep)
//   #NOTFOUND                   -> 404 (not_found + negative caching)
//   #BADREQ                     -> 400 (bad_request with a reason)
//   #HANG (war route only)      -> never answers (timeout path)
//   any warlog except #PUBLICLO -> 403 accessDenied (the private-log state)
//   #DENIED (warlog)            -> 403 with an unknown reason (defensive path)
//   #BUSY                       -> 429 with Retry-After (the busy path)

import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8787);

const clan = {
  tag: '#MOCKCLAN',
  name: 'Mock Clan',
  type: 'inviteOnly',
  description: 'A fixture clan for local development.',
  clanLevel: 12,
  clanPoints: 41230,
  members: 2,
  warFrequency: 'always',
  // Surfaced on the clan detail card as the war log status chip; the mock
  // keeps it public so the card and the warlog route agree locally.
  isWarLogPublic: true,
  memberList: [
    {
      tag: '#MOCKPLAY',
      name: 'Mock Player',
      role: 'leader',
      expLevel: 189,
      leagueTier: { name: 'Electro League 31', iconUrls: { small: 'mock-tier.png', large: 'mock-tier.png' } },
      trophies: 4871,
      versusTrophies: 3120,
      clanRank: 1,
      donations: 340,
      donationsReceived: 260,
      townHallLevel: 14,
    },
    {
      tag: '#MOCKTWO',
      name: 'Mock Second',
      role: 'member',
      expLevel: 142,
      leagueTier: { name: 'Witch League 18', iconUrls: { small: 'mock-tier.png', large: 'mock-tier.png' } },
      trophies: 3911,
      versusTrophies: 2901,
      clanRank: 2,
      donations: 51,
      donationsReceived: 343,
      townHallLevel: 13,
    },
  ],
};

const player = {
  tag: '#MOCKPLAY',
  name: 'Mock Player',
  townHallLevel: 14,
  expLevel: 189,
  league: { name: 'Titan League I' },
  clan: { tag: '#MOCKCLAN', name: 'Mock Clan', clanLevel: 12 },
  troops: [
    { name: 'Barbarian', level: 12, maxLevel: 12, village: 'home' },
    { name: 'Archer', level: 9, maxLevel: 12, village: 'home' },
  ],
  heroes: [
    { name: 'Barbarian King', level: 60, maxLevel: 80, village: 'home' },
    { name: 'Queen', level: 21, maxLevel: 80, village: 'home' },
  ],
  achievements: [{ name: 'Keep Your Account Safe', stars: 3, value: 1, target: 1 }],
};

const war = {
  state: 'inWar',
  teamSize: 15,
  attacksPerMember: 2,
  clan: {
    tag: '#MOCKCLAN',
    name: 'Mock Clan',
    attacks: 12,
    stars: 24,
    destructionPercentage: 78.4,
    // The war roster: the same members the clan payload carries, with the
    // attack arrays the needs-attention tab's "attacks left" column reads
    // (attacksPerMember minus attacks used). Mock Player spent both,
    // Mock Second spent one, and a third war member sits idle at zero so
    // the "0 left" and "2 left" rows both render.
    members: [
      {
        tag: '#MOCKPLAY',
        name: 'Mock Player',
        position: 1,
        attacks: [
          { stars: 3, destructionPercentage: 84.2, order: 1 },
          { stars: 2, destructionPercentage: 61.1, order: 6 },
        ],
      },
      {
        tag: '#MOCKTWO',
        name: 'Mock Second',
        position: 2,
        attacks: [{ stars: 1, destructionPercentage: 44.9, order: 4 }],
      },
      { tag: '#MOCKIDLE', name: 'Mock Idle', position: 3, attacks: [] },
    ],
  },
  opponent: { tag: '#MOCKFOE', name: 'Mock Foe', attacks: 11, stars: 22, destructionPercentage: 75.1 },
};

const warlog = {
  items: [
    { result: 'win', endTime: '2026-10-18T00:00:00Z', teamSize: 15, stars: 28, opponent: { tag: '#MOCKFOE', name: 'Mock Foe' } },
    { result: 'lose', endTime: '2026-10-11T00:00:00Z', teamSize: 15, stars: 21, opponent: { tag: '#MOCKRIV', name: 'Mock Rival' } },
  ],
};

// The clans the search endpoint pages through: one per page, distinct tags,
// then a real end (the last page carries no cursor). A listing that
// repeated one clan on every page would hand the client duplicate keys,
// which the real API never does.
const MOCK_SEARCH_CLANS = [
  { ...clan, memberList: undefined },
  { ...clan, tag: '#MOCKTWO', name: 'Mock Second Clan', memberList: undefined },
  { ...clan, tag: '#MOCKTHREE', name: 'Mock Third Clan', memberList: undefined },
];

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === '/v1/clans') {
    const name = (url.searchParams.get('name') ?? '').toLowerCase();
    const after = url.searchParams.get('after');
    // The cursor pages of "failpage" fail: exercises the client's failed-
    // pagination state (T-M1-6). The first page must succeed so a list
    // exists to keep on screen while the retry affordance shows; it falls
    // through to the paged listing below.
    if (name.includes('failpage')) {
      if (after !== null) {
        sendJson(res, 500, { reason: 'internalServerError', message: 'mock page failure' });
        return;
      }
    } else if (name.includes('fail')) {
      sendJson(res, 500, { reason: 'internalServerError', message: 'mock failure' });
      return;
    }
    if (name.includes('busy')) {
      // A short Retry-After so the busy path is exercisable end to end
      // (the tier's own backoff retries, then the client's auto-retry).
      sendJson(res, 429, { reason: 'tooManyRequests' }, { 'retry-after': '2' });
      return;
    }
    if (name.includes('empty')) {
      // The empty-results state: a healthy 200 with nothing in it.
      sendJson(res, 200, { items: [], paging: { cursors: {} } });
      return;
    }
    // One clan per page, cursor-walked, then a page with no cursor so the
    // listing ends the way a real one does.
    const pageIndex = after === null ? 0 : Math.max(0, Number.parseInt(after, 10) || 0);
    const pageItems = MOCK_SEARCH_CLANS.slice(pageIndex, pageIndex + 1);
    const nextCursor = pageIndex + 1 < MOCK_SEARCH_CLANS.length ? String(pageIndex + 1) : null;
    sendJson(res, 200, {
      items: pageItems,
      paging: nextCursor === null ? { cursors: {} } : { cursors: { after: nextCursor } },
    });
    return;
  }

  const clanMatch = path.match(/^\/v1\/clans\/([^/]+)$/);
  if (clanMatch) {
    const tag = decodeURIComponent(clanMatch[1]);
    if (tag === '#NOTFOUND') {
      sendJson(res, 404, { reason: 'notFound', message: 'mock clan does not exist' });
      return;
    }
    if (tag === '#BADREQ') {
      sendJson(res, 400, { reason: 'badName', message: 'mock bad request' });
      return;
    }
    if (tag === '#BUSY') {
      sendJson(res, 429, { reason: 'tooManyRequests' }, { 'retry-after': '2' });
      return;
    }
    sendJson(res, 200, clan);
    return;
  }

  const playerMatch = path.match(/^\/v1\/players\/([^/]+)$/);
  if (playerMatch) {
    sendJson(res, 200, player);
    return;
  }

  const warMatch = path.match(/^\/v1\/clans\/([^/]+)\/currentwar$/);
  if (warMatch) {
    const tag = decodeURIComponent(warMatch[1]);
    if (tag === '#HANG') {
      // Never answer: exercises the tier's timeout path.
      return;
    }
    sendJson(res, 200, war);
    return;
  }

  const warlogMatch = path.match(/^\/v1\/clans\/([^/]+)\/warlog$/);
  if (warlogMatch) {
    const tag = decodeURIComponent(warlogMatch[1]);
    if (tag === '#DENIED') {
      sendJson(res, 403, { reason: 'keyIpBlocked' });
      return;
    }
    if (tag !== '#PUBLICLO') {
      // The live API answers a private war log with reason accessDenied.
      sendJson(res, 403, { reason: 'accessDenied' });
      return;
    }
    sendJson(res, 200, warlog);
    return;
  }

  sendJson(res, 404, { reason: 'notFound', message: `mock has no route for ${path}` });
});

server.listen(PORT, () => {
  console.log(`mock upstream on http://localhost:${PORT}/v1`);
});
