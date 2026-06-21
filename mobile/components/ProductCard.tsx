import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Product } from '../data/products';
import { colors, elevation, shape } from '../theme/tokens';

/** v2 ürün kartı — kondisyon rozeti, favori, puan pill'i + satıcı avatarı. */
export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.media}>
          <Image source={product.image} style={styles.img} resizeMode="cover" />
          <View style={styles.cond}>
            <Text style={styles.condText}>{product.condition}</Text>
          </View>
          <View style={styles.fav}>
            <MaterialIcons
              name={product.favorite ? 'favorite' : 'favorite-border'}
              size={19}
              color={product.favorite ? colors.tertiary : colors.onSurface}
            />
          </View>
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
              <MaterialIcons name="paid" size={16} color={colors.onPrimaryContainer} />
              <Text style={styles.ptsText}>{product.points}</Text>
            </View>
            <View style={styles.av}>
              <Text style={styles.avText}>{product.seller.initials}</Text>
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
