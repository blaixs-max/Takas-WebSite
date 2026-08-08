import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
      Alert.alert(
        'İzin gerekli',
        kaynak === 'kamera'
          ? 'Fotoğraf çekmek için kamera izni vermelisiniz.'
          : 'Galeriden seçmek için izin vermelisiniz.',
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
      Alert.alert('Yüklenemedi', cikti.message);
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
      Alert.alert('Yayına alınamadı', sonuc.message);
      await tazele();
      return;
    }
    Alert.alert('İlan yayında', `${title ?? 'İlanınız'} rafa eklendi.`, [
      { text: 'Tamam', onPress: () => router.replace('/') },
    ]);
  }

  const durum = kareler[slot];

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

        {/* Önizleme */}
        <View style={styles.onizleme}>
          {yerel[slot] ? (
            <Image source={{ uri: yerel[slot] }} style={styles.onizlemeImg} />
          ) : (
            <View style={styles.onizlemeBos}>
              <MaterialIcons name="add-a-photo" size={40} color={colors.outline} />
              <Text style={styles.onizlemeBosText}>Bu kare henüz çekilmedi</Text>
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

        <View style={styles.cekButonlar}>
          <Pressable style={styles.cekBtn} onPress={() => cek('kamera')}>
            <MaterialIcons name="photo-camera" size={20} color="#fff" />
            <Text style={styles.cekBtnText}>Çek</Text>
          </Pressable>
          <Pressable style={[styles.cekBtn, styles.cekBtnIkincil]} onPress={() => cek('galeri')}>
            <MaterialIcons name="photo-library" size={20} color={colors.primary} />
            <Text style={[styles.cekBtnText, { color: colors.primary }]}>Galeriden seç</Text>
          </Pressable>
        </View>

        <Pressable style={styles.tazele} onPress={tazele}>
          <MaterialIcons name="refresh" size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.tazeleText}>İnceleme durumunu yenile</Text>
        </Pressable>
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
              <Text style={styles.ctaText}>İlanı yayına al</Text>
            </>
          )}
        </Pressable>
        {!hepsiVar && (
          <Text style={styles.ctaHint}>
            {slotlar.length - cekilen} kare daha çekilmeli
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  appTitle: { flex: 1, fontSize: 18, fontWeight: '700', paddingLeft: 8, color: colors.onSurface },
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
  rehberBaslik: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
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
