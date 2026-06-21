import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Product } from '../data/products';
import { colors, elevation, shape } from '../theme/tokens';

/** Öne çıkanlar yatay carousel kartı. */
export function FeaturedCard({ product }: { product: Product }) {
  const isEditor = product.badge === 'Editör seçimi';
  return (
    <Link href={`/product/${product.id}`} asChild>
      <Pressable style={styles.feat}>
        <Image source={product.image} style={styles.img} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
          locations={[0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.tag}>
          <MaterialIcons
            name={isEditor ? 'star' : 'local-fire-department'}
            size={15}
            color={colors.tertiary}
          />
          <Text style={styles.tagText}>{product.badge}</Text>
        </View>
        <View style={styles.cap}>
          <Text style={styles.capTitle} numberOfLines={1}>
            {product.title}
          </Text>
          <View style={styles.pts}>
            <MaterialIcons name="paid" size={15} color={colors.onPrimaryContainer} />
            <Text style={styles.ptsText}>{product.points} puan</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  feat: {
    width: 252,
    height: 184,
    borderRadius: shape.lg,
    overflow: 'hidden',
    ...elevation.level2,
  },
  img: { width: '100%', height: '100%' },
  tag: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  tagText: { fontSize: 11, fontWeight: '800', color: colors.onSurface },
  cap: { position: 'absolute', left: 14, right: 14, bottom: 13 },
  capTitle: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  pts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
  },
  ptsText: { fontSize: 12, fontWeight: '800', color: colors.onPrimaryContainer },
});
