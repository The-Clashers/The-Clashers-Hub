// The Town Hall cap tables (T-M2-6, FR-16, SR-17): the maximum level of
// every unit at every Town Hall, per category, plus the builder-base
// counterparts at every Builder Hall. One module, one version stamp, one
// lookup surface, so the rushed engine's null-maxLevel fallback (SR-17)
// and the progression grid's maxed-for-Town-Hall chips (SR-16) can never
// read two different tables.
//
// Derivation. Each row is the game's own upgrade ladder collapsed onto the
// hall scale: a research or upgrade level is available at a hall when the
// building that performs it is available at that hall. The gate chains,
// because the raw per-level data mixes them:
// - troops, spells, siege machines: the level's own townHallRequired,
//   tightened by the laboratory level its research needs, mapped to the TH
//   that lab level first exists at. The second term binds for a dozen
//   final researches the raw data marks TH17 while needing lab 16, which
//   first exists at TH18: those levels are TH18 in here, not TH17.
// - pets: the pet house level mapped to its TH, same shape.
// - heroes: the hero hall level mapped to its TH (HH1 at TH7 through
//   HH12 at TH18).
// - hero equipment: the blacksmith level mapped to its TH (BS1 at TH8
//   through BS10 at TH17; TH18 adds nothing, the blacksmith tops out, so
//   every equipment column freezes from TH17 on).
// - builder troops: the first level is the barracks chain (the barracks
//   level that unlocks the unit, mapped to the BH that barracks level
//   first exists at); every research level is the star lab level, which
//   first exists at the same-numbered Builder Hall.
// - builder heroes: the Builder Hall directly.
//
// Evidence. The numbers were derived from the per-level upgrade tables the
// clash-of-clans-data project maintains (github.com/chiefpansancolt/
// clash-of-clans-data, MIT), then cross-checked against the live payload
// the proxy served during this session: every home unit's reported global
// maxLevel equals this table's TH18 cap, every builder unit's equals the
// BH10 cap, and no live level sits above its cap. The test file locks a
// sample of those rows so a regression fails loudly.
//
// Reference data version: the game as of November 2026, Town Hall 18 and
// Builder Hall 10, 18 home spells, 43 hero equipment pieces.
// Updating: a docs-sized PR whenever the game ships new content. The
// completeness tests (this module's test file, the rushed engine's, the
// icon map's) fail loudly when a payload carries a unit the tables have
// not met, so drift surfaces in CI, never as a wrong number on a screen.
// Super troops are deliberately absent: they are temporary variants on
// their base troop's ladder, not progression, and the rushed engine drops
// them through SUPER_TROOP_MAP before it ever reads a cap.

/** Home village troops (the 32 base troops; super troops are variants on these ladders, not rows of their own). Index 0 is TH1, index 17 is TH18; the value is the maximum level at that hall, 0 when the unit is not unlocked yet. */
export const HOME_TROOP_CAPS: Readonly<Record<string, ReadonlyArray<number>>> = {
  'Apprentice Warden': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 4, 4, 4],
  Archer: [1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 9, 10, 11, 12, 13, 14],
  'Baby Dragon': [0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  Balloon: [0, 0, 0, 2, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 10, 11, 12, 13],
  Barbarian: [1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13],
  Bowler: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'Dragon Rider': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 4, 5, 6],
  Dragon: [0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  Druid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 6],
  'Electro Dragon': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9],
  'Electro Titan': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 4, 5],
  Furnace: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 4],
  Giant: [1, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 12, 13, 14],
  Goblin: [0, 1, 2, 2, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8, 9, 9, 9, 10],
  Golem: [0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15],
  Headhunter: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 3, 3, 3, 4],
  Healer: [0, 0, 0, 0, 0, 1, 2, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10, 11],
  'Hog Rider': [0, 0, 0, 0, 0, 0, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15],
  'Ice Golem': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 5, 6, 7, 8, 9, 9],
  'Lava Hound': [0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 6, 6, 7, 7, 8],
  'Meteor Golem': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3],
  Miner: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 6, 7, 8, 9, 10, 11, 12],
  Minion: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  'P.E.K.K.A': [0, 0, 0, 0, 0, 0, 0, 3, 4, 6, 7, 8, 9, 9, 10, 11, 12, 13],
  'Root Rider': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 4],
  'Ruin Witch': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4],
  Thrower: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4],
  Valkyrie: [0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12],
  'Wall Breaker': [0, 0, 1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  Witch: [0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 5, 5, 6, 7, 7, 8],
  Wizard: [0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 12, 13, 14],
  Yeti: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 8],
};

