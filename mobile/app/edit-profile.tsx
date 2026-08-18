import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uyar } from '../components/Dialog';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOS_PROFIL, Profile, basHarfler, loadProfile, saveProfile } from '../lib/profile';
import { AvatarBilgisi, BOS_AVATAR, loadMyAvatar, removeAvatar, uploadAvatar } from '../lib/avatar';
import { hataBildir } from '../lib/hatalar';
import { useAuth } from '../lib/auth';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Profili düzenle.
 *
 * Bu ekran bir maketti: alanlar sabit metinle ("Emrah Atabek",
 * "Kadıköy, İstanbul") doluyordu ve iki kaydet düğmesi de yalnızca
 * `router.back()` çağırıyordu. Kaydettiğini söyleyip hiçbir şey kaydetmiyordu.
 *
 * Bedeli soyut değildi: ad boş kaldığı için `create_listing` `seller_name`'i
 * e-posta adresinden türetiyor ve ilk canlı ilan pazarlama sitesine
 * "emrahatabek" adıyla düştü.
 */
export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [profil, setProfil] = useState<Profile>(BOS_PROFIL);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);

  useEffect(() => {
    let iptal = false;
    loadProfile()
      .then((p) => {
        if (!iptal) setProfil(p);
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [user]);

  /**
   * Profil fotoğrafı.
   *
   * Ekrandaki baş harfler yerini fotoğrafa bırakıyor ama **yalnızca
   * onaylandıysa.** `pending` iken kendi fotoğrafını görüyorsun ve üstünde
   * "inceleniyor" yazıyor; başkasına hiç görünmüyor. Bu ayrımı arayüzde
   * yapıyoruz ama tek dayanağımız o değil: depolama politikası da onaysız
   * avatarın bağlantısını üretmiyor.
   */
  const [avatar, setAvatar] = useState<AvatarBilgisi>(BOS_AVATAR);
  const [avatarIsi, setAvatarIsi] = useState(false);

  const avatarTazele = useCallback(async () => {
    setAvatar(await loadMyAvatar());
  }, []);

  useEffect(() => {
    avatarTazele();
  }, [avatarTazele, user]);

  /**
   * Galeri ya da kamera.
   *
   * İlan karelerinde galeri bilerek kapalı — orada bir sahtecilik kapısı.
   * Profil fotoğrafında tam tersi: insanların çoğunun kullanmak istediği
   * fotoğraf zaten galerisinde duruyor ve "şimdi çek" demek, özelliği
   * kullanılmaz kılardı.
   *
   * İzin ikisi için de ayrı ayrı isteniyor. Kamera izni reddedilince galeri
   * iznini hiç istemeden galeriyi açmak, iOS'ta sessizce boş dönüyor —
   * kullanıcı düğmeye basıyor, hiçbir şey olmuyor, sebebini anlamıyor.
   */
  async function fotografSec() {
    const secenekler: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const galeri = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!galeri.granted) {
      uyar(
        'İzin gerekli',
        'Profil fotoğrafı seçmek için galeri izni vermen gerekiyor. Telefon ayarlarından ELDENELE için açabilirsin.',
      );
      return;
    }
    const sonuc = await ImagePicker.launchImageLibraryAsync(secenekler);
    if (sonuc.canceled || !sonuc.assets?.[0]?.uri) return;

    /* `try/finally`: bayrak bir istisnada da temizlenmeli. Öncesinde
       `setAvatarIsi(false)` düz bir satırdı ve `uploadAvatar` beklenmedik bir
       hata fırlatırsa (ağ, dosya okuma) bayrak `true` kalıyordu — avatar
       alanının tamamı `disabled`, yani ekran DONMUŞ görünüyordu. Kullanıcı
       2026-08-18 testinde tam bunu bildirdi. */
    setAvatarIsi(true);
    let s: Awaited<ReturnType<typeof uploadAvatar>>;
    try {
      s = await uploadAvatar(sonuc.assets[0].uri);
    } catch (e) {
      uyar('Yüklenemedi', 'Fotoğraf yüklenirken beklenmedik bir hata oldu. Tekrar dene.');
      void hataBildir(e, { kaynak: 'avatar-yukle' });
      return;
    } finally {
      setAvatarIsi(false);
    }

    if (!s.ok) {
      uyar('Yüklenemedi', s.message);
      return;
    }
    await avatarTazele();

    if (s.durum === 'rejected') {
      uyar('Fotoğraf kullanılamadı', s.gerekce ?? 'Bu fotoğraf kurallara uygun bulunmadı.');
      return;
    }
    if (s.durum === 'pending') {
      uyar(
        'Fotoğrafın incelemede',
        'Denetim tamamlanana kadar fotoğrafın yalnızca sana görünür. Onaylanınca profilinde yayına girer.',
      );
    }
  }

  function fotografKaldir() {
    uyar('Fotoğrafı kaldır', 'Profil fotoğrafın silinecek ve yerine baş harflerin gelecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: async () => {
          setAvatarIsi(true);
          try {
            const s = await removeAvatar();
            if (!s.ok) {
              uyar('Kaldırılamadı', s.message);
              return;
            }
            await avatarTazele();
          } catch (e) {
            uyar('Kaldırılamadı', 'Beklenmedik bir hata oldu. Tekrar dene.');
            void hataBildir(e, { kaynak: 'avatar-kaldir' });
          } finally {
            setAvatarIsi(false);
          }
        },
      },
    ]);
  }

  const adTamam = profil.fullName.trim().length >= 2;
  const gonderilebilir = adTamam && !kaydediyor && !yukleniyor;

  async function kaydet() {
    if (!user) {
      uyar('Giriş gerekli', 'Profilini düzenlemek için önce giriş yap.');
      return;
    }
    setKaydediyor(true);
    const sonuc = await saveProfile(profil);
    setKaydediyor(false);

    if (!sonuc.ok) {
      uyar('Kaydedilemedi', sonuc.message);
      return;
    }
    router.back();
  }

  const bas = basHarfler(profil.fullName);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Profili düzenle</Text>
        {/* Başlıktaki kaydet de gerçekten kaydediyor; eskiden geri dönüyordu. */}
        <Pressable onPress={kaydet} disabled={!gonderilebilir}>
          <Text style={[styles.save, !gonderilebilir && styles.saveOff]}>Kaydet</Text>
        </Pressable>
      </View>

      {yukleniyor ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarWrap}>
            <Pressable
              style={styles.avatar}
              onPress={fotografSec}
              disabled={avatarIsi}
              accessibilityLabel="Profil fotoğrafı seç"
            >
              {avatar.url ? (
                <Image source={{ uri: avatar.url }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{bas}</Text>
              )}
              {avatarIsi && (
                <View style={styles.avatarOrtu}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              <View style={styles.avatarRozet}>
                <MaterialIcons name="photo-camera" size={15} color="#fff" />
              </View>
            </Pressable>

            <View style={styles.avatarAksiyon}>
              <Pressable onPress={fotografSec} disabled={avatarIsi} hitSlop={8}>
                <Text style={styles.avatarLink}>
                  {avatar.url ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
                </Text>
              </Pressable>
              {/* Kaldır yalnızca `avatar.url` varken çiziliyordu ve bu bir
                  çıkmaz üretiyordu: reddedilen avatarın yolu sunucuda
                  boşaltılıyor, yani URL yok — ama kırmızı gerekçe kutusu
                  ekranda kalıyor ve onu kapatacak düğme görünmüyordu.
                  Koşul artık "temizlenecek bir durum var mı". */}
              {avatar.url || avatar.durum ? (
                <Pressable onPress={fotografKaldir} disabled={avatarIsi} hitSlop={8}>
                  <Text style={[styles.avatarLink, { color: colors.error }]}>
                    {avatar.url ? 'Kaldır' : 'Uyarıyı temizle'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Durum ekranda yazılı. Yazmasaydı `pending` bir avatar
                kullanıcıya "yayında" gibi görünürdü — kendisi görüyor,
                başkası görmüyor ve bunu hiçbir yerden öğrenemezdi. */}
            {avatar.durum === 'pending' && (
              <View style={[styles.avatarDurum, { backgroundColor: colors.tertiaryContainer }]}>
                <MaterialIcons name="hourglass-empty" size={14} color={colors.onTertiaryContainer} />
                <Text style={[styles.avatarDurumText, { color: colors.onTertiaryContainer }]}>
                  İnceleniyor — şimdilik yalnızca sen görüyorsun
                </Text>
              </View>
            )}
            {avatar.durum === 'rejected' && (
              <View style={[styles.avatarDurum, { backgroundColor: colors.errorContainer }]}>
                <MaterialIcons name="error-outline" size={14} color={colors.error} />
                <Text style={[styles.avatarDurumText, { color: colors.error }]}>
                  {avatar.gerekce ?? 'Fotoğraf kurallara uygun bulunmadı.'}
                </Text>
              </View>
            )}
          </View>

          {/* Kuralı yükleme anında değil, önce söylüyoruz. Reddedilen bir
              fotoğrafın gerekçesini sonradan okumak, kuralı baştan bilmekten
              daha kötü bir deneyim. */}
          <Text style={styles.avatarNot}>
            Kendi fotoğrafın olmak zorunda değil — çizim, hayvan ya da bir nesne de olur.
            Müstehcen görseller, şiddet içeren sahneler ve çocuk yüzü kullanılamıyor.
          </Text>

          <Text style={styles.label}>AD SOYAD</Text>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={profil.fullName}
              onChangeText={(t) => setProfil({ ...profil, fullName: t })}
              placeholder="Örn. Emrah Atabek"
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={60}
              autoCapitalize="words"
            />
          </View>
          {/* Adın nereye gittiğini söylüyoruz: ilanlarda görünen ad bu ve
              kısaltılmış hâliyle pazarlama sitesine de çıkıyor. */}
          <Text style={styles.hint}>
            İlanlarında görünen ad. Web sitesinde kısaltılır — “Emrah Atabek” yazarsan
            “Emrah A.” olarak görünür. Boş bırakılırsa e-posta adresinden türetilir.
          </Text>

          <Text style={styles.label}>KONUM</Text>
          <View style={styles.field}>
            <MaterialIcons name="place" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              style={styles.input}
              value={profil.city}
              onChangeText={(t) => setProfil({ ...profil, city: t })}
              placeholder="Örn. Kadıköy"
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={60}
            />
          </View>

          <Text style={styles.label}>HAKKINDA</Text>
          <View style={[styles.field, styles.bioField]}>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={profil.bio}
              onChangeText={(t) => setProfil({ ...profil, bio: t })}
              placeholder="Kendinden kısaca bahset"
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              maxLength={280}
            />
          </View>

          <Pressable
            style={[styles.saveBtn, !gonderilebilir && styles.saveBtnOff]}
            onPress={kaydet}
            disabled={!gonderilebilir}
          >
            {kaydediyor ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Değişiklikleri kaydet</Text>
              </>
            )}
          </Pressable>
          {!adTamam && <Text style={styles.uyari}>Kaydetmek için adını yaz.</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', paddingLeft: 8, color: colors.onSurface },
  save: { color: colors.primary, fontWeight: '800', fontSize: 13.5, paddingHorizontal: 12 },
  saveOff: { opacity: 0.4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  loading: { paddingVertical: 60, alignItems: 'center' },
  avatarWrap: { alignItems: 'center', marginTop: 6, marginBottom: 4 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 26, fontWeight: '800', color: colors.primary },
  avatarOrtu: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  /* Rozet dairenin İÇİNDE: `overflow: 'hidden'` dışarı taşan bir rozeti
     kırpardı ve fotoğraf yüklendiğinde rozet yarım görünürdü. */
  avatarRozet: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarAksiyon: { flexDirection: 'row', gap: 16, marginTop: 10 },
  avatarLink: { fontSize: 12.5, fontWeight: '800', color: colors.primary },
  avatarDurum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: shape.sm,
  },
  avatarDurumText: { flex: 1, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  avatarNot: {
    fontSize: 11.5,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  /* İlan formundaki `flabel` ile aynı ölçü — iki form aynı dili konuşsun. */
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 7,
    marginTop: 14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerHigh,
  },
  bioField: { alignItems: 'flex-start', paddingVertical: 12 },
  input: { flex: 1, fontSize: 14, color: colors.onSurface },
  hint: {
    fontSize: 11.5,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    marginTop: 8,
    lineHeight: 17,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    marginTop: 26,
    ...elevation.level1,
  },
  saveBtnOff: { opacity: 0.45 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  uyari: {
    textAlign: 'center',
    color: colors.onSurfaceVariant,
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 8,
  },
});
