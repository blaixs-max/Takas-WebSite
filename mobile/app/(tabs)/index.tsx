import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '../../components/ProductCard';
import { products } from '../../data/products';
import { colors, elevation, shape } from '../../theme/tokens';

const FILTERS = ['Tümü', 'Oyuncak', 'Kitap', 'Montessori', 'Kutu oyunu'] as const;

export default function ShelfScreen() {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<string>('Tümü');

  const visible =
    active === 'Tümü' ? products : products.filter((p) => p.category === active);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* M3 top app bar */}
      <View style={styles.appbar}>
        <Text style={styles.appTitle}>Takas Rafı</Text>
        <Pressable style={styles.iconBtn}>
          <MaterialIcons name="tune" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable style={styles.iconBtn}>
          <MaterialIcons name="notifications-none" size={24} color={colors.onSurface} />
          <View style={styles.dot}>
            <Text style={styles.dotText}>3</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* M3 search bar */}
        <View style={styles.search}>
          <MaterialIcons name="search" size={24} color={colors.onSurfaceVariant} />
          <TextInput
            placeholder="Oyuncak, kitap, montessori…"
            placeholderTextColor={colors.onSurfaceVariant}
            style={styles.searchInput}
          />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>EA</Text>
          </View>
        </View>

        {/* M3 filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map((f) => {
            const sel = f === active;
            return (
              <Pressable
                key={f}
                onPress={() => setActive(f)}
                style={[styles.chip, sel && styles.chipSel]}
              >
                {sel && (
                  <MaterialIcons name="check" size={18} color={colors.onSecondaryContainer} />
                )}
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Ürün ızgarası (2 sütun) */}
        <View style={styles.grid}>
          {visible.map((p) => (
            <View key={p.id} style={styles.cell}>
              <ProductCard product={p} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* M3 Extended FAB */}
      <Pressable style={styles.fab}>
        <MaterialIcons name="add-a-photo" size={22} color={colors.onTertiaryContainer} />
        <Text style={styles.fabText}>Ürün ekle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: 6,
  },
  appTitle: { flex: 1, fontSize: 22, fontWeight: '700', paddingLeft: 10, color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: shape.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: shape.xl,
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.onSurface },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: shape.full,
    backgroundColor: colors.tertiaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', fontSize: 13, color: colors.onTertiaryContainer },
  chips: { gap: 8, paddingBottom: 4, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: shape.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipSel: { backgroundColor: colors.secondaryContainer, borderColor: 'transparent' },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  chipTextSel: { color: colors.onSecondaryContainer },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, marginHorizontal: -7 },
  cell: { width: '50%', paddingHorizontal: 7, marginBottom: 14 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: shape.md,
    backgroundColor: colors.tertiaryContainer,
    ...elevation.level3,
  },
  fabText: { fontWeight: '700', fontSize: 15, color: colors.onTertiaryContainer },
});
