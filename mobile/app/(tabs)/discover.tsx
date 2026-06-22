import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '../../components/ProductCard';
import { useProducts } from '../../hooks/useProducts';
import { colors, elevation, shape } from '../../theme/tokens';

const CATS: { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }[] = [
  { label: 'Oyuncak', icon: 'toys', color: '#a8f2cd' },
  { label: 'Kitap', icon: 'menu-book', color: '#ffdbcb' },
  { label: 'Montessori', icon: 'extension', color: '#d3e8d8' },
  { label: 'Kutu oyunu', icon: 'casino', color: '#e2e5dc' },
];

const POPULAR = ['Montessori', 'Ahşap oyuncak', 'Denge oyunu', 'Renk eşleştirme', '0-3 yaş'];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const { products } = useProducts();

  const results = q.trim()
    ? products.filter((p) => p.title.toLowerCase().includes(q.toLowerCase().trim()))
    : products;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Text style={styles.appTitle}>Keşfet</Text>
        <View style={styles.iconBtn}>
          <MaterialIcons name="map" size={24} color={colors.onSurface} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.search}>
          <MaterialIcons name="search" size={24} color={colors.onSurfaceVariant} />
          <TextInput
            style={styles.input}
            placeholder="Oyuncak, kitap, montessori…"
            placeholderTextColor={colors.onSurfaceVariant}
            value={q}
            onChangeText={setQ}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')}>
              <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          )}
        </View>

        {q.trim().length === 0 && (
          <>
            <Text style={styles.secTitle}>Kategoriler</Text>
            <View style={styles.catGrid}>
              {CATS.map((c) => (
                <Pressable key={c.label} style={styles.catCard} onPress={() => setQ(c.label)}>
                  <View style={[styles.catIc, { backgroundColor: c.color }]}>
                    <MaterialIcons name={c.icon} size={24} color={colors.onSurface} />
                  </View>
                  <Text style={styles.catLabel}>{c.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.secTitle}>Popüler aramalar</Text>
            <View style={styles.tags}>
              {POPULAR.map((t) => (
                <Pressable key={t} style={styles.tag} onPress={() => setQ(t)}>
                  <MaterialIcons name="trending-up" size={15} color={colors.primary} />
                  <Text style={styles.tagText}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.secTitle}>{q.trim() ? `"${q.trim()}" sonuçları` : 'Tüm raf'}</Text>
        {results.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="search-off" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {results.map((p) => (
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
  appTitle: { flex: 1, fontSize: 22, fontWeight: '700', paddingLeft: 10, color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: 18,
    ...elevation.level1,
  },
  input: { flex: 1, fontSize: 15, color: colors.onSurface },
  secTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 12, marginTop: 6 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  catCard: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    ...elevation.level1,
  },
  catIc: { width: 44, height: 44, borderRadius: shape.sm, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  tagText: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -7 },
  cell: { width: '50%', paddingHorizontal: 7, marginBottom: 14 },
  empty: { paddingVertical: 36, alignItems: 'center', gap: 8 },
  emptyText: { color: colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
});
