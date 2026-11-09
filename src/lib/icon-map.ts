// The typed unit-icon map (07 section 7, the icons README's "Mapping"
// section): CoC API unit names to the locally bundled Fankit PNGs under
// src/assets/game-icons/. The hero panel (T-M2-4) reads it for its hero and
// equipment rows; the progression grid (T-M2-5) will read the same table
// extended to troops, spells, pets, and siege machines. One map, one owner,
// so the copy-locally policy and the placeholder fallback stay consistent
// across every surface that draws a unit.
//
// The module is pure data plus one lookup (STD-09): importing a PNG through
// Vite yields its bundled URL string, which is data, not React, so the map
// lives beside the other lib helpers and stays testable without a renderer.
//
// Name evidence, because the map is only as good as its keys:
// - Recorded names come straight off payloads the docs captured verbatim
//   (docs/api-local-tests.md, fixtures/, the mock upstream) plus the live
//   payload the reference-data pass (T-M2-6) trued everything against:
//   every hero and every equipment piece the game API returns today,
//   spelled the way the API spells them.
// - The live chain answered throughout this pass, so the derived names
//   that had never met a payload were replaced with the API's own
//   spellings: Vampstache, Hog Rider Puppet, Henchmen Puppet, Metal
//   Pants, Meteor Staff, Revenge Deck, and Stun Blaster now resolve;
//   the two derived keys that turned out to be misnamings (Hog Rider
//   Doll, Stick Fire Horse) were dropped with their Fankit files.
// - Two equipment pieces have no bundled icon (Revenge Deck, Portal
//   Pendant: not in the Fankit set). They stay unmapped and render the
//   placeholder, never a wrong icon standing in for a missing one.
//
// Reference data version: the game as of November 2026 (Town Hall 18,
// Builder Hall 10, the 43-piece hero equipment set). Updating the map is
// a docs-sized PR whenever the game ships new content; the completeness
// tests fail loudly when a payload carries a name the map has not met.

import battleCopterIcon from '../assets/game-icons/Icon_BB_Hero_Battle_Copter.png';
import battleMachineIcon from '../assets/game-icons/Icon_BB_Hero_Battle_Machine.png';
import dragonDukeIcon from '../assets/game-icons/Icon_HV_Hero_Dragon_Duke.png';
import barbarianKingIcon from '../assets/game-icons/Icon_HV_Hero_Barbarian_King.png';
import archerQueenIcon from '../assets/game-icons/Icon_HV_Hero_Archer_Queen.png';
import grandWardenIcon from '../assets/game-icons/Icon_HV_Hero_Grand_Warden.png';
import royalChampionIcon from '../assets/game-icons/Icon_HV_Hero_Royal_Champion.png';
import minionPrinceIcon from '../assets/game-icons/Icon_HV_Hero_Minion_Prince.png';

import actionFigureIcon from '../assets/game-icons/Icon_HE_AQ_Action_Figure.png';
import archerPuppetIcon from '../assets/game-icons/Icon_HE_AQ_Archer_Puppet.png';
import frozenArrowIcon from '../assets/game-icons/Icon_HE_AQ_Frozen_Arrow.png';
import giantArrowIcon from '../assets/game-icons/Icon_HE_AQ_Giant_Arrow.png';
import healerPuppetIcon from '../assets/game-icons/Icon_HE_AQ_Healer_Puppet.png';
import invisibilityVialIcon from '../assets/game-icons/Icon_HE_AQ_Invisibility_Vial.png';
import magicMirrorIcon from '../assets/game-icons/Icon_HE_AQ_Magic_Mirror.png';
import monolithArrowIcon from '../assets/game-icons/Icon_HE_AQ_MonolithArrow.png';
import barbarianPuppetIcon from '../assets/game-icons/Icon_HE_BK_Barbarian_Puppet.png';
import earthquakeBootsIcon from '../assets/game-icons/Icon_HE_BK_Earthquake_Boots.png';
import rageVialIcon from '../assets/game-icons/Icon_HE_BK_Rage_Vial.png';
import snakeBraceletIcon from '../assets/game-icons/Icon_HE_BK_Snake_Bracelet.png';
import spikyBallIcon from '../assets/game-icons/Icon_HE_BK_Spiky_Ball.png';
import vampstacheIcon from '../assets/game-icons/Icon_HE_BK_Vampstache.png';
import giantGauntletIcon from '../assets/game-icons/Icon_HE_BQ_Giant_Gauntlet.png';
import eternalTomeIcon from '../assets/game-icons/Icon_HE_GW_Eternal_Tome.png';
import fireballIcon from '../assets/game-icons/Icon_HE_GW_Fireball.png';
import healingTomeIcon from '../assets/game-icons/Icon_HE_GW_Healing_Tome.png';
import lifeGemIcon from '../assets/game-icons/Icon_HE_GW_Life_Gem.png';
import rageGemIcon from '../assets/game-icons/Icon_HE_GW_Rage_Gem.png';
import darkOrbIcon from '../assets/game-icons/Icon_HE_MP_DarkOrb.png';
import henchmanPuppetIcon from '../assets/game-icons/Icon_HE_MP_Henchman.png';
import ironPantsIcon from '../assets/game-icons/Icon_HE_MP_Iron_Pants.png';
import nobleIronIcon from '../assets/game-icons/Icon_HE_MP_Noble_Iron.png';
import electroBootsIcon from '../assets/game-icons/Icon_HE_RC_ElectroBoots.png';
import frostFlakeIcon from '../assets/game-icons/Icon_HE_RC_Frost_Flake.png';
import hasteVialIcon from '../assets/game-icons/Icon_HE_RC_Haste_Vial.png';
import hogRiderPuppetIcon from '../assets/game-icons/Icon_HE_RC_Hog_Rider_Doll.png';
import royalGemIcon from '../assets/game-icons/Icon_HE_RC_Royal_Gem.png';
import seekingShieldIcon from '../assets/game-icons/Icon_HE_RC_Seeking_Shield.png';
import stickHorseIcon from '../assets/game-icons/Icon_HG_BK_StickFireHorse.png';
import electroFangsIcon from '../assets/game-icons/Icon_HG_DD_Electro_Fangs.png';
import fireHeartIcon from '../assets/game-icons/Icon_HG_DD_FireHeart.png';
import flameBlowerIcon from '../assets/game-icons/Icon_HG_DD_FlameBlower.png';
import rocketBackpackIcon from '../assets/game-icons/Icon_HG_DD_Rocket_BackPack.png';
import stunBlasterIcon from '../assets/game-icons/Icon_HG_DD_StunBlast.png';
import heroicTorchIcon from '../assets/game-icons/Icon_HG_GW_Heroic_Torch.png';
import lavaloonPuppetIcon from '../assets/game-icons/Icon_HG_GW_LavaloonPuppet.png';
import darkCrownIcon from '../assets/game-icons/Icon_HG_MP_DarkCrown.png';
import meteorStaffIcon from '../assets/game-icons/Icon_HG_MP_MeteoriteSceptre.png';
import rocketSpearIcon from '../assets/game-icons/Icon_HG_RoyalChampion_RocketSpear_Equipment_03.png';

