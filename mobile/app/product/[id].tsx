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
import { YakinlastirilabilirKare } from '../../components/YakinlastirilabilirKare';
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
      `${product.points} Takas Puanın Güvenli Havuz’a alınacak. Ürün eline geçip onaylayana kadar satıcıya geçmez.`,
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
        <Pressable style={styles.iconBtn} onPress={() => shareProduct(product)} accessibilityLabel="İlanı paylaş">
          <MaterialIcons name="share" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => toggle(product.id)} accessibilityLabel="Favorilere ekle">
          <MaterialIcons name={fav ? 'favorite' : 'favorite-border'} size={22} color={fav ? colors.tertiaryOn : colors.onSurface} />
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
                style={{ width: heroW, aspectRatio: 1.54 }}
              >
                <Image source={g} style={{ width: heroW, height: '100%' }} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>


          <View style={styles.cond} pointerEvents="none">
            <MaterialIcons name="check-circle-outline" size={13} color={colors.primary} />
            <Text style={styles.condText}>{product.condition}</Text>
          </View>
          <View style={styles.count} pointerEvents="none">
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
        {/* Değer bloğu: üstte etiket, altında tek satır değer (rehber 05).
            "Piyasa karşılığı" ve TL aralığı **kaldırıldı** — rehberin aynı
            bölümündeki uygulama notu açıkça gösterilmemesini söylüyor.
            Kapalı devre bir puan ekonomisinde bir ürünün yanına TL yazmak,
            puanı gizli bir kur üzerinden paraya çevirmeye davet ediyor. */}
        <Text style={styles.ptsLabel}>Takas değeri</Text>
        <Text style={styles.pts}>{product.points} Takas Puanı</Text>

        {/* Buradaki rozetler bir zamanlar sabitti ve ikisi de yalandı:
            "AI onaylı fotoğraf" — anahtar tanımlı değilken kareleri insan
            onaylıyor, dolayısıyla bu iddia doğru değil; "48 parça tam" ise
            hangi ürün olursa olsun yazıyordu. Alıcı ikinci el bir ürüne
            bakarken doğrulama ve bütünlük iddiasına güvenir. Kalanlar da
            değeri yoksa hiç görünmüyor: "0 km" bilgi değil, gürültü. */}
        <View style={styles.mchips}>
          {/* İlk çip dolu ve turkuaz: söylediği şey bir güvence, ikincisi
              yalnızca bilgi. Tasarımda da ikisi farklı ağırlıkta. */}
          <Chip icon="check-circle" label="Fotoğraf ve ilan kontrolü" vurgulu />
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
            {/* Satırda bir zamanlar üç ayrı doğrulama işareti vardı: avatarın
                köşesindeki tik, adın yanındaki kalkan ve skorun önündeki altın
                madalya. Üçü de aynı şeyi söylüyordu ve satır rozetten
                okunmuyordu. Tik kaldı — kalkan ve madalya düştü. */}
            <Text style={styles.sellerName}>{product.seller.name}</Text>
            <Text style={styles.sellerSubText}>
              Güven skoru {product.seller.trust} · {product.seller.trades} tamamlanan takas
            </Text>
          </View>
          {/* Bu düğme `/chat/ZD` gibi bir yola gidiyordu: baş harfler sohbet
              kimliği değil, yani her basışta var olmayan bir sohbet açılmaya
              çalışılıyordu. Alt bardaki düğmeyle aynı işi yapıyor artık. */}
          <Pressable style={styles.iconBtn} onPress={sohbetAc} accessibilityLabel="Mesaj gönder">
            <MaterialIcons name="chat-bubble-outline" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Güvenli havuz */}
        {/* Başlık ve açıklama rehber 05'ten birebir. Altındaki üç mini çip
            ("Alıcı koruması · 3 gün kargo · 48 sa onay") kaldırıldı:
            tasarımda yoklar ve ikisi süre taahhüdüydü — burada tek satır
            olarak duran bir süre, koşulları okunmadan söz gibi okunuyor.
            Yerleri Yardım & Güvenli Havuz ekranı. */}
        <View style={styles.pool}>
          <MaterialIcons
            name="verified-user"
            size={20}
            color={colors.onPrimaryContainer}
            style={styles.poolIcon}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.poolHeadText}>Güvenli Havuz ile korumalı takas</Text>
            <Text style={styles.poolText}>
              Takas Puanın, teslimat tamamlanana kadar Güvenli Havuz’da bekler.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        {/* Satıcıya sormak, itiraza giden soruların çoğunu baştan çözer. */}
        <Pressable style={styles.iconSquare} onPress={sohbetAc} accessibilityLabel="Mesaj gönder">
          <MaterialIcons name="chat-bubble-outline" size={20} color={colors.primary} />
        </Pressable>
        <Pressable
          style={[styles.iconSquare, inSepet && styles.iconSquareOn]}
          onPress={() => toggleCart(product.id)}
          accessibilityLabel="Sepete ekle"
        >
          <MaterialIcons
            name={inSepet ? 'shopping-cart' : 'add-shopping-cart'}
            size={20}
            color={colors.primary}
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
            /* Rehber 05: birincil CTA "420 Takas Puanı ile takas et". Simge
               yok — cümle zaten ne olacağını söylüyor. */
            <Text style={styles.ctaText}>{product.points} Takas Puanı ile takas et</Text>
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
              <YakinlastirilabilirKare
                key={i}
                kaynak={g}
                genislik={EKRAN_W}
                sayfaStili={styles.tamEkranSayfa}
                resimStili={styles.tamEkranImg}
              />
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

