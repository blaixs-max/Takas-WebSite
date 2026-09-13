import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { uyar } from '../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AdminHata,
  AvatarQueueRow,
  CampaignStatus,
  DisputeQueueRow,
  ReportQueueRow,
  ReviewQueueRow,
  adminHatalar,
  amIAdmin,
  approveListing,
  avatarKarari,
  campaignStatus,
  disputeEvidenceUrls,
  hataGoruldu,
  imzaliBaglantilar,
  loadAvatarQueue,
  loadDisputeQueue,
  loadReportQueue,
  loadReviewQueue,
  moderatePhoto,
  nedenEtiketi,
  puanOnizle,
  rejectListing,
  resolveDispute,
  resolveReport,
} from '../lib/admin';
import { supabase } from '../lib/supabase';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Yönetim — beş kuyruk, tek ekran.
 *
 * İlk kuyruk **İlanlar** (2026-09-08): satıcının onaya gönderdiği ilan burada
 * kareleri, metni ve beyanlarıyla görünür; yönetici sıfır fiyatını girer
 * (formül puanı hesaplar) ya da puanı elle yazar, onaylar ya da gerekçeyle
 * reddeder. Önceden bir görüntü modeli kareleri, bir dil modeli fiyatı
 * belirliyordu; ikisi de kalktı, kararı insan veriyor.
 *
 * Kuyruklar sunucuda `is_admin()` süzgecinden geçer; yetkisiz bir oturum bu
 * ekranı açsa bile boş liste görür. Ekranın gizlenmesi kolaylık, yetkinin
 * kendisi veri tabanındadır. Karar veren her aksiyon gerekçe ister ve denetim
 * kaydına yazılır.
 */

