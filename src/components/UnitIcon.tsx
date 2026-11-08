import { Image } from 'react-native';
import { unitIcon, type UnitKind } from '../lib/icon-map';
import placeholderIcon from '../assets/game-icons/placeholder.svg';

// The unit icon slot (07 section 4, the component inventory; 07 section 7's
// unit-icon rule): a bundled game icon in a fixed box, resolved through the
// typed map in lib/icon-map.ts, with placeholder.svg whenever a name has no
// mapping yet. Never a hotlink, never a broken-image glyph, never a wrong
// icon (the icons README's rules); new game content renders an honest
// placeholder until the map learns its name.
//
// The slot is fixed so a slow decode never reflows the row around it, the
// same discipline the API icon slots keep (league icon 24, clan badge 48).
// Two sizes: the standard 32 px slot the progression grid tiles will take,
// and a 20 px small variant for the hero panel's quiet equipment rows, where
// the icons sit beside xs-sized text and a full slot would shout over its
// hero.
//
// Accessibility: the icon is decorative by design. Every surface that
// renders a UnitIcon already labels its row with the unit's name (the hero
// row's label reads the name and level pair), so the picture adds nothing a
// screen reader needs: an RN Image without an accessibilityLabel renders
// with an empty alt, the web's explicit decorative marker, and stays skipped
// rather than repeating the name into the tree.

// The standard slot (07 section 4's "fixed 32 px slot") and the small
// variant the hero panel's equipment rows take.
const UNIT_ICON_SLOT = 32;
const UNIT_ICON_SLOT_SMALL = 20;

export type UnitIconSize = 'md' | 'sm';

export interface UnitIconProps {
  /** The unit family the name belongs to; the map resolves per kind so a
   * mixed-up caller renders the placeholder, not a wrong-family icon. */
  kind: UnitKind;
  /** The unit's name exactly as the game API spells it. */
  name: string;
  /** The slot size: md (32 px) by default, sm (20 px) on quiet rows. */
  size?: UnitIconSize;
}

export default function UnitIcon({ kind, name, size = 'md' }: UnitIconProps) {
  const slot = size === 'sm' ? UNIT_ICON_SLOT_SMALL : UNIT_ICON_SLOT;
  const source = unitIcon(kind, name) ?? placeholderIcon;
  return <Image source={{ uri: source }} style={{ width: slot, height: slot }} />;
}
