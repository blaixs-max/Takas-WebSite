import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { uyar } from '../../components/Dialog';
import { ProductCard } from '../../components/ProductCard';
import { FeaturedCard } from '../../components/FeaturedCard';
import { ALL_CATEGORIES, CATEGORY_TREE, subsOf } from '../../data/categories';
import { useProducts } from '../../hooks/useProducts';
import { aramaEslesir } from '../../lib/arama';
import { unreadCount } from '../../lib/notifications';
import { basHarfler, ilkAd, loadProfile } from '../../lib/profile';
import { colors, elevation, shape } from '../../theme/tokens';

/** 'Tümü' bir kategori değil, süzgecin kapalı hâli — listeye burada ekleniyor. */
const FILTERS: { label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: ALL_CATEGORIES, icon: 'apps' },
  ...CATEGORY_TREE.map((c) => ({ label: c.name, icon: c.icon })),
];

export default function ShelfScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [active, setActive] = useState<string>(ALL_CATEGORIES);
  const [activeSub, setActiveSub] = useState<string>(ALL_CATEGORIES);

  /* Ana kategori değişince alt seçim düşer: önceki alt kategori yeni ana
     kategoride yok, kalsaydı raf sessizce boş dönerdi. */
  const anaSec = (ad: string) => {
    setActive(ad);
    setActiveSub(ALL_CATEGORIES);
  };
  /**
   * Bildirim rozeti.
   *
   * Sayı bir zamanlar sabit '3' idi; gerçek sayı olmadan bir rozet kullanıcıya
   * yalan söyler ve tıklanmayı bırakır. Gerçek sayıya bağlandıktan sonra ikinci
   * bir kusur kaldı: `useEffect(..., [])` yalnızca ekran **ilk kurulduğunda**
   * koşuyordu. Sekme ekranları arka planda canlı kalıyor, dolayısıyla
   * bildirimleri okuyup geri dönmek onu hiç yeniden çalıştırmıyordu — rozet
   * ekranda okunmuş bildirimleri saymaya devam ediyordu.
   *
   * `useFocusEffect` ekrana her dönüşte tazeliyor.
   */
  const [okunmamis, setOkunmamis] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      unreadCount().then((n) => {
        if (!iptal) setOkunmamis(n);
      });
      return () => {
        iptal = true;
      };
    }, []),
  );
  const [q, setQ] = useState('');

  /* Selamlama gerçek addan geliyor. Sabit "Merhaba, Emrah" yazıyordu — her
     kullanıcıya aynı ismi söyleyen bir karşılama. */
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [basHarf, setBasHarf] = useState('—');
  useEffect(() => {
    let iptal = false;
    loadProfile().then((pr) => {
      if (iptal) return;
      setKullaniciAdi(ilkAd(pr.fullName));
      setBasHarf(pr.fullName ? basHarfler(pr.fullName) : '—');
    });
    return () => {
      iptal = true;
    };
  }, []);
  const { products, featured, loading, refreshing, refresh } = useProducts();

  /* Alt kategoriler yalnızca bir ana kategori seçiliyken açılır — mimarinin
     kuralı bu. Hepsini birden göstermek altmış iki çip demekti. */
  const altlar = subsOf(active);

  /* Arama `aramaEslesir` üzerinden: `toLowerCase()` Türkçe'yi bozuyordu
     ("İpekyol" küçültülünce birleşen noktalı bir i çıkıyor ve düz "ipek" ile
     eşleşmiyor) ve şapkasız yazan kullanıcı hiçbir şey bulamıyordu.
     Taranan alanlar da genişledi: açıklama ve konum eklendi — "Kadıköy"
     yazan biri semtindeki ilanları görebilmeli. */
  const visible = products.filter((p) => {
    if (active !== ALL_CATEGORIES && p.category !== active) return false;
    if (activeSub !== ALL_CATEGORIES && p.subCategory !== activeSub) return false;
    return aramaEslesir(q, [p.title, p.category, p.subCategory, p.location, p.description]);
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Kişiselleştirilmiş app bar */}
      <View style={styles.appbar}>
        <View style={{ flex: 1, paddingLeft: 10 }}>
          <Text style={styles.greeting}>
            {kullaniciAdi ? `Merhaba, ${kullaniciAdi}` : 'Merhaba'}
          </Text>
          {/* Sayı gerçek: yüklenen yayındaki ilan sayısı. Önce sabit "1.248"
              yazıyordu — karşılığı olmayan bir sayı, ve ekrandaki her sayıya
              olan güveni götüren türden. */}
          <Text style={styles.sub}>
            {loading ? 'Vitrin yükleniyor…' : `${products.length} ürün takasta`}
          </Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => router.push('/notifications')}>
          <MaterialIcons name="notifications-none" size={24} color={colors.onSurface} />
          {okunmamis > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{okunmamis > 9 ? '9+' : okunmamis}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Arama */}
        <View style={styles.searchWrap}>
          <View style={styles.search}>
            <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              placeholder="Ürün, marka veya kategori ara"
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
            />
            {/* Burada bir mikrofon simgesi duruyordu ve `Pressable` bile
                değildi — dokunmaya hiç cevap vermeyen, çizilmiş bir resim.
                Arkasında sesli arama yok; uygulama konuşma tanıma paketi
                taşımıyor. Basınca hiçbir şey yapmayan bir düğme, olmayan
                düğmeden kötüdür: kullanıcı önce bozuk sanır, sonra o alandaki
                her şeye güvenmeyi bırakır. Sesli arama gerçekten eklenirse
                simge de onunla birlikte geri gelir. */}
            {q.length > 0 && (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            )}
            {/* Tasarımda burada turuncu bir daire var ve içinde süzgeç
                simgesi. Bizde süzgeç ekranı yok — süzme hemen altındaki çip
                satırıyla yapılıyor (kullanıcı kararı), o yüzden aynı daire
                profile kısayolu olarak duruyor.

                Daire bir tur boyunca `View` idi: dokunmaya cevap vermeyen,
                çizilmiş bir düğme — sildiğim mikrofonla aynı kusur. Artık
                gerçekten bir yere gidiyor. Ad yokken "—" bir hata gibi
                okunuyordu; kişi ikonu profilin henüz boş olduğunu söylüyor. */}
            <Pressable
              style={styles.avatar}
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Profilim"
            >
              {basHarf === '—' ? (
                <MaterialIcons name="person" size={17} color={colors.onTertiaryContainer} />
              ) : (
                <Text style={styles.avatarText}>{basHarf}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Filtre chip'leri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map((f) => {
            const sel = f.label === active;
            return (
              <Pressable
                key={f.label}
                onPress={() => anaSec(f.label)}
                style={[styles.chip, sel && styles.chipSel]}
              >
                <MaterialIcons
                  name={f.icon}
                  size={16}
                  color={sel ? colors.primary : colors.onSurfaceVariant}
                />
                <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Alt kategori satırı — ana satırla yarışmasın diye daha küçük ve
            ikonsuz; ikon burada dokuz kez tekrar eden aynı simge olurdu. */}
        {altlar.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subChips}
          >
            {[ALL_CATEGORIES, ...altlar].map((ad) => {
              const sel = ad === activeSub || (ad === ALL_CATEGORIES && activeSub === ALL_CATEGORIES);
              return (
                <Pressable
                  key={ad}
                  onPress={() => setActiveSub(ad)}
                  style={[styles.subChip, sel && styles.subChipSel]}
                >
                  <Text style={[styles.subChipText, sel && styles.subChipTextSel]}>
                    {ad === ALL_CATEGORIES ? 'Tüm alt kategoriler' : ad}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Öne çıkanlar — rozetli ilan yoksa başlık da çizilmiyor. Sitede
            aynı kusur canlı vitrine geçince ortaya çıkmıştı: başlık duruyor,
            altı boş. */}
        {featured.length > 0 && (
          <>
            {/* "Tümü" bağlantısı kalktı. `Pressable` değildi, hiçbir yere
                gitmiyordu ve gidecek yeri de yoktu: öne çıkanlar hemen
                altındaki rafın bir alt kümesi, tam liste zaten aynı ekranda. */}
            <View style={styles.sec}>
              <Text style={styles.secTitle}>Öne çıkan takaslar</Text>
              {/* Bağlantı bu kez gerçekten çalışıyor: süzgeci sıfırlayıp
                  aramayı temizliyor, yani tam rafı gösteriyor. Öne çıkanlar
                  zaten o rafın alt kümesi. */}
              <Pressable
                onPress={() => {
                  anaSec(ALL_CATEGORIES);
                  setQ('');
                }}
                hitSlop={8}
              >
                <Text style={styles.secLink}>Tümünü gör</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {featured.map((p) => (
                <FeaturedCard key={p.id} product={p} />
              ))}
            </ScrollView>
          </>
        )}

        {/* Rehberdeki başlık "Yakınındaki ürünler". */}
        <View style={styles.sec}>
          <Text style={styles.secTitle}>Yakınındaki ürünler</Text>
          {/* "Haritada gör" tasarımda ve rehberde var, arkasında harita
              ekranı YOK. Kullanıcı kararıyla duruyor; yayından önce ya
              harita yazılacak ya bu bağlantı düşecek. Şimdilik dokunulunca
              ne olduğunu söylüyor — sessizce hiçbir şey yapmıyor değil. */}
          <Pressable
            onPress={() =>
              uyar(
                'Harita yakında',
                'Yakınındaki ürünleri haritada görme özelliği hazırlanıyor. Şu an ürünler mesafeye göre listeleniyor.',
              )
            }
            hitSlop={8}
          >
            <Text style={styles.secLink}>Haritada gör</Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.grid}>
            {visible.map((p) => (
              <View key={p.id} style={styles.cell}>
                <ProductCard product={p} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 12, paddingHorizontal: 6 },
  greeting: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6, color: colors.onSurface },
  sub: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: shape.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  searchWrap: { paddingHorizontal: 18, marginTop: 2, marginBottom: 14 },
  /* Ölçüldü (`08_04_Anasayfa.png`): alan 354×35 pt, gölgesiz, zemin `#F3EBDD`.
     Bir tur boyunca 54 pt yüksekliğinde ve bir ton daha koyu (`#E7E1D5`) idi;
     krem zeminin üstünde gri bir kutu gibi duruyordu. Yükseklik tasarımdaki
     35 yerine 40: 35 pt'lik bir dokunma alanı, içindeki metin alanıyla
     birlikte, parmakla ıskalanıyor. */
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 42,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.onSurface },
  /* Turuncu daire 28 pt (ölçüldü). Metin koyu — beyaz `#FFA726` üzerinde
     okunmuyor. */
  avatar: {
    width: 28,
    height: 28,
    borderRadius: shape.full,
    backgroundColor: colors.tertiaryOn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onTertiaryContainer, fontWeight: '800', fontSize: 11.5 },
  chips: { gap: 8, paddingHorizontal: 18, paddingBottom: 4 },
  /* Tasarım: beyaz hap + ince kenarlık, yüksekliği 25 pt; seçili olan açık
     turkuaz zemin ve koyu turkuaz metin. Burada 30: 25 pt dokunma için fazla
     alçak, 36 (önceki değer) tasarımın yanında şişkin duruyordu. */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: shape.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  chipSel: { backgroundColor: colors.primaryContainer, borderColor: 'transparent' },
  chipText: { fontSize: 11.5, fontWeight: '700', color: colors.onSurfaceVariant },
  chipTextSel: { color: colors.primary },
  subChips: { gap: 8, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 2 },
  subChip: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: shape.full,
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  subChipSel: { backgroundColor: colors.primary },
  subChipText: { fontSize: 11.5, fontWeight: '600', color: colors.onSurfaceVariant },
  subChipTextSel: { color: colors.onPrimary, fontWeight: '700' },
  sec: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 16,
    marginBottom: 10,
  },
  secTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: colors.onSurface },
  secLink: { fontSize: 12.5, fontWeight: '800', color: colors.primary },
  carousel: { gap: 10, paddingHorizontal: 18 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  /* Kenar 18, kartlar arası 10 (ölçüldü) → 13 + 5 + 5 + 13. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 13 },
  cell: { width: '50%', paddingHorizontal: 5, marginBottom: 14 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: shape.md,
    backgroundColor: colors.tertiaryContainer,
    ...elevation.level3,
  },
  fabText: { fontWeight: '700', fontSize: 15, color: colors.onTertiaryContainer },
});
