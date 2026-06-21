import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shape } from '../../theme/tokens';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>EA</Text>
      </View>
      <Text style={styles.name}>Emrah Atabek</Text>
      <View style={styles.trust}>
        <MaterialIcons name="workspace-premium" size={16} color={colors.tertiary} />
        <Text style={styles.trustText}>Güven skoru 96 · 38 takas</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', gap: 10, backgroundColor: colors.surface, padding: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: shape.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: colors.onSecondaryContainer },
  name: { fontSize: 22, fontWeight: '700', color: colors.onSurface, marginTop: 6 },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '600' },
});
