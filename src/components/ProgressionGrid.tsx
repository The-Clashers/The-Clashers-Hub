import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import UnitIcon, { UNIT_ICON_SIZE } from './UnitIcon';
import type {
  ProgressionVillageGroup,
  ProgressionCategoryBlock,
  ProgressionTile,
} from '../lib/progression-grid';

// The progression grid (07 section 4 "ProgressionGrid"). Every unit of
// both villages as a tile: the bundled icon, the level/maximum pair, and
// the MAX badge, grouped by village and category. The grid renders
// entirely from the single player response the shell already fetched
// (SR-16): no second call, no second loading state, and no network
// request beyond the player fetch (AC-07).
//
// The tile is the owner's prototype layout: a compact square-ish cell per
// unit — the icon centered on top, the name under it in two quiet lines,
// the level pair at the bottom, and a gold MAX badge breaking the tile's
// top-right corner when the unit is maxed. The tiles fill measured rows
// side by side (the prototype's auto-fill minmax(76px, 1fr) grid), so the
// icons read as a wall of game content the way the game's own army
// overview does; the category headers carry the "N units · M maxed"
// count line.
//
// The grid is virtualized (07 section 3): a real account carries ~100 unit
// tiles across both villages, and rendering them all at once would jank
// the scroll. The FlatList owns the scroll container; the tiles are
// chunked into fixed-width rows of the measured column count, so each
// list row is one grid line and the virtualization keeps working.

/** The tile's minimum width: below this the name stops fitting beside
 * itself and the wall reads as a list. Compact minmax(68px, 1fr). */
const TILE_MIN_WIDTH = 68;

/** The gap between tiles, and between tile rows. */
const TILE_GAP = 6;

/** The tile row's horizontal padding, each side (the tile's width math
 * subtracts it so the last tile lands on the row's right edge). */
const ROW_PADDING = 4;

/** The columns rendered before the container has been measured: a
 * tablet-ish count that is close to every real width, so the first paint
 * (and the skeleton it mirrors) never flashes a one-column wall. */
const UNMEASURED_COLUMNS = 4;

/** The tile name's line count: two lines fit "Sneaky Goblin" and every
 * other unit name the API spells; the rest clip, the way the prototype's
 * fixed 23 px name box clips. */
const TILE_NAME_LINES = 2;

export interface ProgressionGridProps {
  /** The village-grouped, category-blocked tiles from the single player
   * response. Built by lib/progression-grid.ts. */
  groups: ProgressionVillageGroup[];
}

export default function ProgressionGrid({ groups }: ProgressionGridProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // The measured container width, from which the column count and the
  // tiles' even width come. Zero until the first layout pass; until then
  // the fallback column count keeps the first paint plausible.
  const [containerWidth, setContainerWidth] = useState(0);
  const columns = containerWidth > 0
    ? Math.max(1, Math.floor((containerWidth + TILE_GAP) / (TILE_MIN_WIDTH + TILE_GAP)))
    : UNMEASURED_COLUMNS;

  // Every tile takes the same fixed width — the prototype's auto-fill
  // grid keeps its columns even, so a short last line renders short
  // rather than stretching its tiles across the row.
  const tileWidth = containerWidth > 0
    ? Math.floor(
        (containerWidth - 2 * ROW_PADDING - (columns - 1) * TILE_GAP) / columns,
      )
    : null;

  const rows = useMemo(
    () => flattenGroups(groups, columns),
    [groups, columns],
  );

  return (
    <View
      accessibilityRole="grid"
      accessibilityLabel="Player progression grid"
      style={styles.grid}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <FlatList
        data={rows}
        keyExtractor={(row, index) => rowKey(row, index)}
        renderItem={({ item }) => renderRow(item, styles, tileWidth)}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
    </View>
  );
}

// ---------- row types ----------

type GridRow =
  | { kind: 'village'; village: string; label: string }
  | { kind: 'category'; label: string; tileCount: number; maxedCount: number }
  | { kind: 'tiles'; tiles: ProgressionTile[] };

function flattenGroups(groups: ProgressionVillageGroup[], columns: number): GridRow[] {
  const rows: GridRow[] = [];
  for (const group of groups) {
    rows.push({ kind: 'village', village: group.village, label: group.label });
    for (const block of group.categories) {
      rows.push(categoryHeaderRow(block));
      for (const chunk of chunkTiles(block.tiles, columns)) {
        rows.push({ kind: 'tiles', tiles: chunk });
      }
    }
  }
  return rows;
}

/** The category header's own row data: the label plus the count line the
 * prototype's section headers carry ("N units · M maxed"). */
function categoryHeaderRow(block: ProgressionCategoryBlock): GridRow {
  const maxedCount = block.tiles.filter(
    (tile) => tile.maxLevel !== null && tile.level >= tile.maxLevel,
  ).length;
  return {
    kind: 'category',
    label: block.label,
    tileCount: block.tiles.length,
    maxedCount,
  };
}

/** Chunks the block's tiles into grid lines of the measured column count.
 * The last line renders short rather than stretched with gaps. */
function chunkTiles(tiles: ProgressionTile[], columns: number): ProgressionTile[][] {
  const chunks: ProgressionTile[][] = [];
  for (let index = 0; index < tiles.length; index += columns) {
    chunks.push(tiles.slice(index, index + columns));
  }
  return chunks;
}

function rowKey(row: GridRow, index: number): string {
  if (row.kind === 'village') return `village-${row.village}`;
  if (row.kind === 'category') return `category-${index}`;
  return `tiles-${index}`;
}

