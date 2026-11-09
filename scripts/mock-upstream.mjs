// A tiny stand-in game API for local development and tier verification,
// serving anonymized fixture-shaped payloads on http://localhost:8787.
// Run it next to the tier: COC_API_BASE_URL=http://localhost:8787/v1
// COC_API_TOKEN=mock npm run dev:api
//
// The /v1/clans listing honors the upstream filter params the tier
// forwards (minMembers, maxMembers, minClanLevel, minClanPoints,
// frequency, locationId, labelId) and its items carry the fields the
// client-side filters read (type, isFamilyFriendly, requiredLeagueTier,
// requiredTownhallLevel, chatLanguage), so the whole filter row is
// exercisable locally end to end. The requirement fields speak the rank
// rework: requiredLeagueTier carries the ranked ladder tier a clan asks
// for (ids 105000000+n, the numbering src/api/league-tiers.ts mirrors),
// and the legacy requiredTrophies number is gone the way the game dropped
// it.
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
  // The rank rework's join requirement, as the clan endpoint reports it:
  // the ranked ladder tier the clan asks for.
  requiredLeagueTier: { id: 105000017, name: 'Witch League 17' },
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
    // Home village troops: a mix of maxed, climbing, and a super troop so
    // the progression grid exercises every tile state.
    { name: 'Barbarian', level: 12, maxLevel: 12, village: 'home' },
    { name: 'Archer', level: 9, maxLevel: 12, village: 'home' },
    { name: 'Goblin', level: 8, maxLevel: 10, village: 'home' },
    { name: 'Giant', level: 11, maxLevel: 12, village: 'home' },
    { name: 'Wall Breaker', level: 10, maxLevel: 12, village: 'home' },
    { name: 'Balloon', level: 8, maxLevel: 12, village: 'home' },
    { name: 'Wizard', level: 9, maxLevel: 12, village: 'home' },
    { name: 'Healer', level: 6, maxLevel: 8, village: 'home' },
    { name: 'Dragon', level: 7, maxLevel: 10, village: 'home' },
    { name: 'P.E.K.K.A', level: 8, maxLevel: 10, village: 'home' },
    { name: 'Valkyrie', level: 6, maxLevel: 8, village: 'home' },
    { name: 'Golem', level: 8, maxLevel: 10, village: 'home' },
    { name: 'Super Barbarian', level: 1, maxLevel: 9, village: 'home' },
    { name: 'Sneaky Goblin', level: 1, maxLevel: 6, village: 'home' },
    // Siege machines and pets (route into petsSiege).
    { name: 'Wall Wrecker', level: 4, maxLevel: 6, village: 'home' },
    { name: 'Battle Blimp', level: 3, maxLevel: 6, village: 'home' },
    { name: 'L.A.S.S.I', level: 10, maxLevel: 15, village: 'home' },
    { name: 'Electro Owl', level: 15, maxLevel: 15, village: 'home' },
    // Builder base units (the second village group).
    { name: 'Raged Barbarian', level: 18, maxLevel: 20, village: 'builderBase' },
    { name: 'Sneaky Archer', level: 16, maxLevel: 20, village: 'builderBase' },
    { name: 'Boxer Giant', level: 14, maxLevel: 20, village: 'builderBase' },
    { name: 'Power P.E.K.K.A', level: 12, maxLevel: 20, village: 'builderBase' },
  ],
  spells: [
    { name: 'Lightning Spell', level: 9, maxLevel: 12, village: 'home' },
    { name: 'Healing Spell', level: 7, maxLevel: 8, village: 'home' },
    { name: 'Rage Spell', level: 5, maxLevel: 8, village: 'home' },
    { name: 'Freeze Spell', level: 6, maxLevel: 8, village: 'home' },
    { name: 'Poison Spell', level: 5, maxLevel: 6, village: 'home' },
    { name: 'Earthquake Spell', level: 4, maxLevel: 5, village: 'home' },
  ],
  // The heroes the hero panel (T-M2-4) reads: one maxed with two maxed
  // equipment pieces nested on it (the ledger treatment), one climbing
  // with an in-progress piece (the eye-catcher), one brand-new hero with
  // the null-maxLevel shape (the footnote), and a builder-base hero (the
  // second village group). The flat heroEquipment array below is the
  // every-piece-owned inventory the progression grid (FR-16) will read;
  // the hero panel ignores it and reads only the nested per-hero entries.
  heroes: [
    {
      name: 'Barbarian King',
      level: 80,
      maxLevel: 80,
      village: 'home',
      equipment: [
        { name: 'Spiky Ball', level: 27, maxLevel: 27, village: 'home' },
        { name: 'Earthquake Boots', level: 18, maxLevel: 18, village: 'home' },
      ],
    },
    {
      name: 'Archer Queen',
      level: 21,
      maxLevel: 80,
      village: 'home',
      equipment: [
        { name: 'Giant Gauntlet', level: 20, maxLevel: 27, village: 'home' },
        // A trued equipment name: the API's own spelling the
        // reference-data pass verified, resolving through the typed map
        // on the panel row and the flat map on the grid tile alike.
        { name: 'Hog Rider Puppet', level: 15, maxLevel: 18, village: 'home' },
      ],
    },
    { name: 'Minion Prince', level: 9, maxLevel: null, village: 'home' },
    { name: 'Battle Machine', level: 30, maxLevel: 35, village: 'builderBase' },
  ],
  heroEquipment: [
    { name: 'Giant Gauntlet', level: 20, maxLevel: 27, village: 'home' },
    { name: 'Snake Bracelet', level: 12, maxLevel: 27, village: 'home' },
    { name: 'Hog Rider Puppet', level: 15, maxLevel: 18, village: 'home' },
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

// The clans the search endpoint pages through: eight fixture clans whose
// fields vary across every filter dimension (type, family-friendliness,
// join gates, chat language, labels, location, points, size, frequency),
// then a real end (the last page carries no cursor). Two clans per page, so
// pagination is exercisable without tedium. A listing that repeated one
// clan on every page would hand the client duplicate keys, which the real
// API never does.
const SEARCH_LABEL_INTERNATIONAL = { id: 56000007, name: 'International' };

const MOCK_SEARCH_CLANS = [
  {
    tag: '#MOCKCLAN',
    name: 'Mock Clan',
    type: 'open',
    description: 'A fixture clan for local development.',
    clanLevel: 12,
    clanPoints: 41230,
    members: 45,
    warFrequency: 'always',
    isWarLogPublic: true,
    isFamilyFriendly: true,
    // The same tier the clan detail fixture reports, so a click-through
    // from the search listing to the detail card tells one story.
    requiredLeagueTier: { id: 105000017, name: 'Witch League 17' },
    location: { id: 32000006, name: 'International', isCountry: false },
    chatLanguage: { id: 75000000, name: 'English', languageCode: 'EN' },
    labels: [
      { id: 56000000, name: 'Clan Wars' },
      SEARCH_LABEL_INTERNATIONAL,
    ],
  },
  {
    tag: '#MOCKTWO',
    name: 'Mock Second Clan',
    type: 'inviteOnly',
    clanLevel: 8,
    clanPoints: 22000,
    members: 30,
    warFrequency: 'oncePerWeek',
    isWarLogPublic: true,
    isFamilyFriendly: false,
    requiredLeagueTier: { id: 105000005, name: 'Barbarian League 5' },
    requiredTownhallLevel: 12,
    location: { id: 32000185, name: 'Philippines', isCountry: true },
    chatLanguage: { id: 75000000, name: 'English', languageCode: 'EN' },
    labels: [{ id: 56000013, name: 'Relaxed' }],
  },
  {
    tag: '#MOCKTHREE',
    name: 'Mock Third Clan',
    type: 'closed',
    clanLevel: 15,
    clanPoints: 38000,
    members: 49,
    warFrequency: 'always',
    isWarLogPublic: false,
    isFamilyFriendly: false,
    requiredLeagueTier: { id: 105000017, name: 'Witch League 17' },
    requiredTownhallLevel: 14,
    location: { id: 32000249, name: 'United States', isCountry: true },
    chatLanguage: { id: 75000017, name: 'Spanish', languageCode: 'ES' },
    labels: [{ id: 56000014, name: 'Competitive' }],
  },
  {
    tag: '#MOCKFOUR',
    name: 'Mock Fourth Clan',
    type: 'open',
    clanLevel: 3,
    clanPoints: 8000,
    members: 10,
    warFrequency: 'lessThanOncePerWeek',
    isWarLogPublic: true,
    isFamilyFriendly: true,
    location: { id: 32000038, name: 'Brazil', isCountry: true },
    chatLanguage: { id: 75000035, name: 'Portuguese', languageCode: 'PT' },
    labels: [SEARCH_LABEL_INTERNATIONAL],
  },
  {
    tag: '#MOCKFIVE',
    name: 'Mock Fifth Clan',
    type: 'inviteOnly',
    clanLevel: 18,
    clanPoints: 55000,
    members: 50,
    warFrequency: 'always',
    isWarLogPublic: true,
    isFamilyFriendly: false,
    requiredLeagueTier: { id: 105000028, name: 'Dragon League 28' },
    requiredTownhallLevel: 16,
    location: { id: 32000006, name: 'International', isCountry: false },
    chatLanguage: { id: 75000000, name: 'English', languageCode: 'EN' },
    labels: [{ id: 56000001, name: 'Clan War League' }],
  },
  {
    tag: '#MOCKSIX',
    name: 'Mock Sixth Clan',
    type: 'open',
    clanLevel: 5,
    clanPoints: 12000,
    members: 20,
    warFrequency: 'never',
    isWarLogPublic: true,
    isFamilyFriendly: false,
    location: { id: 32000185, name: 'Philippines', isCountry: true },
    chatLanguage: { id: 75000000, name: 'English', languageCode: 'EN' },
    labels: [{ id: 56000000, name: 'Clan Wars' }],
  },
  {
    tag: '#MOCKSEVEN',
    name: 'Mock Seventh Clan',
    type: 'closed',
    clanLevel: 6,
    clanPoints: 9000,
    members: 15,
    warFrequency: 'moreThanOncePerWeek',
    isWarLogPublic: true,
    isFamilyFriendly: false,
    requiredLeagueTier: { id: 105000022, name: 'P.E.K.K.A League 22' },
    requiredTownhallLevel: 10,
    location: { id: 32000114, name: 'Indonesia', isCountry: true },
    chatLanguage: { id: 75000017, name: 'Spanish', languageCode: 'ES' },
    labels: [
      { id: 56000013, name: 'Relaxed' },
      SEARCH_LABEL_INTERNATIONAL,
    ],
  },
  {
    tag: '#MOCKEIGHT',
    name: 'Mock Eighth Clan',
    type: 'open',
    clanLevel: 2,
    clanPoints: 3000,
    members: 5,
    warFrequency: 'oncePerWeek',
    isWarLogPublic: true,
    isFamilyFriendly: true,
    location: { id: 32000006, name: 'International', isCountry: false },
    chatLanguage: { id: 75000000, name: 'English', languageCode: 'EN' },
    labels: [SEARCH_LABEL_INTERNATIONAL],
  },
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

    // The upstream filter params the tier forwards, applied honestly so
    // the filter row is exercisable against the mock. The tier sends
    // "frequency" for war frequency (the param name it owns upstream), so
    // the mock reads that name too.
    const numberParam = (key) => {
      const raw = url.searchParams.get(key);
      if (raw === null) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    const minMembers = numberParam('minMembers');
    const maxMembers = numberParam('maxMembers');
    const minClanLevel = numberParam('minClanLevel');
    const minClanPoints = numberParam('minClanPoints');
    const labelId = numberParam('labelId');
    const locationId = numberParam('locationId');
    const frequency = url.searchParams.get('frequency');

    const filtered = MOCK_SEARCH_CLANS.filter((entry) => {
      if (minMembers !== null && entry.members < minMembers) return false;
      if (maxMembers !== null && entry.members > maxMembers) return false;
      if (minClanLevel !== null && entry.clanLevel < minClanLevel) return false;
      if (minClanPoints !== null && entry.clanPoints < minClanPoints) return false;
      if (labelId !== null && !entry.labels.some((label) => label.id === labelId)) return false;
      if (locationId !== null && entry.location.id !== locationId) return false;
      if (frequency !== null && entry.warFrequency !== frequency) return false;
      return true;
    });

    // Two clans per page, cursor-walked, then a page with no cursor so the
    // listing ends the way a real one does.
    const PAGE_SIZE = 2;
    const pageIndex = after === null ? 0 : Math.max(0, Number.parseInt(after, 10) || 0);
    const pageItems = filtered.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);
    const nextCursor = (pageIndex + 1) * PAGE_SIZE < filtered.length ? String(pageIndex + 1) : null;
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