/** Binlik ayracı — Hermes'te Intl güvenilir değil, elle yazıyoruz. */
function binlik(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const SLOT_ADI: Record<string, string> = {
  front: 'Ön',
  back: 'Arka',
  left: 'Sol',
  right: 'Sağ',
  label: 'Etiket',
  damage: 'Hasar',
  parts: 'Parça',
};

type Sekme = 'ilan' | 'avatar' | 'itiraz' | 'sikayet' | 'hata';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [yetkili, setYetkili] = useState<boolean | null>(null);
  const [sekme, setSekme] = useState<Sekme>('ilan');
  const [ilanlar, setIlanlar] = useState<ReviewQueueRow[]>([]);
  const [kareUrl, setKareUrl] = useState<Record<string, string>>({});
  const [avatarlar, setAvatarlar] = useState<AvatarQueueRow[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<Record<string, string>>({});
  const [itirazlar, setItirazlar] = useState<DisputeQueueRow[]>([]);
  const [kampanya, setKampanya] = useState<CampaignStatus | null>(null);
  const [sikayetler, setSikayetler] = useState<ReportQueueRow[]>([]);
  const [hatalar, setHatalar] = useState<AdminHata[]>([]);
  const [acikYigin, setAcikYigin] = useState<number | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [islemde, setIslemde] = useState<string | null>(null);
  /* Tam ekran kare: küçük kutuda bulanıklık ya da yanlış açı görülmez. */
  const [buyukKare, setBuyukKare] = useState<string | null>(null);

  /* İlan başına form durumu: sıfır fiyatı metni, elle puan metni, önizleme. */
  const [fiyat, setFiyat] = useState<Record<string, string>>({});
  const [ellePuan, setEllePuan] = useState<Record<string, string>>({});
  const [onizleme, setOnizleme] = useState<Record<string, number | null>>({});
  const onizlemeZamanlayici = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Gerekçe soran tek bir sayfa: ilan reddi, avatar reddi, itiraz, şikâyet.
  const [gerekceIcin, setGerekceIcin] = useState<
    | { tip: 'ilanRet'; id: string }
    | { tip: 'kareRet'; id: string; path: string; productId: string }
    | { tip: 'avatarRet'; id: string }
    | { tip: 'itiraz'; id: string; kabul: boolean; esiginUstunde: boolean }
    | { tip: 'sikayet'; id: string; ihlal: boolean }
    | null
  >(null);
  const [gerekce, setGerekce] = useState('');
  const [iadeKargo, setIadeKargo] = useState('');

  /* Kuyruk yüklenemediğinde boş liste "kuyruk temiz" diye okunurdu — yetki
     düşmesi, oturum süresi, RPC uyumsuzluğu hepsi aynı görünürdü ve yönetici
     bakmazdı. Hata artık ayrı bir durumda ve kartla gösteriliyor. */
  const [yuklemeHatasi, setYuklemeHatasi] = useState<string | null>(null);

  const getir = useCallback(async () => {
    try {
      const [il, av, i, c, r, h] = await Promise.all([
        loadReviewQueue(),
        loadAvatarQueue(),
        loadDisputeQueue(),
        campaignStatus(),
        loadReportQueue(),
        adminHatalar(),
      ]);
      setIlanlar(il);
      setAvatarlar(av);
      setItirazlar(i);
      setKampanya(c);
      setSikayetler(r);
      setHatalar(h);
      setYuklemeHatasi(null);

      // Özel kovalar: görselleri göstermek için kısa ömürlü bağlantı gerekiyor.
      // Eşleme yol üzerinden; sıraya güvenmek kareleri birbirine karıştırırdı.
      const yollar = il.flatMap((x) => x.kareler.map((k) => k.path));
      setKareUrl(await imzaliBaglantilar('listing-photos', yollar));
      setAvatarUrl(await imzaliBaglantilar('avatars', av.map((a) => a.avatarPath)));
    } catch (e) {
      setYuklemeHatasi(e instanceof Error ? e.message : 'Kuyruk yüklenemedi.');
    }
  }, []);

  /* Önizleme isteklerinin sırası: geç dönen eski istek yeni değerin sonucunu
     ezmesin (1000 yaz → istek A; 2000 yaz → istek B; A sonra dönerse ekran
     1000'in puanını gösterir, alan 2000 der ve onay diyaloğu o sayıyı alıntılar). */
  const onizlemeSira = useRef<Record<string, number>>({});
  useEffect(
    () => () => {
      Object.values(onizlemeZamanlayici.current).forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const ok = await amIAdmin();
      setYetkili(ok);
      if (ok) await getir();
    })();
  }, [getir]);

  /**
   * Sıfır fiyatı yazılırken puan önizlemesi. Hesap sunucuda; her tuşta değil,
   * yazma durunca (400 ms) soruluyor.
   */
  function fiyatDegisti(il: ReviewQueueRow, metin: string) {
    setFiyat((f) => ({ ...f, [il.productId]: metin }));
    const eski = onizlemeZamanlayici.current[il.productId];
    if (eski) clearTimeout(eski);
    const sayi = Number(metin.replace(',', '.'));
    if (!Number.isFinite(sayi) || sayi <= 0) {
      setOnizleme((o) => ({ ...o, [il.productId]: null }));
      return;
    }
    onizlemeZamanlayici.current[il.productId] = setTimeout(async () => {
      const n = (onizlemeSira.current[il.productId] ?? 0) + 1;
      onizlemeSira.current[il.productId] = n;
      const p = await puanOnizle(sayi, il.condition, il.hasDamage);
      if (onizlemeSira.current[il.productId] !== n) return; // bayat cevap
      setOnizleme((o) => ({ ...o, [il.productId]: p }));
    }, 400);
  }

  async function ilanOnayla(il: ReviewQueueRow) {
    const f = Number((fiyat[il.productId] ?? '').replace(',', '.'));
    const e = Number((ellePuan[il.productId] ?? '').replace(',', '.'));
    const fiyatVar = Number.isFinite(f) && f > 0;
    const elleVar = Number.isFinite(e) && e > 0;
    if (!fiyatVar && !elleVar) {
      uyar('Puan gerekli', 'Sıfır fiyatını gir ya da puanı elle yaz.');
      return;
    }
    const puanMetni = elleVar ? `${binlik(e)} puan (elle)` : `${onizleme[il.productId] != null ? binlik(onizleme[il.productId]!) + ' puan' : 'formülden hesaplanan puan'}`;
    uyar('İlanı onayla', `“${il.title}” ${puanMetni} ile vitrine çıkacak. Kareler onaylı sayılacak.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onayla ve yayınla',
        onPress: async () => {
          setIslemde(il.productId);
          const s = await approveListing(
            il.productId,
            fiyatVar ? f : undefined,
            elleVar ? Math.round(e) : undefined,
          );
          setIslemde(null);
          if (!s.ok) {
            uyar('Onaylanamadı', s.message);
            await getir();
            return;
          }
          await getir();
        },
      },
    ]);
  }

  async function ilanReddet(productId: string, neden: string) {
    setIslemde(productId);
    const s = await rejectListing(productId, neden);
    setIslemde(null);
    if (!s.ok) {
      uyar('Reddedilemedi', s.message);
      return;
    }
    await getir();
  }

  /**
   * Kare düzeyinde ret: güvenlik gerekçesi (çocuk yüzü, uygunsuz içerik) olan
   * kare için. Satır `rejected` olur, dosya depodan silinir (gizlilik
   * sayfasının "karar anında silinir" taahhüdü), satıcıya `photo.rejected`
   * bildirimi gider. İlan hâlâ incelemede kalır — yönetici ardından ilanı
   * gerekçesiyle reddeder ki satıcı yeniden çeksin. Sıradan düzeltme (bulanık,
   * yanlış açı) için bu yol değil, ilan reddi kullanılır: kareler durur.
   */
  async function kareReddet(photoId: string, path: string, neden: string) {
    setIslemde(photoId);
    const s = await moderatePhoto(photoId, false, neden);
    if (s.ok && supabase) {
      const { error } = await supabase.storage.from('listing-photos').remove([path]);
      if (error) console.error('[kareReddet] dosya silinemedi', error.message);
    }
    setIslemde(null);
    if (!s.ok) {
      uyar('Reddedilemedi', s.message);
      return;
    }
    await getir();
  }

  async function avatarKarar(userId: string, uygun: boolean, neden?: string) {
    setIslemde(userId);
    const s = await avatarKarari(userId, uygun, neden);
    setIslemde(null);
    if (!s.ok) {
      uyar('İşlem tamamlanamadı', s.message);
      return;
    }
    await getir();
  }

  async function itirazKarari() {
    if (!gerekceIcin || gerekceIcin.tip !== 'itiraz') return;
    const hedef = gerekceIcin;
    const tutar = hedef.esiginUstunde && hedef.kabul ? Number(iadeKargo.replace(',', '.')) : undefined;

    setIslemde(hedef.id);
    const s = await resolveDispute(
      hedef.id,
      hedef.kabul,
      gerekce,
      false,
      Number.isFinite(tutar) ? tutar : undefined,
    );
    setIslemde(null);
    if (!s.ok) {
      uyar('Karar kaydedilemedi', s.message);
      return;
    }
    kapat();
    await getir();
  }

  async function sikayetKarari() {
    if (!gerekceIcin || gerekceIcin.tip !== 'sikayet') return;
    const hedef = gerekceIcin;
    setIslemde(hedef.id);
    const s = await resolveReport(hedef.id, hedef.ihlal, gerekce);
    setIslemde(null);
    if (!s.ok) {
      uyar('Karar kaydedilemedi', s.message);
      return;
    }
    kapat();
    await getir();
  }

  async function kanitlariGoster(disputeId: string) {
    const urls = await disputeEvidenceUrls(disputeId);
    if (urls.length === 0) {
      uyar('Kanıt yok', 'Bu talebe henüz kanıt yüklenmemiş.');
      return;
    }
    setBuyukKare(urls[0]);
  }

  function kapat() {
    setGerekceIcin(null);
    setGerekce('');
    setIadeKargo('');
  }

  if (yetkili === null) {
    return (
      <View style={[styles.root, styles.orta]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!yetkili) {
    return (
      <View style={[styles.root, styles.orta, { padding: 30 }]}>
        <MaterialIcons name="lock" size={44} color={colors.outline} />
        <Text style={styles.bosBaslik}>Bu sayfaya erişimin yok</Text>
        <Text style={styles.bosMetin}>Bu alan yalnızca yetkili hesaplar içindir.</Text>
        <Pressable style={styles.geriBtn} onPress={() => router.replace('/(tabs)/profile')}>
          <Text style={styles.ikincilText}>Hesabıma dön</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Yönetim</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sekmeler}
      >
        <SekmeDugmesi etiket="İlanlar" sayi={ilanlar.length} aktif={sekme === 'ilan'} onPress={() => setSekme('ilan')} />
        <SekmeDugmesi etiket="Avatarlar" sayi={avatarlar.length} aktif={sekme === 'avatar'} onPress={() => setSekme('avatar')} />
        <SekmeDugmesi etiket="İtirazlar" sayi={itirazlar.length} aktif={sekme === 'itiraz'} onPress={() => setSekme('itiraz')} />
        <SekmeDugmesi etiket="Şikâyetler" sayi={sikayetler.length} aktif={sekme === 'sikayet'} onPress={() => setSekme('sikayet')} />
        {/* Sayaç yalnızca GÖRÜLMEMİŞ hataları sayıyor. Toplamı saysaydı rozet
            hiç sıfırlanmaz ve bir süre sonra bakılmayan bir sayı olurdu. */}
        <SekmeDugmesi
          etiket="Hatalar"
          sayi={hatalar.filter((h) => !h.goruldu).length}
          aktif={sekme === 'hata'}
          onPress={() => setSekme('hata')}
        />
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={yenileniyor}
            onRefresh={async () => {
              setYenileniyor(true);
              await getir();
              setYenileniyor(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Kampanya yükümlülüğü: dağıtılan puan kalıcı bir borçtur, görünür dursun */}
        {kampanya && sekme === 'ilan' && (
          <View style={styles.kampanya}>
            <View style={styles.kampanyaSatir}>
              <Text style={styles.kampanyaEtiket}>Kampanya</Text>
              <Text style={styles.kampanyaDeger}>{kampanya.aktif ? 'açık' : 'kapalı'}</Text>
            </View>
            <View style={styles.kampanyaSatir}>
              <Text style={styles.kampanyaEtiket}>Dağıtılan puan (yükümlülük)</Text>
              <Text style={styles.kampanyaDeger}>{binlik(kampanya.dagitilanPuan)}</Text>
            </View>
            <View style={styles.kampanyaSatir}>
              <Text style={styles.kampanyaEtiket}>Yüksek kademe (1000+1000)</Text>
              <Text style={styles.kampanyaDeger}>
                {kampanya.erkenKalan > 0
                  ? `${kampanya.erkenKalan} yer kaldı`
                  : `doldu · ${kampanya.erkenKullanici} kullanıcı`}
              </Text>
            </View>
            <View style={styles.kampanyaSatir}>
              <Text style={styles.kampanyaEtiket}>Toplam kalan (300+300)</Text>
              <Text style={styles.kampanyaDeger}>{kampanya.kalanKontenjan} kullanıcı</Text>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------------- İLANLAR */}
        {yuklemeHatasi && (
          <View style={[styles.kart, { borderColor: colors.error, borderWidth: 1 }]}>
            <Text style={styles.kartBaslik}>Kuyruklar yüklenemedi</Text>
            <Text style={styles.kartAlt}>{yuklemeHatasi} Aşağı çekerek yeniden dene.</Text>
          </View>
        )}

        {sekme === 'ilan' && !yuklemeHatasi && ilanlar.length === 0 && (
          <Bos ikon="check-circle" metin="Onay bekleyen ilan yok. Kuyruk temiz." />
        )}

        {sekme === 'ilan' &&
          ilanlar.map((il) => {
            const oniz = onizleme[il.productId];
            const elle = (ellePuan[il.productId] ?? '').trim();
            return (
              <View key={il.productId} style={styles.kart}>
                <View style={styles.kartUst}>
                  <Text style={styles.kartBaslik}>{il.title}</Text>
                  <Text style={styles.kartAlt}>{il.beklemeSaati} saat</Text>
                </View>
                <Text style={styles.kartAlt}>
                  {il.sellerName} · {il.category}
                  {il.subCategory ? ` › ${il.subCategory}` : ''} · {il.location}
                </Text>

                {/* Kareler yan yana; dokununca tam ekran. Küçük kutuda bulanıklık
                    görülmez, karar için büyütmek şart. */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kareSerit}>
                  {il.kareler.map((k) => {
                    const url = kareUrl[k.path];
                    return (
                      <Pressable
                        key={k.photoId}
                        style={styles.kareKutu}
                        onPress={() => url && setBuyukKare(url)}
                        /* Uzun basış: bu kareyi güvenlik gerekçesiyle reddet ve sil. */
                        onLongPress={() =>
                          k.status !== 'rejected' &&
                          setGerekceIcin({ tip: 'kareRet', id: k.photoId, path: k.path, productId: il.productId })
                        }
                        accessibilityHint="Uzun basınca kare reddedilir ve silinir"
                      >
                        {url ? (
                          <Image source={{ uri: url }} style={styles.gorsel} />
                        ) : (
                          <MaterialIcons name="image" size={28} color={colors.outline} />
                        )}
                        <View style={[styles.kareEtiket, k.status === 'rejected' && styles.kareEtiketRet]}>
                          <Text style={styles.kareEtiketText}>{SLOT_ADI[k.slot] ?? k.slot}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.etiketler}>
                  <Etiket metin={il.condition} vurgu />
                  <Etiket metin={`Desi ${il.sizeClass}`} />
                  {il.hasDamage && <Etiket metin="Hasar beyanı var" vurgu />}
                  {il.isSet && <Etiket metin="Set / parçalı" />}
                  {il.points != null && <Etiket metin={`Önceki puan ${binlik(il.points)}`} />}
                </View>

                {il.description ? (
                  <Text style={styles.mesajKutusu}>“{il.description}”</Text>
                ) : (
                  <Text style={[styles.kartAlt, { marginTop: 8 }]}>Açıklama yazılmamış.</Text>
                )}

                {/* Puan: sıfır fiyatı → formül, ya da elle. İkisi de doluysa elle
                    yazılan kazanır — sunucu da öyle davranıyor. */}
                <View style={styles.puanSatir}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alanEtiket}>Sıfır fiyatı (₺)</Text>
                    <TextInput
                      style={styles.alan}
                      placeholder="örn. 1599"
                      placeholderTextColor={colors.onSurfaceVariant}
                      keyboardType="decimal-pad"
                      value={fiyat[il.productId] ?? ''}
                      onChangeText={(m) => fiyatDegisti(il, m)}
                    />
                  </View>
                  <View style={styles.puanOk}>
                    <MaterialIcons name="arrow-forward" size={18} color={colors.onSurfaceVariant} />
                    <Text style={styles.puanOnizleme}>
                      {oniz != null ? `${binlik(oniz)} puan` : '— puan'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alanEtiket}>Elle puan</Text>
                    <TextInput
                      style={[styles.alan, elle.length > 0 && styles.alanVurgu]}
                      placeholder="isteğe bağlı"
                      placeholderTextColor={colors.onSurfaceVariant}
                      keyboardType="number-pad"
                      value={ellePuan[il.productId] ?? ''}
                      onChangeText={(m) => setEllePuan((e) => ({ ...e, [il.productId]: m }))}
                    />
                  </View>
                </View>

                <View style={styles.aksiyonlar}>
                  <Pressable
                    style={styles.birincil}
                    disabled={islemde === il.productId}
                    onPress={() => ilanOnayla(il)}
                  >
                    {islemde === il.productId ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.birincilText}>Onayla ve yayınla</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.ikincil}
                    disabled={islemde === il.productId}
                    onPress={() => setGerekceIcin({ tip: 'ilanRet', id: il.productId })}
                  >
                    <Text style={styles.ikincilText}>Reddet</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

        {/* -------------------------------------------------------- AVATARLAR */}
        {sekme === 'avatar' && avatarlar.length === 0 && (
          <Bos ikon="account-circle" metin="Bekleyen profil fotoğrafı yok." />
        )}

        {sekme === 'avatar' &&
          avatarlar.map((a) => (
            <View key={a.userId} style={styles.kart}>
              <View style={styles.kareUst}>
                <Pressable
                  style={styles.avatarKutu}
                  onPress={() => avatarUrl[a.avatarPath] && setBuyukKare(avatarUrl[a.avatarPath])}
                >
                  {avatarUrl[a.avatarPath] ? (
                    <Image source={{ uri: avatarUrl[a.avatarPath] }} style={styles.gorsel} />
                  ) : (
                    <MaterialIcons name="person" size={28} color={colors.outline} />
                  )}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kartBaslik}>{a.fullName || 'Adsız üye'}</Text>
                  <Text style={styles.kartAlt}>{a.beklemeSaati} saattir bekliyor</Text>
                  <Text style={[styles.kartAlt, { marginTop: 6 }]}>
                    Müstehcen, şiddet, nefret sembolü, çocuk yüzü ya da iletişim bilgisi varsa
                    reddet. Fotoğrafın kişinin kendisi olması gerekmiyor.
                  </Text>
                </View>
              </View>
              <View style={styles.aksiyonlar}>
                <Pressable
                  style={styles.birincil}
                  disabled={islemde === a.userId}
                  onPress={() => avatarKarar(a.userId, true)}
                >
                  {islemde === a.userId ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.birincilText}>Onayla</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.ikincil}
                  disabled={islemde === a.userId}
                  onPress={() => setGerekceIcin({ tip: 'avatarRet', id: a.userId })}
                >
                  <Text style={styles.ikincilText}>Reddet</Text>
                </Pressable>
              </View>
            </View>
          ))}

        {/* --------------------------------------------------------- İTİRAZLAR */}
        {sekme === 'itiraz' && itirazlar.length === 0 && (
          <Bos ikon="gavel" metin="Karar bekleyen itiraz yok." />
        )}

        {sekme === 'itiraz' &&
          itirazlar.map((d) => (
            <View key={d.disputeId} style={styles.kart}>
              <View style={styles.kartUst}>
                <Text style={styles.kartBaslik}>{d.productTitle}</Text>
                <Text style={styles.puan}>{d.points} puan</Text>
              </View>
              <Text style={styles.gerekceMetin}>“{d.reason}”</Text>

              <View style={styles.etiketler}>
                <Etiket
                  metin={d.esiginUstunde ? 'Eşiğin üstünde · ürün geri döner' : 'Ürün alıcıda kalır'}
                  vurgu={d.esiginUstunde}
                />
                <Etiket metin={`${d.kanitSayisi} kanıt`} vurgu={d.kanitSayisi === 0} />
                <Etiket metin={`${d.beklemeSaati} saat`} />
              </View>

              {d.disputeStatus === 'NEEDS_EVIDENCE' && (
                <Text style={styles.uyari}>
                  Kanıt bekleniyor. Süre dolarsa talep kendiliğinden reddedilir.
                </Text>
              )}

              <Pressable style={styles.kanitBtn} onPress={() => kanitlariGoster(d.disputeId)}>
                <MaterialIcons name="photo-library" size={16} color={colors.primary} />
                <Text style={styles.kanitBtnText}>Kanıtlara bak</Text>
              </Pressable>

              <View style={styles.aksiyonlar}>
                <Pressable
                  style={styles.birincil}
                  disabled={islemde === d.disputeId}
                  onPress={() =>
                    setGerekceIcin({ tip: 'itiraz', id: d.disputeId, kabul: true, esiginUstunde: d.esiginUstunde })
                  }
                >
                  <Text style={styles.birincilText}>İadeyi kabul et</Text>
                </Pressable>
                <Pressable
                  style={styles.ikincil}
                  disabled={islemde === d.disputeId}
                  onPress={() =>
                    setGerekceIcin({ tip: 'itiraz', id: d.disputeId, kabul: false, esiginUstunde: d.esiginUstunde })
                  }
                >
                  <Text style={styles.ikincilText}>Reddet</Text>
                </Pressable>
              </View>
            </View>
          ))}

        {/* -------------------------------------------------------- ŞİKÂYETLER */}
        {sekme === 'sikayet' && sikayetler.length === 0 && (
          <Bos ikon="flag" metin="Bekleyen şikâyet yok." />
        )}

        {sekme === 'sikayet' &&
          sikayetler.map((r) => (
            <View key={r.reportId} style={styles.kart}>
              <View style={styles.kartUst}>
                <Text style={styles.kartBaslik}>{nedenEtiketi(r.reason)}</Text>
                <Text style={styles.kartAlt}>{r.beklemeSaati} saat</Text>
              </View>

              <View style={styles.etiketler}>
                <Etiket metin={r.sistemIsareti ? 'Sistem işareti' : 'Kullanıcı bildirdi'} vurgu={!r.sistemIsareti} />
                <Etiket metin={r.urun} />
              </View>

              <Text style={styles.mesajKutusu}>“{r.mesaj}”</Text>
              {r.note && <Text style={styles.kartAlt}>{r.note}</Text>}

              <View style={styles.aksiyonlar}>
                <Pressable
                  style={styles.birincil}
                  disabled={islemde === r.reportId}
                  onPress={() => setGerekceIcin({ tip: 'sikayet', id: r.reportId, ihlal: true })}
                >
                  <Text style={styles.birincilText}>İhlal var</Text>
                </Pressable>
                <Pressable
                  style={styles.ikincil}
                  disabled={islemde === r.reportId}
                  onPress={() => setGerekceIcin({ tip: 'sikayet', id: r.reportId, ihlal: false })}
                >
                  <Text style={styles.ikincilText}>İhlal yok</Text>
                </Pressable>
              </View>
            </View>
          ))}

        {/* ----------------------------------------------------------- HATALAR */}
        {sekme === 'hata' && hatalar.length === 0 && (
          <Bos ikon="check-circle" metin="Bildirilen hata yok." />
        )}

        {sekme === 'hata' &&
          hatalar.map((h) => (
            <View key={h.id} style={[styles.kart, h.goruldu && styles.kartSolgun]}>
              <View style={styles.hataUst}>
                <View style={styles.hataRozet}>
                  <Text style={styles.hataRozetText}>×{h.tekrar}</Text>
                </View>
                <Text style={styles.hataEkran} numberOfLines={1}>
                  {h.ekran || 'bilinmeyen ekran'}
                </Text>
                <Text style={styles.hataMeta}>
                  {h.platform}
                  {h.surum ? ` · ${h.surum}` : ''}
                </Text>
              </View>

              <Text style={styles.hataMesaj}>{h.mesaj}</Text>
              <Text style={styles.hataMeta}>
                Son: {tarih(h.sonAt)} · İlk: {tarih(h.ilkAt)} · {h.kullanici ? 'oturumlu' : 'oturumsuz'}
              </Text>

              {h.yigin && acikYigin === h.id && <Text style={styles.hataYigin}>{h.yigin}</Text>}

              <View style={styles.aksiyonlar}>
                {h.yigin && (
                  <Pressable style={styles.ikincil} onPress={() => setAcikYigin(acikYigin === h.id ? null : h.id)}>
                    <Text style={styles.ikincilText}>{acikYigin === h.id ? 'Yığını gizle' : 'Yığını gör'}</Text>
                  </Pressable>
                )}
                {!h.goruldu && (
                  <Pressable
                    style={styles.ikincil}
                    onPress={async () => {
                      await hataGoruldu(h.id);
                      await getir();
                    }}
                  >
                    <Text style={styles.ikincilText}>Gördüm</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
      </ScrollView>

      {/* Tam ekran görsel */}
      <Modal visible={buyukKare !== null} transparent animationType="fade" onRequestClose={() => setBuyukKare(null)}>
        <Pressable style={styles.buyukPerde} onPress={() => setBuyukKare(null)}>
          {buyukKare && <Image source={{ uri: buyukKare }} style={styles.buyukGorsel} resizeMode="contain" />}
          <Text style={styles.buyukIpucu}>Kapatmak için dokun</Text>
        </Pressable>
      </Modal>

      {/* Gerekçe — sunucu boş gerekçeyi reddediyor, burada da zorunlu */}
      <Modal visible={gerekceIcin !== null} transparent animationType="fade" onRequestClose={kapat}>
        <Pressable style={styles.perde} onPress={kapat}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
            <Text style={styles.sheetBaslik}>
              {gerekceIcin?.tip === 'ilanRet'
                ? 'İlan neden reddedildi?'
                : gerekceIcin?.tip === 'kareRet'
                  ? 'Bu kare neden silinsin?'
                : gerekceIcin?.tip === 'avatarRet'
                  ? 'Fotoğraf neden reddedildi?'
                  : gerekceIcin?.tip === 'sikayet'
                    ? gerekceIcin.ihlal
                      ? 'İhlal neden onaylandı?'
                      : 'Şikâyet neden reddedildi?'
                    : gerekceIcin?.kabul
                      ? 'İade neden kabul edildi?'
                      : 'Talep neden reddedildi?'}
            </Text>
            <Text style={styles.sheetMetin}>
              {gerekceIcin?.tip === 'ilanRet'
                ? 'Gerekçe satıcıya bildirimle gider; hangi kareyi ya da bilgiyi düzelteceğini yaz. Kareler silinmez.'
                : gerekceIcin?.tip === 'kareRet'
                  ? 'Yalnızca güvenlik gerekçesi için (çocuk yüzü, uygunsuz içerik, başka kişi): dosya depodan silinir, satıcıya bildirim gider. Bulanık ya da yanlış açı için ilanı reddet, kare dursun.'
                : gerekceIcin?.tip === 'avatarRet'
                  ? 'Gerekçe kullanıcıya gösterilir; fotoğraf depodan silinir.'
                  : 'Gerekçe denetim kaydına yazılır ve sonradan değiştirilemez.'}
            </Text>

            <TextInput
              style={styles.giris}
              placeholder="Gerekçe"
              placeholderTextColor={colors.onSurfaceVariant}
              value={gerekce}
              onChangeText={setGerekce}
              multiline
            />

            {gerekceIcin?.tip === 'itiraz' && gerekceIcin.kabul && gerekceIcin.esiginUstunde && (
              <>
                <Text style={styles.sheetMetin}>
                  Ürün satıcıya geri gönderilecek. İade kargosu tutarı satıcıya borç yazılır.
                </Text>
                <TextInput
                  style={[styles.giris, { minHeight: 48 }]}
                  placeholder="İade kargosu (₺)"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={iadeKargo}
                  onChangeText={setIadeKargo}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            <View style={styles.sheetButonlar}>
              <Pressable style={styles.ikincil} onPress={kapat}>
                <Text style={styles.ikincilText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={[styles.birincil, gerekce.trim().length === 0 && styles.kapali]}
                disabled={gerekce.trim().length === 0 || islemde !== null}
                onPress={() => {
                  if (gerekceIcin?.tip === 'ilanRet') {
                    const id = gerekceIcin.id;
                    const neden = gerekce;
                    kapat();
                    ilanReddet(id, neden);
                  } else if (gerekceIcin?.tip === 'kareRet') {
                    const { id, path } = gerekceIcin;
                    const neden = gerekce;
                    kapat();
                    kareReddet(id, path, neden);
                  } else if (gerekceIcin?.tip === 'avatarRet') {
                    const id = gerekceIcin.id;
                    const neden = gerekce;
                    kapat();
                    avatarKarar(id, false, neden);
                  } else if (gerekceIcin?.tip === 'sikayet') {
                    sikayetKarari();
                  } else {
                    itirazKarari();
                  }
                }}
              >
                <Text style={styles.birincilText}>Kaydet</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SekmeDugmesi({
  etiket,
  sayi,
  aktif,
  onPress,
}: {
  etiket: string;
  sayi: number;
  aktif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.sekme, aktif && styles.sekmeAktif]} onPress={onPress}>
      <Text style={[styles.sekmeText, aktif && styles.sekmeTextAktif]}>
        {etiket} {sayi > 0 ? `(${sayi})` : ''}
      </Text>
    </Pressable>
  );
}

function Etiket({ metin, vurgu }: { metin: string; vurgu?: boolean }) {
  return (
    <View style={[styles.etiket, vurgu && styles.etiketVurgu]}>
      <Text style={styles.etiketText}>{metin}</Text>
    </View>
  );
}

/** Kısa tarih — Hermes'te Intl güvenilir değil, elle biçimlendiriyoruz. */
function tarih(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Bos({ ikon, metin }: { ikon: keyof typeof MaterialIcons.glyphMap; metin: string }) {
  return (
    <View style={styles.bos}>
      <MaterialIcons name={ikon} size={40} color={colors.outline} />
      <Text style={styles.bosMetin}>{metin}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  orta: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  appTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sekmeler: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  sekme: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  sekmeAktif: { backgroundColor: colors.primaryContainer },
  sekmeText: { fontSize: 13.5, fontWeight: '700', color: colors.onSurfaceVariant },
  sekmeTextAktif: { color: colors.onPrimaryContainer },
  kampanya: {
    padding: 13,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: 14,
    gap: 5,
  },
  kampanyaSatir: { flexDirection: 'row', justifyContent: 'space-between' },
  kampanyaEtiket: { fontSize: 12.5, fontWeight: '600', color: colors.onSurfaceVariant },
  kampanyaDeger: { fontSize: 12.5, fontWeight: '800', color: colors.onSurface },
  kart: {
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 12,
    ...elevation.level1,
  },
  kartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  kareUst: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  kareSerit: { marginTop: 12, marginHorizontal: -4 },
  kareKutu: {
    width: 104,
    height: 104,
    marginHorizontal: 4,
    borderRadius: shape.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kareEtiket: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: shape.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
  },
  kareEtiketRet: { backgroundColor: colors.error },
  kareEtiketText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  avatarKutu: {
    width: 84,
    height: 84,
    borderRadius: shape.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gorsel: { width: '100%', height: '100%' },
  kartBaslik: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.onSurface },
  kartAlt: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 3, lineHeight: 17 },
  puan: { fontSize: 14, fontWeight: '800', color: colors.primary },
  mesajKutusu: {
    fontSize: 13.5,
    color: colors.onSurface,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: 10,
    padding: 11,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
  },
  gerekceMetin: {
    fontSize: 13.5,
    color: colors.onSurface,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 19,
  },
  etiketler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  etiket: {
    paddingHorizontal: 10,
    height: 26,
    justifyContent: 'center',
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  etiketVurgu: { backgroundColor: colors.tertiaryContainer },
  etiketText: { fontSize: 11.5, fontWeight: '700', color: colors.onSurface },
  puanSatir: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  puanOk: { alignItems: 'center', paddingBottom: 12, gap: 2 },
  puanOnizleme: { fontSize: 12, fontWeight: '800', color: colors.primary },
  alanEtiket: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, marginBottom: 4 },
  alan: {
    height: 44,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  alanVurgu: { borderWidth: 1.5, borderColor: colors.primary },
  uyari: { fontSize: 12, fontWeight: '600', color: colors.error, marginTop: 9 },
  kanitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  kanitBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  aksiyonlar: { flexDirection: 'row', gap: 10, marginTop: 13 },
  kartSolgun: { opacity: 0.55 },
  hataUst: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hataRozet: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: shape.full,
    justifyContent: 'center',
    backgroundColor: colors.errorContainer,
  },
  hataRozetText: { fontSize: 11, fontWeight: '800', color: colors.error },
  hataEkran: { flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.onSurface },
  hataMeta: { fontSize: 11, fontWeight: '500', color: colors.onSurfaceVariant },
  hataMesaj: { fontSize: 13, fontWeight: '600', color: colors.onSurface, lineHeight: 18, marginBottom: 6 },
  hataYigin: {
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.onSurfaceVariant,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 10,
    padding: 10,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
  },
  birincil: {
    flex: 1,
    height: 44,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birincilText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  ikincil: {
    flex: 1,
    height: 44,
    borderRadius: shape.full,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ikincilText: { color: colors.onSurface, fontWeight: '700', fontSize: 13.5 },
  kapali: { opacity: 0.45 },
  bos: { alignItems: 'center', gap: 10, paddingTop: 70, paddingHorizontal: 30 },
  bosBaslik: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  bosMetin: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
  geriBtn: {
    marginTop: 14,
    paddingHorizontal: 22,
    height: 44,
    borderRadius: shape.full,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perde: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  buyukPerde: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  buyukGorsel: { width: '100%', height: '80%' },
  buyukIpucu: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginTop: 12 },
  sheet: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: shape.lg,
    borderTopRightRadius: shape.lg,
    padding: 20,
    paddingBottom: 34,
    gap: 10,
  },
  sheetBaslik: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  sheetMetin: { fontSize: 12.5, color: colors.onSurfaceVariant, fontWeight: '500', lineHeight: 18 },
  giris: {
    minHeight: 84,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
    padding: 13,
    fontSize: 14,
    color: colors.onSurface,
    textAlignVertical: 'top',
  },
  sheetButonlar: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
