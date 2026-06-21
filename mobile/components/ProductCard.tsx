import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Product } from '../data/products';
import { colors, elevation, shape } from '../theme/tokens';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.media}>
          <Image source={product.image} style={styles.img} resizeMode="cover" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.condition}</Text>
          </View>
          <View style={styles.fav}>
            <MaterialIcons
              name={product.favorite ? 'favorite' : 'favorite-border'}
              size={19}
              color={product.favorite ? colors.tertiary : colors.onSurface}
            />
          </View>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {product.title}
          </Text>
          <View style={styles.meta}>
            <MaterialIcons name="location-on" size={15} color={colors.onSurfaceVariant} />
            <Text style={styles.metaText}>
              {product.location} · ★ {product.rating.toFixed(1)}
            </Text>
          </View>
          <View style={styles.points}>
            <MaterialIcons name="paid" size={16} color={colors.onPrimaryContainer} />
            <Text style={styles.pointsText}>{product.points} puan</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: shape.md,
    overflow: 'hidden',
    ...elevation.level1,
  },
  media: { aspectRatio: 1, backgroundColor: colors.surfaceContainerHighest },
  img: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: shape.xs,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
  fav: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 34,
    height: 34,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 12 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 18, color: colors.onSurface },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500' },
  points: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 10,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: shape.xs,
    backgroundColor: colors.primaryContainer,
  },
  pointsText: { fontWeight: '700', fontSize: 13, color: colors.onPrimaryContainer },
});