/** Home village spells. Index 0 is TH1, index 17 is TH18. */
export const HOME_SPELL_CAPS: Readonly<Record<string, ReadonlyArray<number>>> = {
  'Angry Spell': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4],
  'Bat Spell': [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 5, 5, 5, 6, 6, 7, 8],
  'Clone Spell': [0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 5, 6, 7, 8, 8, 8, 9],
  'Earthquake Spell': [0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 5, 5, 6, 6, 7, 7, 8],
  'Freeze Spell': [0, 0, 0, 0, 0, 0, 0, 1, 2, 5, 6, 7, 7, 7, 7, 7, 7, 8],
  'Haste Spell': [0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 5, 5, 5, 5, 5, 6, 7],
  'Healing Spell': [0, 0, 0, 0, 0, 3, 4, 5, 6, 7, 7, 7, 8, 8, 9, 10, 11, 12],
  'Ice Block Spell': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 5, 6],
  'Invisibility Spell': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 4, 4, 4, 4, 4],
  'Jump Spell': [0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 5],
  'Lightning Spell': [0, 0, 0, 0, 4, 4, 4, 5, 6, 7, 8, 9, 9, 9, 10, 11, 12, 13],
  'Overgrowth Spell': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 3, 4, 4, 5],
  'Poison Spell': [0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  'Rage Spell': [0, 0, 0, 0, 0, 0, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 7],
  'Recall Spell': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 5, 6, 7],
  'Revive Spell': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 3, 4, 5],
  'Skeleton Spell': [0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 6, 7, 7, 8, 8, 8, 8],
  'Totem Spell': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 3, 4],
};

/** Home village siege machines, researched in the laboratory like troops but assembled in the workshop. Index 0 is TH1, index 17 is TH18. */
export const HOME_SIEGE_CAPS: Readonly<Record<string, ReadonlyArray<number>>> = {
  'Battle Blimp': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 5, 5, 5, 6],
  'Battle Drill': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 5, 6],
  'Flame Flinger': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 5, 5, 5],
  'Log Launcher': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 5, 5, 6],
  'Siege Barracks': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 5, 5, 6],
  'Sky Wagon': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4],
  'Stone Slammer': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 5, 5, 5, 6],
  'Troop Launcher': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4],
  'Wall Wrecker': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 5, 5, 5, 6],
};

/** Home village pets, upgraded through the pet house. Index 0 is TH1, index 17 is TH18. */
export const HOME_PET_CAPS: Readonly<Record<string, ReadonlyArray<number>>> = {
  'Angry Jelly': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10],
  Diggy: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10, 15],
  'Electro Owl': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 15, 15, 15],
  Frosty: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 15, 15],
  'Greedy Raven': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10],
  'L.A.S.S.I': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 15, 15, 15, 15],
  'Mighty Yak': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 15, 15, 15, 15],
  Phoenix: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10, 10],
  'Poison Lizard': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 15, 15],
  Sneezy: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10],
  'Spirit Fox': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10],
  Unicorn: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10, 15, 15],
};

/** Home village heroes, leveled through the hero hall. Index 0 is TH1, index 17 is TH18; heroes begin at TH7, where the hero hall first exists. */
export const HOME_HERO_CAPS: Readonly<Record<string, ReadonlyArray<number>>> = {
  'Archer Queen': [0, 0, 0, 0, 0, 0, 0, 10, 30, 40, 50, 65, 75, 85, 90, 95, 100, 110],
  'Barbarian King': [0, 0, 0, 0, 0, 0, 10, 20, 30, 40, 50, 65, 75, 85, 90, 95, 100, 110],
  'Dragon Duke': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 15, 20, 25],
  'Grand Warden': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 40, 50, 60, 65, 70, 75, 85],
  'Minion Prince': [0, 0, 0, 0, 0, 0, 0, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95],
  'Royal Champion': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25, 30, 40, 45, 50, 55],
};

/** Hero equipment, upgraded through the blacksmith. Index 0 is TH1, index 17 is TH18; equipment begins at TH8, where the blacksmith first exists, and the columns freeze from TH17 on: the blacksmith tops out at level 10. */
export const HOME_EQUIPMENT_CAPS: Readonly<Record<string, ReadonlyArray<number>>> = {
  'Action Figure': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Archer Puppet': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Barbarian Puppet': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Dark Crown': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Dark Orb': [0, 0, 0, 0, 0, 0, 0, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Earthquake Boots': [0, 0, 0, 0, 0, 0, 0, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Electro Boots': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Electro Fangs': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 18],
  'Eternal Tome': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Fire Heart': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  Fireball: [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Flame Blower': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Frost Flake': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Frozen Arrow': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Giant Arrow': [0, 0, 0, 0, 0, 0, 0, 0, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Giant Gauntlet': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Haste Vial': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 18, 18, 18],
  'Healer Puppet': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 15, 18, 18, 18, 18, 18],
  'Healing Tome': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 18, 18, 18, 18, 18],
  'Henchmen Puppet': [0, 0, 0, 0, 0, 0, 0, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Heroic Torch': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Hog Rider Puppet': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 18, 18, 18, 18],
  'Invisibility Vial': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Lavaloon Puppet': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Life Gem': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Magic Mirror': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Metal Pants': [0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Meteor Staff': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Monolith Arrow': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Noble Iron': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 15, 18, 18, 18, 18, 18],
  'Portal Pendant': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Rage Gem': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 15, 15, 18, 18, 18, 18, 18],
  'Rage Vial': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Revenge Deck': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Rocket Backpack': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Rocket Spear': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Royal Gem': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Seeking Shield': [1, 1, 1, 1, 1, 1, 1, 9, 9, 12, 12, 15, 15, 18, 18, 18, 18, 18],
  'Snake Bracelet': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Spiky Ball': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Stick Horse': [0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 21, 24, 27, 27, 27],
  'Stun Blaster': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 18, 18],
  Vampstache: [0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12, 15, 15, 18, 18, 18, 18, 18],
};

