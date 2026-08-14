import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { uyar } from '../../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProduct } from '../../hooks/useProducts';
import { useFavorites } from '../../lib/favorites';
import { useCart } from '../../lib/cart';
import { shareProduct } from '../../lib/share';
import { startTrade, quotePrice } from '../../lib/trades';
import { startConversation } from '../../lib/messages';
import { useAuth } from '../../lib/auth';
import { colors, elevation, shape } from '../../theme/tokens';

const { width: EKRAN_W, height: EKRAN_H } = Dimensions.get('window');
/**
 * Galerinin başlangıç genişliği: ekran eksi ScrollView'ün 18'lik yan
 * boşlukları. Yatay ScrollView içinde yüzde genişlik çözülmez, kesin sayı
 * şart — ama bu sayı yalnızca **ilk karenin** ölçüsü; gerçek değer
 * `onLayout` ile ölçülüyor.
 *
 * Neden ölçmek gerekiyor: `pagingEnabled` ScrollView'ün *kendi* genişliğinin
 * katlarına kilitler. Sayfalar buradan hesaplanan `EKRAN_W - 36` ile
 * çizilirken kap üst öğeye göre esniyordu ve ikisi birebir tutmuyordu —
 * `Dimensions.get('window').width` çoğu Android cihazda kesirli
 * (ör. 411.4285…), düzen motoru ise fiziksel piksele yuvarlıyor. Sayfa başına
 * bir-iki piksellik fark beşinci karede birikip görünür hâle geliyordu: kare
 * ortalanmıyor, solunda bir öncekinden şerit kalıyordu.
 */
