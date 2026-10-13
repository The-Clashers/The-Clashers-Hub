# Game Icons

Locally-bundled Clash of Clans game icons used by The Clashers Hub: home
village troops, spells, heroes, pets, and siege machines (`Icon_HV_*`),
builder base units (`Icon_BB_*`), and hero equipment (`Icon_HE_*` /
`Icon_HG_*`). Plus `placeholder.svg`, the mandatory fallback when an icon has
not been bundled yet.

## Source

All icons originate from the **Supercell Fankit**:

> https://fankit.supercell.com/d/vkEdmkUCngKw/game-assets

The Fankit is the only sanctioned source for Clash of Clans game assets.
Icons from `api-assets.clashofclans.com` are runtime badges and league
crests, not unit icons, and must not be used for units. Use of Supercell
assets follows Supercell's Fan Content Policy: this is a non-commercial
fan/student project.

## Copy-locally policy: never hotlink

1. **Always copy** the asset into this folder. Never point an `<img>`/`Image`
   `src` at `fankit.supercell.com` or any third-party CDN.
2. Hotlinks break the moment Supercell reorganizes the Fankit, and they leak
   the visitor's IP to a third party on every page view.
3. Prefer PNG with transparency so icons sit cleanly on both light and dark
   surfaces (see [07 §"Tokens"](../../../docs/concept/07-design-language.md)). Run `oxipng` or `pngcrush -brute` before committing
   anything over ~25 KB.

## Filename convention

Downloaded Fankit PNGs follow `Icon_<Village>_<Name>.png`, where `<Village>`
is `HV` (home village) or `BB` (builder base), and `<Name>` is PascalCase
with underscores (e.g. `Icon_HV_Hog_Rider.png`). Hero equipment uses the
`Icon_HE_<Hero>_<Item>.png` / `Icon_HG_<Hero>_<Item>.png` prefixes. Keep the
upstream names exactly; renaming breaks the mapping.

## Mapping

The runtime mapping from CoC API unit **names** (as they appear in
`troops[]`, `heroes[]`, `spells[]`, and equipment fields) to the files in
this folder lives in a typed module and lands with the reference-data
bundle (Town Hall cap tables, super-troop map, hero equipment caps) and the
M2 progression grid (FR-16, see [05 §1](../../../docs/concept/05-scoring-engines.md)
for the adapter that feeds it). Update that module whenever icons are
added; the engine test suite fails loudly when a fixture unit name has
neither a mapping nor the documented placeholder.

## Fallback rule: never fake an icon

When a unit has no bundled icon, render the unit **name as a text label**
using `placeholder.svg`: never a broken image, and never a wrong icon.
