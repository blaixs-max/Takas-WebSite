import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Diamond } from './brand/Diamond';
import { Link } from 'expo-router';
import { Product } from '../data/products';
import { useFavorites } from '../lib/favorites';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Ürün kartı — yeni UI tasarımı.
 *
 * Ölçüler `tasarim/yeni ekran UI'ları/08_04_Anasayfa.png` üzerinden piksel
 * piksel okundu (tasarım 739×1600 = 390×844 @1.895):
 *
 * | Öğe | Tasarım |
 * |---|---|
 * | sayfa kenarı · kart arası | 18 pt · 10 pt → kart 172 pt |
 * | görsel | kart genişliği, yükseklik 114 pt → oran ~1.5 |
 * | gövde iç boşluğu | 12 pt, alt 10 pt |
 * | puan hapı | y 22 pt, zemin `#DDF5F8`, metin `#006F84` |
 * | kalp | 26 pt daire, zemin `#F3EBDD`, **alt satırın sağında** |
 *
 * ## Tasarımdan sapılan yerler
 *
 * Tasarımın kartı sade: görsel + durum çipi + başlık + konum + (puan hapı,
 * kalp). Bizde iki bilgi fazladan var ve ikisi de kalıyor:
 *
 * - **Hasar beyanı** görselde, durum çipinin altında. İkinci el üründe en çok
 *   merak edilen bilgi; kartı açmadan görünmeli.
 * - **Güven skoru** konum satırının devamında, ayraçtan sonra. Kendi satırını
 *   istemiyor, yani kart uzamıyor.
 *
 * **Satıcı avatarı kaldırıldı.** Bir tur boyunca alt satırda, puan hapının
 * karşısında durdu; hap + avatar + kalp üçlüsü 172 pt'lik karta sığmadı ve
 * "420 Takas P…" diye kesildi. Tasarımın alt satırında tam olarak iki öğe var,
 * kart da ona göre ölçülmüş. Baş harfler kartta kimseye bir şey söylemiyordu
 * zaten — satıcı kimliği ürün detayındaki satıcı satırında, adıyla duruyor.
 */
export function ProductCard({ product }: { product: Product }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(product.id);
  /* Skor yalnızca hak edilmişse: `seller_trust` varsayılanı 90 ve hiç takas
     yapmamış birinde 90 göstermek, profildeki "güven skorun henüz oluşmadı"
     ile çelişirdi. */
  const skorVar = product.seller.trades > 0;

  return (
    <Link href={`/product/${product.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.media}>
          <Image source={product.image} style={styles.img} resizeMode="cover" />

          <View style={styles.cond}>
            <Text style={styles.condText}>{product.condition}</Text>
          </View>

          {product.hasDamage && (
            <View style={styles.hasar}>
              <MaterialIcons name="report-problem" size={11} color={colors.onTertiaryContainer} />
              <Text style={styles.hasarText}>Hasar beyanlı</Text>
            </View>
          )}
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
            {skorVar && (
              <>
                <Text style={styles.metaAyrac}>·</Text>
                <MaterialIcons name="verified-user" size={11} color={colors.primary} />
                <Text style={styles.skorText}>{product.seller.trust}</Text>
              </>
            )}
          </View>

          <View style={styles.alt}>
            <View style={styles.puan}>
              <Diamond size={11} color={colors.primary} />
              <Text style={styles.puanText} numberOfLines={1}>
                {product.points} Takas Puanı
              </Text>
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

/**
 * Kart genişliği. Raf ızgarası kartı esnetiyor (`flex: 1`), öne çıkanlar şeridi
 * yatay kaydığı için esneyemiyor ve sayıyı buradan alıyor — ikisi aynı kalsın
 * diye tek yerde: 390 − 2×18 kenar − 10 boşluk, ikiye bölünmüş.
 */
export const KART_GENISLIGI = 172;

/** Kart gövdesi iki kart tipinde de aynı — öne çıkanlar şeridi de bunu kullanır. */
export const kartStilleri = StyleSheet.create({
  card: {
    borderRadius: shape.lg,
    backgroundColor: colors.surfaceContainerLowest,
    overflow: 'hidden',
    ...elevation.level1,
  },
  media: { aspectRatio: 1.5, backgroundColor: colors.surfaceContainerHigh },
  img: { width: '100%', height: '100%' },

  /* Görselin üstündeki hapların zemini yarı saydam beyaz: fotoğraf koyu da
     olsa açık da olsa metin okunuyor, tam beyaz gibi de kesip atmıyor. */
  cond: {
    position: 'absolute',
    left: 8,
    top: 8,
    height: 23,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
  },
  condText: { fontSize: 10, fontWeight: '700', color: colors.onSurface },

  hasar: {
    position: 'absolute',
    left: 8,
    top: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 21,
    paddingHorizontal: 7,
    borderRadius: shape.full,
    backgroundColor: colors.tertiaryContainer,
  },
  hasarText: { fontSize: 9.5, fontWeight: '800', color: colors.onTertiaryContainer },

  govde: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, gap: 5 },
  baslik: { fontSize: 12.5, fontWeight: '800', color: colors.onSurface, lineHeight: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10.5, color: colors.onSurfaceVariant, fontWeight: '500', flexShrink: 1 },
  metaAyrac: { fontSize: 10.5, color: colors.onSurfaceVariant, marginHorizontal: 1 },
  skorText: { fontSize: 10.5, color: colors.primary, fontWeight: '700' },

  alt: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  /* Hap içeriği kadar geniş (tasarımda da öyle), kalan boşluk kalbi sağa
     itiyor. `flex: 1` verilseydi hap kartı doldurur, kalp yapışırdı. */
  puan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 9,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
  },
  puanText: { fontSize: 9.5, fontWeight: '800', color: colors.primary },
  fav: {
    marginLeft: 'auto',
    width: 26,
    height: 26,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  ...kartStilleri,
  card: { ...kartStilleri.card, flex: 1 },
});
