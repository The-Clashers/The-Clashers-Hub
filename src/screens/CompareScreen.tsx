import { StyleSheet, Text, View } from 'react-native';

export default function CompareScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Compare</Text>
      <Text style={styles.subtitle}>
        Player vs player and clan vs clan land here.
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
