import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { unitIcon } from './icon-map';

// The icon map's contract has three edges: the names the payloads actually
// carry must resolve (recorded evidence below and the fixtures on disk), an
// unknown name must answer null so the caller can fall back to the
// placeholder, and every mapped value must be a real bundled URL. The
// fixtures check is the "fails loudly" rule the icons README states: if a
// fixture gains a hero or equipment name the map has never met, this suite
// is where it surfaces, not a silent placeholder on a screen.

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../../fixtures');

interface FixtureUnit {
  name: string;
  village: string;
  equipment?: FixtureUnit[];
}

function loadFixtureNames(fileName: string): { heroes: string[]; equipment: string[] } {
  const payload = JSON.parse(readFileSync(resolve(fixturesDir, fileName), 'utf8')) as {
    heroes?: FixtureUnit[];
    heroEquipment?: FixtureUnit[];
  };
  const heroes: string[] = [];
  const equipment: string[] = [];
  for (const hero of payload.heroes ?? []) {
    heroes.push(hero.name);
    for (const item of hero.equipment ?? []) equipment.push(item.name);
  }
  for (const item of payload.heroEquipment ?? []) equipment.push(item.name);
  return { heroes, equipment };
}

describe('unitIcon', () => {
  it('resolves every name recorded off a real payload', () => {
    // The evidence set: names captured verbatim in docs/api-local-tests.md,
    // the anonymized fixtures, and the mock upstream. If the game API
    // renames any of these, this row fails before a screen goes quiet.
    const recorded: Array<{ kind: 'hero' | 'equipment'; name: string }> = [
      { kind: 'hero', name: 'Barbarian King' },
      { kind: 'hero', name: 'Archer Queen' },
      { kind: 'hero', name: 'Grand Warden' },
      { kind: 'hero', name: 'Royal Champion' },
      { kind: 'hero', name: 'Minion Prince' },
      { kind: 'hero', name: 'Battle Machine' },
      { kind: 'equipment', name: 'Spiky Ball' },
      { kind: 'equipment', name: 'Earthquake Boots' },
      { kind: 'equipment', name: 'Giant Gauntlet' },
      { kind: 'equipment', name: 'Rocket Spear' },
      { kind: 'equipment', name: 'Snake Bracelet' },
    ];
    for (const { kind, name } of recorded) {
      expect(unitIcon(kind, name), `${kind} ${name}`).toBeTruthy();
    }
  });

  it('resolves every hero and equipment name in the fixtures', () => {
    for (const fileName of [
      'maxed-player.json',
      'null-maxlevel-player.json',
      'rushed-player.json',
      'super-troop-player.json',
    ]) {
      const { heroes, equipment } = loadFixtureNames(fileName);
      for (const name of heroes) {
        expect(unitIcon('hero', name), `${fileName}: hero ${name}`).toBeTruthy();
      }
      for (const name of equipment) {
        expect(unitIcon('equipment', name), `${fileName}: equipment ${name}`).toBeTruthy();
      }
    }
  });

  it('answers null for an unmapped name, the placeholder fallback signal', () => {
    expect(unitIcon('hero', 'Not A Hero')).toBeNull();
    expect(unitIcon('equipment', 'Unreleased Trinket')).toBeNull();
    // The empty name the tolerant parser never produces, kept honest here.
    expect(unitIcon('hero', '')).toBeNull();
  });

  it('does not cross kinds: a hero name is not equipment and vice versa', () => {
    // The map's kinds are separate tables on purpose: equipment names never
    // resolve as heroes, so a caller that mixed up its kind renders the
    // placeholder instead of a wrong-family icon.
    expect(unitIcon('equipment', 'Barbarian King')).toBeNull();
    expect(unitIcon('hero', 'Spiky Ball')).toBeNull();
  });
});
