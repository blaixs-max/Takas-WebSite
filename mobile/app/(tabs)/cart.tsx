import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Diamond } from '../../components/brand/Diamond';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BosDurum } from '../../components/BosDurum';
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
  /* Sepet bir hatırlatma listesi: takas ürün sayfasından, ürün başına
     başlatılır (adres seçimi ve bakiye kontrolü sunucuda). Eskiden burada
     sabit bir "demo bakiye" (1260) ve hiçbir şey yapmayan bir "Takas et"
     düğmesi vardı — 2026-09-13 denetiminde bulundu. */

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
        <BosDurum
          ikon="shopping-cart"
          baslik="Takas sepetin boş"
          metin="Beğendiğin ürünleri sepete ekle, hazır olduğunda takası başlat."
          cta="Ürünleri keşfet"
          onCta={() => router.push('/')}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.hint}>
              <MaterialIcons name="info-outline" size={13} color={colors.onSurfaceVariant} /> Her ürün kendi
              sayfasından ayrı bir takas olarak başlatılır; kargoyu satıcı gönderir, Takas Puanın Güvenli
              Havuz’da bekler.
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
                  <View style={styles.ptsSatir}>
                    <View style={styles.pts}>
                      <Diamond size={13} color={colors.onPrimaryContainer} />
                      <Text style={styles.ptsText}>{p.points} puan</Text>
                    </View>
                    <Pressable
                      style={styles.git}
                      onPress={() => router.push(`/product/${p.id}`)}
                      accessibilityLabel={`${p.title} için takasa git`}
                    >
                      <Text style={styles.gitText}>Takasa git</Text>
                      <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                    </Pressable>
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
            <Text style={styles.balLabel}>
              Bakiyen Cüzdan ekranında; bir takas başlatırken sunucu yeterli puan olup olmadığına bakar.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 18 },
  appTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.onSurface },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  clearText: { color: colors.error, fontWeight: '700', fontSize: 13 },
  hint: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 18, marginBottom: 14 },
  item: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: shape.md, backgroundColor: colors.surfaceContainerLow, marginBottom: 12, ...elevation.level1 },
  img: { width: 76, height: 76, borderRadius: shape.sm },
  title: { fontSize: 14, fontWeight: '600', color: colors.onSurface, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  metaText: { fontSize: 11.5, color: colors.onSurfaceVariant, fontWeight: '500' },
  pts: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8, height: 26, paddingHorizontal: 10, borderRadius: shape.xs, backgroundColor: colors.primaryContainer },
  ptsText: { fontWeight: '800', fontSize: 12, color: colors.onPrimaryContainer },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  ptsSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  git: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingLeft: 8 },
  gitText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceContainer, paddingHorizontal: 18, paddingTop: 14, gap: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  sumValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  balLabel: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant, lineHeight: 17 },
});
