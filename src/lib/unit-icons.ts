// The unit icon map (T-M2-5, FR-16, SR-16).
//
// Maps every CoC API unit name (as it appears in the player payload's
// troops[], spells[], heroes[], and heroEquipment[] arrays) to a locally
// bundled PNG under src/assets/game-icons/. The map is data, not logic:
// a plain object a tile reads with one lookup, never a switch statement.
//
// The icons ship with the bundle (no runtime fetch, SR-16), so the
// progression grid's ~100 unit tiles render with zero network requests
// beyond the single player fetch (AC-07). A unit whose name is not in the
// map renders the placeholder: never a broken image, never a wrong icon
// standing in for a missing one (07 section 7 "Imagery", the game-icons
// README's fallback rule).
//
// The map is the runtime half of the reference-data bundle the concept doc
// names (05 section 1, SR-17). The Town Hall cap tables and hero equipment
// caps land with T-M2-6; the icon map lands here because the progression
// grid (T-M2-5) needs it first. When T-M2-6 ships, this module is the
// icon-map portion of that bundle, unchanged.

// The bundled placeholder SVG, imported as a URL so Vite emits it as an
// asset and the Image source resolves on the deploy. The placeholder is
// the mandatory fallback (07 section 7): a unit without a bundled icon
// renders the placeholder, never a broken image and never a wrong icon.
import placeholderIcon from '../assets/game-icons/placeholder.svg';

// ---------- home village troops ----------

// Each import is a URL Vite emits into the build; the Image source resolves
// to that URL on the deploy. Importing the icons (rather than stringifying
// paths) makes them first-class build assets: Vite hashes them, the bundle
// scan sees them, and a missing file fails the build instead of the render.
import troopBarbarian from '../assets/game-icons/Icon_HV_Barbarian.png';
import troopArcher from '../assets/game-icons/Icon_HV_Archer.png';
import troopGoblin from '../assets/game-icons/Icon_HV_Goblin.png';
import troopGiant from '../assets/game-icons/Icon_HV_Giant.png';
import troopWallBreaker from '../assets/game-icons/Icon_HV_Wall_Breaker.png';
import troopBalloon from '../assets/game-icons/Icon_HV_Balloon.png';
import troopWizard from '../assets/game-icons/Icon_HV_Wizard.png';
import troopHealer from '../assets/game-icons/Icon_HV_Healer.png';
import troopDragon from '../assets/game-icons/Icon_HV_Dragon.png';
import troopPekka from '../assets/game-icons/Icon_HV_P.E.K.K.A.png';
import troopMinion from '../assets/game-icons/Icon_HV_Minion.png';
import troopHogRider from '../assets/game-icons/Icon_HV_Hog_Rider.png';
import troopValkyrie from '../assets/game-icons/Icon_HV_Valkyrie.png';
import troopGolem from '../assets/game-icons/Icon_HV_Golem.png';
import troopWitch from '../assets/game-icons/Icon_HV_Witch.png';
import troopLavaHound from '../assets/game-icons/Icon_HV_Lava_Hound.png';
import troopBowler from '../assets/game-icons/Icon_HV_Bowler.png';
import troopBabyDragon from '../assets/game-icons/Icon_HV_Baby_Dragon.png';
import troopMiner from '../assets/game-icons/Icon_HV_Miner.png';
import troopYeti from '../assets/game-icons/Icon_HV_Yeti.png';
import troopIceGolem from '../assets/game-icons/Icon_HV_Ice_Golem.png';
import troopElectroDragon from '../assets/game-icons/Icon_HV_Electro_Dragon.png';
import troopDragonRider from '../assets/game-icons/Icon_HV_Dragon_Rider.png';
import troopHeadhunter from '../assets/game-icons/Icon_HV_Headhunter.png';
import troopElectroTitan from '../assets/game-icons/Icon_HV_Electro_Titan.png';
import troopApprenticeWarden from '../assets/game-icons/Icon_HV_Apprentice_Warden.png';
import troopRuinWitch from '../assets/game-icons/Icon_HV_Ruin_Witch.png';
import troopRootRider from '../assets/game-icons/Icon_HV_Root_Rider.png';
import troopDruid from '../assets/game-icons/Icon_HV_Druid.png';
import troopThrower from '../assets/game-icons/Icon_HV_Thrower.png';
import troopTroopLauncher from '../assets/game-icons/Icon_HV_Troop_Launcher.png';
import troopFurnace from '../assets/game-icons/Icon_HV_Furnace.png';
import troopMeteorGolem from '../assets/game-icons/Icon_HV_Meteor_Golem.png';
import troopLavaloon from '../assets/game-icons/Icon_HV_Lavaloon.png';

