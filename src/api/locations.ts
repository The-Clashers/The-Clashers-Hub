// Location options for the search filter row.
//
// The game API has a /locations endpoint with 268 entries, but our tier only
// proxies the five read routes, so the screen ships a bundled, curated list
// instead of adding a sixth route for a filter dropdown. The ids below were
// verified live through the proxy on 2026-10-24 (GET /locations) and cover
// the locations the team actually searches around: International plus the
// countries we demo with. Growing the list is a one-line append with the id
// from that endpoint.

export interface LocationOption {
  readonly id: number;
  readonly name: string;
}

export const LOCATION_FILTERS: readonly LocationOption[] = [
  { id: 32000006, name: 'International' },
  { id: 32000185, name: 'Philippines' },
  { id: 32000249, name: 'United States' },
  { id: 32000114, name: 'Indonesia' },
  { id: 32000113, name: 'India' },
  { id: 32000038, name: 'Brazil' },
  { id: 32000094, name: 'Germany' },
  { id: 32000193, name: 'Russia' },
  { id: 32000122, name: 'Japan' },
  { id: 32000144, name: 'Malaysia' },
  { id: 32000209, name: 'Singapore' },
  { id: 32000231, name: 'Thailand' },
  { id: 32000255, name: 'Vietnam' },
  { id: 32000047, name: 'Canada' },
  { id: 32000248, name: 'United Kingdom' },
  { id: 32000153, name: 'Mexico' },
];
