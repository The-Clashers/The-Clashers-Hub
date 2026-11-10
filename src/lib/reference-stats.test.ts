import { describe, expect, it } from 'vitest';
import { getGlobalReferenceSummary, getTownHallCapSummary } from './reference-stats';

describe('reference-stats', () => {
  describe('getGlobalReferenceSummary', () => {
    it('returns consistent aggregate counts across all categories', () => {
      const summary = getGlobalReferenceSummary();

      expect(summary.maxTownHall).toBe(18);
      expect(summary.maxBuilderHall).toBe(10);
      expect(summary.homeTroopsCount).toBe(32);
      expect(summary.builderTroopsCount).toBe(12);
      expect(summary.spellsCount).toBe(18);
      expect(summary.siegesCount).toBe(9);
      expect(summary.petsCount).toBe(12);
      expect(summary.homeHeroesCount).toBe(6);
      expect(summary.builderHeroesCount).toBe(2);
      expect(summary.equipmentCount).toBe(43);
      expect(summary.superTroopsCount).toBe(17);
      expect(summary.rankedLeagueTiersCount).toBe(36);

      expect(summary.totalUnitsAndGearCount).toBe(
        32 + 12 + 18 + 9 + 12 + 6 + 2 + 43,
      );
    });
  });

  describe('getTownHallCapSummary', () => {
    it('computes correct metrics for Town Hall 7 (Barbarian King unlocks)', () => {
      const summary = getTownHallCapSummary(7);
      expect(summary.townHall).toBe(7);

      const bk = summary.heroes.find((h) => h.name === 'Barbarian King');
      expect(bk?.unlocked).toBe(true);
      expect(bk?.cap).toBe(10);

      const aq = summary.heroes.find((h) => h.name === 'Archer Queen');
      expect(aq?.unlocked).toBe(false);
      expect(aq?.cap).toBe(0);

      expect(summary.totalHeroLevels).toBe(10);
      expect(summary.maxHeroLevelsPossible).toBe(480);
      expect(summary.unlockedSiegesCount).toBe(0);
      expect(summary.unlockedPetsCount).toBe(0);
    });

    it('computes correct metrics for Town Hall 9 (AQ & Minion Prince unlock)', () => {
      const summary = getTownHallCapSummary(9);
      expect(summary.townHall).toBe(9);

      const bk = summary.heroes.find((h) => h.name === 'Barbarian King');
      const aq = summary.heroes.find((h) => h.name === 'Archer Queen');
      const mp = summary.heroes.find((h) => h.name === 'Minion Prince');
      const gw = summary.heroes.find((h) => h.name === 'Grand Warden');

      expect(bk?.cap).toBe(30);
      expect(aq?.cap).toBe(30);
      expect(mp?.cap).toBe(10);
      expect(gw?.unlocked).toBe(false);

      expect(summary.totalHeroLevels).toBe(70);
    });

    it('computes maxed values at Town Hall 18', () => {
      const summary = getTownHallCapSummary(18);
      expect(summary.townHall).toBe(18);

      expect(summary.heroes.every((h) => h.unlocked)).toBe(true);
      expect(summary.totalHeroLevels).toBe(480);
      expect(summary.maxHeroLevelsPossible).toBe(480);

      expect(summary.unlockedTroopsCount).toBe(32);
      expect(summary.unlockedSpellsCount).toBe(18);
      expect(summary.unlockedSiegesCount).toBe(9);
      expect(summary.unlockedPetsCount).toBe(12);
      expect(summary.unlockedEquipmentCount).toBe(43);

      expect(summary.totalLabLevels).toBe(
        summary.totalTroopLevels + summary.totalSpellLevels + summary.totalSiegeLevels,
      );
    });

    it('clamps out of range town hall levels', () => {
      const low = getTownHallCapSummary(0);
      expect(low.townHall).toBe(1);

      const high = getTownHallCapSummary(99);
      expect(high.townHall).toBe(18);
    });
  });
});
