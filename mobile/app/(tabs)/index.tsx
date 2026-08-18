import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { uyar } from '../../components/Dialog';
import { ProductCard } from '../../components/ProductCard';
import { FeaturedCard } from '../../components/FeaturedCard';
import { ALL_CATEGORIES, CATEGORY_TREE, subsOf } from '../../data/categories';
import { AltSayfa } from '../../components/AltSayfa';
import { useProducts } from '../../hooks/useProducts';
import {
  BOS_SUZGEC,
  KONDISYONLAR,
  SIRALAMA_SECENEKLERI,
  Siralama,
  Suzgec,
  acikSuzgecSayisi,
  enYuksekPuan,
  mevcutKonumlar,
  suzgeciTemizle,
  uygula,
} from '../../lib/suzgec';
import { unreadCount } from '../../lib/notifications';
import { basHarfler, ilkAd, loadProfile } from '../../lib/profile';
import { loadMyAvatar } from '../../lib/avatar';
import { colors, elevation, shape } from '../../theme/tokens';

/** 'Tümü' bir kategori değil, süzgecin kapalı hâli — listeye burada ekleniyor. */
const FILTERS: { label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: ALL_CATEGORIES, icon: 'apps' },
  ...CATEGORY_TREE.map((c) => ({ label: c.name, icon: c.icon })),
];

