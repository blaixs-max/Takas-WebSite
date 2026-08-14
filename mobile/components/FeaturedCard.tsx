import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Diamond } from './brand/Diamond';
import { Link } from 'expo-router';
import { Product } from '../data/products';
import { useFavorites } from '../lib/favorites';
import { KART_GENISLIGI, kartStilleri } from './ProductCard';
import { colors, shape } from '../theme/tokens';

/**
 * Öne çıkanlar şeridindeki kart.
 *
 * Eskiden bambaşka bir kart dili vardı: fotoğrafın üstüne siyah gradyan perde,
 * beyaz başlık, koyu zeminde puan hapı. Tasarımda öne çıkan kartlarla rafın
 * kartları **birebir aynı**: aynı genişlik, aynı görsel oranı, aynı alt satır.
 * Tek farkları rozet taşımaları. Bu yüzden stiller `ProductCard`'tan geliyor —
 * iki dosyada iki kez ölçü tutmak, ilk değişiklikte ayrışmaları demekti.
 *
 * Genişlik de rafla aynı (172 pt): bir tur boyunca 214 pt idi ve şeritte ikinci
 * kart ekranın kenarından taşıyordu; tasarımda iki kart tam oturuyor.
 */
export function FeaturedCard({ product }: { product: Product }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(product.id);
  const editor = product.badge === 'Editör seçimi';

  return (
    <Link href={`/product/${product.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.media}>
          <Image source={product.image} style={styles.img} resizeMode="cover" />

          {/* Rozet, rafın kartındaki durum çipiyle aynı yuvada duruyor: iki
              kart yan yana geldiğinde göz aynı köşede aynı boyda bir hap
              görüyor, yalnızca içeriği değişiyor. */}
          <View style={styles.rozet}>
            <MaterialIcons
              name={editor ? 'star' : 'local-fire-department'}
              size={12}
              color={colors.tertiaryOn}
            />
            <Text style={styles.rozetText}>{product.badge}</Text>
          </View>
        </View>

        <View style={styles.govde}>
          <Text style={styles.baslik} numberOfLines={2}>
            {product.title}
          </Text>
          <View style={styles.meta}>
            <MaterialIcons name="location-on" size={12} color={colors.onSurfaceVariant} />
            <Text style={styles.metaText} numberOfLines={1}>
              {product.location}
            </Text>
          </View>
          <View style={styles.alt}>
            <View style={styles.puan}>
              <Diamond size={11} color={colors.primary} />
              <Text style={styles.puanText}>{product.points} Takas Puanı</Text>
            </View>
            <Pressable style={styles.fav} onPress={() => toggle(product.id)} hitSlop={10}>
              <MaterialIcons
                name={fav ? 'favorite' : 'favorite-border'}
                size={15}
                color={fav ? colors.tertiaryOn : colors.onSurfaceVariant}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  ...kartStilleri,
  card: { ...kartStilleri.card, width: KART_GENISLIGI },
  rozet: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 23,
    paddingHorizontal: 9,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  rozetText: { fontSize: 10, fontWeight: '800', color: colors.onSurface },
});
