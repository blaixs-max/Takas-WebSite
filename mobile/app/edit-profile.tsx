import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { BOS_PROFIL, Profile, basHarfler, loadProfile, saveProfile } from '../lib/profile';
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
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{bas}</Text>
            </View>
          </View>

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
  avatarWrap: { alignSelf: 'center', marginTop: 6, marginBottom: 18 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: shape.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.primary },
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
