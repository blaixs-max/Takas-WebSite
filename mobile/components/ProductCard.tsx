import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Diamond } from './brand/Diamond';
import { Link } from 'expo-router';
import { Product } from '../data/products';
import { useFavorites } from '../lib/favorites';
import { colors, elevation, shape } from '../theme/tokens';

/** v2 ürün kartı — kondisyon rozeti, favori, puan pill'i + satıcı avatarı. */
export function ProductCard({ product }: { product: Product }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(product.id);
  return (
    <Link href={`/product/${product.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.media}>
          <Image source={product.image} style={styles.img} resizeMode="cover" />
          <View style={styles.cond}>
            <Text style={styles.condText}>{product.condition}</Text>
          </View>
          {/* Hasar beyanı kapakta.
              `products.has_damage` `product_photos` göçünden beri var ve
              yedinci kareyi zorunlu yapıyor, ama arayüze hiç çıkmıyordu:
              alıcı hasarı ancak ilanı açıp yedinci kareye bakınca görüyordu.
              İkinci el üründe en çok merak edilen şeyin kartta olmaması,
              kusuru saklamak gibi okunuyor. Rozet uyarı değil bilgi — beyan
              edilmiş olması iyi bir şey; gizlenmiş olması kötü olurdu. */}
          {product.hasDamage && (
            <View style={styles.hasar}>
              <MaterialIcons name="report-problem" size={12} color={colors.onTertiaryContainer} />
              <Text style={styles.hasarText}>Hasar beyanlı</Text>
            </View>
          )}
          <Pressable style={styles.fav} onPress={() => toggle(product.id)} hitSlop={8}>
            <MaterialIcons
              name={fav ? 'favorite' : 'favorite-border'}
              size={19}
              color={fav ? colors.tertiary : colors.onSurface}
            />
          </Pressable>
        </View>
        <View style={styles.pc}>
          <Text style={styles.tt} numberOfLines={2}>
            {product.title}
          </Text>
          <View style={styles.meta}>
            <MaterialIcons name="location-on" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.metaText}>{product.location}</Text>
            <View style={styles.dot} />
            <Text style={styles.metaText}>★ {product.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.foot}>
            <View style={styles.pts}>
              <Diamond size={14} color={colors.onPrimaryContainer} />
              <Text style={styles.ptsText}>{product.points}</Text>
            </View>
            <View style={styles.satici}>
              {/* Skor yalnızca satıcı en az bir takas tamamladıysa görünüyor.
                  `products.seller_trust` varsayılanı 90; hiç takas yapmamış
                  birinde 90 göstermek, profil ekranının "Güven skoru henüz
                  oluşmadı" demesiyle çelişirdi ve kazanılmamış bir sayıyı
                  kazanılmış gibi sunardı. */}
              {product.seller.trades > 0 && (
                <View style={styles.guven}>
                  <MaterialIcons name="verified-user" size={11} color={colors.primary} />
                  <Text style={styles.guvenText}>{product.seller.trust}</Text>
                </View>
              )}
              <View style={styles.av}>
                <Text style={styles.avText}>{product.seller.initials}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.md,
    overflow: 'hidden',
    ...elevation.level1,
  },
  media: { aspectRatio: 1, backgroundColor: colors.surfaceContainerHighest },
  img: { width: '100%', height: '100%' },
  cond: {
    position: 'absolute',
    left: 8,
    top: 8,
    height: 25,
    paddingHorizontal: 9,
    borderRadius: shape.xs,
    backgroundColor: 'rgba(255,255,255,0.94)',
    justifyContent: 'center',
    ...elevation.level1,
  },
  condText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
  hasar: {
    position: 'absolute',
    left: 8,
    top: 39,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 23,
    paddingHorizontal: 8,
    borderRadius: shape.xs,
    backgroundColor: colors.tertiaryContainer,
    ...elevation.level1,
  },
  hasarText: { fontSize: 10.5, fontWeight: '800', color: colors.onTertiaryContainer },
  satici: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  guven: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  guvenText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  fav: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 34,
    height: 34,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.level1,
  },
  pc: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 13 },
  tt: { fontSize: 13.5, fontWeight: '600', lineHeight: 17, color: colors.onSurface, minHeight: 34 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  metaText: { fontSize: 11.5, color: colors.onSurfaceVariant, fontWeight: '500' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.outline },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  pts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: shape.xs,
    backgroundColor: colors.primaryContainer,
  },
  ptsText: { fontWeight: '800', fontSize: 13, color: colors.onPrimaryContainer },
  av: {
    width: 24,
    height: 24,
    borderRadius: shape.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avText: { fontSize: 10, fontWeight: '800', color: colors.onSecondaryContainer },
});
