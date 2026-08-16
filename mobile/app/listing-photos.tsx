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
import { PhotoRow, loadPhotos, publishListing, uploadPhoto } from '../lib/photos';
import { degerlet } from '../lib/listings';
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

  /* Gösterilen liste opsiyonel kareyi de içeriyor, zorunluluk sayacı
     içermiyor. İkisini ayırmasaydık ya etiket akıştan tamamen düşerdi
     (varsa çekmek istiyoruz) ya da "5/5 tamamlanmadı" diye yayını
     kilitlerdi. */
  const slotlar = gosterilecekSlotlar(hasDamage === '1', isSet === '1');
  const zorunlu = zorunluSlotlar(hasDamage === '1', isSet === '1');
  const [aktif, setAktif] = useState(0);
  const [kareler, setKareler] = useState<Record<string, PhotoRow>>({});
  const [yerel, setYerel] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState<PhotoSlot | null>(null);
  const [yayinlaniyor, setYayinlaniyor] = useState(false);
  const [degerleniyor, setDegerleniyor] = useState(false);

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

  /**
   * "Atla" gerçekten bir yere götürmeli.
   *
   * Üç durum var ve üçü farklı: gidilecek bir sonraki kare varsa oraya;
   * yoksa ama eksik bir zorunlu kare kaldıysa ona (kullanıcı sırayı
   * atlamış olabilir); ikisi de yoksa iş bitmiştir, yayına gönderilir.
   *
   * İlk sürüm indeksi sona kadar artırıp orada kelepçeliyordu. Etiket zaten
   * son slot olduğu için hiçbir şey olmuyor, düğme ölü görünüyordu.
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
    if (hepsiVar && !yayinlaniyor) void yayinla();
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
   * yapıldığından, tek başına ciddi bir fark yaratır.
   *
   * Sonucu: `NSPhotoLibraryUsageDescription` ve `READ_MEDIA_IMAGES` izinleri
   * de düştü. Kullanılmayan izni istemek hem mağaza incelemesinde soru
   * doğurur hem kullanıcıya haksız bir şey sorar.
   */
  async function cek() {
    const izin = await ImagePicker.requestCameraPermissionsAsync();
    if (!izin.granted) {
      uyar('İzin gerekli', 'Fotoğraf çekmek için kamera izni vermen gerekiyor.');
      return;
    }

    /* `allowsEditing` + `aspect: [4,3]` kaldırıldı.
     *
       Bu ikisi, çekimden hemen sonra sistemin kırpma ekranını açıyor ve kareyi
       zorla 4:3'e indiriyordu — telefon 16:9 çektiğinde altından belirgin bir
       parça gidiyordu. Satıcı "kadrajı doldur" diye çektiği kareyi eksik
       yüklüyordu ve kaybolan kısım çoğu zaman ürünün alt tarafı, yani
       tekerlek, ayak, taban oluyordu.

       Artık kamera karesi olduğu gibi yükleniyor. Kırpma yalnızca **gösterim
       anında** yapılıyor (kart 1.5, hero 1.54, ikisi de `cover`) — ama asıl
       dosya tam, tam ekran görüntüleyici bütün kareyi gösteriyor ve
       moderasyon da tam kareyi görüyor. */
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

    /* Reddedilen karede sonraki slota GEÇİLMEZ. Kullanıcı hâlâ ürünün
       başındayken hangi kareyi neden yeniden çekeceğini biliyor olmalı;
       ilerlemek bu bilgiyi en sona, "Kontrole gönder" hatasına erteler.

       Yerel dosya bilerek tutuluyor: sunucudaki nesne ret kararıyla birlikte
       siliniyor, yani önizleme başka türlü boşalır ve kullanıcı hangi kareden
       söz ettiğimizi göremezdi. Kare kendi telefonunda zaten var. */
    if (cikti.durum === 'rejected') {
      uyar('Bu kare geçmedi', cikti.gerekce || 'Kareyi yeniden çekmen gerekiyor.');
      return;
    }

    if (aktif < slotlar.length - 1) setAktif(aktif + 1);
  }

  async function yayinla() {
    setYayinlaniyor(true);

    /* Değerleme yayından hemen önce, burada: modelin ürünü tanıyabilmesi için
       dört açı karesinin onaylanmış olması gerekiyor ve o ancak bu noktada
       kesin. Daha erken çağırsaydık kareler eksikken tanıma denenir, "ürün
       bulunamadı" çıkar ve ilan boşuna insan kuyruğuna düşerdi.

       Sonucuna bakıp akışı durdurmuyoruz: değerleme başarısızsa yayın kapısı
       zaten geçirmeyecek ve aşağıdaki hata kullanıcıya ne olduğunu söyleyecek.
       Burada ayrıca kontrol etmek, aynı kararı iki yerde vermek olurdu. */
    setDegerleniyor(true);
    await degerlet(id!);
    setDegerleniyor(false);

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


        {/* Önizleme.

            Buraya yalnızca `yerel[slot]` — yani o oturumda seçiciyle çekilen
            dosya — çiziliyordu. Ekrana geri dönünce `yerel` boş olduğu için
            çoktan yüklenmiş, hatta incelemeden geçmiş bir kare bile "Bu kare
            henüz çekilmedi" diye görünüyordu: durum çipi "İncelemeden geçti"
            derken hemen üstünde boş bir kutu duruyordu. Artık yerel dosya
            yoksa sunucudaki kare gösteriliyor. */}
        <View style={styles.onizleme}>
          {onizlemeUri ? (
            <Image source={{ uri: onizlemeUri }} style={styles.onizlemeImg} resizeMode="contain" />
          ) : durum?.moderationStatus === 'rejected' ? (
            /* Reddedilen kare depodan siliniyor; ekrana geri dönüldüğünde
               gösterilecek bir görsel kalmıyor. "Önizleme açılamadı" demek
               burada yanlış olur — kare açılamıyor değil, yok. */
            <View style={styles.onizlemeBos}>
              <MaterialIcons name="do-not-disturb-on" size={40} color={colors.outline} />
              <Text style={styles.onizlemeBosText}>Bu kare kabul edilmedi ve silindi</Text>
            </View>
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
              {/* Bekleme artık yükleme + inceleme; sürenin büyük kısmı
                  ikincisi. "Yükleniyor" demek, iki saniye sonra çıkan ret
                  mesajını beklenmedik hâle getiriyordu. */}
              <Text style={styles.yukleniyorText}>Kare inceleniyor…</Text>
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

        {/* Kare bitmişse düğme geri çekiliyor: dolu turkuaz bir düğme ekranın
            ortasında dururken, kare çoktan onaylanmış olsa bile yapılacak iş
            buymuş gibi okunuyordu. Bitmiş karede sönükleşiyor ve "Yeniden çek"
            oluyor; asıl eylem alttaki "Kontrole gönder". Reddedilen kare bunun
            dışında: orada gerçekten yeniden çekmek gerekiyor, düğme dolu
            kalıyor. */}
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

        {/* Atlama, çekmenin alternatifi — o yüzden çekim düğmesinin hemen
            altında, kapsayıcının dışında (kapsayıcı satır düzeninde, içine
            konsaydı kameranın yanına düşerdi). Rehber kartının altındayken
            kullanıcı onu düğme değil açıklama sanıyordu.

            Davranışı `atlaVeIlerle`de; ilk sürüm indeksi sona kelepçeliyordu
            ve etiket zaten son slot olduğu için düğme hiçbir şey yapmıyordu. */}
        {atlanabilir(slot) && !tamam(slot) && (
          <Pressable style={styles.atla} onPress={atlaVeIlerle} accessibilityRole="button">
            <Text style={styles.atlaText}>Etiketim yok, atla</Text>
            <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        )}

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
            /* Değerleme internette arama yapıyor ve saniyeler sürebiliyor.
               Boş bir dönen çarkın altında ne beklendiği belli olmuyor;
               "Değerleniyor…" hem süreyi haklı çıkarıyor hem de kullanıcıya
               puanı kendisinin belirlemediğini bir kez daha söylüyor. */
            <>
              <ActivityIndicator color="#fff" />
              {degerleniyor && <Text style={styles.ctaText}>Değerleniyor…</Text>}
            </>
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
            {zorunlu.length - cekilen} fotoğraf daha ekle
          </Text>
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
  /* Önizleme `contain`: satıcı **yükleyeceği karenin tamamını** görsün.
     `cover` olsaydı ekranda kırpılmış görünür, kırpma kalktığı hâlde satıcı
     hâlâ kesiliyor sanırdı. */
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
