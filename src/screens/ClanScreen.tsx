import { StyleSheet, Text, View } from 'react-native';
import { useParams } from 'react-router';

export default function ClanScreen() {
  const { tag } = useParams();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Clan {tag}</Text>
      <Text style={styles.subtitle}>Roster, war and log land here.</Text>
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
  },
});