function renderRow(
  row: GridRow,
  styles: ReturnType<typeof createStyles>,
  tileWidth: number | null,
) {
  if (row.kind === 'village') {
    return (
      <View style={styles.villageHeader}>
        <Text style={styles.villageLabel}>{row.label}</Text>
      </View>
    );
  }
  if (row.kind === 'category') {
    return (
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryLabel}>{row.label}</Text>
        <Text style={styles.categoryCount}>
          {`${row.tileCount} unit${row.tileCount === 1 ? '' : 's'} \u00B7 ${row.maxedCount} maxed`}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.tileRow} accessibilityRole="row">
      {row.tiles.map((tile, index) => (
        <ProgressionTileCell
          key={`${tile.village}-${tile.name}-${index}`}
          tile={tile}
          styles={styles}
          width={tileWidth}
        />
      ))}
    </View>
  );
}

// ---------- tile ----------

interface ProgressionTileCellProps {
  tile: ProgressionTile;
  styles: ReturnType<typeof createStyles>;
  /** The measured even width every tile takes, or null before the grid
   * has measured itself (the tile then falls back to the shared row's
   * flex). */
  width: number | null;
}

function ProgressionTileCell({ tile, styles, width }: ProgressionTileCellProps) {
  const isMaxed = tile.maxLevel !== null && tile.level >= tile.maxLevel;
  const hasMax = tile.maxLevel !== null;
  const rowLabel = hasMax
    ? `${tile.name}, level ${tile.level} of ${tile.maxLevel}${isMaxed ? ', maxed' : ''}`
    : `${tile.name}, level ${tile.level}`;

  return (
    <View
      style={[styles.tile, isMaxed && styles.tileMaxed, width !== null ? { width } : null]}
      accessibilityRole="gridcell"
      accessibilityLabel={rowLabel}
    >
      {isMaxed ? (
        <View style={styles.maxBadge} aria-hidden>
          <Text style={styles.maxBadgeText}>MAX</Text>
        </View>
      ) : null}
      <UnitIcon name={tile.name} />
      <Text style={styles.tileName} numberOfLines={TILE_NAME_LINES}>
        {tile.name}
      </Text>
      <Text style={styles.tileLevel} numberOfLines={1}>
        {hasMax ? (
          <>
            <Text style={styles.tileLevelCurrent}>{tile.level}</Text>
            <Text style={styles.tileLevelMax}>{`/${tile.maxLevel}`}</Text>
          </>
        ) : (
          `Lv ${tile.level}`
        )}
      </Text>
    </View>
  );
}

// ---------- styles ----------

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    grid: {
      flex: 1,
    },
    list: {
      flex: 1,
    },
    listContent: {
      gap: TILE_GAP,
      paddingBottom: t.spacing[4],
    },

    // village header: the quiet uppercase label the achievements and hero
    // cards already use, with breathing room above the second village
    // group.
    villageHeader: {
      paddingHorizontal: t.spacing[3],
      paddingTop: t.spacing[4],
    },
    villageLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },

    // category header: the label with the count line beside it, the
    // prototype's section head. Baseline-aligned so the count reads as
    // the label's footnote, and wrapping so a narrow card stacks them
    // rather than clipping the count.
    categoryHeader: {
      paddingHorizontal: t.spacing[3],
      paddingTop: t.spacing[3],
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      columnGap: t.spacing[2],
    },
    categoryLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    categoryCount: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },

    // One grid line: the tiles take their measured even width and pack
    // from the left, so a short last line reads as a short line, the way
    // the prototype's auto-fill grid keeps it.
    tileRow: {
      flexDirection: 'row',
      columnGap: TILE_GAP,
      paddingHorizontal: ROW_PADDING,
    },

    // The tile: the quiet fill on the card's glass, a hairline border,
    // everything centered. The name's two-line box is fixed so every
    // tile in a row keeps the same height and the level pairs align.
    tile: {
      position: 'relative',
      alignItems: 'center',
      backgroundColor: c.fillQuiet,
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      borderRadius: t.radius[2],
      paddingHorizontal: t.spacing[1],
      paddingTop: 10,
      paddingBottom: t.spacing[2],
      minHeight: UNIT_ICON_SIZE + 58,
    },
    // The maxed tile's gold-tinted border, the prototype's accent mix:
    // the badge alone says MAX, the border makes the whole tile glow
    // quietly gold.
    tileMaxed: {
      borderColor: c.accent,
    },
    // The MAX badge: it breaks the tile's top-right corner, gold with
    // on-accent ink, the one glance fact the wall carries.
    maxBadge: {
      position: 'absolute',
      top: -7,
      right: -5,
      backgroundColor: c.accent,
      borderRadius: t.radius[1],
      paddingHorizontal: t.spacing[1],
      paddingVertical: 1,
    },
    // The badge's own size: one step under the scale's xs floor, the same
    // recorded one-off the deficit rank circle keeps; a badge is a mark,
    // not text.
    maxBadgeText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 9,
      fontWeight: t.fontWeight.bold,
      letterSpacing: 0.5,
      color: c.textOnAccent,
    },
    tileName: {
      marginTop: t.spacing[1],
      minHeight: 2 * Math.round(t.lineHeight.tight * t.fontSize.xs),
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      lineHeight: Math.round(t.lineHeight.tight * t.fontSize.xs),
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    tileLevel: {
      marginTop: t.spacing[1],
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    tileLevelCurrent: {
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
    },
    tileLevelMax: {
      fontSize: t.fontSize.sm,
      fontWeight: t.fontWeight.regular,
      color: c.textMuted,
    },
  });
}
