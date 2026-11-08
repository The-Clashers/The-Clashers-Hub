import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import UnitIcon, { UNIT_ICON_SIZE } from './UnitIcon';
import type {
  ProgressionVillageGroup,
  ProgressionTile,
} from '../lib/progression-grid';

// The progression grid (07 section 4 "ProgressionGrid"). Every unit of
// both villages with its icon, current level, and a maxed chip, grouped
// by village and category. The grid renders entirely from the single player
// response the shell already fetched (SR-16): no second call, no second
// loading state, and no network request beyond the player fetch (AC-07).
//
// The grid is virtualized (07 section 3): a real account carries ~100 unit
// tiles across both villages, and rendering them all at once would jank the
// scroll. The FlatList owns the scroll container; village and category
// headers dock sticky so the visitor keeps their place while the tiles
// stream in below.
//
// The tile is the unit of the grid: a 32 px icon slot, the level/maxLevel
// pair, and a maxed chip when level >= maxLevel. The maxed-for-Town-Hall
// chip (the indicator that reads against the bundled TH cap table, not the
// global maximum) lands with T-M2-6; until then, the tile renders the
// global-maximum reading the API already carries. The tile's shape is
// designed so that change is a new field, not a rewrite.

/** The tile's level label width, so the level and the max pair align
 * without the chip guessing at content width. */
const LEVEL_LABEL_WIDTH = 48;

export interface ProgressionGridProps {
  /** The village-grouped, category-blocked tiles from the single player
   * response. Built by lib/progression-grid.ts. */
  groups: ProgressionVillageGroup[];
}

export default function ProgressionGrid({ groups }: ProgressionGridProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Flatten the village > category > tile tree into one list the FlatList
  // can render, with village and category headers as items the list knows
  // to render as section headers rather than tiles. A FlatList renders one
  // flat list, so the tree becomes a row array with header markers.
  const rows = useMemo(() => flattenGroups(groups), [groups]);

  return (
    <View accessibilityRole="grid" accessibilityLabel="Player progression grid" style={styles.grid}>
      <FlatList
        data={rows}
        keyExtractor={(row, index) => rowKey(row, index)}
        renderItem={({ item }) => renderRow(item, styles)}
        initialNumToRender={24}
        maxToRenderPerBatch={24}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
    </View>
  );
}

// ---------- row types ----------

type GridRow =
  | { kind: 'village'; village: string; label: string }
  | { kind: 'category'; label: string }
  | { kind: 'tile'; tile: ProgressionTile };

function flattenGroups(groups: ProgressionVillageGroup[]): GridRow[] {
  const rows: GridRow[] = [];
  for (const group of groups) {
    rows.push({ kind: 'village', village: group.village, label: group.label });
    for (const block of group.categories) {
      rows.push({ kind: 'category', label: block.label });
      for (const tile of block.tiles) {
        rows.push({ kind: 'tile', tile });
      }
    }
  }
  return rows;
}

function rowKey(row: GridRow, index: number): string {
  if (row.kind === 'village') return `village-${row.village}`;
  if (row.kind === 'category') return `category-${index}`;
  return `tile-${row.tile.village}-${row.tile.category}-${row.tile.name}-${index}`;
}

function renderRow(row: GridRow, styles: ReturnType<typeof createStyles>) {
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
      </View>
    );
  }
  return <ProgressionTileRow tile={row.tile} styles={styles} />;
}

// ---------- tile row ----------

interface ProgressionTileRowProps {
  tile: ProgressionTile;
  styles: ReturnType<typeof createStyles>;
}

function ProgressionTileRow({ tile, styles }: ProgressionTileRowProps) {
  const isMaxed = tile.maxLevel !== null && tile.level >= tile.maxLevel;
  const hasMax = tile.maxLevel !== null;
  const levelText = hasMax ? `${tile.level}/${tile.maxLevel}` : `Lv ${tile.level}`;
  const rowLabel = hasMax
    ? `${tile.name}, level ${tile.level} of ${tile.maxLevel}${isMaxed ? ', maxed' : ''}`
    : `${tile.name}, level ${tile.level}`;

  return (
    <View style={styles.tileRow} accessibilityRole="row" accessibilityLabel={rowLabel}>
      <UnitIcon name={tile.name} />
      <Text style={styles.tileName} numberOfLines={1}>
        {tile.name}
      </Text>
      <Text style={styles.tileLevel} numberOfLines={1}>
        {levelText}
      </Text>
      {isMaxed ? (
        <View style={styles.maxedChip} accessibilityLabel="maxed">
          <Text style={styles.maxedChipText}>MAX</Text>
        </View>
      ) : null}
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
      paddingBottom: t.spacing[4],
    },

    // village header: the quiet uppercase label the achievements and hero
    // cards already use, with a hairline above the second village group.
    villageHeader: {
      paddingHorizontal: t.spacing[3],
      paddingTop: t.spacing[4],
      paddingBottom: t.spacing[2],
    },
    villageLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    // category header: quieter still, one step down from the village label.
    categoryHeader: {
      paddingHorizontal: t.spacing[3],
      paddingTop: t.spacing[3],
      paddingBottom: t.spacing[1],
    },
    categoryLabel: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    // tile row: the icon, the name, the level pair, and the maxed chip.
    tileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      paddingHorizontal: t.spacing[3],
      paddingVertical: t.spacing[1],
      minHeight: UNIT_ICON_SIZE + t.spacing[2],
    },
    tileName: {
      flex: 1,
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.sm,
      color: c.textPrimary,
    },
    tileLevel: {
      width: LEVEL_LABEL_WIDTH,
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: c.textSecondary,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    maxedChip: {
      paddingHorizontal: t.spacing[2],
      paddingVertical: t.spacing[1],
      borderRadius: t.radius[1],
      backgroundColor: c.successSoft,
      borderWidth: 1,
      borderColor: c.success,
    },
    maxedChipText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.bold,
      color: c.success,
    },
  });
}