// super troops (kept in the map so the grid can show them; the rushed
// engine drops them, but the grid shows every unit the payload carries)
import superBarbarian from '../assets/game-icons/Icon_HV_Super_Barbarian.png';
import superArcher from '../assets/game-icons/Icon_HV_Super_Archer.png';
import superGiant from '../assets/game-icons/Icon_HV_Super_Giant.png';
import sneakyGoblin from '../assets/game-icons/Icon_HV_Sneaky_Goblin.png';
import superWallBreaker from '../assets/game-icons/Icon_HV_Super_Wall_Breaker.png';
import superRocketBalloon from '../assets/game-icons/Icon_HV_Super_Rocket_Balloon.png';
import superWizard from '../assets/game-icons/Icon_HV_Super_Wizard.png';
import superWitch from '../assets/game-icons/Icon_HV_Super_Witch.png';
import superValkyrie from '../assets/game-icons/Icon_HV_Super_Valkyrie.png';
import infernoDragon from '../assets/game-icons/Icon_HV_Super_Inferno_Dragon.png';
import superDragon from '../assets/game-icons/Icon_HV_Super_Dragon.png';
import iceHound from '../assets/game-icons/Icon_HV_Super_Ice_Hound.png';
import superMiner from '../assets/game-icons/Icon_HV_Super_Miner.png';
import superMinion from '../assets/game-icons/Icon_HV_Super_Minion.png';
import superBowler from '../assets/game-icons/Icon_HV_Super_Bowler.png';
import superHogRider from '../assets/game-icons/Icon_HV_Super_Hog_Rider.png';
import superYeti from '../assets/game-icons/Icon_HV_Super_Yeti.png';

// siege machines
import siegeWallWrecker from '../assets/game-icons/Icon_HV_Siege_Machine_Wall_Wrecker.png';
import siegeBattleBlimp from '../assets/game-icons/Icon_HV_Siege_Machine_Battle_Blimp.png';
import siegeStoneSlammer from '../assets/game-icons/Icon_HV_Siege_Machine_Stone_Slammer.png';
import siegeSiegeBarracks from '../assets/game-icons/Icon_HV_Siege_Machine_Siege_Barracks.png';
import siegeLogLauncher from '../assets/game-icons/Icon_HV_Siege_Machine_Log_Launcher.png';
import siegeFlameFlinger from '../assets/game-icons/Icon_HV_Siege_Machine_Flame_Flinger.png';
import siegeBattleDrill from '../assets/game-icons/Icon_HV_Siege_Machine_Battle_Drill.png';
import siegeSkyWagon from '../assets/game-icons/Icon_HV_Siege_Machine_Sky_Wagon.png';

// pets
import petLassi from '../assets/game-icons/Icon_HV_Hero_Pets_LASSI.png';
import petMightyYak from '../assets/game-icons/Icon_HV_Hero_Pets_Mighty_Yak.png';
import petElectroOwl from '../assets/game-icons/Icon_HV_Hero_Pets_Electro_Owl.png';
import petUnicorn from '../assets/game-icons/Icon_HV_Hero_Pets_Unicorn.png';
import petPhoenix from '../assets/game-icons/Icon_HV_Hero_Pets_Phoenix.png';
import petPoisonLizard from '../assets/game-icons/Icon_HV_Hero_Pets_Poison_Lizard.png';
import petDiggy from '../assets/game-icons/Icon_HV_Hero_Pets_Diggy.png';
import petFrosty from '../assets/game-icons/Icon_HV_Hero_Pets_Frosty.png';
import petSpiritFox from '../assets/game-icons/Icon_HV_Hero_Pets_Spirit_Fox.png';
import petAngryJelly from '../assets/game-icons/Icon_HV_Hero_Pets_Angry_Jelly.png';
import petSneezy from '../assets/game-icons/Icon_HV_Hero_Pets_Sneezy.png';
import petGreedyRaven from '../assets/game-icons/Icon_HV_Hero_Pets_Greedy_Raven.png';

