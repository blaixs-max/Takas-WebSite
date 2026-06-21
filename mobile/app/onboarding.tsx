import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
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
        <LinearGradient colors={['rgba(14,40,29,0.12)', 'rgba(14,40,29,0.55)']} style={StyleSheet.absoluteFill} />
        <View style={styles.logo}>
          <View style={styles.logoMark}>
            <MaterialIcons name="change-circle" size={24} color="#fff" />
          </View>
          <Text style={styles.logoText}>KIDS TRADE</Text>
        </View>
        <View style={[styles.float, styles.f1]}>
          <MaterialIcons name="verified-user" size={18} color={colors.primary} />
          <Text style={styles.floatText}>Güvenli havuz</Text>
        </View>
        <View style={[styles.float, styles.f2]}>
          <MaterialIcons name="paid" size={18} color={colors.primary} />
          <Text style={styles.floatText}>Puanla takas</Text>
        </View>
      </View>

      {/* İçerik */}
      <View style={[styles.copy, { paddingBottom: insets.bottom + 22 }]}>
        <Text style={styles.h2}>Çocuk ürünlerinde{'\n'}satış değil, adil takas.</Text>
        <Text style={styles.p}>
          Kullanılmayan oyuncak, kitap ve montessori ürünlerini Takas Puanı'na çevir; güvenli havuz hem alıcıyı hem
          satıcıyı korur.
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
  logo: { position: 'absolute', top: 26, left: 24, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: -0.3 },
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
