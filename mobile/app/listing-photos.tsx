import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { uyar } from '../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoSlot, SLOT_INFO, gerekliSlotlar } from '../data/photoSlots';
import { PhotoRow, loadPhotos, publishListing, uploadPhoto } from '../lib/photos';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Yedi kareyi tek tek gezdiren çekim akışı.
 *
 * Ekran bir seferde tek kare ister ve neden istediğini söyler. Kullanıcı
 * sırayı atlayabilir ama zorunlu kareler tamamlanmadan ilan yayına giremez —
 * o kararı sunucu veriyor, buradaki kontrol yalnızca kullanıcıyı boşuna
 * bekletmemek için.
 */
export default function ListingPhotos() {
  const { id, hasDamage, isSet, title } = useLocalSearchParams<{
    id: string;
    hasDamage?: string;
    isSet?: string;
    title?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const slotlar = gerekliSlotlar(hasDamage === '1', isSet === '1');
  const [aktif, setAktif] = useState(0);
  const [kareler, setKareler] = useState<Record<string, PhotoRow>>({});
  const [yerel, setYerel] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState<PhotoSlot | null>(null);
  const [yayinlaniyor, setYayinlaniyor] = useState(false);

  const tazele = useCallback(async () => {
    if (!id) return;
    const liste = await loadPhotos(id);
    setKareler(Object.fromEntries(liste.map((k) => [k.slot, k])));
  }, [id]);

  useEffect(() => {
    tazele();
  }, [tazele]);

  const slot = slotlar[aktif];
  const bilgi = SLOT_INFO[slot];

  /**
   * Reddedilen kare tamamlanmış sayılmaz. Sunucu zaten geçirmiyor; burada da
   * saymazsak kullanıcı "yayına al"a basıp hata almak yerine hangi kareyi
   * yeniden çekeceğini görür.
   */
  const tamam = (s: PhotoSlot) =>
    kareler[s] ? kareler[s].moderationStatus !== 'rejected' : Boolean(yerel[s]);

  const cekilen = slotlar.filter(tamam).length;
  const hepsiVar = cekilen === slotlar.length;

  async function cek(kaynak: 'kamera' | 'galeri') {
    const izin =
      kaynak === 'kamera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      uyar(
        'İzin gerekli',
        kaynak === 'kamera'
          ? 'Fotoğraf çekmek için kamera izni vermen gerekiyor.'
          : 'Galeriden seçmek için izin vermen gerekiyor.',
      );
      return;
    }

    const secenekler: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    };
    const sonuc =
      kaynak === 'kamera'
        ? await ImagePicker.launchCameraAsync(secenekler)
        : await ImagePicker.launchImageLibraryAsync(secenekler);

    if (sonuc.canceled || !sonuc.assets?.[0]?.uri) return;
    const uri = sonuc.assets[0].uri;

    setYerel((y) => ({ ...y, [slot]: uri }));
    setYukleniyor(slot);
    const cikti = await uploadPhoto(id!, slot, uri);
    setYukleniyor(null);

    if (!cikti.ok) {
      setYerel((y) => {
        const k = { ...y };
        delete k[slot];
        return k;
      });
      uyar('Yüklenemedi', cikti.message);
      return;
    }
    await tazele();
    if (aktif < slotlar.length - 1) setAktif(aktif + 1);
  }

  async function yayinla() {
    setYayinlaniyor(true);
    // Kapak: kullanıcı seçmediyse ön görünüm. Hangi kare kapak olursa olsun
    // ürünün durumu kapağın üzerinde rozet olarak görünür.
    const sonuc = await publishListing(id!, 'front');
    setYayinlaniyor(false);
    if (!sonuc.ok) {
      uyar('Yayına alınamadı', sonuc.message);
      await tazele();
      return;
    }
    uyar('İlan yayında', `${title ?? 'İlanın'} rafa eklendi.`, [
      { text: 'Tamam', onPress: () => router.replace('/') },
    ]);
  }

  const durum = kareler[slot];
  /* Gösterilecek kare: bu oturumda çekilen dosya, yoksa sunucudaki. */
  const onizlemeUri = yerel[slot] ?? durum?.url ?? null;
  /* Bu kare bitti mi — reddedilen bitmiş sayılmaz, yeniden çekilmeli. */
  const slotBitti = Boolean(durum) && durum.moderationStatus !== 'rejected';

  return (
    <View style={styles.root}>
      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Fotoğraflar</Text>
        <Text style={styles.sayac}>
          {cekilen}/{slotlar.length}
        </Text>
      </View>

      {/* İlerleme: her zorunlu kare bir çubuk */}
      <View style={styles.stepbar}>
        {slotlar.map((s, i) => (
          <Pressable
            key={s}
            onPress={() => setAktif(i)}
            style={[
              styles.step,
              tamam(s) && styles.stepDone,
              kareler[s]?.moderationStatus === 'rejected' && styles.stepRed,
              i === aktif && styles.stepActive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 140 }}>
        <View style={styles.rehber}>
          <View style={styles.rehberIc}>
            <MaterialIcons name={bilgi.ikon} size={26} color={colors.onPrimaryContainer} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rehberBaslik}>
              {aktif + 1}. {bilgi.baslik}
            </Text>
            <Text style={styles.rehberYonerge}>{bilgi.yonerge}</Text>
            <Text style={styles.rehberNeden}>{bilgi.neden}</Text>
          </View>
        </View>

        {/* Önizleme.

            Buraya yalnızca `yerel[slot]` — yani o oturumda seçiciyle çekilen
            dosya — çiziliyordu. Ekrana geri dönünce `yerel` boş olduğu için
            çoktan yüklenmiş, hatta incelemeden geçmiş bir kare bile "Bu kare
            henüz çekilmedi" diye görünüyordu: durum çipi "İncelemeden geçti"
            derken hemen üstünde boş bir kutu duruyordu. Artık yerel dosya
            yoksa sunucudaki kare gösteriliyor. */}
        <View style={styles.onizleme}>
          {onizlemeUri ? (
            <Image source={{ uri: onizlemeUri }} style={styles.onizlemeImg} />
          ) : durum ? (
            /* Kare var ama bağlantı üretilemedi — "çekilmedi" demek yanlış olur. */
            <View style={styles.onizlemeBos}>
              <MaterialIcons name="image-not-supported" size={40} color={colors.outline} />
              <Text style={styles.onizlemeBosText}>Kare yüklendi, önizleme açılamadı</Text>
            </View>
          ) : (
            <View style={styles.onizlemeBos}>
              <MaterialIcons name="add-a-photo" size={40} color={colors.outline} />
              <Text style={styles.onizlemeBosText}>Bu fotoğraf henüz eklenmedi</Text>
            </View>
          )}
          {yukleniyor === slot && (
            <View style={styles.yukleniyor}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.yukleniyorText}>Yükleniyor…</Text>
            </View>
          )}
        </View>

        {/* İnceleme durumu */}
        {durum && (
          <View
            style={[
              styles.durum,
              durum.moderationStatus === 'approved' && styles.durumOk,
              durum.moderationStatus === 'rejected' && styles.durumRed,
            ]}
          >
            <MaterialIcons
              name={
                durum.moderationStatus === 'approved'
                  ? 'check-circle'
                  : durum.moderationStatus === 'rejected'
                    ? 'error'
                    : 'hourglass-empty'
              }
              size={20}
              color={
                durum.moderationStatus === 'approved'
                  ? colors.primary
                  : durum.moderationStatus === 'rejected'
                    ? colors.error
                    : colors.onSurfaceVariant
              }
            />
            <Text style={styles.durumText}>
              {durum.moderationStatus === 'approved' && 'İncelemeden geçti'}
              {durum.moderationStatus === 'pending' && 'İnceleniyor…'}
              {durum.moderationStatus === 'rejected' &&
                (durum.moderationReason || 'Bu kare kabul edilmedi, yeniden çekin')}
            </Text>
          </View>
        )}

        {/* Kare bitmişse çekim düğmeleri geri çekiliyor.

            İki dolu turkuaz düğme ekranın ortasında dururken, kare çoktan
            onaylanmış olsa bile yapılacak iş buymuş gibi okunuyordu. Bitmiş
            karede ikisi de sönükleşiyor ve birincisi "Yeniden çek" oluyor;
            asıl eylem alttaki "İlanı yayına al". Yetenek kaybolmuyor —
            galeriden seçme duruyor, yalnızca vurgusu düşüyor. Reddedilen kare
            bunun dışında: orada gerçekten yeniden çekmek gerekiyor, düğmeler
            dolu kalıyor. */}
        <View style={styles.cekButonlar}>
          <Pressable
            style={[styles.cekBtn, slotBitti && styles.cekBtnSessiz]}
            onPress={() => cek('kamera')}
          >
            <MaterialIcons
              name={slotBitti ? 'refresh' : 'photo-camera'}
              size={20}
              color={slotBitti ? colors.onSurfaceVariant : '#fff'}
            />
            <Text style={[styles.cekBtnText, slotBitti && styles.cekBtnTextSessiz]}>
              {slotBitti ? 'Yeniden çek' : 'Kamerayı aç'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.cekBtn, styles.cekBtnIkincil, slotBitti && styles.cekBtnSessiz]}
            onPress={() => cek('galeri')}
          >
            <MaterialIcons
              name="photo-library"
              size={20}
              color={slotBitti ? colors.onSurfaceVariant : colors.primary}
            />
            <Text
              style={[
                styles.cekBtnText,
                { color: colors.primary },
                slotBitti && styles.cekBtnTextSessiz,
              ]}
            >
              Galeriden seç
            </Text>
          </Pressable>
        </View>

        {/* Elle tazeleme yalnızca beklerken anlamlı. */}
        {durum?.moderationStatus === 'pending' && (
          <Pressable style={styles.tazele} onPress={tazele}>
            <MaterialIcons name="refresh" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.tazeleText}>İnceleme durumunu yenile</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          style={[styles.cta, (!hepsiVar || yayinlaniyor) && styles.ctaOff]}
          disabled={!hepsiVar || yayinlaniyor}
          onPress={yayinla}
        >
          {yayinlaniyor ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="publish" size={20} color="#fff" />
              {/* Rehber 10: tamamlama CTA'sı "Kontrole gönder". Düğme
                  `publish_listing`'i çağırıyor ama o kapı kareler
                  moderasyondan geçmeden açılmıyor — yani kullanıcı açısından
                  buradaki eylem gerçekten kontrole göndermek. */}
              <Text style={styles.ctaText}>Kontrole gönder</Text>
            </>
          )}
        </Pressable>
        {!hepsiVar && (
          <Text style={styles.ctaHint}>
            {slotlar.length - cekilen} fotoğraf daha ekle
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  appTitle: { flex: 1, fontSize: 15, fontWeight: '800', paddingLeft: 8, color: colors.onSurface },
  sayac: { fontSize: 14, fontWeight: '700', color: colors.primary, paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepbar: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, marginBottom: 4 },
  step: { flex: 1, height: 5, borderRadius: shape.full, backgroundColor: colors.surfaceContainerHighest },
  stepDone: { backgroundColor: colors.primary },
  stepRed: { backgroundColor: colors.error },
  stepActive: { height: 7 },
  rehber: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: shape.md,
    backgroundColor: colors.surfaceContainerLow,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: 14,
    ...elevation.level1,
  },
  rehberIc: {
    width: 48,
    height: 48,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rehberBaslik: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  rehberYonerge: { fontSize: 13.5, color: colors.onSurface, fontWeight: '500', marginTop: 3 },
  rehberNeden: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 4 },
  onizleme: {
    aspectRatio: 4 / 3,
    borderRadius: shape.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: 12,
  },
  onizlemeImg: { width: '100%', height: '100%' },
  onizlemeBos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.outline,
    borderRadius: shape.lg,
  },
  onizlemeBosText: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500' },
  yukleniyor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  yukleniyorText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  durum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 14,
  },
  durumOk: { backgroundColor: colors.primaryContainer },
  durumRed: { backgroundColor: colors.errorContainer },
  durumText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.onSurface },
  /* Kare bitmişken iki düğme de sönükleşiyor: yapılacak iş artık çekmek
     değil, yayına almak. Yetenek duruyor, vurgu gidiyor. */
  cekBtnSessiz: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
  },
  cekBtnTextSessiz: { color: colors.onSurfaceVariant, fontWeight: '600' },
  cekButonlar: { flexDirection: 'row', gap: 10 },
  cekBtn: {
    flex: 1,
    height: 50,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cekBtnIkincil: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  cekBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tazele: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  tazeleText: { fontSize: 12.5, color: colors.onSurfaceVariant, fontWeight: '600' },
  actionbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    backgroundColor: colors.surfaceContainer,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    ...elevation.level1,
  },
  ctaOff: { opacity: 0.45 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaHint: {
    textAlign: 'center',
    color: colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
});