// ---------- spells ----------

import spellLightning from '../assets/game-icons/Icon_HV_Spell_Lightning.png';
import spellHeal from '../assets/game-icons/Icon_HV_Spell_Heal.png';
import spellRage from '../assets/game-icons/Icon_HV_Spell_Rage.png';
import spellJump from '../assets/game-icons/Icon_HV_Spell_Jump.png';
import spellFreeze from '../assets/game-icons/Icon_HV_Spell_Freeze.png';
import spellClone from '../assets/game-icons/Icon_HV_Spell_Clone.png';
import spellInvisibility from '../assets/game-icons/Icon_HV_Spell_Invisibility.png';
import spellRecall from '../assets/game-icons/Icon_HV_Spell_Recall.png';
import spellRevive from '../assets/game-icons/Icon_HV_Spell_Revive.png';
import spellAngry from '../assets/game-icons/Icon_HV_Spell_Angry.png';
import spellTotem from '../assets/game-icons/Icon_HV_Spell_Totem.png';

// dark spells
import spellPoison from '../assets/game-icons/Icon_HV_Dark_Spell_Poison.png';
import spellEarthquake from '../assets/game-icons/Icon_HV_Dark_Spell_Earthquake.png';
import spellHaste from '../assets/game-icons/Icon_HV_Dark_Spell_Haste.png';
import spellSkeleton from '../assets/game-icons/Icon_HV_Dark_Spell_Skeleton.png';
import spellBat from '../assets/game-icons/Icon_HV_Dark_Spell_Bat.png';
import spellIceBlock from '../assets/game-icons/Icon_HV_Dark_Spell_Ice_Block.png';
import spellOvergrowth from '../assets/game-icons/Icon_HV_Dark_Spell_Overgrowth.png';

// ---------- heroes ----------

import heroBarbarianKing from '../assets/game-icons/Icon_HV_Hero_Barbarian_King.png';
import heroArcherQueen from '../assets/game-icons/Icon_HV_Hero_Archer_Queen.png';
import heroGrandWarden from '../assets/game-icons/Icon_HV_Hero_Grand_Warden.png';
import heroRoyalChampion from '../assets/game-icons/Icon_HV_Hero_Royal_Champion.png';
import heroMinionPrince from '../assets/game-icons/Icon_HV_Hero_Minion_Prince.png';
import heroDragonDuke from '../assets/game-icons/Icon_HV_Hero_Dragon_Duke.png';

// ---------- builder base ----------

import bbRagedBarbarian from '../assets/game-icons/Icon_BB_Raged_Barbarian.png';
import bbSneakyArcher from '../assets/game-icons/Icon_BB_Sneaky_Archer.png';
import bbBetaMinion from '../assets/game-icons/Icon_BB_Beta_Minion.png';
import bbBoxerGiant from '../assets/game-icons/Icon_BB_Boxer_Giant.png';
import bbBomber from '../assets/game-icons/Icon_BB_Bomber.png';
import bbPowerPekka from '../assets/game-icons/Icon_BB_Power_P.E.K.K.A.png';
import bbCannonCart from '../assets/game-icons/Icon_BB_Cannon_Cart.png';
import bbDropShip from '../assets/game-icons/Icon_BB_Drop_Ship.png';
import bbNightWitch from '../assets/game-icons/Icon_BB_Night_Witch.png';
import bbHogGlider from '../assets/game-icons/Icon_BB_Hog_Glider.png';
import bbElectrofireWizard from '../assets/game-icons/Icon_BB_Electrofire_Wizard.png';
import bbBattleMachine from '../assets/game-icons/Icon_BB_Hero_Battle_Machine.png';
import bbBattleCopter from '../assets/game-icons/Icon_BB_Hero_Battle_Copter.png';

// ---------- hero equipment ----------

