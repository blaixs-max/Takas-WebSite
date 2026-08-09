import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CampaignStatus,
  DisputeQueueRow,
  PhotoQueueRow,
  amIAdmin,
  campaignStatus,
  disputeEvidenceUrls,
  imzaliBaglantilar,
  loadDisputeQueue,
  loadPhotoQueue,
  moderatePhoto,
  resolveDispute,
} from '../lib/admin';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Yönetim — iki kuyruk, tek ekran.
 *
 * Kuyruklar sunucuda `is_admin()` süzgecinden geçer; yetkisiz bir oturum bu
 * ekranı açsa bile boş liste görür. Ekranın gizlenmesi kolaylık, yetkinin
 * kendisi veri tabanındadır.
 *
 * Karar veren her aksiyon gerekçe ister ve denetim kaydına yazılır.
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

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [yetkili, setYetkili] = useState<boolean | null>(null);
  const [sekme, setSekme] = useState<'kare' | 'itiraz'>('kare');
  const [kareler, setKareler] = useState<PhotoQueueRow[]>([]);
  const [kareUrl, setKareUrl] = useState<Record<string, string>>({});
  const [itirazlar, setItirazlar] = useState<DisputeQueueRow[]>([]);
  const [kampanya, setKampanya] = useState<CampaignStatus | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [islemde, setIslemde] = useState<string | null>(null);

  // Gerekçe soran tek bir sayfa: hem kare reddi hem itiraz kararı kullanır.
  const [gerekceIcin, setGerekceIcin] = useState<
    | { tip: 'kareRet'; id: string }
    | { tip: 'itiraz'; id: string; kabul: boolean; esiginUstunde: boolean }
    | null
  >(null);
  const [gerekce, setGerekce] = useState('');
  const [iadeKargo, setIadeKargo] = useState('');

  const getir = useCallback(async () => {
    const [k, i, c] = await Promise.all([loadPhotoQueue(), loadDisputeQueue(), campaignStatus()]);
    setKareler(k);
    setItirazlar(i);
    setKampanya(c);

    // Özel kova: görselleri göstermek için kısa ömürlü bağlantı gerekiyor.
    // Eşlemeyi yol üzerinden kuruyoruz; sıraya güvenmek, bir bağlantı
    // üretilemediğinde kareleri birbirine karıştırırdı.
    const yolaGore = await imzaliBaglantilar(
      'listing-photos',
      k.map((x) => x.storagePath),
    );
    const eslesme: Record<string, string> = {};
    for (const x of k) {
      const url = yolaGore[x.storagePath];
      if (url) eslesme[x.photoId] = url;
    }
    setKareUrl(eslesme);
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await amIAdmin();
      setYetkili(ok);
      if (ok) await getir();
    })();
  }, [getir]);

  async function kareKarari(photoId: string, uygun: boolean, neden?: string) {
    setIslemde(photoId);
    const s = await moderatePhoto(photoId, uygun, neden);
    setIslemde(null);
    if (!s.ok) {
      Alert.alert('İşlem tamamlanamadı', s.message);
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
      Alert.alert('Karar kaydedilemedi', s.message);
      return;
    }
    kapat();
    await getir();
  }

  async function kanitlariGoster(disputeId: string) {
    const urls = await disputeEvidenceUrls(disputeId);
    if (urls.length === 0) {
      Alert.alert('Kanıt yok', 'Bu talebe henüz kanıt yüklenmemiş.');
      return;
    }
    // Kanıtı ayrı bir görüntüleyicide değil, uyarı ile listeliyoruz: karar
    // ekranı basit kalsın, kareler tarayıcıda tam boy açılsın.
    Alert.alert('Kanıtlar', `${urls.length} kare yüklenmiş. Karar için hepsine bakın.`);
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
        <Text style={styles.bosBaslik}>Bu alan yönetim içindir</Text>
        <Text style={styles.bosMetin}>Hesabınızın yönetim yetkisi yok.</Text>
        <Pressable style={styles.geriBtn} onPress={() => router.back()}>
          <Text style={styles.ikincilText}>Geri dön</Text>
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

      <View style={styles.sekmeler}>
        <Sekme
          etiket="Kareler"
          sayi={kareler.length}
          aktif={sekme === 'kare'}
          onPress={() => setSekme('kare')}
        />
        <Sekme
          etiket="İtirazlar"
          sayi={itirazlar.length}
          aktif={sekme === 'itiraz'}
          onPress={() => setSekme('itiraz')}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
        {kampanya && (
          <View style={styles.kampanya}>
            <View style={styles.kampanyaSatir}>
              <Text style={styles.kampanyaEtiket}>Kampanya</Text>
              <Text style={styles.kampanyaDeger}>
                {kampanya.aktif ? 'açık' : 'kapalı'}
              </Text>
            </View>
            <View style={styles.kampanyaSatir}>
              <Text style={styles.kampanyaEtiket}>Dağıtılan puan (yükümlülük)</Text>
              <Text style={styles.kampanyaDeger}>{binlik(kampanya.dagitilanPuan)}</Text>
            </View>
            <View style={styles.kampanyaSatir}>
              <Text style={styles.kampanyaEtiket}>Kalan kontenjan</Text>
              <Text style={styles.kampanyaDeger}>
                {kampanya.kalanKontenjan} kullanıcı
              </Text>
            </View>
          </View>
        )}

        {sekme === 'kare' && kareler.length === 0 && (
          <Bos ikon="check-circle" metin="Bekleyen kare yok. Kuyruk temiz." />
        )}

        {sekme === 'kare' &&
          kareler.map((k) => (
            <View key={k.photoId} style={styles.kart}>
              <View style={styles.kareUst}>
                <View style={styles.kareGorsel}>
                  {kareUrl[k.photoId] ? (
                    <Image source={{ uri: kareUrl[k.photoId] }} style={styles.gorsel} />
                  ) : (
                    <MaterialIcons name="image" size={28} color={colors.outline} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kartBaslik}>{k.productTitle}</Text>
                  <Text style={styles.kartAlt}>
                    {SLOT_ADI[k.slot] ?? k.slot} karesi · {k.beklemeSaati} saattir bekliyor
                  </Text>
                </View>
              </View>
              <View style={styles.aksiyonlar}>
                <Pressable
                  style={styles.birincil}
                  disabled={islemde === k.photoId}
                  onPress={() => kareKarari(k.photoId, true)}
                >
                  {islemde === k.photoId ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.birincilText}>Onayla</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.ikincil}
                  disabled={islemde === k.photoId}
                  onPress={() => setGerekceIcin({ tip: 'kareRet', id: k.photoId })}
                >
                  <Text style={styles.ikincilText}>Reddet</Text>
                </Pressable>
              </View>
            </View>
          ))}

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
                <Etiket
                  metin={`${d.kanitSayisi} kanıt`}
                  vurgu={d.kanitSayisi === 0}
                />
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
                    setGerekceIcin({
                      tip: 'itiraz',
                      id: d.disputeId,
                      kabul: true,
                      esiginUstunde: d.esiginUstunde,
                    })
                  }
                >
                  <Text style={styles.birincilText}>İadeyi kabul et</Text>
                </Pressable>
                <Pressable
                  style={styles.ikincil}
                  disabled={islemde === d.disputeId}
                  onPress={() =>
                    setGerekceIcin({
                      tip: 'itiraz',
                      id: d.disputeId,
                      kabul: false,
                      esiginUstunde: d.esiginUstunde,
                    })
                  }
                >
                  <Text style={styles.ikincilText}>Reddet</Text>
                </Pressable>
              </View>
            </View>
          ))}
      </ScrollView>

      {/* Gerekçe — sunucu boş gerekçeyi reddediyor, burada da zorunlu */}
      <Modal
        visible={gerekceIcin !== null}
        transparent
        animationType="fade"
        onRequestClose={kapat}
      >
        <Pressable style={styles.perde} onPress={kapat}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
            <Text style={styles.sheetBaslik}>
              {gerekceIcin?.tip === 'kareRet'
                ? 'Kare neden reddedildi?'
                : gerekceIcin?.kabul
                  ? 'İade neden kabul edildi?'
                  : 'Talep neden reddedildi?'}
            </Text>
            <Text style={styles.sheetMetin}>
              {gerekceIcin?.tip === 'kareRet'
                ? 'Gerekçe kullanıcıya gösterilir; neyi düzelteceğini bilmeli.'
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
                  if (gerekceIcin?.tip === 'kareRet') {
                    const id = gerekceIcin.id;
                    kapat();
                    kareKarari(id, false, gerekce);
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

function Sekme({
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
  appTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sekmeler: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  sekme: {
    flex: 1,
    height: 40,
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
  kartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kareUst: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  kareGorsel: {
    width: 72,
    height: 72,
    borderRadius: shape.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gorsel: { width: '100%', height: '100%' },
  kartBaslik: { fontSize: 14.5, fontWeight: '700', color: colors.onSurface },
  kartAlt: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 3 },
  puan: { fontSize: 14, fontWeight: '800', color: colors.primary },
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
  uyari: { fontSize: 12, fontWeight: '600', color: colors.error, marginTop: 9 },
  kanitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  kanitBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  aksiyonlar: { flexDirection: 'row', gap: 10, marginTop: 13 },
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
  bosMetin: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
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
