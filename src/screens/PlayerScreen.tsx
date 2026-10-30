import { StyleSheet, Text, View } from 'react-native';
import { useParams } from 'react-router';
import { canonicalTagFromRoute } from '../lib/tag';

// The player detail stub (T-M2-1 replaces it). The route param carries the
// bare tag (shareable URLs carry no `#`, see src/lib/tag.ts); the stub
// canonicalizes it back through the tag module so the screen already shows
// the `#TAG` form the real screen will fetch and display.
export default function PlayerScreen() {
  const { tag } = useParams();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Player {canonicalTagFromRoute(tag ?? '')}</Text>
      <Text style={styles.subtitle}>
        Rushed analysis, progression grid and achievements land here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.7,
    textAlign: 'center',
  },
});