import eqActionFigure from '../assets/game-icons/Icon_HE_AQ_Action_Figure.png';
import eqArcherPuppet from '../assets/game-icons/Icon_HE_AQ_Archer_Puppet.png';
import eqFrozenArrow from '../assets/game-icons/Icon_HE_AQ_Frozen_Arrow.png';
import eqGiantArrow from '../assets/game-icons/Icon_HE_AQ_Giant_Arrow.png';
import eqHealerPuppet from '../assets/game-icons/Icon_HE_AQ_Healer_Puppet.png';
import eqInvisibilityVial from '../assets/game-icons/Icon_HE_AQ_Invisibility_Vial.png';
import eqMagicMirror from '../assets/game-icons/Icon_HE_AQ_Magic_Mirror.png';
import eqMonolithArrow from '../assets/game-icons/Icon_HE_AQ_MonolithArrow.png';
import eqBarbarianPuppet from '../assets/game-icons/Icon_HE_BK_Barbarian_Puppet.png';
import eqEarthquakeBoots from '../assets/game-icons/Icon_HE_BK_Earthquake_Boots.png';
import eqRageVial from '../assets/game-icons/Icon_HE_BK_Rage_Vial.png';
import eqSnakeBracelet from '../assets/game-icons/Icon_HE_BK_Snake_Bracelet.png';
import eqSpikyBall from '../assets/game-icons/Icon_HE_BK_Spiky_Ball.png';
import eqVampstache from '../assets/game-icons/Icon_HE_BK_Vampstache.png';
import eqGiantGauntlet from '../assets/game-icons/Icon_HE_BQ_Giant_Gauntlet.png';
import eqEternalTome from '../assets/game-icons/Icon_HE_GW_Eternal_Tome.png';
import eqFireball from '../assets/game-icons/Icon_HE_GW_Fireball.png';
import eqHealingTome from '../assets/game-icons/Icon_HE_GW_Healing_Tome.png';
import eqLifeGem from '../assets/game-icons/Icon_HE_GW_Life_Gem.png';
import eqRageGem from '../assets/game-icons/Icon_HE_GW_Rage_Gem.png';
import eqDarkOrb from '../assets/game-icons/Icon_HE_MP_DarkOrb.png';
import eqHenchman from '../assets/game-icons/Icon_HE_MP_Henchman.png';
import eqIronPants from '../assets/game-icons/Icon_HE_MP_Iron_Pants.png';
import eqNobleIron from '../assets/game-icons/Icon_HE_MP_Noble_Iron.png';
import eqElectroBoots from '../assets/game-icons/Icon_HE_RC_ElectroBoots.png';
import eqFrostFlake from '../assets/game-icons/Icon_HE_RC_Frost_Flake.png';
import eqHasteVial from '../assets/game-icons/Icon_HE_RC_Haste_Vial.png';
import eqHogRiderDoll from '../assets/game-icons/Icon_HE_RC_Hog_Rider_Doll.png';
import eqRoyalGem from '../assets/game-icons/Icon_HE_RC_Royal_Gem.png';
import eqSeekingShield from '../assets/game-icons/Icon_HE_RC_Seeking_Shield.png';
import eqStickFireHorse from '../assets/game-icons/Icon_HG_BK_StickFireHorse.png';
import eqElectroFangs from '../assets/game-icons/Icon_HG_DD_Electro_Fangs.png';
import eqFireHeart from '../assets/game-icons/Icon_HG_DD_FireHeart.png';
import eqFlameBlower from '../assets/game-icons/Icon_HG_DD_FlameBlower.png';
import eqRocketBackPack from '../assets/game-icons/Icon_HG_DD_Rocket_BackPack.png';
import eqStunBlast from '../assets/game-icons/Icon_HG_DD_StunBlast.png';
import eqHeroicTorch from '../assets/game-icons/Icon_HG_GW_Heroic_Torch.png';
import eqLavaloonPuppet from '../assets/game-icons/Icon_HG_GW_LavaloonPuppet.png';
import eqDarkCrown from '../assets/game-icons/Icon_HG_MP_DarkCrown.png';
import eqMeteoriteSceptre from '../assets/game-icons/Icon_HG_MP_MeteoriteSceptre.png';
import eqRocketSpear from '../assets/game-icons/Icon_HG_RoyalChampion_RocketSpear_Equipment_03.png';

