import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, shape } from '../theme/tokens';

const ADDRESSES = [
  { id: 1, label: 'Ev', name: 'Emrah Atabek', line: 'Caferağa Mah. Moda Cad. No:12 D:4, Kadıköy / İstanbul', phone: '0532 *** ** 41', default: true },
  { id: 2, label: 'İş', name: 'Emrah Atabek', line: 'Levent Mah. Büyükdere Cad. No:185, Şişli / İstanbul', phone: '0532 *** ** 41', default: false },
];

export default function Addresses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Adreslerim & kargo</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {ADDRESSES.map((a) => (
          <View key={a.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.labelChip}>
                <MaterialIcons name={a.label === 'Ev' ? 'home' : 'work'} size={14} color={colors.onSecondaryContainer} />
                <Text style={styles.labelText}>{a.label}</Text>
              </View>
              {a.default && (
                <View style={styles.defaultChip}>
                  <Text style={styles.defaultText}>Varsayılan</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <MaterialIcons name="edit" size={20} color={colors.onSurfaceVariant} />
            </View>
            <Text style={styles.name}>{a.name}</Text>
            <Text style={styles.line}>{a.line}</Text>
            <Text style={styles.phone}>{a.phone}</Text>
          </View>
        ))}

        <Pressable style={styles.addBtn}>
          <MaterialIcons name="add-location-alt" size={20} color={colors.primary} />
          <Text style={styles.addText}>Yeni adres ekle</Text>
        </Pressable>

        <View style={styles.note}>
          <MaterialIcons name="local-shipping" size={18} color={colors.primary} />
          <Text style={styles.noteText}>
            Kargo, takas onaylanınca varsayılan adresine planlanır. Anlaşmalı kargo ile gönderim tek tıkla yapılır.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surfaceContainerLow, borderRadius: shape.md, padding: 16, marginBottom: 12, ...elevation.level1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  labelChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: shape.full, backgroundColor: colors.secondaryContainer },
  labelText: { fontSize: 12, fontWeight: '700', color: colors.onSecondaryContainer },
  defaultChip: { height: 26, paddingHorizontal: 10, borderRadius: shape.full, backgroundColor: colors.primaryContainer, justifyContent: 'center' },
  defaultText: { fontSize: 11, fontWeight: '700', color: colors.onPrimaryContainer },
  name: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  line: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 19, marginTop: 4 },
  phone: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 6 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: shape.full,
    borderWidth: 1,
    borderColor: colors.outline,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: shape.md, backgroundColor: colors.primaryContainer, marginTop: 18 },
  noteText: { flex: 1, fontSize: 12.5, color: colors.onPrimaryContainer, fontWeight: '500', lineHeight: 18 },
});
