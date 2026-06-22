import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../lib/cart';
import { useProducts } from '../../hooks/useProducts';
import { colors, elevation, shape } from '../../theme/tokens';

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ids, remove, clear, count } = useCart();
  const { products } = useProducts();

  const items = products.filter((p) => ids.includes(p.id));
  const total = items.reduce((s, p) => s + p.points, 0);
  const balance = 1260; // demo cüzdan bakiyesi
  const enough = balance >= total;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Text style={styles.appTitle}>Sepetim</Text>
        {count > 0 && (
          <Pressable onPress={clear} style={styles.clearBtn}>
            <Text style={styles.clearText}>Temizle</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIc}>
            <MaterialIcons name="shopping-cart" size={36} color={colors.onSurfaceVariant} />
          </View>
          <Text style={styles.emptyTitle}>Sepetin boş</Text>
          <Text style={styles.emptySub}>Beğendiğin ürünleri sepete ekle, hepsini birden takasa gönder.</Text>
          <Pressable style={styles.browse} onPress={() => router.push('/')}>
            <MaterialIcons name="storefront" size={20} color="#fff" />
            <Text style={styles.browseText}>Rafa göz at</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.hint}>
              <MaterialIcons name="info-outline" size={13} color={colors.onSurfaceVariant} /> Her ürün ayrı takas + kargo
              olarak işlenir; puanların güvenli havuzda bekler.
            </Text>
            {items.map((p) => (
              <View key={p.id} style={styles.item}>
                <Image source={p.image} style={styles.img} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={2}>
                    {p.title}
                  </Text>
                  <View style={styles.meta}>
                    <MaterialIcons name="location-on" size={14} color={colors.onSurfaceVariant} />
                    <Text style={styles.metaText}>
                      {p.location} · {p.seller.name}
                    </Text>
                  </View>
                  <View style={styles.pts}>
                    <MaterialIcons name="paid" size={15} color={colors.onPrimaryContainer} />
                    <Text style={styles.ptsText}>{p.points} puan</Text>
                  </View>
                </View>
                <Pressable onPress={() => remove(p.id)} style={styles.remove} hitSlop={8}>
                  <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 90 }]}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{count} ürün toplamı</Text>
              <Text style={styles.sumValue}>{fmt(total)} puan</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.balLabel}>Cüzdan bakiyen</Text>
              <Text style={[styles.balValue, !enough && { color: colors.error }]}>{fmt(balance)} puan</Text>
            </View>
            <Pressable
              style={[styles.cta, !enough && styles.ctaDisabled]}
              disabled={!enough}
              onPress={() => router.push('/trades')}
            >
              <MaterialIcons name="swap-horiz" size={20} color="#fff" />
              <Text style={styles.ctaText}>{enough ? `Takas et · ${fmt(total)} puan` : 'Yetersiz bakiye'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 18 },
  appTitle: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.onSurface },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  clearText: { color: colors.error, fontWeight: '700', fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, marginBottom: 60 },
  emptyIc: { width: 80, height: 80, borderRadius: shape.full, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginTop: 4 },
  emptySub: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
  browse: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 22, borderRadius: shape.full, backgroundColor: colors.primary, marginTop: 10 },
  browseText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 18, marginBottom: 14 },
  item: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: shape.md, backgroundColor: colors.surfaceContainerLow, marginBottom: 12, ...elevation.level1 },
  img: { width: 76, height: 76, borderRadius: shape.sm },
  title: { fontSize: 14, fontWeight: '600', color: colors.onSurface, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  metaText: { fontSize: 11.5, color: colors.onSurfaceVariant, fontWeight: '500' },
  pts: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8, height: 26, paddingHorizontal: 10, borderRadius: shape.xs, backgroundColor: colors.primaryContainer },
  ptsText: { fontWeight: '800', fontSize: 12, color: colors.onPrimaryContainer },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceContainer, paddingHorizontal: 18, paddingTop: 14, gap: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  sumValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  balLabel: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant },
  balValue: { fontSize: 13, fontWeight: '700', color: colors.onSurfaceVariant },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: shape.full, backgroundColor: colors.primary, marginTop: 8, ...elevation.level1 },
  ctaDisabled: { backgroundColor: colors.outline },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
