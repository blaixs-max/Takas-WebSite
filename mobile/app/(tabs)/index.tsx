import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ProductCard } from '../../components/ProductCard';
import { FeaturedCard } from '../../components/FeaturedCard';
import { CATEGORIES, CATEGORY_ICONS } from '../../data/categories';
import { useProducts } from '../../hooks/useProducts';
import { colors, elevation, shape } from '../../theme/tokens';

const FILTERS: { label: string; icon?: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: 'Tümü', icon: 'apps' },
  ...CATEGORIES.map((c) => ({ label: c, icon: CATEGORY_ICONS[c] })),
];

export default function ShelfScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [active, setActive] = useState('Tümü');
  const [q, setQ] = useState('');
  const { products, featured, loading, refreshing, refresh } = useProducts();

  const query = q.toLowerCase().trim();
  const visible = products.filter(
    (p) =>
      (active === 'Tümü' || p.category === active) &&
      (!query || p.title.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Kişiselleştirilmiş app bar */}
      <View style={styles.appbar}>
        <View style={{ flex: 1, paddingLeft: 10 }}>
          <Text style={styles.greeting}>Merhaba, Emrah</Text>
          <Text style={styles.sub}>Kadıköy · 1.248 ürün takasta</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => router.push('/notifications')}>
          <MaterialIcons name="notifications-none" size={24} color={colors.onSurface} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Arama */}
        <View style={styles.searchWrap}>
          <View style={styles.search}>
            <MaterialIcons name="search" size={24} color={colors.onSurfaceVariant} />
            <TextInput
              placeholder="Oyuncak, kitap, montessori…"
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
            />
            {q.length > 0 ? (
              <Pressable onPress={() => setQ('')}>
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            ) : (
              <MaterialIcons name="mic" size={24} color={colors.onSurfaceVariant} />
            )}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>EA</Text>
            </View>
          </View>
        </View>

        {/* Filtre chip'leri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map((f) => {
            const sel = f.label === active;
            return (
              <Pressable
                key={f.label}
                onPress={() => setActive(f.label)}
                style={[styles.chip, sel && styles.chipSel]}
              >
                {f.icon && (
                  <MaterialIcons
                    name={f.icon}
                    size={18}
                    color={sel ? colors.onSecondaryContainer : colors.onSurfaceVariant}
                  />
                )}
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Öne çıkanlar */}
        <View style={styles.sec}>
          <Text style={styles.secTitle}>Öne çıkan takaslar</Text>
          <Text style={styles.secLink}>Tümü</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {featured.map((p) => (
            <FeaturedCard key={p.id} product={p} />
          ))}
        </ScrollView>

        {/* Yakındaki raflar */}
        <View style={styles.sec}>
          <Text style={styles.secTitle}>Yakınındaki raflar</Text>
          <Text style={styles.secLink}>Harita</Text>
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.grid}>
            {visible.map((p) => (
              <View key={p.id} style={styles.cell}>
                <ProductCard product={p} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  greeting: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: colors.onSurface },
  sub: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 1 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: shape.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  searchWrap: { paddingHorizontal: 18, marginTop: 6, marginBottom: 16 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHigh,
    ...elevation.level1,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.onSurface },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: shape.full,
    backgroundColor: colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chips: { gap: 8, paddingHorizontal: 18, paddingBottom: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: shape.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipSel: { backgroundColor: colors.secondaryContainer, borderColor: 'transparent' },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  chipTextSel: { color: colors.onSecondaryContainer, fontWeight: '700' },
  sec: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 12,
  },
  secTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: colors.onSurface },
  secLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  carousel: { gap: 14, paddingHorizontal: 18 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 11 },
  cell: { width: '50%', paddingHorizontal: 7, marginBottom: 14 },
  fab: {
    position: 'absolute',
    right: 18,
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