/** Builder base troops, researched in the star laboratory. Index 0 is BH1, index 9 is BH10. */
export const BUILDER_TROOP_CAPS: Readonly<Record<string, ReadonlyArray<number>>> = {
  'Baby Dragon': [0, 0, 0, 8, 10, 12, 14, 16, 18, 20],
  'Beta Minion': [0, 0, 6, 8, 10, 12, 14, 16, 18, 20],
  Bomber: [0, 0, 0, 8, 10, 12, 14, 16, 18, 20],
  'Boxer Giant': [0, 0, 6, 8, 10, 12, 14, 16, 18, 20],
  'Cannon Cart': [0, 0, 0, 0, 10, 12, 14, 16, 18, 20],
  'Drop Ship': [0, 0, 0, 0, 0, 0, 14, 16, 18, 20],
  'Electrofire Wizard': [0, 0, 0, 0, 0, 0, 0, 0, 0, 20],
  'Hog Glider': [0, 0, 0, 0, 0, 0, 0, 0, 18, 20],
  'Night Witch': [0, 0, 0, 0, 0, 12, 14, 16, 18, 20],
  'Power P.E.K.K.A': [0, 0, 0, 0, 0, 0, 0, 16, 18, 20],
  'Raged Barbarian': [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
  'Sneaky Archer': [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
};

/** Builder base heroes, leveled directly against the Builder Hall. Index 0 is BH1, index 9 is BH10. */
export const BUILDER_HERO_CAPS: Readonly<Record<string, ReadonlyArray<number>>> = {
  'Battle Copter': [0, 0, 0, 0, 0, 0, 0, 25, 30, 35],
  'Battle Machine': [0, 0, 0, 0, 5, 10, 20, 25, 30, 35],
};


/** The highest Town Hall the home tables cover. */
export const HOME_CAP_MAX_TOWN_HALL = 18;

/** The highest Builder Hall the builder tables cover. */
export const BUILDER_CAP_MAX_HALL = 10;

/**
 * The maximum level of a home unit at the given Town Hall, or null when
 * the name is not in the tables. A 0 means the unit is not unlocked at
 * that hall yet. Town halls beyond the table are clamped to the last
 * column, so a TH19 payload reads the TH18 caps until the bundle is
 * updated: the honest reading, nothing new is known about TH19.
 */
export function homeCapAtTownHall(name: string, townHall: number): number | null {
  const th = Math.min(Math.max(1, Math.floor(townHall)), HOME_CAP_MAX_TOWN_HALL);
  const row = lookupHome(name);
  return row ? row[th - 1] : null;
}

/**
 * The maximum level of a builder-base unit at the given Builder Hall, or
 * null when the name is not in the tables. Same clamping rule as the home
 * lookup.
 */
export function builderCapAtHall(name: string, builderHall: number): number | null {
  const bh = Math.min(Math.max(1, Math.floor(builderHall)), BUILDER_CAP_MAX_HALL);
  const row = lookupBuilder(name);
  return row ? row[bh - 1] : null;
}

/**
 * A home unit's global maximum: its cap at the highest covered Town Hall.
 * The rushed engine's null-maxLevel fallback reads this (SR-17): a unit
 * whose API maxLevel is null falls back to this number, and only a unit
 * absent from both the payload and these tables stays skipped.
 */
export function homeReferenceMax(name: string): number | null {
  const row = lookupHome(name);
  return row ? row[row.length - 1] : null;
}

/**
 * A builder-base unit's global maximum: its cap at the highest covered
 * Builder Hall.
 */
export function builderReferenceMax(name: string): number | null {
  const row = lookupBuilder(name);
  return row ? row[row.length - 1] : null;
}

function lookupHome(name: string): ReadonlyArray<number> | undefined {
  return (
    HOME_TROOP_CAPS[name] ??
    HOME_SPELL_CAPS[name] ??
    HOME_SIEGE_CAPS[name] ??
    HOME_PET_CAPS[name] ??
    HOME_HERO_CAPS[name] ??
    HOME_EQUIPMENT_CAPS[name]
  );
}

function lookupBuilder(name: string): ReadonlyArray<number> | undefined {
  return BUILDER_TROOP_CAPS[name] ?? BUILDER_HERO_CAPS[name];
}
