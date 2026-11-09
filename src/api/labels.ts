// Clan label options for the search filter row.
//
// The game API has a GET /labels/clans endpoint with the full label catalog,
// but our tier only proxies the five read routes, so the screen ships a
// bundled, curated list instead of adding a sixth route for a filter
// dropdown — the same call the location filter made. The five ids below were
// verified against live captures (docs/api-local-tests.md sections 3.1 and
// 4.1: label ids ride both search items and clan details). Growing the list
// is a one-line append with the id from that endpoint.

export interface ClanLabelOption {
  readonly id: number;
  readonly name: string;
}

export const CLAN_LABEL_FILTERS: readonly ClanLabelOption[] = [
  { id: 56000000, name: 'Clan Wars' },
  { id: 56000001, name: 'Clan War League' },
  { id: 56000007, name: 'International' },
  { id: 56000013, name: 'Relaxed' },
  { id: 56000014, name: 'Competitive' },
];
