import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <MaterialIcons name="explore" size={48} color={colors.primary} />
      <Text style={styles.title}>Keşfet</Text>
      <Text style={styles.sub}>Sana yakın takaslar ve önerilen raflar yakında.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.surface, padding: 32 },
  title: { fontSize: 22, fontWeight: '700', color: colors.onSurface },
  sub: { fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center', fontWeight: '500' },
});