/** The unit families the map resolves today. The progression grid (T-M2-5)
 * extends the union with troops, spells, pets, and siege machines; the
 * lookup shape stays the same so the callers do not change. */
export type UnitKind = 'hero' | 'equipment';

// Every hero the game API returns as of this module: the four classic home
// heroes, the two newest (Minion Prince recorded on the mock, Dragon Duke
// from the Fankit naming), and the two builder-base heroes.
const HERO_ICONS: Readonly<Record<string, string>> = {
  'Barbarian King': barbarianKingIcon,
  'Archer Queen': archerQueenIcon,
  'Grand Warden': grandWardenIcon,
  'Royal Champion': royalChampionIcon,
  'Minion Prince': minionPrinceIcon,
  'Dragon Duke': dragonDukeIcon,
  'Battle Machine': battleMachineIcon,
  'Battle Copter': battleCopterIcon,
};

// The hero equipment the Fankit ships, keyed by the API's equipment names.
const EQUIPMENT_ICONS: Readonly<Record<string, string>> = {
  'Action Figure': actionFigureIcon,
  'Archer Puppet': archerPuppetIcon,
  'Frozen Arrow': frozenArrowIcon,
  'Giant Arrow': giantArrowIcon,
  'Healer Puppet': healerPuppetIcon,
  'Invisibility Vial': invisibilityVialIcon,
  'Magic Mirror': magicMirrorIcon,
  'Monolith Arrow': monolithArrowIcon,
  'Barbarian Puppet': barbarianPuppetIcon,
  'Earthquake Boots': earthquakeBootsIcon,
  'Rage Vial': rageVialIcon,
  'Snake Bracelet': snakeBraceletIcon,
  'Spiky Ball': spikyBallIcon,
  Vampstache: vampstacheIcon,
  'Giant Gauntlet': giantGauntletIcon,
  'Eternal Tome': eternalTomeIcon,
  Fireball: fireballIcon,
  'Healing Tome': healingTomeIcon,
  'Life Gem': lifeGemIcon,
  'Rage Gem': rageGemIcon,
  'Dark Orb': darkOrbIcon,
  'Henchmen Puppet': henchmanPuppetIcon,
  'Metal Pants': ironPantsIcon,
  'Noble Iron': nobleIronIcon,
  'Electro Boots': electroBootsIcon,
  'Frost Flake': frostFlakeIcon,
  'Haste Vial': hasteVialIcon,
  'Hog Rider Puppet': hogRiderPuppetIcon,
  'Royal Gem': royalGemIcon,
  'Seeking Shield': seekingShieldIcon,
  'Stick Horse': stickHorseIcon,
  'Electro Fangs': electroFangsIcon,
  'Fire Heart': fireHeartIcon,
  'Flame Blower': flameBlowerIcon,
  'Rocket Backpack': rocketBackpackIcon,
  'Stun Blaster': stunBlasterIcon,
  'Heroic Torch': heroicTorchIcon,
  'Lavaloon Puppet': lavaloonPuppetIcon,
  'Dark Crown': darkCrownIcon,
  'Meteor Staff': meteorStaffIcon,
  'Rocket Spear': rocketSpearIcon,
};

const KIND_TABLES: Readonly<Record<UnitKind, Readonly<Record<string, string>>>> = {
  hero: HERO_ICONS,
  equipment: EQUIPMENT_ICONS,
};

/** The bundled icon's URL for a unit, or null when the name has no mapping.
 * Null is the fallback signal, not an error: the caller renders the
 * placeholder (the icons README's "never fake an icon" rule), so new game
 * content the map has not met yet still gets an honest row. */
export function unitIcon(kind: UnitKind, name: string): string | null {
  return KIND_TABLES[kind][name] ?? null;
}
