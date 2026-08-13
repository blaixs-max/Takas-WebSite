import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { Wordmark } from '../components/brand/Wordmark';
import { BRAND } from '../lib/brand';
import { colors, elevation, shape } from '../theme/tokens';

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { configured, signInWithOAuth } = useAuth();
  const [busy, setBusy] = useState<null | 'google' | 'apple'>(null);

  async function oauth(provider: 'google' | 'apple') {
    // Supabase yoksa demo: doğrudan uygulamaya gir
    if (!configured) {
      router.replace('/(tabs)');
      return;
    }
    setBusy(provider);
    const res = await signInWithOAuth(provider);
    setBusy(null);
    // Başarılıysa oturum dinleyicisi (_layout) yönlendirir.
  }

  function start() {
    if (!configured) router.replace('/(tabs)');
    else router.push('/sign-in');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Sanat alanı */}
      <View style={styles.art}>
        <Image source={require('../assets/products/hero-main-game.jpg')} style={styles.artImg} resizeMode="cover" />
        {/* Perde marka koyusundan (#1F2937). Üst köşe biraz daha kapalı:
            logo oraya oturuyor ve fotoğrafın açık bir yerine denk gelirse
            harfler kayboluyordu. */}
        <LinearGradient
          colors={['rgba(31,41,55,0.55)', 'rgba(31,41,55,0.20)', 'rgba(31,41,55,0.58)']}
          locations={[0, 0.42, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Kelime logosu tek başına — sitenin başlığında da işaret yok. */}
        <View style={styles.logo}>
          <Wordmark height={21} />
        </View>
        <View style={[styles.float, styles.f1]}>
          <MaterialIcons name="verified-user" size={18} color={colors.primary} />
          <Text style={styles.floatText}>Güvenli Havuz</Text>
        </View>
        <View style={[styles.float, styles.f2]}>
          <MaterialIcons name="paid" size={18} color={colors.primary} />
          <Text style={styles.floatText}>Takas Puanı</Text>
        </View>
      </View>

      {/* İçerik */}
      <View style={[styles.copy, { paddingBottom: insets.bottom + 22 }]}>
        {/* Onaylı ekran metni — sitenin hero karuselindeki birinci slayttan
            birebir. Eski metin yalnızca "oyuncak, kitap ve montessori" diyordu;
            kategori mimarisi dokuz ana başlığa çıktığı için ürünü olduğundan
            dar tanıtıyordu. */}
        <Text style={styles.h2}>Bebek ve çocuk{'\n'}ürünlerinde akıllı takas.</Text>
        <Text style={styles.p}>
          {BRAND}'de bebek ve çocuk ürünleri, Takas Puanı ve Güvenli Havuz sistemiyle değerinde el
          değiştirir.
        </Text>
        <View style={styles.pg}>
          <View style={[styles.pgDot, styles.pgOn]} />
          <View style={styles.pgDot} />
          <View style={styles.pgDot} />
        </View>

        <View style={styles.cta}>
          <Pressable style={styles.primary} onPress={start}>
            <MaterialIcons name="rocket-launch" size={22} color="#fff" />
            <Text style={styles.primaryText}>Hemen başla</Text>
          </Pressable>
          <View style={styles.social}>
            <Pressable style={styles.socialBtn} onPress={() => oauth('google')} disabled={busy !== null}>
              {busy === 'google' ? (
                <ActivityIndicator size="small" color={colors.onSurface} />
              ) : (
                <>
                  <View style={styles.gBadge}>
                    <Text style={styles.gBadgeText}>G</Text>
                  </View>
                  <Text style={styles.socialText}>Google</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.socialBtn} onPress={() => oauth('apple')} disabled={busy !== null}>
              {busy === 'apple' ? (
                <ActivityIndicator size="small" color={colors.onSurface} />
              ) : (
                <>
                  <MaterialIcons name="phone-iphone" size={19} color={colors.onSurface} />
                  <Text style={styles.socialText}>Apple</Text>
                </>
              )}
            </Pressable>
          </View>
          <Pressable onPress={start}>
            <Text style={styles.login}>
              Zaten hesabın var mı? <Text style={styles.loginLink}>Giriş yap</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  art: { height: 300, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
  artImg: { width: '100%', height: '100%' },
  logo: { position: 'absolute', top: 26, left: 24 },
  float: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: shape.md,
    paddingVertical: 11,
    paddingHorizontal: 13,
    ...elevation.level2,
  },
  f1: { left: 20, bottom: 54 },
  f2: { right: 20, bottom: 104 },
  floatText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  copy: { flex: 1, paddingHorizontal: 26, paddingTop: 24 },
  h2: { fontSize: 27, fontWeight: '800', lineHeight: 30, letterSpacing: -0.6, color: colors.onSurface },
  p: { marginTop: 11, color: colors.onSurfaceVariant, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  pg: { flexDirection: 'row', gap: 7, marginTop: 16 },
  pgDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.outlineVariant },
  pgOn: { width: 24, borderRadius: shape.full, backgroundColor: colors.primary },
  cta: { marginTop: 'auto', gap: 10 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    ...elevation.level1,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  social: { flexDirection: 'row', gap: 10 },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: shape.full,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  socialText: { fontWeight: '700', fontSize: 14, color: colors.onSurface },
  /* #4285F4 Google'ın kendi marka mavisi. Marka paletine ÇEKİLMEZ — mağaza
     kuralları rozetin değiştirilmeden kullanılmasını şart koşuyor. Sitede
     aynı tuzağa iki kez düşüldü (bkz. icons/StoreMarks.tsx). */
  gBadge: {
    width: 19,
    height: 19,
    borderRadius: shape.full,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  login: { textAlign: 'center', color: colors.onSurfaceVariant, fontSize: 13, fontWeight: '500', marginTop: 4 },
  loginLink: { color: colors.primary, fontWeight: '700' },
});
