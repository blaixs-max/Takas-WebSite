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
import {
  PhotoSlot,
  SLOT_INFO,
  atlanabilir,
  gosterilecekSlotlar,
  zorunluSlotlar,
} from '../data/photoSlots';
import { PhotoRow, loadPhotos, submitListing, uploadPhoto } from '../lib/photos';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Yedi kareyi tek tek gezdiren çekim akışı.
 *
 * Ekran bir seferde tek kare ister ve neden istediğini söyler. Kullanıcı
 * sırayı atlayabilir ama zorunlu kareler tamamlanmadan ilan onaya
 * gönderilemez — o kararı sunucu veriyor, buradaki kontrol yalnızca
 * kullanıcıyı boşuna bekletmemek için.
 *
 * Kareleri ilanla birlikte **yönetici** inceliyor (2026-09-08). Önceden her
 * kare bir görüntü modeline gidiyor, sonra ilan değerleniyor, sonra yayına
 * giriyordu; bu ekran o üç adımın hepsini taşıyordu. Artık tek iş var: kareleri
 * çek, onaya gönder. Gerisi Taslaklar'da izlenir.
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

  /* Gösterilen liste opsiyonel kareyi de içeriyor, zorunluluk sayacı
     içermiyor. İkisini ayırmasaydık ya etiket akıştan tamamen düşerdi
     (varsa çekmek istiyoruz) ya da "5/5 tamamlanmadı" diye gönderimi
     kilitlerdi. */
  const slotlar = gosterilecekSlotlar(hasDamage === '1', isSet === '1');
  const zorunlu = zorunluSlotlar(hasDamage === '1', isSet === '1');
  const [aktif, setAktif] = useState(0);
  const [kareler, setKareler] = useState<Record<string, PhotoRow>>({});
  const [yerel, setYerel] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState<PhotoSlot | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

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
   * saymazsak kullanıcı "gönder"e basıp hata almak yerine hangi kareyi
   * yeniden çekeceğini görür.
   */
  const tamam = (s: PhotoSlot) =>
    kareler[s] ? kareler[s].moderationStatus !== 'rejected' : Boolean(yerel[s]);

  /**
   * "Atla" gerçekten bir yere götürmeli.
   *
   * Üç durum var ve üçü farklı: gidilecek bir sonraki kare varsa oraya;
   * yoksa ama eksik bir zorunlu kare kaldıysa ona (kullanıcı sırayı
   * atlamış olabilir); ikisi de yoksa iş bitmiştir, onaya gönderilir.
   */
  function atlaVeIlerle() {
    const sonraki = slotlar.findIndex((s, i) => i > aktif && !tamam(s));
    if (sonraki !== -1) {
      setAktif(sonraki);
      return;
    }
    const eksikZorunlu = slotlar.findIndex((s) => zorunlu.includes(s) && !tamam(s));
    if (eksikZorunlu !== -1) {
      setAktif(eksikZorunlu);
      return;
    }
    if (hepsiVar && !gonderiliyor) void gonder();
  }

  const cekilen = zorunlu.filter(tamam).length;
  const hepsiVar = cekilen === zorunlu.length;

  /**
   * Kare **yalnızca kamerayla** çekilir; galeriden seçmek kaldırıldı.
   *
   * Bu bir sadeleştirme değil, sahteciliğe karşı bir kapı. Galeri açıkken
   * satıcı üreticinin stok fotoğrafını, başka bir ilanın karesini ya da
   * internetten indirdiği bir görseli yükleyebiliyordu; ikinci elde alıcının
   * tek dayanağı fotoğraf olduğu için bu, sistemin en zayıf yeriydi.
   * Kameradan gelen kare o an, o ürünün karşısında çekilmiş olur.
   *
   * Tam güvence değil — kararlı biri ekranı fotoğraflayabilir. Ama kolay
   * yolu kapatmak, dolandırıcılığın büyük kısmını kolay olduğu için
   * yapıldığından, tek başına ciddi bir fark yaratır. Artık kareye bir insan
   * baktığı için ekran fotoğrafı da eskisinden zor geçer.
   */
  async function cek() {
    const izin = await ImagePicker.requestCameraPermissionsAsync();
    if (!izin.granted) {
      uyar('İzin gerekli', 'Fotoğraf çekmek için kamera izni vermen gerekiyor.');
      return;
    }

    /* `allowsEditing` + `aspect: [4,3]` yok: sistemin kırpma ekranı kareyi
       zorla 4:3'e indiriyor ve ürünün altını (tekerlek, ayak, taban)
       kesiyordu. Kamera karesi olduğu gibi yükleniyor; kırpma yalnızca
       gösterim anında, dosya tam. */
    const sonuc = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

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

    /* Çekim sırasında hiçbir kapı yok — kare yüklendi, sıradakine geçiliyor.
       Yönlendirme duruyor: hangi açının çekileceği, çerçeveleme ipucu ve
       ilerleme çubuğu aynen yerinde. */
    if (aktif < slotlar.length - 1) setAktif(aktif + 1);
  }

  /**
   * Onaya gönder.
   *
   * Sunucu zorunlu karelerin yüklü ve reddedilmemiş olduğuna bakar, ilanı
   * incelemeye alır. Kullanıcı ekrandan çıkar; ekibimiz bakıp puanı belirler,
   * onaylanınca ya da düzeltme istenince bildirim gelir. Burada beklemenin
   * anlamı yok — kararı saatler sürebilen bir insan veriyor.
   */
  async function gonder() {
    setGonderiliyor(true);
    const sonuc = await submitListing(id!);
    setGonderiliyor(false);
    if (!sonuc.ok) {
      uyar('Gönderilemedi', sonuc.message);
      await tazele();
      return;
    }
    uyar(
      'İlanın incelemeye alındı',
      `${title ?? 'İlanın'} ekibimize ulaştı. Ürünün durumuna ve piyasa fiyatına bakıp takas puanını belirleyeceğiz; onaylanınca vitrine çıkar ve sana bildirim gelir. Burada beklemene gerek yok.`,
      [{ text: 'Tamam', onPress: () => router.replace('/') }],
    );
  }

  const durum = kareler[slot];
  /* Gösterilecek kare: bu oturumda çekilen dosya, yoksa sunucudaki. */
  const onizlemeUri = yerel[slot] ?? durum?.url ?? null;
  const slotBitti = Boolean(durum) && durum.moderationStatus !== 'rejected';

  return (
    <View style={styles.root}>
      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Fotoğraflar</Text>
        <Text style={styles.sayac}>
          {cekilen}/{zorunlu.length}
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
            {atlanabilir(slot) && <Text style={styles.rehberOpsiyonel}>Bu kare zorunlu değil</Text>}
          </View>
        </View>

        {/* Önizleme: yerel dosya yoksa sunucudaki kare. Yalnızca yerel dosya
            çizilseydi ekrana geri dönen kullanıcı yüklenmiş kareyi bile
            "çekilmedi" görürdü. */}
        <View style={styles.onizleme}>
          {onizlemeUri ? (
            <Image source={{ uri: onizlemeUri }} style={styles.onizlemeImg} resizeMode="contain" />
          ) : durum?.moderationStatus === 'rejected' ? (
            <View style={styles.onizlemeBos}>
              <MaterialIcons name="do-not-disturb-on" size={40} color={colors.outline} />
              <Text style={styles.onizlemeBosText}>Bu kare kabul edilmedi, yeniden çek</Text>
            </View>
          ) : durum ? (
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

        {/* Kare durumu: yalnızca reddedilmişse söylenecek bir şey var.
            "İnceleniyor" artık kare kare değil ilan düzeyinde ve Taslaklar'da
            görünüyor; burada tekrarlamak kullanıcıyı bekletirdi. */}
        {durum?.moderationStatus === 'rejected' && (
          <View style={[styles.durum, styles.durumRed]}>
            <MaterialIcons name="error" size={20} color={colors.error} />
            <Text style={styles.durumText}>
              {durum.moderationReason || 'Bu kare kabul edilmedi, yeniden çekin'}
            </Text>
          </View>
        )}

        {/* Kare bitmişse düğme geri çekiliyor: bitmiş karede sönükleşiyor ve
            "Yeniden çek" oluyor; asıl eylem alttaki "Onaya gönder". Reddedilen
            kare bunun dışında: orada gerçekten yeniden çekmek gerekiyor. */}
        <View style={styles.cekButonlar}>
          <Pressable style={[styles.cekBtn, slotBitti && styles.cekBtnSessiz]} onPress={cek}>
            <MaterialIcons
              name={slotBitti ? 'refresh' : 'photo-camera'}
              size={20}
              color={slotBitti ? colors.onSurfaceVariant : '#fff'}
            />
            <Text style={[styles.cekBtnText, slotBitti && styles.cekBtnTextSessiz]}>
              {slotBitti ? 'Yeniden çek' : 'Kamera ile çek'}
            </Text>
          </Pressable>
        </View>

        {atlanabilir(slot) && !tamam(slot) && (
          <Pressable style={styles.atla} onPress={atlaVeIlerle} accessibilityRole="button">
            <Text style={styles.atlaText}>Etiketim yok, atla</Text>
            <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.actionbar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          style={[styles.cta, (!hepsiVar || gonderiliyor) && styles.ctaOff]}
          disabled={!hepsiVar || gonderiliyor}
          onPress={gonder}
        >
          {gonderiliyor ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color="#fff" />
              <Text style={styles.ctaText}>Onaya gönder</Text>
            </>
          )}
        </Pressable>
        {!hepsiVar ? (
          <Text style={styles.ctaHint}>{zorunlu.length - cekilen} fotoğraf daha ekle</Text>
        ) : (
          <Text style={styles.ctaHint}>Ekibimiz bakıp puanı belirleyecek; onaylanınca haber vereceğiz</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rehberOpsiyonel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  atla: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: shape.full,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  atlaText: { fontSize: 14, fontWeight: '800', color: colors.primary },
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
  /* Önizleme `contain`: satıcı yükleyeceği karenin tamamını görsün. */
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
  durumRed: { backgroundColor: colors.errorContainer },
  durumText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.onSurface },
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
  cekBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
