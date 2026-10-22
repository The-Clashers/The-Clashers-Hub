// A tiny stand-in game API for local development and tier verification,
// serving anonymized fixture-shaped payloads on http://localhost:8787.
// Run it next to the tier: COC_API_BASE_URL=http://localhost:8787/v1
// COC_API_TOKEN=mock npm run dev:api
//
// Special tags and names exercise the whole error contract:
//   name contains "fail"        -> 500 (upstream_unreachable path)
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
  memberList: [
    {
      tag: '#MOCKPLAY',
      name: 'Mock Player',
      role: 'leader',
      expLevel: 189,
      league: { name: 'Titan League I' },
      trophies: 4871,
      versusTrophies: 3120,
      clanRank: 1,
      donations: 340,
      received: 260,
      townHallLevel: 14,
    },
    {
      tag: '#MOCKTWO',
      name: 'Mock Second',
      role: 'member',
      expLevel: 142,
      league: { name: 'Champion League I' },
      trophies: 3911,
      versusTrophies: 2901,
      clanRank: 2,
      donations: 51,
      received: 343,
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
  clan: { tag: '#MOCKCLAN', name: 'Mock Clan', attacks: 12, stars: 24, destructionPercentage: 78.4 },
  opponent: { tag: '#MOCKFOE', name: 'Mock Foe', attacks: 11, stars: 22, destructionPercentage: 75.1 },
};

const warlog = {
  items: [
    { result: 'win', endTime: '2026-10-18T00:00:00Z', teamSize: 15, stars: 28, opponent: { tag: '#MOCKFOE', name: 'Mock Foe' } },
    { result: 'lose', endTime: '2026-10-11T00:00:00Z', teamSize: 15, stars: 21, opponent: { tag: '#MOCKRIV', name: 'Mock Rival' } },
  ],
};

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === '/v1/clans') {
    const name = url.searchParams.get('name') ?? '';
    if (name.toLowerCase().includes('fail')) {
      sendJson(res, 500, { reason: 'internalServerError', message: 'mock failure' });
      return;
    }
    sendJson(res, 200, {
      items: [{ ...clan, memberList: undefined }],
      paging: { cursors: { after: 'MOCKCURSOR' } },
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
