import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ProductCard } from '../../components/ProductCard';
import { FeaturedCard } from '../../components/FeaturedCard';
import { ALL_CATEGORIES, CATEGORY_TREE, subsOf } from '../../data/categories';
import { useProducts } from '../../hooks/useProducts';
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

  const query = q.toLowerCase().trim();
  /* Alt kategoriler yalnızca bir ana kategori seçiliyken açılır — mimarinin
     kuralı bu. Hepsini birden göstermek altmış iki çip demekti. */
  const altlar = subsOf(active);

  const visible = products.filter((p) => {
    if (active !== ALL_CATEGORIES && p.category !== active) return false;
    if (activeSub !== ALL_CATEGORIES && p.subCategory !== activeSub) return false;
    if (!query) return true;
    return [p.title, p.category, p.subCategory ?? ''].some((a) =>
      a.toLowerCase().includes(query),
    );
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
            <MaterialIcons name="search" size={24} color={colors.onSurfaceVariant} />
            <TextInput
              placeholder="Oyuncak, kitap, montessori…"
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
            />
            {q.length > 0 ? (
              <Pressable onPress={() => setQ('')}>
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </Pressable>
            ) : (
              <MaterialIcons name="mic" size={24} color={colors.onSurfaceVariant} />
            )}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{basHarf}</Text>
            </View>
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
                  size={18}
                  color={sel ? colors.onSecondaryContainer : colors.onSurfaceVariant}
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
            <View style={styles.sec}>
              <Text style={styles.secTitle}>Öne çıkan takaslar</Text>
              <Text style={styles.secLink}>Tümü</Text>
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

        {/* Yakındaki raflar */}
        <View style={styles.sec}>
          <Text style={styles.secTitle}>Yakınındaki raflar</Text>
          <Text style={styles.secLink}>Harita</Text>
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
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  greeting: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: colors.onSurface },
  sub: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 1 },
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
  searchWrap: { paddingHorizontal: 18, marginTop: 6, marginBottom: 16 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHigh,
    ...elevation.level1,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.onSurface },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: shape.full,
    backgroundColor: colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chips: { gap: 8, paddingHorizontal: 18, paddingBottom: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: shape.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipSel: { backgroundColor: colors.secondaryContainer, borderColor: 'transparent' },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  chipTextSel: { color: colors.onSecondaryContainer, fontWeight: '700' },
  subChips: { gap: 8, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 2 },
  subChip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: shape.full,
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  subChipSel: { backgroundColor: colors.onSurface },
  subChipText: { fontSize: 12.5, fontWeight: '600', color: colors.onSurfaceVariant },
  subChipTextSel: { color: colors.surface, fontWeight: '700' },
  sec: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 12,
  },
  secTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: colors.onSurface },
  secLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  carousel: { gap: 14, paddingHorizontal: 18 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 11 },
  cell: { width: '50%', paddingHorizontal: 7, marginBottom: 14 },
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