const VARSAYILAN_HERO_W = EKRAN_W - 36;

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { product, loading } = useProduct(id);
  const { isFavorite, toggle } = useFavorites();
  const { inCart, toggle: toggleCart } = useCart();
  const { user } = useAuth();
  const [activeImg, setActiveImg] = useState(0);
  /* Kabın gerçek genişliği. Ölçülene kadar tahminle çiziliyor; ilk düzen
     karesinden sonra ikisi birebir aynı oluyor ve kayma sıfırlanıyor. */
  const [heroW, setHeroW] = useState(VARSAYILAN_HERO_W);
  const [buyutulmus, setBuyutulmus] = useState(false);
  const heroRef = useRef<ScrollView>(null);
  const [takasEdiliyor, setTakasEdiliyor] = useState(false);
  const fav = product ? isFavorite(product.id) : false;
  const inSepet = product ? inCart(product.id) : false;

  /**
   * Takası gerçekten açar. Puan bu çağrıda güvenli havuza girer ve ilan
   * rezerve edilir, o yüzden önce ne olacağı açıkça soruluyor.
   */
  async function sohbetAc() {
    if (!product) return;
    if (!user) {
      uyar('Giriş gerekli', 'Satıcıya yazmak için önce giriş yapın.', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Giriş yap', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    const s = await startConversation(product.id);
    if (!s.ok) {
      uyar('Sohbet açılamadı', s.message);
      return;
    }
    router.push(`/chat/${s.id}`);
  }

  async function takasEt() {
    if (!product) return;
    if (!user) {
      uyar('Giriş gerekli', 'Takas için önce giriş yapın.', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Giriş yap', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }

    uyar(
      'Takası başlat',
      `${product.points} puanınız güvenli havuza alınacak. Ürün elinize geçip onaylayana kadar satıcıya geçmez.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          onPress: async () => {
            setTakasEdiliyor(true);
            const sonuc = await startTrade(product.id);
            if (!sonuc.ok) {
              setTakasEdiliyor(false);
              uyar('Takas başlatılamadı', sonuc.message);
              return;
            }
            // Kargo bedeli sunucuda hesaplanır; kullanıcıya ödeyeceği tutarı
            // tahminle değil o hesapla gösteriyoruz.
            const fiyat = await quotePrice(sonuc.tradeId);
            setTakasEdiliyor(false);
            const satir = fiyat
              ? `\n\nKargo ${fiyat.shippingTl.toFixed(2)} ₺ + hizmet ${fiyat.serviceFeeTl.toFixed(2)} ₺ + işlem payı ${fiyat.transactionFeeTl.toFixed(2)} ₺ = ${fiyat.totalTl.toFixed(2)} ₺`
              : '';
            // Doğrudan ödemeye götürüyoruz: ödeme penceresi dolarsa takas
            // kendiliğinden iptal olur, kullanıcıyı arada bırakmayalım.
            uyar(
              'Takas açıldı',
              `${sonuc.points} puan havuzda.${satir}\n\nSon adım kargo ödemesi.`,
              [
                { text: 'Sonra', style: 'cancel', onPress: () => router.replace('/trades') },
                {
                  text: 'Ödemeye geç',
                  onPress: () =>
                    router.replace({ pathname: '/payment', params: { trade: sonuc.tradeId } }),
                },
              ],
            );
          },
        },
      ],
    );
  }

  if (loading && !product) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text>Ürün bulunamadı.</Text>
      </View>
    );
  }

  const gallery = product.gallery;

  /** Kaydırma bittiğinde hangi karede olduğumuzu sayfa genişliğinden buluruz. */
  function kaydirmaBitti(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / heroW);
    if (i !== activeImg && i >= 0 && i < gallery.length) setActiveImg(i);
  }

  /** Küçük resim ya da nokta seçildiğinde büyük kareyi oraya taşır. */
  function kareyeGit(i: number) {
    setActiveImg(i);
    heroRef.current?.scrollTo({ x: i * heroW, animated: true });
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Ürün detayı</Text>
        <Pressable style={styles.iconBtn} onPress={() => shareProduct(product)}>
          <MaterialIcons name="share" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => toggle(product.id)}>
          <MaterialIcons name={fav ? 'favorite' : 'favorite-border'} size={24} color={fav ? colors.tertiary : colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Galeri */}
        <View
          style={styles.hero}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w <= 0 || w === heroW) return;
            setHeroW(w);
            /* Genişlik değişince eski kaydırma konumu artık başka bir kareyi
               gösterir (katlanabilir ekran, tablette bölünmüş görünüm).
               Duran kareye animasyonsuz geri oturuyoruz. */
            heroRef.current?.scrollTo({ x: activeImg * w, animated: false });
          }}
        >
          {/* Kaydırılabilir şerit. Önceden tek bir Image vardı: kare yalnızca
              küçük resimden değişiyordu, parmakla kaydırmak hiçbir şey
              yapmıyordu. */}
          <ScrollView
            ref={heroRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={kaydirmaBitti}
          >
            {gallery.map((g, i) => (
              <Pressable
                key={i}
                onPress={() => setBuyutulmus(true)}
                style={{ width: heroW, aspectRatio: 4 / 3 }}
              >
                <Image source={g} style={{ width: heroW, height: '100%' }} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>


          <View style={styles.cond} pointerEvents="none">
            <MaterialIcons name="verified" size={16} color={colors.primary} />
            <Text style={styles.condText}>{product.condition}</Text>
          </View>
          <View style={styles.count} pointerEvents="none">
            <MaterialIcons name="photo-library" size={15} color="#fff" />
            <Text style={styles.countText}>
              {activeImg + 1}/{gallery.length}
            </Text>
          </View>

          {/* Oklar: kaydırmayı bilmeyene de yol gösterir. Uçtaysa gizlenir —
              basınca hiçbir şey yapmayan düğme, olmayan düğmeden kötüdür. */}
          {gallery.length > 1 && activeImg > 0 && (
            <Pressable style={[styles.ok, styles.okSol]} onPress={() => kareyeGit(activeImg - 1)} hitSlop={8}>
              <MaterialIcons name="chevron-left" size={26} color="#fff" />
            </Pressable>
          )}
          {gallery.length > 1 && activeImg < gallery.length - 1 && (
            <Pressable style={[styles.ok, styles.okSag]} onPress={() => kareyeGit(activeImg + 1)} hitSlop={8}>
              <MaterialIcons name="chevron-right" size={26} color="#fff" />
            </Pressable>
          )}

          <View style={styles.dots}>
            {gallery.map((_, i) => (
              <Pressable key={i} onPress={() => kareyeGit(i)} hitSlop={10}>
                <View style={[styles.dot, i === activeImg && styles.dotOn]} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Thumbnail şeridi */}
        <View style={styles.thumbs}>
          {gallery.map((g, i) => (
            <Pressable key={i} onPress={() => kareyeGit(i)} style={[styles.thumb, i === activeImg && styles.thumbOn]}>
              <Image source={g} style={styles.thumbImg} resizeMode="cover" />
            </Pressable>
          ))}
        </View>

        <Text style={styles.title}>{product.title}</Text>
        <View style={styles.ptsLine}>
          <Text style={styles.pts}>{product.points}</Text>
          <Text style={styles.ptsLabel}>Takas Puanı</Text>
          {/* Değeri yoksa etiket de görünmez; boş bir "Piyasa karşılığı"
              satırı kullanıcıya eksik bir şey olduğunu düşündürüyordu. */}
          {product.marketValue ? (
            <View style={styles.market}>
              <Text style={styles.marketLabel}>Piyasa karşılığı</Text>
              <Text style={styles.marketVal}>{product.marketValue}</Text>
            </View>
          ) : null}
        </View>

        {/* Buradaki rozetler bir zamanlar sabitti ve ikisi de yalandı:
            "AI onaylı fotoğraf" — anahtar tanımlı değilken kareleri insan
            onaylıyor, dolayısıyla bu iddia doğru değil; "48 parça tam" ise
            hangi ürün olursa olsun yazıyordu. Alıcı ikinci el bir ürüne
            bakarken doğrulama ve bütünlük iddiasına güvenir. Kalanlar da
            değeri yoksa hiç görünmüyor: "0 km" bilgi değil, gürültü. */}
        <View style={styles.mchips}>
          <Chip icon="verified" label="Kareler incelendi" />
          <Chip
            icon="location-on"
            label={
              product.distanceKm > 0
                ? `${product.location} · ${product.distanceKm} km`
                : product.location
            }
          />
        </View>

        <Text style={styles.desc}>{product.description}</Text>

        {/* Satıcı */}
        <View style={styles.seller}>
          <View style={styles.sellerAv}>
            <Text style={styles.sellerAvText}>{product.seller.initials}</Text>
            <View style={styles.sellerOk}>
              <MaterialIcons name="check" size={11} color="#fff" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.sellerNameRow}>
              <Text style={styles.sellerName}>{product.seller.name}</Text>
              <MaterialIcons name="verified-user" size={15} color={colors.primary} />
            </View>
            <View style={styles.sellerSub}>
              <MaterialIcons name="workspace-premium" size={15} color={colors.gold} />
              <Text style={styles.sellerSubText}>
                Güven skoru {product.seller.trust} · {product.seller.trades} başarılı takas
              </Text>
            </View>
          </View>
          <Pressable style={styles.iconBtn} onPress={() => router.push(`/chat/${product.seller.initials}`)}>
            <MaterialIcons name="chat-bubble-outline" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Güvenli havuz */}
        <View style={styles.pool}>
          <View style={styles.poolHead}>
            <MaterialIcons name="verified-user" size={22} color={colors.onPrimaryContainer} />
            <Text style={styles.poolHeadText}>Güvenli havuz korumalı takas</Text>
          </View>
          <Text style={styles.poolText}>
            Takas talebinde puanın güvenli havuzda bekler; ürün eline geçip onaylayana kadar satıcıya geçmez.
          </Text>
          <View style={styles.poolMini}>
            <PoolMini icon="shield" label="Alıcı koruması" />
            <PoolMini icon="local-shipping" label="3 gün kargo" />
            <PoolMini icon="history-toggle-off" label="48 sa onay" />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        {/* Satıcıya sormak, itiraza giden soruların çoğunu baştan çözer. */}
        <Pressable style={styles.iconSquare} onPress={sohbetAc}>
          <MaterialIcons name="chat-bubble-outline" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable
          style={[styles.iconSquare, inSepet && { backgroundColor: colors.primaryContainer }]}
          onPress={() => toggleCart(product.id)}
        >
          <MaterialIcons
            name={inSepet ? 'shopping-cart' : 'add-shopping-cart'}
            size={24}
            color={inSepet ? colors.onPrimaryContainer : colors.onSurface}
          />
        </Pressable>
        <Pressable
          style={[styles.cta, takasEdiliyor && { opacity: 0.6 }]}
          disabled={takasEdiliyor}
          onPress={takasEt}
        >
          {takasEdiliyor ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="swap-horiz" size={20} color="#fff" />
              <Text style={styles.ctaText}>Takas et · {product.points} puan</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Tam ekran görüntüleyici.
          İkinci el bir üründe alıcının tek dayanağı fotoğraf; 60 piksellik
          küçük resimde çizik de görünmez, eksik parça da. iOS'ta çift dokunma
          ve iki parmakla yakınlaştırma ScrollView'ün kendi yakınlaştırmasıyla
          çalışır; Android'de kare tam ekran açılır ama yakınlaştırma için ek
          bir kütüphane gerekiyor (TODO). */}
      <Modal
        visible={buyutulmus}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setBuyutulmus(false)}
        statusBarTranslucent
      >
        <View style={styles.tamEkran}>
          <StatusBar barStyle="light-content" />
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: activeImg * EKRAN_W, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / EKRAN_W);
              if (i >= 0 && i < gallery.length) setActiveImg(i);
            }}
          >
            {gallery.map((g, i) => (
              <ScrollView
                key={i}
                style={{ width: EKRAN_W }}
                contentContainerStyle={styles.tamEkranSayfa}
                maximumZoomScale={4}
                minimumZoomScale={1}
                centerContent
                showsVerticalScrollIndicator={false}
              >
                <Image source={g} style={styles.tamEkranImg} resizeMode="contain" />
              </ScrollView>
            ))}
          </ScrollView>

          <Pressable
            style={[styles.kapat, { top: insets.top + 8 }]}
            onPress={() => setBuyutulmus(false)}
            hitSlop={12}
          >
            <MaterialIcons name="close" size={26} color="#fff" />
          </Pressable>

          <View style={[styles.tamEkranSayac, { bottom: insets.bottom + 24 }]}>
            <Text style={styles.countText}>
              {activeImg + 1}/{gallery.length}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.mc}>
      <MaterialIcons name={icon} size={16} color={colors.primary} />
      <Text style={styles.mcText}>{label}</Text>
    </View>
  );
}

function PoolMini({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.pm}>
      <MaterialIcons name={icon} size={16} color={colors.onPrimaryContainer} />
      <Text style={styles.pmText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: colors.surface },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: shape.xl, overflow: 'hidden', aspectRatio: 4 / 3, marginBottom: 14, ...elevation.level2 },
  cond: {
    position: 'absolute',
    left: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
    ...elevation.level1,
  },
  condText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  count: {
    position: 'absolute',
    right: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  countText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 18, borderRadius: shape.full, backgroundColor: '#fff' },
  ok: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  okSol: { left: 8 },
  okSag: { right: 8 },
  tamEkran: { flex: 1, backgroundColor: '#000' },
  tamEkranSayfa: { alignItems: 'center', justifyContent: 'center' },
  tamEkranImg: { width: EKRAN_W, height: EKRAN_H },
  kapat: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tamEkranSayac: {
    position: 'absolute',
    alignSelf: 'center',
    height: 28,
    paddingHorizontal: 12,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  thumbs: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  thumb: { width: 60, height: 60, borderRadius: shape.sm, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 28, letterSpacing: -0.4, color: colors.onSurface },
  ptsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginVertical: 10 },
  pts: { fontSize: 36, fontWeight: '900', letterSpacing: -1, color: colors.primary },
  ptsLabel: { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: 14 },
  market: { marginLeft: 'auto', alignItems: 'flex-end' },
  marketLabel: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500' },
  marketVal: { fontSize: 12, color: colors.onSurface, fontWeight: '700' },
  mchips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  mc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: shape.xs,
    backgroundColor: colors.surfaceContainerHigh,
  },
  mcText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  desc: { color: colors.onSurfaceVariant, lineHeight: 22, fontSize: 14, fontWeight: '500', marginBottom: 16 },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 14,
    ...elevation.level1,
  },
  sellerAv: {
    width: 46,
    height: 46,
    borderRadius: shape.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvText: { fontWeight: '800', fontSize: 16, color: colors.onSecondaryContainer },
  sellerOk: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceContainerLow,
  },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerName: { fontWeight: '700', fontSize: 14, color: colors.onSurface },
  sellerSub: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  sellerSubText: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '500' },
  pool: { backgroundColor: colors.primaryContainer, borderRadius: shape.md, padding: 15 },
  poolHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  poolHeadText: { fontWeight: '700', fontSize: 14, color: colors.onPrimaryContainer },
  poolText: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: colors.onPrimaryContainer },
  poolMini: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: shape.xs,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  pmText: { fontSize: 11, fontWeight: '700', color: colors.onPrimaryContainer },
  actionbar: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    backgroundColor: colors.surfaceContainer,
  },
  iconSquare: {
    width: 54,
    height: 54,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    ...elevation.level1,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