export default function ShelfScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /**
   * Süzgeç tek bir nesnede.
   *
   * Kategori ve alt kategori de bunun içinde: ekranda çip satırı olarak
   * duruyorlar ama süzme kuralı olarak diğerlerinden farkları yok, ve ayrı
   * durumda tutulsalardı `uygula` iki kaynaktan beslenirdi. Rozet onları
   * saymıyor — o ayrım `acikSuzgecSayisi` içinde ve gerekçesi orada yazılı.
   */
  const [suzgec, setSuzgec] = useState<Suzgec>(BOS_SUZGEC);
  const [siralama, setSiralama] = useState<Siralama>('onerilen');
  const [siralamaAcik, setSiralamaAcik] = useState(false);
  const [suzgecAcik, setSuzgecAcik] = useState(false);

  /* Panel açıkken yapılan değişiklikler önce taslağa yazılıyor, "Uygula"ya
     basılınca gerçek süzgece geçiyor. Anında uygulasaydı panel her dokunuşta
     arkadaki rafı yeniden çizerdi ve kullanıcı sonucu göremeden ölçütü
     değiştirmiş olurdu; kapatınca vazgeçmek de mümkün olmazdı. */
  const [taslak, setTaslak] = useState<Suzgec>(BOS_SUZGEC);

  const active = suzgec.kategori;
  const activeSub = suzgec.altKategori;

  /* Ana kategori değişince alt seçim düşer: önceki alt kategori yeni ana
     kategoride yok, kalsaydı raf sessizce boş dönerdi. */
  const anaSec = (ad: string) => {
    setSuzgec((s) => ({ ...s, kategori: ad, altKategori: ALL_CATEGORIES }));
  };
  const setActiveSub = (ad: string) => setSuzgec((s) => ({ ...s, altKategori: ad }));
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

  /* Profil fotoğrafı bu küçük dairede de görünüyor: kullanıcı fotoğrafını
     yükleyip ana ekranda hâlâ baş harflerini görseydi, yüklemenin işe
     yaramadığını düşünürdü. `useFocusEffect` — sekme ekranı arka planda canlı
     kalıyor ve düzenlemeden dönüşte tazelenmezse eski hâli kalır. */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      loadMyAvatar().then((a) => {
        if (!iptal) setAvatarUrl(a.url);
      });
      return () => {
        iptal = true;
      };
    }, []),
  );
  const { products, featured, loading, refreshing, refresh } = useProducts();

  /* Alt kategoriler yalnızca bir ana kategori seçiliyken açılır — mimarinin
     kuralı bu. Hepsini birden göstermek altmış iki çip demekti. */
  const altlar = subsOf(active);

  /* Süzme ve sıralama `lib/suzgec.ts` içinde ve saf: girdi ürün dizisi,
     çıktı ürün dizisi. Ekranda kalsaydı çizim mantığıyla iş mantığı iç içe
     geçerdi — ve bu ikisi bozulunca farklı görünüyor: yanlış çizim gözle
     yakalanır, yanlış süzgeç yalnızca "aradığımı bulamadım" olarak yaşanır. */
  const visible = useMemo(
    () => uygula(products, suzgec, q, siralama),
    [products, suzgec, q, siralama],
  );

  const acikSayi = acikSuzgecSayisi(suzgec);
  const konumlar = useMemo(() => mevcutKonumlar(products), [products]);
  const enYuksek = useMemo(() => enYuksekPuan(products), [products]);
  const siralamaEtiketi =
    SIRALAMA_SECENEKLERI.find((s) => s.deger === siralama)?.etiket ?? 'Önerilen';

  function suzgecPaneliniAc() {
    setTaslak(suzgec);
    setSuzgecAcik(true);
  }

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
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
              ) : basHarf === '—' ? (
                <MaterialIcons name="person" size={17} color={colors.onTertiaryContainer} />
              ) : (
                <Text style={styles.avatarText}>{basHarf}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Çip satırı — Sırala ve Filtrele "Tümü"nün yanında, aynı dilde.
            Ayrı bir şerit olarak duruyorlardı ve iki kusuru vardı: dikeyde
            bir satır daha yiyordu, ve iki farklı biçim (şerit + çipler) aynı
            işi yapan üç kontrolü birbirinden ayırıyordu. Hepsi "rafı nasıl
            göreceğim" sorusunun parçası.

            Ayraç, gezinme ile süzmeyi ayırıyor: solu eylem (panel açar),
            sağı seçim (rafı süzer). Aynı biçimdeler ama aynı şey değiller. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {/* Sırala — varsayılan dışında bir seçim varsa çip "seçili" görünüyor
              ve etiket seçimin kendisini yazıyor. Kullanıcı sıralamayı
              değiştirdiğini paneli açmadan görebilmeli. */}
          <Pressable
            onPress={() => setSiralamaAcik(true)}
            style={[styles.chip, siralama !== 'onerilen' && styles.chipSel]}
            accessibilityLabel={`Sıralama: ${siralamaEtiketi}`}
          >
            <MaterialIcons
              name="swap-vert"
              size={16}
              color={siralama !== 'onerilen' ? colors.primary : colors.onSurfaceVariant}
            />
            <Text
              style={[styles.chipText, siralama !== 'onerilen' && styles.chipTextSel]}
              numberOfLines={1}
            >
              {siralama === 'onerilen' ? 'Sırala' : siralamaEtiketi}
            </Text>
          </Pressable>

          {/* Filtrele — açık süzgeç sayısı etikete giriyor, ayrı bir rozete
              değil. Çip yüksekliği 32 ve üstüne binen bir rozet burada
              sıkışırdı; "Filtrele (2)" aynı bilgiyi taşıyor. */}
          <Pressable
            onPress={suzgecPaneliniAc}
            style={[styles.chip, acikSayi > 0 && styles.chipSel]}
            accessibilityLabel={acikSayi > 0 ? `Filtrele — ${acikSayi} filtre açık` : 'Filtrele'}
          >
            <MaterialIcons
              name="tune"
              size={16}
              color={acikSayi > 0 ? colors.primary : colors.onSurfaceVariant}
            />
            <Text style={[styles.chipText, acikSayi > 0 && styles.chipTextSel]}>
              {acikSayi > 0 ? `Filtrele (${acikSayi})` : 'Filtrele'}
            </Text>
          </Pressable>

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
          }).flatMap((c, i) =>
            /* Ayraç "Tümü"nün ARDINDAN geliyor, önünden değil.
               `Tümü` bir kategori değil, süzgecin kapalı hâli — yani Sırala
               ve Filtrele ile aynı türden bir kontrol: üçü de "rafı nasıl
               göreceğim" sorusuna cevap veriyor. Ayraç önlerine konunca
               `Tümü` kategorilerle aynı gruba düşüyordu. */
            i === 0 ? [c, <View key="ayrac" style={styles.cipAyrac} />] : [c],
          )}
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
        ) : visible.length === 0 ? (
          /* Boş raf sessiz kalmıyor. Süzgeç yüzündense çıkışı da veriyor:
             kullanıcının hangi ölçütü koyduğunu hatırlaması gerekmesin. */
          <View style={styles.bos}>
            <MaterialIcons name="search-off" size={34} color={colors.outline} />
            <Text style={styles.bosBaslik}>Bu ölçütlere uyan ilan yok</Text>
            <Text style={styles.bosMetin}>
              {acikSayi > 0
                ? 'Filtreleri gevşetmeyi ya da temizlemeyi dene.'
                : 'Aramanı değiştirmeyi ya da başka bir kategoriye bakmayı dene.'}
            </Text>
            {acikSayi > 0 && (
              <Pressable
                style={styles.bosCta}
                onPress={() => setSuzgec((s) => suzgeciTemizle(s))}
              >
                <Text style={styles.bosCtaText}>Filtreleri temizle</Text>
              </Pressable>
            )}
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

      {/* ---- Sırala ---- */}
      <AltSayfa acik={siralamaAcik} baslik="Sırala" onKapat={() => setSiralamaAcik(false)}>
        {/* Sıralama anında uygulanıyor, "Uygula" düğmesi yok: tek seçimlik bir
            karar ve seçer seçmez sonucu görmek doğru davranış. Süzgeç panelinde
            tersi geçerli — orada birden fazla ölçüt birlikte kuruluyor. */}
        {SIRALAMA_SECENEKLERI.map((s) => {
          const sel = s.deger === siralama;
          return (
            <Pressable
              key={s.deger}
              style={styles.secenek}
              onPress={() => {
                setSiralama(s.deger);
                setSiralamaAcik(false);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.secenekText, sel && styles.secenekTextSel]}>{s.etiket}</Text>
                {s.aciklama ? <Text style={styles.secenekAlt}>{s.aciklama}</Text> : null}
              </View>
              <MaterialIcons
                name={sel ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={20}
                color={sel ? colors.primary : colors.outline}
              />
            </Pressable>
          );
        })}
      </AltSayfa>

      {/* ---- Filtrele ---- */}
      <AltSayfa
        acik={suzgecAcik}
        baslik="Filtrele"
        onKapat={() => setSuzgecAcik(false)}
        altBar={
          <>
            <Pressable
              style={styles.temizle}
              onPress={() => setTaslak((t) => suzgeciTemizle(t))}
            >
              <Text style={styles.temizleText}>Temizle</Text>
            </Pressable>
            <Pressable
              style={styles.uygula}
              onPress={() => {
                setSuzgec(taslak);
                setSuzgecAcik(false);
              }}
            >
              <Text style={styles.uygulaText}>Sonuçları göster</Text>
            </Pressable>
          </>
        }
      >
        <Text style={styles.grupBaslik}>ÜRÜN DURUMU</Text>
        <View style={styles.hapSatir}>
          {KONDISYONLAR.map((k) => {
            const sel = taslak.kondisyonlar.includes(k);
            return (
              <Pressable
                key={k}
                style={[styles.hap, sel && styles.hapSel]}
                onPress={() =>
                  setTaslak((t) => ({
                    ...t,
                    kondisyonlar: sel
                      ? t.kondisyonlar.filter((x) => x !== k)
                      : [...t.kondisyonlar, k],
                  }))
                }
              >
                <Text style={[styles.hapText, sel && styles.hapTextSel]}>{k}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.grupBaslik}>TAKAS PUANI</Text>
        <View style={styles.aralik}>
          <View style={styles.aralikAlan}>
            <TextInput
              style={styles.aralikInput}
              value={taslak.enAzPuan === null ? '' : String(taslak.enAzPuan)}
              onChangeText={(t) => setTaslak((s) => ({ ...s, enAzPuan: sayi(t) }))}
              placeholder="En az"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
          <Text style={styles.aralikAyrac}>—</Text>
          <View style={styles.aralikAlan}>
            <TextInput
              style={styles.aralikInput}
              value={taslak.enCokPuan === null ? '' : String(taslak.enCokPuan)}
              onChangeText={(t) => setTaslak((s) => ({ ...s, enCokPuan: sayi(t) }))}
              placeholder={enYuksek > 0 ? `En çok (${enYuksek})` : 'En çok'}
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        </View>

        {/* Konum listesi rafta GERÇEKTEN bulunan ilçelerden. 81 ilin tamamını
            listelemek, kullanıcıya sonucu boş dönecek onlarca seçenek sunmak
            olurdu — ve boş sonucun sebebini süzgecin kendisi yaratırdı. */}
        {konumlar.length > 1 && (
          <>
            <Text style={styles.grupBaslik}>KONUM</Text>
            <View style={styles.hapSatir}>
              {konumlar.map((k) => {
                const sel = taslak.konum === k;
                return (
                  <Pressable
                    key={k}
                    style={[styles.hap, sel && styles.hapSel]}
                    onPress={() => setTaslak((t) => ({ ...t, konum: sel ? '' : k }))}
                  >
                    <Text style={[styles.hapText, sel && styles.hapTextSel]}>{k}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Pressable
          style={styles.anahtarSatir}
          onPress={() => setTaslak((t) => ({ ...t, hasarsiz: !t.hasarsiz }))}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.anahtarBaslik}>Yalnızca hasarsız ürünler</Text>
            <Text style={styles.anahtarAlt}>Satıcının hasar beyan ettiği ilanları gizler.</Text>
          </View>
          <MaterialIcons
            name={taslak.hasarsiz ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={taslak.hasarsiz ? colors.primary : colors.outline}
          />
        </Pressable>
      </AltSayfa>
    </View>
  );
}

/**
 * Metni puana çevirir; boş ya da sayı değilse `null` (sınır yok).
 *
 * `Number('')` sıfır veriyor ve bu tam olarak yanlış cevap: kullanıcı alanı
 * boşaltınca "en az 0 puan" değil "alt sınır yok" demek istiyor. İkisi aynı
 * sonucu verdiği için fark uzun süre görünmez, sonra "en çok" alanı
 * boşaltıldığında raf tamamen boşalır.
 */
function sayi(t: string): number | null {
  const temiz = t.replace(/[^0-9]/g, '');
  if (!temiz) return null;
  return Number(temiz);
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
  avatarImg: { width: '100%', height: '100%', borderRadius: shape.full },
  avatarText: { color: colors.onTertiaryContainer, fontWeight: '800', fontSize: 11.5 },
  chips: { gap: 8, paddingHorizontal: 18, paddingBottom: 4, alignItems: 'center' },
  /* Eylem çipleriyle kategori çiplerini ayıran ince çizgi. Aynı biçimdeler
     ama aynı şey değiller: solu bir panel açıyor, sağı rafı süzüyor. Boşluk
     bırakmak yetmezdi — yatay kaydırmada boşluk, sadece kaydırma gibi
     okunuyor. */
  cipAyrac: {
    width: 1,
    height: 20,
    backgroundColor: colors.outlineVariant,
    marginHorizontal: 2,
  },
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
  bos: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 44, gap: 8 },
  bosBaslik: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginTop: 4 },
  bosMetin: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  bosCta: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: shape.full,
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
    marginTop: 6,
  },
  bosCtaText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  secenek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  secenekText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  secenekTextSel: { fontWeight: '800', color: colors.primary },
  secenekAlt: { fontSize: 11.5, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 3 },
  grupBaslik: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.7,
    marginTop: 18,
    marginBottom: 9,
  },
  hapSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hap: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: shape.full,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  hapSel: { backgroundColor: colors.primaryContainer, borderColor: 'transparent' },
  hapText: { fontSize: 12.5, fontWeight: '700', color: colors.onSurfaceVariant },
  hapTextSel: { color: colors.primary },
  aralik: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aralikAlan: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: shape.sm,
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  aralikInput: { fontSize: 14, color: colors.onSurface, padding: 0 },
  aralikAyrac: { color: colors.onSurfaceVariant, fontWeight: '700' },
  anahtarSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerLowest,
  },
  anahtarBaslik: { fontSize: 13.5, fontWeight: '800', color: colors.onSurface },
  anahtarAlt: { fontSize: 11.5, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 3 },
  temizle: {
    flex: 1,
    height: 48,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  temizleText: { fontSize: 14, fontWeight: '800', color: colors.onSurfaceVariant },
  uygula: {
    flex: 2,
    height: 48,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  uygulaText: { fontSize: 14, fontWeight: '800', color: '#fff' },
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