function Chip({
  icon,
  label,
  vurgulu,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  vurgulu?: boolean;
}) {
  return (
    <View style={[styles.mc, vurgulu ? styles.mcVurgu : styles.mcSade]}>
      <MaterialIcons name={icon} size={13} color={colors.primary} />
      <Text style={[styles.mcText, vurgulu && styles.mcTextVurgu]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: colors.surface },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  /* Ölçüldü (`09_05_Urun_Detayi.png`): hero 354×230 pt → oran 1.54.
     Önceki 4/3 kareyi belirgin uzun gösteriyordu. */
  hero: { borderRadius: shape.xl, overflow: 'hidden', aspectRatio: 1.54, marginBottom: 12, ...elevation.level2 },
  cond: {
    position: 'absolute',
    left: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 25,
    paddingHorizontal: 10,
    borderRadius: shape.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
    ...elevation.level1,
  },
  condText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
  count: {
    position: 'absolute',
    right: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 23,
    paddingHorizontal: 9,
    borderRadius: shape.sm,
    backgroundColor: 'rgba(31,41,55,0.78)',
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
  thumbs: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  thumb: { width: 52, height: 52, borderRadius: shape.sm, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23, letterSpacing: -0.3, color: colors.onSurface },
  ptsLabel: { color: colors.onSurfaceVariant, fontWeight: '800', fontSize: 10.5, marginTop: 12 },
  pts: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4, color: colors.primary, marginTop: 3 },
  mchips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14, marginBottom: 14 },
  mc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 25,
    paddingHorizontal: 10,
    borderRadius: shape.full,
  },
  mcVurgu: { backgroundColor: colors.primaryContainer },
  mcSade: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant },
  mcText: { fontSize: 10.5, fontWeight: '700', color: colors.onSurfaceVariant },
  mcTextVurgu: { color: colors.primary },
  desc: { color: colors.onSurfaceVariant, lineHeight: 19, fontSize: 12.5, fontWeight: '500', marginBottom: 16 },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLowest,
    marginBottom: 14,
    ...elevation.level1,
  },
  sellerAv: {
    width: 40,
    height: 40,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvText: { fontWeight: '800', fontSize: 13, color: colors.primary },
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
    borderColor: colors.surfaceContainerLowest,
  },
  sellerName: { fontWeight: '800', fontSize: 13, color: colors.onSurface },
  sellerSubText: { color: colors.onSurfaceVariant, fontSize: 11, fontWeight: '500', marginTop: 3 },
  pool: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: colors.primaryContainer,
    borderRadius: shape.md,
    padding: 14,
  },
  poolIcon: { marginTop: 1 },
  poolHeadText: { fontWeight: '800', fontSize: 13, color: colors.onPrimaryContainer },
  poolText: { fontSize: 11.5, lineHeight: 17, fontWeight: '500', color: colors.onPrimaryContainer, marginTop: 4 },
  /* Ölçüldü: kenar 18, iki daire 44, aralar 7, CTA kalanı doldurur, y 46.
     Şeridin zemini `#FFF9EF` — sayfa zemininin bir ton açığı; önceki
     `surfaceContainer` sayfadan koyuydu ve şerit alta yapışmış gri bir bant
     gibi duruyordu (alt sekme şeridiyle aynı kusur). */
  actionbar: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: colors.surfaceContainerLow,
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquareOn: { backgroundColor: colors.primaryContainer },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    ...elevation.level1,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
