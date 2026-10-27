import type { WarFrequency } from '../api/search';

// The human label for every war frequency value the game API returns, in
// one place because two surfaces must agree: the filter dropdown offers
// these exact labels and the result card's War stat renders them. A value
// the game adds later falls through to itself rather than a wrong label,
// and a missing field reads Unknown.

export const WAR_FREQUENCY_LABELS: Readonly<Record<WarFrequency, string>> = {
  always: 'Always',
  moreThanOncePerWeek: '2+ per week',
  oncePerWeek: 'Weekly',
  lessThanOncePerWeek: 'Under weekly',
  never: 'Never',
};

export function warFrequencyLabel(raw: string | undefined): string {
  if (raw === undefined) return 'Unknown';
  return WAR_FREQUENCY_LABELS[raw as WarFrequency] ?? raw;
}