/**
 * The unit icon map: every CoC API unit name to its bundled PNG URL. A unit
 * whose name is not in this map renders the placeholder (07 section 7),
 * never a broken image and never a wrong icon standing in for a missing
 * one. Adding a unit is a one-line append plus the icon file under
 * src/assets/game-icons/.
 */
export const UNIT_ICON_MAP: Readonly<Record<string, string>> = {
  // home village troops
  Barbarian: troopBarbarian,
  Archer: troopArcher,
  Goblin: troopGoblin,
  Giant: troopGiant,
  'Wall Breaker': troopWallBreaker,
  Balloon: troopBalloon,
  Wizard: troopWizard,
  Healer: troopHealer,
  Dragon: troopDragon,
  'P.E.K.K.A': troopPekka,
  Minion: troopMinion,
  'Hog Rider': troopHogRider,
  Valkyrie: troopValkyrie,
  Golem: troopGolem,
  Witch: troopWitch,
  'Lava Hound': troopLavaHound,
  Bowler: troopBowler,
  'Baby Dragon': troopBabyDragon,
  Miner: troopMiner,
  Yeti: troopYeti,
  'Ice Golem': troopIceGolem,
  'Electro Dragon': troopElectroDragon,
  'Dragon Rider': troopDragonRider,
  Headhunter: troopHeadhunter,
  'Electro Titan': troopElectroTitan,
  'Apprentice Warden': troopApprenticeWarden,
  'Ruin Witch': troopRuinWitch,
  'Root Rider': troopRootRider,
  Druid: troopDruid,
  Thrower: troopThrower,
  'Troop Launcher': troopTroopLauncher,
  Furnace: troopFurnace,
  'Meteor Golem': troopMeteorGolem,
  Lavaloon: troopLavaloon,

  // super troops
  'Super Barbarian': superBarbarian,
  'Super Archer': superArcher,
  'Super Giant': superGiant,
  'Sneaky Goblin': sneakyGoblin,
  'Super Wall Breaker': superWallBreaker,
  'Rocket Balloon': superRocketBalloon,
  'Super Wizard': superWizard,
  'Super Witch': superWitch,
  'Super Valkyrie': superValkyrie,
  'Inferno Dragon': infernoDragon,
  'Super Dragon': superDragon,
  'Ice Hound': iceHound,
  'Super Miner': superMiner,
  'Super Minion': superMinion,
  'Super Bowler': superBowler,
  'Super Hog Rider': superHogRider,
  'Super Yeti': superYeti,
  'Super Ice Hound': iceHound,
  'Super Inferno Dragon': infernoDragon,

  // siege machines
  'Wall Wrecker': siegeWallWrecker,
  'Battle Blimp': siegeBattleBlimp,
  'Stone Slammer': siegeStoneSlammer,
  'Siege Barracks': siegeSiegeBarracks,
  'Log Launcher': siegeLogLauncher,
  'Flame Flinger': siegeFlameFlinger,
  'Battle Drill': siegeBattleDrill,
  'Sky Wagon': siegeSkyWagon,

  // pets
  'L.A.S.S.I': petLassi,
  'Mighty Yak': petMightyYak,
  'Electro Owl': petElectroOwl,
  Unicorn: petUnicorn,
  Phoenix: petPhoenix,
  'Poison Lizard': petPoisonLizard,
  Diggy: petDiggy,
  Frosty: petFrosty,
  'Spirit Fox': petSpiritFox,
  'Angry Jelly': petAngryJelly,
  Sneezy: petSneezy,
  'Greedy Raven': petGreedyRaven,

  // spells
  'Lightning Spell': spellLightning,
  'Healing Spell': spellHeal,
  'Rage Spell': spellRage,
  'Jump Spell': spellJump,
  'Freeze Spell': spellFreeze,
  'Clone Spell': spellClone,
  'Invisibility Spell': spellInvisibility,
  'Recall Spell': spellRecall,
  'Revive Spell': spellRevive,
  'Angry Spell': spellAngry,
  'Totem Spell': spellTotem,

  // dark spells
  'Poison Spell': spellPoison,
  'Earthquake Spell': spellEarthquake,
  'Haste Spell': spellHaste,
  'Skeleton Spell': spellSkeleton,
  'Bat Spell': spellBat,
  'Ice Block Spell': spellIceBlock,
  'Overgrowth Spell': spellOvergrowth,

  // heroes
  'Barbarian King': heroBarbarianKing,
  'Archer Queen': heroArcherQueen,
  'Grand Warden': heroGrandWarden,
  'Royal Champion': heroRoyalChampion,
  'Minion Prince': heroMinionPrince,
  'Dragon Duke': heroDragonDuke,

  // builder base
  'Raged Barbarian': bbRagedBarbarian,
  'Sneaky Archer': bbSneakyArcher,
  'Beta Minion': bbBetaMinion,
  'Boxer Giant': bbBoxerGiant,
  Bomber: bbBomber,
  'Power P.E.K.K.A': bbPowerPekka,
  'Cannon Cart': bbCannonCart,
  'Drop Ship': bbDropShip,
  'Battle Machine': bbBattleMachine,
  'Night Witch': bbNightWitch,
  'Hog Glider': bbHogGlider,
  'Electrofire Wizard': bbElectrofireWizard,
  'Battle Copter': bbBattleCopter,

  // hero equipment (the flat inventory; the per-hero nested equipment
  // carries the same names, so the map serves both)
  'Giant Gauntlet': eqGiantGauntlet,
  'Spiky Ball': eqSpikyBall,
  'Earthquake Boots': eqEarthquakeBoots,
  'Snake Bracelet': eqSnakeBracelet,
  'Vampstache': eqVampstache,
  'Rage Vial': eqRageVial,
  'Barbarian Puppet': eqBarbarianPuppet,
  'Giant Arrow': eqGiantArrow,
  'Frozen Arrow': eqFrozenArrow,
  'Magic Mirror': eqMagicMirror,
  'Invisibility Vial': eqInvisibilityVial,
  'Archer Puppet': eqArcherPuppet,
  'Healer Puppet': eqHealerPuppet,
  'Action Figure': eqActionFigure,
  'Monolith Arrow': eqMonolithArrow,
  'Eternal Tome': eqEternalTome,
  'Life Gem': eqLifeGem,
  'Rage Gem': eqRageGem,
  'Healing Tome': eqHealingTome,
  'Fireball': eqFireball,
  'Seeking Shield': eqSeekingShield,
  'Royal Gem': eqRoyalGem,
  'Frost Flake': eqFrostFlake,
  'Haste Vial': eqHasteVial,
  'Hog Rider Doll': eqHogRiderDoll,
  'Electro Boots': eqElectroBoots,
  'Dark Orb': eqDarkOrb,
  'Henchman': eqHenchman,
  'Iron Pants': eqIronPants,
  'Noble Iron': eqNobleIron,
  'Stick Fire Horse': eqStickFireHorse,
  'Electro Fangs': eqElectroFangs,
  'Fire Heart': eqFireHeart,
  'Flame Blower': eqFlameBlower,
  'Rocket Backpack': eqRocketBackPack,
  'Stun Blaster': eqStunBlast,
  'Heroic Torch': eqHeroicTorch,
  'Lavaloon Puppet': eqLavaloonPuppet,
  'Dark Crown': eqDarkCrown,
  'Meteorite Sceptre': eqMeteoriteSceptre,
  'Rocket Spear': eqRocketSpear,
};

/**
 * The placeholder icon URL, exported so a tile can render the fallback
 * without re-importing the asset (07 section 7).
 */
export const PLACEHOLDER_ICON: string = placeholderIcon;

/**
 * Resolves a unit name to its bundled icon URL. Returns the placeholder
 * when the name is not in the map (07 section 7 "Imagery" fallback rule):
 * never a broken image, never a wrong icon standing in for a missing one.
 *
 * Pure: same name always yields the same URL.
 */
export function iconForUnit(name: string): string {
  return UNIT_ICON_MAP[name] ?? PLACEHOLDER_ICON;
}

/**
 * True when the unit name has a bundled icon (not the placeholder). Used by
 * the completeness test so a fixture unit name without an icon fails loudly
 * rather than silently rendering the placeholder (05 section 5).
 */
export function hasUnitIcon(name: string): boolean {
  return name in UNIT_ICON_MAP;
}
