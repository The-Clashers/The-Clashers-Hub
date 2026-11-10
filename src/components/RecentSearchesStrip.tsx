import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import Glyph from './Glyph';
import {
  clearRecentSearches,
  readRecentSearches,
  removeRecentSearch,
  type RecentSearchItem,
  type SearchKind,
} from '../lib/recent-searches';

export interface RecentSearchesStripProps {
  /** Filter to only show player tags or clan searches. Omitting displays both. */
  kind?: SearchKind;
  /** Custom heading; defaults to 'Recent searches'. */
  title?: string;
  /** Max chips to render. Defaults to 6. */
  maxItems?: number;
  /** Action invoked when a chip is clicked. */
  onSelect: (item: RecentSearchItem) => void;
}

export default function RecentSearchesStrip({
  kind,
  title = 'Recent searches',
  maxItems = 6,
  onSelect,
}: RecentSearchesStripProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [items, setItems] = useState<RecentSearchItem[]>([]);

  const reload = useCallback(() => {
    setItems(readRecentSearches(kind).slice(0, maxItems));
  }, [kind, maxItems]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (items.length === 0) {
    return null;
  }

  const handleClear = () => {
    clearRecentSearches(kind);
    reload();
  };

  const handleRemove = (item: RecentSearchItem) => {
    removeRecentSearch(item.kind, item.query);
    reload();
  };

  return (
    <View style={styles.container} accessibilityRole="region" accessibilityLabel={title}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${title}`}
          onPress={handleClear}
          style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {items.map((item) => (
          <View key={item.id} style={styles.chipWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${item.label ? `${item.label} (${item.query})` : item.query}`}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Glyph
                name={item.kind === 'player' ? 'user' : 'shield'}
                size={13}
                color={theme.colors.accentInk}
              />
              <Text style={styles.chipText} numberOfLines={1}>
                {item.label ? `${item.label}` : item.query}
              </Text>
              {item.label ? (
                <Text style={styles.chipSubText} numberOfLines={1}>
                  {item.query}
                </Text>
              ) : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.query} from recent`}
              onPress={() => handleRemove(item)}
              style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
            >
              <Text style={styles.removeText} aria-hidden>
                {'\u00D7'}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    container: {
      gap: t.spacing[2],
      marginTop: t.spacing[3],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    clearButton: {
      paddingHorizontal: t.spacing[2],
      paddingVertical: 2,
      borderRadius: t.radius[1],
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    clearButtonPressed: {
      backgroundColor: c.fillQuiet,
    },
    clearText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      fontWeight: t.fontWeight.medium,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[2],
    },
    chipWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: t.radius.pill,
      backgroundColor: c.panelRaised,
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderTopColor: c.panelHighlight,
      overflow: 'hidden',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing[2],
      paddingVertical: t.spacing[1],
      paddingLeft: t.spacing[3],
      paddingRight: t.spacing[2],
      minHeight: 30,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    chipPressed: {
      backgroundColor: c.accentSoft,
    },
    chipText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.textPrimary,
      maxWidth: 140,
    },
    chipSubText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      maxWidth: 90,
    },
    removeButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: t.spacing[2],
      height: 30,
      borderLeftWidth: 1,
      borderLeftColor: c.hairline,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    removeButtonPressed: {
      backgroundColor: c.fillQuiet,
    },
    removeText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 14,
      lineHeight: 14,
      color: c.textMuted,
      fontWeight: t.fontWeight.bold,
    },
  });
}
